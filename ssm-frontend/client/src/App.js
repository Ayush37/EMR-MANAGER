import React, { useState } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import ParameterEditor from './components/ParameterEditor';
import ParameterHistory from './components/ParameterHistory';
import ParameterDetailsModal from './components/ParameterDetailsModal';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorMessage from './components/ErrorMessage';
import ssmService from './services/ssmService';

function App() {
  const [searchPath, setSearchPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedParameter, setSelectedParameter] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [parameterNotFound, setParameterNotFound] = useState(false);

  const handleSearch = async () => {
    if (!searchPath.trim()) {
      toast.error('Please enter a parameter path');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setParameterNotFound(false);
      setSelectedParameter(null);
      
      const response = await ssmService.getParameter(searchPath.trim());
      
      if (response.parameter) {
        setSelectedParameter(response.parameter);
        setShowDetails(true);
      }
    } catch (err) {
      if (err.message.includes('not found')) {
        setParameterNotFound(true);
        setError(`Parameter not found: ${searchPath}`);
      } else {
        setError(err.message);
        toast.error('Failed to fetch parameter');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleEdit = (parameter) => {
    setSelectedParameter(parameter);
    setIsCreating(false);
    setShowEditor(true);
    setShowHistory(false);
    setShowDetails(false);
  };

  const handleCreate = () => {
    setSelectedParameter(null);
    setIsCreating(true);
    setShowEditor(true);
    setShowHistory(false);
    setShowDetails(false);
    setParameterNotFound(false);
  };

  const handleViewHistory = (parameter) => {
    setSelectedParameter(parameter);
    setShowHistory(true);
    setShowEditor(false);
    setShowDetails(false);
  };

  const handleSave = async (name, value, description) => {
    try {
      if (isCreating) {
        await ssmService.createParameter(name, value, description);
        toast.success('Parameter created successfully');
        // After creating, set it as selected and show details
        setSearchPath(name);
        await handleSearch();
      } else {
        await ssmService.updateParameter(name, value, description);
        toast.success('Parameter updated successfully');
        // Refresh the parameter details
        const response = await ssmService.getParameter(name);
        if (response.parameter) {
          setSelectedParameter(response.parameter);
          setShowDetails(true);
        }
      }
      setShowEditor(false);
    } catch (err) {
      toast.error(err.message);
      throw err; // Let the editor handle the error
    }
  };

  const handleClose = () => {
    setShowEditor(false);
    setShowHistory(false);
    setShowDetails(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-aws-squid-ink text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <h1 className="text-3xl font-bold">SSM Parameter Store Manager</h1>
            <p className="mt-2 text-gray-300">Search and manage AWS Systems Manager Parameter Store</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                Parameter Path
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  id="search"
                  value={searchPath}
                  onChange={(e) => setSearchPath(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="e.g., /application/ecdp-config/uat1/EMR-BASE/config"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-aws-blue focus:border-transparent"
                  disabled={loading}
                />
                <button
                  onClick={handleSearch}
                  disabled={loading}
                  className="bg-aws-blue text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Search
                </button>
              </div>
            </div>
            <button
              onClick={handleCreate}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
            >
              Create New Parameter
            </button>
          </div>
        </div>

        {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

        {loading && (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        )}

        {!loading && !selectedParameter && !error && (
          <div className="bg-white shadow rounded-lg p-8 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <h3 className="mt-2 text-lg font-medium text-gray-900">Search for a parameter</h3>
            <p className="mt-1 text-gray-500">Enter a parameter path above to view its details</p>
          </div>
        )}

        {showDetails && selectedParameter && (
          <ParameterDetailsModal
            parameter={selectedParameter}
            onClose={handleClose}
            onEdit={handleEdit}
            onViewHistory={handleViewHistory}
          />
        )}

        {showEditor && (
          <ParameterEditor
            parameter={selectedParameter}
            isCreating={isCreating}
            onSave={handleSave}
            onClose={handleClose}
          />
        )}

        {showHistory && selectedParameter && (
          <ParameterHistory
            parameterName={selectedParameter.name}
            onClose={handleClose}
          />
        )}
      </main>
      
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </div>
  );
}

export default App;