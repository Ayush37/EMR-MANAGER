import React, { useState, useEffect } from 'react';
import JsonView from '@uiw/react-json-view';
import emrService from '../services/emrService';
import toast from 'react-hot-toast';

const StepDuplicationModal = ({ cluster, step, onClose, onSuccess }) => {
  const [stepName, setStepName] = useState('');
  const [actionOnFailure, setActionOnFailure] = useState('CONTINUE');
  const [stepConfig, setStepConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedConfig, setEditedConfig] = useState('');

  useEffect(() => {
    // Initialize with the original step configuration
    setStepName(`${step.name} - Copy`);
    setActionOnFailure(step.actionOnFailure || 'CONTINUE');
    setStepConfig(step.config || {});
    setEditedConfig(JSON.stringify(step.config || {}, null, 2));
  }, [step]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!stepName.trim()) {
      toast.error('Please provide a step name');
      return;
    }

    try {
      setLoading(true);
      
      let configToSubmit = stepConfig;
      
      // If in edit mode, parse the edited JSON
      if (editMode) {
        try {
          configToSubmit = JSON.parse(editedConfig);
        } catch (err) {
          toast.error('Invalid JSON configuration');
          return;
        }
      }

      // Extract HadoopJarStep from the config if it exists
      const hadoopJarStep = configToSubmit.HadoopJarStep || configToSubmit.Args ? {
        Jar: configToSubmit.Jar || 'command-runner.jar',
        Args: configToSubmit.Args || [],
        MainClass: configToSubmit.MainClass,
        Properties: configToSubmit.Properties
      } : {};

      const newStepConfig = {
        name: stepName,
        actionOnFailure: actionOnFailure,
        hadoopJarStep: hadoopJarStep
      };

      await emrService.duplicateStep(cluster.clusterId, newStepConfig);
      onSuccess();
    } catch (err) {
      toast.error(err.message || 'Failed to duplicate step');
    } finally {
      setLoading(false);
    }
  };

  const toggleEditMode = () => {
    if (!editMode) {
      setEditedConfig(JSON.stringify(stepConfig, null, 2));
    } else {
      // Validate JSON before leaving edit mode
      try {
        const parsed = JSON.parse(editedConfig);
        setStepConfig(parsed);
      } catch (err) {
        toast.error('Invalid JSON - please fix before switching modes');
        return;
      }
    }
    setEditMode(!editMode);
  };

  return (
    <>
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity z-50" onClick={onClose}></div>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex items-end sm:items-center justify-center min-h-full p-4 text-center sm:p-0">
          <div className="relative bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:max-w-4xl sm:w-full">
            <form onSubmit={handleSubmit}>
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                      Duplicate Step
                    </h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="step-name" className="block text-sm font-medium text-gray-700">
                          Step Name
                        </label>
                        <input
                          type="text"
                          id="step-name"
                          value={stepName}
                          onChange={(e) => setStepName(e.target.value)}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-aws-blue focus:border-aws-blue sm:text-sm"
                          required
                        />
                      </div>

                      <div>
                        <label htmlFor="action-on-failure" className="block text-sm font-medium text-gray-700">
                          Action on Failure
                        </label>
                        <select
                          id="action-on-failure"
                          value={actionOnFailure}
                          onChange={(e) => setActionOnFailure(e.target.value)}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-aws-blue focus:border-aws-blue sm:text-sm"
                        >
                          <option value="TERMINATE_CLUSTER">Terminate Cluster</option>
                          <option value="CANCEL_AND_WAIT">Cancel and Wait</option>
                          <option value="CONTINUE">Continue</option>
                        </select>
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="block text-sm font-medium text-gray-700">
                            Step Configuration
                          </label>
                          <button
                            type="button"
                            onClick={toggleEditMode}
                            className="text-sm text-aws-blue hover:text-aws-blue-dark"
                          >
                            {editMode ? 'View Mode' : 'Edit Mode'}
                          </button>
                        </div>
                        
                        {editMode ? (
                          <textarea
                            value={editedConfig}
                            onChange={(e) => setEditedConfig(e.target.value)}
                            className="w-full h-96 font-mono text-sm border-gray-300 rounded-md shadow-sm focus:ring-aws-blue focus:border-aws-blue"
                            spellCheck={false}
                          />
                        ) : (
                          <div className="bg-gray-900 p-4 rounded-lg overflow-auto max-h-96">
                            <JsonView
                              value={stepConfig}
                              displayDataTypes={false}
                              displayObjectSize={false}
                              collapsed={2}
                              style={{ backgroundColor: 'transparent' }}
                            />
                          </div>
                        )}
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                        <p className="text-sm text-blue-700">
                          <strong>Note:</strong> This will create a new step with the same configuration as the original. 
                          You can modify the configuration above before submitting.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-aws-blue text-base font-medium text-white hover:bg-aws-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-aws-blue sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Duplicating...' : 'Duplicate Step'}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-aws-blue sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={onClose}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default StepDuplicationModal;