# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current Status (Last Updated: 2025-07-16)

### Working Features
- ✅ EMR cluster management with multi-environment support (UAT1/2/3)
- ✅ Advanced filtering: search across all clusters, multi-state filtering
- ✅ Step management: view, duplicate, cancel steps
- ✅ SSM parameter management with full CRUD
- ✅ **S3 Data Viewer service** - Browse and preview parquet files
- ✅ **EMR Serverless Log Viewer** (NEW) - Browse and view EMR Serverless application logs
- ✅ **AWS-XCESS Portal** - Unified interface for all services
- ✅ All services deployed to ECS with ALB routing
- ✅ IAM role-based authentication for ECS
- ✅ Health checks configured for ECS (dual endpoints)
- ✅ Step logs viewer - View stdout/stderr from S3 for both steps and containers
- ✅ AI-powered step analysis using Azure OpenAI (FIXED: token expiration)

### Recent Session Work (2025-07-16)

1. **Azure OpenAI Token Expiration Fix** ✅:
   - **Problem**: Tokens expired after ~1 hour causing "invalid token" errors
   - **Root Cause**: Reusing same OpenAI client with stale tokens
   - **Analysis**: Examined LROT_AZURE.py which never has token issues
   - **Solution**: Adopted LROT_AZURE.py pattern - create new client per request
   - **Implementation**: 
     - Replaced `refresh_azure_token()` with `create_new_openai_client()`
     - Each request now creates fresh client with new token
     - No more global client or token caching
   - **Result**: Token expiration issues completely resolved

2. **Python Global Variable Fixes**:
   - Fixed "azure_credential assigned before global declaration" at line 182
   - Fixed similar issue with azure_openai_client at line 1232
   - Moved global declarations before any usage

3. **AWS-XCESS Portal Implementation** ✅:
   - **Complete Redesign**: Transformed home-frontend into unified portal
   - **Branding**: New AWS-XCESS brand with professional UI
   - **Architecture**: Side navigation with iframe-based service loading
   - **Features**:
     - Collapsible sidebar navigation
     - Dark mode toggle
     - Services load in iframes (single page experience)
     - Browser history management
     - Loading states and transitions
     - Dashboard with service tiles
   - **Added WIP Services**: 
     - Databricks (coming soon)
     - Cost Estimation (coming soon)
   - **Fixed**: S3 Data service iframe routing (added trailing slash)

4. **ECS Health Check Improvements**:
   - Increased timeout to 20s for Azure OpenAI initialization
   - Set start period to 120s
   - Fixed egress rules for port 443 (HTTPS to Azure)

5. **Documentation Updates**:
   - Updated CLAUDE.md with all session changes
   - Added known issues and solutions section
   - Documented LROT_AZURE.py pattern for future reference

6. **EMR Serverless Log Viewer Implementation** ✅:
   - **Purpose**: View EMR Serverless application logs from S3
   - **S3 Bucket**: `app-id-107923-dep-id-107924-uu-id-mpm6sfacq4a8`
   - **Path Structure**: `logs/serverless/applications/{app_id}/jobs/{job_id}/`
   - **Features**:
     - Browse folder hierarchy with breadcrumb navigation
     - View compressed log files (.gz) with decompression
     - Syntax highlighting for log levels and timestamps
     - Search within logs with highlighting
     - Auto-refresh for running jobs
     - Download original files
     - Pagination for large directories
   - **Reused Components**: LogViewer from EMR service
   - **Added to AWS-XCESS**: New cyan-colored tile

### Previous Session Work (2025-07-14)

1. **S3 Data Viewer Service Implementation**:
   - Full service implementation following established patterns
   - Backend: Flask app at `/s3data-api/*`
   - Frontend: React app at `/s3data/*`
   - Features:
     - List S3 objects with folder navigation
     - Preview parquet files (up to 500 rows)
     - Download original parquet files
     - Export to CSV format (Excel removed due to pandas issues)
   - Multi-environment support (UAT1/2/3) with RAW/REFINED buckets

2. **Pandas Dependency Removal**:
   - Removed pandas from S3 Data backend to avoid Docker build issues
   - Refactored to use pure PyArrow for parquet operations
   - Changed Excel export to CSV export (simpler, no external dependencies)
   - Simplified Dockerfile - no build tools needed

3. **Azure OpenAI Authentication Update**:
   - Converted from Service Principal-only to hybrid authentication
   - Now uses BOTH Service Principal (for Azure AD token) AND API Key
   - Token passed as Bearer authorization header
   - Added comprehensive logging for debugging auth issues
   - Test endpoint: GET /api/test-azure-openai

