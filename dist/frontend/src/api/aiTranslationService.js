"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startSingleFileAITranslation = void 0;
const base_1 = require("./base");
// --- Function to start translation FOR A SINGLE FILE ---
// Renamed for clarity, takes projectId and fileId
const startSingleFileAITranslation = async (projectId, fileId, payload) => {
    // Remove leading /api/ assuming base URL already includes it
    const apiUrl = `/projects/${projectId}/files/${fileId}/translate`;
    console.warn(`Calling AI translation endpoint: POST ${apiUrl}`, payload.options);
    try {
        // API call payload is just the payload object { options: { ... } }
        const response = await base_1.axiosInstance.post(apiUrl, payload);
        return response.data;
    }
    catch (error) {
        console.error(`Error starting AI translation for file ${fileId}:`, error);
        // Attempt to return a standard error structure
        const message = error.response?.data?.message || error.message || "Failed to start AI translation.";
        return { success: false, message };
    }
};
exports.startSingleFileAITranslation = startSingleFileAITranslation;
// Add other AI translation related functions if needed (e.g., get job status) 
