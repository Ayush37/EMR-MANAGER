// src/components/Sidebar.jsx
import React from 'react';

const Sidebar = ({ isExpanded = true, onToggle }) => {
  return (
    <div className={`bg-gray-800 text-white transition-all duration-300 ease-in-out ${isExpanded ? 'w-64' : 'w-16'}`}>
      <div className="flex items-center justify-between h-16 px-4">
        {isExpanded ? (
          <span className="text-xl font-semibold">EMR Manager</span>
        ) : (
          <span className="text-xl font-semibold">EMR</span>
        )}
        <button
          onClick={onToggle}
          className="p-1 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
        >
          <svg
            className="h-6 w-6"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            {isExpanded ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 5l7 7-7 7M5 5l7 7-7 7"
              />
            )}
          </svg>
        </button>
      </div>

      <nav className="mt-5 px-2">
        <a
          href="#clusters"
          className="group flex items-center px-2 py-2 text-base font-medium rounded-md bg-gray-900 text-white"
        >
          <svg
            className="mr-3 h-6 w-6 text-gray-300"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          {isExpanded && <span>Clusters</span>}
        </a>

        <a
          href="#usage"
          className="mt-1 group flex items-center px-2 py-2 text-base font-medium rounded-md text-gray-300 hover:bg-gray-700 hover:text-white"
        >
          <svg
            className="mr-3 h-6 w-6 text-gray-400 group-hover:text-gray-300"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          {isExpanded && <span>Usage Stats</span>}
        </a>

        <a
          href="#settings"
          className="mt-1 group flex items-center px-2 py-2 text-base font-medium rounded-md text-gray-300 hover:bg-gray-700 hover:text-white"
        >
          <svg
            className="mr-3 h-6 w-6 text-gray-400 group-hover:text-gray-300"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          {isExpanded && <span>Settings</span>}
        </a>
      </nav>

      {isExpanded && (
        <div className="mt-10 px-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Help & Documentation
          </h3>
          <div className="mt-4 space-y-2">
            <a href="#docs" className="block text-gray-300 hover:text-white">
              Documentation
            </a>
            <a href="#api" className="block text-gray-300 hover:text-white">
              API Reference
            </a>
            <a href="#support" className="block text-gray-300 hover:text-white">
              Support
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
