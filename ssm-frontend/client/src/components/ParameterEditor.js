import React, { useState, useEffect } from 'react';
import { formatJSON, validateJSON } from '../utils/formatters';

const ParameterEditor = ({ parameter, isCreating, onSave, onClose }) => {
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [jsonError, setJsonError] = useState('');

  useEffect(() => {
    if (parameter && !isCreating) {
      setName(parameter.name);
      setValue(formatJSON(parameter.value));
      setDescription(parameter.description || '');
    } else {
      setName('/application/');
      setValue('{}');
      setDescription('');
    }
  }, [parameter, isCreating]);

  const validateForm = () => {
    if (!name || !name.trim()) {
      setError('Parameter name is required');
      return false;
    }

    if (!name.startsWith('/application/')) {
      setError('Parameter name must start with /application/');
      return false;
    }

    if (name === '/application/') {
      setError('Please provide a parameter name after /application/');
      return false;
    }

    if (!value || !value.trim()) {
      setError('Parameter value is required');
      return false;
    }

    const validation = validateJSON(value);
    if (!validation.valid) {
      setJsonError(validation.error);
      return false;
    }

    return true;
  };

  const handleValueChange = (e) => {
    setValue(e.target.value);
    setJsonError('');
    setError('');
  };

  const formatValue = () => {
    const formatted = formatJSON(value);
    if (formatted !== value) {
      setValue(formatted);
      setJsonError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setSaving(true);
    setError('');

    try {
      await onSave(name, value, description);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            {isCreating ? 'Create Parameter' : 'Edit Parameter'}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Parameter Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isCreating}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-aws-blue focus:border-aws-blue disabled:bg-gray-100"
              placeholder="/application/your/parameter/path"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description (Optional)
            </label>
            <input
              type="text"
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-aws-blue focus:border-aws-blue"
              placeholder="Brief description of this parameter"
            />
          </div>

          <div className="mb-4">
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="value" className="block text-sm font-medium text-gray-700">
                Value (JSON)
              </label>
              <button
                type="button"
                onClick={formatValue}
                className="text-sm text-aws-blue hover:text-blue-700"
              >
                Format JSON
              </button>
            </div>
            <textarea
              id="value"
              value={value}
              onChange={handleValueChange}
              rows={15}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 json-editor custom-scrollbar ${
                jsonError 
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                  : 'border-gray-300 focus:ring-aws-blue focus:border-aws-blue'
              }`}
              placeholder='{\n  "key": "value"\n}'
            />
            {jsonError && (
              <p className="mt-1 text-sm text-red-600">{jsonError}</p>
            )}
          </div>
        </form>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-aws-blue"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 bg-aws-blue text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-aws-blue disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ParameterEditor;