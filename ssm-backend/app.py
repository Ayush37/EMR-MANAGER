#!/usr/bin/env python3
import os
import json
import logging
from datetime import datetime
from logging.handlers import RotatingFileHandler
from flask import Flask, jsonify, request
from flask_cors import CORS
import boto3
from botocore.exceptions import ClientError, BotoCoreError
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configure logging
log_dir = 'logs'
os.makedirs(log_dir, exist_ok=True)

log_file = os.path.join(log_dir, 'ssm-backend.log')
handler = RotatingFileHandler(log_file, maxBytes=10485760, backupCount=5)
handler.setFormatter(logging.Formatter(
    '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
))

app.logger.addHandler(handler)
app.logger.setLevel(logging.INFO)
app.logger.info('SSM Backend service started')

# AWS Configuration
AWS_PROFILE = os.getenv('AWS_PROFILE', 'adfsjit')
AWS_REGION = os.getenv('AWS_REGION', 'us-east-1')
PARAMETER_PREFIX = '/application'

# Initialize AWS clients
try:
    session = boto3.Session(profile_name=AWS_PROFILE, region_name=AWS_REGION)
    ssm_client = session.client('ssm')
    app.logger.info(f'AWS session initialized with profile: {AWS_PROFILE}')
except Exception as e:
    app.logger.error(f'Failed to initialize AWS session: {str(e)}')
    ssm_client = None

def validate_json(value):
    """Validate if a string is valid JSON"""
    try:
        json.loads(value)
        return True, None
    except json.JSONDecodeError as e:
        return False, str(e)

