# AWS Services Portal - Home

This is the landing page for the AWS Services Portal, providing a unified entry point to all deployed services.

## Services Available

- **EMR Clusters** - Manage Amazon EMR clusters across multiple environments
- **SSM Parameters** - Browse and manage AWS Systems Manager Parameter Store
- **S3 Data Viewer** - Browse S3 buckets and view parquet files

## Development

### Frontend Development
```bash
cd client
npm install
npm start
```

The app will run on http://localhost:3000

### Server Development
```bash
cd server
npm install
npm start
```

The server will run on http://localhost:8080

## Production Build

```bash
# Build React app
cd client
npm install
npm run build

# Run server
cd ../server
npm install
npm start
```

## Docker Build

```bash
docker build -t aws-services-home .
docker run -p 8080:8080 aws-services-home
```

## Deployment

The service is configured to be deployed at the root path. For ALB configuration:
- Use Host Header rule: `Host: accessaws-uat.prod.aws.jpmchase.net`
- Route to Home frontend service (port 8080)
- Other services should use path-based routing:
  - `/emr/*` → EMR frontend service
  - `/parameters/*` → SSM frontend service  
  - `/s3data/*` → S3 Data frontend service
  - `/api/*` → EMR backend service
  - `/ssm-api/*` → SSM backend service
  - `/s3data-api/*` → S3 Data backend service

## Environment Variables

No environment variables are required for this service as it only provides navigation to other services.