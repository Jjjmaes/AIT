import { axiosInstance } from './base';
import { AxiosRequestConfig } from 'axios';

// Placeholder types to resolve lint errors - Ideally import from shared types
interface PromptTemplate {
  _id: string;
  [key: string]: any; // Allow other properties
}

interface PromptTemplatesResponse {
  success: boolean;
  data?: {
    templates: PromptTemplate[];
  };
  message?: string;
}
// End placeholder types

/**
 * Get all prompt templates with optional filtering
 */
export const getPromptTemplates = async (params?: any): Promise<PromptTemplatesResponse> => {
  try {
    const response = await axiosInstance.get('/prompts', { params }); // Removed /api/
    return response.data;
  } catch (error: any) {
    console.error('Error fetching prompt templates:', error.response?.data || error.message);
    throw error.response?.data || new Error('Failed to fetch prompt templates');
  }
};

/**
 * Get a single prompt template by ID
 */
export const getPromptTemplateById = async (id: string): Promise<PromptTemplate> => {
  try {
    const response = await axiosInstance.get(`/prompts/${id}`); // Removed /api/
    // Assuming the API returns { success: true, data: { template: {...} } }
    if (response.data?.success && response.data?.data?.template) {
      return response.data.data.template;
    } else {
      throw new Error(response.data?.message || 'Failed to retrieve template data or invalid format');
    }
  } catch (error: any) {
    console.error(`Error fetching prompt template ${id}:`, error.response?.data || error.message);
    throw error.response?.data || new Error('Failed to fetch prompt template by ID');
  }
};

/**
 * Create a new prompt template
 */
export const createPromptTemplate = async (templateData: any): Promise<PromptTemplate> => {
  try {
    const response = await axiosInstance.post('/prompts', templateData); // Removed /api/
     // Assuming the API returns { success: true, data: { template: {...} } }
    if (response.data?.success && response.data?.data?.template) {
      return response.data.data.template;
    } else {
      throw new Error(response.data?.message || 'Failed to create template or invalid response format');
    }
  } catch (error: any) {
    console.error('Error creating prompt template:', error.response?.data || error.message);
    throw error.response?.data || new Error('Failed to create prompt template');
  }
};

/**
 * Update an existing prompt template
 */
export const updatePromptTemplate = async (id: string, templateData: any): Promise<PromptTemplate> => {
  try {
    const response = await axiosInstance.put(`/prompts/${id}`, templateData); // Removed /api/
    // Assuming the API returns { success: true, data: { template: {...} } }
     if (response.data?.success && response.data?.data?.template) {
      return response.data.data.template;
    } else {
      throw new Error(response.data?.message || 'Failed to update template or invalid response format');
    }
  } catch (error: any) {
    console.error(`Error updating prompt template ${id}:`, error.response?.data || error.message);
    throw error.response?.data || new Error('Failed to update prompt template');
  }
};

/**
 * Delete a prompt template
 */
export const deletePromptTemplate = async (id: string): Promise<{ success: boolean; message?: string }> => {
  try {
    const response = await axiosInstance.delete(`/prompts/${id}`); // Removed /api/
    // Assuming API returns { success: true, message?: '...' }
    return response.data;
  } catch (error: any) {
    console.error(`Error deleting prompt template ${id}:`, error.response?.data || error.message);
    throw error.response?.data || new Error('Failed to delete prompt template');
  }
};

/**
 * Test a prompt template
 */
export const testPromptTemplate = async (templateId: string, testData: any) => {
  const response = await axiosInstance.post(`/prompts/${templateId}/test`, testData); // Removed /api/
  return response.data;
}; 