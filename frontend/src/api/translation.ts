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
 * Get translation job status (based on File ID)
 * NOTE: Backend wraps the response in { success: boolean, data: TranslationStatusResponse }
 */
export const getTranslationStatus = async (fileId: string): Promise<{ success: boolean; data: TranslationStatusResponse }> => {
  const response = await axiosInstance.get<{ success: boolean; data: TranslationStatusResponse }>(`/translation/status/${fileId}`);
  return response.data; // Return the whole wrapper object
};

/**
 * Cancel a translation job
 */
export const cancelTranslation = async (jobId: string) => {
  const response = await axiosInstance.post(`/translation/cancel/${jobId}`);
  return response.data;
}; 