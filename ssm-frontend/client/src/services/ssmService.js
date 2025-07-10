const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3700';

class SSMService {
  async handleResponse(response) {
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  async listParameters(page = 1, limit = 50) {
    try {
      const response = await fetch(`${API_BASE_URL}/allparameters?page=${page}&limit=${limit}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return this.handleResponse(response);
    } catch (error) {
      console.error('Error listing parameters:', error);
      throw error;
    }
  }

  async getParameter(name) {
    try {
      const response = await fetch(`${API_BASE_URL}/parameter/${encodeURIComponent(name)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return this.handleResponse(response);
    } catch (error) {
      console.error('Error getting parameter:', error);
      throw error;
    }
  }

  async createParameter(name, value, description = '') {
    try {
      const response = await fetch(`${API_BASE_URL}/parameters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, value, description }),
      });
      return this.handleResponse(response);
    } catch (error) {
      console.error('Error creating parameter:', error);
      throw error;
    }
  }

  async updateParameter(name, value, description = '') {
    try {
      const response = await fetch(`${API_BASE_URL}/parameter/${encodeURIComponent(name)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ value, description }),
      });
      return this.handleResponse(response);
    } catch (error) {
      console.error('Error updating parameter:', error);
      throw error;
    }
  }

  async getParameterHistory(name) {
    try {
      const response = await fetch(`${API_BASE_URL}/parameter/${encodeURIComponent(name)}/history`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return this.handleResponse(response);
    } catch (error) {
      console.error('Error getting parameter history:', error);
      throw error;
    }
  }
}

export default new SSMService();