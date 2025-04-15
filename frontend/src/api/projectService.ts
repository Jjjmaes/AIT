import apiClient from './client';
import { AxiosRequestConfig } from 'axios';

// Interface for a single prompt template
// Assuming this is defined in promptTemplateService.ts
import { PromptTemplate } from './promptTemplateService';

// TODO: Define a basic Project type matching backend response
export interface Project {
  _id: string;
  name: string;
  description?: string;
  // Add other fields needed for the project list/detail view
  deadline?: string; // Backend sends Date, but JSON conversion might make it string
  priority?: number;
  domain?: string;
  industry?: string;
  status: string; // Add status field (backend uses enum, frontend receives string)
  // Add prompt template fields (can be populated object or just ID)
  defaultTranslationPromptTemplate?: PromptTemplate | { _id: string }; // Allow populated or just ID
  defaultReviewPromptTemplate?: PromptTemplate | { _id: string };
  translationPromptTemplate?: PromptTemplate | { _id: string }; // Project specific templates
  reviewPromptTemplate?: PromptTemplate | { _id: string };
  createdAt: string; 
  updatedAt: string;
  manager?: { _id: string, username: string }; // Example populated field
  languagePairs?: { source: string, target: string }[];
}

// Type for the API response when fetching projects
// This is the full structure returned by the *backend*
export interface PaginatedProjectsResponse {
  success: boolean;
  data: { // Controller wraps the service result in 'data'
    projects: Project[]; // Project array is inside data.projects
    pagination: {        // Pagination info is inside data.pagination
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
  message?: string; // Optional message (might be at top level on error)
}

export interface GetProjectsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string; // Add status filter param
  priority?: number; // Add priority filter param (already exists, just confirming)
  // Add other filter params if needed (e.g., sortBy, sortOrder)
}

// Function to fetch projects with optional params and Axios config
export const getProjects = async (params?: GetProjectsParams, config?: AxiosRequestConfig): Promise<PaginatedProjectsResponse> => {
  const responseData = await apiClient.get<PaginatedProjectsResponse>('/api/projects', { params, ...config }); // Pass params and config
  // Use double cast due to interceptor
  return responseData as unknown as PaginatedProjectsResponse;
};

// Type for the response when fetching a single project
export interface ProjectDetailResponse {
  success: boolean;
  data?: Project; // Project data if successful
  message?: string; // Error message if not successful
}

// Apply the same fix here
export const getProjectById = async (projectId: string): Promise<ProjectDetailResponse> => {
  const responseData = await apiClient.get<ProjectDetailResponse>(`/api/projects/${projectId}`);
  // Use a double cast for consistency
  return responseData as unknown as ProjectDetailResponse;
};

// --- Project Creation ---

// Define the type for the data needed to create a project (Frontend DTO)
// Based on backend CreateProjectDto but excluding 'manager' (added by backend)
// and using string for potential ObjectId references if needed.
export interface CreateProjectPayload {
  name: string;
  description?: string;
  languagePairs: { source: string; target: string }[];
  reviewers?: string[]; // Add optional reviewers field (array of user IDs)
  // Add other fields based on requirement.md and backend DTO
  deadline?: string; // Send as ISO string or let backend parse
  priority?: number;
  domain?: string;
  industry?: string;
  // Add template fields
  defaultTranslationPromptTemplate?: string; // Send ID as string
  defaultReviewPromptTemplate?: string; // Send ID as string
  // Optional: Add specific translation/review templates if needed by backend
  // translationPromptTemplate?: string;
  // reviewPromptTemplate?: string;
}

// Define the type for the response when creating a project
// Based on the backend controller response structure
export interface CreateProjectResponse {
  success: boolean;
  data?: { project: Project }; // Nested project data
  message?: string;
}

// Function to create a new project
export const createProject = async (payload: CreateProjectPayload): Promise<CreateProjectResponse> => {
  // POST request to the projects endpoint
  const responseData = await apiClient.post<CreateProjectResponse>('/api/projects', payload);
  // Use double cast because TS infers AxiosResponse, but interceptor returns the data part
  return responseData as unknown as CreateProjectResponse;
};

// --- Project Update ---

// Define the type for the data needed to update a project (Frontend DTO)
// Fields are optional as per backend UpdateProjectDto
export interface UpdateProjectPayload {
  name?: string;
  description?: string;
  languagePairs?: { source: string; target: string }[];
  deadline?: string; // Send as ISO string or let backend parse
  priority?: number;
  domain?: string;
  industry?: string;
  status?: string; // Allow updating status
  // Add prompt template fields (send ID as string)
  defaultTranslationPromptTemplate?: string;
  defaultReviewPromptTemplate?: string;
  // translationPromptTemplate?: string; // Optional
  // reviewPromptTemplate?: string; // Optional
}

// Define the type for the response when updating a project
// Assuming it returns the updated project, similar to create
export interface UpdateProjectResponse {
  success: boolean;
  data?: { project: Project }; // Updated project data
  message?: string;
}

// Function to update an existing project
export const updateProject = async (projectId: string, payload: UpdateProjectPayload): Promise<UpdateProjectResponse> => {
  // PATCH or PUT request to the specific project endpoint
  // Using PATCH as typically not all fields are sent
  const responseData = await apiClient.patch<UpdateProjectResponse>(`/api/projects/${projectId}`, payload);
  // Use double cast
  return responseData as unknown as UpdateProjectResponse;
};

// --- Project Deletion ---

// Define the type for the response when deleting a project
// Based on backend controller response
export interface DeleteProjectResponse {
  success: boolean;
  message?: string;
  data?: any; // Backend might return some result, define if needed
}

// Function to delete a project
export const deleteProject = async (projectId: string): Promise<DeleteProjectResponse> => {
  // DELETE request to the specific project endpoint
  const responseData = await apiClient.delete<DeleteProjectResponse>(`/api/projects/${projectId}`);
  // Use double cast
  return responseData as unknown as DeleteProjectResponse;
};

// Add functions for createProject, updateProject, deleteProject etc. as needed 