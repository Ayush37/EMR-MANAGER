const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// Serve static files from the React app build directory
// For ALB routing, we need to serve from /parameters path
app.use('/parameters', express.static(path.join(__dirname, '../client/build')));
app.use(express.static(path.join(__dirname, '../client/build')));

// Redirect /parameters to /parameters/ for proper routing
app.get('/parameters', (req, res) => {
  res.redirect('/parameters/');
});

// Health check endpoint for monitoring
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Handle any remaining requests by serving the React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: 'Something went wrong on the server',
    details: process.env.NODE_ENV !== 'production' ? err.message : undefined
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`SSM Frontend server running on port ${PORT}`);
});