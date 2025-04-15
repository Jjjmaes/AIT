import apiClient from './client';

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
  filename: string;
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
  data?: ProjectFile; // The newly created file record if successful
  message?: string;    // Error message if not successful
}

// Function to fetch files for a specific project
export const getFilesByProjectId = async (projectId: string): Promise<FilesListResponse> => {
  // Assuming the API endpoint is /api/projects/:projectId/files
  const response = await apiClient.get<FilesListResponse>(`/api/projects/${projectId}/files`);
  return response.data;
};

// Function to upload a file to a specific project
export const uploadFile = async (
  projectId: string, 
  file: File, 
  sourceLanguage: string, 
  targetLanguage: string
): Promise<FileUploadResponse> => {
  const formData = new FormData();
  formData.append('file', file); // Key 'file' must match backend expectation
  // Append languages to the FormData
  formData.append('sourceLanguage', sourceLanguage);
  formData.append('targetLanguage', targetLanguage);

  // Assuming the API endpoint is POST /api/projects/:projectId/files
  const response = await apiClient.post<FileUploadResponse>(
    `/api/projects/${projectId}/files`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
};

// --- Start File Translation ---

// Define the type for the response when starting translation
export interface StartTranslationResponse {
  success: boolean;
  message?: string;
  // Optional: Add any data returned by the backend, e.g., the updated file status
  data?: { status?: string }; 
}

// Function to trigger the translation process for a file
export const startFileTranslation = async (fileId: string): Promise<StartTranslationResponse> => {
  // POST request to the specific file's translate endpoint
  const responseData = await apiClient.post<StartTranslationResponse>(`/api/files/${fileId}/translate`);
  // Use double cast
  return responseData as unknown as StartTranslationResponse;
};

// --- File Details & Segments ---

// Interface for a single translation segment
export interface Segment {
  _id: string;
  fileId: string;
  segmentIndex: number;
  sourceText: string;
  mtText?: string;
  aiReviewedText?: string;
  humanReviewedText?: string;
  status: SegmentStatus; // Use the SegmentStatus enum
  issues?: Issue[]; // Use the defined Issue type
  createdAt: string;
  updatedAt: string;
}

// Response type for fetching single file details (could reuse ProjectFile or be more specific)
export interface FileDetailResponse {
  success: boolean;
  data?: ProjectFile; // Assuming it returns the same structure as the list
  message?: string;
}

// Response type for fetching segments for a file
export interface GetSegmentsResponse {
  success: boolean;
  data?: {
    segments: Segment[];
    total: number;
    page: number;
    limit: number;
  };
  message?: string;
}

// Payload for updating a segment (e.g., confirming or editing)
export interface UpdateSegmentPayload {
  humanReviewedText: string;
  status: SegmentStatus; // Use the SegmentStatus enum
}

// Response type for updating a segment
export interface UpdateSegmentResponse {
  success: boolean;
  data?: Segment; // Return the updated segment
  message?: string;
}

// Function to fetch detailed information for a single file
export const getFileDetails = async (fileId: string): Promise<FileDetailResponse> => {
  const responseData = await apiClient.get<FileDetailResponse>(`/api/files/${fileId}`);
  return responseData as unknown as FileDetailResponse;
};

// Function to fetch segments for a file with optional pagination/filtering
export const getFileSegments = async (
  fileId: string, 
  params?: { page?: number; limit?: number; status?: string }
): Promise<GetSegmentsResponse> => {
  const responseData = await apiClient.get<GetSegmentsResponse>(`/api/files/${fileId}/segments`, { params });
  return responseData as unknown as GetSegmentsResponse;
};

// Function to update a specific segment
export const updateSegment = async (
  segmentId: string, 
  payload: UpdateSegmentPayload
): Promise<UpdateSegmentResponse> => {
  // Assuming PATCH /api/segments/:segmentId endpoint
  const responseData = await apiClient.patch<UpdateSegmentResponse>(`/api/segments/${segmentId}`, payload);
  return responseData as unknown as UpdateSegmentResponse;
};

// TODO: Add functions for getFileDetails, deleteFile etc. as needed 