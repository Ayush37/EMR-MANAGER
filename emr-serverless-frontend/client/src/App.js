import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import { Toaster, toast } from 'react-hot-toast';
import emrServerlessService from './services/emrServerlessService';
import LogViewer from './components/LogViewer';
import {
  FolderIcon,
  DocumentIcon,
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ChevronRightIcon,
  HomeIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

function App() {
  const [currentPath, setCurrentPath] = useState('');
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [breadcrumb, setBreadcrumb] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize] = useState(100);
  const [searchMode, setSearchMode] = useState('client');
  const [isSearching, setIsSearching] = useState(false);
  const [allFolders, setAllFolders] = useState([]);
  const [allFiles, setAllFiles] = useState([]);
  const [searchTimer, setSearchTimer] = useState(null);
  const [isTruncated, setIsTruncated] = useState(false);

  // Load directory contents
  const loadDirectory = useCallback(async (path = '', page = 1) => {
    try {
      setLoading(true);
      setError(null);
      setSearchTerm(''); // Clear search when navigating

      const data = await emrServerlessService.listObjects(path, page, pageSize);
      
      setFolders(data.folders || []);
      setFiles(data.files || []);
      setBreadcrumb(data.breadcrumb || []);
      setCurrentPage(data.pagination.page);
      setTotalPages(data.pagination.totalPages);
      setCurrentPath(path);
      setIsTruncated(data.isTruncated || false);
      
      // Store all items for client-side search
      if (page === 1) {
        setAllFolders(data.folders || []);
        setAllFiles(data.files || []);
      }
      
      // Determine search mode based on truncation
      setSearchMode(data.isTruncated ? 'server' : 'client');
      
    } catch (err) {
      console.error('Error loading directory:', err);
      setError(err.message);
      toast.error('Failed to load directory contents');
    } finally {
      setLoading(false);
    }
  }, [pageSize]);

  useEffect(() => {
    loadDirectory();
  }, [loadDirectory]);

  const navigateToFolder = (folderPath) => {
    setCurrentPage(1);
    if (searchTimer) {
      clearTimeout(searchTimer);
    }
    loadDirectory(folderPath, 1);
  };

  const navigateToBreadcrumb = (path) => {
    setCurrentPage(1);
    if (searchTimer) {
      clearTimeout(searchTimer);
    }
    loadDirectory(path, 1);
  };

  const handleRefresh = () => {
    loadDirectory(currentPath, currentPage);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    loadDirectory(currentPath, page);
  };

  const openLogViewer = (file) => {
    if (file.name.endsWith('.gz') || file.name.endsWith('.log')) {
      setSelectedFile(file);
    } else {
      toast.error('Only .gz and .log files can be viewed');
    }
  };

  // Search functionality
  const handleSearch = useCallback(async (term) => {
    if (!term.trim()) {
      setFolders(allFolders);
      setFiles(allFiles);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    if (searchMode === 'client') {
      // Client-side filtering for small directories
      const filteredFolders = allFolders.filter(folder =>
        folder.name.toLowerCase().includes(term.toLowerCase())
      );
      const filteredFiles = allFiles.filter(file =>
        file.name.toLowerCase().includes(term.toLowerCase())
      );
      setFolders(filteredFolders);
      setFiles(filteredFiles);
      setIsSearching(false);
    } else {
      // Server-side search for large directories
      try {
        const response = await emrServerlessService.searchObjects(currentPath, term);
        setFolders(response.folders || []);
        setFiles(response.files || []);
        if (response.resultLimited) {
          toast.info(`Showing first ${response.folders.length + response.files.length} of ${response.totalMatches} matches`);
        }
      } catch (err) {
        toast.error('Search failed: ' + err.message);
      } finally {
        setIsSearching(false);
      }
    }
  }, [allFolders, allFiles, searchMode, currentPath]);

  // Debounced search handler
  const handleSearchChange = (value) => {
    setSearchTerm(value);
    
    if (searchTimer) {
      clearTimeout(searchTimer);
    }

    if (searchMode === 'client') {
      // Immediate search for client-side
      handleSearch(value);
    } else {
      // Debounced search for server-side
      const timer = setTimeout(() => {
        handleSearch(value);
      }, 500);
      setSearchTimer(timer);
    }
  };

  // Format file size
  const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="bg-aws-squid text-white p-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold">EMR Serverless Log Viewer</h1>
          <p className="text-gray-300 mt-1">Browse and view EMR Serverless application logs</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-4">
        {/* Breadcrumb */}
        <div className="bg-white rounded-lg shadow mb-4 p-4">
          <div className="flex items-center space-x-2 text-sm">
            <HomeIcon className="h-4 w-4 text-gray-500" />
            {breadcrumb.map((item, index) => (
              <React.Fragment key={item.path}>
                <ChevronRightIcon className="h-4 w-4 text-gray-400" />
                <button
                  onClick={() => navigateToBreadcrumb(item.path)}
                  className="text-aws-blue hover:underline"
                >
                  {item.name}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Search and Actions */}
        <div className="bg-white rounded-lg shadow mb-4 p-4">
          <div className="flex flex-col space-y-2">
            <div className="flex items-center space-x-4">
              <div className="flex-1 relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder={`Search ${searchMode === 'server' && isTruncated ? 'all items in folder' : 'visible items'}...`}
                  className="w-full pl-10 pr-10 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-aws-blue"
                />
                {searchTerm && (
                  <button
                    onClick={() => handleSearchChange('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
              >
                <ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {/* Search mode indicator */}
            <div className="text-xs text-gray-500">
              {searchMode === 'server' && isTruncated ? (
                <span className="flex items-center">
                  <svg className="animate-pulse h-3 w-3 mr-1 text-aws-blue" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                  Server-side search {isSearching && '(searching...)'}
                </span>
              ) : (
                <span>Filtering visible items</span>
              )}
            </div>
          </div>
        </div>

        {/* Summary Info */}
        {!loading && !error && (
          <div className="mb-4 text-sm text-gray-600">
            Showing {folders.length} folders and {files.length} files
            {searchTerm && ` matching "${searchTerm}"`}
            {totalPages > 1 && !searchTerm && ` (Page ${currentPage} of ${totalPages})`}
          </div>
        )}

        {/* File Browser */}
        <div className="bg-white rounded-lg shadow">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-aws-smile mx-auto mb-4"></div>
                <p className="text-gray-600">Loading directory contents...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center text-red-600">
                <p className="font-semibold">Error loading directory</p>
                <p className="text-sm mt-1">{error}</p>
                <button
                  onClick={handleRefresh}
                  className="mt-4 px-4 py-2 bg-aws-blue text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Size
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last Modified
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {/* Folders */}
                    {folders.map((folder) => (
                      <tr
                        key={folder.path}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => navigateToFolder(folder.path)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <FolderIcon className="h-5 w-5 text-yellow-500 mr-2" />
                            <span className="text-sm font-medium text-gray-900">
                              {folder.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          -
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          -
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <button className="text-aws-blue hover:underline">
                            Open
                          </button>
                        </td>
                      </tr>
                    ))}
                    
                    {/* Files */}
                    {files.map((file) => (
                      <tr
                        key={file.path}
                        className="hover:bg-gray-50"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <DocumentIcon className="h-5 w-5 text-gray-400 mr-2" />
                            <span className="text-sm text-gray-900">
                              {file.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatSize(file.size)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(file.lastModified)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {(file.name.endsWith('.gz') || file.name.endsWith('.log')) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openLogViewer(file);
                              }}
                              className="text-aws-blue hover:underline mr-4"
                            >
                              View Logs
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}

                    {folders.length === 0 && files.length === 0 && (
                      <tr>
                        <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                          {searchTerm ? (
                            <div>
                              <p>No matching items found for "{searchTerm}"</p>
                              <button
                                onClick={() => handleSearchChange('')}
                                className="mt-2 text-aws-blue hover:underline"
                              >
                                Clear search
                              </button>
                            </div>
                          ) : (
                            'No files or folders in this directory'
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination - only show when not searching */}
              {totalPages > 1 && !searchTerm && (
                <div className="px-6 py-4 border-t bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-700 font-medium">
                      Page {currentPage} of {totalPages} ({folders.length + files.length} items on this page)
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="px-3 py-1 text-sm rounded border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Previous
                      </button>
                      
                      {/* Page numbers */}
                      {[...Array(Math.min(5, totalPages))].map((_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }

                        if (pageNum < 1 || pageNum > totalPages) return null;

                        return (
                          <button
                            key={pageNum}
                            onClick={() => handlePageChange(pageNum)}
                            className={`px-3 py-1 text-sm rounded border ${
                              currentPage === pageNum
                                ? 'bg-aws-blue text-white'
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      
                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 text-sm rounded border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Log Viewer Modal */}
      {selectedFile && (
        <LogViewer
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
        />
      )}
    </div>
  );
}

export default App;