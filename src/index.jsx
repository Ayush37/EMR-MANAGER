// src/index.jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

// Make sure DOM is loaded before trying to access elements
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('root');
  
  // Check if the container exists
  if (!container) {
    console.error('Could not find root element!');
    return;
  }
  
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
