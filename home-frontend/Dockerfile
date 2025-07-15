# Build stage for React app
FROM dockerhub.jpmchase.net/node:20 as build

WORKDIR /app/client

# Copy package files
COPY client/package*.json ./
RUN npm ci

# Copy source code
COPY client/ ./

# Build the React app
RUN npm run build

# Production stage
FROM dockerhub.jpmchase.net/node:20-alpine

WORKDIR /app

# Copy server package files
COPY server/package*.json ./server/
RUN cd server && npm ci --only=production

# Copy server code
COPY server/ ./server/

# Copy built React app from build stage
COPY --from=build /app/client/build ./client/build

# Set working directory to server
WORKDIR /app/server

# Expose port
EXPOSE 8080

# Start the Express server
CMD ["npm", "start"]