// src/services/paramStoreService.js

// This service is now mostly a placeholder as the Python backend 
// handles Parameter Store interactions directly

// We'll keep this function for compatibility with existing code
// but it will actually just use the data already fetched by the EMR service
import { listClusters } from './emrService';

/**
 * Fetches all EMR cluster configurations from Parameter Store
 * This is now handled by the backend and returns data from the /clusters endpoint
 * @returns {Promise<Array>} List of cluster configurations
 */
export const fetchClusterConfigs = async () => {
  try {
    // The backend now returns all cluster data including configuration in one call
    const clusters = await listClusters();
    
    // Return only the configuration part for compatibility
    return clusters.map(cluster => ({
      name: cluster.name,
      config: cluster.config,
      parameterName: cluster.parameterName,
      lastModified: cluster.lastModified
    }));
  } catch (error) {
    console.error("Error fetching cluster configurations:", error);
    throw error;
  }
};
