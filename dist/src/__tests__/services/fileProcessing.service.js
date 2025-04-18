"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileProcessingService = exports.FileProcessingService = void 0;
const file_model_1 = require("../../models/file.model");
const segment_model_1 = require("../../models/segment.model");
const fileProcessor_factory_1 = require("../../services/fileProcessing/fileProcessor.factory");
const logger_1 = __importDefault(require("../../utils/logger"));
const errorHandler_1 = require("../../utils/errorHandler");
const path_1 = __importDefault(require("path"));
const errors_1 = require("../../utils/errors");
class FileProcessingService {
    constructor() {
        this.serviceName = 'FileProcessingService';
    }
    /**
     * Processes a file: extracts segments using the appropriate processor and saves them to the database.
     * @param fileId - The ID of the file to process.
     * @param userId - The ID of the user initiating the process (for potential ownership checks later).
     */
    async processFile(fileId, userId) {
        const methodName = 'processFile';
        (0, errorHandler_1.validateId)(fileId, '文件');
        logger_1.default.info(`[${this.serviceName}.${methodName}] Starting processing for file ID: ${fileId}`);
        let file = null;
        try {
            file = await file_model_1.File.findById(fileId).exec();
            (0, errorHandler_1.validateEntityExists)(file, '文件');
            // --- Basic validation ---
            if (file.status !== file_model_1.FileStatus.PENDING && file.status !== file_model_1.FileStatus.ERROR) {
                logger_1.default.warn(`[${this.serviceName}.${methodName}] File ${fileId} is not in PENDING or ERROR state (current: ${file.status}). Skipping processing.`);
                return;
            }
            // Basic check for file path existence (improve later with storage service)
            if (!file.filePath) {
                throw new errors_1.AppError('File path is missing.', 400);
            }
            // --- Update status to Processing ---
            file.status = file_model_1.FileStatus.PROCESSING;
            file.processingStartedAt = new Date();
            file.errorDetails = undefined; // Clear previous errors
            await file.save();
            // --- Get Processor ---
            // Ensure file.fileType conforms to SupportedFileProcessorType before passing
            const fileType = file.fileType.toLowerCase();
            // Basic type check - enhance this with a more robust validation if needed
            if (!['xliff', 'memoqxliff'].includes(fileType)) {
                throw new errors_1.AppError(`File type '${file.fileType}' is not supported for processing yet.`, 400);
            }
            // Cast the validated string literal type to the FileType enum
            const processor = fileProcessor_factory_1.FileProcessorFactory.getProcessor(fileType);
            const processorOptions = {
                isMemoQ: fileType === 'memoqxliff'
            };
            // --- Extract Segments ---
            logger_1.default.info(`[${this.serviceName}.${methodName}] Extracting segments using ${processor.constructor.name} for file: ${file.originalName}`);
            // Construct full path if filePath is relative (adjust based on actual storage strategy)
            const fullPath = path_1.default.resolve(file.filePath); // Assuming filePath is relative to project root for now
            const { segments: extractedSegmentsData, metadata: fileMetadata, segmentCount } = await processor.extractSegments(fullPath, processorOptions);
            logger_1.default.info(`[${this.serviceName}.${methodName}] Extracted ${segmentCount} segments.`);
            // --- Update File Metadata (Optional) ---
            // Example: Update language if extracted from XLIFF metadata
            if (fileMetadata.sourceLanguage && fileMetadata.targetLanguage) {
                file.metadata = {
                    ...(file.metadata || {}), // Preserve existing metadata
                    sourceLanguage: fileMetadata.sourceLanguage,
                    targetLanguage: fileMetadata.targetLanguage,
                    originalFilename: fileMetadata.original || file.originalName, // Update original filename if found
                };
                logger_1.default.info(`[${this.serviceName}.${methodName}] Updated file metadata from extracted data.`);
            }
            // --- Save Segments ---
            if (segmentCount > 0) {
                // Remove the explicit type annotation; let TypeScript infer the type
                const segmentsToSave = extractedSegmentsData.map((data) => ({
                    fileId: file._id,
                    index: data.index,
                    sourceText: data.sourceText,
                    translation: data.translation, // Use translation from file if present
                    status: data.status ?? (data.translation ? file_model_1.FileStatus.TRANSLATED : file_model_1.FileStatus.PENDING), // Use status from file or default
                    sourceLength: data.sourceLength ?? data.sourceText.length,
                    translatedLength: data.translatedLength,
                    metadata: data.metadata,
                    issues: [], // Initialize with empty issues
                    // other fields will get defaults from the schema
                }));
                logger_1.default.info(`[${this.serviceName}.${methodName}] Saving ${segmentsToSave.length} segments to database...`);
                // Clear existing segments for this file before inserting new ones (important for re-processing)
                await segment_model_1.Segment.deleteMany({ fileId: file._id }).exec();
                await segment_model_1.Segment.insertMany(segmentsToSave);
                logger_1.default.info(`[${this.serviceName}.${methodName}] Segments saved successfully.`);
            }
            else {
                logger_1.default.info(`[${this.serviceName}.${methodName}] No segments extracted or to save.`);
                // Ensure segment count is 0 if no segments were saved
                await segment_model_1.Segment.deleteMany({ fileId: file._id }).exec();
            }
            // --- Update File Status to Extracted ---
            file.status = file_model_1.FileStatus.EXTRACTED; // New status indicating segments are ready
            file.segmentCount = segmentCount;
            file.processingCompletedAt = new Date();
            file.errorDetails = undefined;
            await file.save();
            logger_1.default.info(`[${this.serviceName}.${methodName}] Successfully processed file ID: ${fileId}. Status: ${file.status}`);
        }
        catch (error) {
            logger_1.default.error(`[${this.serviceName}.${methodName}] Error processing file ID: ${fileId}:`, error);
            if (file) {
                try {
                    file.status = file_model_1.FileStatus.ERROR;
                    file.errorDetails = error instanceof Error ? error.message : String(error);
                    file.processingCompletedAt = new Date(); // Mark completion time even on error
                    await file.save();
                }
                catch (saveError) {
                    logger_1.default.error(`[${this.serviceName}.${methodName}] Failed to update file ${fileId} status to ERROR:`, saveError);
                }
            }
            // Rethrow or handle as appropriate for the application flow
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '文件处理');
        }
    }
}
exports.FileProcessingService = FileProcessingService;
// Export an instance
exports.fileProcessingService = new FileProcessingService();
