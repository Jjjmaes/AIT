import { ISegment } from '../../models/segment.model';

// Interface for file processing results
export interface FileProcessingResult {
  segments: Partial<ISegment>[]; // Segments ready to be saved (without fileId initially)
  metadata: Record<string, any>; // Any extracted file metadata (e.g., source/target lang from XLIFF)
  segmentCount: number;
}

// Common interface for all file processors
export interface IFileProcessor {
  /**
   * Extracts segments and metadata from a given file path.
   * @param filePath - Path to the file to process.
   * @param options - Optional additional parameters specific to the processor.
   * @returns A promise resolving to the extracted segments and metadata.
   */
  extractSegments(filePath: string, ...options: any[]): Promise<FileProcessingResult>;

  /**
   * (Optional) Reconstructs the translated file from segments.
   * @param segments - Array of translated segments.
   * @param originalFilePath - Path to the original source file (needed for structure).
   * @param targetFilePath - Path where the translated file should be saved.
   * @param options - Optional additional parameters specific to the processor.
   * @returns A promise resolving when the file is written.
   */
  writeTranslations?( 
    segments: ISegment[], 
    originalFilePath: string,
    targetFilePath: string, 
    ...options: any[] 
  ): Promise<void>;
} 