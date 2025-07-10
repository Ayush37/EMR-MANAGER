# SSM Parameter Store Manager

A web application for managing AWS Systems Manager (SSM) Parameter Store parameters. This application provides a user-friendly interface to view, create, edit, and track the history of parameters stored in AWS SSM Parameter Store.

## Features

- **List Parameters**: View all parameters under the `/application` prefix
- **Search**: Filter parameters by name in real-time
- **Create Parameters**: Add new parameters with JSON validation
- **Edit Parameters**: Update existing parameter values with JSON validation
- **View History**: See the last 5 versions of any parameter with diff highlighting
- **Access Control**: Shows "Access Denied" for parameters without permissions
- **Auto-refresh**: Parameter list updates every 30 seconds
- **JSON Validation**: Ensures all parameter values are valid JSON

## Prerequisites

- Node.js 16 or higher
- npm or yarn
- Access to AWS SSM Parameter Store
- Backend API running (see ssm-backend)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Configure the backend API URL (optional):
```bash
export REACT_APP_API_URL=http://your-backend-url:3700
```

## Development

Start the development server:
```bash
npm start
```

The application will be available at `http://localhost:3000`

## Build

Create a production build:
```bash
npm run build
```

The build artifacts will be stored in the `build/` directory.

## Testing

Run the test suite:
```bash
npm test
```

## Architecture

This is a React 18 application using:
- **Tailwind CSS** for styling
- **Custom hooks** for business logic
- **Service layer** for API communication
- **Component-based architecture** for UI

### Key Components

- **ParameterTable**: Displays the list of parameters
- **ParameterEditor**: Modal for creating/editing parameters with JSON validation
- **ParameterHistory**: Shows version history with diffs
- **SearchBar**: Real-time filtering of parameters

### API Integration

The frontend communicates with a Flask backend API that handles all AWS operations. No AWS credentials are stored or used in the frontend.

## Security

- All AWS operations are performed server-side
- No AWS credentials in the frontend
- Input validation for parameter names and values
- JSON validation for all parameter values

## Deployment

The application is containerized and can be deployed using Docker. See the Dockerfile in the parent directory for container configuration.