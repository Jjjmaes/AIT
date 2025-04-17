import { axiosInstance } from './base';

// Placeholder type - Replace with actual import if available
interface AIConfig {
  id: string;
  name: string;
  provider: string;
  // Add other expected fields
  createdAt?: string;
  updatedAt?: string;
}
// End Placeholder

/**
 * Get all AI configurations
 */
export const getAIConfigs = async (): Promise<AIConfig[]> => {
  try {
    const response = await axiosInstance.get('/ai-configs');
    if (response.data?.success && Array.isArray(response.data?.data?.configs)) {
      return response.data.data.configs;
    } else {
      console.error('Invalid data structure received for AI configs:', response.data);
      return [];
    }
  } catch (error: any) {
    console.error('Error fetching AI configurations:', error.response?.data || error.message);
    throw error.response?.data || new Error('Failed to fetch AI configurations');
  }
};

/**
 * Get a single AI configuration by ID
 */
export const getAIConfigById = async (id: string): Promise<AIConfig | null> => {
  try {
    const response = await axiosInstance.get(`/ai-configs/${id}`);
    if (response.data?.success && response.data?.data?.config) {
      return response.data.data.config;
    } else {
      console.error(`Invalid data structure received for AI config ${id}:`, response.data);
      return null;
    }
  } catch (error: any) {
    console.error(`Error fetching AI config ${id}:`, error.response?.data || error.message);
    return null;
  }
};

/**
 * Create a new AI configuration
 */
export const createAIConfig = async (configData: Omit<AIConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<AIConfig> => {
  try {
    const response = await axiosInstance.post('/ai-configs', configData);
    if (response.data?.success && response.data?.data?.config) {
      return response.data.data.config;
    } else {
      throw new Error(response.data?.message || 'Failed to create AI config or invalid response format');
    }
  } catch (error: any) {
    console.error('Error creating AI configuration:', error.response?.data || error.message);
    throw error.response?.data || new Error('Failed to create AI configuration');
  }
};

/**
 * Update an existing AI configuration
 */
export const updateAIConfig = async (id: string, configData: Partial<Omit<AIConfig, 'id' | 'createdAt' | 'updatedAt'>>): Promise<AIConfig> => {
  try {
    const response = await axiosInstance.put(`/ai-configs/${id}`, configData);
    if (response.data?.success && response.data?.data?.config) {
      return response.data.data.config;
    } else {
      throw new Error(response.data?.message || 'Failed to update AI config or invalid response format');
    }
  } catch (error: any) {
    console.error(`Error updating AI config ${id}:`, error.response?.data || error.message);
    throw error.response?.data || new Error('Failed to update AI configuration');
  }
};

/**
 * Delete an AI configuration
 */
export const deleteAIConfig = async (id: string): Promise<{ success: boolean; message?: string }> => {
  try {
    const response = await axiosInstance.delete(`/ai-configs/${id}`);
    return response.data;
  } catch (error: any) {
    console.error(`Error deleting AI config ${id}:`, error.response?.data || error.message);
    throw error.response?.data || new Error('Failed to delete AI configuration');
  }
};

/**
 * Test an AI configuration
 */
export const testAIConfig = async (configId: string, testData: any) => {
  const response = await axiosInstance.post(`/ai-configs/${configId}/test`, testData);
  return response.data;
}; 