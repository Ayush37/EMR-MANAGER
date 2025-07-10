# Build stage for React app
FROM node:16-alpine as build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Production stage
FROM docker.jpmchase.net/node:16-alpine
WORKDIR /app

# Copy server files
COPY server/package*.json ./
RUN npm ci --only=production
COPY server/index.js ./

# Copy built React app from build stage
COPY --from=build /app/client/build ./client/build

# Expose port
EXPOSE 8080

# Start the server
CMD ["node", "index.js"]