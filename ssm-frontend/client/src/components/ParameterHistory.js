import React, { useState, useEffect } from 'react';
import ssmService from '../services/ssmService';
import LoadingSpinner from './LoadingSpinner';
import { formatDate, formatJSON } from '../utils/formatters';

const ParameterHistory = ({ parameterName, onClose }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedVersions, setSelectedVersions] = useState([]);

  useEffect(() => {
    fetchHistory();
  }, [parameterName]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await ssmService.getParameterHistory(parameterName);
      setHistory(response.history || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderDiff = (diff) => {
    if (!diff) return null;
    
    if (diff.note) {
      return <span className="text-gray-500 italic">{diff.note}</span>;
    }

    const changes = [];
    
    if (diff.added && diff.added.length > 0) {
      changes.push(
        <span key="added" className="text-green-600">
          Added: {diff.added.join(', ')}
        </span>
      );
    }
    
    if (diff.removed && diff.removed.length > 0) {
      changes.push(
        <span key="removed" className="text-red-600">
          Removed: {diff.removed.join(', ')}
        </span>
      );
    }
    
    if (diff.changed && diff.changed.length > 0) {
      changes.push(
        <span key="changed" className="text-yellow-600">
          Changed: {diff.changed.join(', ')}
        </span>
      );
    }

    return (
      <div className="space-y-1">
        {changes.map((change, index) => (
          <div key={index}>{change}</div>
        ))}
      </div>
    );
  };

  const toggleVersion = (version) => {
    setSelectedVersions(prev => {
      if (prev.includes(version)) {
        return prev.filter(v => v !== version);
      }
      return [...prev, version];
    });
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Parameter History</h3>
            <p className="text-sm text-gray-500 mt-1">{parameterName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {loading ? (
            <LoadingSpinner />
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          ) : history.length === 0 ? (
            <p className="text-gray-500 text-center">No history available</p>
          ) : (
            <div className="space-y-4">
              {history.map((item, index) => (
                <div key={item.version} className="border border-gray-200 rounded-lg">
                  <div
                    className="px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100"
                    onClick={() => toggleVersion(item.version)}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-4">
                        <span className="font-medium text-gray-900">
                          Version {item.version}
                        </span>
                        <span className="text-sm text-gray-500">
                          {formatDate(item.lastModified)}
                        </span>
                        <span className="text-sm text-gray-500">
                          by {item.lastModifiedBy}
                        </span>
                      </div>
                      <svg
                        className={`h-5 w-5 text-gray-400 transform transition-transform ${
                          selectedVersions.includes(item.version) ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                    {index === 0 && (
                      <span className="inline-block mt-2 px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                        Current Version
                      </span>
                    )}
                    {item.diff && (
                      <div className="mt-2 text-sm">
                        {renderDiff(item.diff)}
                      </div>
                    )}
                  </div>

                  {selectedVersions.includes(item.version) && (
                    <div className="px-4 py-3 border-t border-gray-200">
                      <div className="mb-2">
                        <span className="text-sm font-medium text-gray-700">Value:</span>
                      </div>
                      <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto custom-scrollbar">
                        <code className="json-editor">{formatJSON(item.value)}</code>
                      </pre>
                      {item.description && (
                        <div className="mt-2">
                          <span className="text-sm font-medium text-gray-700">Description:</span>
                          <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ParameterHistory;