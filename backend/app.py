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

# Constants - UPDATED FOR SPECIFIC CLUSTER
PARAM_STORE_PATH = "/application/ecdp-config/uat1/EMR-BASE/"
TARGET_CLUSTER = "ECDP-CLUSTER"
LAMBDA_FUNCTION_NAME = "app-job-submit"

@app.route('/clusters', methods=['GET'])
def get_clusters():
    """Fetch only the specific cluster from Parameter Store and its current state"""
    try:
        logger.debug("Fetching clusters data")
        
        # Get cluster configuration from Parameter Store (restricted to specific cluster)
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
        
        # Only allow the target cluster
        if name != TARGET_CLUSTER:
            logger.warning(f"Request for unauthorized cluster: {name}")
            return jsonify({"error": f"Cluster {name} not found or access denied"}), 404
            
        # Get cluster configuration
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
        
        # Only allow the target cluster
        if name != TARGET_CLUSTER:
            logger.warning(f"Request to start unauthorized cluster: {name}")
            return jsonify({"error": f"Cluster {name} not found or access denied"}), 404
            
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
        
        # Only allow the target cluster
        if name != TARGET_CLUSTER:
            logger.warning(f"Request to terminate unauthorized cluster: {name}")
            return jsonify({"error": f"Cluster {name} not found or access denied"}), 404
            
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
    """Fetches the specific EMR cluster configuration from Parameter Store"""
    logger.debug(f"Fetching cluster config from Parameter Store at path: {PARAM_STORE_PATH}")
    
    try:
        # Get the specific parameter for our target cluster
        param_name = f"{PARAM_STORE_PATH}{TARGET_CLUSTER}"
        logger.debug(f"Looking for parameter: {param_name}")
        
        response = ssm.get_parameter(
            Name=param_name,
            WithDecryption=True
        )
        
        logger.debug(f"Parameter found: {param_name}")
        param = response['Parameter']
        
        # Process the parameter into cluster config
        try:
            config = json.loads(param['Value'])
            logger.debug("Successfully parsed JSON configuration")
        except json.JSONDecodeError:
            logger.warning("Could not parse parameter value as JSON")
            config = {"rawValue": param['Value']}

        # Convert datetime objects to ISO format strings for JSON serialization
        last_modified = param.get('LastModifiedDate')
        if hasattr(last_modified, 'isoformat'):
            last_modified = last_modified.isoformat()

        cluster_config = {
            "name": TARGET_CLUSTER,
            "config": config,
            "parameterName": param['Name'],
            "lastModified": last_modified
        }
        
        logger.debug(f"Processed cluster configuration: {TARGET_CLUSTER}")
        return [cluster_config]
        
    except ssm.exceptions.ParameterNotFound:
        logger.error(f"Parameter not found: {PARAM_STORE_PATH}{TARGET_CLUSTER}")
        return []
    except Exception as e:
        logger.error(f"Error fetching cluster configs: {str(e)}", exc_info=True)
        return []

def list_emr_clusters():
    """Fetches the current state of EMR clusters"""
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
