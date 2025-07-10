import React from 'react';

const EnvironmentFilter = ({ value, onChange }) => {
  const environments = [
    { value: 'all', label: 'All Environments' },
    { value: 'uat1', label: 'UAT1' },
    { value: 'uat2', label: 'UAT2' },
    { value: 'uat3', label: 'UAT3' }
  ];

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-aws-blue focus:border-aws-blue sm:text-sm rounded-md"
      >
        {environments.map((env) => (
          <option key={env.value} value={env.value}>
            {env.label}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
          <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
        </svg>
      </div>
    </div>
  );
};

export default EnvironmentFilter;