// src/components/ClusterActions.jsx
import React, { useState } from 'react';

const ClusterActions = ({ cluster, onStart, onTerminate, disabled }) => {
  const [isLoading, setIsLoading] = useState(false);
  const isActive = ['RUNNING', 'WAITING', 'STARTING', 'BOOTSTRAPPING'].includes(cluster.state);

  const handleAction = async (actionType) => {
    try {
      setIsLoading(true);
      if (actionType === 'terminate') {
        await onTerminate(cluster.name);
      } else {
        await onStart(cluster.name);
      }
    } catch (error) {
      console.error(`Failed to ${actionType} cluster:`, error);
    } finally {
      setIsLoading(false);
    }
  };

  // Terminate button for active clusters
  if (isActive) {
    return (
      <button
        onClick={() => handleAction('terminate')}
        disabled={disabled || isLoading}
        className={`inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white 
          ${disabled || isLoading 
            ? 'bg-red-300 cursor-not-allowed' 
            : 'bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500'
          } transition duration-150 ease-in-out`}
      >
        {isLoading ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Terminating...
          </>
        ) : (
          <>
            <svg className="-ml-0.5 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Terminate
          </>
        )}
      </button>
    );
  }
  
  // Start button for terminated clusters
  return (
    <button
      onClick={() => handleAction('start')}
      disabled={disabled || isLoading}
      className={`inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white 
        ${disabled || isLoading 
          ? 'bg-green-300 cursor-not-allowed' 
          : 'bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'
        } transition duration-150 ease-in-out`}
    >
      {isLoading ? (
        <>
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Starting...
        </>
      ) : (
        <>
          <svg className="-ml-0.5 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3l14 9-14 9V3z" />
          </svg>
          Start
        </>
      )}
    </button>
  );
};

export default ClusterActions;
