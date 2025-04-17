import { axiosInstance } from './base';
import { AxiosRequestConfig } from 'axios';

/**
 * Get all projects with optional filtering
 */
export const getProjects = async (params?: any, config?: AxiosRequestConfig) => {
  const response = await axiosInstance.get('/projects', { params, ...config });
  return response.data;
};

/**
 * Get a single project by ID
 */
export const getProject = async (projectId: string) => {
  const response = await axiosInstance.get(`/projects/${projectId}`);
  return response.data.data.project;
};

/**
 * Create a new project
 */
export const createProject = async (projectData: any) => {
  const response = await axiosInstance.post('/projects', projectData);
  return response.data;
};

/**
 * Update an existing project
 */
export const updateProject = async (projectId: string, projectData: any) => {
  const response = await axiosInstance.patch(`/projects/${projectId}`, projectData);
  return response.data;
};

/**
 * Delete a project
 */
export const deleteProject = async (projectId: string) => {
  const response = await axiosInstance.delete(`/projects/${projectId}`);
  return response.data;
};

/**
 * Get project statistics
 */
export const getProjectStats = async (projectId: string) => {
  const response = await axiosInstance.get(`/projects/${projectId}/stats`);
  return response.data;
};

/**
 * Update project progress
 */
export const updateProjectProgress = async (projectId: string, progressData: any) => {
  const response = await axiosInstance.put(`/projects/${projectId}/progress`, progressData);
  return response.data;
}; 