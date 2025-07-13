import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import s3DataService from '../services/s3DataService';
import LoadingSpinner from './LoadingSpinner';
import { formatFileSize } from '../utils/formatters';

const ParquetViewer = ({ file, environment, bucketType }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (file) {
      loadPreview();
    }
  }, [file, environment, bucketType]);

  const loadPreview = async () => {
    try {
      setLoading(true);
      setError(null);
      setData(null);
      setMetadata(null);

      const response = await s3DataService.previewParquet({
        environment,
        bucketType,
        path: file.path
      });

      if (response.error && response.error === 'File too large for preview') {
        setError(response.message);
      } else {
        setData(response.data);
        setMetadata(response.metadata);
      }
    } catch (err) {
      setError(err.message);
      toast.error('Failed to load preview');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (format) => {
    try {
      setDownloading(true);
      await s3DataService.downloadFile({
        environment,
        bucketType,
        path: file.path,
        format
      });
      toast.success(`File downloaded as ${format}`);
    } catch (err) {
      toast.error(`Failed to download as ${format}`);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <LoadingSpinner />
        <p className="mt-4 text-gray-500">Loading preview...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Preview Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
              <div className="mt-4">
                <button
                  onClick={() => handleDownload('parquet')}
                  disabled={downloading}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Download Original File
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data || !metadata) {
    return null;
  }

  return (
    <div className="flex flex-col h-[600px]">
      {/* Metadata */}
      <div className="px-6 py-4 bg-gray-50 border-b">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-sm font-medium text-gray-900">{metadata.fileName}</h3>
            <div className="mt-1 text-sm text-gray-500">
              <span>{metadata.totalRows.toLocaleString()} rows</span>
              <span className="mx-2">•</span>
              <span>{metadata.totalColumns} columns</span>
              <span className="mx-2">•</span>
              <span>{formatFileSize(metadata.fileSize)}</span>
            </div>
            {metadata.previewRows < metadata.totalRows && (
              <p className="mt-1 text-xs text-gray-500">
                Showing first {metadata.previewRows} rows
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleDownload('parquet')}
              disabled={downloading}
              className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              Parquet
            </button>
            <button
              onClick={() => handleDownload('excel')}
              disabled={downloading}
              className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              Excel
            </button>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="flex-1 overflow-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              {metadata.columns.map((column, index) => (
                <th
                  key={index}
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-gray-50">
                {metadata.columns.map((column, colIndex) => (
                  <td
                    key={colIndex}
                    className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap"
                  >
                    {row[column] !== null && row[column] !== undefined
                      ? String(row[column])
                      : <span className="text-gray-400">null</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ParquetViewer;