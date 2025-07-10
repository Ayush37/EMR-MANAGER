// src/hooks/useAWSAuth.js
import { useState, useEffect } from 'react';
import AWS from 'aws-sdk';

/**
 * Custom hook for managing AWS authentication
 * @returns {Object} Authentication state and methods
 */
const useAWSAuth = () => {
  const [credentials, setCredentials] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Load AWS credentials from local CLI configuration
   */
  const loadCredentials = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Attempt to get credentials from local AWS CLI config
      AWS.config.credentials = new AWS.SharedIniFileCredentials();
      
      // Test the credentials by trying to refresh them
      AWS.config.credentials.refresh((err) => {
        if (err) {
          console.error('Error refreshing AWS credentials:', err);
          setError('Failed to load AWS credentials. Please ensure AWS CLI is configured.');
          setIsAuthenticated(false);
          setIsLoading(false);
          return;
        }
        
        setCredentials(AWS.config.credentials);
        setIsAuthenticated(true);
        setIsLoading(false);
      });
    } catch (err) {
      console.error('Error loading AWS credentials:', err);
      setError('Failed to load AWS credentials. Please ensure AWS CLI is configured.');
      setIsAuthenticated(false);
      setIsLoading(false);
    }
  };

  // Load credentials on hook initialization
  useEffect(() => {
    loadCredentials();
  }, []);

  /**
   * Refresh the AWS credentials
   */
  const refreshCredentials = async () => {
    await loadCredentials();
    return isAuthenticated;
  };

  return {
    credentials,
    isAuthenticated,
    isLoading,
    error,
    refreshCredentials
  };
};

export default useAWSAuth;
