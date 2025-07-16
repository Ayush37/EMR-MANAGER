# Dockerfile

# Use the specified base image
FROM jetae-publish.prod.aws.jpmchase.net/container-base/managedbaseimages/python:3.13.3-stable

# URL to get source code for building the image (string)
LABEL org.opencontainers.image.source="https://${REPO_HOSTNAME}/projects/${PROJECT}/repos/${REPO}/browse?at=${COMMIT_HASH}"

# Source control revision identifier for the packaged software. Hash of the commit for this
LABEL org.opencontainers.image.revision="${COMMIT_HASH}"

# Human-readable title of the image (string)
LABEL org.opencontainers.image.title="s3data-viewer"

# Add Application name and port to ENV
ENV APP_NAME="s3data-viewer"
ENV PORT="3700"
ENV LOG_LEVEL="INFO"
ENV USE_IAM_ROLE="true"
ENV URL_PREFIX="/s3data-api"

# Azure OpenAI Configuration
ENV AZURE_OPENAI_ENDPOINT=""
ENV AZURE_OPENAI_API_KEY=""
ENV AZURE_OPENAI_API_VERSION="2024-02-15-preview"
ENV AZURE_OPENAI_DEPLOYMENT_NAME=""
ENV AZURE_TENANT_ID=""
ENV AZURE_SPN_CLIENT_ID=""
ENV AZURE_USER_ID="s3data-viewer"

# Set the working directory
WORKDIR /app

# Create logs directory
RUN mkdir -p /app/logs

# Copy Azure PEM certificate 
# IMPORTANT: Place your azure_cert.pem file in the same directory as this Dockerfile
# This file contains the private key for Service Principal authentication
# SECURITY WARNING: Do NOT commit this file or the Dockerfile with credentials to git
COPY azure_cert.pem /app/azure_cert.pem

# Install and run the app
# Note: No build tools needed since we removed pandas dependency
# PyArrow should install from pre-built wheels
COPY dist /app/dist
RUN chown -R jpmcnobody:jpmcnobody /app/ \
    && chmod 600 /app/azure_cert.pem || true \
    && pip install --no-cache-dir /app/dist/*.whl waitress toml

# Expose the port
EXPOSE $PORT

# Start the application using waitress
CMD waitress-serve --host=0.0.0.0 --port=$PORT app:app