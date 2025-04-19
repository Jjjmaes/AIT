import { axiosInstance as api } from './base';

// Define the structure of the payload expected by the backend FOR A SINGLE FILE
// Updated to match backend controller expectations (aiConfigId, promptTemplateId at top level)
export interface StartSingleFileAIPayload {
  aiConfigId: string; // Required by backend controller
  promptTemplateId: string; // Required by backend controller
  options?: { // Keep options for other, optional settings
    tmId?: string | null;
    tbId?: string | null;
    retranslateTM?: boolean; // Add the optional flag
    // Add other options if backend expects them
  };
}

// Define the structure of the response expected from the backend
// Updated to match the actual API response structure
export interface StartAITranslationResponse {
  success: boolean;
  message?: string;
  data?: {        // Add the nested data object
    jobId?: string; // jobId is inside data
  };
}

// --- Function to start translation FOR A SINGLE FILE ---
// Renamed for clarity, takes projectId and fileId
export const startSingleFileAITranslation = async (
    projectId: string,
    fileId: string,
    payload: StartSingleFileAIPayload
): Promise<StartAITranslationResponse> => {
    // Remove leading /api/ assuming base URL already includes it
    const apiUrl = `/projects/${projectId}/files/${fileId}/translate`;
    console.warn(`Calling AI translation endpoint: POST ${apiUrl}`, payload.options);
    try {
        // API call payload is just the payload object { options: { ... } }
        const response = await api.post<StartAITranslationResponse>(apiUrl, payload);
        return response.data;
    } catch (error: any) {
        console.error(`Error starting AI translation for file ${fileId}:`, error);
        // Attempt to return a standard error structure
        const message = error.response?.data?.message || error.message || "Failed to start AI translation.";
        return { success: false, message };
    }
};

// Add other AI translation related functions if needed (e.g., get job status) 