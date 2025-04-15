"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileProcessingService = exports.FileProcessingService = void 0;
const file_model_1 = require("../models/file.model");
const segment_model_1 = require("../models/segment.model");
const fileProcessor_factory_1 = require("./fileProcessing/fileProcessor.factory");
const logger_1 = __importDefault(require("../utils/logger"));
const errorHandler_1 = require("../utils/errorHandler");
class FileProcessingService {
    constructor() {
        this.serviceName = 'FileProcessingService';
    }
    async processFile(fileId, userId) {
        const methodName = 'processFile';
        (0, errorHandler_1.validateId)(fileId, '文件');
        (0, errorHandler_1.validateId)(userId, '用户'); // Although userId isn't directly used here, it's good practice for authorization later
        logger_1.default.info(`[${this.serviceName}.${methodName}] Starting processing for file ID: ${fileId}`);
        const file = await file_model_1.File.findById(fileId).exec();
        (0, errorHandler_1.validateEntityExists)(file, '文件');
        // Skip processing if the file is not in a suitable state
        if (![file_model_1.FileStatus.PENDING, file_model_1.FileStatus.ERROR].includes(file.status)) {
            logger_1.default.warn(`[${this.serviceName}.${methodName}] Skipping file ${fileId}: Already processed or in progress (status: ${file.status}).`);
            return file;
        }
        // Ensure file path exists
        if (!file.filePath) {
            file.status = file_model_1.FileStatus.ERROR;
            file.errorDetails = 'File path is missing.';
            await file.save();
            logger_1.default.error(`[${this.serviceName}.${methodName}] Error processing file ${fileId}: File path is missing.`);
            throw new errorHandler_1.AppError('File path is missing.', 400);
        }
        try {
            // --- Update status to Processing ---
            file.status = file_model_1.FileStatus.PROCESSING;
            file.processingStartedAt = new Date();
            file.errorDetails = undefined; // Clear previous errors
            await file.save();
            logger_1.default.info(`[${this.serviceName}.${methodName}] Set file ${fileId} status to PROCESSING.`);
            // --- Get Processor ---
            const fileTypeString = file.fileType.toLowerCase();
            // Basic type check - enhance this with a more robust validation if needed
            if (!['xliff', 'memoqxliff'].includes(fileTypeString)) {
                // This check might be redundant if FileType enum is strictly enforced on upload
                throw new errorHandler_1.AppError(`File type '${file.fileType}' is not supported for processing yet.`, 400);
            }
            // Cast the validated string literal type to the FileType enum
            const processor = fileProcessor_factory_1.FileProcessorFactory.getProcessor(fileTypeString);
            const processorOptions = {
                isMemoQ: fileTypeString === 'memoqxliff'
            };
            logger_1.default.info(`[${this.serviceName}.${methodName}] Using processor for type: ${fileTypeString}`);
            // --- Extract Segments ---
            const { segments: extractedSegmentsData, metadata: extractedMetadata, segmentCount } = await processor.extractSegments(file.filePath, processorOptions);
            logger_1.default.info(`[${this.serviceName}.${methodName}] Extracted ${segmentCount} segments from file ${fileId}.`);
            // --- Clear Old Segments ---
            // Ensure atomicity: delete old segments before inserting new ones
            await segment_model_1.Segment.deleteMany({ fileId: file._id });
            logger_1.default.info(`[${this.serviceName}.${methodName}] Cleared existing segments for file ${fileId}.`);
            // --- Save Segments ---
            if (segmentCount > 0 && extractedSegmentsData.length > 0) {
                // Let TypeScript infer the type; insertMany expects plain objects
                const segmentsToSave = extractedSegmentsData.map((data) => ({
                    fileId: file._id,
                    projectId: file.projectId, // Ensure projectId is included
                    index: data.index,
                    sourceText: data.sourceText,
                    translation: data.translation, // Use translation from file if present
                    status: data.status ?? (data.translation ? file_model_1.FileStatus.TRANSLATED : file_model_1.FileStatus.PENDING), // Use status from file or default
                    sourceLength: data.sourceLength ?? data.sourceText.length,
                    translatedLength: data.translatedLength,
                    metadata: data.metadata,
                    issues: [], // Initialize with empty issues
                    // other fields will get defaults from the schema (like createdAt, updatedAt)
                }));
                await segment_model_1.Segment.insertMany(segmentsToSave);
                logger_1.default.info(`[${this.serviceName}.${methodName}] Saved ${segmentsToSave.length} new segments for file ${fileId}.`);
            }
            else {
                logger_1.default.info(`[${this.serviceName}.${methodName}] No segments extracted or to save for file ${fileId}.`);
            }
            // --- Update File Status and Metadata ---
            file.status = file_model_1.FileStatus.EXTRACTED;
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
            logger_1.default.info(`[${this.serviceName}.${methodName}] Successfully processed file ID: ${fileId}. Status set to EXTRACTED.`);
            return file;
        }
        catch (error) {
            logger_1.default.error(`[${this.serviceName}.${methodName}] Error processing file ID: ${fileId}:`, error);
            // Attempt to mark file as error
            try {
                file.status = file_model_1.FileStatus.ERROR;
                file.errorDetails = (error instanceof Error ? error.message : 'Unknown processing error');
                file.processingCompletedAt = new Date(); // Mark completion time even on error
                await file.save();
                logger_1.default.info(`[${this.serviceName}.${methodName}] Set file ${fileId} status to ERROR due to processing failure.`);
            }
            catch (saveError) {
                logger_1.default.error(`[${this.serviceName}.${methodName}] CRITICAL: Failed to update file ${fileId} status to ERROR after processing failure:`, saveError);
            }
            // Re-throw the original error, handled appropriately
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '文件处理');
        }
    }
}
exports.FileProcessingService = FileProcessingService;
exports.fileProcessingService = new FileProcessingService();
