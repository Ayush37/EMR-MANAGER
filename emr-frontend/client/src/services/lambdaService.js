// src/services/lambdaService.js

// Base URL for the Python backend API
const API_BASE_URL = 'http://localhost:5000';

/**
 * Terminates an EMR cluster by calling the Python backend API
 * @param {string} clusterName Name of the cluster to terminate
 * @returns {Promise<Object>} Operation response
 */
export const terminateCluster = async (clusterName) => {
  try {
    const response = await fetch(`${API_BASE_URL}/clusters/${clusterName}/terminate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to terminate cluster ${clusterName}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error terminating cluster ${clusterName}:`, error);
    throw error;
  }
};

/**
 * Creates a new EMR cluster by calling the Python backend API
 * @param {string} clusterName Name of the cluster to create
 * @returns {Promise<Object>} Operation response
 */
export const createCluster = async (clusterName) => {
  try {
    const response = await fetch(`${API_BASE_URL}/clusters/${clusterName}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to start cluster ${clusterName}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error creating cluster ${clusterName}:`, error);
    throw error;
  }
};
