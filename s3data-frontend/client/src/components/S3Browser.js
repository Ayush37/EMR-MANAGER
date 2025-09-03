import React from 'react';
import { formatFileSize, formatDate } from '../utils/formatters';

const S3Browser = ({ 
  items, 
  loading, 
  currentPath, 
  onNavigate, 
  onFileSelect, 
  selectedFile, 
  hasMore, 
  onLoadMore,
  searchTerm,
  onSearchChange,
  searchMode,
  isSearching,
  totalItems
}) => {
  if (loading && items.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-aws-blue mx-auto"></div>
        <p className="mt-4 text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!loading && items.length === 0 && !searchTerm) {
    return (
      <div className="p-8 text-center text-gray-500">
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
            d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <p className="mt-2">No items found</p>
      </div>
    );
  }

  return (
    <div>
      {/* Search Bar */}
      <div className="p-4 border-b border-gray-200">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={`Search in current folder${searchMode === 'server' ? ' (searching all ' + totalItems + ' items)' : ''}...`}
            className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-aws-blue focus:border-aws-blue sm:text-sm"
          />
          {searchTerm && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              <button
                onClick={() => onSearchChange('')}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>
        {/* Search mode indicator */}
        <div className="mt-2 text-xs text-gray-500">
          {searchMode === 'server' ? (
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

      {/* No search results */}
      {!loading && items.length === 0 && searchTerm && (
        <div className="p-8 text-center text-gray-500">
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
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <p className="mt-2">No results found for "{searchTerm}"</p>
          <button
            onClick={() => onSearchChange('')}
            className="mt-2 text-sm text-aws-blue hover:text-blue-700"
          >
            Clear search
          </button>
        </div>
      )}

      {/* Table */}
      {(items.length > 0 || loading) && (
      <div className="h-[520px] overflow-auto">
        <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Name
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Size
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Last Modified
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {items.map((item, index) => (
            <tr
              key={`${item.path}-${index}`}
              className={`hover:bg-gray-50 cursor-pointer ${
                selectedFile && selectedFile.path === item.path ? 'bg-blue-50' : ''
              }`}
              onClick={() => {
                if (item.type === 'directory') {
                  onNavigate(item.path);
                } else {
                  onFileSelect(item);
                }
              }}
            >
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  {item.type === 'directory' ? (
                    <svg
                      className="h-5 w-5 text-gray-400 mr-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-5 w-5 text-gray-400 mr-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  )}
                  <span className="text-sm font-medium text-gray-900">
                    {item.name}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {item.type === 'file' ? formatFileSize(item.size) : '-'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {item.type === 'file' ? formatDate(item.lastModified) : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {hasMore && (
        <div className="p-4 text-center border-t">
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-aws-blue disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
      </div>
      )}
    </div>
  );
};

export default S3Browser;