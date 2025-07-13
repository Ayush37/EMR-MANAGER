// Use relative URL for production (same domain/ALB)
// For local development, you can override with REACT_APP_API_URL env variable
const API_BASE_URL = process.env.REACT_APP_API_URL || '/s3data-api';

class S3DataService {
  async handleResponse(response) {
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  async listObjects({ environment, bucketType, prefix = '', pageToken = '' }) {
    try {
      const params = new URLSearchParams({
        environment,
        bucket_type: bucketType,
        prefix
      });
      
      if (pageToken) {
        params.append('page_token', pageToken);
      }
      
      const response = await fetch(`${API_BASE_URL}/list?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return this.handleResponse(response);
    } catch (error) {
      console.error('Error listing objects:', error);
      throw error;
    }
  }

  async previewParquet({ environment, bucketType, path }) {
    try {
      const params = new URLSearchParams({
        environment,
        bucket_type: bucketType,
        path
      });
      
      const response = await fetch(`${API_BASE_URL}/preview?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return this.handleResponse(response);
    } catch (error) {
      console.error('Error previewing parquet:', error);
      throw error;
    }
  }

  async downloadFile({ environment, bucketType, path, format = 'parquet' }) {
    try {
      const params = new URLSearchParams({
        environment,
        bucket_type: bucketType,
        path,
        format
      });
      
      const response = await fetch(`${API_BASE_URL}/download?${params.toString()}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to download file');
      }
      
      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = /filename="(.+)"/.exec(contentDisposition);
      const filename = filenameMatch ? filenameMatch[1] : `download.${format === 'excel' ? 'xlsx' : 'parquet'}`;
      
      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading file:', error);
      throw error;
    }
  }
}

export default new S3DataService();