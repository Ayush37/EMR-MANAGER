// src/services/emrService.js
import { 
  ListClustersCommand,
  DescribeClusterCommand
} from "@aws-sdk/client-emr";
import { emrClient } from "./awsConfig";

/**
 * Fetches the current state of all EMR clusters
 * @returns {Promise<Array>} List of EMR clusters with their current state
 */
export const listClusters = async () => {
  try {
    // List all clusters in various states
    const states = ["STARTING", "BOOTSTRAPPING", "RUNNING", "WAITING", "TERMINATING", "TERMINATED", "TERMINATED_WITH_ERRORS"];
    const params = {
      ClusterStates: states,
    };

    const response = await emrClient.send(new ListClustersCommand(params));
    return response.Clusters || [];
  } catch (error) {
    console.error("Error listing EMR clusters:", error);
    throw error;
  }
};

/**
 * Gets detailed information for a specific cluster
 * @param {string} clusterId EMR cluster ID
 * @returns {Promise<Object>} Detailed cluster information
 */
export const getClusterDetails = async (clusterId) => {
  try {
    const params = {
      ClusterId: clusterId,
    };

    const response = await emrClient.send(new DescribeClusterCommand(params));
    return response.Cluster;
  } catch (error) {
    console.error(`Error getting details for cluster ${clusterId}:`, error);
    throw error;
  }
};

/**
 * Maps cluster name to its state by finding the corresponding clusterID
 * @param {Array} clusterConfigs Configurations from Parameter Store
 * @param {Array} emrClusters List of actual EMR clusters from EMR API
 * @returns {Array} Merged information with cluster states
 */
export const mapClusterStates = (clusterConfigs, emrClusters) => {
  return clusterConfigs.map(config => {
    // Find matching EMR cluster by name
    const matchingCluster = emrClusters.find(cluster => 
      cluster.Name === config.name || 
      cluster.Name.includes(config.name)
    );

    return {
      ...config,
      state: matchingCluster ? matchingCluster.Status.State : "TERMINATED",
      clusterId: matchingCluster ? matchingCluster.Id : null,
      lastStateChangeReason: matchingCluster?.Status?.StateChangeReason || null,
      timeline: matchingCluster?.Status?.Timeline || null,
      applications: matchingCluster?.Applications || [],
      tags: matchingCluster?.Tags || []
    };
  });
};
