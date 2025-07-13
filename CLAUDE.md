# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current Status (Last Updated: Session from Human)

### Working Features
- ✅ EMR cluster management with multi-environment support (UAT1/2/3)
- ✅ Advanced filtering: search across all clusters, multi-state filtering
- ✅ Step management: view, duplicate, cancel steps
- ✅ SSM parameter management with full CRUD
- ✅ Both services deployed to ECS with ALB routing
- ✅ IAM role-based authentication for ECS
- ✅ Health checks configured for ECS

### Recent Session Work
1. Removed auto-refresh functionality
2. Fixed environment filtering (backend-only now)
3. Added AWS EMR-style status filter in column header
4. Implemented backend search across all clusters
5. Fixed multiple deployment issues (dotenv, health checks, route parameters)
6. Removed Last Activity column from UI

### Next Steps
1. Implement step logs viewer (stdout/stderr from S3)
2. Add DynamoDB service following established patterns
3. Add S3 service with bucket/object management
4. Consider adding cluster creation functionality

### For Next Session
To continue work, reference:
- This CLAUDE.md file for project context
- Recent commits for latest changes
- The planned step logs feature design (see Planned Features section)
- Current deployment status on ECS

## Project Overview

EMR-MANAGER is a multi-service web application platform for managing various AWS services. Currently implemented:
1. **EMR Service**: Manage Amazon EMR (Elastic MapReduce) clusters with multi-environment support
2. **SSM Service**: Manage AWS Systems Manager Parameter Store with full CRUD operations

Future services planned: DynamoDB, S3, and other AWS services following the same architecture.

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

**Note**: The `.env` files are gitignored and should not be committed. In production, the URL_PREFIX defaults to the correct values for ALB routing.

## Deployment

The project uses Docker for containerization:
- Backend and frontend have separate Dockerfiles
- Images are based on enterprise JPMorgan Chase base images
- Backend runs on port 3700, frontend server on port 8080
- ECS deployment with ALB routing:
  - `/api/*` → EMR backend service
  - `/emr/*` → EMR frontend service
  - `/ssm-api/*` → SSM backend service
  - `/parameters/*` → SSM frontend service
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

### Recent Bug Fixes (Session Updates)
1. **Fixed Flask Route Parameters**: Changed `<n>` to `<name>` in cluster endpoints
2. **Added python-dotenv**: Added to pyproject.toml for Docker builds
3. **Health Check Fix**: Added `/health` endpoint for ECS health checks
4. **CORS Configuration**: Removed hardcoded origins for production deployment
5. **Environment Filtering**: Fixed client-side filtering that was overriding backend filters

### Planned Features (In Progress)
1. **Step Logs Viewer**: 
   - Backend endpoint to fetch stdout/stderr logs from S3
   - Challenge: Logs stored by YARN application ID, not step ID
   - Solution: Parse application ID from step details/state change reason
   - UI: Add "View Logs" button in step details modal
   - Features: Show logs by container, search, tail mode, download option

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