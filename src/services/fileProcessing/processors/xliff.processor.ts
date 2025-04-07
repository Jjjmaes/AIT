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
              return SegmentStatus.COMPLETED;
          default:
              logger.warn(`Unknown XLIFF state encountered: '${state}'. Defaulting to PENDING.`);
              return SegmentStatus.PENDING;
      }
  }

  // Maps internal SegmentStatus back to XLIFF state attributes
  private mapStatusToXliffState(status: SegmentStatus): string {
    switch (status) {
        case SegmentStatus.COMPLETED:
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

  async extractSegments(filePath: string, ...options: any[]): Promise<FileProcessingResult> {
    const isMemoQ = options.some(opt => opt && opt.isMemoQ === true);
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

      const extractedSegments: Partial<ISegment>[] = [];

      for (const unitNode of transUnitsXml) {
          if (!unitNode || typeof unitNode !== 'object' || !unitNode.nodeType) continue;
          const element = unitNode as Element;

          const id = element.getAttribute('id') ?? '';
          const sourceSelector = isMemoQ ? './/m:source' : './/xliff:source';
          const targetSelector = isMemoQ ? './/m:target' : './/xliff:target';

          const sourceNode = select(sourceSelector, element, true) as Node | null;
          const targetNode = select(targetSelector, element, true) as Node | null;
          
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
              segmentState = targetNode?.nodeType === 1 ? (targetNode as Element).getAttribute('state') : null;
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

  async writeTranslations(
    segments: ISegment[],
    originalFilePath: string,
    targetFilePath: string,
    ...options: any[]
  ): Promise<void> {
    console.log('[writeTranslations] Starting...');
    logger.info(`Starting XLIFF translation writing for ${segments.length} segments to ${targetFilePath}.`);
    const isMemoQ = options.some(opt => opt && opt.isMemoQ === true);
    try {
      const originalFileContent = await readFile(originalFilePath, 'utf-8');
      const doc = this.parser.parseFromString(originalFileContent, 'text/xml');
      const select = xpath.useNamespaces({
        'xliff': 'urn:oasis:names:tc:xliff:document:1.2',
        ...(isMemoQ && { 'm': 'http://www.memoq.com/memoq/xliff' })
      });

      const fragmentParser = new DOMParser(); 

      for (const [index, segment] of segments.entries()) {
          console.log(`[writeTranslations] Processing segment index: ${index}`);
          // Get the unitId, don't assign a default value here
          const unitId = segment.metadata?.xliffId;

          // Check if unitId is a valid non-empty string and doesn't contain quotes (potential XPath injection)
          if (!unitId || typeof unitId !== 'string' || unitId.trim() === '' || unitId.includes("'") || unitId.includes('"')) {
               logger.warn(`Skipping segment with invalid, missing, or potentially unsafe xliffId in metadata: segment index ${index}, xliffId: ${unitId}`);
               continue;
          }

          // Now we know unitId is a valid string, proceed with finding the node
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
            // Find and remove existing comment sibling of source, if any
            const sourceSelector = isMemoQ ? 'm:source' : 'xliff:source';
            const sourceNode = select(sourceSelector, transUnitElement, true) as Node | null;
            if (sourceNode) {
              let sibling = sourceNode.nextSibling;
              while (sibling) {
                if (sibling.nodeType === 8 /* COMMENT_NODE */) {
                  transUnitElement.removeChild(sibling);
                  break; // Assume only one relevant comment to remove
                }
                sibling = sibling.nextSibling;
              }
            }
            
            // Create and append the new target node
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
            console.log(`[writeTranslations] Attempting to parse fragment for unit ${unitId}`);
            try {
              const fragmentDoc = fragmentParser.parseFromString(`<dummy>${textToWrite}</dummy>`, 'text/xml');
              console.log(`[writeTranslations] Parsed fragment for unit ${unitId}`);
              const dummyRoot = fragmentDoc.documentElement;
              const nodesToAppend = Array.from(dummyRoot.childNodes);
              console.log(`[writeTranslations] Found ${nodesToAppend.length} nodes in fragment for unit ${unitId}`);
              
              // Iterate through the copied array
              for (const node of nodesToAppend) {
                 console.log(`[writeTranslations] Importing node type ${node.nodeType} for unit ${unitId}`);
                 const importedNode = doc.importNode(node, true);
                 console.log(`[writeTranslations] Appending imported node type ${importedNode.nodeType} for unit ${unitId}`);
                 targetNode.appendChild(importedNode);
                 console.log(`[writeTranslations] Successfully appended node for unit ${unitId}`);
              }
              
              if (nodesToAppend.length > 0) {
                  console.log(`[writeTranslations] Appended fragment children for unit ${unitId}`); 
              }

            } catch (parseError) {
              console.log(`[writeTranslations] Fragment parse FAILED for unit ${unitId}`, parseError);
              logger.warn(`Could not parse target text fragment for unit ${unitId}. Inserting as plain text. Error: ${parseError}`);
              targetNode.appendChild(doc.createTextNode(textToWrite));
            }
          } else {
             targetNode.appendChild(doc.createTextNode(''));
          }

          // Update state attributes
          const xliffState = this.mapStatusToXliffState(segment.status);
          
          // Remove old state attribute first, then set new one
          targetNode.removeAttribute('state');
          targetNode.setAttribute('state', xliffState);
          
          // Do the same for the parent trans-unit element
          const transUnitStateAttrName = isMemoQ ? 'm:state' : 'state';
          transUnitElement.removeAttribute(transUnitStateAttrName);
          transUnitElement.setAttribute(transUnitStateAttrName, xliffState);
      }

      // Finished processing all segments in the loop
      console.log('[writeTranslations] Finished loop, preparing to serialize...');

      // Serialize the modified document
      const updatedContent = this.serializer.serializeToString(doc);
      
      console.log('[writeTranslations] Serialization complete, preparing to write file...');

      // Write the updated content to the target file
      await writeFile(targetFilePath, updatedContent, 'utf-8');
      console.log('[writeTranslations] Finished writing file.');
      logger.info(`Finished writing translations to XLIFF file: ${targetFilePath}.`);

    } catch (error) {
      logger.error(`Error processing XLIFF file ${originalFilePath}:`, error);
      throw new Error(`Failed to process XLIFF file ${originalFilePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}