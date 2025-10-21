# Using Node Managed Base Image for React UI
FROM jetae-publish.prod.aws.jpmchase.net/container-base/managedbaseimages/nodejs:18.12.1-stable AS client-build

WORKDIR /usr/src/app

COPY ./client/ ./client/

# Access Permissions
RUN chown -R jpmcnobody:jpmcnobody /usr/src/app
RUN chmod 775 /usr/src/app
USER jpmcnobody

# Remove any existing package-lock.json to ensure clean install
RUN cd client && rm -f package-lock.json

# Build the react app to generate the build folder
RUN cd client && npm install && npm run build

# Using Node Managed Base Image for node server to serve the build folder from UI
FROM jetae-publish.prod.aws.jpmchase.net/container-base/managedbaseimages/nodejs:18.12.1-stable AS server-build

# Create app directory
WORKDIR /app

# Copy the UI build to the current context
COPY --from=client-build /usr/src/app/client/build ./client/build

# Copy the package to install the dependencies
COPY ./server/package.json ./server/

# Remove any existing package-lock.json to ensure clean install
RUN cd server && rm -f package-lock.json

# Install server side dependencies/packages
RUN cd server && npm install

# Copy the server file
COPY ./server/index.js ./server/

EXPOSE 8080

# Run the server
CMD ["node", "./server/index.js"]