# EMR Cluster Manager

A modern React application for managing Amazon EMR clusters.

## Features

- List EMR clusters from AWS Parameter Store
- Display cluster status (RUNNING, WAITING, TERMINATED, etc.)
- Start and terminate clusters with a single click
- Auto-refresh cluster status every 5 seconds
- Filter clusters by name
- Detailed view for each cluster
- Responsive design that works on desktop and mobile
- Uses local AWS credentials

## Prerequisites

- Node.js 14.x or later
- AWS CLI configured with appropriate permissions
- AWS credentials set up locally

## Required AWS Permissions

The application requires the following AWS permissions:

- `ssm:GetParametersByPath` - To retrieve cluster configurations
- `emr:ListClusters` - To list all EMR clusters
- `emr:DescribeCluster` - To get detailed information about clusters
- `lambda:Invoke` - To invoke the "app-job-submit" lambda function

## Setup Instructions

1. Clone the repository:

```bash
git clone https://github.com/your-username/emr-cluster-manager.git
cd emr-cluster-manager
```

2. Install dependencies:

```bash
npm install
```

3. Make sure AWS credentials are configured on your machine:

```bash
aws configure
```

4. Start the development server:

```bash
npm start
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser to access the application.

## Configuration

By default, the application uses the AWS region specified in your AWS CLI configuration. If you need to use a different region, edit `src/services/awsConfig.js`.

## Build for Production

To build the application for production:

```bash
npm run build
```

This creates an optimized build in the `build` folder that can be deployed to a web server.

## Architecture

This application follows a modern React architecture:

- Uses React hooks for state management
- AWS SDK v3 for AWS service integration
- Tailwind CSS for styling
- Custom hooks for business logic
- Component-based structure for UI elements

The main data flow is:
1. Fetch configurations from Parameter Store
2. Get current cluster states from EMR API
3. Merge data to create a complete view
4. Use Lambda function for cluster operations

## Troubleshooting

- **AWS Credentials Issues**: Ensure your local AWS credentials have the necessary permissions listed above.
- **Cluster Not Showing**: Check that your cluster configuration follows the expected Parameter Store path pattern.
- **Operation Failures**: Check CloudWatch logs for the Lambda function to debug issues with cluster operations.

