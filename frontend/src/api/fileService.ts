import { axiosInstance } from './base';

// Define and export Issue type
export interface Issue {
  id: string; // Assuming issues have an ID
  type: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  // Add other relevant issue fields if needed
}

// Define and export SegmentStatus as an enum
export enum SegmentStatus {
  PENDING_REVIEW = 'PENDING_REVIEW',
  EDITED = 'EDITED',
  COMPLETED = 'COMPLETED',
  REVIEWING = 'REVIEWING', // Added reviewing based on SegmentReview expectation
  // Add other relevant statuses as needed
}

// Basic interface representing a file associated with a project
// Adjust based on the actual data returned by the backend
export interface ProjectFile {
  _id: string;
  fileName: string;
  originalFilename?: string; // Added optional original filename
  projectId?: string; // Added optional projectId if available at file level
  sourceLanguage: string; // Changed from originalLanguage
  targetLanguage: string;
  status: string; // General status (e.g., 'PROCESSING', 'READY_FOR_REVIEW', 'DONE')
  progress?: number; // Overall file progress
  // Added detailed progress tracking fields (ensure backend provides these)
  totalSegments?: number;
  completedSegments?: number;
  pendingSegments?: number;
  wordCount?: number;
  createdAt: string;
  updatedAt: string;
  // Add any other relevant fields: fileSize, mimeType, etc.
}

// Type for the API response when listing files for a project
export interface FilesListResponse {
  success: boolean;
  data?: ProjectFile[]; // Array of files if successful
  message?: string;     // Error message if not successful
  // Add pagination info if the endpoint supports it
}

// Type for the API response when uploading a file
export interface FileUploadResponse {
  success: boolean;
  data: FileType;
  message?: string;
}

export interface StartTranslationResponse {
  success: boolean;
  message: string;
}

export interface FileDetailResponse {
  success: boolean;
  file: FileType;
  message?: string;
}

export interface Segment {
  id: string;
  fileId: string;
  index: number;
  source: string;
  target: string;
  status: 'pending' | 'translated' | 'reviewed';
}

export interface GetSegmentsResponse {
  success: boolean;
  segments: Segment[];
  total: number;
  message?: string;
}

export interface UpdateSegmentPayload {
  target: string;
  status?: 'pending' | 'translated' | 'reviewed';
}

export interface UpdateSegmentResponse {
  success: boolean;
  segment: Segment;
  message?: string;
}

// Update FileType to match backend IFile model
export interface FileType {
  _id: string; 
  fileName: string; 
  originalName?: string; 
  fileSize: number; 
  mimeType: string;
  // Re-checked src/models/file.model.ts FileStatus enum again
  status: 'pending' | 'processing' | 'extracted' | 'translating' | 'translated' | 'reviewing' | 'review_completed' | 'completed' | 'error'; 
  createdAt: string; 
  projectId?: string;
}

// 添加缺失的类型定义
export interface GetFilesResponse {
  success: boolean;
  files: FileType[];
  message?: string;
}

export interface DeleteFileResponse {
  success: boolean;
  message?: string;
}

/**
 * Get all files
 */
export const getAllFiles = async (): Promise<FileType[]> => {
  const response = await axiosInstance.get<GetFilesResponse>('/files');
  return response.data.files;
};

/**
 * Get files by project ID
 */
export const getFilesByProjectId = async (projectId: string): Promise<FileType[]> => {
  try {
    // Backend seems to return { success: boolean, data: FileType[] }
    // Adjust the expected response type if needed, or use 'any' and check dynamically
    const response = await axiosInstance.get<{ success: boolean; data?: FileType[]; message?: string }>(`/projects/${projectId}/files`);
    
    // Check if the request was successful and the data array exists
    if (response?.data?.success && Array.isArray(response.data.data)) {
      return response.data.data; // Return the nested data array
    } else {
      // Log unexpected structure or unsuccessful response
      console.warn(`Request for files of project ${projectId} was not successful or data format is incorrect:`, response?.data);
      return []; 
    }
  } catch (error) {
    // Log the error and return empty array
    console.error(`Error fetching files for project ${projectId}:`, error);
    return []; 
  }
};

/**
 * Upload a file
 */
export const uploadFile = async (file: File, projectId?: string): Promise<FileType> => {
  const uploadUrl = projectId ? `/projects/${projectId}/files` : '/files/upload';
  
  const formData = new FormData();
  formData.append('file', file);
  
  console.log(`[fileService] Uploading '${file.name}' to ${uploadUrl}`);
  
  try {
    const response = await axiosInstance.post<FileUploadResponse>(uploadUrl, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    // --- DEBUG LOGGING --- 
    console.log('[fileService] Raw Axios response:', response);
    console.log('[fileService] response.data:', response.data);
    console.log('[fileService] response.data.data (expected FileType):', response.data.data);
    // --- END DEBUG LOGGING --- 
    
    // Check if the expected nested data exists before returning
    if (response?.data?.data) {
      return response.data.data; 
    } else {
      // Throw an error if the structure is not as expected
      console.error('[fileService] Error: response.data.data is missing or undefined.', response.data);
      throw new Error('Upload response format error: missing nested data.');
    }
  } catch (error) {
    console.error(`[fileService] Error during uploadFile for '${file.name}':`, error);
    // Re-throw the error to be caught by the calling component
    throw error;
  }
};

/**
 * Delete a file
 */
export const deleteFile = async (fileId: string): Promise<boolean> => {
  const response = await axiosInstance.delete<DeleteFileResponse>(`/files/${fileId}`);
  return response.data.success;
};

/**
 * Start translation process for a file
 */
export const startFileTranslation = async (projectId: string, fileId: string): Promise<StartTranslationResponse> => {
  const response = await axiosInstance.post<StartTranslationResponse>(`/projects/${projectId}/files/${fileId}/translate`);
  return response.data;
};

/**
 * Get file details
 */
export const getFileDetails = async (fileId: string): Promise<FileType> => {
  const response = await axiosInstance.get<FileDetailResponse>(`/files/${fileId}`);
  return response.data.file;
};

/**
 * Get segments for a file
 */
export const getFileSegments = async (
  fileId: string,
  params?: { page?: number; limit?: number; status?: string }
): Promise<GetSegmentsResponse> => {
  const response = await axiosInstance.get<GetSegmentsResponse>(`/files/${fileId}/segments`, { params });
  return response.data;
};

/**
 * Update a segment
 */
export const updateSegment = async (
  segmentId: string,
  payload: UpdateSegmentPayload
): Promise<Segment> => {
  const response = await axiosInstance.patch<UpdateSegmentResponse>(`/segments/${segmentId}`, payload);
  return response.data.segment;
};

// TODO: Add functions for getFileDetails, deleteFile etc. as needed 