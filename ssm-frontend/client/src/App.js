import React, { useState, useEffect, useCallback } from 'react';
import ParameterTable from './components/ParameterTable';
import ParameterEditor from './components/ParameterEditor';
import ParameterHistory from './components/ParameterHistory';
import SearchBar from './components/SearchBar';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorMessage from './components/ErrorMessage';
import ssmService from './services/ssmService';

function App() {
  const [parameters, setParameters] = useState([]);
  const [filteredParameters, setFilteredParameters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedParameter, setSelectedParameter] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const fetchParameters = useCallback(async () => {
    try {
      setError(null);
      const response = await ssmService.listParameters();
      setParameters(response.parameters || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchParameters();
    const interval = setInterval(fetchParameters, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [fetchParameters]);

  useEffect(() => {
    const filtered = parameters.filter(param =>
      param.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredParameters(filtered);
  }, [parameters, searchTerm]);

  const handleEdit = (parameter) => {
    setSelectedParameter(parameter);
    setIsCreating(false);
    setShowEditor(true);
    setShowHistory(false);
  };

  const handleCreate = () => {
    setSelectedParameter(null);
    setIsCreating(true);
    setShowEditor(true);
    setShowHistory(false);
  };

  const handleViewHistory = (parameter) => {
    setSelectedParameter(parameter);
    setShowHistory(true);
    setShowEditor(false);
  };

  const handleSave = async (name, value, description) => {
    try {
      if (isCreating) {
        await ssmService.createParameter(name, value, description);
      } else {
        await ssmService.updateParameter(name, value, description);
      }
      setShowEditor(false);
      await fetchParameters();
    } catch (err) {
      throw err; // Let the editor handle the error
    }
  };

  const handleClose = () => {
    setShowEditor(false);
    setShowHistory(false);
    setSelectedParameter(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-aws-squid-ink text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <h1 className="text-3xl font-bold">SSM Parameter Store Manager</h1>
            <p className="mt-2 text-gray-300">Manage AWS Systems Manager Parameter Store</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex justify-between items-center">
          <SearchBar value={searchTerm} onChange={setSearchTerm} />
          <button
            onClick={handleCreate}
            className="bg-aws-blue text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Create Parameter
          </button>
        </div>

        {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

        {loading ? (
          <LoadingSpinner />
        ) : (
          <ParameterTable
            parameters={filteredParameters}
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
    </div>
  );
}

export default App;