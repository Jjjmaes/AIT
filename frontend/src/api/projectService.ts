import api from './api';
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
  // api.get returns the full AxiosResponse<PaginatedProjectsResponse>
  const responseData = await api.get<PaginatedProjectsResponse>('/projects', { params, ...config }); 
  // Return the data part of the response, which matches the PaginatedProjectsResponse type
  return responseData.data; 
};

// Type for the response when fetching a single project
export interface ProjectDetailResponse {
  success: boolean;
  data?: { project: Project }; // Project data is nested inside data
  message?: string; // Error message if not successful
}

// Modify getProjectById to accept config
export const getProjectById = async (projectId: string, config?: AxiosRequestConfig): Promise<ProjectDetailResponse> => {
  // Pass the config (which might contain the signal) to api.get
  const response = await api.get<ProjectDetailResponse>(`/projects/${projectId}`, config);
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
  // api.post returns the full AxiosResponse
  const response = await api.post<CreateProjectResponse>('/projects', payload); 
  // Return the .data property which contains the actual backend response
  return response.data;
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
  const responseData = await api.patch<UpdateProjectResponse>(`/projects/${projectId}`, payload); // Use api
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
  const responseData = await api.delete<DeleteProjectResponse>(`/projects/${projectId}`); // Use api
  // Use double cast
  return responseData as unknown as DeleteProjectResponse;
};

// Add functions for createProject, updateProject, deleteProject etc. as needed 