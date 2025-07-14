# Dockerfile

# Use the specified base image
FROM jetae-publish.prod.aws.jpmchase.net/container-base/managedbaseimages/python:3.13.3-stable

# URL to get source code for building the image (string)
LABEL org.opencontainers.image.source="https://${REPO_HOSTNAME}/projects/${PROJECT}/repos/${REPO}/browse?at=${COMMIT_HASH}"

# Source control revision identifier for the packaged software. Hash of the commit for this
LABEL org.opencontainers.image.revision="${COMMIT_HASH}"

# Human-readable title of the image (string)
LABEL org.opencontainers.image.title="emr-cluster-manager"

# Add Application name and port to ENV
ENV APP_NAME="emr-cluster-manager"
ENV PORT="3700"
ENV URL_PREFIX=""

# Azure OpenAI Configuration - Service Principal Authentication
ENV AZURE_OPENAI_ENDPOINT=""
ENV AZURE_OPENAI_API_VERSION="2024-02-15-preview"
ENV AZURE_OPENAI_DEPLOYMENT_NAME=""
ENV AZURE_TENANT_ID=""
ENV AZURE_SPN_CLIENT_ID=""

# Set the working directory
WORKDIR /app

# Create logs directory
RUN mkdir -p /app/logs

# Copy Azure PEM certificate (place azure_cert.pem in the same directory as Dockerfile)
# This file should NOT be committed to git
# Using wildcard to make it optional - won't fail if file doesn't exist
COPY azure_cert.pe[m] /app/azure_cert.pem

# Install and run the app
COPY dist /app/dist
RUN chown -R jpmcnobody:jpmcnobody /app/ \
    && chmod 600 /app/azure_cert.pem \
    && pip install /app/dist/*.whl waitress toml

# Expose the port
EXPOSE $PORT

# Start the application using waitress
CMD waitress-serve --host=0.0.0.0 --port=$PORT app:app