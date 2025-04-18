"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteProject = exports.updateProject = exports.createProject = exports.getProjectById = exports.getProjects = void 0;
const base_1 = require("./base");
// Function to fetch projects with optional params and Axios config
const getProjects = async (params, config) => {
    // api.get returns the full AxiosResponse<PaginatedProjectsResponse>
    const responseData = await base_1.axiosInstance.get('/projects', { params, ...config });
    // Return the data part of the response, which matches the PaginatedProjectsResponse type
    return responseData.data;
};
exports.getProjects = getProjects;
// Modify getProjectById to accept config
const getProjectById = async (projectId, config) => {
    // Pass the config (which might contain the signal) to api.get
    const response = await base_1.axiosInstance.get(`/projects/${projectId}`, config);
    // Assuming the backend wraps successful response in `data` 
    // but might return the error structure directly. Need to be flexible.
    // Check if response.data seems like the expected structure
    if (response.data && typeof response.data === 'object' && 'success' in response.data) {
        return response.data; // Return the nested structure if present
    }
    // Fallback or handle cases where backend might return structure differently
    // This part might need adjustment based on actual backend error/success formats
    console.warn('[getProjectById] Unexpected response structure:', response);
    // Attempt a defensive cast or return a default error structure
    // The previous double cast was hiding potential issues
    // Let's try returning a standard error format if unsure
    return {
        success: false,
        message: `Unexpected response structure for project ${projectId}`,
        // data: undefined // Ensure data is undefined on error
    };
};
exports.getProjectById = getProjectById;
// Function to create a new project
const createProject = async (payload) => {
    // api.post returns the full AxiosResponse
    const response = await base_1.axiosInstance.post('/projects', payload);
    // Return the .data property which contains the actual backend response
    return response.data;
};
exports.createProject = createProject;
// Function to update an existing project
const updateProject = async (projectId, payload) => {
    // PATCH or PUT request to the specific project endpoint
    // Using PATCH as typically not all fields are sent
    const responseData = await base_1.axiosInstance.patch(`/projects/${projectId}`, payload);
    // Use double cast
    return responseData;
};
exports.updateProject = updateProject;
// Function to delete a project
const deleteProject = async (projectId) => {
    // DELETE request to the specific project endpoint
    const responseData = await base_1.axiosInstance.delete(`/projects/${projectId}`);
    // Use double cast
    return responseData;
};
exports.deleteProject = deleteProject;
// Add functions for createProject, updateProject, deleteProject etc. as needed 
