import React, { useState, useRef, useEffect } from 'react';

const StatusFilter = ({ selectedStates, onStatesChange, clusters }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // All possible states
  const allStates = ['STARTING', 'BOOTSTRAPPING', 'RUNNING', 'WAITING', 'TERMINATING', 'TERMINATED', 'TERMINATED_WITH_ERRORS'];
  
  // Count clusters by state
  const stateCounts = allStates.reduce((counts, state) => {
    counts[state] = clusters.filter(c => c.state === state).length;
    return counts;
  }, {});

  // Only show states that have clusters
  const availableStates = allStates.filter(state => stateCounts[state] > 0);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleStateToggle = (state) => {
    if (selectedStates.includes(state)) {
      onStatesChange(selectedStates.filter(s => s !== state));
    } else {
      onStatesChange([...selectedStates, state]);
    }
  };

  const handleSelectAll = () => {
    onStatesChange(availableStates);
  };

  const handleClearAll = () => {
    onStatesChange([]);
  };

  const getStateColor = (state) => {
    const colors = {
      'STARTING': 'text-blue-600',
      'BOOTSTRAPPING': 'text-blue-600',
      'RUNNING': 'text-green-600',
      'WAITING': 'text-yellow-600',
      'TERMINATING': 'text-orange-600',
      'TERMINATED': 'text-gray-600',
      'TERMINATED_WITH_ERRORS': 'text-red-600'
    };
    return colors[state] || 'text-gray-600';
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
      >
        <span>Status</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        {selectedStates.length > 0 && (
          <span className="ml-1 bg-aws-blue text-white rounded-full px-2 py-0.5 text-xs">
            {selectedStates.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-2 w-64 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
          <div className="py-1">
            <div className="px-4 py-2 border-b border-gray-200">
              <div className="flex justify-between">
                <button
                  onClick={handleSelectAll}
                  className="text-xs text-aws-blue hover:text-aws-blue-dark"
                >
                  Select All
                </button>
                <button
                  onClick={handleClearAll}
                  className="text-xs text-aws-blue hover:text-aws-blue-dark"
                >
                  Clear All
                </button>
              </div>
            </div>
            {availableStates.map(state => (
              <label
                key={state}
                className="flex items-center px-4 py-2 hover:bg-gray-100 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedStates.includes(state)}
                  onChange={() => handleStateToggle(state)}
                  className="h-4 w-4 text-aws-blue focus:ring-aws-blue border-gray-300 rounded"
                />
                <span className={`ml-3 flex-1 ${getStateColor(state)}`}>
                  {state}
                </span>
                <span className="text-gray-500 text-sm">
                  ({stateCounts[state]})
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StatusFilter;