4. **Bug Fixes**:
   - Fixed 415 "Unsupported Media Type" in S3 Data middleware
   - Fixed container log streaming issues (useCallback dependencies)
   - Fixed URL_PREFIX in Dockerfiles for ALB routing
   - Added error handlers and debug logging

5. **Docker/Deployment Updates**:
   - S3 Data backend Makefile updated with all dependencies
   - Fixed pyarrow version to 20.0.0 (working version)
   - Removed gcc/build tools requirement
   - Added URL_PREFIX environment variables to Dockerfiles

### Azure OpenAI Configuration
- **Authentication**: Hybrid (Service Principal + API Key)
- **Required Environment Variables**:
  - `AZURE_OPENAI_ENDPOINT`: Your Azure OpenAI resource endpoint
  - `AZURE_OPENAI_API_KEY`: OpenAI API key from Azure Portal
  - `AZURE_OPENAI_DEPLOYMENT_NAME`: Model deployment name (e.g., "gpt-4o-2024-08-06")
  - `AZURE_TENANT_ID`: Azure AD tenant ID
  - `AZURE_SPN_CLIENT_ID`: Service Principal client/app ID
  - `AZURE_USER_ID`: User identifier for headers (default: "emr-manager")
  - PEM certificate path: `/app/azure_cert.pem`

### ALB Routing Configuration
| Service | Backend Path | Frontend Path | Backend Port | Frontend Port |
|---------|--------------|---------------|--------------|---------------|
| AWS-XCESS Portal | - | `/` | - | 8080 |
| EMR | `/api/*` | `/emr/*` | 3700 | 8080 |
| SSM | `/ssm-api/*` | `/parameters/*` | 3700 | 8080 |
| S3 Data | `/s3data-api/*` | `/s3data/*` | 3700 | 8080 |
| EMR Serverless | `/emr-serverless-api/*` | `/emr-serverless/*` | 3700 | 8080 |

### Known Issues and Solutions

1. **S3 Data 415 Error**: Fixed by checking content-type before parsing JSON in middleware
2. **Container Logs Not Loading**: Fixed useCallback dependencies in StepLogsModal
3. **Docker Build Failures**: Remove pandas or use pre-built wheels
4. **Azure OpenAI Auth Failures**: Check all env vars, PEM file permissions, and use test endpoint

### Known Issues and Solutions

1. **S3 Data Service Loading Issue**: 
   - If S3 Data shows multiple sidebars, check ALB routing
   - Ensure `/s3data/*` routes to S3 Data frontend, not home frontend
   - Temporary fix: Added trailing slash to path in home-frontend App.js

2. **Azure OpenAI Token Expiration** ✅ **FIXED**:
   - **Previous Pattern (PROBLEMATIC)**:
     ```python
     # Global client reused across requests
     azure_openai_client = None
     
     def refresh_azure_token():
         # Tried to refresh token on existing client
         azure_openai_client.default_headers["Authorization"] = f"Bearer {new_token}"
     ```
   - **New Pattern (FROM LROT_AZURE.py)**:
     ```python
     def create_new_openai_client():
         # Create fresh client for each request
         token_response = azure_credential.get_token("https://cognitiveservices.azure.com/.default")
         client = AzureOpenAI(
             azure_endpoint=AZURE_OPENAI_ENDPOINT,
             api_key=AZURE_OPENAI_API_KEY,
             api_version=AZURE_OPENAI_API_VERSION,
             default_headers={
                 "Authorization": f"Bearer {token_response.token}",
                 "x-ms-useragent": AZURE_USER_ID
             }
         )
         return client
     ```
   - **Result**: No more token expiration issues

3. **Python Global Declaration Errors** ✅ **FIXED**:
   - Error: "name 'azure_credential' is assigned before global declaration"
   - Solution: Variables at module level don't need global declaration
   - Only use `global` when modifying from within a function

4. **ECS Deployment Issues** ✅ **FIXED**:
   - Security group needed egress rule for port 443
   - Health check timeouts during Azure OpenAI initialization
   - Solution: Increased timeout to 20s, start period to 120s

### Next Steps
1. **Fix ALB routing for S3 Data service** if still showing multiple sidebars
2. **Implement Databricks integration** (currently shows WIP page in AWS-XCESS)
3. **Implement Cost Estimation service** (currently shows WIP page in AWS-XCESS)
4. **Add DynamoDB service** following established patterns
5. **Enhance S3 Data Viewer** with:
   - File upload capability
   - Support for more file formats (JSON, CSV input)
   - Folder creation/deletion
6. **Consider cluster-level efficiency analysis** using CloudWatch metrics
7. **Add caching for AI analysis** to avoid re-analyzing completed steps

