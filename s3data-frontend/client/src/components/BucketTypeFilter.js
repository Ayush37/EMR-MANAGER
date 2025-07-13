import React from 'react';

const BucketTypeFilter = ({ value, onChange }) => {
  return (
    <div>
      <label htmlFor="bucket-type" className="block text-sm font-medium text-gray-700">
        Bucket Type
      </label>
      <select
        id="bucket-type"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-aws-blue focus:border-aws-blue sm:text-sm rounded-md"
      >
        <option value="REFINED">REFINED</option>
        <option value="TRUSTED">TRUSTED</option>
      </select>
    </div>
  );
};

export default BucketTypeFilter;