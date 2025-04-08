import { IFileProcessor, FileProcessingResult } from './types';
import { FileType } from '../../models/file.model'; // Correctly import the enum
import logger from '../../utils/logger';
import { AppError } from '../../utils/errors';

// Import specific processors as they are created
import { DocxProcessor } from './processors/docx.processor'; // Uncomment import
// import { DocxProcessor } from './processors/docx.processor';
import { TextProcessor } from './processors/text.processor'; // Uncomment import
import { XliffProcessor } from './processors/xliff.processor'; // Uncomment import
// Remove import for non-existent JsonProcessor
// import { JsonProcessor } from './processors/json.processor'; 

// Define and export the supported file types
export type SupportedFileType = 'xliff' | 'memoqxliff' | 'docx' | 'txt'; // Add other types as processors are added

export class FileProcessorFactory {
  private static processors = new Map<FileType, IFileProcessor>();

  // Static initialization block to register processors (alternative to constructor)
  static {
    // Register processors here when they are implemented
    // this.registerProcessor('docx', new DocxProcessor());
    this.registerProcessor(FileType.TXT, new TextProcessor()); // Uncomment registration
    // Uncomment registration for XLIFF and MemoQ XLIFF
    this.registerProcessor(FileType.XLIFF, new XliffProcessor()); 
    this.registerProcessor(FileType.MEMOQ_XLIFF, new XliffProcessor()); // Can reuse with options
    // ... register other processors
    // Remove registration for non-existent JsonProcessor
    // this.registerProcessor(FileType.JSON, new JsonProcessor()); 
  }

  static registerProcessor(fileType: FileType, processor: IFileProcessor): void {
    if (this.processors.has(fileType)) {
        logger.warn(`Processor for file type '${fileType}' is being overridden.`);
    }
    this.processors.set(fileType, processor);
    logger.info(`Registered processor for file type: ${fileType}`);
  }

  static getProcessor(fileType: FileType): IFileProcessor {
    const processor = this.processors.get(fileType);
    if (!processor) {
      logger.error(`No processor found for file type: ${fileType}`);
      throw new AppError(`Unsupported file type: ${fileType}. No processor available.`, 400);
    }
    return processor;
  }

  /**
   * Convenience method to directly process a file using the factory.
   * @param filePath Path to the file.
   * @param fileType Type of the file.
   * @returns The result of the file processing.
   */
  static async processFile(filePath: string, fileType: FileType): Promise<FileProcessingResult> {
    const processor = this.getProcessor(fileType);
    logger.info(`Processing file ${filePath} using processor for type ${fileType}`);
    
    const options: any[] = [];
    // Use enum members for comparison
    if (fileType === FileType.MEMOQ_XLIFF) { 
        options.push({ isMemoQ: true });
    } else if (fileType === FileType.XLIFF) { 
        options.push({ isMemoQ: false });
    }
    // Add other specific options logic if needed

    try {
      const result = await processor.extractSegments(filePath, ...options);
      logger.info(`Successfully processed file ${filePath}. Found ${result.segmentCount} segments.`);
      return result;
    } catch (error) {
      logger.error(`Error processing file ${filePath} with type ${fileType}:`, error);
      throw new AppError(`Failed to process file ${filePath}: ${error instanceof Error ? error.message : String(error)}`, 500);
    }
  }
} 