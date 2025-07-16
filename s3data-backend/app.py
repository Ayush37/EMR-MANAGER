#!/usr/bin/env python3
import os
import json
import logging
from datetime import datetime
from logging.handlers import RotatingFileHandler
from flask import Flask, jsonify, request, Response
from flask_cors import CORS
import boto3
from botocore.exceptions import ClientError, BotoCoreError
import pyarrow.parquet as pq
import pyarrow as pa
import pyarrow.compute as pc
from io import BytesIO
import re
import csv
import time
from openai import AzureOpenAI
from azure.identity import CertificateCredential

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configure URL prefix for ALB routing
URL_PREFIX = os.getenv('URL_PREFIX', '/s3data-api')

# Configure logging
log_level = os.getenv('LOG_LEVEL', 'INFO').upper()
log_format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'

# Create logs directory if it doesn't exist
os.makedirs('logs', exist_ok=True)

# File handler
file_handler = RotatingFileHandler('logs/s3data-backend.log', maxBytes=10485760, backupCount=5)
file_handler.setLevel(logging.DEBUG)
file_handler.setFormatter(logging.Formatter(log_format))

# Console handler  
console_handler = logging.StreamHandler()
console_handler.setLevel(getattr(logging, log_level))
console_handler.setFormatter(logging.Formatter(log_format))

# Configure app logger
app.logger.setLevel(logging.DEBUG)
app.logger.addHandler(file_handler)
app.logger.addHandler(console_handler)

# Configure werkzeug logger
werkzeug_logger = logging.getLogger('werkzeug')
werkzeug_logger.setLevel(logging.WARNING)

# Initialize AWS clients
try:
    # Check if running in ECS
    ecs_container_metadata = os.environ.get('ECS_CONTAINER_METADATA_URI_V4')
    
    if ecs_container_metadata:
        # Use IAM role in ECS
        session = boto3.Session()
        s3 = session.client('s3')
        app.logger.info('AWS session initialized with IAM role credentials')
    else:
        # Use profile for local development
        AWS_PROFILE = os.environ.get('AWS_PROFILE', 'ecdp')
        session = boto3.Session(profile_name=AWS_PROFILE)
        s3 = session.client('s3')
        app.logger.info(f'AWS session initialized with profile: {AWS_PROFILE}')
except Exception as e:
    app.logger.error(f'Failed to initialize AWS session: {str(e)}')
    s3 = None

# S3 bucket configurations
S3_BUCKETS = {
    'uat1': {
        'REFINED': 'app-id-107923-dep-id-107924-uu-id-jeenytlg33g7',
        'TRUSTED': 'app-id-107923-dep-id-107924-uu-id-kt5v3fs07tmt'
    },
    'uat2': {
        'REFINED': 'app-id-107923-dep-id-107924-uu-id-7t0rirfzx89e',
        'TRUSTED': 'app-id-107923-dep-id-107924-uu-id-2dtbj1jbapb6'
    },
    'uat3': {
        'REFINED': 'app-id-107923-dep-id-107924-uu-id-dtki7sd5claw',
        'TRUSTED': 'app-id-107923-dep-id-107924-uu-id-tnrbe5r2yovs'
    }
}

# Azure OpenAI Configuration
AZURE_OPENAI_ENDPOINT = os.getenv('AZURE_OPENAI_ENDPOINT', '')
AZURE_OPENAI_API_KEY = os.getenv('AZURE_OPENAI_API_KEY', '')
AZURE_OPENAI_API_VERSION = os.getenv('AZURE_OPENAI_API_VERSION', '2024-02-15-preview')
AZURE_OPENAI_DEPLOYMENT_NAME = os.getenv('AZURE_OPENAI_DEPLOYMENT_NAME', '')
AZURE_TENANT_ID = os.getenv('AZURE_TENANT_ID', '')
AZURE_SPN_CLIENT_ID = os.getenv('AZURE_SPN_CLIENT_ID', '')
AZURE_USER_ID = os.getenv('AZURE_USER_ID', 'emr-manager')
AZURE_PEM_PATH = '/app/azure_cert.pem'

