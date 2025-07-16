import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FixedSizeList } from 'react-window';
import {
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import emrServerlessService from '../services/emrServerlessService';
import toast from 'react-hot-toast';

const LogViewer = ({ file, onClose }) => {
  const [logContent, setLogContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const listRef = useRef(null);
  const rowHeights = useRef({});

  // Load log content
  const loadLogContent = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await emrServerlessService.getFileContent(file.path);
      setLogContent(data.content);
      setTruncated(data.truncated);
      
    } catch (err) {
      console.error('Error loading log content:', err);
      setError(err.message);
      toast.error('Failed to load log content');
    } finally {
      setLoading(false);
    }
  }, [file.path]);

  useEffect(() => {
    loadLogContent();
  }, [loadLogContent]);

  // Auto-refresh logic
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadLogContent();
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, loadLogContent]);

  // Split content into lines for virtual scrolling
  const lines = logContent.split('\n');

  // Search functionality
  useEffect(() => {
    if (!searchTerm) {
      setSearchResults([]);
      setCurrentSearchIndex(0);
      return;
    }

    const results = [];
    const searchRegex = new RegExp(searchTerm, 'gi');

    lines.forEach((line, index) => {
      if (searchRegex.test(line)) {
        results.push(index);
      }
    });

    setSearchResults(results);
    setCurrentSearchIndex(0);

    // Scroll to first result
    if (results.length > 0 && listRef.current) {
      listRef.current.scrollToItem(results[0], 'center');
    }
  }, [searchTerm, lines]);

  const navigateSearch = (direction) => {
    if (searchResults.length === 0) return;

    let newIndex;
    if (direction === 'next') {
      newIndex = (currentSearchIndex + 1) % searchResults.length;
    } else {
      newIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
    }

    setCurrentSearchIndex(newIndex);
    if (listRef.current) {
      listRef.current.scrollToItem(searchResults[newIndex], 'center');
    }
  };

  const handleDownload = async () => {
    try {
      const result = await emrServerlessService.getDownloadUrl(file.path);
      window.open(result.downloadUrl, '_blank');
      toast.success('Download started');
    } catch (err) {
      console.error('Error downloading file:', err);
      toast.error('Failed to download file');
    }
  };

  // Measure row height
  const getRowHeight = (index) => {
    return rowHeights.current[index] || 20;
  };

  const Row = ({ index, style }) => {
    const line = lines[index];
    const isHighlighted = searchResults.includes(index);
    const isCurrentResult = searchResults[currentSearchIndex] === index;
    const rowRef = useRef(null);

    useEffect(() => {
      if (rowRef.current && rowHeights.current[index] !== rowRef.current.offsetHeight) {
        rowHeights.current[index] = rowRef.current.offsetHeight;
        if (listRef.current) {
          listRef.current.resetAfterIndex(index);
        }
      }
    }, [index, line]);

    // Apply syntax highlighting for common log patterns
    const highlightLine = (text) => {
      if (!text) return '';

      // Highlight timestamps
      text = text.replace(/\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}/g, '<span class="text-blue-600">$&</span>');
      
      // Highlight log levels
      text = text.replace(/\b(ERROR|FAILED|FAILURE|Exception)\b/gi, '<span class="text-red-600 font-semibold">$&</span>');
      text = text.replace(/\b(WARN|WARNING)\b/gi, '<span class="text-yellow-600 font-semibold">$&</span>');
      text = text.replace(/\b(INFO|RUNNING|SUCCEEDED|SUCCESS)\b/gi, '<span class="text-green-600 font-semibold">$&</span>');
      text = text.replace(/\b(DEBUG)\b/gi, '<span class="text-gray-600">$&</span>');

      // Highlight search term
      if (searchTerm && isHighlighted) {
        const searchRegex = new RegExp(`(${searchTerm})`, 'gi');
        text = text.replace(searchRegex, '<span class="bg-yellow-300">$1</span>');
      }

      return text;
    };

    return (
      <div
        ref={rowRef}
        style={style}
        className={`px-4 py-0.5 font-mono text-sm whitespace-pre-wrap break-all ${
          isHighlighted ? 'bg-yellow-50' : ''
        } ${isCurrentResult ? 'ring-2 ring-yellow-400' : ''} ${
          index % 2 === 0 ? 'bg-gray-50' : 'bg-white'
        }`}
      >
        <span className="text-gray-400 select-none mr-4">{index + 1}</span>
        <span dangerouslySetInnerHTML={{ __html: highlightLine(line) }} />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-11/12 h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="text-lg font-semibold">Log Viewer: {file.name}</h3>
            {truncated && (
              <p className="text-sm text-yellow-600 mt-1">
                File truncated to 10MB for display. Download for full content.
              </p>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`p-2 rounded transition-colors ${
                autoRefresh
                  ? 'bg-green-100 text-green-600 hover:bg-green-200'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
              title={autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
            >
              <ArrowPathIcon className={`h-5 w-5 ${autoRefresh ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleDownload}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
              title="Download file"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-4 py-2 border-b bg-gray-50">
          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search logs..."
                className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-aws-blue"
              />
            </div>
            {searchResults.length > 0 && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">
                  {currentSearchIndex + 1} of {searchResults.length}
                </span>
                <button
                  onClick={() => navigateSearch('prev')}
                  className="p-1 text-gray-600 hover:bg-gray-200 rounded"
                >
                  ↑
                </button>
                <button
                  onClick={() => navigateSearch('next')}
                  className="p-1 text-gray-600 hover:bg-gray-200 rounded"
                >
                  ↓
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-aws-smile mx-auto mb-4"></div>
                <p className="text-gray-600">Loading log content...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-red-600">
                <p className="font-semibold">Error loading logs</p>
                <p className="text-sm mt-1">{error}</p>
                <button
                  onClick={loadLogContent}
                  className="mt-4 px-4 py-2 bg-aws-blue text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : lines.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <p>No log content available</p>
            </div>
          ) : (
            <FixedSizeList
              ref={listRef}
              height={window.innerHeight * 0.6}
              itemCount={lines.length}
              itemSize={getRowHeight}
              width="100%"
              overscanCount={10}
            >
              {Row}
            </FixedSizeList>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t bg-gray-50 text-sm text-gray-600">
          <div className="flex justify-between items-center">
            <span>Lines: {lines.length}</span>
            <span>Press Esc to close</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogViewer;