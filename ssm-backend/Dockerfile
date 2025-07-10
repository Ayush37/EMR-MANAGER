FROM docker.jpmchase.net/python:3.9-slim

WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app.py .

# Create logs directory
RUN mkdir -p logs

# Expose port
EXPOSE 3700

# Run the application
CMD ["python", "app.py"]