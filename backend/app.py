# app.py
from flask import Flask, jsonify, request
from flask_cors import CORS
import boto3
import json
import os
from datetime import datetime

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configure AWS services
# This will use the credentials from ~/.aws/credentials
ssm = boto3.client('ssm')
emr = boto3.client('emr')
lambda_client = boto3.client('lambda')

# Constants
PARAM_STORE_PATH = "/application/ecdp-config/UAT/EMR-BASE/"
LAMBDA_FUNCTION_NAME = "app-job-submit"

@app.route('/clusters', methods=['GET'])
def get_clusters():
    """Fetch all clusters from Parameter Store and their current states"""
    try:
        # Get cluster configurations from Parameter Store
        cluster_configs = get_cluster_configs()

        # Get current EMR cluster states
        emr_clusters = list_emr_clusters()

        # Merge the data
        merged_clusters = map_cluster_states(cluster_configs, emr_clusters)

        return jsonify(merged_clusters)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/clusters/<name>', methods=['GET'])
def get_cluster(name):
    """Get details for a specific cluster"""
    try:
        # Get all clusters
        cluster_configs = get_cluster_configs()
        emr_clusters = list_emr_clusters()
        merged_clusters = map_cluster_states(cluster_configs, emr_clusters)

        # Find the specific cluster
        cluster = next((c for c in merged_clusters if c['name'] == name), None)
        if not cluster:
            return jsonify({"error": f"Cluster {name} not found"}), 404

        return jsonify(cluster)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/clusters/<name>/start', methods=['POST'])
def start_cluster(name):
    """Start a specific EMR cluster"""
    try:
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

        response = lambda_client.invoke(
            FunctionName=LAMBDA_FUNCTION_NAME,
            Payload=json.dumps(payload)
        )

        # Parse the Lambda response
        response_payload = json.loads(response['Payload'].read().decode())
        return jsonify(response_payload)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/clusters/<name>/terminate', methods=['POST'])
def terminate_cluster(name):
    """Terminate a specific EMR cluster"""
    try:
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

        response = lambda_client.invoke(
            FunctionName=LAMBDA_FUNCTION_NAME,
            Payload=json.dumps(payload)
        )

        # Parse the Lambda response
        response_payload = json.loads(response['Payload'].read().decode())
        return jsonify(response_payload)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Helper functions
def get_cluster_configs():
    """Fetches all EMR cluster configurations from Parameter Store"""
    params = []
    next_token = None

    while True:
        kwargs = {
            'Path': PARAM_STORE_PATH,
            'Recursive': True,
            'WithDecryption': True
        }
        if next_token:
            kwargs['NextToken'] = next_token

        response = ssm.get_parameters_by_path(**kwargs)
        params.extend(response.get('Parameters', []))

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
            except json.JSONDecodeError:
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

    return cluster_configs

def list_emr_clusters():
    """Fetches the current state of all EMR clusters"""
    states = ["STARTING", "BOOTSTRAPPING", "RUNNING", "WAITING", "TERMINATING", "TERMINATED", "TERMINATED_WITH_ERRORS"]
    response = emr.list_clusters(ClusterStates=states)
    return response.get('Clusters', [])

def map_cluster_states(cluster_configs, emr_clusters):
    """Maps cluster name to its state by finding the corresponding clusterID"""
    result = []
    for config in cluster_configs:
        # Find matching EMR cluster by name
        matching_cluster = next(
            (cluster for cluster in emr_clusters if 
             cluster['Name'] == config['name'] or config['name'] in cluster['Name']),
            None
        )

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

    return result

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
