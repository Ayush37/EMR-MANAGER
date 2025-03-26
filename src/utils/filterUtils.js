// src/utils/filterUtils.js

/**
 * Filters an array of clusters based on a search string
 * @param {Array} clusters Array of cluster objects
 * @param {string} searchTerm Search term to filter by
 * @param {Array<string>} fields Fields to search in (default: ['name'])
 * @returns {Array} Filtered array of clusters
 */
export const filterClusters = (clusters, searchTerm, fields = ['name']) => {
  if (!searchTerm || searchTerm.trim() === '') {
    return clusters;
  }

  const normalizedSearchTerm = searchTerm.toLowerCase().trim();
  
  return clusters.filter(cluster => {
    return fields.some(field => {
      const fieldValue = getNestedValue(cluster, field);
      if (typeof fieldValue === 'string') {
        return fieldValue.toLowerCase().includes(normalizedSearchTerm);
      }
      return false;
    });
  });
};

/**
 * Helper function to get nested object values using dot notation
 * @param {Object} obj The object to extract value from
 * @param {string} path The path in dot notation (e.g., 'user.address.city')
 * @returns {*} The value at the specified path
 */
export const getNestedValue = (obj, path) => {
  if (!obj || !path) return undefined;
  
  const keys = path.split('.');
  let value = obj;
  
  for (const key of keys) {
    if (value === null || value === undefined || typeof value !== 'object') {
      return undefined;
    }
    value = value[key];
  }
  
  return value;
};

/**
 * Creates a debounced function that delays invoking the provided function
 * @param {Function} func The function to debounce
 * @param {number} wait The delay in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (func, wait) => {
  let timeout;
  
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};
