// src/components/ClusterTable.jsx
import React, { useState } from 'react';
import StatusBadge from './StatusBadge';
import ClusterActions from './ClusterActions';

const ClusterTable = ({ clusters, onStartCluster, onTerminateCluster, operationInProgress }) => {
  const [selectedCluster, setSelectedCluster] = useState(null);

  // Format the date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Toggle row expansion for cluster details
  const toggleDetails = (clusterId) => {
    if (selectedCluster === clusterId) {
      setSelectedCluster(null);
    } else {
      setSelectedCluster(clusterId);
    }
  };

  if (clusters.length === 0) {
    return (
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:p-6 text-center text-gray-500">
          No clusters found matching your criteria.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-md">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cluster Name
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Modified
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Details
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {clusters.map((cluster) => (
              <React.Fragment key={cluster.name}>
                <tr className={`hover:bg-gray-50 ${selectedCluster === cluster.name ? 'bg-gray-50' : ''}`}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {cluster.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <StatusBadge status={cluster.state} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(cluster.lastModified)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button
                      onClick={() => toggleDetails(cluster.name)}
                      className="text-indigo-600 hover:text-indigo-900 focus:outline-none focus:underline"
                    >
                      {selectedCluster === cluster.name ? 'Hide Details' : 'View Details'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <ClusterActions
                      cluster={cluster}
                      onStart={onStartCluster}
                      onTerminate={onTerminateCluster}
                      disabled={operationInProgress}
                    />
                  </td>
                </tr>
                
                {/* Expanded details row */}
                {selectedCluster === cluster.name && (
                  <tr>
                    <td colSpan="5" className="px-6 py-4 bg-gray-50">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900 mb-2">Cluster Details</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {cluster.clusterId && (
                            <div>
                              <span className="text-gray-500">Cluster ID:</span> {cluster.clusterId}
                            </div>
                          )}
                          {cluster.timeline && cluster.timeline.CreationDateTime && (
                            <div>
                              <span className="text-gray-500">Created:</span> {formatDate(cluster.timeline.CreationDateTime)}
                            </div>
                          )}
                          {cluster.timeline && cluster.timeline.EndDateTime && (
                            <div>
                              <span className="text-gray-500">Ended:</span> {formatDate(cluster.timeline.EndDateTime)}
                            </div>
                          )}
                          {cluster.lastStateChangeReason && cluster.lastStateChangeReason.Message && (
                            <div className="col-span-2">
                              <span className="text-gray-500">State Change Reason:</span> {cluster.lastStateChangeReason.Message}
                            </div>
                          )}
                          {cluster.applications && cluster.applications.length > 0 && (
                            <div className="col-span-2">
                              <span className="text-gray-500">Applications:</span>{' '}
                              {cluster.applications.map(app => app.Name).join(', ')}
                            </div>
                          )}
                          <div className="col-span-2">
                            <span className="text-gray-500">Parameter Name:</span> {cluster.parameterName}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ClusterTable;
