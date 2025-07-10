import React, { useState, useEffect } from 'react';
import JsonView from '@uiw/react-json-view';
import ssmService from '../services/ssmService';
import LoadingSpinner from './LoadingSpinner';
import { formatDate } from '../utils/formatters';

const ParameterDetailsModal = ({ parameter, onClose, onEdit, onViewHistory }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [parameterDetails, setParameterDetails] = useState(null);
  const [activeTab, setActiveTab] = useState('details');

  useEffect(() => {
    if (parameter) {
      fetchParameterDetails();
    }
  }, [parameter]);

  const fetchParameterDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await ssmService.getParameter(parameter.name);
      setParameterDetails(response.parameter);
    } catch (err) {
      console.error('Error fetching parameter details:', err);
      setError(err.message || 'Failed to fetch parameter details');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    // Toast notification will be added later
  };

  const parseJsonValue = (value) => {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  };

  if (!parameter) return null;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Parameter Details</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 transition-colors"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
          {loading ? (
            <div className="p-6">
              <LoadingSpinner />
            </div>
          ) : error ? (
            <div className="p-6">
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          ) : parameterDetails ? (
            <div className="p-6">
              {/* Parameter Path */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-700">Parameter Path</h4>
                  <button
                    onClick={() => copyToClipboard(parameterDetails.name)}
                    className="text-xs text-aws-blue hover:text-blue-800 flex items-center"
                  >
                    <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy Path
                  </button>
                </div>
                <p className="text-sm font-mono bg-gray-100 p-2 rounded">{parameterDetails.name}</p>
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Last Modified</h4>
                  <p className="text-sm text-gray-900">{formatDate(parameterDetails.lastModified)}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Modified By</h4>
                  <p className="text-sm text-gray-900">{parameterDetails.lastModifiedBy}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Version</h4>
                  <p className="text-sm text-gray-900">v{parameterDetails.version}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Type</h4>
                  <p className="text-sm text-gray-900">{parameterDetails.type}</p>
                </div>
              </div>

              {/* Description */}
              {parameterDetails.description && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Description</h4>
                  <p className="text-sm text-gray-900">{parameterDetails.description}</p>
                </div>
              )}

              {/* Value */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-700">Value</h4>
                  <button
                    onClick={() => copyToClipboard(parameterDetails.value)}
                    className="text-xs text-aws-blue hover:text-blue-800 flex items-center"
                  >
                    <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy Value
                  </button>
                </div>
                
                {parameterDetails.value === 'Access Denied' ? (
                  <div className="bg-red-50 border border-red-200 rounded-md p-4">
                    <p className="text-sm text-red-800">Access Denied</p>
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-md p-4 overflow-auto">
                    <JsonView
                      value={parseJsonValue(parameterDetails.value)}
                      collapsed={1}
                      displayDataTypes={false}
                      displayObjectSize={false}
                      style={{
                        backgroundColor: 'transparent',
                        fontSize: '14px',
                        fontFamily: 'Monaco, Menlo, monospace',
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-aws-blue transition-colors"
          >
            Close
          </button>
          <div className="space-x-3">
            <button
              onClick={() => {
                onViewHistory(parameterDetails || parameter);
              }}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-aws-blue transition-colors"
            >
              View History
            </button>
            <button
              onClick={() => {
                onEdit(parameterDetails || parameter);
              }}
              disabled={parameterDetails?.value === 'Access Denied'}
              className="px-4 py-2 bg-aws-blue text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-aws-blue disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Edit Parameter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParameterDetailsModal;