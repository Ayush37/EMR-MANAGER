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

# Azure OpenAI Configuration - Service Principal Authentication
AZURE_OPENAI_ENDPOINT = os.getenv('AZURE_OPENAI_ENDPOINT', '')
AZURE_OPENAI_API_VERSION = os.getenv('AZURE_OPENAI_API_VERSION', '2024-02-15-preview')
AZURE_OPENAI_DEPLOYMENT_NAME = os.getenv('AZURE_OPENAI_DEPLOYMENT_NAME', '')
AZURE_TENANT_ID = os.getenv('AZURE_TENANT_ID', '')
AZURE_SPN_CLIENT_ID = os.getenv('AZURE_SPN_CLIENT_ID', '')
AZURE_PEM_PATH = '/app/azure_cert.pem'

# Initialize Azure OpenAI client if credentials are available
azure_openai_client = None
AZURE_OPENAI_ENABLED = False

if all([AZURE_OPENAI_ENDPOINT, AZURE_TENANT_ID, AZURE_SPN_CLIENT_ID, AZURE_OPENAI_DEPLOYMENT_NAME]):
    if os.path.exists(AZURE_PEM_PATH):
        try:
            # Create credential using Service Principal with certificate
            app.logger.info(f"Initializing Azure OpenAI with endpoint: {AZURE_OPENAI_ENDPOINT}")
            app.logger.info(f"Using deployment: {AZURE_OPENAI_DEPLOYMENT_NAME}")
            app.logger.info(f"API version: {AZURE_OPENAI_API_VERSION}")
            app.logger.info(f"Tenant ID: {AZURE_TENANT_ID[:8]}...") # Log partial for security
            app.logger.info(f"Client ID: {AZURE_SPN_CLIENT_ID[:8]}...") # Log partial for security
            
            credential = CertificateCredential(
                tenant_id=AZURE_TENANT_ID,
                client_id=AZURE_SPN_CLIENT_ID,
                certificate_path=AZURE_PEM_PATH
            )
            
            # Initialize Azure OpenAI client
            azure_openai_client = AzureOpenAI(
                azure_endpoint=AZURE_OPENAI_ENDPOINT,
                api_version=AZURE_OPENAI_API_VERSION,
                azure_ad_token_provider=credential.get_token
            )
            
            AZURE_OPENAI_ENABLED = True
            app.logger.info("Azure OpenAI integration enabled successfully with Service Principal authentication")
        except Exception as e:
            app.logger.error(f"Failed to initialize Azure OpenAI client: {str(e)}")
    else:
        app.logger.warning(f"Azure PEM certificate not found at {AZURE_PEM_PATH}")
else:
    app.logger.warning("Azure OpenAI credentials incomplete - step analysis feature disabled")

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
                else:
                    return jsonify({"error": "Could not determine application ID"}), 400
            # Both stdout and stderr are gzipped
            s3_key = f"logs/{cluster_id}/containers/{application_id}/{container_id}/{log_file}.gz"
            filename = f"{container_id}_{log_file}.log"
            
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
        prompt = f"""Analyze this EMR step execution and provide a concise summary:

Step Name: {step_name}
Step State: {step_state}
Step ID: {step_id}

Timeline from stderr (state transitions):
{timeline_info}

Driver Execution Log:
{driver_log_content}

Please provide:
1. Execution Summary (2-3 sentences explaining what happened)
2. For failures: Root cause analysis and specific error
3. For success: Key metrics and performance insights
4. Wait time analysis (time spent in ACCEPTED state before RUNNING)
5. Any warnings or optimization suggestions observed

Keep the response under 300 words and focus on actionable insights."""

        # Call Azure OpenAI
        app.logger.info(f"Calling Azure OpenAI for analysis with {len(prompt)} character prompt")
        app.logger.debug(f"Using model: {AZURE_OPENAI_DEPLOYMENT_NAME}")
        
        try:
            completion = azure_openai_client.chat.completions.create(
                model=AZURE_OPENAI_DEPLOYMENT_NAME,
                messages=[
                    {"role": "system", "content": "You are an expert in analyzing EMR/Spark job execution logs."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=500,
                timeout=30
            )
            
            analysis = completion.choices[0].message.content
            app.logger.info(f"Azure OpenAI analysis completed, response length: {len(analysis)} characters")
            
        except Exception as e:
            app.logger.error(f"Azure OpenAI API error: {str(e)}", exc_info=True)
            return jsonify({"error": f"Failed to get AI analysis: {str(e)}"}), 500
        
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