### For Next Session
To continue work, reference:
- This CLAUDE.md file for complete project context
- Recent commits show Azure OpenAI token fix and AWS-XCESS portal
- LROT_AZURE.py demonstrates the working token pattern
- AWS-XCESS portal at `/` provides unified access to all services
- Test Azure OpenAI with GET /api/test-azure-openai endpoint
- All services follow similar patterns - use S3 Data as latest template

## Project Overview

EMR-MANAGER is a multi-service web application platform for managing various AWS services. Currently implemented:
1. **EMR Service**: Manage Amazon EMR (Elastic MapReduce) clusters with multi-environment support
2. **SSM Service**: Manage AWS Systems Manager Parameter Store with full CRUD operations
3. **S3 Data Viewer**: Browse S3 buckets and preview parquet files with export capabilities
4. **EMR Serverless Log Viewer**: Browse and view EMR Serverless application logs from S3
5. **AWS-XCESS Portal**: Unified interface providing single-page access to all services

Future services planned: DynamoDB, Databricks, Cost Estimation, and other AWS services following the same architecture.

## Architecture

The project follows a consistent microservices architecture where each AWS service has:

1. **Backend API**: Python Flask application with Waitress WSGI server
2. **Frontend UI**: React application with Tailwind CSS  
3. **Frontend Server**: Express server for serving the React build
4. **Deployment**: Dockerized for ECS with ALB routing

### Service Structure
Each service follows this directory structure:
```
service-name-backend/
├── app.py              # Flask application
├── requirements.txt    # Python dependencies
├── pyproject.toml     # Poetry configuration
├── Makefile           # Build automation
├── Dockerfile         # Container configuration
└── __init__.py        # Package initialization

service-name-frontend/
├── client/            # React application
│   ├── src/
│   ├── public/
│   └── package.json
├── server/            # Express server
│   ├── index.js
│   └── package.json
└── Dockerfile         # Multi-stage build
```

## Key Commands

### Backend Development

```bash
# Navigate to backend directory
cd emr-backend

# Install dependencies
make build

# Run the Flask server (port 3700)
make run

# Run linting
make lint

# Run tests
make test

# Create deployment package
make package
```

### Frontend Development

```bash
# Navigate to frontend directory
cd emr-frontend/client

# Install dependencies
npm install

# Start development server (port 3000)
npm start

# Build for production
npm run build

# Run tests
npm test
```

### Frontend Server

```bash
# Navigate to server directory
cd emr-frontend/server

# Install dependencies
npm install

# Start server (port 8080, serves from ../client/build)
npm start
```

## AWS Integration Details

### EMR Service
- **AWS Credentials**: Automatically uses IAM roles in ECS, falls back to profile for local development
- **Parameter Store Paths**: 
  - UAT1: `/application/ecdp-config/uat1/EMR-BASE/`
  - UAT2: `/application/ecdp-config/uat2/EMR-BASE/`
  - UAT3: `/application/ecdp-config/uat3/EMR-BASE/`
- **Lambda Functions**: 
  - UAT1: `app-job_submit_lambda_uat1`
  - UAT2: `app-job_submit_lambda_uat2`
  - UAT3: `app-job_submit_lambda_uat3`
- **Required Permissions**: SSM Parameter Store read, EMR operations (ListClusters, DescribeCluster, ListSteps, DescribeStep, AddJobFlowSteps, CancelSteps), Lambda invoke

### SSM Service
- **AWS Credentials**: Automatically uses IAM roles in ECS, falls back to profile for local development
- **Parameter Store Path**: Can browse any path
- **Required Permissions**: GetParameters, GetParametersHistory, GetParametersByPath, GetParameter, PutParameter (WriteParameterStore)

### S3 Data Viewer Service
- **AWS Credentials**: Automatically uses IAM roles in ECS, falls back to profile for local development
- **S3 Buckets**: Environment-specific (UAT1/2/3) with RAW/REFINED types
- **Required Permissions**: ListBucket, GetObject, S3 access for configured buckets

### EMR Serverless Log Viewer Service
- **AWS Credentials**: Automatically uses IAM roles in ECS, falls back to profile for local development
- **S3 Bucket**: `app-id-107923-dep-id-107924-uu-id-mpm6sfacq4a8`
- **Base Path**: `logs/serverless/`
- **Structure**: `applications/{app_id}/jobs/{job_id}/`
- **Required Permissions**: ListBucket, GetObject for the serverless logs bucket

## Important Implementation Notes

