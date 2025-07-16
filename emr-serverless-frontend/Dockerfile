# Multi-stage build for EMR Serverless frontend

# Stage 1: Build the React app
FROM artifactory.jpmchase.net/dxhub-docker/node:18-alpine AS build

WORKDIR /app

# Copy package files
COPY client/package*.json ./client/

# Install dependencies
WORKDIR /app/client
RUN npm ci --only=production

# Copy client source code
COPY client/ ./

# Build the React app
RUN npm run build

# Stage 2: Production server
FROM artifactory.jpmchase.net/dxhub-docker/node:18-alpine

# Create non-root user
RUN adduser -D -u 1000 jpmcnobody

WORKDIR /app

# Copy server package files
COPY server/package*.json ./server/

# Install server dependencies
WORKDIR /app/server
RUN npm ci --only=production

# Copy server code
COPY server/ ./

# Copy built React app from build stage
COPY --from=build /app/client/build /app/client/build

# Change ownership
RUN chown -R jpmcnobody:jpmcnobody /app

# Switch to non-root user
USER jpmcnobody

# Expose port
EXPOSE 8080

# Start the server
CMD ["node", "index.js"]