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
from io import BytesIO

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configure URL prefix for ALB routing
URL_PREFIX = os.getenv('URL_PREFIX', '/serverless-api')

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
log_file = os.path.join(log_dir, 'emr-serverless-backend.log')

file_handler = RotatingFileHandler(log_file, maxBytes=10485760, backupCount=5)
file_handler.setLevel(getattr(logging, log_level))
file_handler.setFormatter(logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s [in %(pathname)s:%(lineno)d]'
))
app.logger.addHandler(file_handler)

# Log startup
app.logger.info(f'EMR Serverless Backend service started with log level: {log_level}')

# AWS Configuration
AWS_REGION = os.getenv('AWS_REGION', 'us-east-1')
S3_BUCKET = 'app-id-107923-dep-id-107924-uu-id-mpm6sfacq4a8'
BASE_PATH = 'logs/serverless/'

# Initialize AWS clients
try:
    # Check if running in ECS/Lambda (AWS_EXECUTION_ENV is set) or if profile is explicitly disabled
    if os.getenv('AWS_EXECUTION_ENV') or os.getenv('USE_IAM_ROLE', 'false').lower() == 'true':
        # Use IAM role credentials (for ECS/Lambda)
        session = boto3.Session(region_name=AWS_REGION)
        s3 = session.client('s3')
        app.logger.info('AWS session initialized with IAM role credentials')
    else:
        # Use profile for local development
        AWS_PROFILE = os.getenv('AWS_PROFILE', 'adfsjit')
        session = boto3.Session(profile_name=AWS_PROFILE, region_name=AWS_REGION)
        s3 = session.client('s3')
        app.logger.info(f'AWS session initialized with profile: {AWS_PROFILE}')
except Exception as e:
    app.logger.error(f'Failed to initialize AWS session: {str(e)}')
    s3 = None

# Request logging middleware
@app.before_request
def log_request_info():
    app.logger.info(f'Request: {request.method} {request.url}')
    app.logger.debug(f'Headers: {dict(request.headers)}')
    if request.content_type and 'application/json' in request.content_type:
        try:
            body = request.get_json()
            if body:
                app.logger.debug(f'Body: {json.dumps(body)}')
        except Exception as e:
            app.logger.debug(f'Failed to parse request body: {str(e)}')

@app.after_request
def log_response_info(response):
    app.logger.info(f'Response: {response.status_code}')
    return response

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    app.logger.error(f'Internal error: {str(error)}')
    return jsonify({'error': 'Internal server error'}), 500

# Health check endpoints
@app.route(f'{URL_PREFIX}/health', methods=['GET'])
@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'service': 'emr-serverless-backend',
        'timestamp': datetime.utcnow().isoformat()
    }), 200

# List objects in S3 path
@app.route(f'{URL_PREFIX}/list', methods=['GET'])
def list_objects():
    """List objects and folders in the specified S3 path"""
    try:
        prefix = request.args.get('prefix', '')
        delimiter = request.args.get('delimiter', '/')
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 50))
        
        # Ensure prefix starts with base path
        if not prefix:
            full_prefix = BASE_PATH
        elif prefix.startswith(BASE_PATH):
            full_prefix = prefix
        else:
            full_prefix = BASE_PATH + prefix
        
        # Ensure prefix ends with / for folder listing
        if full_prefix and not full_prefix.endswith('/'):
            full_prefix += '/'
        
        app.logger.info(f'Listing objects in bucket: {S3_BUCKET}, prefix: {full_prefix}')
        
        # Use paginator for large result sets
        paginator = s3.get_paginator('list_objects_v2')
        page_iterator = paginator.paginate(
            Bucket=S3_BUCKET,
            Prefix=full_prefix,
            Delimiter=delimiter,
            PaginationConfig={
                'MaxItems': limit * page,
                'PageSize': limit
            }
        )
        
        folders = []
        files = []
        
        # Skip to the requested page
        items_to_skip = (page - 1) * limit
        items_counted = 0
        total_items = 0
        
        for page_data in page_iterator:
            # Process folders (CommonPrefixes)
            for prefix_info in page_data.get('CommonPrefixes', []):
                total_items += 1
                if items_counted >= items_to_skip and len(folders) < limit:
                    folder_path = prefix_info['Prefix']
                    folder_name = folder_path.rstrip('/').split('/')[-1]
                    folders.append({
                        'name': folder_name,
                        'path': folder_path,
                        'type': 'folder'
                    })
                items_counted += 1
            
            # Process files (Contents)
            for obj in page_data.get('Contents', []):
                # Skip the folder itself
                if obj['Key'] == full_prefix:
                    continue
                    
                total_items += 1
                if items_counted >= items_to_skip and len(files) < limit:
                    file_path = obj['Key']
                    file_name = file_path.split('/')[-1]
                    files.append({
                        'name': file_name,
                        'path': file_path,
                        'type': 'file',
                        'size': obj['Size'],
                        'lastModified': obj['LastModified'].isoformat()
                    })
                items_counted += 1
                
            # Stop if we have enough items
            if len(folders) + len(files) >= limit:
                break
        
        # Calculate total pages
        total_pages = (total_items + limit - 1) // limit
        
        # Build breadcrumb
        breadcrumb = []
        if full_prefix != BASE_PATH:
            parts = full_prefix.replace(BASE_PATH, '').strip('/').split('/')
            current_path = BASE_PATH
            breadcrumb.append({'name': 'Root', 'path': BASE_PATH})
            
            for part in parts:
                if part:
                    current_path += part + '/'
                    breadcrumb.append({'name': part, 'path': current_path})
        
        return jsonify({
            'folders': folders,
            'files': files,
            'breadcrumb': breadcrumb,
            'pagination': {
                'page': page,
                'limit': limit,
                'total': total_items,
                'totalPages': total_pages
            }
        }), 200
        
    except ClientError as e:
        app.logger.error(f'AWS error listing objects: {str(e)}')
        return jsonify({'error': f'AWS error: {str(e)}'}), 500
    except Exception as e:
        app.logger.error(f'Error listing objects: {str(e)}')
        return jsonify({'error': str(e)}), 500

