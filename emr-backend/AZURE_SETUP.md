# Azure OpenAI Setup Guide

## Security Warning
**NEVER commit credentials or the PEM certificate to version control!**

## Setup Steps

1. **Prepare your credentials:**
   - Azure OpenAI Endpoint URL
   - Azure OpenAI API Key
   - Azure OpenAI Deployment Name (e.g., "gpt-4o-2024-08-06")
   - Azure Tenant ID
   - Service Principal Client ID
   - PEM certificate file (contains private key)

2. **Prepare the Dockerfile:**
   ```bash
   # Copy the template
   cp Dockerfile.template Dockerfile
   
   # Edit Dockerfile and replace all placeholder values:
   # - AZURE_OPENAI_ENDPOINT
   # - AZURE_OPENAI_API_KEY
   # - AZURE_OPENAI_DEPLOYMENT_NAME
   # - AZURE_TENANT_ID
   # - AZURE_SPN_CLIENT_ID
   ```

3. **Add the PEM certificate:**
   ```bash
   # Copy your PEM certificate to the backend directory
   cp /path/to/your/azure_cert.pem ./azure_cert.pem
   ```

4. **Build the Docker image:**
   ```bash
   # Build the wheel package first
   make clean package
   
   # Build the Docker image
   docker build -t emr-backend .
   ```

5. **Security Checklist:**
   - [ ] Dockerfile contains actual credentials (not placeholders)
   - [ ] azure_cert.pem is in the same directory as Dockerfile
   - [ ] Both files are NOT committed to git
   - [ ] .gitignore includes emr-backend/Dockerfile (uncomment if needed)
   - [ ] Repository is private or credentials are managed separately

## Authentication Flow

1. Service Principal uses PEM certificate to authenticate with Azure AD
2. Azure AD returns an access token
3. Access token is used as Bearer token in Authorization header
4. OpenAI API key is also required for authentication
5. Both are sent with each API request

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| AZURE_OPENAI_ENDPOINT | Your Azure OpenAI resource endpoint | https://myresource.openai.azure.com/ |
| AZURE_OPENAI_API_KEY | OpenAI API key from Azure Portal | abc123... |
| AZURE_OPENAI_DEPLOYMENT_NAME | Model deployment name | gpt-4o-2024-08-06 |
| AZURE_TENANT_ID | Azure AD tenant ID | 12345678-1234-1234-1234-123456789012 |
| AZURE_SPN_CLIENT_ID | Service Principal client/app ID | 87654321-4321-4321-4321-210987654321 |
| AZURE_USER_ID | User identifier for headers | emr-manager |

## Troubleshooting

1. **"PEM certificate not found"**: Ensure azure_cert.pem is in the build context
2. **"Authentication failed"**: Verify Service Principal has correct permissions
3. **"Invalid token"**: Check tenant ID and client ID are correct
4. **"API key invalid"**: Verify the OpenAI API key from Azure Portal