# app.py
from flask import Flask, jsonify, request
from flask_cors import CORS
import boto3
import json
import os
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.DEBUG, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configure AWS services
# This will use the credentials from ~/.aws/credentials
session = boto3.Session(profile_name='adfsjit')
ssm = session.client('ssm')
emr = session.client('emr')
lambda_client = session.client('lambda')

# Constants
PARAM_STORE_PATH = "/application/ecdp-config/uat1/EMR-BASE/"
LAMBDA_FUNCTION_NAME = "app-job-submit"

@app.route('/clusters', methods=['GET'])
def get_clusters():
    """Fetch all clusters from Parameter Store and their current states"""
    try:
        logger.debug("Fetching clusters data")
        
        # Get cluster configurations from Parameter Store
        cluster_configs = get_cluster_configs()
        logger.debug(f"Retrieved {len(cluster_configs)} cluster configs")
        
        # Get current EMR cluster states
        emr_clusters = list_emr_clusters()
        logger.debug(f"Retrieved {len(emr_clusters)} EMR clusters")
        
        # Merge the data
        merged_clusters = map_cluster_states(cluster_configs, emr_clusters)
        logger.debug(f"Merged data for {len(merged_clusters)} clusters")

        return jsonify(merged_clusters)
    except Exception as e:
        logger.error(f"Error in get_clusters: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route('/clusters/<name>', methods=['GET'])
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

@app.route('/clusters/<name>/start', methods=['POST'])
def start_cluster(name):
    """Start a specific EMR cluster"""
    try:
        logger.debug(f"Request to start cluster: {name}")
            
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

        logger.debug(f"Invoking Lambda to start cluster: {name}")
        response = lambda_client.invoke(
            FunctionName=LAMBDA_FUNCTION_NAME,
            Payload=json.dumps(payload)
        )

        # Parse the Lambda response
        response_payload = json.loads(response['Payload'].read().decode())
        logger.debug(f"Lambda response for starting cluster {name}: {response_payload}")
        return jsonify(response_payload)
    except Exception as e:
        logger.error(f"Error starting cluster {name}: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route('/clusters/<name>/terminate', methods=['POST'])
def terminate_cluster(name):
    """Terminate a specific EMR cluster"""
    try:
        logger.debug(f"Request to terminate cluster: {name}")
            
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

        logger.debug(f"Invoking Lambda to terminate cluster: {name}")
        response = lambda_client.invoke(
            FunctionName=LAMBDA_FUNCTION_NAME,
            Payload=json.dumps(payload)
        )

        # Parse the Lambda response
        response_payload = json.loads(response['Payload'].read().decode())
        logger.debug(f"Lambda response for terminating cluster {name}: {response_payload}")
        return jsonify(response_payload)
    except Exception as e:
        logger.error(f"Error terminating cluster {name}: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

# Helper functions
def get_cluster_configs():
    """Fetches all EMR cluster configurations from Parameter Store"""
    logger.debug(f"Fetching cluster configs from Parameter Store at path: {PARAM_STORE_PATH}")
    
    params = []
    next_token = None

    try:
        while True:
            kwargs = {
                'Path': PARAM_STORE_PATH,
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
            cluster_name = param['Name'].replace(PARAM_STORE_PATH, "")
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

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    logger.info(f"Starting server on port {port}")
    app.run(host='0.0.0.0', port=port, debug=True)
