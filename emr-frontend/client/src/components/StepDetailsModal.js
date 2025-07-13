import React, { useState, useEffect } from 'react';
import JsonView from '@uiw/react-json-view';
import emrService from '../services/emrService';
import LoadingSpinner from './LoadingSpinner';
import StepLogsModal from './StepLogsModal';
import { formatDate } from '../utils/formatters';

const StepDetailsModal = ({ cluster, step, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stepDetails, setStepDetails] = useState(null);
  const [showLogsModal, setShowLogsModal] = useState(false);

  useEffect(() => {
    fetchStepDetails();
  }, [cluster, step]);

  const fetchStepDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await emrService.getStepDetails(cluster.clusterId, step.id);
      setStepDetails(response.step);
    } catch (err) {
      setError(err.message || 'Failed to fetch step details');
    } finally {
      setLoading(false);
    }
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
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity z-50" onClick={onClose}></div>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex items-end sm:items-center justify-center min-h-full p-4 text-center sm:p-0">
          <div className="relative bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:max-w-4xl sm:w-full">
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="sm:flex sm:items-start">
                <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    Step Details
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

                  {!loading && !error && stepDetails && (
                    <div className="space-y-4">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium text-gray-500">Step ID</p>
                            <p className="mt-1 text-sm text-gray-900 font-mono">{stepDetails.id}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-500">Name</p>
                            <p className="mt-1 text-sm text-gray-900">{stepDetails.name}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-500">State</p>
                            <span className={`mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStepStateColor(stepDetails.state)}`}>
                              {stepDetails.state}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-500">Action on Failure</p>
                            <p className="mt-1 text-sm text-gray-900">{stepDetails.actionOnFailure}</p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Timeline</h4>
                        <div className="space-y-2">
                          {stepDetails.timeline?.creationDateTime && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-500">Created:</span>
                              <span className="text-sm text-gray-900">{formatDate(stepDetails.timeline.creationDateTime)}</span>
                            </div>
                          )}
                          {stepDetails.timeline?.startDateTime && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-500">Started:</span>
                              <span className="text-sm text-gray-900">{formatDate(stepDetails.timeline.startDateTime)}</span>
                            </div>
                          )}
                          {stepDetails.timeline?.endDateTime && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-500">Ended:</span>
                              <span className="text-sm text-gray-900">{formatDate(stepDetails.timeline.endDateTime)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {stepDetails.stateChangeReason && Object.keys(stepDetails.stateChangeReason).length > 0 && (
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <h4 className="text-sm font-medium text-gray-700 mb-2">State Change Reason</h4>
                          <JsonView
                            value={stepDetails.stateChangeReason}
                            displayDataTypes={false}
                            displayObjectSize={false}
                            collapsed={1}
                          />
                        </div>
                      )}

                      {stepDetails.failureDetails && Object.keys(stepDetails.failureDetails).length > 0 && (
                        <div className="bg-red-50 p-4 rounded-lg">
                          <h4 className="text-sm font-medium text-red-700 mb-2">Failure Details</h4>
                          <JsonView
                            value={stepDetails.failureDetails}
                            displayDataTypes={false}
                            displayObjectSize={false}
                            collapsed={1}
                          />
                        </div>
                      )}

                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Configuration</h4>
                        <div className="bg-gray-900 p-4 rounded-lg overflow-auto max-h-96">
                          <JsonView
                            value={stepDetails.config}
                            displayDataTypes={false}
                            displayObjectSize={false}
                            collapsed={2}
                            style={{ backgroundColor: 'transparent' }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              {stepDetails && ['COMPLETED', 'FAILED', 'RUNNING'].includes(stepDetails.state) && (
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-aws-blue text-base font-medium text-white hover:bg-aws-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-aws-blue sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setShowLogsModal(true)}
                >
                  View Logs
                </button>
              )}
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

      {/* Step Logs Modal */}
      {showLogsModal && stepDetails && (
        <StepLogsModal
          cluster={cluster}
          step={stepDetails}
          onClose={() => setShowLogsModal(false)}
        />
      )}
    </>
  );
};

export default StepDetailsModal;