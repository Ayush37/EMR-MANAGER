// src/components/ClusterFilter.jsx
import React from 'react';

const ClusterFilter = ({ value, onChange, total, filtered }) => {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="relative rounded-md shadow-sm max-w-md flex-1 mr-4">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 pr-12 sm:text-sm border-gray-300 rounded-md"
          placeholder="Filter clusters by name..."
        />
        {value && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <button
              type="button"
              onClick={() => onChange('')}
              className="text-gray-400 hover:text-gray-500 focus:outline-none"
            >
              <span className="sr-only">Clear search</span>
              <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <div className="text-sm text-gray-500">
        {filtered === total ? (
          <span>Showing all {total} clusters</span>
        ) : (
          <span>Showing {filtered} of {total} clusters</span>
        )}
      </div>
    </div>
  );
};

export default ClusterFilter;
