"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPromptTemplates = void 0;
// import api from './api'; // Remove old import
const base_1 = require("./base"); // Import and alias the correct instance
// TODO: Define params interface if filtering is needed (e.g., by type)
// export interface GetPromptTemplatesParams { ... }
// Function to fetch prompt templates
const getPromptTemplates = async ( /* params?: GetPromptTemplatesParams */) => {
    const response = await base_1.axiosInstance.get('/prompts' /*, { params }*/);
    // Return response.data as 'api' interceptor returns full response
    return response.data;
};
exports.getPromptTemplates = getPromptTemplates;
// TODO: Add functions for getById, create, update, delete if needed later 
