import React from 'react';
import StatusBadge from './StatusBadge';
import StatusFilter from './StatusFilter';
import { formatDate } from '../utils/formatters';

const ClusterTable = ({ clusters, allClusters, selectedStates, onStatesChange, onClusterClick, onStart, onTerminate, loading }) => {
  if (loading) {
    return (
      <div className="bg-white shadow-sm rounded-lg p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-aws-blue mx-auto"></div>
        <p className="mt-4 text-gray-500">Loading clusters...</p>
      </div>
    );
  }

  if (clusters.length === 0) {
    return (
      <div className="bg-white shadow-sm rounded-lg p-8 text-center">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No clusters found</h3>
        <p className="mt-1 text-sm text-gray-500">
          No EMR clusters found in the selected environment.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-sm rounded-lg overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Cluster Name
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Environment
            </th>
            <th scope="col" className="px-6 py-3 text-left">
              <StatusFilter 
                selectedStates={selectedStates}
                onStatesChange={onStatesChange}
                clusters={allClusters || clusters}
              />
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Step Count
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Created
            </th>
            <th scope="col" className="relative px-6 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {clusters.map((cluster) => (
            <tr key={`${cluster.environment}-${cluster.name}`} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <button
                  onClick={() => onClusterClick(cluster)}
                  className="text-aws-blue hover:text-aws-blue-dark font-medium"
                >
                  {cluster.name}
                </button>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {cluster.environment}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <StatusBadge status={cluster.state} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {cluster.stepCount || 0}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {formatDate(cluster.timeline?.creationDateTime)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                {cluster.state === 'TERMINATED' ? (
                  <button
                    onClick={() => onStart(cluster)}
                    className="text-green-600 hover:text-green-900 mr-4"
                  >
                    Start
                  </button>
                ) : cluster.state === 'WAITING' || cluster.state === 'RUNNING' ? (
                  <button
                    onClick={() => onTerminate(cluster)}
                    className="text-red-600 hover:text-red-900 mr-4"
                  >
                    Terminate
                  </button>
                ) : (
                  <span className="text-gray-400 mr-4">
                    {cluster.state}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ClusterTable;