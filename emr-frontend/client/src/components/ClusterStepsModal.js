import React, { useState, useEffect } from 'react';
import emrService from '../services/emrService';
import LoadingSpinner from './LoadingSpinner';
import StepDetailsModal from './StepDetailsModal';
import StepDuplicationModal from './StepDuplicationModal';
import StepLogsModal from './StepLogsModal';
import StepAnalysisModal from './StepAnalysisModal';
import Pagination from './Pagination';
import { formatDate } from '../utils/formatters';
import toast from 'react-hot-toast';

const ClusterStepsModal = ({ cluster, onClose }) => {
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStep, setSelectedStep] = useState(null);
  const [showStepDetails, setShowStepDetails] = useState(false);
  const [showDuplicationModal, setShowDuplicationModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    if (cluster && cluster.clusterId) {
      fetchSteps();
    }
  }, [cluster, currentPage]);

  const fetchSteps = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await emrService.getClusterSteps(cluster.clusterId, currentPage);
      
      if (response.steps) {
        setSteps(response.steps);
      }
      
      if (response.pagination) {
        setCurrentPage(response.pagination.page);
        setTotalPages(response.pagination.totalPages);
        setHasNext(response.pagination.hasNext);
        setHasPrev(response.pagination.hasPrev);
        setTotalCount(response.pagination.total);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch steps');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (step) => {
    setSelectedStep(step);
    setShowStepDetails(true);
  };

  const handleDuplicate = (step) => {
    setSelectedStep(step);
    setShowDuplicationModal(true);
  };

  const handleViewLogs = (step) => {
    setSelectedStep(step);
    setShowLogsModal(true);
  };

  const handleAnalyzeStep = (step) => {
    setSelectedStep(step);
    setShowAnalysisModal(true);
  };

  const handleCancelStep = async (step) => {
    if (!window.confirm('Are you sure you want to cancel this step?')) {
      return;
    }

    try {
      await emrService.cancelStep(cluster.clusterId, step.id);
      toast.success('Step cancellation initiated');
      fetchSteps(); // Refresh the list
    } catch (err) {
      toast.error(err.message || 'Failed to cancel step');
    }
  };

  const handleStepDuplicated = () => {
    setShowDuplicationModal(false);
    fetchSteps(); // Refresh the list
    toast.success('Step duplicated successfully');
  };

  const getStepStateColor = (state) => {
    const colors = {
      'PENDING': 'bg-yellow-100 text-yellow-800',
      'RUNNING': 'bg-blue-100 text-blue-800',
      'COMPLETED': 'bg-green-100 text-green-800',
      'CANCELLED': 'bg-gray-100 text-gray-800',
      'FAILED': 'bg-red-100 text-red-800',
      'INTERRUPTED': 'bg-orange-100 text-orange-800'
    };
    return colors[state] || 'bg-gray-100 text-gray-800';
  };

  return (
    <>
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity z-40" onClick={onClose}></div>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex items-end sm:items-center justify-center min-h-full p-4 text-center sm:p-0">
          <div className="relative bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:max-w-6xl sm:w-full">
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="sm:flex sm:items-start">
                <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    Steps for {cluster.name} ({cluster.environment})
                  </h3>
                  
                  {loading && (
                    <div className="flex justify-center py-8">
                      <LoadingSpinner />
                    </div>
                  )}

                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                      {error}
                    </div>
                  )}

                  {!loading && !error && (
                    <>
                      {steps.length === 0 ? (
                        <div className="text-center py-8">
                          <p className="text-gray-500">No steps found for this cluster.</p>
                        </div>
                      ) : (
                        <>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Step ID
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Name
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    State
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Created
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Duration
                                  </th>
                                  <th className="relative px-6 py-3">
                                    <span className="sr-only">Actions</span>
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {steps.map((step) => (
                                  <tr key={step.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                                      {step.id}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                      {step.name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStepStateColor(step.state)}`}>
                                        {step.state}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                      {formatDate(step.creationDateTime)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                      {step.startDateTime && step.endDateTime ? (
                                        <span>{calculateDuration(step.startDateTime, step.endDateTime)}</span>
                                      ) : step.startDateTime ? (
                                        <span>Running...</span>
                                      ) : (
                                        <span>-</span>
                                      )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                      <button
                                        onClick={() => handleViewDetails(step)}
                                        className="text-aws-blue hover:text-aws-blue-dark mr-3"
                                      >
                                        Details
                                      </button>
                                      {['COMPLETED', 'FAILED', 'RUNNING'].includes(step.state) && (
                                        <button
                                          onClick={() => handleViewLogs(step)}
                                          className="text-purple-600 hover:text-purple-900 mr-3"
                                        >
                                          Logs
                                        </button>
                                      )}
                                      <button
                                        onClick={() => handleAnalyzeStep(step)}
                                        className="text-indigo-600 hover:text-indigo-900 mr-3"
                                      >
                                        Analyze
                                      </button>
                                      <button
                                        onClick={() => handleDuplicate(step)}
                                        className="text-green-600 hover:text-green-900 mr-3"
                                      >
                                        Duplicate
                                      </button>
                                      {(step.state === 'PENDING' || step.state === 'RUNNING') && (
                                        <button
                                          onClick={() => handleCancelStep(step)}
                                          className="text-red-600 hover:text-red-900"
                                        >
                                          Cancel
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          
                          {totalPages > 1 && (
                            <div className="mt-4">
                              <Pagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                hasNext={hasNext}
                                hasPrev={hasPrev}
                                onPageChange={setCurrentPage}
                              />
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="button"
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-aws-blue sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      {showStepDetails && selectedStep && (
        <StepDetailsModal
          cluster={cluster}
          step={selectedStep}
          onClose={() => setShowStepDetails(false)}
        />
      )}

      {showDuplicationModal && selectedStep && (
        <StepDuplicationModal
          cluster={cluster}
          step={selectedStep}
          onClose={() => setShowDuplicationModal(false)}
          onSuccess={handleStepDuplicated}
        />
      )}

      {showLogsModal && selectedStep && (
        <StepLogsModal
          cluster={cluster}
          step={selectedStep}
          onClose={() => setShowLogsModal(false)}
        />
      )}

      {showAnalysisModal && selectedStep && (
        <StepAnalysisModal
          cluster={cluster}
          step={selectedStep}
          onClose={() => setShowAnalysisModal(false)}
        />
      )}
    </>
  );
};

// Helper function to calculate duration
function calculateDuration(start, end) {
  const startTime = new Date(start);
  const endTime = new Date(end);
  const duration = Math.floor((endTime - startTime) / 1000); // in seconds
  
  if (duration < 60) {
    return `${duration}s`;
  } else if (duration < 3600) {
    return `${Math.floor(duration / 60)}m ${duration % 60}s`;
  } else {
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
}

export default ClusterStepsModal;