export interface FileType {
  _id: string;
  originalName: string;
  path: string;
  status: string;
  size: number;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
  projectId?: string;
}

export interface FileUploadResponse {
  success: boolean;
  file: FileType;
  message: string;
}

export interface GetFilesResponse {
  success: boolean;
  files: FileType[];
  message: string;
}

export interface DeleteFileResponse {
  success: boolean;
  message: string;
} 