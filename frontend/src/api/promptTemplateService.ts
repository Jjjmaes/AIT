// import api from './api'; // Remove old import
import { axiosInstance as api } from './base'; // Import and alias the correct instance

// Interface for a single prompt template (match backend model)
// Adjust fields based on src/models/promptTemplate.model.ts
export interface PromptTemplate {
  _id: string;
  name: string;
  description?: string;
  type: 'translation' | 'review'; // Renamed from taskType to match page component
  modelId: string; // Added from page component
  sourceLang?: string; // Added from page component
  targetLang?: string; // Added from page component
  domain?: string; // Added from page component
  isActive: boolean; // Added from page component
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Interface for the API response when fetching templates
export interface PromptTemplatesResponse {
  success: boolean;
  data?: {
    templates: PromptTemplate[];
    // Add pagination if backend supports it
  };
  message?: string;
}

// TODO: Define params interface if filtering is needed (e.g., by type)
// export interface GetPromptTemplatesParams { ... }

// Function to fetch prompt templates
export const getPromptTemplates = async (/* params?: GetPromptTemplatesParams */): Promise<PromptTemplatesResponse> => {
  const response = await api.get<PromptTemplatesResponse>('/api/prompts' /*, { params }*/);
  // Return response.data as 'api' interceptor returns full response
  return response.data;
};

// TODO: Add functions for getById, create, update, delete if needed later 