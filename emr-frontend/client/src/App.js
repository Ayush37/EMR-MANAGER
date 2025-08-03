import React, { useState, useEffect, useCallback } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import ClusterTable from './components/ClusterTable';
import ClusterDetailsModal from './components/ClusterDetailsModal';
import ClusterStepsModal from './components/ClusterStepsModal';
import SearchBar from './components/SearchBar';
import EnvironmentFilter from './components/EnvironmentFilter';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorMessage from './components/ErrorMessage';
import Pagination from './components/Pagination';
import emrService from './services/emrService';

function App() {
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStates, setSelectedStates] = useState([]);
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showStepsModal, setShowStepsModal] = useState(false);
  const [loadingClusterForSteps, setLoadingClusterForSteps] = useState(false);
  
  // Environment filter with localStorage persistence
  const [environment, setEnvironment] = useState(() => {
    return localStorage.getItem('emr-environment') || 'all';
  });
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const fetchClusters = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const response = await emrService.listClusters(page, 20, environment, searchTerm, selectedStates);
      
      if (response.clusters) {
        setClusters(response.clusters);
      }
      
      if (response.pagination) {
        setCurrentPage(response.pagination.page);
        setTotalPages(response.pagination.totalPages);
        setHasNext(response.pagination.hasNext);
        setHasPrev(response.pagination.hasPrev);
        setTotalCount(response.pagination.total);
      }
    } catch (err) {
      setError(err.message);
      toast.error('Failed to load clusters');
    } finally {
      setLoading(false);
    }
  }, [environment, searchTerm, selectedStates]);

  useEffect(() => {
    setCurrentPage(1); // Reset to first page when filters change
    fetchClusters(1);
  }, [environment, searchTerm, selectedStates]);
  
  useEffect(() => {
    fetchClusters(currentPage);
  }, [currentPage, fetchClusters]);

  // Persist environment selection
  useEffect(() => {
    localStorage.setItem('emr-environment', environment);
  }, [environment]);

  // Handle URL parameters for direct access to steps modal
  useEffect(() => {
    const checkUrlParams = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const clusterName = urlParams.get('cluster');
      const envParam = urlParams.get('env');
      const modal = urlParams.get('modal');

      if (clusterName && envParam && modal === 'steps') {
        // Load cluster data and open steps modal
        if (!showStepsModal) {
          handleUrlBasedStepsModal(clusterName, envParam);
        }
      } else {
        // URL params removed, close modal if open
        if (showStepsModal) {
          setShowStepsModal(false);
          setSelectedCluster(null);
        }
      }
    };

    checkUrlParams();

    // Listen for browser back/forward
    const handlePopState = () => {
      checkUrlParams();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [showStepsModal]); // Re-run when modal state changes

  const handleUrlBasedStepsModal = async (clusterName, env) => {
    try {
      setLoadingClusterForSteps(true);
      // Fetch cluster details
      const clusterData = await emrService.getCluster(clusterName, env);
      if (clusterData) {
        setSelectedCluster(clusterData);
        setShowStepsModal(true);
      } else {
        toast.error(`Cluster ${clusterName} not found in ${env}`);
      }
    } catch (err) {
      console.error('Error loading cluster for steps modal:', err);
      toast.error(`Failed to load cluster ${clusterName}`);
    } finally {
      setLoadingClusterForSteps(false);
    }
  };

  // All filtering is done by backend now
  const filteredClusters = clusters;

  const handleClusterClick = (cluster) => {
    setSelectedCluster(cluster);
    setShowDetailsModal(true);
  };

  const handleStartCluster = async (cluster) => {
    if (!window.confirm(`Are you sure you want to start cluster ${cluster.name}?`)) {
      return;
    }

    try {
      await emrService.startCluster(cluster.name, cluster.environment.toLowerCase());
      toast.success(`Cluster ${cluster.name} start initiated`);
      // Refresh the list after a short delay
      setTimeout(() => fetchClusters(currentPage), 2000);
    } catch (err) {
      toast.error(err.message || 'Failed to start cluster');
    }
  };

  const handleTerminateCluster = async (cluster) => {
    if (!window.confirm(`Are you sure you want to terminate cluster ${cluster.name}?`)) {
      return;
    }

    try {
      await emrService.terminateCluster(cluster.name, cluster.environment.toLowerCase());
      toast.success(`Cluster ${cluster.name} termination initiated`);
      // Refresh the list after a short delay
      setTimeout(() => fetchClusters(currentPage), 2000);
    } catch (err) {
      toast.error(err.message || 'Failed to terminate cluster');
    }
  };

  const handleEnvironmentChange = (newEnvironment) => {
    setEnvironment(newEnvironment);
  };
  
  const handleSearchChange = (value) => {
    setSearchTerm(value);
  };
  
  const handleStatesChange = (states) => {
    setSelectedStates(states);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <h1 className="text-3xl font-bold text-gray-900">
              EMR Cluster Manager
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage and monitor your EMR clusters across environments
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Controls */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <SearchBar value={searchTerm} onChange={handleSearchChange} />
            </div>
            <div className="w-full sm:w-64">
              <EnvironmentFilter value={environment} onChange={handleEnvironmentChange} />
            </div>
          </div>
          
          {/* Active Filters */}
          {selectedStates.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm text-gray-600">Active filters:</span>
              {selectedStates.map(state => (
                <span
                  key={state}
                  className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                >
                  Status: {state}
                  <button
                    onClick={() => handleStatesChange(selectedStates.filter(s => s !== state))}
                    className="ml-2 text-gray-500 hover:text-gray-700"
                  >
                    ×
                  </button>
                </span>
              ))}
              <button
                onClick={() => handleStatesChange([])}
                className="text-xs text-aws-blue hover:text-aws-blue-dark"
              >
                Clear all
              </button>
            </div>
          )}
          
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-700">
              Showing <span className="font-medium">{filteredClusters.length}</span> of{' '}
              <span className="font-medium">{totalCount}</span> clusters
            </p>
            <button
              onClick={() => fetchClusters(currentPage)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-aws-blue"
            >
              <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && <ErrorMessage message={error} />}

        {/* Cluster Table */}
        <ClusterTable
          clusters={filteredClusters}
          allClusters={clusters}
          selectedStates={selectedStates}
          onStatesChange={handleStatesChange}
          onClusterClick={handleClusterClick}
          onStart={handleStartCluster}
          onTerminate={handleTerminateCluster}
          loading={loading}
        />

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="mt-6">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              hasNext={hasNext}
              hasPrev={hasPrev}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* Cluster Details Modal */}
      {showDetailsModal && selectedCluster && (
        <ClusterDetailsModal
          cluster={selectedCluster}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedCluster(null);
          }}
        />
      )}

      {/* Direct Steps Modal (accessed via URL) */}
      {showStepsModal && selectedCluster && (
        <ClusterStepsModal
          cluster={selectedCluster}
          onClose={() => {
            setShowStepsModal(false);
            setSelectedCluster(null);
            // Clean up URL parameters
            const params = new URLSearchParams(window.location.search);
            params.delete('cluster');
            params.delete('env');
            params.delete('modal');
            const newUrl = params.toString() ? `${window.location.pathname}?${params}` : window.location.pathname;
            window.history.replaceState({}, '', newUrl);
          }}
        />
      )}

      {/* Loading spinner for URL-based cluster loading */}
      {loadingClusterForSteps && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-xl">
            <LoadingSpinner />
            <p className="mt-4 text-gray-600">Loading cluster information...</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;