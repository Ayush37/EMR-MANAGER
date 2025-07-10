# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EMR-MANAGER is a full-stack web application for managing Amazon EMR (Elastic MapReduce) clusters. It provides a user interface to monitor, start, and terminate EMR clusters through AWS services.

## Architecture

The project follows a three-tier architecture:

1. **Backend API** (`/emr-backend/`): Python Flask application providing REST endpoints
2. **Frontend UI** (`/emr-frontend/client/`): React application with Tailwind CSS
3. **Frontend Server** (`/emr-frontend/server/`): Express server for serving the React build

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

- `GET /clusters`: List all EMR clusters
- `GET /clusters/<name>`: Get specific cluster details
- `POST /clusters/<name>/start`: Start a cluster
- `POST /clusters/<name>/terminate`: Terminate a cluster

## Development Workflow

1. Backend changes require restarting the Flask server
2. Frontend changes hot-reload automatically in development
3. Always test AWS integration with proper credentials
4. Use `make lint` for backend code quality checks
5. Frontend uses ESLint through Create React App defaults

## Deployment

The project uses Docker for containerization:
- Backend and frontend have separate Dockerfiles
- Images are based on enterprise JPMorgan Chase base images
- Backend runs on port 3700, frontend server on port 8080