def format_parameter(param):
    """Format parameter for response"""
    return {
        'name': param.get('Name', ''),
        'value': param.get('Value', ''),
        'version': param.get('Version', 0),
        'lastModified': param.get('LastModifiedDate', datetime.now()).isoformat() if isinstance(param.get('LastModifiedDate'), datetime) else param.get('LastModifiedDate', ''),
        'lastModifiedBy': param.get('LastModifiedUser', 'Unknown'),
        'description': param.get('Description', ''),
        'type': param.get('Type', 'String')
    }

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'ssm-backend',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/parameters', methods=['GET'])
def list_parameters():
    """List all parameters under /application prefix"""
    try:
        if not ssm_client:
            return jsonify({'error': 'AWS client not initialized'}), 500
        
        all_parameters = []
        next_token = None
        
        while True:
            params = {
                'Path': PARAMETER_PREFIX,
                'Recursive': True,
                'MaxResults': 50
            }
            
            if next_token:
                params['NextToken'] = next_token
            
            try:
                response = ssm_client.describe_parameters(**params)
                
                for param in response.get('Parameters', []):
                    # Get parameter value
                    try:
                        value_response = ssm_client.get_parameter(Name=param['Name'])
                        param['Value'] = value_response['Parameter']['Value']
                    except ClientError as e:
                        if e.response['Error']['Code'] == 'AccessDeniedException':
                            param['Value'] = 'Access Denied'
                        else:
                            param['Value'] = 'Error retrieving value'
                    
                    all_parameters.append(format_parameter(param))
                
                next_token = response.get('NextToken')
                if not next_token:
                    break
                    
            except ClientError as e:
                app.logger.error(f'Error listing parameters: {str(e)}')
                if e.response['Error']['Code'] == 'AccessDeniedException':
                    return jsonify({'error': 'Access denied to parameter store'}), 403
                return jsonify({'error': str(e)}), 500
        
        return jsonify({'parameters': all_parameters})
        
    except Exception as e:
        app.logger.error(f'Unexpected error in list_parameters: {str(e)}')
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/parameters/<path:name>', methods=['GET'])
def get_parameter(name):
    """Get a specific parameter by name"""
    try:
        if not ssm_client:
            return jsonify({'error': 'AWS client not initialized'}), 500
        
        # Ensure the parameter starts with /application
        if not name.startswith('/'):
            name = '/' + name
        if not name.startswith(PARAMETER_PREFIX):
            name = PARAMETER_PREFIX + name
        
        try:
            response = ssm_client.get_parameter(Name=name)
            param = response['Parameter']
            
            # Get parameter metadata
            desc_response = ssm_client.describe_parameters(
                Filters=[{'Key': 'Name', 'Values': [name]}]
            )
            
            if desc_response['Parameters']:
                metadata = desc_response['Parameters'][0]
                param.update(metadata)
            
            return jsonify({'parameter': format_parameter(param)})
            
        except ClientError as e:
            if e.response['Error']['Code'] == 'ParameterNotFound':
                return jsonify({'error': 'Parameter not found'}), 404
            elif e.response['Error']['Code'] == 'AccessDeniedException':
                return jsonify({'error': 'Access denied'}), 403
            return jsonify({'error': str(e)}), 500
            
    except Exception as e:
        app.logger.error(f'Unexpected error in get_parameter: {str(e)}')
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/parameters', methods=['POST'])
def create_parameter():
    """Create a new parameter"""
    try:
        if not ssm_client:
            return jsonify({'error': 'AWS client not initialized'}), 500
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        name = data.get('name', '').strip()
        value = data.get('value', '').strip()
        description = data.get('description', '').strip()
        
        # Validate inputs
        if not name:
            return jsonify({'error': 'Parameter name is required'}), 400
        if not value:
            return jsonify({'error': 'Parameter value is required'}), 400
        
        # Ensure name starts with /application
        if not name.startswith('/'):
            name = '/' + name
        if not name.startswith(PARAMETER_PREFIX):
            name = PARAMETER_PREFIX + '/' + name.lstrip('/')
        
        # Validate JSON
        is_valid, error_msg = validate_json(value)
        if not is_valid:
            return jsonify({'error': f'Invalid JSON: {error_msg}'}), 400
        
        try:
            response = ssm_client.put_parameter(
                Name=name,
                Value=value,
                Description=description,
                Type='String',
                Overwrite=False
            )
            
            app.logger.info(f'Created parameter: {name}')
            
            return jsonify({
                'message': 'Parameter created successfully',
                'name': name,
                'version': response['Version']
            }), 201
            
        except ClientError as e:
            if e.response['Error']['Code'] == 'ParameterAlreadyExists':
                return jsonify({'error': 'Parameter already exists'}), 409
            elif e.response['Error']['Code'] == 'AccessDeniedException':
                return jsonify({'error': 'Access denied'}), 403
            return jsonify({'error': str(e)}), 500
            
    except Exception as e:
        app.logger.error(f'Unexpected error in create_parameter: {str(e)}')
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/parameters/<path:name>', methods=['PUT'])
def update_parameter(name):
    """Update an existing parameter"""
    try:
        if not ssm_client:
            return jsonify({'error': 'AWS client not initialized'}), 500
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        value = data.get('value', '').strip()
        description = data.get('description', '')
        
        if not value:
            return jsonify({'error': 'Parameter value is required'}), 400
        
        # Ensure the parameter starts with /application
        if not name.startswith('/'):
            name = '/' + name
        if not name.startswith(PARAMETER_PREFIX):
            name = PARAMETER_PREFIX + name
        
        # Validate JSON
        is_valid, error_msg = validate_json(value)
        if not is_valid:
            return jsonify({'error': f'Invalid JSON: {error_msg}'}), 400
        
        try:
            # Update parameter
            response = ssm_client.put_parameter(
                Name=name,
                Value=value,
                Description=description,
                Type='String',
                Overwrite=True
            )
            
            app.logger.info(f'Updated parameter: {name}')
            
            return jsonify({
                'message': 'Parameter updated successfully',
                'name': name,
                'version': response['Version']
            })
            
        except ClientError as e:
            if e.response['Error']['Code'] == 'ParameterNotFound':
                return jsonify({'error': 'Parameter not found'}), 404
            elif e.response['Error']['Code'] == 'AccessDeniedException':
                return jsonify({'error': 'Access denied'}), 403
            return jsonify({'error': str(e)}), 500
            
    except Exception as e:
        app.logger.error(f'Unexpected error in update_parameter: {str(e)}')
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/parameters/<path:name>/history', methods=['GET'])
def get_parameter_history(name):
    """Get parameter history (last 5 versions)"""
    try:
        if not ssm_client:
            return jsonify({'error': 'AWS client not initialized'}), 500
        
        # Ensure the parameter starts with /application
        if not name.startswith('/'):
            name = '/' + name
        if not name.startswith(PARAMETER_PREFIX):
            name = PARAMETER_PREFIX + name
        
        try:
            response = ssm_client.get_parameter_history(
                Name=name,
                MaxResults=5
            )
            
            history = []
            previous_value = None
            
            for param in reversed(response.get('Parameters', [])):
                history_item = {
                    'version': param.get('Version', 0),
                    'value': param.get('Value', ''),
                    'lastModified': param.get('LastModifiedDate', datetime.now()).isoformat() if isinstance(param.get('LastModifiedDate'), datetime) else param.get('LastModifiedDate', ''),
                    'lastModifiedBy': param.get('LastModifiedUser', 'Unknown'),
                    'description': param.get('Description', ''),
                    'diff': None
                }
                
                # Calculate diff from previous version
                if previous_value:
                    try:
                        prev_json = json.loads(previous_value)
                        curr_json = json.loads(param.get('Value', '{}'))
                        
                        # Simple diff - show added/removed/changed keys
                        diff = {
                            'added': list(set(curr_json.keys()) - set(prev_json.keys())),
                            'removed': list(set(prev_json.keys()) - set(curr_json.keys())),
                            'changed': [k for k in set(prev_json.keys()) & set(curr_json.keys()) 
                                      if prev_json[k] != curr_json[k]]
                        }
                        history_item['diff'] = diff
                    except:
                        # If not valid JSON, just note it changed
                        history_item['diff'] = {'note': 'Content changed'}
                
                previous_value = param.get('Value', '')
                history.append(history_item)
            
            return jsonify({'history': history})
            
        except ClientError as e:
            if e.response['Error']['Code'] == 'ParameterNotFound':
                return jsonify({'error': 'Parameter not found'}), 404
            elif e.response['Error']['Code'] == 'AccessDeniedException':
                return jsonify({'error': 'Access denied'}), 403
            return jsonify({'error': str(e)}), 500
            
    except Exception as e:
        app.logger.error(f'Unexpected error in get_parameter_history: {str(e)}')
        return jsonify({'error': 'Internal server error'}), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    app.logger.error(f'Internal error: {str(error)}')
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3700, debug=os.getenv('FLASK_ENV') == 'development')