# Azure OpenAI initialization
azure_credential = None
AZURE_OPENAI_ENABLED = False

# Log Azure OpenAI configuration
app.logger.info("=" * 60)
app.logger.info("Azure OpenAI Configuration Check")
app.logger.info("=" * 60)

# Check for missing configuration
missing = []
if not AZURE_OPENAI_ENDPOINT:
    missing.append("AZURE_OPENAI_ENDPOINT")
if not AZURE_OPENAI_API_KEY:
    missing.append("AZURE_OPENAI_API_KEY")
if not AZURE_OPENAI_DEPLOYMENT_NAME:
    missing.append("AZURE_OPENAI_DEPLOYMENT_NAME")

# Check for Service Principal credentials (for hybrid auth)
sp_missing = []
if not AZURE_TENANT_ID:
    sp_missing.append("AZURE_TENANT_ID")
if not AZURE_SPN_CLIENT_ID:
    sp_missing.append("AZURE_SPN_CLIENT_ID")
if not os.path.exists(AZURE_PEM_PATH):
    sp_missing.append("azure_cert.pem")

if missing:
    app.logger.error(f"✗ Azure OpenAI core settings missing: {', '.join(missing)}")
    app.logger.error("Query generation feature will be disabled")
    AZURE_OPENAI_ENABLED = False
else:
    # Try hybrid authentication first (Service Principal + API Key)
    if not sp_missing:
        try:
            app.logger.info("Attempting Azure AD + API Key hybrid authentication...")
            
            # Initialize Service Principal credential for Azure AD token
            app.logger.info("Step 1: Creating CertificateCredential...")
            app.logger.info(f"  - Tenant ID: {AZURE_TENANT_ID}")
            app.logger.info(f"  - Client ID: {AZURE_SPN_CLIENT_ID}")
            app.logger.info(f"  - Certificate Path: {AZURE_PEM_PATH}")
            
            azure_credential = CertificateCredential(
                tenant_id=AZURE_TENANT_ID,
                client_id=AZURE_SPN_CLIENT_ID,
                certificate_path=AZURE_PEM_PATH
            )
            app.logger.info("✓ CertificateCredential created successfully")
            
            # Test the credential and get initial token
            app.logger.info("Step 2: Requesting Azure AD token...")
            app.logger.info("  - Scope: https://cognitiveservices.azure.com/.default")
            
            try:
                token_response = azure_credential.get_token("https://cognitiveservices.azure.com/.default")
                access_token = token_response.token
                app.logger.info(f"✓ Successfully obtained Azure AD access token")
                app.logger.info(f"  - Token length: {len(access_token)} characters")
                app.logger.info(f"  - Token preview: {access_token[:20]}...{access_token[-20:]}")
                app.logger.info(f"  - Expires on: {datetime.fromtimestamp(token_response.expires_on).isoformat()}")
            except Exception as token_error:
                app.logger.error(f"✗ Failed to get Azure AD token: {str(token_error)}")
                app.logger.error(f"  - Error type: {type(token_error).__name__}")
                if hasattr(token_error, 'error'):
                    app.logger.error(f"  - Error code: {getattr(token_error, 'error', 'N/A')}")
                if hasattr(token_error, 'error_description'):
                    app.logger.error(f"  - Error description: {getattr(token_error, 'error_description', 'N/A')}")
                raise
            
            AZURE_OPENAI_ENABLED = True
            app.logger.info("=" * 60)
            app.logger.info("Azure OpenAI integration ENABLED - Hybrid authentication ready")
            app.logger.info("=" * 60)
            
        except Exception as e:
            app.logger.error("✗ Failed to initialize Azure OpenAI with hybrid authentication")
            app.logger.error(f"  - Error: {str(e)}")
            app.logger.error(f"  - Error type: {type(e).__name__}")
            app.logger.warning("Falling back to API Key only authentication...")
    else:
        app.logger.info(f"Service Principal credentials missing: {', '.join(sp_missing)}")
        app.logger.info("Using API Key authentication only...")
    
    # If Azure AD failed or SP credentials are missing, try API key only authentication
    if not AZURE_OPENAI_ENABLED:
        try:
            app.logger.info("=" * 60)
            app.logger.info("Initializing Azure OpenAI with API Key authentication only")
            app.logger.info("=" * 60)
            app.logger.info(f"  - Endpoint: {AZURE_OPENAI_ENDPOINT}")
            app.logger.info(f"  - Deployment: {AZURE_OPENAI_DEPLOYMENT_NAME}")
            app.logger.info(f"  - API Version: {AZURE_OPENAI_API_VERSION}")
            app.logger.info(f"  - API Key: {'*' * 30}{AZURE_OPENAI_API_KEY[-4:]}")
            
            AZURE_OPENAI_ENABLED = True
            app.logger.info("✓ Azure OpenAI client configuration ready (API Key mode)")
            app.logger.info("=" * 60)
            app.logger.info("Azure OpenAI integration ENABLED - API Key authentication mode")
            app.logger.info("=" * 60)
            
        except Exception as e:
            app.logger.error("✗ Failed to initialize Azure OpenAI with API Key authentication")
            app.logger.error(f"  - Error: {str(e)}")
            app.logger.error(f"  - Error type: {type(e).__name__}")
            app.logger.error("Query generation feature will be disabled")
            AZURE_OPENAI_ENABLED = False

