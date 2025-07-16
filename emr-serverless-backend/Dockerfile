FROM artifactory.jpmchase.net/dxhub-docker/python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV LOG_LEVEL=INFO
ENV AWS_REGION=us-east-1
ENV USE_IAM_ROLE=true
ENV URL_PREFIX=/emr-serverless-api

# Create app directory
WORKDIR /app

# Copy application files
COPY pyproject.toml requirements.txt ./
COPY app.py __init__.py ./
COPY Makefile ./

# Create non-root user
RUN useradd -m -u 1000 jpmcnobody && \
    chown -R jpmcnobody:jpmcnobody /app

# Install dependencies and build wheel
RUN pip install --upgrade pip setuptools wheel build && \
    pip install -r requirements.txt && \
    python -m build

# Install the built wheel and waitress
RUN chown -R jpmcnobody:jpmcnobody /app/ \
    && pip install --no-cache-dir /app/dist/*.whl waitress toml

# Switch to non-root user
USER jpmcnobody

# Create logs directory
RUN mkdir -p /app/logs

# Expose port
EXPOSE 3700

# Health check
HEALTHCHECK --interval=30s --timeout=20s --start-period=120s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:3700/health').raise_for_status()" || exit 1

# Run the application
CMD ["waitress-serve", "--host=0.0.0.0", "--port=3700", "app:app"]