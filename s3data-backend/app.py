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
    return jsonify({
        'status': 'healthy',
        'service': 's3data-backend',
        'timestamp': datetime.now().isoformat()
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3700))
    app.logger.info(f"Starting S3 Data Backend server on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)