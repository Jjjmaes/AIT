import { IFileProcessor, FileProcessingResult, ExtractedSegmentData } from '../types';
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
  private parseErrors: string[] = [];

  private errorHandler = {
    warning: (msg: string) => {
      logger.warn('XML Parser Warning:', msg);
    },
    error: (msg: string) => {
      logger.error('XML Parser Error:', msg);
      this.parseErrors.push(`ERROR: ${msg}`);
    },
    fatalError: (msg: string) => {
      logger.error('XML Parser Fatal Error:', msg);
      this.parseErrors.push(`FATAL: ${msg}`);
    },
  };

  constructor() {
    // this.parser = new DOMParser({ errorHandler: this.errorHandler });
  }

  private getJoinedText(nodes: any | any[] | null): string {
    if (!nodes) return '';
    
    const extractText = (node: any): string => {
      if (node.nodeType === 1 /* ELEMENT_NODE */) { 
        let text = '';
        for (let i = 0; i < node.childNodes.length; i++) {
          const child = node.childNodes[i];
          if (child.nodeType === 3 /* TEXT_NODE */) { 
            text += child.nodeValue;
          } else if (child.nodeType === 1 /* ELEMENT_NODE */) {
             if (['g', 'x', 'bx', 'ex', 'ph'].includes((child as Element).tagName)) {
                text += this.serializer.serializeToString(child); 
             } else {
                text += extractText(child); 
             }
          }
        }
        return text;
      } else if (node.nodeType === 3 /* TEXT_NODE */) { 
        return node.nodeValue || '';
      }
      return '';
    };

    if (Array.isArray(nodes)) {
      return nodes.map(extractText).join(''); 
    } else {
      return extractText(nodes);
    }
  }
  
  private mapXliffStateToStatus(state: string | null, hasTargetText: boolean): SegmentStatus {
      if (!state && hasTargetText) return SegmentStatus.TRANSLATED; 
      if (!state) return SegmentStatus.PENDING;

      switch (state.toLowerCase()) {
          case 'new':
          case 'needs-translation':
          case 'needs-adaptation':
          case 'needs-l10n':
              return SegmentStatus.PENDING;
          case 'translated':
          case 'needs-review-translation': 
          case 'needs-review-adaptation':
          case 'needs-review-l10n':
              return SegmentStatus.TRANSLATED;
          case 'reviewed': 
              return SegmentStatus.REVIEW_COMPLETED;
          case 'signed-off':
          case 'final':
          case 'confirmed':
              return SegmentStatus.CONFIRMED;
          default:
              logger.warn(`Unknown XLIFF state encountered: '${state}'. Defaulting to PENDING.`);
              return SegmentStatus.PENDING;
      }
  }

  // Maps internal SegmentStatus back to XLIFF state attributes
  private mapStatusToXliffState(status: SegmentStatus): string {
    switch (status) {
        case SegmentStatus.CONFIRMED:
            return 'final';
        case SegmentStatus.REVIEW_COMPLETED:
            return 'reviewed';
        case SegmentStatus.TRANSLATED:
            return 'translated';
        case SegmentStatus.PENDING:
        case SegmentStatus.ERROR:
        default:
            return 'new'; // Or 'needs-translation' depending on exact spec needs
    }
  }

  // Maps internal SegmentStatus back to MemoQ m:state attributes
  private mapStatusToMemoQState(status: SegmentStatus): string {
    switch (status) {
      case SegmentStatus.CONFIRMED:
      case SegmentStatus.REVIEW_COMPLETED: // Both map to Confirmed in MemoQ
        return 'Confirmed';
      case SegmentStatus.TRANSLATED:
        return 'Translated';
      case SegmentStatus.PENDING:
      case SegmentStatus.ERROR:
      default:
        return 'NeedsTranslation';
    }
  }

  async extractSegments(filePath: string, options?: { isMemoQ?: boolean }): Promise<FileProcessingResult> {
    const isMemoQ = options?.isMemoQ ?? false;
    logger.info(`Starting XLIFF segment extraction from file: ${filePath} (MemoQ: ${isMemoQ})`);

    try {
      const fileContent = await readFile(filePath, 'utf-8');
      
      this.parseErrors = [];
      
      const doc = this.parser.parseFromString(fileContent, 'text/xml'); 

      const selectForStructure = xpath.useNamespaces({ 'xliff': 'urn:oasis:names:tc:xliff:document:1.2' });
      const fileNode = selectForStructure('//xliff:file', doc, true);
      const bodyNode = selectForStructure('//xliff:file/xliff:body', doc, true);

      if (!fileNode || !bodyNode) {
           const errorDetail = this.parseErrors.length > 0 ? this.parseErrors.join('; ') : 'Invalid XLIFF structure: Missing <file> or <body> element.';
           logger.error(`Invalid XLIFF structure detected in ${filePath}. Details: ${errorDetail}`);
           throw new Error(`XML parsing failed: ${errorDetail}`);
      }
      
      const select = xpath.useNamespaces({
          'xliff': 'urn:oasis:names:tc:xliff:document:1.2',
          ...(isMemoQ && { 'm': 'http://www.memoq.com/memoq/xliff' }) 
      });

      let fileMetadata: Record<string, any> = {};
      if (fileNode && typeof fileNode === 'object' && !Array.isArray(fileNode) && fileNode.nodeType === 1) { 
           const elementNode = fileNode as Element;
           fileMetadata = {
               original: elementNode.getAttribute(isMemoQ ? 'm:original' : 'original') || '',
               sourceLanguage: elementNode.getAttribute(isMemoQ ? 'm:source-language' : 'source-language') || '',
               targetLanguage: elementNode.getAttribute(isMemoQ ? 'm:target-language' : 'target-language') || '',
               datatype: elementNode.getAttribute('datatype') || '',
           };
      }

      const transUnitsXml = select(isMemoQ ? '//m:trans-unit' : '//xliff:file/xliff:body/xliff:trans-unit', doc);
      if (!Array.isArray(transUnitsXml) || transUnitsXml.length === 0) {
        logger.warn(`No trans-unit elements found or xpath returned empty array in ${filePath}`, transUnitsXml);
        return { segments: [], metadata: fileMetadata, segmentCount: 0 };
      }

      const extractedSegments: ExtractedSegmentData[] = [];

      for (const unitNode of transUnitsXml) {
          if (!unitNode || typeof unitNode !== 'object' || !('nodeType' in unitNode) || unitNode.nodeType !== 1) continue;
          const element = unitNode as Element;

          const id = element.getAttribute('id') ?? '';
          const sourceNode = select(isMemoQ ? 'm:source' : 'xliff:source', element, true);
          const targetNode = select(isMemoQ ? 'm:target' : 'xliff:target', element, true);
          const sourceText = this.getJoinedText(sourceNode);
          const targetText = this.getJoinedText(targetNode);
          
          if (!id || !sourceText) {
            logger.warn(`Skipping trans-unit with missing id or source in ${filePath}. ID: ${id}`);
              continue;
          }

          let segmentState = null;
          if (isMemoQ) {
              segmentState = element.getAttribute('m:state');
          } else {
              segmentState = (targetNode && typeof targetNode === 'object' && !Array.isArray(targetNode) && targetNode.nodeType === 1) 
                ? (targetNode as Element).getAttribute('state') 
                : null;
          }
          const status = this.mapXliffStateToStatus(segmentState, !!targetText);

          const segmentData: ExtractedSegmentData = {
            index: extractedSegments.length,
              sourceText: sourceText,
            translation: targetText || undefined,
            status: status,
            sourceLength: sourceText.length,
            translatedLength: targetText ? targetText.length : undefined,
              metadata: {
                  xliffId: id,
                ...(isMemoQ ? { memoqState: segmentState } : { xliffState: segmentState })
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

  async writeTranslations(
    segments: ISegment[], 
    originalFilePath: string,
    targetFilePath: string, 
    options?: { isMemoQ?: boolean }
  ): Promise<void> {
    logger.info(`Starting XLIFF translation writing for ${segments.length} segments to ${targetFilePath}.`);
      const isMemoQ = options?.isMemoQ ?? false;
    try {
      const originalFileContent = await readFile(originalFilePath, 'utf-8');
      const doc = this.parser.parseFromString(originalFileContent, 'text/xml');
      const select = xpath.useNamespaces({
        'xliff': 'urn:oasis:names:tc:xliff:document:1.2',
        ...(isMemoQ && { 'm': 'http://www.memoq.com/memoq/xliff' })
      });

      const fragmentParser = new DOMParser(); 

      for (const [index, segment] of segments.entries()) {
          const unitId = segment.metadata?.xliffId;

          if (!unitId || typeof unitId !== 'string' || unitId.trim() === '' || unitId.includes("'") || unitId.includes('"')) {
               logger.warn(`Skipping segment with invalid, missing, or potentially unsafe xliffId in metadata: segment index ${index}, xliffId: ${unitId}`);
               continue;
          }

          const transUnitSelector = isMemoQ ? `//m:trans-unit[@id='${unitId}']` : `//xliff:trans-unit[@id='${unitId}']`;
          const transUnitNode = select(transUnitSelector, doc, true) as Node | null;

          if (!transUnitNode || transUnitNode.nodeType !== 1) {
            logger.warn(`Could not find trans-unit element node with id '${unitId}' or it is not an Element in original XLIFF file ${originalFilePath}.`);
            continue;
          }
          const transUnitElement = transUnitNode as Element;

          const targetSelector = isMemoQ ? 'm:target' : 'xliff:target';
          let targetNode = select(targetSelector, transUnitElement, true) as Element | null;
                  
                  if (!targetNode) {
            const sourceSelector = isMemoQ ? 'm:source' : 'xliff:source';
            const sourceNode = select(sourceSelector, transUnitElement, true) as Node | null;
                      if (sourceNode) {
              let sibling = sourceNode.nextSibling;
              while (sibling) {
                if (sibling.nodeType === 8) { 
                  transUnitElement.removeChild(sibling);
                  break; 
                }
                sibling = sibling.nextSibling;
              }
            }
            
            const namespaceURI = isMemoQ ? 'http://www.memoq.com/memoq/xliff' : 'urn:oasis:names:tc:xliff:document:1.2';
            targetNode = doc.createElementNS(namespaceURI, 'target');
            if (sourceNode && sourceNode.nextSibling) {
                transUnitElement.insertBefore(targetNode, sourceNode.nextSibling);
                      } else {
                transUnitElement.appendChild(targetNode);
                      }
                  }

                      while (targetNode.firstChild) {
                          targetNode.removeChild(targetNode.firstChild);
                      }
          
          const textToWrite = segment.finalText ?? segment.translation ?? '';

          if (textToWrite) {
            try {
              const fragmentDoc = fragmentParser.parseFromString(`<dummy>${textToWrite}</dummy>`, 'text/xml');
              const dummyRoot = fragmentDoc.documentElement;
              const nodesToAppend = Array.from(dummyRoot.childNodes);
              
              for (const node of nodesToAppend) {
                 const importedNode = doc.importNode(node, true);
                 targetNode.appendChild(importedNode);
              }

            } catch (parseError) {
              logger.warn(`Could not parse target text fragment for unit ${unitId}. Inserting as plain text. Error: ${parseError}`);
              targetNode.appendChild(doc.createTextNode(textToWrite));
            }
          } else {
             targetNode.appendChild(doc.createTextNode(''));
          }

          const targetState = this.mapStatusToXliffState(segment.status);
          targetNode.removeAttribute('state');
          targetNode.setAttribute('state', targetState); 
          
          const transUnitStateAttrName = isMemoQ ? 'm:state' : 'state';
          const transUnitStateValue = isMemoQ 
            ? this.mapStatusToMemoQState(segment.status) 
            : targetState;
          transUnitElement.removeAttribute(transUnitStateAttrName);
          transUnitElement.setAttribute(transUnitStateAttrName, transUnitStateValue);
      }

      const updatedContent = this.serializer.serializeToString(doc);
      
      await writeFile(targetFilePath, updatedContent, 'utf-8');
      logger.info(`Finished writing translations to XLIFF file: ${targetFilePath}.`);

    } catch (error) {
      logger.error(`Error processing XLIFF file ${originalFilePath}:`, error);
      throw new Error(`Failed to process XLIFF file ${originalFilePath}: ${error instanceof Error ? error.message : String(error)}`);
      }
  }
} 