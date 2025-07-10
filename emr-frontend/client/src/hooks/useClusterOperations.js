// src/hooks/useClusterOperations.js
import { useState } from 'react';
import { createCluster, terminateCluster } from '../services/lambdaService';

/**
 * Custom hook for EMR cluster operations
 * @returns {Object} Cluster operation methods and state
 */
const useClusterOperations = () => {
  const [isOperationInProgress, setIsOperationInProgress] = useState(false);
  const [lastOperation, setLastOperation] = useState(null);
  const [operationError, setOperationError] = useState(null);

  /**
   * Start an EMR cluster
   * @param {string} clusterName Name of the cluster to start
   * @returns {Promise<Object>} Operation result
   */
  const startCluster = async (clusterName) => {
    try {
      setIsOperationInProgress(true);
      setOperationError(null);
      
      const result = await createCluster(clusterName);
      
      setLastOperation({
        type: 'start',
        clusterName,
        timestamp: new Date(),
        status: 'success'
      });
      
      return result;
    } catch (error) {
      setOperationError(error.message || 'Failed to start cluster');
      setLastOperation({
        type: 'start',
        clusterName,
        timestamp: new Date(),
        status: 'failed'
      });
      throw error;
    } finally {
      setIsOperationInProgress(false);
    }
  };

  /**
   * Terminate an EMR cluster
   * @param {string} clusterName Name of the cluster to terminate
   * @returns {Promise<Object>} Operation result
   */
  const stopCluster = async (clusterName) => {
    try {
      setIsOperationInProgress(true);
      setOperationError(null);
      
      const result = await terminateCluster(clusterName);
      
      setLastOperation({
        type: 'terminate',
        clusterName,
        timestamp: new Date(),
        status: 'success'
      });
      
      return result;
    } catch (error) {
      setOperationError(error.message || 'Failed to terminate cluster');
      setLastOperation({
        type: 'terminate',
        clusterName,
        timestamp: new Date(),
        status: 'failed'
      });
      throw error;
    } finally {
      setIsOperationInProgress(false);
    }
  };

  return {
    startCluster,
    stopCluster,
    isOperationInProgress,
    lastOperation,
    operationError,
    clearOperationError: () => setOperationError(null)
  };
};

export default useClusterOperations;