def create_new_openai_client():
    """Create a new Azure OpenAI client with fresh token - following LROT_AZURE.py pattern"""
    if not AZURE_OPENAI_ENABLED:
        return None
    
    try:
        app.logger.info("Creating new Azure OpenAI client with fresh token...")
        
        # Get fresh token - exactly like LROT_AZURE.py does
        if azure_credential:
            # Azure AD authentication path
            token_response = azure_credential.get_token("https://cognitiveservices.azure.com/.default")
            access_token = token_response.token
            
            app.logger.info(f"✓ Fresh token obtained")
            app.logger.info(f"  - Token preview: {access_token[:20]}...{access_token[-20:]}")
            
            # Create new client with fresh token
            client = AzureOpenAI(
                azure_endpoint=AZURE_OPENAI_ENDPOINT,
                api_key=AZURE_OPENAI_API_KEY,
                api_version=AZURE_OPENAI_API_VERSION,
                default_headers={
                    "Authorization": f"Bearer {access_token}",
                    "x-ms-useragent": AZURE_USER_ID
                }
            )
        else:
            # API key only path
            app.logger.info("Creating client with API key only")
            client = AzureOpenAI(
                azure_endpoint=AZURE_OPENAI_ENDPOINT,
                api_key=AZURE_OPENAI_API_KEY,
                api_version=AZURE_OPENAI_API_VERSION,
                default_headers={"x-ms-useragent": AZURE_USER_ID}
            )
        
        app.logger.info("✓ New Azure OpenAI client created successfully")
        return client
        
    except Exception as e:
        app.logger.error(f"✗ Failed to create new Azure OpenAI client: {str(e)}")
        app.logger.error(f"  - Error type: {type(e).__name__}")
        raise

# Parquet to Snowflake type mapping
PARQUET_TO_SNOWFLAKE_TYPE = {
    'int8': 'NUMBER(3, 0)',
    'int16': 'NUMBER(5, 0)',
    'int32': 'NUMBER(10, 0)',
    'int64': 'NUMBER(19, 0)',
    'uint8': 'NUMBER(3, 0)',
    'uint16': 'NUMBER(5, 0)',
    'uint32': 'NUMBER(10, 0)',
    'uint64': 'NUMBER(20, 0)',
    'float': 'FLOAT',
    'double': 'DOUBLE',
    'bool': 'BOOLEAN',
    'string': 'TEXT',
    'timestamp[ns]': 'TIMESTAMP_NTZ',
    'timestamp[us]': 'TIMESTAMP_NTZ',
    'timestamp[ms]': 'TIMESTAMP_NTZ',
    'date32[day]': 'DATE',
    'date64[ms]': 'DATE',
    'decimal128': 'NUMBER(38, 0)',
    'binary': 'BINARY',
    'large_string': 'TEXT'
}

