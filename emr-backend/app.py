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
import gzip
import re
from io import BytesIO
from azure.identity import CertificateCredential
from openai import AzureOpenAI

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configure URL prefix for ALB routing
URL_PREFIX = os.getenv('URL_PREFIX', '/api')

# Configure logging
log_level = os.getenv('LOG_LEVEL', 'INFO').upper()

# Set up root logger
logging.basicConfig(
    level=getattr(logging, log_level),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Configure Flask app logger
app.logger.setLevel(getattr(logging, log_level))

# Add console handler for CloudWatch
console_handler = logging.StreamHandler()
console_handler.setLevel(getattr(logging, log_level))
console_handler.setFormatter(logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
))
app.logger.addHandler(console_handler)

# Add file handler as backup
log_dir = 'logs'
os.makedirs(log_dir, exist_ok=True)
log_file = os.path.join(log_dir, 'emr-backend.log')

file_handler = RotatingFileHandler(log_file, maxBytes=10485760, backupCount=5)
file_handler.setLevel(getattr(logging, log_level))
file_handler.setFormatter(logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s [in %(pathname)s:%(lineno)d]'
))
app.logger.addHandler(file_handler)

# Log startup
app.logger.info(f'EMR Backend service started with log level: {log_level}')

# AWS Configuration
AWS_REGION = os.getenv('AWS_REGION', 'us-east-1')

# Initialize AWS clients
try:
    # Check if running in ECS/Lambda (AWS_EXECUTION_ENV is set) or if profile is explicitly disabled
    if os.getenv('AWS_EXECUTION_ENV') or os.getenv('USE_IAM_ROLE', 'false').lower() == 'true':
        # Use IAM role credentials (for ECS/Lambda)
        session = boto3.Session(region_name=AWS_REGION)
        ssm = session.client('ssm')
        emr = session.client('emr')
        lambda_client = session.client('lambda')
        s3 = session.client('s3')
        app.logger.info('AWS session initialized with IAM role credentials')
    else:
        # Use profile for local development
        AWS_PROFILE = os.getenv('AWS_PROFILE', 'adfsjit')
        session = boto3.Session(profile_name=AWS_PROFILE, region_name=AWS_REGION)
        ssm = session.client('ssm')
        emr = session.client('emr')
        lambda_client = session.client('lambda')
        s3 = session.client('s3')
        app.logger.info(f'AWS session initialized with profile: {AWS_PROFILE}')
except Exception as e:
    app.logger.error(f'Failed to initialize AWS session: {str(e)}')
    ssm = None
    emr = None
    lambda_client = None
    s3 = None

# Constants for multiple environments
PARAM_STORE_PATHS = {
    'uat1': "/application/ecdp-config/uat1/EMR-BASE/",
    'uat2': "/application/ecdp-config/uat2/EMR-BASE/",
    'uat3': "/application/ecdp-config/uat3/EMR-BASE/"
}

LAMBDA_FUNCTION_NAMES = {
    'uat1': "app-job_submit_lambda_uat1",
    'uat2': "app-job_submit_lambda_uat2",
    'uat3': "app-job_submit_lambda_uat3"
}

# S3 log bucket for all UAT environments
S3_LOG_BUCKET = 'app-id-107923-dep-id-107924-uu-id-mpm6sfacq4a8'

# Azure OpenAI Configuration - Hybrid Authentication (Service Principal + API Key)
AZURE_OPENAI_ENDPOINT = os.getenv('AZURE_OPENAI_ENDPOINT', '')
AZURE_OPENAI_API_KEY = os.getenv('AZURE_OPENAI_API_KEY', '')  # OpenAI API Key
AZURE_OPENAI_API_VERSION = os.getenv('AZURE_OPENAI_API_VERSION', '2024-02-15-preview')
AZURE_OPENAI_DEPLOYMENT_NAME = os.getenv('AZURE_OPENAI_DEPLOYMENT_NAME', '')

# Service Principal Configuration for Azure AD Token
AZURE_TENANT_ID = os.getenv('AZURE_TENANT_ID', '')
AZURE_SPN_CLIENT_ID = os.getenv('AZURE_SPN_CLIENT_ID', '')
AZURE_PEM_PATH = os.getenv('AZURE_PEM_PATH', '/app/azure_cert.pem')
AZURE_USER_ID = os.getenv('AZURE_USER_ID', 'emr-manager')  # User ID for headers

# Initialize Azure OpenAI client if credentials are available
azure_openai_client = None
azure_credential = None  # Store credential globally for reuse
AZURE_OPENAI_ENABLED = False

# Check credentials and initialize Azure AD token provider
app.logger.info("=" * 60)
app.logger.info("Starting Azure OpenAI hybrid authentication initialization")
app.logger.info("=" * 60)

# Log all configuration (mask sensitive parts)
app.logger.info(f"AZURE_OPENAI_ENDPOINT: {AZURE_OPENAI_ENDPOINT}")
app.logger.info(f"AZURE_OPENAI_API_KEY: {'*' * 20}{AZURE_OPENAI_API_KEY[-4:] if AZURE_OPENAI_API_KEY else 'NOT SET'}")
app.logger.info(f"AZURE_OPENAI_DEPLOYMENT_NAME: {AZURE_OPENAI_DEPLOYMENT_NAME}")
app.logger.info(f"AZURE_OPENAI_API_VERSION: {AZURE_OPENAI_API_VERSION}")
app.logger.info(f"AZURE_TENANT_ID: {AZURE_TENANT_ID[:8]}...{AZURE_TENANT_ID[-4:] if AZURE_TENANT_ID else 'NOT SET'}")
app.logger.info(f"AZURE_SPN_CLIENT_ID: {AZURE_SPN_CLIENT_ID[:8]}...{AZURE_SPN_CLIENT_ID[-4:] if AZURE_SPN_CLIENT_ID else 'NOT SET'}")
app.logger.info(f"AZURE_PEM_PATH: {AZURE_PEM_PATH}")
app.logger.info(f"AZURE_USER_ID: {AZURE_USER_ID}")

# Check OpenAI credentials
openai_missing = []
if not AZURE_OPENAI_ENDPOINT:
    openai_missing.append("AZURE_OPENAI_ENDPOINT")
if not AZURE_OPENAI_API_KEY:
    openai_missing.append("AZURE_OPENAI_API_KEY")
if not AZURE_OPENAI_DEPLOYMENT_NAME:
    openai_missing.append("AZURE_OPENAI_DEPLOYMENT_NAME")

# Check Service Principal credentials
sp_missing = []
if not AZURE_TENANT_ID:
    sp_missing.append("AZURE_TENANT_ID")
if not AZURE_SPN_CLIENT_ID:
    sp_missing.append("AZURE_SPN_CLIENT_ID")
