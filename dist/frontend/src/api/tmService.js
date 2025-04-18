"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTranslationMemories = void 0;
// import api from './api'; // Remove old import
const base_1 = require("./base"); // Import and alias the correct instance
const antd_1 = require("antd");
// Function to fetch all Translation Memories
// Assuming endpoint GET /translation-memories returns { success: boolean, data: TranslationMemory[] }
const getTranslationMemories = async () => {
    try {
        const response = await base_1.axiosInstance.get('/api/translation-memories');
        if (response.data && response.data.success && Array.isArray(response.data.data)) {
            return response.data.data;
        }
        else {
            console.error("Failed to fetch Translation Memories:", response.data?.message || 'No data returned');
            antd_1.message.error(response.data?.message || "Failed to fetch Translation Memories.");
            return [];
        }
    }
    catch (error) {
        console.error("Error fetching Translation Memories:", error);
        const errorMsg = error.response?.data?.message || error.message || "An unknown error occurred";
        antd_1.message.error(`Error fetching TMs: ${errorMsg}`);
        return [];
    }
};
exports.getTranslationMemories = getTranslationMemories;
// Add other TM-related API functions (create, update, delete, etc.) as needed 
