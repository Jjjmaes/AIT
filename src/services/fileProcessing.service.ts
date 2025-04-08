import { File, IFile, FileStatus, FileType } from '../models/file.model';
import { Segment, ISegment } from '../models/segment.model';
import { FileProcessorFactory, SupportedFileType } from './fileProcessing/fileProcessor.factory';
import { IFileProcessor, ExtractedSegmentData } from './fileProcessing/types';
import logger from '../utils/logger';
import { Types } from 'mongoose';
import { handleServiceError, validateId, validateEntityExists, AppError, NotFoundError } from '../utils/errorHandler';

export class FileProcessingService {
  private serviceName = 'FileProcessingService';

  async processFile(fileId: string, userId: string): Promise<IFile> {
    const methodName = 'processFile';
    validateId(fileId, '文件');
    validateId(userId, '用户'); // Although userId isn't directly used here, it's good practice for authorization later

    logger.info(`[${this.serviceName}.${methodName}] Starting processing for file ID: ${fileId}`);

    const file = await File.findById(fileId).exec();
    validateEntityExists(file, '文件');

    // Skip processing if the file is not in a suitable state
    if (![FileStatus.PENDING, FileStatus.ERROR].includes(file.status)) {
      logger.warn(`[${this.serviceName}.${methodName}] Skipping file ${fileId}: Already processed or in progress (status: ${file.status}).`);
      return file;
    }

    // Ensure file path exists
    if (!file.filePath) {
      file.status = FileStatus.ERROR;
      file.errorDetails = 'File path is missing.';
      await file.save();
      logger.error(`[${this.serviceName}.${methodName}] Error processing file ${fileId}: File path is missing.`);
      throw new AppError('File path is missing.', 400);
    }

    try {
      // --- Update status to Processing ---
      file.status = FileStatus.PROCESSING;
      file.processingStartedAt = new Date();
      file.errorDetails = undefined; // Clear previous errors
      await file.save();
      logger.info(`[${this.serviceName}.${methodName}] Set file ${fileId} status to PROCESSING.`);

      // --- Get Processor ---
      const fileTypeString = file.fileType.toLowerCase() as SupportedFileType;
      // Basic type check - enhance this with a more robust validation if needed
      if (!['xliff', 'memoqxliff'].includes(fileTypeString)) {
         // This check might be redundant if FileType enum is strictly enforced on upload
         throw new AppError(`File type '${file.fileType}' is not supported for processing yet.`, 400);
      }
      // Cast the validated string literal type to the FileType enum
      const processor = FileProcessorFactory.getProcessor(fileTypeString as FileType);
      const processorOptions = {
        isMemoQ: fileTypeString === 'memoqxliff'
      };

      logger.info(`[${this.serviceName}.${methodName}] Using processor for type: ${fileTypeString}`);

      // --- Extract Segments ---
      const { segments: extractedSegmentsData, metadata: extractedMetadata, segmentCount } = await processor.extractSegments(
        file.filePath,
        processorOptions
      );
      logger.info(`[${this.serviceName}.${methodName}] Extracted ${segmentCount} segments from file ${fileId}.`);

      // --- Clear Old Segments ---
      // Ensure atomicity: delete old segments before inserting new ones
      await Segment.deleteMany({ fileId: file._id });
      logger.info(`[${this.serviceName}.${methodName}] Cleared existing segments for file ${fileId}.`);

      // --- Save Segments ---
      if (segmentCount > 0 && extractedSegmentsData.length > 0) {
        // Let TypeScript infer the type; insertMany expects plain objects
        const segmentsToSave = extractedSegmentsData.map((data: ExtractedSegmentData) => ({
          fileId: file!._id,
          projectId: file!.projectId, // Ensure projectId is included
          index: data.index,
          sourceText: data.sourceText,
          translation: data.translation, // Use translation from file if present
          status: data.status ?? (data.translation ? FileStatus.TRANSLATED : FileStatus.PENDING), // Use status from file or default
          sourceLength: data.sourceLength ?? data.sourceText.length,
          translatedLength: data.translatedLength,
          metadata: data.metadata,
          issues: [], // Initialize with empty issues
          // other fields will get defaults from the schema (like createdAt, updatedAt)
        }));

        await Segment.insertMany(segmentsToSave);
        logger.info(`[${this.serviceName}.${methodName}] Saved ${segmentsToSave.length} new segments for file ${fileId}.`);
      } else {
          logger.info(`[${this.serviceName}.${methodName}] No segments extracted or to save for file ${fileId}.`);
      }

      // --- Update File Status and Metadata ---
      file.status = FileStatus.EXTRACTED;
      file.segmentCount = segmentCount;
      file.processingCompletedAt = new Date();
      // Update file metadata extracted from the processor
      file.metadata = {
          ...(file.metadata ?? {}), // Preserve existing metadata if any
          sourceLanguage: extractedMetadata?.sourceLanguage,
          targetLanguage: extractedMetadata?.targetLanguage,
          originalFilename: extractedMetadata?.original, // Map 'original' from XLIFF metadata
      };
      // Mark for saving
      await file.save();
      logger.info(`[${this.serviceName}.${methodName}] Successfully processed file ID: ${fileId}. Status set to EXTRACTED.`);

      return file;

    } catch (error) {
      logger.error(`[${this.serviceName}.${methodName}] Error processing file ID: ${fileId}:`, error);
      // Attempt to mark file as error
      try {
        file.status = FileStatus.ERROR;
        file.errorDetails = (error instanceof Error ? error.message : 'Unknown processing error');
        file.processingCompletedAt = new Date(); // Mark completion time even on error
        await file.save();
        logger.info(`[${this.serviceName}.${methodName}] Set file ${fileId} status to ERROR due to processing failure.`);
      } catch (saveError) {
        logger.error(`[${this.serviceName}.${methodName}] CRITICAL: Failed to update file ${fileId} status to ERROR after processing failure:`, saveError);
      }
      // Re-throw the original error, handled appropriately
      throw handleServiceError(error, this.serviceName, methodName, '文件处理');
    }
  }
}

export const fileProcessingService = new FileProcessingService();