import React from 'react';
import { formatDate } from '../utils/formatters';

const ParameterTable = ({ parameters, onEdit, onViewHistory }) => {
  const getValuePreview = (value) => {
    if (value === 'Access Denied') {
      return <span className="text-red-600 italic">{value}</span>;
    }
    if (value === 'Error retrieving value') {
      return <span className="text-yellow-600 italic">{value}</span>;
    }
    
    try {
      const parsed = JSON.parse(value);
      const preview = JSON.stringify(parsed);
      if (preview.length > 50) {
        return preview.substring(0, 50) + '...';
      }
      return preview;
    } catch {
      return value.length > 50 ? value.substring(0, 50) + '...' : value;
    }
  };

  if (parameters.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-6 text-center">
        <p className="text-gray-500">No parameters found</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Name
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Value
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Last Modified
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Modified By
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Version
            </th>
            <th className="relative px-6 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {parameters.map((parameter) => (
            <tr key={parameter.name} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">
                  {parameter.name}
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm text-gray-900 font-mono">
                  {getValuePreview(parameter.value)}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900">
                  {formatDate(parameter.lastModified)}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900">
                  {parameter.lastModifiedBy}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900">
                  v{parameter.version}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button
                  onClick={() => onEdit(parameter)}
                  className="text-aws-blue hover:text-blue-900 mr-4"
                  disabled={parameter.value === 'Access Denied'}
                >
                  Edit
                </button>
                <button
                  onClick={() => onViewHistory(parameter)}
                  className="text-gray-600 hover:text-gray-900"
                >
                  History
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ParameterTable;