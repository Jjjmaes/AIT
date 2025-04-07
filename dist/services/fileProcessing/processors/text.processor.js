"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TextProcessor = void 0;
const segment_model_1 = require("../../../models/segment.model");
const promises_1 = require("fs/promises");
const logger_1 = __importDefault(require("../../../utils/logger"));
class TextProcessor {
    async extractSegments(filePath) {
        logger_1.default.info(`Extracting segments from TXT file: ${filePath}`);
        try {
            const content = await (0, promises_1.readFile)(filePath, 'utf8');
            // Split by double line breaks to treat paragraphs as segments
            // Adjust the regex if different segmentation logic is needed (e.g., single line break)
            const rawSegments = content.split(/\r?\n\r?\n+/);
            const segments = [];
            let segmentIndex = 0;
            for (const text of rawSegments) {
                const trimmedText = text.trim();
                if (trimmedText.length === 0) {
                    // Skip empty lines/paragraphs
                    continue;
                }
                segments.push({
                    sourceText: trimmedText,
                    status: segment_model_1.SegmentStatus.PENDING,
                    index: segmentIndex++,
                    // No specific metadata for plain text usually
                    metadata: {}
                });
            }
            logger_1.default.debug(`Found ${segments.length} segments in ${filePath}.`);
            return {
                segments,
                metadata: {}, // No specific file metadata for plain text
                segmentCount: segments.length,
            };
        }
        catch (error) {
            logger_1.default.error(`Error extracting segments from TXT file ${filePath}:`, error);
            throw new Error(`Failed to extract segments from TXT file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    // Optional: Implement writeTranslations for TXT
    async writeTranslations(segments, originalFilePath, // Not strictly needed for simple TXT, but part of interface
    targetFilePath) {
        logger_1.default.info(`Writing translations to TXT file: ${targetFilePath}`);
        try {
            // Simple implementation: join final translations with double line breaks
            const outputContent = segments
                .sort((a, b) => a.index - b.index) // Ensure correct order
                .map(s => s.finalText || s.translation || s.sourceText) // Use best available text
                .join('\n\n'); // Join paragraphs with double line breaks
            await (0, promises_1.writeFile)(targetFilePath, outputContent, 'utf8');
            logger_1.default.info(`Successfully wrote translations to ${targetFilePath}`);
        }
        catch (error) {
            logger_1.default.error(`Error writing translations to TXT file ${targetFilePath}:`, error);
            throw new Error(`Failed to write translations to TXT file ${targetFilePath}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
exports.TextProcessor = TextProcessor;
