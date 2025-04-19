import { axiosInstance } from './base';

interface TranslationSettings {
  promptTemplateId: string;
  aiModelId: string;
  useTerminology: boolean;
  useTranslationMemory: boolean;
}

interface TranslationStartRequest {
  projectId: string;
  fileIds: string[];
  settings: TranslationSettings;
}

export interface TranslationStatusResponse {
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  completedFiles: number;
  totalFiles: number;
  errors?: Array<{ fileId: string; message: string }>;
  files: Array<{
    id: string;
    originalName: string;
    status: string;
    progress: number;
    sourceLanguage: string;
    targetLanguage: string;
  }>;
}

/**
 * Start a translation job for selected files
 */
export const startTranslation = async (data: TranslationStartRequest) => {
  const response = await axiosInstance.post('/translation/start', data);
  return response.data;
};

/**
 * Get translation job status (based on Job ID received from start translation)
 * NOTE: Backend wraps the response in { success: boolean, data: TranslationStatusResponse }
 * NOTE: Reverted parameter to jobId to match the actual backend route
 */
export const getTranslationStatus = async (jobId: string): Promise<{ success: boolean; data: TranslationStatusResponse }> => {
  // Use jobId in the URL as defined in the backend route
  const response = await axiosInstance.get<{ success: boolean; data: TranslationStatusResponse }>(`/translation/status/${jobId}`);
  return response.data; // Return the whole wrapper object
};

/**
 * Cancel a translation job
 */
export const cancelTranslation = async (jobId: string) => {
  const response = await axiosInstance.post(`/translation/cancel/${jobId}`);
  return response.data;
}; 