1. **No Direct AWS Access from Frontend**: All AWS operations are proxied through the Python backend for security
2. **Manual Refresh**: EMR frontend has a refresh button for updating cluster status
3. **Cluster Filtering**: Clusters with "STRESS" in their name are automatically filtered out
4. **Logging**: Backend implements file-based logging with rotation in the `logs/` directory
5. **CORS**: Backend has CORS enabled for frontend communication
6. **Environment Persistence**: Selected environment filter is saved in localStorage
7. **URL Prefixes**: Each backend service uses URL prefix for ALB routing (e.g., `/api`, `/ssm-api`)

## Code Organization

### Backend Structure
- `app.py`: Main Flask application with all endpoints
- `requirements.txt`: Python dependencies
- `Makefile`: Build and development commands
- `Dockerfile`: Container configuration

### Frontend Structure
- `/src/components/`: React components
- `/src/services/`: Backend API integration (emrService.js, ssmService.js)
- `/src/utils/`: Utility functions (formatters.js)
- `/src/App.js`: Main application component
- Common components: Pagination, SearchBar, LoadingSpinner, ErrorMessage

## API Endpoints

### EMR Service
- `GET /api/clusters`: List all EMR clusters with pagination (?page=1&limit=20&environment=all|uat1|uat2|uat3)
- `GET /api/clusters/<name>`: Get specific cluster details
- `POST /api/clusters/<name>/start`: Start a cluster (requires environment in body)
- `POST /api/clusters/<name>/terminate`: Terminate a cluster (requires environment in body)
- `GET /api/clusters/<cluster_id>/steps`: List cluster steps with pagination
- `GET /api/clusters/<cluster_id>/steps/<step_id>`: Get step details
- `POST /api/clusters/<cluster_id>/steps`: Duplicate/add a step
- `POST /api/clusters/<cluster_id>/steps/<step_id>/cancel`: Cancel a running step
- `GET /api/health`: Health check endpoint

### SSM Service
- `GET /ssm-api/allparameters`: List parameters with pagination (?page=1&limit=50)
- `GET /ssm-api/parameter/<path:name>`: Get specific parameter details
- `POST /ssm-api/parameters`: Create new parameter (JSON validation required)
- `PUT /ssm-api/parameter/<path:name>`: Update parameter value
- `GET /ssm-api/parameter/<path:name>/history`: Get parameter history (last 5 versions)
- `GET /ssm-api/health`: Health check endpoint

### S3 Data Viewer Service
- `GET /s3data-api/list`: List S3 objects with pagination
- `GET /s3data-api/preview`: Preview parquet file content
- `GET /s3data-api/download`: Generate presigned URL for download
- `GET /s3data-api/export/csv`: Export parquet to CSV
- `GET /s3data-api/health`: Health check endpoint

### EMR Serverless Log Viewer Service
- `GET /emr-serverless-api/list`: List objects in S3 path (?prefix=path&page=1&limit=50)
- `GET /emr-serverless-api/file`: Get file content with decompression for .gz files
- `GET /emr-serverless-api/download`: Generate presigned URL for file download
- `GET /emr-serverless-api/health`: Health check endpoint

## Development Workflow

1. Backend changes require restarting the Flask server
2. Frontend changes hot-reload automatically in development
3. Always test AWS integration with proper credentials
4. Use `make lint` for backend code quality checks
5. Frontend uses ESLint through Create React App defaults
6. Build wheel packages with `make ci` for deployment

## Local Development Setup

### EMR Service
1. **Backend** (Terminal 1):
   ```bash
   cd emr-backend
   # For local development, remove the /api prefix
   echo "URL_PREFIX=" > .env
   pip install -r requirements.txt
   python app.py  # Runs on port 3700
   ```

2. **Frontend** (Terminal 2):
   ```bash
   cd emr-frontend/client
   # Point to local backend
   echo "REACT_APP_API_URL=http://localhost:3700" > .env
   npm install
   npm start  # Runs on port 3000
   ```

### SSM Service
1. **Backend** (Terminal 1):
   ```bash
   cd ssm-backend
   # For local development, remove the /ssm-api prefix
   echo "URL_PREFIX=" > .env
   pip install -r requirements.txt
   python app.py  # Runs on port 3700
   ```

2. **Frontend** (Terminal 2):
   ```bash
   cd ssm-frontend/client
   # Point to local backend
   echo "REACT_APP_API_URL=http://localhost:3700" > .env
   npm install
   npm start  # Runs on port 3000
   ```

### EMR Serverless Log Viewer Service
1. **Backend** (Terminal 1):
   ```bash
   cd emr-serverless-backend
   # For local development, remove the /emr-serverless-api prefix
   echo "URL_PREFIX=" > .env
   pip install -r requirements.txt
   python app.py  # Runs on port 3700
   ```

