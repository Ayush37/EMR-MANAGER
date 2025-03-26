// src/services/paramStoreService.js
import { GetParametersByPathCommand } from "@aws-sdk/client-ssm";
import { ssmClient } from "./awsConfig";

const PARAM_PATH = "/application/ecdp-config/UAT/EMR-BASE/";

/**
 * Fetches all EMR cluster configurations from Parameter Store
 * @returns {Promise<Array>} List of cluster configurations
 */
export const fetchClusterConfigs = async () => {
  try {
    const params = {
      Path: PARAM_PATH,
      Recursive: true,
      WithDecryption: true,
    };

    // Parameter Store might return paginated results
    let allParams = [];
    let nextToken = null;

    do {
      if (nextToken) {
        params.NextToken = nextToken;
      }
      
      const response = await ssmClient.send(new GetParametersByPathCommand(params));
      allParams = [...allParams, ...response.Parameters];
      nextToken = response.NextToken;
    } while (nextToken);

    // Process parameters into cluster configs
    return allParams
      .filter(param => {
        // Extract cluster name from the parameter name
        const clusterName = param.Name.replace(PARAM_PATH, "");
        // Filter out clusters with "STRESS" in their name
        return !clusterName.includes("STRESS");
      })
      .map(param => {
        const clusterName = param.Name.replace(PARAM_PATH, "");
        let config;
        
        try {
          // Parameter Store often stores JSON configurations
          config = JSON.parse(param.Value);
        } catch (e) {
          config = { rawValue: param.Value };
        }
        
        return {
          name: clusterName,
          config,
          parameterName: param.Name,
          lastModified: param.LastModifiedDate,
        };
      });
  } catch (error) {
    console.error("Error fetching cluster configurations:", error);
    throw error;
  }
};
