import { SegmentStatus } from '../../models/segment.model';
import { ISegment } from '../../models/segment.model';

// Define the data structure a processor should extract for each segment
export interface ExtractedSegmentData {
  index: number;
  sourceText: string;
  translation?: string; // Optional initial translation from file
  status?: SegmentStatus; // Optional initial status from file
  sourceLength?: number;
  translatedLength?: number; // Optional length if translation exists
  metadata?: Record<string, any>; // Processor-specific metadata (like xliffId)
}

// Interface for file processing results
export interface FileProcessingResult {
  segments: ExtractedSegmentData[];
  metadata: Record<string, any>; // File-level metadata (lang, original name etc.)
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
  extractSegments(filePath: string, options?: any): Promise<FileProcessingResult>;

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
    options?: any
  ): Promise<void>;
} 