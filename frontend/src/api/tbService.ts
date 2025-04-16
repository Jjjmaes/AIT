// import api from './api'; // Remove old import
import { axiosInstance as api } from './base'; // Import and alias the correct instance
import { message } from 'antd';

// Placeholder Interface (adjust based on actual backend data)
export interface TermBase {
  _id: string;
  name: string;
  // Add other relevant fields: languagePairs, createdAt, etc.
}

// Function to fetch all Term Bases
// Assuming endpoint GET /term-bases returns { success: boolean, data: TermBase[] }
export const getTermBases = async (): Promise<TermBase[]> => {
    try {
        const response = await api.get<{ success: boolean, data: TermBase[], message?: string }>('/api/term-bases');

        if (response.data && response.data.success && Array.isArray(response.data.data)) {
            return response.data.data;
        } else {
            console.error("Failed to fetch Term Bases:", response.data?.message || 'No data returned');
            message.error(response.data?.message || "Failed to fetch Term Bases.");
            return [];
        }
    } catch (error: any) {
        console.error("Error fetching Term Bases:", error);
        const errorMsg = error.response?.data?.message || error.message || "An unknown error occurred";
        message.error(`Error fetching TBs: ${errorMsg}`);
        return [];
    }
};

// Add other TB-related API functions (create, update, delete, import, export, etc.) as needed 