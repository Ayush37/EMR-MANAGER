import React, { useState } from 'react';
import StatusBadge from './StatusBadge';
import ClusterStepsModal from './ClusterStepsModal';
import { formatDate, formatDuration } from '../utils/formatters';

const ClusterDetailsModal = ({ cluster, onClose }) => {
  const [showStepsModal, setShowStepsModal] = useState(false);

  if (!cluster) return null;

  const isActiveCluster = cluster.state === 'RUNNING' || cluster.state === 'WAITING';
  
  // Calculate cluster runtime
  const startTime = cluster.timeline?.creationDateTime;
  const endTime = cluster.timeline?.endDateTime || new Date().toISOString();
  const runtime = startTime ? formatDuration(startTime, endTime) : 'N/A';

  return (
    <>
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity z-40" onClick={onClose}></div>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl">
            {/* Header */}
            <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold leading-6 text-gray-900 mb-2">
                    Cluster Details: {cluster.name}
                  </h3>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {cluster.environment}
                    </span>
                    <StatusBadge status={cluster.state} />
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="ml-4 text-gray-400 hover:text-gray-500"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="px-4 pb-4 sm:px-6 sm:pb-4">
              <div className="space-y-4">
                {/* Basic Information */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Basic Information</h4>
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Cluster ID</dt>
                      <dd className="mt-1 text-sm text-gray-900 font-mono">
                        {cluster.clusterId || 'N/A'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Step Count</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {cluster.stepCount || 0} steps
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Created</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {formatDate(cluster.timeline?.creationDateTime) || 'N/A'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Runtime</dt>
                      <dd className="mt-1 text-sm text-gray-900">{runtime}</dd>
                    </div>
                  </dl>
                </div>

                {/* Timeline Information */}
                {cluster.timeline && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Timeline</h4>
                    <dl className="space-y-2">
                      {cluster.timeline.creationDateTime && (
                        <div className="flex justify-between text-sm">
                          <dt className="text-gray-500">Created:</dt>
                          <dd className="text-gray-900">
                            {formatDate(cluster.timeline.creationDateTime)}
                          </dd>
                        </div>
                      )}
                      {cluster.timeline.readyDateTime && (
                        <div className="flex justify-between text-sm">
                          <dt className="text-gray-500">Ready:</dt>
                          <dd className="text-gray-900">
                            {formatDate(cluster.timeline.readyDateTime)}
                          </dd>
                        </div>
                      )}
                      {cluster.timeline.endDateTime && (
                        <div className="flex justify-between text-sm">
                          <dt className="text-gray-500">Terminated:</dt>
                          <dd className="text-gray-900">
                            {formatDate(cluster.timeline.endDateTime)}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>
                )}

                {/* Applications */}
                {cluster.applications && cluster.applications.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Applications</h4>
                    <div className="flex flex-wrap gap-2">
                      {cluster.applications.map((app, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-800"
                        >
                          {app.Name} {app.Version && `(${app.Version})`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* State Change Reason */}
                {cluster.lastStateChangeReason && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Last State Change</h4>
                    <p className="text-sm text-gray-700">
                      {cluster.lastStateChangeReason.Message || 'No message available'}
                    </p>
                    {cluster.lastStateChangeReason.Code && (
                      <p className="text-xs text-gray-500 mt-1">
                        Code: {cluster.lastStateChangeReason.Code}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
              {isActiveCluster && (
                <button
                  type="button"
                  onClick={() => setShowStepsModal(true)}
                  className="inline-flex w-full justify-center rounded-md bg-aws-blue px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-aws-blue-dark sm:ml-3 sm:w-auto"
                >
                  View Steps
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Steps Modal */}
      {showStepsModal && (
        <ClusterStepsModal
          cluster={cluster}
          onClose={() => setShowStepsModal(false)}
        />
      )}
    </>
  );
};

export default ClusterDetailsModal;