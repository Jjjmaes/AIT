"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testPromptTemplate = exports.deletePromptTemplate = exports.updatePromptTemplate = exports.createPromptTemplate = exports.getPromptTemplateById = exports.getPromptTemplates = void 0;
const base_1 = require("./base");
// End placeholder types
/**
 * Get all prompt templates with optional filtering
 */
const getPromptTemplates = async (params) => {
    try {
        const response = await base_1.axiosInstance.get('/prompts', { params }); // Removed /api/
        return response.data;
    }
    catch (error) {
        console.error('Error fetching prompt templates:', error.response?.data || error.message);
        throw error.response?.data || new Error('Failed to fetch prompt templates');
    }
};
exports.getPromptTemplates = getPromptTemplates;
/**
 * Get a single prompt template by ID
 */
const getPromptTemplateById = async (id) => {
    try {
        const response = await base_1.axiosInstance.get(`/prompts/${id}`); // Removed /api/
        // Assuming the API returns { success: true, data: { template: {...} } }
        if (response.data?.success && response.data?.data?.template) {
            return response.data.data.template;
        }
        else {
            throw new Error(response.data?.message || 'Failed to retrieve template data or invalid format');
        }
    }
    catch (error) {
        console.error(`Error fetching prompt template ${id}:`, error.response?.data || error.message);
        throw error.response?.data || new Error('Failed to fetch prompt template by ID');
    }
};
exports.getPromptTemplateById = getPromptTemplateById;
/**
 * Create a new prompt template
 */
const createPromptTemplate = async (templateData) => {
    try {
        const response = await base_1.axiosInstance.post('/prompts', templateData); // Removed /api/
        // Assuming the API returns { success: true, data: { template: {...} } }
        if (response.data?.success && response.data?.data?.template) {
            return response.data.data.template;
        }
        else {
            throw new Error(response.data?.message || 'Failed to create template or invalid response format');
        }
    }
    catch (error) {
        console.error('Error creating prompt template:', error.response?.data || error.message);
        throw error.response?.data || new Error('Failed to create prompt template');
    }
};
exports.createPromptTemplate = createPromptTemplate;
/**
 * Update an existing prompt template
 */
const updatePromptTemplate = async (id, templateData) => {
    try {
        const response = await base_1.axiosInstance.put(`/prompts/${id}`, templateData); // Removed /api/
        // Assuming the API returns { success: true, data: { template: {...} } }
        if (response.data?.success && response.data?.data?.template) {
            return response.data.data.template;
        }
        else {
            throw new Error(response.data?.message || 'Failed to update template or invalid response format');
        }
    }
    catch (error) {
        console.error(`Error updating prompt template ${id}:`, error.response?.data || error.message);
        throw error.response?.data || new Error('Failed to update prompt template');
    }
};
exports.updatePromptTemplate = updatePromptTemplate;
/**
 * Delete a prompt template
 */
const deletePromptTemplate = async (id) => {
    try {
        const response = await base_1.axiosInstance.delete(`/prompts/${id}`); // Removed /api/
        // Assuming API returns { success: true, message?: '...' }
        return response.data;
    }
    catch (error) {
        console.error(`Error deleting prompt template ${id}:`, error.response?.data || error.message);
        throw error.response?.data || new Error('Failed to delete prompt template');
    }
};
exports.deletePromptTemplate = deletePromptTemplate;
/**
 * Test a prompt template
 */
const testPromptTemplate = async (templateId, testData) => {
    const response = await base_1.axiosInstance.post(`/prompts/${templateId}/test`, testData); // Removed /api/
    return response.data;
};
exports.testPromptTemplate = testPromptTemplate;