# Request logging middleware
@app.before_request
def log_request_info():
    """Log request information"""
    app.logger.debug(f'{request.method} {request.path} - IP: {request.remote_addr}')
    
    # Only try to parse JSON if content-type is application/json
    if request.content_type and 'application/json' in request.content_type:
        try:
            body = request.get_json()
            if body:
                app.logger.debug(f'Request body: {json.dumps(body)}')
        except Exception as e:
            app.logger.debug(f'Failed to parse request body: {str(e)}')

@app.after_request
def log_response_info(response):
    """Log response information"""
    app.logger.debug(f'{request.method} {request.path} - Status: {response.status_code}')
    return response

@app.route(f'{URL_PREFIX}/', methods=['GET'])
@app.route(f'{URL_PREFIX}', methods=['GET'])
def index():
    """Root endpoint that returns service information"""
    return jsonify({
        'service': 's3data-viewer',
        'version': '1.0.0',
        'status': 'healthy',
        'endpoints': {
            'list': f'{URL_PREFIX}/list',
            'preview': f'{URL_PREFIX}/preview',
            'download': f'{URL_PREFIX}/download',
            'generate-query': f'{URL_PREFIX}/generate-query',
            'health': f'{URL_PREFIX}/health'
        },
        'timestamp': datetime.now().isoformat()
    })

