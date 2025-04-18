"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProjectProgress = exports.getProjectStats = exports.deleteProject = exports.updateProject = exports.createProject = exports.getProject = exports.getProjects = void 0;
const base_1 = require("./base");
/**
 * Get all projects with optional filtering
 */
const getProjects = async (params, config) => {
    const response = await base_1.axiosInstance.get('/projects', { params, ...config });
    return response.data;
};
exports.getProjects = getProjects;
/**
 * Get a single project by ID
 */
const getProject = async (projectId) => {
    const response = await base_1.axiosInstance.get(`/projects/${projectId}`);
    return response.data.data.project;
};
exports.getProject = getProject;
/**
 * Create a new project
 */
const createProject = async (projectData) => {
    const response = await base_1.axiosInstance.post('/projects', projectData);
    return response.data;
};
exports.createProject = createProject;
/**
 * Update an existing project
 */
const updateProject = async (projectId, projectData) => {
    const response = await base_1.axiosInstance.patch(`/projects/${projectId}`, projectData);
    return response.data;
};
exports.updateProject = updateProject;
/**
 * Delete a project
 */
const deleteProject = async (projectId) => {
    const response = await base_1.axiosInstance.delete(`/projects/${projectId}`);
    return response.data;
};
exports.deleteProject = deleteProject;
/**
 * Get project statistics
 */
const getProjectStats = async (projectId) => {
    const response = await base_1.axiosInstance.get(`/projects/${projectId}/stats`);
    return response.data;
};
exports.getProjectStats = getProjectStats;
/**
 * Update project progress
 */
const updateProjectProgress = async (projectId, progressData) => {
    const response = await base_1.axiosInstance.put(`/projects/${projectId}/progress`, progressData);
    return response.data;
};
exports.updateProjectProgress = updateProjectProgress;