if not os.path.exists(AZURE_PEM_PATH):
    sp_missing.append(f"PEM certificate at {AZURE_PEM_PATH}")
else:
    # Log PEM file details
    try:
        pem_stat = os.stat(AZURE_PEM_PATH)
        app.logger.info(f"PEM file exists - Size: {pem_stat.st_size} bytes, Permissions: {oct(pem_stat.st_mode)[-3:]}")
        
        # Check if we can read the PEM file
        with open(AZURE_PEM_PATH, 'r') as f:
            pem_content = f.read()
            if 'BEGIN CERTIFICATE' in pem_content:
                app.logger.info("PEM file contains certificate")
            if 'BEGIN PRIVATE KEY' in pem_content or 'BEGIN RSA PRIVATE KEY' in pem_content:
                app.logger.info("PEM file contains private key")
            if 'BEGIN ENCRYPTED PRIVATE KEY' in pem_content:
                app.logger.warning("PEM file contains ENCRYPTED private key - this may cause issues")
    except Exception as e:
        app.logger.error(f"Error reading PEM file: {str(e)}")
        sp_missing.append(f"PEM file read error: {str(e)}")

# Check if we have at least the basic OpenAI credentials
if openai_missing:
    app.logger.warning(f"OpenAI credentials missing: {', '.join(openai_missing)}")
    app.logger.warning("Step analysis feature disabled due to missing OpenAI credentials")
    AZURE_OPENAI_ENABLED = False
else:
    # First try Azure AD authentication if Service Principal credentials are available
    if not sp_missing:
        try:
            global azure_credential
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
            
            # Initialize Azure OpenAI client with API key and custom headers
            app.logger.info("Step 3: Creating Azure OpenAI client with hybrid auth...")
            app.logger.info(f"  - Endpoint: {AZURE_OPENAI_ENDPOINT}")
            app.logger.info(f"  - Deployment: {AZURE_OPENAI_DEPLOYMENT_NAME}")
            app.logger.info(f"  - API Version: {AZURE_OPENAI_API_VERSION}")
            app.logger.info(f"  - API Key: {'*' * 30}{AZURE_OPENAI_API_KEY[-4:]}")
            
            # Create headers with Bearer token and user ID
            default_headers = {
                "Authorization": f"Bearer {access_token}",
                "x-ms-useragent": AZURE_USER_ID
            }
            app.logger.info(f"  - Headers: Authorization=Bearer..., x-ms-useragent={AZURE_USER_ID}")
            
            azure_openai_client = AzureOpenAI(
                azure_endpoint=AZURE_OPENAI_ENDPOINT,
                api_key=AZURE_OPENAI_API_KEY,
                api_version=AZURE_OPENAI_API_VERSION,
                default_headers=default_headers
            )
            
            # Store credential for token refresh
            azure_openai_client._credential = azure_credential
            
            AZURE_OPENAI_ENABLED = True
            app.logger.info("✓ Azure OpenAI client created successfully")
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
            
            # Create client with just API key and user agent header
            azure_openai_client = AzureOpenAI(
                azure_endpoint=AZURE_OPENAI_ENDPOINT,
                api_key=AZURE_OPENAI_API_KEY,
                api_version=AZURE_OPENAI_API_VERSION,
                default_headers={"x-ms-useragent": AZURE_USER_ID}
            )
            
            AZURE_OPENAI_ENABLED = True
            app.logger.info("✓ Azure OpenAI client created with API Key authentication")
            app.logger.info("=" * 60)
            app.logger.info("Azure OpenAI integration ENABLED - API Key authentication mode")
            app.logger.info("=" * 60)
            
        except Exception as e:
            app.logger.error("✗ Failed to initialize Azure OpenAI with API Key authentication")
            app.logger.error(f"  - Error: {str(e)}")
            app.logger.error(f"  - Error type: {type(e).__name__}")
            app.logger.error("Step analysis feature will be disabled")
            AZURE_OPENAI_ENABLED = False

def refresh_azure_token():
    """Force a completely new Azure AD token for every request"""
    if not AZURE_OPENAI_ENABLED:
        return
    
    # Skip refresh if using API key only authentication (no credential stored)
    if not hasattr(azure_openai_client, '_credential'):
        app.logger.debug("Token refresh skipped - Using API Key authentication mode")
        return
    
    try:
        app.logger.info("Getting new Azure AD token for request...")
        
        # Clear any cached tokens in the credential provider
        if hasattr(azure_openai_client._credential, '_token_cache'):
            azure_openai_client._credential._token_cache.clear()
            app.logger.debug("Cleared credential token cache")
        
        # Force get a completely new token
        import time
        current_time = int(time.time())
        token_response = azure_openai_client._credential.get_token(
            "https://cognitiveservices.azure.com/.default",
            enable_cae=True,  # Force fresh token
            claims=f"timestamp={current_time}"  # Force unique request
        )
        access_token = token_response.token
        
        # Completely reset all headers
        azure_openai_client.default_headers.clear()
        azure_openai_client.default_headers["Authorization"] = f"Bearer {access_token}"
        azure_openai_client.default_headers["x-ms-useragent"] = AZURE_USER_ID
        
        # Force update internal client headers if they exist
        if hasattr(azure_openai_client, '_client'):
            if hasattr(azure_openai_client._client, 'headers'):
                azure_openai_client._client.headers.clear()
                azure_openai_client._client.headers.update(azure_openai_client.default_headers)
            
            # Also clear any session caches
            if hasattr(azure_openai_client._client, '_session'):
                azure_openai_client._client._session = None
                app.logger.debug("Cleared client session cache")
        
        app.logger.info(f"✓ New Azure AD token obtained successfully")
        app.logger.info(f"  - Token preview: {access_token[:20]}...{access_token[-20:]}")
        app.logger.info(f"  - Expires on: {datetime.fromtimestamp(token_response.expires_on).isoformat()}")
        app.logger.info(f"  - Time until expiry: {token_response.expires_on - current_time} seconds")
        
        # Verify the header is set correctly
        current_auth = azure_openai_client.default_headers.get("Authorization", "")
        app.logger.info(f"  - Authorization header set: {current_auth[:30]}...")
        
    except Exception as e:
        app.logger.error(f"✗ Failed to get new Azure AD token: {str(e)}")
        app.logger.error(f"  - Error type: {type(e).__name__}")
        app.logger.error(f"  - Full error: {repr(e)}")
        raise

# Request logging middleware
@app.before_request
def log_request_info():
    """Log information about incoming requests"""
    app.logger.debug('Headers: %s', request.headers)
    app.logger.info('Request: %s %s', request.method, request.path)
    
    # Only try to parse JSON if content-type is application/json
    if request.content_type and 'application/json' in request.content_type:
        try:
            body = request.get_json()
            if body:
                app.logger.debug('Body: %s', body)
        except Exception as e:
            app.logger.debug('Failed to parse request body: %s', str(e))

