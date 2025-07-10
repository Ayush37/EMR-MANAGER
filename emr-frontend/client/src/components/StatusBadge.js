import React from 'react';

const StatusBadge = ({ status }) => {
  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case 'STARTING':
        return 'bg-yellow-100 text-yellow-800';
      case 'BOOTSTRAPPING':
        return 'bg-blue-100 text-blue-800';
      case 'RUNNING':
      case 'WAITING':
        return 'bg-green-100 text-green-800';
      case 'TERMINATING':
        return 'bg-orange-100 text-orange-800';
      case 'TERMINATED':
        return 'bg-gray-100 text-gray-800';
      case 'TERMINATED_WITH_ERRORS':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
      {status}
    </span>
  );
};

export default StatusBadge;