import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import s3DataService from '../services/s3DataService';
import LoadingSpinner from './LoadingSpinner';

const QueryGeneratorModal = ({ file, environment, bucketType, onClose }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedQuery, setGeneratedQuery] = useState('');
  const [schema, setSchema] = useState([]);
  const [error, setError] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editedQuery, setEditedQuery] = useState('');

  const handleGenerate = async () => {
    if (!query.trim()) {
      toast.error('Please enter a query description');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setGeneratedQuery('');
      setSchema([]);
      setEditMode(false);

      const response = await s3DataService.generateSnowflakeQuery({
        environment,
        bucketType,
        filePath: file.path,
        query: query.trim()
      });

      setGeneratedQuery(response.query);
      setEditedQuery(response.query);
      setSchema(response.schema);
    } catch (err) {
      setError(err.message);
      toast.error('Failed to generate query');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    const queryToCopy = editMode ? editedQuery : generatedQuery;
    navigator.clipboard.writeText(queryToCopy);
    toast.success('Query copied to clipboard');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div className="flex items-center">
            <svg className="h-6 w-6 text-blue-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M3 7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M8 11h8m-4-4v8" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900">Snowflake Query Generator</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
          {/* File info */}
          <div className="mb-4 p-3 bg-gray-50 rounded-md">
            <p className="text-sm text-gray-600">
              <span className="font-medium">File:</span> {file.name}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-medium">Environment:</span> {environment.toUpperCase()} / {bucketType}
            </p>
          </div>

          {/* Query input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Describe your query in plain English
            </label>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Example: Select customer_id, order_total from this parquet where order_date > '2024-01-01' and status = 'completed'"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
            <p className="mt-1 text-xs text-gray-500">
              Press Enter to generate or Shift+Enter for new line
            </p>
          </div>

          {/* Generate button */}
          <div className="mb-6">
            <button
              onClick={handleGenerate}
              disabled={loading || !query.trim()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300"
            >
              {loading ? (
                <>
                  <LoadingSpinner className="w-4 h-4 mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Generate Query
                </>
              )}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Generated query */}
          {generatedQuery && (
            <div className="space-y-4">
              {/* Schema preview */}
              {schema.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Schema Mapping</h4>
                  <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-md">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Column</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Parquet Type</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Snowflake Type</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {schema.slice(0, 10).map((col, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-2 text-xs text-gray-900">{col.column_name}</td>
                            <td className="px-3 py-2 text-xs text-gray-500">{col.parquet_type}</td>
                            <td className="px-3 py-2 text-xs text-gray-500">{col.snowflake_type}</td>
                          </tr>
                        ))}
                        {schema.length > 10 && (
                          <tr>
                            <td colSpan={3} className="px-3 py-2 text-xs text-gray-500 text-center">
                              ... and {schema.length - 10} more columns
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Query display */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-sm font-medium text-gray-700">Generated Snowflake Query</h4>
                  <div className="space-x-2">
                    <button
                      onClick={() => {
                        setEditMode(!editMode);
                        if (!editMode) {
                          setEditedQuery(generatedQuery);
                        }
                      }}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      {editMode ? 'Cancel Edit' : 'Edit'}
                    </button>
                    <button
                      onClick={handleCopy}
                      className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                      Copy
                    </button>
                  </div>
                </div>
                {editMode ? (
                  <textarea
                    value={editedQuery}
                    onChange={(e) => setEditedQuery(e.target.value)}
                    className="w-full p-3 font-mono text-sm bg-gray-900 text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={15}
                  />
                ) : (
                  <pre className="p-3 bg-gray-900 text-gray-100 rounded-md overflow-x-auto">
                    <code className="text-sm">{generatedQuery}</code>
                  </pre>
                )}
              </div>

              {/* Instructions */}
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Copy this query and run it in your Snowflake environment. 
                  Make sure the stage path and file format are correctly configured in your Snowflake account.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QueryGeneratorModal;