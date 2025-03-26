// src/services/awsConfig.js
import { SSMClient } from "@aws-sdk/client-ssm";
import { EMRClient } from "@aws-sdk/client-emr";
import { LambdaClient } from "@aws-sdk/client-lambda";
import { fromIni } from "@aws-sdk/credential-provider-ini";

// Load credentials from local AWS CLI config
const credentialProvider = fromIni();

// Create service clients
export const ssmClient = new SSMClient({
  credentials: credentialProvider,
  region: "us-east-1", // Default region, can be configured based on requirements
});

export const emrClient = new EMRClient({
  credentials: credentialProvider,
  region: "us-east-1",
});

export const lambdaClient = new LambdaClient({
  credentials: credentialProvider,
  region: "us-east-1",
});

// Helper to refresh credentials if needed
export const refreshCredentials = async () => {
  try {
    const newCredentials = await credentialProvider();
    
    // Update clients with new credentials
    ssmClient.config.credentials = newCredentials;
    emrClient.config.credentials = newCredentials;
    lambdaClient.config.credentials = newCredentials;
    
    return true;
  } catch (error) {
    console.error("Failed to refresh AWS credentials:", error);
    return false;
  }
};
