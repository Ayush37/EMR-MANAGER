import React, { useState, useEffect, useCallback } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import S3Browser from './components/S3Browser';
import ParquetViewer from './components/ParquetViewer';
import EnvironmentFilter from './components/EnvironmentFilter';
import BucketTypeFilter from './components/BucketTypeFilter';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorMessage from './components/ErrorMessage';
import s3DataService from './services/s3DataService';

function App() {
  const [environment, setEnvironment] = useState(() => {
    return localStorage.getItem('s3data-environment') || 'uat1';
  });
  
  const [bucketType, setBucketType] = useState(() => {
    return localStorage.getItem('s3data-bucket-type') || 'REFINED';
  });
  
  const [currentPath, setCurrentPath] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [pageToken, setPageToken] = useState('');
  const [hasMore, setHasMore] = useState(false);
  
  // Breadcrumb navigation
  const pathParts = currentPath ? currentPath.split('/').filter(p => p) : [];
  
  // Persist environment and bucket type
  useEffect(() => {
    localStorage.setItem('s3data-environment', environment);
  }, [environment]);
  
  useEffect(() => {
    localStorage.setItem('s3data-bucket-type', bucketType);
  }, [bucketType]);
  
  // Load items when path, environment, or bucket type changes
  useEffect(() => {
    loadItems();
  }, [currentPath, environment, bucketType]);
  
  const loadItems = async (nextPageToken = '') => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await s3DataService.listObjects({
        environment,
        bucketType,
        prefix: currentPath,
        pageToken: nextPageToken
      });
      
      if (nextPageToken) {
        setItems(prev => [...prev, ...response.items]);
      } else {
        setItems(response.items);
      }
      
      setPageToken(response.nextPageToken || '');
      setHasMore(response.isTruncated || false);
    } catch (err) {
      setError(err.message);
      toast.error('Failed to load items');
    } finally {
      setLoading(false);
    }
  };
  
  const handleNavigate = (path) => {
    setCurrentPath(path);
    setSelectedFile(null);
    setPageToken('');
  };
  
  const handleFileSelect = (file) => {
    setSelectedFile(file);
  };
  
  const handleBreadcrumbClick = (index) => {
    const newPath = pathParts.slice(0, index + 1).join('/') + '/';
    handleNavigate(index === -1 ? '' : newPath);
  };
  
  const handleLoadMore = () => {
    if (hasMore && pageToken) {
      loadItems(pageToken);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <h1 className="text-3xl font-bold text-gray-900">
              S3 Data Viewer
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Browse and preview parquet files from S3 buckets
            </p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex gap-4">
          <div className="w-48">
            <EnvironmentFilter value={environment} onChange={setEnvironment} />
          </div>
          <div className="w-48">
            <BucketTypeFilter value={bucketType} onChange={setBucketType} />
          </div>
        </div>
        
        {/* Breadcrumb */}
        <div className="mt-4 flex items-center text-sm text-gray-600">
          <button
            onClick={() => handleBreadcrumbClick(-1)}
            className="hover:text-aws-blue"
          >
            {bucketType}
          </button>
          {pathParts.map((part, index) => (
            <React.Fragment key={index}>
              <span className="mx-2">/</span>
              <button
                onClick={() => handleBreadcrumbClick(index)}
                className="hover:text-aws-blue"
              >
                {part}
              </button>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        {error && <ErrorMessage message={error} />}
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* S3 Browser */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Files & Folders</h2>
            </div>
            <S3Browser
              items={items}
              loading={loading}
              currentPath={currentPath}
              onNavigate={handleNavigate}
              onFileSelect={handleFileSelect}
              selectedFile={selectedFile}
              hasMore={hasMore}
              onLoadMore={handleLoadMore}
            />
          </div>
          
          {/* Parquet Viewer */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Preview</h2>
            </div>
            {selectedFile ? (
              <ParquetViewer
                file={selectedFile}
                environment={environment}
                bucketType={bucketType}
              />
            ) : (
              <div className="p-8 text-center text-gray-500">
                Select a parquet file to preview
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;