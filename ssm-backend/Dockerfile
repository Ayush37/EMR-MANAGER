# Dockerfile

# Use the specified base image
FROM jetae-publish.prod.aws.jpmchase.net/container-base/managedbaseimages/python:3.13.3-stable

# URL to get source code for building the image (string)
LABEL org.opencontainers.image.source="https://${REPO_HOSTNAME}/projects/${PROJECT}/repos/${REPO}/browse?at=${COMMIT_HASH}"

# Source control revision identifier for the packaged software. Hash of the commit for this
LABEL org.opencontainers.image.revision="${COMMIT_HASH}"

# Human-readable title of the image (string)
LABEL org.opencontainers.image.title="ssm-parameter-manager"

# Add Application name and port to ENV
ENV APP_NAME="ssm-parameter-manager"
ENV PORT="3700"
ENV LOG_LEVEL="INFO"

# Set the working directory
WORKDIR /app

# Create logs directory
RUN mkdir -p /app/logs

# Install and run the app
COPY dist /app/dist
RUN chown -R jpmcnobody:jpmcnobody /app/ \
    && pip install /app/dist/*.whl waitress toml

# Expose the port
EXPOSE $PORT

# Start the application using waitress
CMD waitress-serve --host=0.0.0.0 --port=$PORT app:app