2. **Frontend** (Terminal 2):
   ```bash
   cd emr-serverless-frontend/client
   # Point to local backend
   echo "REACT_APP_API_URL=http://localhost:3700" > .env
   npm install
   npm start  # Runs on port 3000
   ```

**Note**: The `.env` files are gitignored and should not be committed. In production, the URL_PREFIX defaults to the correct values for ALB routing.

## Deployment

The project uses Docker for containerization:
- Backend and frontend have separate Dockerfiles
- Images are based on enterprise JPMorgan Chase base images
- Backend runs on port 3700, frontend server on port 8080
- ECS deployment with ALB routing:
  - `/` → AWS-XCESS portal (home frontend)
  - `/api/*` → EMR backend service
  - `/emr/*` → EMR frontend service
  - `/ssm-api/*` → SSM backend service
  - `/parameters/*` → SSM frontend service
  - `/s3data-api/*` → S3 Data backend service
  - `/s3data/*` → S3 Data frontend service
  - `/emr-serverless-api/*` → EMR Serverless backend service
  - `/emr-serverless/*` → EMR Serverless frontend service
- Base URL: `https://accessaws-uat.prod.aws.jpmchase.net`

### API URL Configuration
- Frontend uses **relative URLs** for production (e.g., `/ssm-api`)
- No environment configuration needed in production
- For local development: Set `REACT_APP_API_URL=http://localhost:3700` in `.env`

## Recent Additions (EMR Service Redesign)

### Backend Enhancements
1. **Multi-Environment Support**: Added support for UAT1/UAT2/UAT3 with separate Lambda functions
2. **EMR Steps Management**: Full CRUD operations for EMR steps
3. **Enhanced Pagination**: Consistent pagination across all endpoints
4. **Environment-Aware Operations**: Start/terminate operations use environment-specific Lambdas
5. **Step Details**: Comprehensive step information including timeline and failure details
6. **Advanced Filtering**: Backend now supports search and multi-state filtering
7. **Automatic IAM Role Detection**: Uses ECS task roles in production, falls back to profile for local dev
8. **Request/Response Logging**: Added middleware for comprehensive request tracking
9. **Health Check Endpoints**: Dual endpoints at `/health` and `/api/health` for ECS compatibility

### Frontend Features
1. **Environment Filter**: Dropdown selector with localStorage persistence (defaults to 'all')
2. **Enhanced Cluster Table**: Shows environment, status, step count, and created date
3. **Cluster Steps Modal**: View all steps for a cluster with pagination
4. **Step Management**: Duplicate steps with edit capability, cancel running steps
5. **Step Details Viewer**: JSON tree view for step configuration and metadata
6. **Manual Refresh**: Users can refresh clusters using the refresh button (removed auto-refresh)
7. **Advanced Search**: Backend search across all clusters in environment (name, ID, status)
8. **Status Filter Dropdown**: AWS EMR-style multi-select filter in Status column header
9. **Active Filters Display**: Shows and manages active filters below search bar
10. **Removed Features**: Last Activity column removed for cleaner UI

### Key Implementation Patterns
1. **Modal Architecture**: Nested modals for steps list → step details/duplication
2. **State Management**: Uses React hooks for all state management
3. **Error Handling**: Toast notifications for all user actions
4. **Responsive Design**: Mobile-friendly with Tailwind CSS
5. **Consistent UI**: Matches SSM service design patterns
6. **Backend Filtering**: All search/filter operations done server-side for performance
7. **Filter Persistence**: Environment selection saved in localStorage

### Recent Bug Fixes (Previous Sessions)
1. **Fixed Flask Route Parameters**: Changed `<n>` to `<name>` in cluster endpoints
2. **Added python-dotenv**: Added to pyproject.toml for Docker builds
3. **Health Check Fix**: Added `/health` endpoint for ECS health checks
4. **CORS Configuration**: Removed hardcoded origins for production deployment
5. **Environment Filtering**: Fixed client-side filtering that was overriding backend filters

### Bug Fixes (2025-07-13 Session)
1. **Container Log Paths**: Added missing cluster_id to S3 paths (logs/{cluster_id}/containers/...)
2. **Container ID Format**: Fixed validation to accept actual container ID format instead of application_ pattern
3. **Application ID Passing**: Frontend now passes applicationId to backend for container log requests
4. **Gzipped Files**: Fixed to handle both stdout.gz and stderr.gz (both are compressed)