@app.route(f'{URL_PREFIX}/list', methods=['GET'])
def list_objects():
    """List S3 objects in a bucket with pagination"""
    try:
        environment = request.args.get('environment', 'uat1')
        bucket_type = request.args.get('bucket_type', 'REFINED')
        prefix = request.args.get('prefix', '')
        page_token = request.args.get('page_token', '')
        
        # Validate environment and bucket type
        if environment not in S3_BUCKETS:
            return jsonify({"error": "Invalid environment"}), 400
        if bucket_type not in S3_BUCKETS[environment]:
            return jsonify({"error": "Invalid bucket type"}), 400
            
        bucket_name = S3_BUCKETS[environment][bucket_type]
        app.logger.debug(f"Listing objects in {bucket_name} with prefix: {prefix}")
        
        # List objects with pagination
        params = {
            'Bucket': bucket_name,
            'Prefix': prefix,
            'Delimiter': '/',
            'MaxKeys': 100
        }
        
        if page_token:
            params['ContinuationToken'] = page_token
            
        response = s3.list_objects_v2(**params)
        
        # Process directories (common prefixes)
        directories = []
        if 'CommonPrefixes' in response:
            for prefix_info in response['CommonPrefixes']:
                dir_path = prefix_info['Prefix']
                dir_name = dir_path.rstrip('/').split('/')[-1]
                directories.append({
                    'name': dir_name,
                    'path': dir_path,
                    'type': 'directory',
                    'size': '-',
                    'lastModified': '-'
                })
        
        # Process files (only .parquet files)
        files = []
        if 'Contents' in response:
            for obj in response['Contents']:
                key = obj['Key']
                # Skip if it's the prefix itself
                if key == prefix:
                    continue
                # Only include .parquet files
                if key.endswith('.parquet'):
                    file_name = key.split('/')[-1]
                    files.append({
                        'name': file_name,
                        'path': key,
                        'type': 'file',
                        'size': obj['Size'],
                        'lastModified': obj['LastModified'].isoformat() if hasattr(obj['LastModified'], 'isoformat') else str(obj['LastModified'])
                    })
        
        # Combine and sort (directories first, then files)
        items = directories + files
        
        return jsonify({
            'items': items,
            'nextPageToken': response.get('NextContinuationToken'),
            'isTruncated': response.get('IsTruncated', False),
            'prefix': prefix,
            'bucket': bucket_name,
            'environment': environment,
            'bucketType': bucket_type
        })
        
    except Exception as e:
        app.logger.error(f"Error listing objects: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route(f'{URL_PREFIX}/preview', methods=['GET'])
def preview_parquet():
    """Preview a parquet file"""
    try:
        environment = request.args.get('environment', 'uat1')
        bucket_type = request.args.get('bucket_type', 'REFINED')
        file_path = request.args.get('path', '')
        
        if not file_path:
            return jsonify({"error": "File path required"}), 400
            
        # Validate environment and bucket type
        if environment not in S3_BUCKETS:
            return jsonify({"error": "Invalid environment"}), 400
        if bucket_type not in S3_BUCKETS[environment]:
            return jsonify({"error": "Invalid bucket type"}), 400
            
        bucket_name = S3_BUCKETS[environment][bucket_type]
        app.logger.debug(f"Previewing parquet file: s3://{bucket_name}/{file_path}")
        
        try:
            # Get file metadata first
            head_response = s3.head_object(Bucket=bucket_name, Key=file_path)
            file_size = head_response['ContentLength']
            
            # Check if file is too large (e.g., > 100MB)
            MAX_PREVIEW_SIZE = 100 * 1024 * 1024  # 100MB
            if file_size > MAX_PREVIEW_SIZE:
                return jsonify({
                    'error': 'File too large for preview',
                    'fileSize': file_size,
                    'maxSize': MAX_PREVIEW_SIZE,
                    'message': f'File size ({file_size / 1024 / 1024:.2f}MB) exceeds preview limit ({MAX_PREVIEW_SIZE / 1024 / 1024}MB)'
                }), 413
            
            # Download the file
            response = s3.get_object(Bucket=bucket_name, Key=file_path)
            parquet_data = response['Body'].read()
            
            # Read parquet file using pyarrow
            parquet_file = pq.ParquetFile(BytesIO(parquet_data))
            
            # Get metadata
            total_rows = parquet_file.metadata.num_rows
            schema = parquet_file.schema_arrow
            columns = [field.name for field in schema]
            total_columns = len(columns)
            
            # Read first batch (up to 500 rows)
            preview_rows = min(500, total_rows)
            
            # Read the table
            table = parquet_file.read()
            
            # Slice to get preview rows
            if total_rows > preview_rows:
                table = table.slice(0, preview_rows)
            
            # Convert to list of dictionaries
            data = []
            for i in range(len(table)):
                record = {}
                for col_name in columns:
                    value = table[col_name][i].as_py()
                    # Handle None values and special float values
                    if value is None or (isinstance(value, float) and (value != value or value == float('inf') or value == float('-inf'))):
                        record[col_name] = None
                    else:
                        record[col_name] = value
                data.append(record)
            
            return jsonify({
                'data': data,
                'metadata': {
                    'totalRows': total_rows,
                    'totalColumns': total_columns,
                    'columns': columns,
                    'fileSize': file_size,
                    'previewRows': preview_rows,
                    'fileName': file_path.split('/')[-1]
                }
            })
            
        except ClientError as e:
            if e.response['Error']['Code'] == 'NoSuchKey':
                return jsonify({"error": "File not found"}), 404
            raise
            
    except Exception as e:
        app.logger.error(f"Error previewing parquet file: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route(f'{URL_PREFIX}/download', methods=['GET'])
def download_file():
    """Download a parquet file or export as Excel"""
    try:
        environment = request.args.get('environment', 'uat1')
        bucket_type = request.args.get('bucket_type', 'REFINED')
        file_path = request.args.get('path', '')
        format_type = request.args.get('format', 'parquet')  # 'parquet' or 'excel'
        
        if not file_path:
            return jsonify({"error": "File path required"}), 400
            
        # Validate environment and bucket type
        if environment not in S3_BUCKETS:
            return jsonify({"error": "Invalid environment"}), 400
        if bucket_type not in S3_BUCKETS[environment]:
            return jsonify({"error": "Invalid bucket type"}), 400
            
        bucket_name = S3_BUCKETS[environment][bucket_type]
        app.logger.debug(f"Downloading file: s3://{bucket_name}/{file_path} as {format_type}")
        
        # Download the file
        response = s3.get_object(Bucket=bucket_name, Key=file_path)
        parquet_data = response['Body'].read()
        
        if format_type == 'parquet':
            # Return as parquet file
            filename = file_path.split('/')[-1]
            return Response(
                parquet_data,
                mimetype='application/octet-stream',
                headers={
                    'Content-Disposition': f'attachment; filename="{filename}"',
                    'Content-Type': 'application/octet-stream'
                }
            )
        elif format_type == 'excel' or format_type == 'csv':
            # Convert to CSV (simpler than Excel without pandas)
            parquet_file = pq.ParquetFile(BytesIO(parquet_data))
            table = parquet_file.read()
            
            # Limit CSV export to 100,000 rows
            MAX_CSV_ROWS = 100000
            if table.num_rows > MAX_CSV_ROWS:
                table = table.slice(0, MAX_CSV_ROWS)
                app.logger.info(f"CSV export limited to {MAX_CSV_ROWS} rows")
            
            # Create CSV file in memory
            csv_buffer = BytesIO()
            
            # Write CSV using pyarrow's CSV writer
            csv_options = pa.csv.WriteOptions(include_header=True)
            pa.csv.write_csv(table, csv_buffer, write_options=csv_options)
            
            csv_data = csv_buffer.getvalue()
            filename = file_path.split('/')[-1].replace('.parquet', '.csv')
            
            return Response(
                csv_data,
                mimetype='text/csv',
                headers={
                    'Content-Disposition': f'attachment; filename="{filename}"',
                    'Content-Type': 'text/csv'
                }
            )
        else:
            return jsonify({"error": "Invalid format type"}), 400
            
    except Exception as e:
        app.logger.error(f"Error downloading file: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route(f'{URL_PREFIX}/test-azure-openai', methods=['GET'])
def test_azure_openai():
    """Test Azure OpenAI connectivity"""
    app.logger.info("Azure OpenAI test endpoint called")
    
    if not AZURE_OPENAI_ENABLED:
        return jsonify({
            'status': 'error',
            'message': 'Azure OpenAI is not configured',
            'timestamp': datetime.now().isoformat()
        }), 503
    
    try:
        # Create new client with fresh token
        openai_client = create_new_openai_client()
        if not openai_client:
            raise Exception("Failed to create OpenAI client")
        
        # Make a simple test call
        app.logger.info("Making test API call to Azure OpenAI...")
        completion = openai_client.chat.completions.create(
            model=AZURE_OPENAI_DEPLOYMENT_NAME,
            messages=[
                {"role": "user", "content": "Say 'Azure OpenAI is working!' in exactly 5 words."}
            ],
            temperature=0,
            max_tokens=20,
            timeout=10
        )
        
        response_text = completion.choices[0].message.content
        app.logger.info(f"✓ Test successful! Response: {response_text}")
        
        return jsonify({
            'status': 'success',
            'message': 'Azure OpenAI connection verified',
            'response': response_text,
            'model': completion.model,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        app.logger.error(f"✗ Test failed: {str(e)}", exc_info=True)
        return jsonify({
            'status': 'error',
            'message': f'Azure OpenAI test failed: {str(e)}',
            'error_type': type(e).__name__,
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route(f'{URL_PREFIX}/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 's3data-backend',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/health', methods=['GET'])
def health_check_root():
    """Health check endpoint at root for ECS/ALB health checks"""
    app.logger.info(f"Health check called - Method: {request.method}, Path: {request.path}")
    app.logger.info(f"Headers: {dict(request.headers)}")
    return jsonify({
        'status': 'healthy',
        'service': 's3data-backend',
        'timestamp': datetime.now().isoformat()
    })

@app.route(f'{URL_PREFIX}/generate-query', methods=['POST'])
def generate_snowflake_query():
    """Generate Snowflake query from natural language"""
    try:
        if not AZURE_OPENAI_ENABLED:
            return jsonify({
                "error": "Query generation feature is not available. Azure OpenAI is not configured."
            }), 503
        
        # Get request data
        data = request.get_json()
        if not data:
            return jsonify({"error": "Request body required"}), 400
        
        environment = data.get('environment', 'uat1')
        bucket_type = data.get('bucket_type', 'REFINED')
        file_path = data.get('file_path', '')
        natural_language_query = data.get('query', '')
        
        if not file_path:
            return jsonify({"error": "File path required"}), 400
        if not natural_language_query:
            return jsonify({"error": "Query text required"}), 400
        
        # Validate environment and bucket type
        if environment not in S3_BUCKETS:
            return jsonify({"error": "Invalid environment"}), 400
        if bucket_type not in S3_BUCKETS[environment]:
            return jsonify({"error": "Invalid bucket type"}), 400
        
        bucket_name = S3_BUCKETS[environment][bucket_type]
        app.logger.info(f"Generating Snowflake query for: s3://{bucket_name}/{file_path}")
        
        # Get parquet schema
        try:
            response = s3.get_object(Bucket=bucket_name, Key=file_path)
            parquet_data = response['Body'].read()
            parquet_file = pq.ParquetFile(BytesIO(parquet_data))
            schema = parquet_file.schema_arrow
        except Exception as e:
            app.logger.error(f"Error reading parquet file: {str(e)}")
            return jsonify({"error": f"Failed to read parquet file: {str(e)}"}), 500
        
        # Build schema info for OpenAI
        schema_info = []
        for field in schema:
            parquet_type = str(field.type)
            snowflake_type = PARQUET_TO_SNOWFLAKE_TYPE.get(parquet_type, 'VARIANT')
            schema_info.append({
                'column_name': field.name,
                'parquet_type': parquet_type,
                'snowflake_type': snowflake_type
            })
        
        # Build Snowflake stage path
        # Map bucket names to Snowflake stage aliases
        stage_mapping = {
            'uat1': {
                'REFINED': '@PROD_107923_DB.LRI_BASE.CADSS3_LRSS_PROD_REFINED',
                'TRUSTED': '@PROD_107923_DB.LRI_BASE.CADSS3_LRSS_PROD_TRUSTED'
            },
            'uat2': {
                'REFINED': '@PROD_107923_DB.LRI_BASE.CADSS3_LRSS_UAT2_REFINED',
                'TRUSTED': '@PROD_107923_DB.LRI_BASE.CADSS3_LRSS_UAT2_TRUSTED'
            },
            'uat3': {
                'REFINED': '@PROD_107923_DB.LRI_BASE.CADSS3_LRSS_UAT3_REFINED',
                'TRUSTED': '@PROD_107923_DB.LRI_BASE.CADSS3_LRSS_UAT3_TRUSTED'
            }
        }
        
        stage_alias = stage_mapping.get(environment, {}).get(bucket_type, '@YOUR_STAGE')
        full_stage_path = f"{stage_alias}/{file_path}"
        
        # Prepare prompt for OpenAI
        prompt = f"""
You are a Snowflake SQL expert. Generate a Snowflake query to read from a parquet file based on the user's natural language request.

Parquet File Schema:
{json.dumps(schema_info, indent=2)}

User Request: {natural_language_query}

Important Instructions:
1. Use the Snowflake parquet syntax: $1:column_name::DATA_TYPE
2. The FROM clause should be: {full_stage_path} (FILE_FORMAT => 'LRI_BASE.FILE_FORMAT_PARQUET') t
3. Include column aliases using AS to match the original column names
4. Always add LIMIT 1000 at the end unless the user specifies a different limit
5. If the user asks for all columns, select all columns from the schema
6. Map the data types according to the schema provided
7. Handle column names with special characters by wrapping them in double quotes if needed

Example format:
SELECT
    $1:column1::TEXT AS column1,
    $1:column2::NUMBER(38, 0) AS column2
FROM
{full_stage_path}
    (FILE_FORMAT => 'LRI_BASE.FILE_FORMAT_PARQUET') t
WHERE
    condition
LIMIT 1000;

Generate only the SQL query, no explanations.
"""
        
        # Call OpenAI with retry logic
        max_retries = 3
        retry_delay = 2  # seconds
        
        for attempt in range(max_retries):
            try:
                # Create new client for each attempt (fresh token)
                openai_client = create_new_openai_client()
                if not openai_client:
                    raise Exception("Failed to create OpenAI client")
                
                # Log the actual API call details
                app.logger.info("Making chat.completions.create call:")
                app.logger.info(f"  - Model: {AZURE_OPENAI_DEPLOYMENT_NAME}")
                app.logger.info(f"  - Prompt length: {len(prompt)} characters")
                app.logger.info(f"  - Temperature: 0.1")
                app.logger.info(f"  - Max tokens: 2000")
                app.logger.info(f"  - Attempt: {attempt + 1}/{max_retries}")
                
                response = openai_client.chat.completions.create(
                    model=AZURE_OPENAI_DEPLOYMENT_NAME,
                    messages=[
                        {"role": "system", "content": "You are a Snowflake SQL expert. Generate only SQL queries, no explanations."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.1,
                    max_tokens=2000,
                    timeout=30
                )
                
                generated_query = response.choices[0].message.content.strip()
                app.logger.info(f"✓ Azure OpenAI query generation completed successfully")
                app.logger.info(f"  - Response length: {len(generated_query)} characters")
                app.logger.info(f"  - Model used: {response.model}")
                app.logger.info(f"  - Tokens used: {response.usage.total_tokens if response.usage else 'N/A'}")
                
                return jsonify({
                    'query': generated_query,
                    'schema': schema_info,
                    'stage_path': full_stage_path,
                    'file_name': file_path.split('/')[-1]
                })
                
            except Exception as e:
                app.logger.error(f"✗ Azure OpenAI attempt {attempt + 1} failed")
                app.logger.error(f"  - Error: {str(e)}")
                app.logger.error(f"  - Error type: {type(e).__name__}")
                
                # Log specific error details for common issues
                error_str = str(e).lower()
                if 'authentication' in error_str or 'unauthorized' in error_str:
                    app.logger.error("  - This appears to be an authentication error")
                    app.logger.error("  - Check: API key, token, tenant ID, client ID, and permissions")
                elif 'not found' in error_str:
                    app.logger.error("  - This appears to be a deployment/model not found error")
                    app.logger.error(f"  - Check: Deployment name '{AZURE_OPENAI_DEPLOYMENT_NAME}' exists in your Azure OpenAI resource")
                elif 'timeout' in error_str:
                    app.logger.error("  - This appears to be a timeout error")
                    app.logger.error("  - The API call took too long to respond")
                
                if attempt < max_retries - 1:
                    wait_time = retry_delay * (attempt + 1)
                    app.logger.info(f"  - Waiting {wait_time} seconds before retry...")
                    import time
                    time.sleep(wait_time)
                else:
                    app.logger.error(f"✗ All {max_retries} attempts failed")
                    app.logger.error("Full error details:", exc_info=True)
                    return jsonify({"error": f"Failed to generate query after {max_retries} attempts: {str(e)}"}), 500
            
    except Exception as e:
        app.logger.error(f"Error in generate_snowflake_query: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.errorhandler(415)
def handle_415_error(e):
    app.logger.error(f"415 Error - Method: {request.method}, Path: {request.path}")
    app.logger.error(f"Content-Type: {request.content_type}")
    app.logger.error(f"Headers: {dict(request.headers)}")
    app.logger.error(f"Error: {str(e)}")
    return jsonify({
        'error': 'Unsupported Media Type',
        'message': str(e),
        'path': request.path,
        'method': request.method,
        'content_type': request.content_type
    }), 415

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3700))
    app.logger.info(f"Starting S3 Data Backend server on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)