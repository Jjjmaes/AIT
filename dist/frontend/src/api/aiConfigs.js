"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testAIConfig = exports.deleteAIConfig = exports.updateAIConfig = exports.createAIConfig = exports.getAIConfigById = exports.getAIConfigs = void 0;
const base_1 = require("./base");
// End Placeholder
/**
 * Get all AI configurations
 */
const getAIConfigs = async () => {
    try {
        const response = await base_1.axiosInstance.get('/ai-configs');
        if (response.data?.success && Array.isArray(response.data?.data?.configs)) {
            return response.data.data.configs;
        }
        else {
            console.error('Invalid data structure received for AI configs:', response.data);
            return [];
        }
    }
    catch (error) {
        console.error('Error fetching AI configurations:', error.response?.data || error.message);
        throw error.response?.data || new Error('Failed to fetch AI configurations');
    }
};
exports.getAIConfigs = getAIConfigs;
/**
 * Get a single AI configuration by ID
 */
const getAIConfigById = async (id) => {
    try {
        const response = await base_1.axiosInstance.get(`/ai-configs/${id}`);
        if (response.data?.success && response.data?.data?.config) {
            return response.data.data.config;
        }
        else {
            console.error(`Invalid data structure received for AI config ${id}:`, response.data);
            return null;
        }
    }
    catch (error) {
        console.error(`Error fetching AI config ${id}:`, error.response?.data || error.message);
        return null;
    }
};
exports.getAIConfigById = getAIConfigById;
/**
 * Create a new AI configuration
 */
const createAIConfig = async (configData) => {
    try {
        const response = await base_1.axiosInstance.post('/ai-configs', configData);
        if (response.data?.success && response.data?.data?.config) {
            return response.data.data.config;
        }
        else {
            throw new Error(response.data?.message || 'Failed to create AI config or invalid response format');
        }
    }
    catch (error) {
        console.error('Error creating AI configuration:', error.response?.data || error.message);
        throw error.response?.data || new Error('Failed to create AI configuration');
    }
};
exports.createAIConfig = createAIConfig;
/**
 * Update an existing AI configuration
 */
const updateAIConfig = async (id, configData) => {
    try {
        const response = await base_1.axiosInstance.put(`/ai-configs/${id}`, configData);
        if (response.data?.success && response.data?.data?.config) {
            return response.data.data.config;
        }
        else {
            throw new Error(response.data?.message || 'Failed to update AI config or invalid response format');
        }
    }
    catch (error) {
        console.error(`Error updating AI config ${id}:`, error.response?.data || error.message);
        throw error.response?.data || new Error('Failed to update AI configuration');
    }
};
exports.updateAIConfig = updateAIConfig;
/**
 * Delete an AI configuration
 */
const deleteAIConfig = async (id) => {
    try {
        const response = await base_1.axiosInstance.delete(`/ai-configs/${id}`);
        return response.data;
    }
    catch (error) {
        console.error(`Error deleting AI config ${id}:`, error.response?.data || error.message);
        throw error.response?.data || new Error('Failed to delete AI configuration');
    }
};
exports.deleteAIConfig = deleteAIConfig;
/**
 * Test an AI configuration
 */
const testAIConfig = async (configId, testData) => {
    const response = await base_1.axiosInstance.post(`/ai-configs/${configId}/test`, testData);
    return response.data;
};
exports.testAIConfig = testAIConfig;
