# Dockerfile

# Use the specified base image
FROM jetae-publish.prod.aws.jpmchase.net/container-base/managedbaseimages/python:3.13.3-stable

# URL to get source code for building the image (string)
LABEL org.opencontainers.image.source="https://${REPO_HOSTNAME}/projects/${PROJECT}/repos/${REPO}/browse?at=${COMMIT_HASH}"

# Source control revision identifier for the packaged software. Hash of the commit for this
LABEL org.opencontainers.image.revision="${COMMIT_HASH}"

# Human-readable title of the image (string)
LABEL org.opencontainers.image.title="emr-serverless-viewer"

# Add Application name and port to ENV
ENV APP_NAME="emr-serverless-viewer"
ENV PORT="3700"
ENV LOG_LEVEL="INFO"
ENV USE_IAM_ROLE="true"
ENV AWS_REGION="us-east-1"
ENV URL_PREFIX="/emr-serverless-api"

# Set the working directory
WORKDIR /app

# Create logs directory
RUN mkdir -p /app/logs

# Install and run the app
COPY dist /app/dist
RUN chown -R jpmcnobody:jpmcnobody /app/ \
    && pip install /app/dist/*.whl waitress toml

# Switch to non-root user
USER jpmcnobody

# Expose the application port
EXPOSE 3700

# Health check
HEALTHCHECK --interval=30s --timeout=20s --start-period=120s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:3700/health').raise_for_status()" || exit 1

# Command to run the application
CMD ["waitress-serve", "--host=0.0.0.0", "--port=3700", "app:app"]