"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocxProcessor = void 0;
const file_model_1 = require("../../../models/file.model");
const mammoth_1 = __importDefault(require("mammoth"));
const promises_1 = require("fs/promises");
const logger_1 = __importDefault(require("../../../utils/logger"));
class DocxProcessor {
    constructor() {
        this.supportedTypes = [file_model_1.FileType.DOCX];
    }
    async extractSegments(filePath) {
        logger_1.default.info(`Extracting segments from DOCX file: ${filePath}`);
        try {
            const result = await mammoth_1.default.extractRawText({ path: filePath });
            const text = result.value;
            const messages = result.messages;
            if (messages && messages.length > 0) {
                messages.forEach(msg => logger_1.default.warn(`Mammoth message for ${filePath}: [${msg.type}] ${msg.message}`));
            }
            const segments = text.split(/\n\s*\n/).map((s, i) => ({
                index: i,
                sourceText: s.trim(),
            }));
            logger_1.default.debug(`Found ${segments.length} segments in DOCX file ${filePath}.`);
            return {
                segments: segments,
                metadata: { originalFileType: file_model_1.FileType.DOCX, mammothMessages: messages },
                segmentCount: segments.length
            };
        }
        catch (error) {
            logger_1.default.error(`Error extracting segments from DOCX file ${filePath}:`, error);
            throw new Error(`Failed to extract segments from DOCX file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    // writeTranslations for DOCX is complex to do perfectly (preserving formatting).
    // A simple implementation could write a plain text file, or it can be omitted.
    async writeTranslations(segments, originalFilePath, // Not used in this simple implementation
    targetFilePath // Output path (suggest adding .txt extension)
    ) {
        logger_1.default.warn(`DOCX writeTranslations is implemented simply: writing plain text to ${targetFilePath}. Formatting will be lost.`);
        // Ensure target path has .txt extension if not already present
        const outputFilePath = targetFilePath.endsWith('.txt') ? targetFilePath : `${targetFilePath}.txt`;
        logger_1.default.info(`Writing translations to TXT file (from DOCX): ${outputFilePath}`);
        try {
            const outputContent = segments
                .sort((a, b) => a.index - b.index) // Ensure correct order
                .map(s => s.finalText || s.translation || s.sourceText)
                .join('\n\n'); // Join paragraphs with double line breaks
            await (0, promises_1.writeFile)(outputFilePath, outputContent, 'utf8');
            logger_1.default.info(`Successfully wrote translations (as TXT) to ${outputFilePath}`);
        }
        catch (error) {
            logger_1.default.error(`Error writing translations (as TXT) to ${outputFilePath}:`, error);
            throw new Error(`Failed to write translations (as TXT) for DOCX file to ${outputFilePath}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
exports.DocxProcessor = DocxProcessor;
