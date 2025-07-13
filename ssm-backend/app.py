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

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configure URL prefix for ALB routing
URL_PREFIX = os.getenv('URL_PREFIX', '/ssm-api')

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
log_file = os.path.join(log_dir, 'ssm-backend.log')

file_handler = RotatingFileHandler(log_file, maxBytes=10485760, backupCount=5)
file_handler.setLevel(getattr(logging, log_level))
file_handler.setFormatter(logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s [in %(pathname)s:%(lineno)d]'
))
app.logger.addHandler(file_handler)

# Log startup
app.logger.info(f'SSM Backend service started with log level: {log_level}')

# AWS Configuration
AWS_REGION = os.getenv('AWS_REGION', 'us-east-1')
PARAMETER_PREFIX = '/application'

# Initialize AWS clients
try:
    # Check if running in ECS/Lambda (AWS_EXECUTION_ENV is set) or if profile is explicitly disabled
    if os.getenv('AWS_EXECUTION_ENV') or os.getenv('USE_IAM_ROLE', 'false').lower() == 'true':
        # Use IAM role credentials (for ECS/Lambda)
        session = boto3.Session(region_name=AWS_REGION)
        ssm_client = session.client('ssm')
        app.logger.info('AWS session initialized with IAM role credentials')
    else:
        # Use profile for local development
        AWS_PROFILE = os.getenv('AWS_PROFILE', 'adfsjit')
        session = boto3.Session(profile_name=AWS_PROFILE, region_name=AWS_REGION)
        ssm_client = session.client('ssm')
        app.logger.info(f'AWS session initialized with profile: {AWS_PROFILE}')
except Exception as e:
    app.logger.error(f'Failed to initialize AWS session: {str(e)}')
    ssm_client = None

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
                    response.status)
    return response

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

def list_parameters_by_path(path_prefix, page=1, limit=50):
    """Alternative method to list parameters using get_parameters_by_path with pagination"""
    try:
        all_parameters = []
        next_token = None
        skip = (page - 1) * limit
        
        while True:
            params = {
                'Path': path_prefix,
                'Recursive': True,
                'MaxResults': 10
            }
            
            if next_token:
                params['NextToken'] = next_token
            
            try:
                response = ssm_client.get_parameters_by_path(**params)
                
                for param in response.get('Parameters', []):
                    # Format parameter without additional metadata
                    all_parameters.append(format_parameter(param))
                
                next_token = response.get('NextToken')
                if not next_token:
                    break
                    
            except ClientError as e:
                app.logger.error(f'Error in get_parameters_by_path: {str(e)}')
                if e.response['Error']['Code'] == 'AccessDeniedException':
                    return jsonify({'error': 'Access denied to parameter store'}), 403
                return jsonify({'error': str(e)}), 500
        
        # Calculate pagination info
        total_count = len(all_parameters)
        paginated_params = all_parameters[skip:skip + limit]
        total_pages = (total_count + limit - 1) // limit
        
        return jsonify({
            'parameters': paginated_params,
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
        app.logger.error(f'Unexpected error in list_parameters_by_path: {str(e)}')
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/health', methods=['GET'])
@app.route(f'{URL_PREFIX}/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'ssm-backend',
        'timestamp': datetime.now().isoformat()
    })

@app.route(f'{URL_PREFIX}/allparameters', methods=['GET'])
@app.route(f'{URL_PREFIX}/allparameters/<path:prefix>', methods=['GET'])
def list_parameters(prefix=None):
    """List all parameters under specified prefix or /application with pagination"""
    try:
        if not ssm_client:
            return jsonify({'error': 'AWS client not initialized'}), 500
        
        # Get pagination parameters from query string
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 50))
        
        # Validate pagination parameters
        if page < 1:
            page = 1
        if limit < 1 or limit > 100:
            limit = 50
            
        # Use provided prefix or default to /application
        path_prefix = f'/{prefix}' if prefix else PARAMETER_PREFIX
        
        # Use get_parameters_by_path directly since we don't have describe_parameters permission
        return list_parameters_by_path(path_prefix, page, limit)
        
    except Exception as e:
        app.logger.error(f'Unexpected error in list_parameters: {str(e)}')
        return jsonify({'error': 'Internal server error'}), 500

@app.route(f'{URL_PREFIX}/parameter/<path:name>', methods=['GET'])
def get_parameter(name):
    """Get a specific parameter by name"""
    try:
        if not ssm_client:
            return jsonify({'error': 'AWS client not initialized'}), 500
        
        # Ensure the parameter starts with /
        if not name.startswith('/'):
            name = '/' + name
        
        try:
            response = ssm_client.get_parameter(Name=name, WithDecryption=True)
            param = response['Parameter']
            
            # Return parameter without additional metadata
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

@app.route(f'{URL_PREFIX}/parameters', methods=['POST'])
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

@app.route(f'{URL_PREFIX}/parameter/<path:name>', methods=['PUT'])
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
        
        # Ensure the parameter starts with /
        if not name.startswith('/'):
            name = '/' + name
        
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

@app.route(f'{URL_PREFIX}/parameter/<path:name>/history', methods=['GET'])
def get_parameter_history(name):
    """Get parameter history (last 5 versions)"""
    try:
        if not ssm_client:
            return jsonify({'error': 'AWS client not initialized'}), 500
        
        # Ensure the parameter starts with /
        if not name.startswith('/'):
            name = '/' + name
        
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
    app.logger.warning(f'404 Not Found: {request.method} {request.path}')
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    app.logger.error(f'500 Internal Server Error: {request.method} {request.path} - {str(error)}', exc_info=True)
    return jsonify({'error': 'Internal server error'}), 500

@app.errorhandler(Exception)
def handle_unexpected_error(error):
    app.logger.error(f'Unexpected error: {request.method} {request.path} - {str(error)}', exc_info=True)
    return jsonify({'error': 'An unexpected error occurred'}), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 3700))
    
    if os.getenv('FLASK_ENV') == 'development':
        app.run(host='0.0.0.0', port=port, debug=True)
    else:
        from waitress import serve
        app.logger.info(f'Starting SSM Backend service with Waitress on port {port}')
        serve(app, host='0.0.0.0', port=port)