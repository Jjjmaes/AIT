"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileProcessorFactory = void 0;
const file_model_1 = require("../../models/file.model"); // Correctly import the enum
const logger_1 = __importDefault(require("../../utils/logger"));
const errors_1 = require("../../utils/errors");
// Import specific processors as they are created
const docx_processor_1 = require("./processors/docx.processor"); // Uncomment import
// import { DocxProcessor } from './processors/docx.processor';
const text_processor_1 = require("./processors/text.processor"); // Uncomment import
const xliff_processor_1 = require("./processors/xliff.processor"); // Uncomment import
class FileProcessorFactory {
    static registerProcessor(fileType, processor) {
        if (this.processors.has(fileType)) {
            logger_1.default.warn(`Processor for file type '${fileType}' is being overridden.`);
        }
        this.processors.set(fileType, processor);
        logger_1.default.info(`Registered processor for file type: ${fileType}`);
    }
    static getProcessor(fileType) {
        const processor = this.processors.get(fileType);
        if (!processor) {
            logger_1.default.error(`No processor found for file type: ${fileType}`);
            throw new errors_1.AppError(`Unsupported file type: ${fileType}. No processor available.`, 400);
        }
        return processor;
    }
    /**
     * Convenience method to directly process a file using the factory.
     * @param filePath Path to the file.
     * @param fileType Type of the file.
     * @returns The result of the file processing.
     */
    static async processFile(filePath, fileType) {
        const processor = this.getProcessor(fileType);
        logger_1.default.info(`Processing file ${filePath} using processor for type ${fileType}`);
        const options = [];
        // Use enum members for comparison
        if (fileType === file_model_1.FileType.MEMOQ_XLIFF) {
            options.push({ isMemoQ: true });
        }
        else if (fileType === file_model_1.FileType.XLIFF) {
            options.push({ isMemoQ: false });
        }
        // Add other specific options logic if needed
        try {
            const result = await processor.extractSegments(filePath, ...options);
            logger_1.default.info(`Successfully processed file ${filePath}. Found ${result.segmentCount} segments.`);
            return result;
        }
        catch (error) {
            logger_1.default.error(`Error processing file ${filePath} with type ${fileType}:`, error);
            throw new errors_1.AppError(`Failed to process file ${filePath}: ${error instanceof Error ? error.message : String(error)}`, 500);
        }
    }
}
exports.FileProcessorFactory = FileProcessorFactory;
_a = FileProcessorFactory;
FileProcessorFactory.processors = new Map();
// Static initialization block to register processors (alternative to constructor)
(() => {
    // Register processors here when they are implemented
    _a.registerProcessor(file_model_1.FileType.DOCX, new docx_processor_1.DocxProcessor()); // Uncomment and fix registration
    _a.registerProcessor(file_model_1.FileType.TXT, new text_processor_1.TextProcessor()); // Uncomment registration
    // Uncomment registration for XLIFF and MemoQ XLIFF
    _a.registerProcessor(file_model_1.FileType.XLIFF, new xliff_processor_1.XliffProcessor());
    _a.registerProcessor(file_model_1.FileType.MEMOQ_XLIFF, new xliff_processor_1.XliffProcessor()); // Can reuse with options
    // ... register other processors
    // Remove registration for non-existent JsonProcessor
    // this.registerProcessor(FileType.JSON, new JsonProcessor()); 
})();
