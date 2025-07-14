import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import emrService from '../services/emrService';
import LoadingSpinner from './LoadingSpinner';

const StepAnalysisModal = ({ cluster, step, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    analyzeStep();
  }, [cluster.clusterId, step.id]);

  const analyzeStep = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await emrService.analyzeStep(cluster.clusterId, step.id);
      setAnalysis(response);
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err.message || 'Failed to analyze step');
      toast.error(err.message || 'Failed to analyze step');
    } finally {
      setLoading(false);
    }
  };

  const getStepStateColor = (state) => {
    const colors = {
      'PENDING': 'bg-yellow-100 text-yellow-800',
      'RUNNING': 'bg-blue-100 text-blue-800',
      'COMPLETED': 'bg-green-100 text-green-800',
      'CANCELLED': 'bg-gray-100 text-gray-800',
      'FAILED': 'bg-red-100 text-red-800',
      'INTERRUPTED': 'bg-orange-100 text-orange-800'
    };
    return colors[state] || 'bg-gray-100 text-gray-800';
  };

  const formatAnalysis = (analysisText) => {
    // Split analysis into sections for better readability
    const sections = analysisText.split(/\d+\.\s+/);
    return sections.filter(s => s.trim()).map((section, index) => (
      <div key={index} className="mb-4">
        <p className="text-gray-700 leading-relaxed">{section.trim()}</p>
      </div>
    ));
  };

  return (
    <>
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity z-50" onClick={onClose}></div>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex items-end sm:items-center justify-center min-h-full p-4 text-center sm:p-0">
          <div className="relative bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:max-w-2xl sm:w-full">
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="sm:flex sm:items-start">
                <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                  <div className="flex justify-between items-start">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Step Analysis
                    </h3>
                    <button
                      type="button"
                      className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
                      onClick={onClose}
                    >
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  
                  {loading ? (
                    <div className="flex justify-center items-center py-12">
                      <LoadingSpinner />
                      <span className="ml-3 text-gray-500">Analyzing step execution...</span>
                    </div>
                  ) : error ? (
                    <div className="mt-4">
                      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                        {error}
                      </div>
                    </div>
                  ) : analysis ? (
                    <div className="mt-4">
                      {/* Step Info */}
                      <div className="bg-gray-50 rounded-lg p-4 mb-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium text-gray-500">Step Name</p>
                            <p className="mt-1 text-sm text-gray-900">{analysis.stepName}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-500">Status</p>
                            <span className={`mt-1 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStepStateColor(analysis.stepState)}`}>
                              {analysis.stepState}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Analysis Content */}
                      <div className="prose prose-sm max-w-none">
                        <h4 className="text-base font-semibold text-gray-900 mb-3">AI Analysis</h4>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          {analysis.analysis ? formatAnalysis(analysis.analysis) : (
                            <p className="text-gray-700">{analysis.analysis}</p>
                          )}
                        </div>
                      </div>

                      {/* Timestamp */}
                      <div className="mt-4 text-xs text-gray-500">
                        Analysis generated at: {new Date(analysis.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="button"
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-aws-blue sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default StepAnalysisModal;