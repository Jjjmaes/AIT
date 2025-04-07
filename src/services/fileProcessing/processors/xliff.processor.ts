import { IFileProcessor, FileProcessingResult } from '../types';
import { ISegment, SegmentStatus } from '../../../models/segment.model';
import logger from '../../../utils/logger';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import xpath from 'xpath';
import { Types } from 'mongoose';
import { readFile, writeFile } from 'fs/promises';

/**
 * Processes XLIFF 1.2 files (including MemoQ variations).
 */
export class XliffProcessor implements IFileProcessor {
  private parser = new DOMParser();
  private serializer = new XMLSerializer();

  // Update getJoinedText to handle Elements and extract textContent
  private getJoinedText(nodes: Node | Node[] | null): string {
    if (!nodes) return '';
    
    const extractText = (node: Node): string => {
      if (node.nodeType === node.ELEMENT_NODE) {
        // Recursively get text content, handling potential nested elements/text
        let text = '';
        for (let i = 0; i < node.childNodes.length; i++) {
          const child = node.childNodes[i];
          if (child.nodeType === child.TEXT_NODE) {
            text += child.nodeValue;
          } else if (child.nodeType === child.ELEMENT_NODE) {
             // Keep simple inline tags like <g>, <x> etc. as placeholders 
             // or implement more complex tag handling if needed
             if (['g', 'x', 'bx', 'ex', 'ph'].includes((child as Element).tagName)) {
                text += this.serializer.serializeToString(child); 
             } else {
                text += extractText(child); // Recurse for other elements
             }
          }
        }
        return text;
      } else if (node.nodeType === node.TEXT_NODE) {
        return node.nodeValue || '';
      }
      return '';
    };

    if (Array.isArray(nodes)) {
      // If multiple nodes are somehow passed (e.g., selecting elements instead of first one),
      // join their text contents.
      return nodes.map(extractText).join(''); 
    } else {
      return extractText(nodes);
    }
  }
  
  // Helper to map XLIFF state back to internal status during extraction
  private mapXliffStateToStatus(state: string | null, hasTargetText: boolean): SegmentStatus {
      if (!state && hasTargetText) return SegmentStatus.TRANSLATED; 
      if (!state) return SegmentStatus.PENDING;

      switch (state.toLowerCase()) {
          case 'new':
          case 'needs-translation': // Standard XLIFF states
          case 'needs-adaptation':
          case 'needs-l10n':
              return SegmentStatus.PENDING;
          case 'translated':
          case 'needs-review-translation': 
          case 'needs-review-adaptation':
          case 'needs-review-l10n':
              return SegmentStatus.TRANSLATED;
          case 'reviewed': 
              // Map XLIFF 'reviewed' to internal REVIEW_COMPLETED state
              return SegmentStatus.REVIEW_COMPLETED;
          case 'signed-off': // MemoQ state often means final
          case 'final': // Standard XLIFF state
              return SegmentStatus.COMPLETED;
          default:
              logger.warn(`Unknown XLIFF state encountered: '${state}'. Defaulting to PENDING.`);
              return SegmentStatus.PENDING;
      }
  }

