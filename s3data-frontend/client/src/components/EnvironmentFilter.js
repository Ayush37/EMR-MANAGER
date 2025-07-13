import React from 'react';

const EnvironmentFilter = ({ value, onChange }) => {
  return (
    <div>
      <label htmlFor="environment" className="block text-sm font-medium text-gray-700">
        Environment
      </label>
      <select
        id="environment"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-aws-blue focus:border-aws-blue sm:text-sm rounded-md"
      >
        <option value="uat1">UAT1</option>
        <option value="uat2">UAT2</option>
        <option value="uat3">UAT3</option>
      </select>
    </div>
  );
};

export default EnvironmentFilter;