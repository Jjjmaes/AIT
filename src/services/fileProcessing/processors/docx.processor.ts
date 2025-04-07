import { IFileProcessor, FileProcessingResult } from '../types';
import { FileType } from '../../../models/file.model';
import mammoth from 'mammoth';
import { ISegment } from '../../../models/segment.model';
import { readFile, writeFile } from 'fs/promises';
import logger from '../../../utils/logger';

export class DocxProcessor implements IFileProcessor {
    supportedTypes: FileType[] = [FileType.DOCX];

    async extractSegments(filePath: string): Promise<FileProcessingResult> {
        logger.info(`Extracting segments from DOCX file: ${filePath}`);
        try {
            const result = await mammoth.extractRawText({ path: filePath });
            const text = result.value;
            const messages = result.messages;

            if (messages && messages.length > 0) {
                messages.forEach(msg => logger.warn(`Mammoth message for ${filePath}: [${msg.type}] ${msg.message}`));
            }

            const segments: Partial<ISegment>[] = text.split(/\n\s*\n/).map((s, i) => ({ // Simple split by double newline
                index: i,
                sourceText: s.trim(),
            }));

            logger.debug(`Found ${segments.length} segments in DOCX file ${filePath}.`);

            return {
                segments: segments as ISegment[],
                metadata: { originalFileType: FileType.DOCX, mammothMessages: messages },
                segmentCount: segments.length
            };
        } catch (error) {
            logger.error(`Error extracting segments from DOCX file ${filePath}:`, error);
            throw new Error(`Failed to extract segments from DOCX file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    // writeTranslations for DOCX is complex to do perfectly (preserving formatting).
    // A simple implementation could write a plain text file, or it can be omitted.
    async writeTranslations(
        segments: ISegment[],
        originalFilePath: string, // Not used in this simple implementation
        targetFilePath: string // Output path (suggest adding .txt extension)
    ): Promise<void> {
        logger.warn(`DOCX writeTranslations is implemented simply: writing plain text to ${targetFilePath}. Formatting will be lost.`);

        // Ensure target path has .txt extension if not already present
        const outputFilePath = targetFilePath.endsWith('.txt') ? targetFilePath : `${targetFilePath}.txt`;

        logger.info(`Writing translations to TXT file (from DOCX): ${outputFilePath}`);
        try {
            const outputContent = segments
                .sort((a, b) => a.index - b.index) // Ensure correct order
                .map(s => s.finalText || s.translation || s.sourceText)
                .join('\n\n'); // Join paragraphs with double line breaks

            await writeFile(outputFilePath, outputContent, 'utf8');
            logger.info(`Successfully wrote translations (as TXT) to ${outputFilePath}`);
        } catch (error) {
            logger.error(`Error writing translations (as TXT) to ${outputFilePath}:`, error);
            throw new Error(`Failed to write translations (as TXT) for DOCX file to ${outputFilePath}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}