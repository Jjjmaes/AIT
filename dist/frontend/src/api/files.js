"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadFile = exports.processFile = exports.deleteFile = exports.uploadFile = exports.getFile = exports.getProjectFiles = void 0;
const base_1 = require("./base");
/**
 * Get all files for a project
 */
const getProjectFiles = async (projectId) => {
    const response = await base_1.axiosInstance.get(`/api/projects/${projectId}/files`);
    return response.data;
};
exports.getProjectFiles = getProjectFiles;
/**
 * Get a single file by ID
 */
const getFile = async (fileId) => {
    const response = await base_1.axiosInstance.get(`/api/files/${fileId}`);
    return response.data;
};
exports.getFile = getFile;
/**
 * Upload a new file to a project
 */
const uploadFile = async (projectId, formData) => {
    const response = await base_1.axiosInstance.post(`/api/projects/${projectId}/files`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};
exports.uploadFile = uploadFile;
/**
 * Delete a file
 */
const deleteFile = async (fileId) => {
    const response = await base_1.axiosInstance.delete(`/api/files/${fileId}`);
    return response.data;
};
exports.deleteFile = deleteFile;
/**
 * Process a file (extract segments)
 */
const processFile = async (fileId) => {
    const response = await base_1.axiosInstance.post(`/api/files/${fileId}/process`);
    return response.data;
};
exports.processFile = processFile;
/**
 * Download a file
 */
const downloadFile = async (fileId, format) => {
    const params = format ? { format } : {};
    const response = await base_1.axiosInstance.get(`/api/files/${fileId}/download`, {
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
exports.downloadFile = downloadFile;