@app.after_request
def log_response_info(response):
    """Log information about outgoing responses"""
    app.logger.info('Response: %s %s - Status: %s', 
                    request.method, 
                    request.path, 
                    response.status_code)
    return response

@app.route(f'{URL_PREFIX}/clusters', methods=['GET'])
def get_clusters():
    """Fetch all clusters from Parameter Store and their current states with pagination"""
    try:
        app.logger.debug("Fetching clusters data")
        
        # Get parameters
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 20))
        environment = request.args.get('environment', 'all')
        search = request.args.get('search', '').lower()
        states = request.args.get('states', '')  # comma-separated list
        
        # Parse states filter
        state_filter = []
        if states:
            state_filter = [s.strip().upper() for s in states.split(',') if s.strip()]
        
        # Validate pagination parameters
        if page < 1:
            page = 1
        if limit < 1 or limit > 100:
            limit = 20
        
        # Get cluster configurations from Parameter Store for selected environment(s)
        if environment == 'all':
            cluster_configs = []
            for env in ['uat1', 'uat2', 'uat3']:
                configs = get_cluster_configs(env)
                for config in configs:
                    config['environment'] = env.upper()
                cluster_configs.extend(configs)
        else:
            cluster_configs = get_cluster_configs(environment)
            for config in cluster_configs:
                config['environment'] = environment.upper()
        
        app.logger.debug(f"Retrieved {len(cluster_configs)} cluster configs")
        
        # Get current EMR cluster states
        emr_clusters = list_emr_clusters()
        app.logger.debug(f"Retrieved {len(emr_clusters)} EMR clusters")
        
        # Merge the data
        merged_clusters = map_cluster_states(cluster_configs, emr_clusters)
        app.logger.debug(f"Merged data for {len(merged_clusters)} clusters")
        
        # Apply search filter
        if search:
            merged_clusters = [
                cluster for cluster in merged_clusters
                if (cluster.get('name') and search in cluster['name'].lower()) or
                   (cluster.get('clusterId') and search in cluster.get('clusterId', '').lower()) or
                   (cluster.get('state') and search in cluster.get('state', '').lower())
            ]
            app.logger.debug(f"After search filter: {len(merged_clusters)} clusters")
        
        # Apply state filter
        if state_filter:
            merged_clusters = [
                cluster for cluster in merged_clusters
                if cluster.get('state', 'UNKNOWN') in state_filter
            ]
            app.logger.debug(f"After state filter: {len(merged_clusters)} clusters")
        
        # Apply pagination
        total_count = len(merged_clusters)
        skip = (page - 1) * limit
        paginated_clusters = merged_clusters[skip:skip + limit]
        total_pages = (total_count + limit - 1) // limit
        
        return jsonify({
            'clusters': paginated_clusters,
            'pagination': {
                'page': page,
                'limit': limit,
                'total': total_count,
                'totalPages': total_pages,
                'hasNext': page < total_pages,
                'hasPrev': page > 1
            }
        })
    except Exception as e:
        app.logger.error(f"Error in get_clusters: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route(f'{URL_PREFIX}/clusters/<name>', methods=['GET'])
def get_cluster(name):
    """Get details for a specific cluster"""
    try:
        app.logger.debug(f"Fetching details for cluster: {name}")
            
        # Get cluster configurations
        cluster_configs = get_cluster_configs()
        emr_clusters = list_emr_clusters()
        merged_clusters = map_cluster_states(cluster_configs, emr_clusters)

        # Find the specific cluster
        cluster = next((c for c in merged_clusters if c['name'] == name), None)
        if not cluster:
            app.logger.warning(f"Cluster not found: {name}")
            return jsonify({"error": f"Cluster {name} not found"}), 404

        app.logger.debug(f"Successfully fetched details for cluster: {name}")
        return jsonify(cluster)
    except Exception as e:
        app.logger.error(f"Error in get_cluster: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route(f'{URL_PREFIX}/clusters/<name>/start', methods=['POST'])
def start_cluster(name):
    """Start a specific EMR cluster"""
    try:
        app.logger.debug(f"Request to start cluster: {name}")
        
        # Get environment from request body or determine from cluster name
        data = request.json or {}
        environment = data.get('environment', 'uat1')
        
        # Get the appropriate Lambda function for the environment
        lambda_function_name = LAMBDA_FUNCTION_NAMES.get(environment, LAMBDA_FUNCTION_NAMES['uat1'])
            
        payload = {
            "resource": "/executions/clusters",
            "path": "/executions/clusters",
            "body": json.dumps({
                "cluster_name": name,
                "job_type": "CLUSTER",
                "request_type": "CREATE",
                "fifo_key": name
            }),
            "httpMethod": "POST"
        }

        app.logger.debug(f"Invoking Lambda {lambda_function_name} to start cluster: {name}")
        response = lambda_client.invoke(
            FunctionName=lambda_function_name,
            Payload=json.dumps(payload)
        )

        # Parse the Lambda response
        response_payload = json.loads(response['Payload'].read().decode())
        app.logger.debug(f"Lambda response for starting cluster {name}: {response_payload}")
        return jsonify(response_payload)
    except Exception as e:
        app.logger.error(f"Error starting cluster {name}: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route(f'{URL_PREFIX}/clusters/<name>/terminate', methods=['POST'])
def terminate_cluster(name):
    """Terminate a specific EMR cluster"""
    try:
        app.logger.debug(f"Request to terminate cluster: {name}")
        
        # Get environment from request body or determine from cluster name
        data = request.json or {}
        environment = data.get('environment', 'uat1')
        
        # Get the appropriate Lambda function for the environment
        lambda_function_name = LAMBDA_FUNCTION_NAMES.get(environment, LAMBDA_FUNCTION_NAMES['uat1'])
            
        payload = {
            "resource": "/executions/clusters",
            "path": "/executions/clusters",
            "body": json.dumps({
                "cluster_name": name,
                "job_type": "CLUSTER",
                "request_type": "DELETE",
                "fifo_key": name,
                "termination_mode": "IMMEDIATE"
            }),
            "httpMethod": "DELETE"
        }

        app.logger.debug(f"Invoking Lambda {lambda_function_name} to terminate cluster: {name}")
        response = lambda_client.invoke(
            FunctionName=lambda_function_name,
            Payload=json.dumps(payload)
        )

        # Parse the Lambda response
        response_payload = json.loads(response['Payload'].read().decode())
        app.logger.debug(f"Lambda response for terminating cluster {name}: {response_payload}")
        return jsonify(response_payload)
    except Exception as e:
        app.logger.error(f"Error terminating cluster {name}: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route(f'{URL_PREFIX}/clusters/<cluster_id>/steps', methods=['GET'])
def get_cluster_steps(cluster_id):
    """Get all steps for a specific cluster with pagination"""
    try:
        app.logger.debug(f"Fetching steps for cluster: {cluster_id}")
        
        # Get pagination parameters
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 20))
        
        # Validate pagination parameters
        if page < 1:
            page = 1
        if limit < 1 or limit > 100:
            limit = 20
        
        # List all steps for the cluster
        all_steps = []
        marker = None
        
        while True:
            kwargs = {'ClusterId': cluster_id}
            if marker:
                kwargs['Marker'] = marker
                
            response = emr.list_steps(**kwargs)
            steps = response.get('Steps', [])
            all_steps.extend(steps)
            
            marker = response.get('Marker')
            if not marker:
                break
        
        # Get detailed information for each step
        detailed_steps = []
        for step in all_steps:
            try:
                step_detail = emr.describe_step(
                    ClusterId=cluster_id,
                    StepId=step['Id']
                )['Step']
                detailed_steps.append({
                    'id': step_detail['Id'],
                    'name': step_detail['Name'],
                    'state': step_detail['Status']['State'],
                    'creationDateTime': step_detail['Status']['Timeline'].get('CreationDateTime', '').isoformat() if hasattr(step_detail['Status']['Timeline'].get('CreationDateTime', ''), 'isoformat') else '',
                    'startDateTime': step_detail['Status']['Timeline'].get('StartDateTime', '').isoformat() if hasattr(step_detail['Status']['Timeline'].get('StartDateTime', ''), 'isoformat') else '',
                    'endDateTime': step_detail['Status']['Timeline'].get('EndDateTime', '').isoformat() if hasattr(step_detail['Status']['Timeline'].get('EndDateTime', ''), 'isoformat') else '',
                    'actionOnFailure': step_detail.get('ActionOnFailure', ''),
                    'config': step_detail.get('Config', {})
                })
            except Exception as e:
                app.logger.error(f"Error getting step details for {step['Id']}: {str(e)}")
                detailed_steps.append({
                    'id': step['Id'],
                    'name': step['Name'],
                    'state': step['Status']['State'],
                    'error': 'Failed to get details'
                })
        
        # Apply pagination
        total_count = len(detailed_steps)
        skip = (page - 1) * limit
        paginated_steps = detailed_steps[skip:skip + limit]
        total_pages = (total_count + limit - 1) // limit
        
        return jsonify({
            'steps': paginated_steps,
            'pagination': {
                'page': page,
                'limit': limit,
                'total': total_count,
                'totalPages': total_pages,
                'hasNext': page < total_pages,
                'hasPrev': page > 1
            }
        })
        
    except Exception as e:
        app.logger.error(f"Error fetching steps for cluster {cluster_id}: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route(f'{URL_PREFIX}/clusters/<cluster_id>/steps/<step_id>', methods=['GET'])
def get_step_details(cluster_id, step_id):
    """Get detailed information for a specific step"""
    try:
        app.logger.debug(f"Fetching step details for step {step_id} in cluster {cluster_id}")
        
        response = emr.describe_step(
            ClusterId=cluster_id,
            StepId=step_id
        )
        
        step = response['Step']
        
        return jsonify({
            'step': {
                'id': step['Id'],
                'name': step['Name'],
                'state': step['Status']['State'],
                'stateChangeReason': step['Status'].get('StateChangeReason', {}),
                'failureDetails': step['Status'].get('FailureDetails', {}),
                'timeline': {
                    'creationDateTime': step['Status']['Timeline'].get('CreationDateTime', '').isoformat() if hasattr(step['Status']['Timeline'].get('CreationDateTime', ''), 'isoformat') else '',
                    'startDateTime': step['Status']['Timeline'].get('StartDateTime', '').isoformat() if hasattr(step['Status']['Timeline'].get('StartDateTime', ''), 'isoformat') else '',
                    'endDateTime': step['Status']['Timeline'].get('EndDateTime', '').isoformat() if hasattr(step['Status']['Timeline'].get('EndDateTime', ''), 'isoformat') else ''
                },
                'actionOnFailure': step.get('ActionOnFailure', ''),
                'config': step.get('Config', {})
            }
        })
        
    except Exception as e:
        app.logger.error(f"Error fetching step details: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route(f'{URL_PREFIX}/clusters/<cluster_id>/steps', methods=['POST'])
def add_step(cluster_id):
    """Add a new step to a cluster (duplicate an existing step)"""
    try:
        app.logger.debug(f"Adding step to cluster: {cluster_id}")
        
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400
            
        # Extract step configuration from request
        step_config = {
            'Name': data.get('name', 'Duplicated Step'),
            'ActionOnFailure': data.get('actionOnFailure', 'CONTINUE'),
            'HadoopJarStep': data.get('hadoopJarStep', {})
        }
        
        # Add the step to the cluster
        response = emr.add_job_flow_steps(
            JobFlowId=cluster_id,
            Steps=[step_config]
        )
        
        step_ids = response.get('StepIds', [])
        app.logger.debug(f"Successfully added step(s): {step_ids}")
        
        return jsonify({
            'stepIds': step_ids,
            'message': 'Step added successfully'
        })
        
    except Exception as e:
        app.logger.error(f"Error adding step: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route(f'{URL_PREFIX}/clusters/<cluster_id>/steps/<step_id>/cancel', methods=['POST'])
def cancel_step(cluster_id, step_id):
    """Cancel a running step"""
    try:
        app.logger.debug(f"Cancelling step {step_id} in cluster {cluster_id}")
        
        # First check if the step is in a cancellable state
        step_response = emr.describe_step(
            ClusterId=cluster_id,
            StepId=step_id
        )
        
        step_state = step_response['Step']['Status']['State']
        if step_state not in ['PENDING', 'RUNNING']:
            return jsonify({
                "error": f"Step is in {step_state} state and cannot be cancelled"
            }), 400
        
        # Cancel the step
        response = emr.cancel_steps(
            ClusterId=cluster_id,
            StepIds=[step_id]
        )
        
        cancel_steps_info = response.get('CancelStepsInfoList', [])
        
        return jsonify({
            'message': 'Step cancellation initiated',
            'cancelInfo': cancel_steps_info
        })
        
    except Exception as e:
        app.logger.error(f"Error cancelling step: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route(f'{URL_PREFIX}/clusters/<cluster_id>/steps/<step_id>/logs', methods=['GET'])
def get_step_logs(cluster_id, step_id):
    """Get logs for a specific step"""
    try:
        app.logger.debug(f"Fetching logs for step {step_id} in cluster {cluster_id}")
        
        # Get log type from query parameter
        log_type = request.args.get('type', 'step')  # 'step' or 'container'
        log_file = request.args.get('file', 'stderr')  # For step logs
        container_id = request.args.get('container')  # For container logs
        start_line = int(request.args.get('start', 0))
        num_lines = int(request.args.get('lines', 1000))
        
        if log_type == 'step':
            # Fetch step logs - S3 path includes cluster ID
            step_log_prefix = f"logs/{cluster_id}/steps/{step_id}"
            log_files = {
                'stderr': f"{step_log_prefix}/stderr.gz",
                'stdout': f"{step_log_prefix}/stdout.gz",
                'controller': f"{step_log_prefix}/controller.gz",
                'syslog': f"{step_log_prefix}/syslog.gz"
            }
            
            if log_file not in log_files:
                return jsonify({"error": "Invalid log file"}), 400
                
            s3_key = log_files[log_file]
            
            try:
                # Download and decompress the log file
                response = s3.get_object(Bucket=S3_LOG_BUCKET, Key=s3_key)
                compressed_content = response['Body'].read()
                
                # Decompress gzip content
                with gzip.GzipFile(fileobj=BytesIO(compressed_content)) as gz:
                    content = gz.read().decode('utf-8', errors='replace')
                
                # Split into lines for pagination
                lines = content.split('\n')
                total_lines = len(lines)
                
                # Get requested lines
                end_line = min(start_line + num_lines, total_lines)
                requested_lines = lines[start_line:end_line]
                
                # Parse application ID from stderr if this is stderr.gz
                application_id = None
                if log_file == 'stderr':
                    app_id_pattern = r'application_\d+_\d+'
                    matches = re.findall(app_id_pattern, content)
                    if matches:
                        application_id = matches[0]  # Get the first match
                        app.logger.debug(f"Found application ID: {application_id}")
                
                return jsonify({
                    'lines': requested_lines,
                    'totalLines': total_lines,
                    'startLine': start_line,
                    'endLine': end_line,
                    'hasMore': end_line < total_lines,
                    'applicationId': application_id,
                    'logType': 'step',
                    'logFile': log_file
                })
                
            except s3.exceptions.NoSuchKey:
                app.logger.warning(f"Log file not found: {s3_key}")
                return jsonify({
                    'lines': [f"Log file not found: {log_file}.gz"],
                    'totalLines': 1,
                    'error': 'Log file not found'
                }), 404
                
        elif log_type == 'container':
            # Fetch container logs
            if not container_id:
                return jsonify({"error": "Container ID required for container logs"}), 400
            
            # Get application ID from request params or derive from container ID
            application_id = request.args.get('applicationId')
            
            if not application_id:
                # Try to extract from container ID format: container_e02_1234567890_0001_01_000001
                # The application ID would be application_1234567890_0001
                container_match = re.match(r'container_[^_]+_(\d+)_(\d+)_\d+_\d+', container_id)
                if container_match:
                    application_id = f"application_{container_match.group(1)}_{container_match.group(2)}"
                else:
                    return jsonify({"error": "Could not determine application ID from container ID"}), 400
            container_log_prefix = f"logs/{cluster_id}/containers/{application_id}/{container_id}"
            
            log_files = {
                'stdout': f"{container_log_prefix}/stdout.gz",
                'stderr': f"{container_log_prefix}/stderr.gz"
            }
            
            log_file = request.args.get('file', 'stdout')
            if log_file not in log_files:
                return jsonify({"error": "Invalid log file for container"}), 400
                
            s3_key = log_files[log_file]
            
            try:
                # Download the log file
                response = s3.get_object(Bucket=S3_LOG_BUCKET, Key=s3_key)
                raw_content = response['Body'].read()
                
                # Check if it's gzipped (stderr.gz)
                if s3_key.endswith('.gz'):
                    with gzip.GzipFile(fileobj=BytesIO(raw_content)) as gz:
                        content = gz.read().decode('utf-8', errors='replace')
                else:
                    content = raw_content.decode('utf-8', errors='replace')
                
                # Split into lines for pagination
                lines = content.split('\n')
                total_lines = len(lines)
                
                # Get requested lines
                end_line = min(start_line + num_lines, total_lines)
                requested_lines = lines[start_line:end_line]
                
                return jsonify({
                    'lines': requested_lines,
                    'totalLines': total_lines,
                    'startLine': start_line,
                    'endLine': end_line,
                    'hasMore': end_line < total_lines,
                    'containerId': container_id,
                    'logType': 'container',
                    'logFile': log_file
                })
                
            except s3.exceptions.NoSuchKey:
                app.logger.warning(f"Container log file not found: {s3_key}")
                return jsonify({
                    'lines': [f"Container log file not found: {log_file}"],
                    'totalLines': 1,
                    'error': 'Log file not found'
                }), 404
        
        else:
            return jsonify({"error": "Invalid log type"}), 400
            
    except Exception as e:
        app.logger.error(f"Error fetching logs: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route(f'{URL_PREFIX}/clusters/<cluster_id>/steps/<step_id>/logs/containers', methods=['GET'])
def list_step_containers(cluster_id, step_id):
    """List all containers for a step based on its application ID"""
    try:
        app.logger.debug(f"Listing containers for step {step_id}")
        
        # First, get the application ID from stderr.gz
        step_log_key = f"logs/{cluster_id}/steps/{step_id}/stderr.gz"
        
        try:
            response = s3.get_object(Bucket=S3_LOG_BUCKET, Key=step_log_key)
            compressed_content = response['Body'].read()
            
            with gzip.GzipFile(fileobj=BytesIO(compressed_content)) as gz:
                content = gz.read().decode('utf-8', errors='replace')
            
            # Find application ID
            app_id_pattern = r'application_\d+_\d+'
            matches = re.findall(app_id_pattern, content)
            
            if not matches:
                return jsonify({
                    'containers': [],
                    'message': 'No application ID found in step logs'
                })
            
            application_id = matches[0]
            app.logger.debug(f"Found application ID: {application_id}")
            
            # List containers under this application
            prefix = f"logs/{cluster_id}/containers/{application_id}/"
            app.logger.debug(f"Looking for containers at S3 path: s3://{S3_LOG_BUCKET}/{prefix}")
            response = s3.list_objects_v2(
                Bucket=S3_LOG_BUCKET,
                Prefix=prefix,
                Delimiter='/'
            )
            app.logger.debug(f"S3 response for containers: {response}")
            
            containers = []
            if 'CommonPrefixes' in response:
                for prefix_info in response['CommonPrefixes']:
                    container_path = prefix_info['Prefix']
                    container_id = container_path.rstrip('/').split('/')[-1]
                    
                    # Determine if this is the driver container
                    is_driver = container_id.endswith('_000001')
                    
                    containers.append({
                        'id': container_id,
                        'label': 'Driver' if is_driver else f'Executor ({container_id.split("_")[-1]})',
                        'isDriver': is_driver
                    })
            
            # Sort containers so driver comes first
            containers.sort(key=lambda x: (not x['isDriver'], x['id']))
            
            return jsonify({
                'applicationId': application_id,
                'containers': containers
            })
            
        except s3.exceptions.NoSuchKey:
            return jsonify({
                'containers': [],
                'error': 'Step logs not found'
            }), 404
            
    except Exception as e:
        app.logger.error(f"Error listing containers: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route(f'{URL_PREFIX}/clusters/<cluster_id>/steps/<step_id>/logs/download', methods=['GET'])
def download_step_logs(cluster_id, step_id):
    """Download log file"""
    try:
        log_type = request.args.get('type', 'step')
        log_file = request.args.get('file', 'stderr')
        container_id = request.args.get('container')
        
        if log_type == 'step':
            s3_key = f"logs/{cluster_id}/steps/{step_id}/{log_file}.gz"
            filename = f"{step_id}_{log_file}.log"
            
            # Download and decompress
            response = s3.get_object(Bucket=S3_LOG_BUCKET, Key=s3_key)
            compressed_content = response['Body'].read()
            
            with gzip.GzipFile(fileobj=BytesIO(compressed_content)) as gz:
                content = gz.read()
                
        elif log_type == 'container':
            if not container_id:
                return jsonify({"error": "Container ID required"}), 400
                
            # Get application ID from request params or derive from container ID
            application_id = request.args.get('applicationId')
            
            if not application_id:
                # Try to extract from container ID format: container_e02_1234567890_0001_01_000001
                container_match = re.match(r'container_[^_]+_(\d+)_(\d+)_\d+_\d+', container_id)
                if container_match:
                    application_id = f"application_{container_match.group(1)}_{container_match.group(2)}"
                    app.logger.info(f"Derived application ID from container ID: {application_id}")
                else:
                    app.logger.error(f"Could not parse application ID from container ID: {container_id}")
                    return jsonify({"error": "Could not determine application ID"}), 400
            
            # Both stdout and stderr are gzipped
            s3_key = f"logs/{cluster_id}/containers/{application_id}/{container_id}/{log_file}.gz"
            filename = f"{container_id}_{log_file}.log"
            app.logger.info(f"Downloading container log: s3://{S3_LOG_BUCKET}/{s3_key}")
            
            # Download
            response = s3.get_object(Bucket=S3_LOG_BUCKET, Key=s3_key)
            raw_content = response['Body'].read()
            
            # Decompress if gzipped
            if s3_key.endswith('.gz'):
                with gzip.GzipFile(fileobj=BytesIO(raw_content)) as gz:
                    content = gz.read()
            else:
                content = raw_content
        
        else:
            return jsonify({"error": "Invalid log type"}), 400
        
        # Return as downloadable file
        return Response(
            content,
            mimetype='text/plain',
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"',
                'Content-Type': 'text/plain; charset=utf-8'
            }
        )
        
    except s3.exceptions.NoSuchKey:
        return jsonify({"error": "Log file not found"}), 404
    except Exception as e:
        app.logger.error(f"Error downloading logs: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route(f'{URL_PREFIX}/clusters/<cluster_id>/steps/<step_id>/analyze', methods=['POST'])
def analyze_step(cluster_id, step_id):
    """Analyze step execution using Azure OpenAI"""
    app.logger.info(f"Analyze endpoint called for cluster {cluster_id}, step {step_id}")
    app.logger.info(f"Request method: {request.method}")
    app.logger.info(f"Request path: {request.path}")
    app.logger.info(f"AZURE_OPENAI_ENABLED: {AZURE_OPENAI_ENABLED}")
    
    if not AZURE_OPENAI_ENABLED:
        return jsonify({"error": "Step analysis feature is not available"}), 503
    
    try:
        app.logger.info(f"Starting analysis for step {step_id} in cluster {cluster_id}")
        
        # Get step details first
        try:
            response = emr.describe_step(ClusterId=cluster_id, StepId=step_id)
            step = response['Step']
            step_state = step['Status']['State']
            step_name = step.get('Name', 'Unknown')
            app.logger.info(f"Step details retrieved - Name: {step_name}, State: {step_state}")
        except Exception as e:
            app.logger.error(f"Failed to get step details: {str(e)}")
            return jsonify({"error": f"Failed to get step details: {str(e)}"}), 500
        
        # Fetch stderr.gz for timeline
        stderr_content = ""
        timeline_info = ""
        try:
            stderr_key = f"logs/{cluster_id}/steps/{step_id}/stderr.gz"
            app.logger.debug(f"Fetching stderr from S3: s3://{S3_LOG_BUCKET}/{stderr_key}")
            response = s3.get_object(Bucket=S3_LOG_BUCKET, Key=stderr_key)
            compressed_content = response['Body'].read()
            app.logger.info(f"Retrieved stderr.gz, size: {len(compressed_content)} bytes")
            
            with gzip.GzipFile(fileobj=BytesIO(compressed_content)) as gz:
                stderr_content = gz.read().decode('utf-8', errors='replace')
                app.logger.info(f"Decompressed stderr content, length: {len(stderr_content)} characters")
            
            # Extract timeline from stderr (looking for state transitions)
            timeline_lines = []
            for line in stderr_content.split('\n'):
                if 'ACCEPTED' in line or 'RUNNING' in line or 'COMPLETED' in line or 'FAILED' in line:
                    timeline_lines.append(line.strip())
                    if len(timeline_lines) > 20:  # Limit timeline info
                        break
            timeline_info = '\n'.join(timeline_lines[-20:])  # Last 20 timeline entries
            
        except Exception as e:
            app.logger.warning(f"Could not fetch stderr for timeline: {str(e)}")
        
        # Fetch driver logs
        driver_log_content = ""
        try:
            # First, find the driver container
            if stderr_content:
                app_id_matches = re.findall(r'application_\d+_\d+', stderr_content)
                if app_id_matches:
                    application_id = app_id_matches[0]
                    app.logger.info(f"Found application ID: {application_id}")
                    
                    # List containers
                    prefix = f"logs/{cluster_id}/containers/{application_id}/"
                    response = s3.list_objects_v2(
                        Bucket=S3_LOG_BUCKET,
                        Prefix=prefix,
                        Delimiter='/'
                    )
                    
                    # Find driver container (ends with _000001)
                    driver_container = None
                    if 'CommonPrefixes' in response:
                        for prefix_info in response['CommonPrefixes']:
                            container_id = prefix_info['Prefix'].rstrip('/').split('/')[-1]
                            if container_id.endswith('_000001'):
                                driver_container = container_id
                                break
                    
                    if driver_container:
                        app.logger.info(f"Found driver container: {driver_container}")
                        # Fetch driver stdout
                        driver_key = f"logs/{cluster_id}/containers/{application_id}/{driver_container}/stdout.gz"
                        app.logger.debug(f"Fetching driver logs from: s3://{S3_LOG_BUCKET}/{driver_key}")
                        response = s3.get_object(Bucket=S3_LOG_BUCKET, Key=driver_key)
                        compressed_content = response['Body'].read()
                        app.logger.info(f"Retrieved driver stdout.gz, size: {len(compressed_content)} bytes")
                        
                        with gzip.GzipFile(fileobj=BytesIO(compressed_content)) as gz:
                            full_content = gz.read().decode('utf-8', errors='replace')
                        
                        # Extract relevant sections based on step state
                        if step_state == 'FAILED':
                            # For failures, get last 2000 lines focusing on errors
                            lines = full_content.split('\n')
                            error_lines = []
                            for i, line in enumerate(lines):
                                if 'ERROR' in line or 'Exception' in line or 'Error' in line:
                                    # Get context around error (5 lines before and after)
                                    start = max(0, i - 5)
                                    end = min(len(lines), i + 6)
                                    error_lines.extend(lines[start:end])
                                    error_lines.append("---")
                            
                            if error_lines:
                                driver_log_content = '\n'.join(error_lines[-1000:])  # Last 1000 lines of errors
                            else:
                                # No specific errors found, get last 1000 lines
                                driver_log_content = '\n'.join(lines[-1000:])
                        else:
                            # For successful runs, get summary info
                            lines = full_content.split('\n')
                            summary_lines = []
                            
                            # Look for execution metrics
                            for line in lines:
                                if any(keyword in line for keyword in [
                                    'Job finished:', 'Total time:', 'Records written:',
                                    'Shuffle', 'Stage', 'Task', 'Executor',
                                    'WARN', 'physical plan', 'logical plan'
                                ]):
                                    summary_lines.append(line.strip())
                                    if len(summary_lines) > 500:
                                        break
                            
                            driver_log_content = '\n'.join(summary_lines[:500])
                    else:
                        app.logger.warning("No driver container found")
                else:
                    app.logger.warning("No application ID found in stderr")
            else:
                app.logger.warning("stderr content is empty")
                            
        except Exception as e:
            app.logger.error(f"Error fetching driver logs: {str(e)}", exc_info=True)
        
        # Prepare prompt for Azure OpenAI
        if step_state == 'FAILED':
            prompt = f"""Analyze this failed EMR step. Be concise and direct.

Step: {step_name} ({step_id})
State: {step_state}

Timeline:
{timeline_info}

Error logs:
{driver_log_content}

Provide only:
1. Root cause (1-2 sentences)
2. Specific error message
3. Fix recommendation (1-2 bullets)

Limit response to 150 words. No verbose explanations."""
        else:
            prompt = f"""Analyze this EMR step execution. Be concise.

Step: {step_name} ({step_id})
State: {step_state}

Timeline:
{timeline_info}

Execution metrics:
{driver_log_content}

Provide only:
1. What ran (1 sentence)
2. Key metrics (records, time, data size)
3. Performance issues if any (1-2 bullets)

Limit response to 150 words."""

        # Call Azure OpenAI with retry logic
        app.logger.info(f"Calling Azure OpenAI for analysis with {len(prompt)} character prompt")
        app.logger.debug(f"Using model: {AZURE_OPENAI_DEPLOYMENT_NAME}")
        
        analysis = None
        max_retries = 3
        retry_delay = 1
        
        for attempt in range(max_retries):
            try:
                app.logger.info(f"Attempt {attempt + 1}/{max_retries} - Making Azure OpenAI API call")
                
                # Force a completely new token for this request
                refresh_azure_token()
                
                # Log current auth header after refresh
                current_auth_header = azure_openai_client.default_headers.get("Authorization", "No Auth Header")
                app.logger.info(f"Authorization header after refresh: {current_auth_header[:50]}...")
                
                # On retry attempts, recreate the client to ensure no stale connections
                if attempt > 0:
                    app.logger.warning(f"Recreating Azure OpenAI client for retry attempt {attempt + 1}")
                    global azure_openai_client
                    
                    # Get fresh token for new client
                    token_response = azure_openai_client._credential.get_token(
                        "https://cognitiveservices.azure.com/.default",
                        enable_cae=True
                    )
                    
                    # Create new client instance
                    azure_openai_client = AzureOpenAI(
                        azure_endpoint=AZURE_OPENAI_ENDPOINT,
                        api_key=AZURE_OPENAI_API_KEY,
                        api_version=AZURE_OPENAI_API_VERSION,
                        default_headers={
                            "Authorization": f"Bearer {token_response.token}",
                            "x-ms-useragent": AZURE_USER_ID
                        }
                    )
                    # Store credential for future refreshes
                    azure_openai_client._credential = azure_credential
                    app.logger.info("✓ New Azure OpenAI client created with fresh token")
                
                # Log the actual API call details
                app.logger.info("Making chat.completions.create call:")
                app.logger.info(f"  - Model: {AZURE_OPENAI_DEPLOYMENT_NAME}")
                app.logger.info(f"  - Temperature: 0.3")
                app.logger.info(f"  - Max tokens: 200")
                app.logger.info(f"  - Timeout: 30 seconds")
                app.logger.debug(f"  - Current headers: {list(azure_openai_client.default_headers.keys())}")
                
                completion = azure_openai_client.chat.completions.create(
                    model=AZURE_OPENAI_DEPLOYMENT_NAME,
                    messages=[
                        {"role": "system", "content": "You are a concise EMR/Spark troubleshooting expert. Give direct, actionable answers without fluff."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.3,
                    max_tokens=200,
                    timeout=30
                )
                
                analysis = completion.choices[0].message.content
                app.logger.info(f"✓ Azure OpenAI analysis completed successfully")
                app.logger.info(f"  - Response length: {len(analysis)} characters")
                app.logger.info(f"  - Model used: {completion.model}")
                app.logger.info(f"  - Tokens used: {completion.usage.total_tokens if completion.usage else 'N/A'}")
                break
                
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
                    return jsonify({"error": f"Failed to get AI analysis after {max_retries} attempts: {str(e)}"}), 500
        
        return jsonify({
            'stepId': step_id,
            'stepName': step_name,
            'stepState': step_state,
            'analysis': analysis,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        app.logger.error(f"Error analyzing step: {str(e)}", exc_info=True)
        return jsonify({"error": f"Failed to analyze step: {str(e)}"}), 500

@app.route(f'{URL_PREFIX}/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'emr-backend',
        'timestamp': datetime.now().isoformat()
    })

@app.route(f'{URL_PREFIX}/test-azure-openai', methods=['GET'])
def test_azure_openai():
    """Test endpoint to verify Azure OpenAI connection"""
    if not AZURE_OPENAI_ENABLED:
        return jsonify({
            'status': 'disabled',
            'message': 'Azure OpenAI is not enabled. Check logs for configuration issues.'
        }), 503
    
    try:
        app.logger.info("Testing Azure OpenAI connection...")
        
        # Refresh token
        refresh_azure_token()
        
        # Make a simple test call
        app.logger.info("Making test API call to Azure OpenAI...")
        completion = azure_openai_client.chat.completions.create(
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

@app.route(f'{URL_PREFIX}/debug/routes', methods=['GET'])
def debug_routes():
    """Debug endpoint to list all registered routes"""
    routes = []
    for rule in app.url_map.iter_rules():
        routes.append({
            'endpoint': rule.endpoint,
            'methods': list(rule.methods),
            'path': str(rule)
        })
    return jsonify({
        'url_prefix': URL_PREFIX,
        'routes': sorted(routes, key=lambda x: x['path'])
    })

@app.route('/health', methods=['GET'])
def health_check_root():
    """Health check endpoint at root for ECS/ALB health checks"""
    return jsonify({
        'status': 'healthy',
        'service': 'emr-backend',
        'timestamp': datetime.now().isoformat()
    })

# Helper functions
def get_cluster_configs(environment='uat1'):
    """Fetches all EMR cluster configurations from Parameter Store for a specific environment"""
    param_store_path = PARAM_STORE_PATHS.get(environment, PARAM_STORE_PATHS['uat1'])
    app.logger.debug(f"Fetching cluster configs from Parameter Store at path: {param_store_path}")
    
    params = []
    next_token = None

    try:
        while True:
            kwargs = {
                'Path': param_store_path,
                'Recursive': True,
                'WithDecryption': True
            }
            if next_token:
                kwargs['NextToken'] = next_token

            app.logger.debug(f"Calling get_parameters_by_path with: {kwargs}")
            response = ssm.get_parameters_by_path(**kwargs)
            
            parameters = response.get('Parameters', [])
            app.logger.debug(f"Received {len(parameters)} parameters")
            
            # Log each parameter name
            for param in parameters:
                app.logger.debug(f"Parameter found: {param['Name']}")
                
            params.extend(parameters)

            next_token = response.get('NextToken')
            if not next_token:
                break

        # Process parameters into cluster configs
        cluster_configs = []
        for param in params:
            cluster_name = param['Name'].replace(param_store_path, "")
            # Filter out clusters with "STRESS" in their name
            if "STRESS" not in cluster_name:
                try:
                    config = json.loads(param['Value'])
                    app.logger.debug(f"Successfully parsed JSON for: {cluster_name}")
                except json.JSONDecodeError:
                    app.logger.warning(f"Could not parse parameter value as JSON for: {cluster_name}")
                    config = {"rawValue": param['Value']}

                # Convert datetime objects to ISO format strings for JSON serialization
                last_modified = param.get('LastModifiedDate')
                if hasattr(last_modified, 'isoformat'):
                    last_modified = last_modified.isoformat()

                cluster_configs.append({
                    "name": cluster_name,
                    "config": config,
                    "parameterName": param['Name'],
                    "lastModified": last_modified
                })
                app.logger.debug(f"Added cluster config: {cluster_name}")

        app.logger.debug(f"Processed {len(cluster_configs)} cluster configurations")
        return cluster_configs
    except Exception as e:
        app.logger.error(f"Error fetching cluster configs: {str(e)}", exc_info=True)
        return []

def list_emr_clusters():
    """Fetches the current state of all EMR clusters"""
    app.logger.debug("Fetching EMR clusters")
    states = ["STARTING", "BOOTSTRAPPING", "RUNNING", "WAITING", "TERMINATING", "TERMINATED", "TERMINATED_WITH_ERRORS"]
    try:
        response = emr.list_clusters(ClusterStates=states)
        clusters = response.get('Clusters', [])
        app.logger.debug(f"Found {len(clusters)} EMR clusters")
        
        # Log each cluster name
        for cluster in clusters:
            app.logger.debug(f"EMR Cluster: {cluster['Name']} - State: {cluster['Status']['State']}")
            
        return clusters
    except Exception as e:
        app.logger.error(f"Error listing EMR clusters: {str(e)}", exc_info=True)
        return []

def get_step_count(cluster_id):
    """Get the total number of steps for a cluster"""
    try:
        # Only get the first page with limit=1 to get the total count
        response = emr.list_steps(ClusterId=cluster_id, MaxResults=1)
        
        # AWS doesn't provide a direct total count, so we need to iterate
        total_count = 0
        marker = None
        
        while True:
            kwargs = {'ClusterId': cluster_id}
            if marker:
                kwargs['Marker'] = marker
            
            response = emr.list_steps(**kwargs)
            steps = response.get('Steps', [])
            total_count += len(steps)
            
            marker = response.get('Marker')
            if not marker:
                break
        
        return total_count
    except Exception as e:
        app.logger.error(f"Error getting step count for cluster {cluster_id}: {str(e)}")
        return 0


def map_cluster_states(cluster_configs, emr_clusters):
    """Maps cluster name to its state by finding the corresponding clusterID"""
    app.logger.debug("Mapping cluster states")
    result = []
    for config in cluster_configs:
        app.logger.debug(f"Processing config for: {config['name']}")
        
        # Find matching EMR cluster by name
        matching_cluster = next(
            (cluster for cluster in emr_clusters if 
             cluster['Name'] == config['name'] or config['name'] in cluster['Name']),
            None
        )

        if matching_cluster:
            app.logger.debug(f"Found matching EMR cluster: {matching_cluster['Name']} - ID: {matching_cluster['Id']}")
        else:
            app.logger.debug(f"No matching EMR cluster found for: {config['name']}")

        # Get step count if we have a cluster ID
        step_count = 0
        if matching_cluster and matching_cluster.get('Id'):
            step_count = get_step_count(matching_cluster['Id'])
            app.logger.debug(f"Cluster {config['name']} has {step_count} steps")

        # For serialization, ensure all datetime objects are converted to strings
        timeline = None
        if matching_cluster and 'Status' in matching_cluster and 'Timeline' in matching_cluster['Status']:
            timeline = {}
            for key, value in matching_cluster['Status']['Timeline'].items():
                if hasattr(value, 'isoformat'):
                    timeline[key] = value.isoformat()
                else:
                    timeline[key] = value

        merged_info = {
            **config,
            "state": matching_cluster['Status']['State'] if matching_cluster else "TERMINATED",
            "clusterId": matching_cluster['Id'] if matching_cluster else None,
            "lastStateChangeReason": matching_cluster.get('Status', {}).get('StateChangeReason') if matching_cluster else None,
            "timeline": timeline,
            "applications": matching_cluster.get('Applications', []) if matching_cluster else [],
            "tags": matching_cluster.get('Tags', []) if matching_cluster else [],
            "stepCount": step_count
        }
        result.append(merged_info)
        app.logger.debug(f"Completed mapping for cluster: {config['name']}")

    return result


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3700))
    app.logger.info(f"Starting EMR Backend server on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)