### Completed Features
1. **Step Logs Viewer** ✅: 
   - Backend endpoints for fetching step and container logs from S3
   - Successfully extracts YARN application ID from stderr.gz
   - UI: "Logs" button in steps table (purple color)
   - Features: Tab switching between step/container logs, virtual scrolling, search, syntax highlighting, download
   - Auto-refresh option for running steps
   - Fixed useCallback dependencies for proper log streaming

2. **AI Step Analysis** ✅:
   - Azure OpenAI integration for intelligent log analysis
   - Provides insights on failures, performance, and optimizations
   - Hybrid authentication: Service Principal (for Azure AD token) + API Key (for OpenAI)
   - Token refresh mechanism before API calls
   - Custom headers with Bearer token and user ID
   - Comprehensive error handling and logging
   - Test endpoint: GET /api/test-azure-openai for connection verification

3. **S3 Data Viewer** ✅ (NEW):
   - Browse S3 buckets by environment (UAT1/2/3) and type (RAW/REFINED)
   - Navigate folders with breadcrumb navigation
   - Preview parquet files (up to 500 rows, 100MB limit)
   - Download original parquet files
   - Export to CSV format (up to 100,000 rows)
   - Pagination for large directories
   - All columns displayed (no limiting)

## Recent Additions (SSM Service)

### Backend Enhancements
1. **Pagination**: Added page/limit query parameters with metadata response
2. **IAM Role Support**: Auto-detects ECS environment, uses IAM roles vs profiles
3. **CloudWatch Logging**: Dual logging (console + file), configurable LOG_LEVEL
4. **Werkzeug Compatibility**: Pinned to 2.3.7 for Flask 2.2.3 compatibility
5. **Request Logging**: Middleware logs all requests/responses

### Frontend Features
1. **Parameter Table**: Removed value column, clickable parameter names
2. **Parameter Details Modal**: JSON tree view with syntax highlighting
3. **Pagination Component**: Classic page numbers navigation
4. **Toast Notifications**: Success/error feedback with react-hot-toast
5. **Professional UI**: Consistent AWS color scheme, smooth transitions

### Critical Implementation Details
1. **Routing Conflict Resolution**: Changed `/parameters` to `/allparameters` for listing
2. **URL Encoding**: Preserves slashes in parameter paths
3. **JSON Validation**: All parameter values must be valid JSON
4. **React 18 Compatibility**: Using @uiw/react-json-view instead of react-json-view
5. **Relative URLs**: Frontend uses `/ssm-api` for API calls (no domain needed)
6. **ALB Path Patterns**: Each service has separate frontend and backend paths

## Adding New Services

When adding new AWS services (DynamoDB, S3, etc.), follow this pattern:

1. **Create Service Structure**:
   ```bash
   mkdir -p service-backend service-frontend/{client,server}
   ```

2. **Copy Template Files**:
   - Use SSM service as template (most recent and complete)
   - Update service-specific logic while maintaining patterns

3. **Key Patterns to Maintain**:
   - Flask backend with Waitress serving
   - Wheel packaging with Poetry/setuptools
   - React frontend with Tailwind CSS
   - Pagination and modal patterns
   - CloudWatch-compatible logging
   - IAM role support for ECS
   - Consistent error handling

4. **ALB Routing**:
   - Frontend path: `/service-name/*` (e.g., `/dynamodb/*`, `/s3/*`)
   - Backend API path: `/service-name-api/*` (e.g., `/dynamodb-api/*`, `/s3-api/*`)
   - Configure frontend to use relative URLs: `/service-name-api`
   - Update ECS service and target group configuration

5. **Shared Components**:
   - Reuse UI components (tables, modals, pagination)
   - Maintain consistent color scheme and styling
   - Use same toast notification patterns
   - Follow established API response formats

## Service Implementation Guide for S3 and DynamoDB

### S3 Service Requirements
```
s3-backend/
- List buckets with pagination
- List objects in bucket with prefix support
- Upload/download objects
- Delete objects
- Get object metadata
- Presigned URLs for secure downloads

s3-frontend/
- Bucket browser with folder navigation
- Object upload with drag-and-drop
- Object preview (images, text files)
- Batch operations
- Search within bucket
```

### DynamoDB Service Requirements
```
dynamodb-backend/
- List tables with pagination
- Describe table (schema, indexes, metrics)
- Query/Scan with filters
- Put/Update/Delete items
- Batch operations
- Export table data

dynamodb-frontend/
- Table browser with pagination
- Query builder UI
- Item editor with JSON validation
- Index selector
- Metrics dashboard
```

### Implementation Checklist for New Services

1. **Backend Setup**:
   - [ ] Create Flask app with URL prefix support
   - [ ] Add health check endpoint
   - [ ] Implement pagination for list operations
   - [ ] Add proper error handling and logging
   - [ ] Use boto3 with IAM role support
   - [ ] Create Makefile and Dockerfile

