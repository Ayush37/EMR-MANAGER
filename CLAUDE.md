# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EMR-MANAGER is a multi-service web application platform for managing various AWS services. Currently implemented:
1. **EMR Service**: Manage Amazon EMR (Elastic MapReduce) clusters
2. **SSM Service**: Manage AWS Systems Manager Parameter Store

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

- **AWS Profile**: The backend uses the hardcoded profile `adfsjit` in `app.py:39`
- **Parameter Store Path**: `/application/ecdp-config/uat1/EMR-BASE/`
- **Lambda Function**: `app-job-submit` for cluster operations
- **Required Permissions**: SSM Parameter Store read, EMR operations, Lambda invoke

## Important Implementation Notes

1. **No Direct AWS Access from Frontend**: All AWS operations are proxied through the Python backend for security
2. **Polling Mechanism**: Frontend polls backend every 5 seconds for cluster status updates
3. **Cluster Filtering**: Clusters with "STRESS" in their name are automatically filtered out
4. **Logging**: Backend implements file-based logging with rotation in the `logs/` directory
5. **CORS**: Backend has CORS enabled for frontend communication

## Code Organization

### Backend Structure
- `app.py`: Main Flask application with all endpoints
- `requirements.txt`: Python dependencies
- `Makefile`: Build and development commands
- `Dockerfile`: Container configuration

### Frontend Structure
- `/src/components/`: React components (ClusterTable, StatusBadge, etc.)
- `/src/hooks/`: Custom React hooks (useClusters, useClusterOperations)
- `/src/services/`: Backend API integration
- `/src/utils/`: Utility functions (formatters, filters)
- `/src/App.js`: Main application component

## API Endpoints

### EMR Service
- `GET /clusters`: List all EMR clusters
- `GET /clusters/<name>`: Get specific cluster details
- `POST /clusters/<name>/start`: Start a cluster
- `POST /clusters/<name>/terminate`: Terminate a cluster

### SSM Service
- `GET /allparameters`: List parameters with pagination (?page=1&limit=50)
- `GET /parameter/<path:name>`: Get specific parameter details
- `POST /parameters`: Create new parameter (JSON validation required)
- `PUT /parameter/<path:name>`: Update parameter value
- `GET /parameter/<path:name>/history`: Get parameter history (last 5 versions)

## Development Workflow

1. Backend changes require restarting the Flask server
2. Frontend changes hot-reload automatically in development
3. Always test AWS integration with proper credentials
4. Use `make lint` for backend code quality checks
5. Frontend uses ESLint through Create React App defaults
6. Build wheel packages with `make ci` for deployment

## Deployment

The project uses Docker for containerization:
- Backend and frontend have separate Dockerfiles
- Images are based on enterprise JPMorgan Chase base images
- Backend runs on port 3700, frontend server on port 8080
- ECS deployment with ALB routing:
  - `/emr/*` → EMR service
  - `/parameters/*` → SSM service

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
   - Define new path prefix (e.g., `/dynamodb/*`, `/s3/*`)
   - Update ECS service and target group configuration

5. **Shared Components**:
   - Reuse UI components (tables, modals, pagination)
   - Maintain consistent color scheme and styling
   - Use same toast notification patterns
   - Follow established API response formats