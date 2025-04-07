import { IFileProcessor, FileProcessingResult } from '../types';
import { ISegment, SegmentStatus } from '../../../models/segment.model';
import { readFile, writeFile } from 'fs/promises';
import logger from '../../../utils/logger';

export class TextProcessor implements IFileProcessor {

  async extractSegments(filePath: string): Promise<FileProcessingResult> {
    logger.info(`Extracting segments from TXT file: ${filePath}`);
    try {
      const content = await readFile(filePath, 'utf8');
      
      // Split by double line breaks to treat paragraphs as segments
      // Adjust the regex if different segmentation logic is needed (e.g., single line break)
      const rawSegments = content.split(/\r?\n\r?\n+/); 
      
      const segments: Partial<ISegment>[] = [];
      let segmentIndex = 0;

      for (const text of rawSegments) {
          const trimmedText = text.trim();
          if (trimmedText.length === 0) {
              // Skip empty lines/paragraphs
              continue;
          }

          segments.push({
              sourceText: trimmedText,
              status: SegmentStatus.PENDING,
              index: segmentIndex++,
              // No specific metadata for plain text usually
              metadata: {}
          });
      }

      logger.debug(`Found ${segments.length} segments in ${filePath}.`);

      return {
        segments,
        metadata: {}, // No specific file metadata for plain text
        segmentCount: segments.length,
      };

    } catch (error) {
      logger.error(`Error extracting segments from TXT file ${filePath}:`, error);
      throw new Error(`Failed to extract segments from TXT file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Optional: Implement writeTranslations for TXT
  async writeTranslations(
    segments: ISegment[], 
    originalFilePath: string, // Not strictly needed for simple TXT, but part of interface
    targetFilePath: string
  ): Promise<void> {
      logger.info(`Writing translations to TXT file: ${targetFilePath}`);
      try {
          // Simple implementation: join final translations with double line breaks
          const outputContent = segments
              .sort((a, b) => a.index - b.index) // Ensure correct order
              .map(s => s.finalText || s.translation || s.sourceText) // Use best available text
              .join('\n\n'); // Join paragraphs with double line breaks

          await writeFile(targetFilePath, outputContent, 'utf8');
          logger.info(`Successfully wrote translations to ${targetFilePath}`);
      } catch (error) {
           logger.error(`Error writing translations to TXT file ${targetFilePath}:`, error);
           throw new Error(`Failed to write translations to TXT file ${targetFilePath}: ${error instanceof Error ? error.message : String(error)}`);
      }
  }
} 