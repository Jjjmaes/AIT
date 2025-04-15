import apiClient from './client';

// Interface for a single prompt template (match backend model)
// Adjust fields based on src/models/promptTemplate.model.ts
export interface PromptTemplate {
  _id: string;
  name: string;
  description?: string;
  taskType: 'translation' | 'review'; // Or whatever types backend uses
  // Add other relevant fields (e.g., version, languagePairs, etc.)
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
  const responseData = await apiClient.get<PromptTemplatesResponse>('/api/prompts' /*, { params }*/);
  // Use double cast due to interceptor
  return responseData as unknown as PromptTemplatesResponse;
};

// TODO: Add functions for getById, create, update, delete if needed later 