# Get file content
@app.route(f'{URL_PREFIX}/file', methods=['GET'])
def get_file():
    """Get file content from S3"""
    try:
        file_path = request.args.get('path')
        if not file_path:
            return jsonify({'error': 'File path is required'}), 400
        
        app.logger.info(f'Getting file from S3: {S3_BUCKET}/{file_path}')
        
        # Get the file from S3
        response = s3.get_object(Bucket=S3_BUCKET, Key=file_path)
        file_content = response['Body'].read()
        
        # Check if it's a gzipped file
        if file_path.endswith('.gz'):
            try:
                # Decompress the content
                decompressed_content = gzip.decompress(file_content)
                content = decompressed_content.decode('utf-8', errors='replace')
                
                # Limit content size for UI display (10MB)
                max_size = 10 * 1024 * 1024
                if len(content) > max_size:
                    content = content[:max_size]
                    truncated = True
                else:
                    truncated = False
                
                return jsonify({
                    'content': content,
                    'truncated': truncated,
                    'originalSize': len(decompressed_content),
                    'fileName': file_path.split('/')[-1]
                }), 200
                
            except Exception as e:
                app.logger.error(f'Error decompressing file: {str(e)}')
                return jsonify({'error': 'Failed to decompress file'}), 500
        else:
            # For non-gzipped files, return as-is
            try:
                content = file_content.decode('utf-8', errors='replace')
                
                # Limit content size
                max_size = 10 * 1024 * 1024
                if len(content) > max_size:
                    content = content[:max_size]
                    truncated = True
                else:
                    truncated = False
                
                return jsonify({
                    'content': content,
                    'truncated': truncated,
                    'originalSize': len(file_content),
                    'fileName': file_path.split('/')[-1]
                }), 200
                
            except Exception as e:
                app.logger.error(f'Error reading file: {str(e)}')
                return jsonify({'error': 'Failed to read file'}), 500
                
    except ClientError as e:
        app.logger.error(f'AWS error getting file: {str(e)}')
        if e.response['Error']['Code'] == 'NoSuchKey':
            return jsonify({'error': 'File not found'}), 404
        return jsonify({'error': f'AWS error: {str(e)}'}), 500
    except Exception as e:
        app.logger.error(f'Error getting file: {str(e)}')
        return jsonify({'error': str(e)}), 500

# Download file
@app.route(f'{URL_PREFIX}/download', methods=['GET'])
def download_file():
    """Generate presigned URL for file download"""
    try:
        file_path = request.args.get('path')
        if not file_path:
            return jsonify({'error': 'File path is required'}), 400
        
        app.logger.info(f'Generating download URL for: {S3_BUCKET}/{file_path}')
        
        # Generate presigned URL valid for 1 hour
        presigned_url = s3.generate_presigned_url(
            'get_object',
            Params={'Bucket': S3_BUCKET, 'Key': file_path},
            ExpiresIn=3600
        )
        
        return jsonify({
            'downloadUrl': presigned_url,
            'fileName': file_path.split('/')[-1]
        }), 200
        
    except ClientError as e:
        app.logger.error(f'AWS error generating download URL: {str(e)}')
        return jsonify({'error': f'AWS error: {str(e)}'}), 500
    except Exception as e:
        app.logger.error(f'Error generating download URL: {str(e)}')
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3700, debug=True)