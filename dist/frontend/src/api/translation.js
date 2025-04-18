"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelTranslation = exports.getTranslationStatus = exports.startTranslation = void 0;
const base_1 = require("./base");
/**
 * Start a translation job for selected files
 */
const startTranslation = async (data) => {
    const response = await base_1.axiosInstance.post('/translation/start', data);
    return response.data;
};
exports.startTranslation = startTranslation;
/**
 * Get translation job status (based on File ID)
 * NOTE: Backend wraps the response in { success: boolean, data: TranslationStatusResponse }
 */
const getTranslationStatus = async (fileId) => {
    const response = await base_1.axiosInstance.get(`/translation/status/${fileId}`);
    return response.data; // Return the whole wrapper object
};
exports.getTranslationStatus = getTranslationStatus;
/**
 * Cancel a translation job
 */
const cancelTranslation = async (jobId) => {
    const response = await base_1.axiosInstance.post(`/translation/cancel/${jobId}`);
    return response.data;
};
exports.cancelTranslation = cancelTranslation;
