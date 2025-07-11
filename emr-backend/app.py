# app.py
from flask import Flask, jsonify, request
from flask_cors import CORS
import boto3
import json
import os
import logging
from logging.handlers import RotatingFileHandler
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging to file
log_dir = 'logs'
if not os.path.exists(log_dir):
    os.makedirs(log_dir)

log_file = os.path.join(log_dir, 'app.log')

# Create a handler for rotating log files (10 MB max, keep 5 backup files)
handler = RotatingFileHandler(log_file, maxBytes=10*1024*1024, backupCount=5)
handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))

# Configure the logger
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)
logger.addHandler(handler)

# Remove default handlers to prevent console output
logger.propagate = False

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configure URL prefix for ALB routing
# If URL_PREFIX env var is not set, default to '/api'
# If it's set to empty string (for local dev), use empty string
URL_PREFIX = os.getenv('URL_PREFIX')
if URL_PREFIX is None:
    URL_PREFIX = '/api'

# Configure AWS services
# This will use the credentials from ~/.aws/credentials
session = boto3.Session(profile_name='adfsjit')
ssm = session.client('ssm')
emr = session.client('emr')
lambda_client = session.client('lambda')

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

@app.route(f'{URL_PREFIX}/clusters', methods=['GET'])
def get_clusters():
    """Fetch all clusters from Parameter Store and their current states with pagination"""
    try:
        logger.debug("Fetching clusters data")
        
        # Get pagination parameters
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 20))
        environment = request.args.get('environment', 'all')
        
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
        
        logger.debug(f"Retrieved {len(cluster_configs)} cluster configs")
        
        # Get current EMR cluster states
        emr_clusters = list_emr_clusters()
        logger.debug(f"Retrieved {len(emr_clusters)} EMR clusters")
        
        # Merge the data
        merged_clusters = map_cluster_states(cluster_configs, emr_clusters)
        logger.debug(f"Merged data for {len(merged_clusters)} clusters")
        
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
        logger.error(f"Error in get_clusters: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route(f'{URL_PREFIX}/clusters/<n>', methods=['GET'])
def get_cluster(name):
    """Get details for a specific cluster"""
    try:
        logger.debug(f"Fetching details for cluster: {name}")
            
        # Get cluster configurations
        cluster_configs = get_cluster_configs()
        emr_clusters = list_emr_clusters()
        merged_clusters = map_cluster_states(cluster_configs, emr_clusters)

        # Find the specific cluster
        cluster = next((c for c in merged_clusters if c['name'] == name), None)
        if not cluster:
            logger.warning(f"Cluster not found: {name}")
            return jsonify({"error": f"Cluster {name} not found"}), 404

        logger.debug(f"Successfully fetched details for cluster: {name}")
        return jsonify(cluster)
    except Exception as e:
        logger.error(f"Error in get_cluster: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route(f'{URL_PREFIX}/clusters/<n>/start', methods=['POST'])
def start_cluster(name):
    """Start a specific EMR cluster"""
    try:
        logger.debug(f"Request to start cluster: {name}")
        
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

        logger.debug(f"Invoking Lambda {lambda_function_name} to start cluster: {name}")
        response = lambda_client.invoke(
            FunctionName=lambda_function_name,
            Payload=json.dumps(payload)
        )

        # Parse the Lambda response
        response_payload = json.loads(response['Payload'].read().decode())
        logger.debug(f"Lambda response for starting cluster {name}: {response_payload}")
        return jsonify(response_payload)
    except Exception as e:
        logger.error(f"Error starting cluster {name}: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route(f'{URL_PREFIX}/clusters/<n>/terminate', methods=['POST'])
def terminate_cluster(name):
    """Terminate a specific EMR cluster"""
    try:
        logger.debug(f"Request to terminate cluster: {name}")
        
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

        logger.debug(f"Invoking Lambda {lambda_function_name} to terminate cluster: {name}")
        response = lambda_client.invoke(
            FunctionName=lambda_function_name,
            Payload=json.dumps(payload)
        )

        # Parse the Lambda response
        response_payload = json.loads(response['Payload'].read().decode())
        logger.debug(f"Lambda response for terminating cluster {name}: {response_payload}")
        return jsonify(response_payload)
    except Exception as e:
        logger.error(f"Error terminating cluster {name}: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route(f'{URL_PREFIX}/clusters/<cluster_id>/steps', methods=['GET'])
def get_cluster_steps(cluster_id):
    """Get all steps for a specific cluster with pagination"""
    try:
        logger.debug(f"Fetching steps for cluster: {cluster_id}")
        
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
                logger.error(f"Error getting step details for {step['Id']}: {str(e)}")
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
        logger.error(f"Error fetching steps for cluster {cluster_id}: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route(f'{URL_PREFIX}/clusters/<cluster_id>/steps/<step_id>', methods=['GET'])
def get_step_details(cluster_id, step_id):
    """Get detailed information for a specific step"""
    try:
        logger.debug(f"Fetching step details for step {step_id} in cluster {cluster_id}")
        
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
        logger.error(f"Error fetching step details: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route(f'{URL_PREFIX}/clusters/<cluster_id>/steps', methods=['POST'])
def add_step(cluster_id):
    """Add a new step to a cluster (duplicate an existing step)"""
    try:
        logger.debug(f"Adding step to cluster: {cluster_id}")
        
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
        logger.debug(f"Successfully added step(s): {step_ids}")
        
        return jsonify({
            'stepIds': step_ids,
            'message': 'Step added successfully'
        })
        
    except Exception as e:
        logger.error(f"Error adding step: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route(f'{URL_PREFIX}/clusters/<cluster_id>/steps/<step_id>/cancel', methods=['POST'])
def cancel_step(cluster_id, step_id):
    """Cancel a running step"""
    try:
        logger.debug(f"Cancelling step {step_id} in cluster {cluster_id}")
        
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
        logger.error(f"Error cancelling step: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route(f'{URL_PREFIX}/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'emr-backend',
        'timestamp': datetime.now().isoformat()
    })

# Helper functions
def get_cluster_configs(environment='uat1'):
    """Fetches all EMR cluster configurations from Parameter Store for a specific environment"""
    param_store_path = PARAM_STORE_PATHS.get(environment, PARAM_STORE_PATHS['uat1'])
    logger.debug(f"Fetching cluster configs from Parameter Store at path: {param_store_path}")
    
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

            logger.debug(f"Calling get_parameters_by_path with: {kwargs}")
            response = ssm.get_parameters_by_path(**kwargs)
            
            parameters = response.get('Parameters', [])
            logger.debug(f"Received {len(parameters)} parameters")
            
            # Log each parameter name
            for param in parameters:
                logger.debug(f"Parameter found: {param['Name']}")
                
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
                    logger.debug(f"Successfully parsed JSON for: {cluster_name}")
                except json.JSONDecodeError:
                    logger.warning(f"Could not parse parameter value as JSON for: {cluster_name}")
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
                logger.debug(f"Added cluster config: {cluster_name}")

        logger.debug(f"Processed {len(cluster_configs)} cluster configurations")
        return cluster_configs
    except Exception as e:
        logger.error(f"Error fetching cluster configs: {str(e)}", exc_info=True)
        return []

def list_emr_clusters():
    """Fetches the current state of all EMR clusters"""
    logger.debug("Fetching EMR clusters")
    states = ["STARTING", "BOOTSTRAPPING", "RUNNING", "WAITING", "TERMINATING", "TERMINATED", "TERMINATED_WITH_ERRORS"]
    try:
        response = emr.list_clusters(ClusterStates=states)
        clusters = response.get('Clusters', [])
        logger.debug(f"Found {len(clusters)} EMR clusters")
        
        # Log each cluster name
        for cluster in clusters:
            logger.debug(f"EMR Cluster: {cluster['Name']} - State: {cluster['Status']['State']}")
            
        return clusters
    except Exception as e:
        logger.error(f"Error listing EMR clusters: {str(e)}", exc_info=True)
        return []

def map_cluster_states(cluster_configs, emr_clusters):
    """Maps cluster name to its state by finding the corresponding clusterID"""
    logger.debug("Mapping cluster states")
    result = []
    for config in cluster_configs:
        logger.debug(f"Processing config for: {config['name']}")
        
        # Find matching EMR cluster by name
        matching_cluster = next(
            (cluster for cluster in emr_clusters if 
             cluster['Name'] == config['name'] or config['name'] in cluster['Name']),
            None
        )

        if matching_cluster:
            logger.debug(f"Found matching EMR cluster: {matching_cluster['Name']} - ID: {matching_cluster['Id']}")
        else:
            logger.debug(f"No matching EMR cluster found for: {config['name']}")

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
            "tags": matching_cluster.get('Tags', []) if matching_cluster else []
        }
        result.append(merged_info)
        logger.debug(f"Completed mapping for cluster: {config['name']}")

    return result

# Configure Flask logging to file too
if not app.debug:
    file_handler = RotatingFileHandler(log_file, maxBytes=10*1024*1024, backupCount=5)
    file_handler.setFormatter(logging.Formatter(
        '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
    ))
    file_handler.setLevel(logging.INFO)
    app.logger.addHandler(file_handler)
    app.logger.setLevel(logging.INFO)
    app.logger.info('EMR Cluster Manager startup')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3700))
    print(f"Starting server on port {port}. Logs will be written to {log_file}")
    app.run(host='0.0.0.0', port=port, debug=True)

