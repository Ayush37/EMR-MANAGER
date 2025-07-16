const API_BASE_URL = process.env.REACT_APP_API_URL || '';

class EmrServerlessService {
  async listObjects(prefix = '', page = 1, limit = 50) {
    try {
      const params = new URLSearchParams({
        prefix,
        page: page.toString(),
        limit: limit.toString()
      });

      const response = await fetch(`${API_BASE_URL}/serverless-api/list?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error listing objects:', error);
      throw error;
    }
  }

  async getFileContent(path) {
    try {
      const params = new URLSearchParams({ path });

      const response = await fetch(`${API_BASE_URL}/serverless-api/file?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting file content:', error);
      throw error;
    }
  }

  async getDownloadUrl(path) {
    try {
      const params = new URLSearchParams({ path });

      const response = await fetch(`${API_BASE_URL}/serverless-api/download?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting download URL:', error);
      throw error;
    }
  }
}

export default new EmrServerlessService();