// src/utils/clusterUtils.js

/**
 * Formats a cluster state for display
 * @param {string} state The raw cluster state
 * @returns {string} Formatted state for display
 */
export const formatClusterState = (state) => {
  if (!state) return 'UNKNOWN';
  
  // Map non-standard state names to standard ones if needed
  const stateMap = {
    'TERMINATED_WITH_ERRORS': 'FAILED',
    // Add more mappings as needed
  };
  
  return stateMap[state] || state;
};

/**
 * Determines if a cluster is in an active state
 * @param {string} state The cluster state
 * @returns {boolean} True if the cluster is active
 */
export const isClusterActive = (state) => {
  const activeStates = ['STARTING', 'BOOTSTRAPPING', 'RUNNING', 'WAITING'];
  return activeStates.includes(state);
};

/**
 * Groups clusters by their current state
 * @param {Array} clusters Array of cluster objects
 * @returns {Object} Object with state keys and arrays of clusters
 */
export const groupClustersByState = (clusters) => {
  return clusters.reduce((groups, cluster) => {
    const state = cluster.state || 'UNKNOWN';
    if (!groups[state]) {
      groups[state] = [];
    }
    groups[state].push(cluster);
    return groups;
  }, {});
};

/**
 * Calculates basic statistics about clusters
 * @param {Array} clusters Array of cluster objects
 * @returns {Object} Statistics object
 */
export const getClusterStats = (clusters) => {
  const stats = {
    total: clusters.length,
    byState: {}
  };
  
  // Count clusters by state
  clusters.forEach(cluster => {
    const state = cluster.state || 'UNKNOWN';
    stats.byState[state] = (stats.byState[state] || 0) + 1;
  });
  
  // Calculate percentages
  Object.keys(stats.byState).forEach(state => {
    stats.byState[state] = {
      count: stats.byState[state],
      percentage: (stats.byState[state] / stats.total * 100).toFixed(1)
    };
  });
  
  return stats;
};

/**
 * Formats a date for display
 * @param {string|Date} date Date to format
 * @returns {string} Formatted date string
 */
export const formatDate = (date) => {
  if (!date) return 'N/A';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return 'Invalid Date';
  }
  
  return dateObj.toLocaleString();
};
