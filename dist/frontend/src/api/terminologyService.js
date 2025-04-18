"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTerminologyBases = void 0;
/**
 * Placeholder function to fetch terminology bases.
 * Replace with actual API call and error handling.
 */
const getTerminologyBases = async (params) => {
    console.log('[API Placeholder] Fetching terminology bases with params:', params);
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 300));
    // --- Replace with actual API call --- 
    // Example:
    // try {
    //   const response = await axiosInstance.get<TerminologyListResponse>('/api/terminology', { params });
    //   if (response.data.success) {
    //     return response.data.data;
    //   } else {
    //     console.error('Failed to fetch terminology bases:', response.data.message);
    //     return [];
    //   }
    // } catch (error) {
    //   console.error('Error calling getTerminologyBases API:', error);
    //   return [];
    // }
    // ------------------------------------
    // Return empty array for now
    return [];
};
exports.getTerminologyBases = getTerminologyBases;
