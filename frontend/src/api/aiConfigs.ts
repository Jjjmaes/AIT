import { axiosInstance } from './base';

/**
 * Get all AI configurations
 */
export const getAIConfigs = async () => {
  const response = await axiosInstance.get('/api/ai-configs');
  return response.data.data.configs;
};

/**
 * Get a single AI configuration by ID
 */
export const getAIConfig = async (configId: string) => {
  const response = await axiosInstance.get(`/api/ai-configs/${configId}`);
  return response.data.data.config;
};

/**
 * Create a new AI configuration
 */
export const createAIConfig = async (configData: any) => {
  const response = await axiosInstance.post('/api/ai-configs', configData);
  return response.data;
};

/**
 * Update an existing AI configuration
 */
export const updateAIConfig = async (configId: string, configData: any) => {
  const response = await axiosInstance.patch(`/api/ai-configs/${configId}`, configData);
  return response.data;
};

/**
 * Delete an AI configuration
 */
export const deleteAIConfig = async (configId: string) => {
  const response = await axiosInstance.delete(`/api/ai-configs/${configId}`);
  return response.data;
};

/**
 * Test an AI configuration
 */
export const testAIConfig = async (configId: string, testData: any) => {
  const response = await axiosInstance.post(`/api/ai-configs/${configId}/test`, testData);
  return response.data;
}; 