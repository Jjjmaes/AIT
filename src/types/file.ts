export interface UploadFileDTO {
  originalName: string;
  fileSize: number;
  mimeType: string;
  filePath: string;
  sourceLanguage: string;
  targetLanguage: string;
  category?: string;
  tags?: string[];
} 