2. **Frontend Setup**:
   - [ ] Configure homepage in package.json
   - [ ] Update server routing for ALB
   - [ ] Create service API client
   - [ ] Implement main App.js with state management
   - [ ] Add search and filter functionality
   - [ ] Include loading states and error handling

3. **Common Patterns**:
   - [ ] Use modals for detailed views
   - [ ] Implement toast notifications
   - [ ] Add pagination component
   - [ ] Include refresh functionality
   - [ ] Persist user preferences in localStorage

4. **Testing Checklist**:
   - [ ] Test ALB routing locally
   - [ ] Verify pagination edge cases
   - [ ] Test error scenarios
   - [ ] Validate IAM permissions
   - [ ] Check responsive design
```

## Technical Implementation Details

### S3 Data Viewer Service

#### Key Implementation Decisions
1. **Removed Pandas**: Used pure PyArrow to avoid Docker build complexity
2. **CSV Export**: Replaced Excel export with CSV for simplicity
3. **Middleware Fix**: Fixed 415 error by checking content-type before parsing JSON

#### Backend Implementation
```python
# Fixed middleware pattern (avoid 415 errors)
@app.before_request
def log_request_info():
    if request.content_type and 'application/json' in request.content_type:
        try:
            body = request.get_json()
            # Process JSON body
        except Exception as e:
            app.logger.debug(f'Failed to parse request body: {str(e)}')
```

#### PyArrow Usage for Parquet
```python
# Read parquet without pandas
parquet_file = pq.ParquetFile(BytesIO(parquet_data))
table = parquet_file.read()
# Convert to list of dicts for JSON response
data = []
for i in range(len(table)):
    record = {col: table[col][i].as_py() for col in columns}
    data.append(record)
