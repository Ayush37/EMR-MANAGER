import React, { useState, useEffect, useCallback } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import ParameterTable from './components/ParameterTable';
import ParameterEditor from './components/ParameterEditor';
import ParameterHistory from './components/ParameterHistory';
import ParameterDetailsModal from './components/ParameterDetailsModal';
import SearchBar from './components/SearchBar';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorMessage from './components/ErrorMessage';
import Pagination from './components/Pagination';
import ssmService from './services/ssmService';

function App() {
  const [parameters, setParameters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedParameter, setSelectedParameter] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const fetchParameters = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const response = await ssmService.listParameters(page);
      
      if (response.parameters) {
        setParameters(response.parameters);
      }
      
      if (response.pagination) {
        setCurrentPage(response.pagination.page);
        setTotalPages(response.pagination.totalPages);
        setHasNext(response.pagination.hasNext);
        setHasPrev(response.pagination.hasPrev);
        setTotalCount(response.pagination.total);
      }
    } catch (err) {
      setError(err.message);
      toast.error('Failed to load parameters');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchParameters(currentPage);
  }, [currentPage]);

  // Filter parameters based on search term
  const filteredParameters = parameters.filter(param => 
    param.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (param.description && param.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleParameterClick = (parameter) => {
    setSelectedParameter(parameter);
    setShowDetails(true);
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
      } else {
        await ssmService.updateParameter(name, value, description);
        toast.success('Parameter updated successfully');
      }
      setShowEditor(false);
      await fetchParameters(currentPage);
    } catch (err) {
      toast.error(err.message);
      throw err; // Let the editor handle the error
    }
  };

  const handleClose = () => {
    setShowEditor(false);
    setShowHistory(false);
    setShowDetails(false);
    setSelectedParameter(null);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
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
          <>
            <ParameterTable
              parameters={filteredParameters}
              onParameterClick={handleParameterClick}
              onEdit={handleEdit}
              onViewHistory={handleViewHistory}
            />
            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                hasNext={hasNext}
                hasPrev={hasPrev}
              />
            )}
          </>
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