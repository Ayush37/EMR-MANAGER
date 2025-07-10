// src/services/emrService.js

// Base URL for the Python backend API
const API_BASE_URL = 'http://localhost:5000';

/**
 * Fetches all clusters with their configurations and current states
 * @returns {Promise<Array>} List of clusters with their current state
 */
export const listClusters = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/clusters`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch clusters');
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error listing EMR clusters:", error);
    throw error;
  }
};

/**
 * Gets detailed information for a specific cluster
 * @param {string} clusterName Name of the cluster
 * @returns {Promise<Object>} Detailed cluster information
 */
export const getClusterDetails = async (clusterName) => {
  try {
    const response = await fetch(`${API_BASE_URL}/clusters/${clusterName}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to get details for cluster ${clusterName}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error getting details for cluster ${clusterName}:`, error);
    throw error;
  }
};

/**
 * This function is no longer needed as the backend handles the merging
 * Keeping it as a placeholder for compatibility with existing code
 */
export const mapClusterStates = (clusterConfigs, emrClusters) => {
  console.warn('mapClusterStates is deprecated as the backend now handles this');
  return clusterConfigs;
};
