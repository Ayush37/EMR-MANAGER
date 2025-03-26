// src/services/lambdaService.js
import { lambdaClient } from './awsConfig';

const LAMBDA_FUNCTION_NAME = "app-job-submit";

/**
 * Terminates an EMR cluster by invoking the Lambda function
 * @param {string} clusterName Name of the cluster to terminate
 * @returns {Promise<Object>} Lambda function response
 */
export const terminateCluster = async (clusterName) => {
  try {
    const payload = {
      resource: "/executions/clusters",
      path: "/executions/clusters",
      body: JSON.stringify({
        cluster_name: clusterName,
        job_type: "CLUSTER",
        request_type: "DELETE",
        fifo_key: clusterName,
        termination_mode: "IMMEDIATE"
      }),
      httpMethod: "DELETE"
    };

    const params = {
      FunctionName: LAMBDA_FUNCTION_NAME,
      Payload: JSON.stringify(payload),
    };

    const response = await lambdaClient.invoke(params).promise();
    
    // Parse the Lambda response
    const responsePayload = Buffer.from(response.Payload).toString();
    return JSON.parse(responsePayload);
  } catch (error) {
    console.error(`Error terminating cluster ${clusterName}:`, error);
    throw error;
  }
};

/**
 * Creates a new EMR cluster by invoking the Lambda function
 * @param {string} clusterName Name of the cluster to create
 * @returns {Promise<Object>} Lambda function response
 */
export const createCluster = async (clusterName) => {
  try {
    const payload = {
      resource: "/executions/clusters",
      path: "/executions/clusters",
      body: JSON.stringify({
        cluster_name: clusterName,
        job_type: "CLUSTER",
        request_type: "CREATE",
        fifo_key: clusterName
      }),
      httpMethod: "POST"
    };

    const params = {
      FunctionName: LAMBDA_FUNCTION_NAME,
      Payload: JSON.stringify(payload),
    };

    const response = await lambdaClient.invoke(params).promise();
    
    // Parse the Lambda response
    const responsePayload = Buffer.from(response.Payload).toString();
    return JSON.parse(responsePayload);
  } catch (error) {
    console.error(`Error creating cluster ${clusterName}:`, error);
    throw error;
  }
};
