import { File, IFile, FileStatus, FileType } from '../../models/file.model';
import { Segment, ISegment } from '../../models/segment.model';
import { FileProcessorFactory, SupportedFileType } from '../../services/fileProcessing/fileProcessor.factory';
import { ExtractedSegmentData, IFileProcessor } from '../../services/fileProcessing/types';
import logger from '../../utils/logger';
import { handleServiceError, validateId, validateEntityExists } from '../../utils/errorHandler';
import { Types } from 'mongoose';
import path from 'path';
import { AppError } from '../../utils/errors';

export class FileProcessingService {
  private serviceName = 'FileProcessingService';

  /**
   * Processes a file: extracts segments using the appropriate processor and saves them to the database.
   * @param fileId - The ID of the file to process.
   * @param userId - The ID of the user initiating the process (for potential ownership checks later).
   */
  async processFile(fileId: string, userId: string): Promise<void> { // userId might be needed later
    const methodName = 'processFile';
    validateId(fileId, '文件');
    logger.info(`[${this.serviceName}.${methodName}] Starting processing for file ID: ${fileId}`);

    let file: IFile | null = null;
    try {
      file = await File.findById(fileId).exec();
      validateEntityExists(file, '文件');

      // --- Basic validation ---
      if (file.status !== FileStatus.PENDING && file.status !== FileStatus.ERROR) {
        logger.warn(`[${this.serviceName}.${methodName}] File ${fileId} is not in PENDING or ERROR state (current: ${file.status}). Skipping processing.`);
        return;
      }
      // Basic check for file path existence (improve later with storage service)
      if (!file.filePath) {
          throw new AppError('File path is missing.', 400);
      }

      // --- Update status to Processing ---
      file.status = FileStatus.PROCESSING;
      file.processingStartedAt = new Date();
      file.errorDetails = undefined; // Clear previous errors
      await file.save();

      // --- Get Processor ---
      // Ensure file.fileType conforms to SupportedFileProcessorType before passing
      const fileType = file.fileType.toLowerCase() as SupportedFileType;
       // Basic type check - enhance this with a more robust validation if needed
      if (!['xliff', 'memoqxliff'].includes(fileType)) {
         throw new AppError(`File type '${file.fileType}' is not supported for processing yet.`, 400);
      }
      // Cast the validated string literal type to the FileType enum
      const processor = FileProcessorFactory.getProcessor(fileType as FileType); 
      const processorOptions = {
        isMemoQ: fileType === 'memoqxliff'
      };

      // --- Extract Segments ---
      logger.info(`[${this.serviceName}.${methodName}] Extracting segments using ${processor.constructor.name} for file: ${file.originalName}`);
      // Construct full path if filePath is relative (adjust based on actual storage strategy)
      const fullPath = path.resolve(file.filePath); // Assuming filePath is relative to project root for now
      const { segments: extractedSegmentsData, metadata: fileMetadata, segmentCount } = await processor.extractSegments(fullPath, processorOptions);
      logger.info(`[${this.serviceName}.${methodName}] Extracted ${segmentCount} segments.`);

       // --- Update File Metadata (Optional) ---
       // Example: Update language if extracted from XLIFF metadata
       if (fileMetadata.sourceLanguage && fileMetadata.targetLanguage) {
           file.metadata = {
               ...(file.metadata || {}), // Preserve existing metadata
               sourceLanguage: fileMetadata.sourceLanguage,
               targetLanguage: fileMetadata.targetLanguage,
               originalFilename: fileMetadata.original || file.originalName, // Update original filename if found
           };
           logger.info(`[${this.serviceName}.${methodName}] Updated file metadata from extracted data.`);
       }


      // --- Save Segments ---
      if (segmentCount > 0) {
        // Remove the explicit type annotation; let TypeScript infer the type
        const segmentsToSave = extractedSegmentsData.map((data: ExtractedSegmentData) => ({
          fileId: file!._id,
          index: data.index,
          sourceText: data.sourceText,
          translation: data.translation, // Use translation from file if present
          status: data.status ?? (data.translation ? FileStatus.TRANSLATED : FileStatus.PENDING), // Use status from file or default
          sourceLength: data.sourceLength ?? data.sourceText.length,
          translatedLength: data.translatedLength,
          metadata: data.metadata,
          issues: [], // Initialize with empty issues
          // other fields will get defaults from the schema
        }));

        logger.info(`[${this.serviceName}.${methodName}] Saving ${segmentsToSave.length} segments to database...`);
        // Clear existing segments for this file before inserting new ones (important for re-processing)
        await Segment.deleteMany({ fileId: file._id }).exec();
        await Segment.insertMany(segmentsToSave);
        logger.info(`[${this.serviceName}.${methodName}] Segments saved successfully.`);
      } else {
        logger.info(`[${this.serviceName}.${methodName}] No segments extracted or to save.`);
         // Ensure segment count is 0 if no segments were saved
        await Segment.deleteMany({ fileId: file._id }).exec(); 
      }

      // --- Update File Status to Extracted ---
      file.status = FileStatus.EXTRACTED; // New status indicating segments are ready
      file.segmentCount = segmentCount;
      file.processingCompletedAt = new Date();
      file.errorDetails = undefined;
      await file.save();

      logger.info(`[${this.serviceName}.${methodName}] Successfully processed file ID: ${fileId}. Status: ${file.status}`);

    } catch (error) {
      logger.error(`[${this.serviceName}.${methodName}] Error processing file ID: ${fileId}:`, error);
      if (file) {
        try {
          file.status = FileStatus.ERROR;
          file.errorDetails = error instanceof Error ? error.message : String(error);
          file.processingCompletedAt = new Date(); // Mark completion time even on error
          await file.save();
        } catch (saveError) {
          logger.error(`[${this.serviceName}.${methodName}] Failed to update file ${fileId} status to ERROR:`, saveError);
        }
      }
      // Rethrow or handle as appropriate for the application flow
      throw handleServiceError(error, this.serviceName, methodName, '文件处理');
    }
  }
}

// Export an instance
export const fileProcessingService = new FileProcessingService();