```

### Azure OpenAI Step Analysis Feature

#### Hybrid Authentication Implementation
1. **Authentication Flow**:
   - Service Principal + PEM → Azure AD token
   - Token used as Bearer auth header
   - API Key also required by OpenAI client

2. **Environment Variables** (in Dockerfile):
   ```dockerfile
   ENV AZURE_OPENAI_ENDPOINT=""
   ENV AZURE_OPENAI_API_KEY=""  # NEW: Required for hybrid auth
   ENV AZURE_OPENAI_API_VERSION="2024-02-15-preview"
   ENV AZURE_OPENAI_DEPLOYMENT_NAME=""
   ENV AZURE_TENANT_ID=""
   ENV AZURE_SPN_CLIENT_ID=""
   ENV AZURE_USER_ID="emr-manager"
   ```

3. **Token Refresh Pattern**:
   ```python
   def refresh_azure_token():
       token_response = credential.get_token("https://cognitiveservices.azure.com/.default")
       azure_openai_client.default_headers["Authorization"] = f"Bearer {token_response.token}"
   ```

### Common Middleware Patterns

All services use dual health endpoints:
```python
@app.route(f'{URL_PREFIX}/health', methods=['GET'])  # e.g., /api/health
@app.route('/health', methods=['GET'])  # For ECS/ALB
```

### Docker Build Optimization

1. **Simplified Dockerfile** (no pandas):
   ```dockerfile
   RUN chown -R jpmcnobody:jpmcnobody /app/ \
       && pip install --no-cache-dir /app/dist/*.whl waitress toml
   ```

2. **URL_PREFIX Configuration**:
   - Must be set in Dockerfile for production
   - Use `URL_PREFIX=""` for local testing

### Frontend Patterns

1. **useCallback Dependencies** (fixed in StepLogsModal):
   ```javascript
   const loadLogs = useCallback(async (refresh = false) => {
     // Implementation
   }, [logType, logFile, selectedContainer, applicationId, cluster.clusterId, step.id]);
   ```

2. **API Base URLs**:
   - EMR: `/api`
   - SSM: `/ssm-api`
   - S3 Data: `/s3data-api`
   - Copied to `/app/azure_cert.pem` with 600 permissions
   - Added to .gitignore for security

4. **Dependencies Added**:
   - `openai==1.35.3`
   - `azure-identity==1.16.0`

#### API Endpoint
- **URL**: `POST /api/clusters/{cluster_id}/steps/{step_id}/analyze`
- **Process**:
  1. Fetches step details from EMR API
  2. Retrieves stderr.gz for timeline information
  3. Finds driver container and fetches stdout.gz
  4. Extracts relevant sections based on step state
  5. Sends to Azure OpenAI with structured prompt
  6. Returns AI analysis

#### Frontend Implementation
1. **Analyze Button**: Added to Steps table (indigo color)
2. **StepAnalysisModal**: Displays AI analysis with:
   - Loading state during analysis
   - Step information header
   - Formatted AI response
   - Error handling

#### Logging for Troubleshooting
Key CloudWatch log messages:
- Initialization: `"Azure OpenAI integration enabled successfully..."`
- Analysis start: `"Starting analysis for step ... in cluster ..."`
- Data fetching: `"Retrieved stderr.gz, size: ... bytes"`
- API call: `"Calling Azure OpenAI for analysis with ... character prompt"`
- Completion: `"Azure OpenAI analysis completed, response length: ..."`
- Errors: Detailed error messages with stack traces

### Deployment Steps
1. Fill in environment variables in Dockerfile
2. Place PEM certificate file in emr-backend directory
3. Build Docker image: `docker build -t emr-backend .`
4. Deploy to ECS as usual

### Troubleshooting Guide

#### Common Issues and Solutions

1. **415 "Unsupported Media Type" Error**:
   - Cause: Middleware trying to parse JSON for all requests
   - Solution: Check content-type before accessing request.json
   - Debug: Added 415 error handler in S3 Data service

2. **Container Logs Not Streaming**:
   - Cause: Stale closures in useCallback
   - Solution: Add all dependencies to useCallback arrays
   - Check: loadLogs, loadMoreLogs callback dependencies

3. **Docker Build Failures** (pandas/gcc):
   - Cause: Missing build tools in base image
   - Solution: Remove pandas, use PyArrow only
   - Alternative: Use pre-built wheels

4. **Azure OpenAI Authentication Failures**:
   - Test with: GET /api/test-azure-openai
   - Check CloudWatch logs for detailed errors
   - Verify all 6 environment variables are set
   - Ensure PEM file has private key

5. **ALB Routing Issues**:
   - Backend URL_PREFIX must match ALB path
   - Frontend homepage must match ALB path
   - Test locally with URL_PREFIX=""

#### Debug Commands

```bash
# Test health endpoints locally
curl http://localhost:3700/health
curl http://localhost:3700/api/health

# Test with correct URL prefix
URL_PREFIX="" python app.py

# Check Azure OpenAI connection
curl https://your-alb-url/api/test-azure-openai

# View detailed logs
docker logs <container-id> 2>&1 | grep -E "ERROR|WARN|Azure"
```

### Session Summary

This session successfully:
1. Implemented complete S3 Data Viewer service
2. Fixed multiple deployment and runtime issues
3. Converted Azure OpenAI to hybrid authentication
4. Documented all patterns for future service development

The project now has three fully functional services (EMR, SSM, S3 Data) with consistent patterns that can be replicated for additional AWS services.

## AWS-XCESS Portal Implementation ✅

### Overview
AWS-XCESS is the unified portal interface that provides single-page access to all AWS services. Users no longer need multiple browser tabs - all services load within the portal using iframes.

### Architecture
```
+------------------------+--------------------------------+
|     AWS-XCESS         |                                |
|  ☁ (collapsible)      |                                |
|                        |                                |
| 🏠 Dashboard          |     Service Content Area       |
| ─────────────         |        (iframe)                |
| 📊 EMR Clusters       |                                |
| 📄 SSM Parameters     |   Loads: /emr, /parameters,    |
| 💾 S3 Data Viewer     |          /s3data               |
| 🔴 Databricks (WIP)   |                                |
| 💰 Cost Est. (WIP)    |                                |
|                        |                                |
| 🌙 Dark Mode          |                                |
+------------------------+--------------------------------+
```

### Key Features
1. **Collapsible Sidebar**: Save screen space with toggle button
2. **Dark Mode**: Toggle between light/dark themes
3. **Service Loading**: Smooth transitions with loading states
4. **Browser History**: Back/forward navigation works correctly
5. **Dashboard View**: Grid layout with service tiles and descriptions
6. **WIP Services**: Databricks and Cost Estimation show "Coming Soon" pages

### Implementation Details
- **Path**: Home frontend at `/` (root)
- **Routing**: `/services/{service-id}` loads service in iframe
- **State Management**: Active service persisted in URL
- **Iframe Paths**: 
  - EMR: `/emr`
  - SSM: `/parameters`
  - S3 Data: `/s3data/` (trailing slash required)

### Service Integration
Services work seamlessly within AWS-XCESS without modification. The portal handles:
- Loading states during service transitions
- Error boundaries for failed loads
- Proper iframe sizing and scrolling
- URL history management

### Future Enhancements
- Inter-frame communication for notifications
- Global search across services
- Service health indicators
- User preferences/favorites