  /**
   * Extracts segments and metadata from a given file path.
   * Matches the IFileProcessor interface.
   */
  async extractSegments(filePath: string, ...options: any[]): Promise<FileProcessingResult> {
    const isMemoQ = options.some(opt => opt && opt.isMemoQ === true);
    logger.info(`Starting XLIFF segment extraction from file: ${filePath} (MemoQ: ${isMemoQ})`);

    try {
      const fileContent = await readFile(filePath, 'utf-8');
      const doc = this.parser.parseFromString(fileContent, 'text/xml');
      const select = xpath.useNamespaces({
          'xliff': 'urn:oasis:names:tc:xliff:document:1.2',
          ...(isMemoQ && { 'm': 'http://www.memoq.com/memoq/xliff' }) 
      });

      const transUnitsXml = select(isMemoQ ? '//m:trans-unit' : '//xliff:trans-unit', doc);
      if (!Array.isArray(transUnitsXml)) {
        logger.warn(`No trans-unit elements found or xpath returned non-array in ${filePath}`);
        return { segments: [], metadata: {}, segmentCount: 0 };
      }

      const extractedSegments: Partial<ISegment>[] = [];
      let fileMetadata: Record<string, any> = {};

      // Extract file level metadata
      const fileNodeSelector = isMemoQ ? '//m:file' : '//xliff:file'; // Adjust selector if needed for MemoQ file node
      const fileNode = select(fileNodeSelector, doc, true) as Element | null;
      if (fileNode) {
          fileMetadata = {
              original: fileNode.getAttribute('original') || '',
              sourceLanguage: fileNode.getAttribute(isMemoQ ? 'm:source-language' : 'source-language') || '',
              targetLanguage: fileNode.getAttribute(isMemoQ ? 'm:target-language' : 'target-language') || '',
              datatype: fileNode.getAttribute('datatype') || '',
          };
      }

      for (const unitNode of transUnitsXml) {
          if (!(unitNode instanceof Node)) continue;
          const element = unitNode as Element;

          const id = element.getAttribute('id') ?? '';
          // Select the source/target ELEMENT, not just text() nodes
          const sourceSelector = isMemoQ ? './/m:source' : './/xliff:source';
          const targetSelector = isMemoQ ? './/m:target' : './/xliff:target';

          // Select the first matching element node
          const sourceNode = select(sourceSelector, element, true) as Node | null;
          const targetNode = select(targetSelector, element, true) as Node | null;
          
          // Pass the element nodes to getJoinedText
          const sourceText = this.getJoinedText(sourceNode);
          const targetText = this.getJoinedText(targetNode);

          if (!id || !sourceText) {
            logger.warn(`Skipping trans-unit with missing id or source in ${filePath}. ID: ${id}`);
            continue;
          }

          // Extract segment state
          let segmentState = null;
          if (isMemoQ) {
              segmentState = element.getAttribute('m:state'); // Or m:status?
          } else {
              // State is typically on the target element in standard XLIFF
              segmentState = targetNode instanceof Element ? targetNode.getAttribute('state') : null;
          }
          const status = this.mapXliffStateToStatus(segmentState, !!targetText);

          const segmentData: Partial<ISegment> = {
            index: extractedSegments.length,
            sourceText: sourceText,
            translation: targetText || '',
            status: status,
            sourceLength: sourceText.length,
            translatedLength: targetText ? targetText.length : undefined,
            metadata: { 
                xliffId: id,
                ...(isMemoQ && { memoqState: segmentState }), 
                ...(!isMemoQ && { xliffState: segmentState })
            }
          };
          extractedSegments.push(segmentData);
      }

      logger.info(`Successfully extracted ${extractedSegments.length} segments from XLIFF file: ${filePath}.`);
      return {
          segments: extractedSegments,
          metadata: fileMetadata,
          segmentCount: extractedSegments.length
      };

    } catch (error) {
      logger.error(`Error processing XLIFF file ${filePath}:`, error);
      throw new Error(`Failed to process XLIFF file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Writes translations back into an XLIFF file structure.
   * Matches the IFileProcessor interface signature.
   */
  async writeTranslations(
    segments: ISegment[], // Use full ISegment from DB
    originalFilePath: string,
    targetFilePath: string,
    ...options: any[] // Added options parameter
  ): Promise<void> {
    logger.info(`Starting XLIFF translation writing for ${segments.length} segments to ${targetFilePath}.`);
    const isMemoQ = options.some(opt => opt && opt.isMemoQ === true);
    try {
      const originalFileContent = await readFile(originalFilePath, 'utf-8');
      const doc = this.parser.parseFromString(originalFileContent, 'text/xml');
      const select = xpath.useNamespaces({
        'xliff': 'urn:oasis:names:tc:xliff:document:1.2',
        ...(isMemoQ && { 'm': 'http://www.memoq.com/memoq/xliff' })
      });

      for (const segment of segments) {
          const unitId = segment.metadata?.xliffId;

          if (!unitId || typeof unitId !== 'string' || unitId.includes("'")) {
               logger.warn(`Skipping segment with invalid or missing xliffId in metadata: segment index ${segment.index}`);
               continue;
          }

          const transUnitSelector = isMemoQ ? `//m:trans-unit[@id='${unitId}']` : `//xliff:trans-unit[@id='${unitId}']`;
          const transUnitNode = select(transUnitSelector, doc, true) as Node | null;

          if (!transUnitNode || !(transUnitNode instanceof Element)) {
            logger.warn(`Could not find trans-unit element with id '${unitId}' in original XLIFF file ${originalFilePath}.`);
            continue;
          }

          const targetSelector = isMemoQ ? 'm:target' : 'xliff:target';
          let targetNode = select(targetSelector, transUnitNode, true) as Element | null;

          if (!targetNode) {
            targetNode = doc.createElementNS(isMemoQ ? 'http://www.memoq.com/memoq/xliff' : 'urn:oasis:names:tc:xliff:document:1.2', 'target');
            const sourceSelector = isMemoQ ? 'm:source' : 'xliff:source';
            const sourceNode = select(sourceSelector, transUnitNode, true) as Node | null;
            if (sourceNode && sourceNode.nextSibling) {
                transUnitNode.insertBefore(targetNode, sourceNode.nextSibling);
            } else {
                transUnitNode.appendChild(targetNode);
            }
          }

          while (targetNode.firstChild) {
            targetNode.removeChild(targetNode.firstChild);
          }
          const textToWrite = segment.finalText ?? segment.translation ?? '';
          targetNode.appendChild(doc.createTextNode(textToWrite));

          // Update state attribute based on segment status
          const xliffState = this.mapStatusToXliffState(segment.status);
          targetNode.setAttribute('state', xliffState);
          // Update state on trans-unit too, using correct namespace if MemoQ
          transUnitNode.setAttribute(isMemoQ ? 'm:state' : 'state', xliffState); 
      }

      const updatedContent = this.serializer.serializeToString(doc);
      await writeFile(targetFilePath, updatedContent, 'utf-8');
      logger.info(`Finished writing translations to XLIFF file: ${targetFilePath}.`);

    } catch (error) {
      logger.error(`Error writing translations to XLIFF file ${targetFilePath}:`, error);
      throw new Error(`Failed to write translations to XLIFF file ${targetFilePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Helper to map internal status to XLIFF state
  private mapStatusToXliffState(status: SegmentStatus): string {
    switch (status) {
      case SegmentStatus.TRANSLATED:
      case SegmentStatus.REVIEW_PENDING:
      case SegmentStatus.REVIEW_IN_PROGRESS:
        return 'translated'; 
      case SegmentStatus.REVIEW_COMPLETED: 
          return 'reviewed'; 
      case SegmentStatus.COMPLETED: 
        return 'final';
      case SegmentStatus.PENDING:
      case SegmentStatus.TRANSLATING:
      default:
        return 'needs-translation';
    }
  }
}