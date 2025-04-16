// import api from './api'; // Remove old import
import { axiosInstance as api } from './base'; // Import and alias the correct instance
import { message } from 'antd';

// Placeholder Interface (adjust based on actual backend data)
export interface TranslationMemory {
  _id: string;
  name: string;
  // Add other relevant fields: languagePairs, createdAt, etc.
}

// Function to fetch all Translation Memories
// Assuming endpoint GET /translation-memories returns { success: boolean, data: TranslationMemory[] }
export const getTranslationMemories = async (): Promise<TranslationMemory[]> => {
    try {
        const response = await api.get<{ success: boolean, data: TranslationMemory[], message?: string }>('/api/translation-memories');

        if (response.data && response.data.success && Array.isArray(response.data.data)) {
            return response.data.data;
        } else {
            console.error("Failed to fetch Translation Memories:", response.data?.message || 'No data returned');
            message.error(response.data?.message || "Failed to fetch Translation Memories.");
            return [];
        }
    } catch (error: any) {
        console.error("Error fetching Translation Memories:", error);
        const errorMsg = error.response?.data?.message || error.message || "An unknown error occurred";
        message.error(`Error fetching TMs: ${errorMsg}`);
        return [];
    }
};

// Add other TM-related API functions (create, update, delete, etc.) as needed 