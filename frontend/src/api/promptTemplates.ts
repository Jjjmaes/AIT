import { axiosInstance } from './base';

/**
 * Get all prompt templates with optional filtering
 */
export const getPromptTemplates = async (params?: any) => {
  const response = await axiosInstance.get('/api/prompts', { params });
  return response.data.data.templates;
};

/**
 * Get a single prompt template by ID
 */
export const getPromptTemplate = async (templateId: string) => {
  const response = await axiosInstance.get(`/api/prompts/${templateId}`);
  return response.data.data.template;
};

/**
 * Create a new prompt template
 */
export const createPromptTemplate = async (templateData: any) => {
  const response = await axiosInstance.post('/api/prompts', templateData);
  return response.data;
};

/**
 * Update an existing prompt template
 */
export const updatePromptTemplate = async (templateId: string, templateData: any) => {
  const response = await axiosInstance.patch(`/api/prompts/${templateId}`, templateData);
  return response.data;
};

/**
 * Delete a prompt template
 */
export const deletePromptTemplate = async (templateId: string) => {
  const response = await axiosInstance.delete(`/api/prompts/${templateId}`);
  return response.data;
};

/**
 * Test a prompt template
 */
export const testPromptTemplate = async (templateId: string, testData: any) => {
  const response = await axiosInstance.post(`/api/prompts/${templateId}/test`, testData);
  return response.data;
}; 