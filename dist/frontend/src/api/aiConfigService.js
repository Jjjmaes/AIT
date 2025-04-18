"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAIConfig = exports.updateAIConfig = exports.createAIConfig = exports.getAIConfigById = exports.getAllAIConfigs = void 0;
const base_1 = require("./base"); // Import and alias the correct instance
// --- API Functions ---
/**
 * Fetches all AI configurations (for admin).
 */
const getAllAIConfigs = async () => {
    const response = await base_1.axiosInstance.get('/ai-configs');
    return response.data;
};
exports.getAllAIConfigs = getAllAIConfigs;
/**
 * Fetches a single AI configuration by ID (for admin).
 * Includes the API key, handle carefully in the UI.
 */
const getAIConfigById = async (configId) => {
    const response = await base_1.axiosInstance.get(`/ai-configs/${configId}`);
    return response.data;
};
exports.getAIConfigById = getAIConfigById;
/**
 * Creates a new AI configuration (for admin).
 */
const createAIConfig = async (payload) => {
    const response = await base_1.axiosInstance.post('/ai-configs', payload);
    return response.data;
};
exports.createAIConfig = createAIConfig;
/**
 * Updates an existing AI configuration (for admin).
 */
const updateAIConfig = async (configId, payload) => {
    const response = await base_1.axiosInstance.put(`/ai-configs/${configId}`, payload);
    return response.data;
};
exports.updateAIConfig = updateAIConfig;
/**
 * Deletes an AI configuration (for admin).
 */
const deleteAIConfig = async (configId) => {
    const response = await base_1.axiosInstance.delete(`/ai-configs/${configId}`);
    return response.data;
};
exports.deleteAIConfig = deleteAIConfig;
