"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSegment = exports.getFileSegments = exports.getFileDetails = exports.startFileTranslation = exports.deleteFile = exports.uploadFile = exports.getFilesByProjectId = exports.getAllFiles = exports.SegmentStatus = void 0;
const base_1 = require("./base");
// Define and export SegmentStatus as an enum
var SegmentStatus;
(function (SegmentStatus) {
    SegmentStatus["PENDING_REVIEW"] = "PENDING_REVIEW";
    SegmentStatus["EDITED"] = "EDITED";
    SegmentStatus["COMPLETED"] = "COMPLETED";
    SegmentStatus["REVIEWING"] = "REVIEWING";
    // Add other relevant statuses as needed
})(SegmentStatus || (exports.SegmentStatus = SegmentStatus = {}));
/**
 * Get all files
 */
const getAllFiles = async () => {
    const response = await base_1.axiosInstance.get('/files');
    return response.data.files;
};
exports.getAllFiles = getAllFiles;
/**
 * Get files by project ID
 */
const getFilesByProjectId = async (projectId) => {
    try {
        // Backend seems to return { success: boolean, data: FileType[] }
        // Adjust the expected response type if needed, or use 'any' and check dynamically
        const response = await base_1.axiosInstance.get(`/projects/${projectId}/files`);
        // Check if the request was successful and the data array exists
        if (response?.data?.success && Array.isArray(response.data.data)) {
            return response.data.data; // Return the nested data array
        }
        else {
            // Log unexpected structure or unsuccessful response
            console.warn(`Request for files of project ${projectId} was not successful or data format is incorrect:`, response?.data);
            return [];
        }
    }
    catch (error) {
        // Log the error and return empty array
        console.error(`Error fetching files for project ${projectId}:`, error);
        return [];
    }
};
exports.getFilesByProjectId = getFilesByProjectId;
/**
 * Upload a file
 */
const uploadFile = async (file, projectId) => {
    const uploadUrl = projectId ? `/projects/${projectId}/files` : '/files/upload';
    const formData = new FormData();
    formData.append('file', file);
    console.log(`[fileService] Uploading '${file.name}' to ${uploadUrl}`);
    try {
        const response = await base_1.axiosInstance.post(uploadUrl, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        // --- DEBUG LOGGING --- 
        console.log('[fileService] Raw Axios response:', response);
        console.log('[fileService] response.data:', response.data);
        console.log('[fileService] response.data.data (expected FileType):', response.data.data);
        // --- END DEBUG LOGGING --- 
        // Check if the expected nested data exists before returning
        if (response?.data?.data) {
            return response.data.data;
        }
        else {
            // Throw an error if the structure is not as expected
            console.error('[fileService] Error: response.data.data is missing or undefined.', response.data);
            throw new Error('Upload response format error: missing nested data.');
        }
    }
    catch (error) {
        console.error(`[fileService] Error during uploadFile for '${file.name}':`, error);
        // Re-throw the error to be caught by the calling component
        throw error;
    }
};
exports.uploadFile = uploadFile;
/**
 * Delete a file
 */
const deleteFile = async (fileId) => {
    const response = await base_1.axiosInstance.delete(`/files/${fileId}`);
    return response.data.success;
};
exports.deleteFile = deleteFile;
/**
 * Start translation process for a file
 */
const startFileTranslation = async (projectId, fileId, 
// Add required parameters from backend controller
promptTemplateId, aiConfigId, options // Include retranslateTM in options
) => {
    // Construct the request body expected by the backend
    const requestBody = {
        promptTemplateId,
        aiConfigId,
        options // Pass the whole options object
    };
    // Pass the body as the second argument to post
    const response = await base_1.axiosInstance.post(`/projects/${projectId}/files/${fileId}/translate`, requestBody);
    return response.data;
};
exports.startFileTranslation = startFileTranslation;
/**
 * Get file details
 */
const getFileDetails = async (fileId) => {
    const response = await base_1.axiosInstance.get(`/files/${fileId}`);
    return response.data.file;
};
exports.getFileDetails = getFileDetails;
/**
 * Get segments for a file
 */
const getFileSegments = async (fileId, params) => {
    const response = await base_1.axiosInstance.get(`/files/${fileId}/segments`, { params });
    return response.data;
};
exports.getFileSegments = getFileSegments;
/**
 * Update a segment
 */
const updateSegment = async (segmentId, payload) => {
    const response = await base_1.axiosInstance.patch(`/segments/${segmentId}`, payload);
    return response.data.segment;
};
exports.updateSegment = updateSegment;
// TODO: Add functions for getFileDetails, deleteFile etc. as needed 
