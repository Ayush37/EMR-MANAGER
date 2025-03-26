// src/services/awsConfig.js
import AWS from 'aws-sdk';

// Configure AWS SDK to use local credentials
AWS.config.credentials = new AWS.SharedIniFileCredentials();

// Default region, can be configured based on requirements
AWS.config.update({ region: 'us-east-1' });

// Create service clients
export const ssmClient = new AWS.SSM();
export const emrClient = new AWS.EMR();
export const lambdaClient = new AWS.Lambda();

// Helper to refresh credentials if needed
export const refreshCredentials = async () => {
  try {
    AWS.config.credentials.refresh((err) => {
      if (err) {
        console.error('Failed to refresh AWS credentials:', err);
        return false;
      }
    });
    return true;
  } catch (error) {
    console.error('Error refreshing AWS credentials:', error);
    return false;
  }
};

// Export the AWS SDK for any additional services needed
export default AWS;
