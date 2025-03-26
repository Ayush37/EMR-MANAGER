// src/App.jsx
import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import ClusterFilter from './components/ClusterFilter';
import ClusterTable from './components/ClusterTable';
import Loading from './components/Loading';
import ErrorAlert from './components/ErrorAlert';
import useClusters from './hooks/useClusters';

const App = () => {
  const {
    clusters,
    allClusters,
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
  } = useClusters();

  const [operationMessage, setOperationMessage] = useState(null);

  // Show operation success/error messages
  useEffect(() => {
    if (lastOperationStatus && lastOperationStatus.message) {
      setOperationMessage({
        type: lastOperationStatus.status === 'success' ? 'success' : 'error',
        message: lastOperationStatus.message
      });
      
      // Auto clear after 5 seconds
      const timer = setTimeout(() => {
        setOperationMessage(null);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [lastOperationStatus]);

  return (
    <div className="min-h-screen bg-gray-100">
      <Header onRefresh={refreshClusters} isRefreshing={isRefreshing} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">EMR Clusters</h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage your Amazon EMR clusters. View status, start, or terminate clusters.
          </p>
        </div>
        
        {/* Error message */}
        {error && <ErrorAlert message={error} onDismiss={() => {}} />}
        
        {/* Operation success/error message */}
        {operationMessage && (
          <div className={`rounded-md ${operationMessage.type === 'success' ? 'bg-green-50' : 'bg-red-50'} p-4 mb-4 animate-fadeIn`}>
            <div className="flex">
              <div className="flex-shrink-0">
                {operationMessage.type === 'success' ? (
                  <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="ml-3">
                <p className={`text-sm font-medium ${operationMessage.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                  {operationMessage.message}
                </p>
              </div>
              <div className="ml-auto pl-3">
                <div className="-mx-1.5 -my-1.5">
                  <button
                    onClick={() => setOperationMessage(null)}
                    className={`inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                      operationMessage.type === 'success' 
                        ? 'bg-green-50 text-green-500 hover:bg-green-100 focus:ring-green-600' 
                        : 'bg-red-50 text-red-500 hover:bg-red-100 focus:ring-red-600'
                    }`}
                  >
                    <span className="sr-only">Dismiss</span>
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Filter */}
        <ClusterFilter
          value={filterText}
          onChange={handleFilterChange}
          total={allClusters.length}
          filtered={clusters.length}
        />
        
        {/* Clusters table */}
        {isLoading ? (
          <Loading />
        ) : (
          <ClusterTable
            clusters={clusters}
            onStartCluster={handleStartCluster}
            onTerminateCluster={handleTerminateCluster}
            operationInProgress={operationInProgress}
          />
        )}
      </main>
      
      {/* Footer */}
      <footer className="bg-white">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500">
            &copy; {new Date().getFullYear()} EMR Cluster Manager
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
