// src/components/Header.jsx
import React from 'react';

const Header = ({ onRefresh, isRefreshing }) => {
  return (
    <div className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              {/* AWS EMR Logo */}
              <svg className="h-8 w-auto text-orange-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7.5 3.75a1.5 1.5 0 00-1.5 1.5v.75H3.75v-.75a3 3 0 013-3h10.5a3 3 0 013 3v.75H18v-.75a1.5 1.5 0 00-1.5-1.5H7.5zM6 6.75h12M6.75 18a.75.75 0 01-.75-.75v-9h12v9a.75.75 0 01-.75.75h-10.5z" fillRule="evenodd" clipRule="evenodd" />
              </svg>
              <h1 className="ml-3 text-xl font-bold text-gray-900">EMR Cluster Manager</h1>
            </div>
          </div>
          <div className="flex items-center">
            <span className="inline-flex rounded-md shadow-sm">
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                className={`relative inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white ${
                  isRefreshing ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 ease-in-out`}
              >
                <svg
                  className={`-ml-1 mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </button>
            </span>
            <div className="ml-4 text-sm text-gray-500">
              Auto-refreshes every 5 seconds
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Header;
