import { axiosInstance } from './base';

/**
 * Get all files for a project
 */
export const getProjectFiles = async (projectId: string) => {
  const response = await axiosInstance.get(`/api/projects/${projectId}/files`);
  return response.data;
};

/**
 * Get a single file by ID
 */
export const getFile = async (fileId: string) => {
  const response = await axiosInstance.get(`/api/files/${fileId}`);
  return response.data;
};

/**
 * Upload a new file to a project
 */
export const uploadFile = async (projectId: string, formData: FormData) => {
  const response = await axiosInstance.post(
    `/api/projects/${projectId}/files`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
};

/**
 * Delete a file
 */
export const deleteFile = async (fileId: string) => {
  const response = await axiosInstance.delete(`/api/files/${fileId}`);
  return response.data;
};

/**
 * Process a file (extract segments)
 */
export const processFile = async (fileId: string) => {
  const response = await axiosInstance.post(`/api/files/${fileId}/process`);
  return response.data;
};

/**
 * Download a file
 */
export const downloadFile = async (fileId: string, format?: string) => {
  const params = format ? { format } : {};
  const response = await axiosInstance.get(`/api/files/${fileId}/download`, {
    params,
    responseType: 'blob',
  });
  
  // Create download link
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  
  // Get filename from header or use default
  const contentDisposition = response.headers['content-disposition'];
  let filename = 'download';
  
  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename="(.+)"/);
    if (filenameMatch.length > 1) {
      filename = filenameMatch[1];
    }
  }
  
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  
  return { success: true };
}; 