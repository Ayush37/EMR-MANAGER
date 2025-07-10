export const formatDate = (dateString) => {
  if (!dateString) return '-';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    
    // Format: MM/DD/YYYY HH:MM
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${month}/${day}/${year} ${hours}:${minutes}`;
  } catch (error) {
    return '-';
  }
};

export const formatDuration = (startTime, endTime) => {
  if (!startTime || !endTime) return '-';
  
  try {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const duration = Math.floor((end - start) / 1000); // in seconds
    
    if (duration < 60) {
      return `${duration}s`;
    } else if (duration < 3600) {
      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;
      return `${minutes}m ${seconds}s`;
    } else {
      const hours = Math.floor(duration / 3600);
      const minutes = Math.floor((duration % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  } catch (error) {
    return '-';
  }
};