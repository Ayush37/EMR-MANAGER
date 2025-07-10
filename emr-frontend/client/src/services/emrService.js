// Use relative URL for production (same domain/ALB)
// For local development, you can override with REACT_APP_API_URL env variable
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

class EMRService {
  async handleResponse(response) {
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  async listClusters(page = 1, limit = 20, environment = 'all') {
    try {
      const response = await fetch(`${API_BASE_URL}/clusters?page=${page}&limit=${limit}&environment=${environment}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return this.handleResponse(response);
    } catch (error) {
      console.error('Error listing clusters:', error);
      throw error;
    }
  }

  async getCluster(name) {
    try {
      const response = await fetch(`${API_BASE_URL}/clusters/${encodeURIComponent(name)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return this.handleResponse(response);
    } catch (error) {
      console.error('Error getting cluster:', error);
      throw error;
    }
  }

  async startCluster(name, environment) {
    try {
      const response = await fetch(`${API_BASE_URL}/clusters/${encodeURIComponent(name)}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ environment }),
      });
      return this.handleResponse(response);
    } catch (error) {
      console.error('Error starting cluster:', error);
      throw error;
    }
  }

  async terminateCluster(name, environment) {
    try {
      const response = await fetch(`${API_BASE_URL}/clusters/${encodeURIComponent(name)}/terminate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ environment }),
      });
      return this.handleResponse(response);
    } catch (error) {
      console.error('Error terminating cluster:', error);
      throw error;
    }
  }

  async getClusterSteps(clusterId, page = 1, limit = 20) {
    try {
      const response = await fetch(`${API_BASE_URL}/clusters/${clusterId}/steps?page=${page}&limit=${limit}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return this.handleResponse(response);
    } catch (error) {
      console.error('Error getting cluster steps:', error);
      throw error;
    }
  }

  async getStepDetails(clusterId, stepId) {
    try {
      const response = await fetch(`${API_BASE_URL}/clusters/${clusterId}/steps/${stepId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return this.handleResponse(response);
    } catch (error) {
      console.error('Error getting step details:', error);
      throw error;
    }
  }

  async duplicateStep(clusterId, stepConfig) {
    try {
      const response = await fetch(`${API_BASE_URL}/clusters/${clusterId}/steps`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(stepConfig),
      });
      return this.handleResponse(response);
    } catch (error) {
      console.error('Error duplicating step:', error);
      throw error;
    }
  }

  async cancelStep(clusterId, stepId) {
    try {
      const response = await fetch(`${API_BASE_URL}/clusters/${clusterId}/steps/${stepId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return this.handleResponse(response);
    } catch (error) {
      console.error('Error cancelling step:', error);
      throw error;
    }
  }
}

export default new EMRService();