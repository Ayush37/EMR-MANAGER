// src/hooks/useClusters.js
import { useState, useEffect, useCallback } from 'react';
import { listClusters } from '../services/emrService';
import { createCluster, terminateCluster } from '../services/lambdaService';

const useClusters = () => {
  const [clusters, setClusters] = useState([]);
  const [filteredClusters, setFilteredClusters] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterText, setFilterText] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [operationInProgress, setOperationInProgress] = useState(false);
  const [lastOperationStatus, setLastOperationStatus] = useState(null);

  // Fetch all cluster data from the Python backend
  const fetchClusterData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      
      // Get clusters from the backend
      const clusterData = await listClusters();
      
      setClusters(clusterData);
      
      // Apply any existing filter
      if (filterText) {
        applyFilter(clusterData, filterText);
      } else {
        setFilteredClusters(clusterData);
      }
      
      setError(null);
    } catch (err) {
      console.error('Error fetching cluster data:', err);
      setError(`Failed to fetch cluster data: ${err.message}`);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [filterText]);

  // Apply filter to clusters
  const applyFilter = useCallback((clusterData, filter) => {
    const lowerCaseFilter = filter.toLowerCase();
    const filtered = clusterData.filter(cluster => 
      cluster.name.toLowerCase().includes(lowerCaseFilter)
    );
    setFilteredClusters(filtered);
  }, []);

  // Handle filter change
  const handleFilterChange = useCallback((text) => {
    setFilterText(text);
    applyFilter(clusters, text);
  }, [clusters, applyFilter]);

  // Start a cluster
  const handleStartCluster = useCallback(async (clusterName) => {
    try {
      setOperationInProgress(true);
      setLastOperationStatus({ type: 'start', status: 'pending', clusterName });
      
      const result = await createCluster(clusterName);
      
      // Refresh data to show updated status
      await fetchClusterData();
      
      setLastOperationStatus({ 
        type: 'start', 
        status: 'success', 
        clusterName,
        message: `Cluster ${clusterName} creation initiated successfully` 
      });
      
      return result;
    } catch (err) {
      console.error(`Error starting cluster ${clusterName}:`, err);
      setLastOperationStatus({ 
        type: 'start', 
        status: 'error', 
        clusterName,
        message: `Failed to start cluster: ${err.message}` 
      });
      throw err;
    } finally {
      setOperationInProgress(false);
    }
  }, [fetchClusterData]);

  // Terminate a cluster
  const handleTerminateCluster = useCallback(async (clusterName) => {
    try {
      setOperationInProgress(true);
      setLastOperationStatus({ type: 'terminate', status: 'pending', clusterName });
      
      const result = await terminateCluster(clusterName);
      
      // Refresh data to show updated status
      await fetchClusterData();
      
      setLastOperationStatus({ 
        type: 'terminate', 
        status: 'success', 
        clusterName,
        message: `Cluster ${clusterName} termination initiated successfully` 
      });
      
      return result;
    } catch (err) {
      console.error(`Error terminating cluster ${clusterName}:`, err);
      setLastOperationStatus({ 
        type: 'terminate', 
        status: 'error', 
        clusterName,
        message: `Failed to terminate cluster: ${err.message}` 
      });
      throw err;
    } finally {
      setOperationInProgress(false);
    }
  }, [fetchClusterData]);

  // Manual refresh trigger
  const refreshClusters = useCallback(() => {
    if (!isRefreshing) {
      fetchClusterData();
    }
  }, [fetchClusterData, isRefreshing]);

  // Initial data fetch
  useEffect(() => {
    fetchClusterData();
  }, [fetchClusterData]);

  // Set up auto-refresh interval
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (!operationInProgress) {
        fetchClusterData();
      }
    }, 5000); // Refresh every 5 seconds
    
    return () => clearInterval(intervalId);
  }, [fetchClusterData, operationInProgress]);

  return {
    clusters: filteredClusters,
    allClusters: clusters,
    isLoading,
    isRefreshing,
    error,
    filterText,
    handleFilterChange,
    refreshClusters,
    handleStartCluster,
    handleTerminateCluster,
    operationInProgress,
    lastOperationStatus
  };
};

export default useClusters;
