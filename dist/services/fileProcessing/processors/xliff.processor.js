"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.XliffProcessor = void 0;
const segment_model_1 = require("../../../models/segment.model");
const logger_1 = __importDefault(require("../../../utils/logger"));
const xmldom_1 = require("@xmldom/xmldom");
const xpath_1 = __importDefault(require("xpath"));
const promises_1 = require("fs/promises");
/**
 * Processes XLIFF 1.2 files (including MemoQ variations).
 */
class XliffProcessor {
    constructor() {
        this.parser = new xmldom_1.DOMParser();
        this.serializer = new xmldom_1.XMLSerializer();
        this.parseErrors = [];
        this.errorHandler = {
            warning: (msg) => {
                logger_1.default.warn('XML Parser Warning:', msg);
            },
            error: (msg) => {
                logger_1.default.error('XML Parser Error:', msg);
                this.parseErrors.push(`ERROR: ${msg}`);
            },
            fatalError: (msg) => {
                logger_1.default.error('XML Parser Fatal Error:', msg);
                this.parseErrors.push(`FATAL: ${msg}`);
            },
        };
        // this.parser = new DOMParser({ errorHandler: this.errorHandler });
    }
    getJoinedText(nodes) {
        if (!nodes)
            return '';
        const extractText = (node) => {
            if (node.nodeType === 1 /* ELEMENT_NODE */) {
                let text = '';
                for (let i = 0; i < node.childNodes.length; i++) {
                    const child = node.childNodes[i];
                    if (child.nodeType === 3 /* TEXT_NODE */) {
                        text += child.nodeValue;
                    }
                    else if (child.nodeType === 1 /* ELEMENT_NODE */) {
                        if (['g', 'x', 'bx', 'ex', 'ph'].includes(child.tagName)) {
                            text += this.serializer.serializeToString(child);
                        }
                        else {
                            text += extractText(child);
                        }
                    }
                }
                return text;
            }
            else if (node.nodeType === 3 /* TEXT_NODE */) {
                return node.nodeValue || '';
            }
            return '';
        };
        if (Array.isArray(nodes)) {
            return nodes.map(extractText).join('');
        }
        else {
            return extractText(nodes);
        }
    }
    mapXliffStateToStatus(state, hasTargetText) {
        if (!state && hasTargetText)
            return segment_model_1.SegmentStatus.TRANSLATED;
        if (!state)
            return segment_model_1.SegmentStatus.PENDING;
        switch (state.toLowerCase()) {
            case 'new':
            case 'needs-translation':
            case 'needs-adaptation':
            case 'needs-l10n':
                return segment_model_1.SegmentStatus.PENDING;
            case 'translated':
            case 'needs-review-translation':
            case 'needs-review-adaptation':
            case 'needs-review-l10n':
                return segment_model_1.SegmentStatus.TRANSLATED;
            case 'reviewed':
                return segment_model_1.SegmentStatus.REVIEW_COMPLETED;
            case 'signed-off':
            case 'final':
            case 'confirmed':
                return segment_model_1.SegmentStatus.CONFIRMED;
            default:
                logger_1.default.warn(`Unknown XLIFF state encountered: '${state}'. Defaulting to PENDING.`);
                return segment_model_1.SegmentStatus.PENDING;
        }
    }
    // Maps internal SegmentStatus back to XLIFF state attributes
    mapStatusToXliffState(status) {
        switch (status) {
            case segment_model_1.SegmentStatus.CONFIRMED:
                return 'final';
            case segment_model_1.SegmentStatus.REVIEW_COMPLETED:
                return 'reviewed';
            case segment_model_1.SegmentStatus.TRANSLATED:
                return 'translated';
            case segment_model_1.SegmentStatus.PENDING:
            case segment_model_1.SegmentStatus.ERROR:
            default:
                return 'new'; // Or 'needs-translation' depending on exact spec needs
        }
    }
    // Maps internal SegmentStatus back to MemoQ m:state attributes
    mapStatusToMemoQState(status) {
        switch (status) {
            case segment_model_1.SegmentStatus.CONFIRMED:
            case segment_model_1.SegmentStatus.REVIEW_COMPLETED: // Both map to Confirmed in MemoQ
                return 'Confirmed';
            case segment_model_1.SegmentStatus.TRANSLATED:
                return 'Translated';
            case segment_model_1.SegmentStatus.PENDING:
            case segment_model_1.SegmentStatus.ERROR:
            default:
                return 'NeedsTranslation';
        }
    }
    async extractSegments(filePath, options) {
        const isMemoQ = options?.isMemoQ ?? false;
        logger_1.default.info(`Starting XLIFF segment extraction from file: ${filePath} (MemoQ: ${isMemoQ})`);
        try {
            const fileContent = await (0, promises_1.readFile)(filePath, 'utf-8');
            this.parseErrors = [];
            const doc = this.parser.parseFromString(fileContent, 'text/xml');
            const selectForStructure = xpath_1.default.useNamespaces({ 'xliff': 'urn:oasis:names:tc:xliff:document:1.2' });
            const fileNode = selectForStructure('//xliff:file', doc, true);
            const bodyNode = selectForStructure('//xliff:file/xliff:body', doc, true);
            if (!fileNode || !bodyNode) {
                const errorDetail = this.parseErrors.length > 0 ? this.parseErrors.join('; ') : 'Invalid XLIFF structure: Missing <file> or <body> element.';
                logger_1.default.error(`Invalid XLIFF structure detected in ${filePath}. Details: ${errorDetail}`);
                throw new Error(`XML parsing failed: ${errorDetail}`);
            }
            const select = xpath_1.default.useNamespaces({
                'xliff': 'urn:oasis:names:tc:xliff:document:1.2',
                ...(isMemoQ && { 'm': 'http://www.memoq.com/memoq/xliff' })
            });
            let fileMetadata = {};
            if (fileNode && typeof fileNode === 'object' && !Array.isArray(fileNode) && fileNode.nodeType === 1) {
                const elementNode = fileNode;
                fileMetadata = {
                    original: elementNode.getAttribute(isMemoQ ? 'm:original' : 'original') || '',
                    sourceLanguage: elementNode.getAttribute(isMemoQ ? 'm:source-language' : 'source-language') || '',
                    targetLanguage: elementNode.getAttribute(isMemoQ ? 'm:target-language' : 'target-language') || '',
                    datatype: elementNode.getAttribute('datatype') || '',
                };
            }
            const transUnitsXml = select(isMemoQ ? '//m:trans-unit' : '//xliff:file/xliff:body/xliff:trans-unit', doc);
            if (!Array.isArray(transUnitsXml) || transUnitsXml.length === 0) {
                logger_1.default.warn(`No trans-unit elements found or xpath returned empty array in ${filePath}`, transUnitsXml);
                return { segments: [], metadata: fileMetadata, segmentCount: 0 };
            }
            const extractedSegments = [];
            for (const unitNode of transUnitsXml) {
                if (!unitNode || typeof unitNode !== 'object' || !('nodeType' in unitNode) || unitNode.nodeType !== 1)
                    continue;
                const element = unitNode;
                const id = element.getAttribute('id') ?? '';
                const sourceNode = select(isMemoQ ? 'm:source' : 'xliff:source', element, true);
                const targetNode = select(isMemoQ ? 'm:target' : 'xliff:target', element, true);
                const sourceText = this.getJoinedText(sourceNode);
                const targetText = this.getJoinedText(targetNode);
                if (!id || !sourceText) {
                    logger_1.default.warn(`Skipping trans-unit with missing id or source in ${filePath}. ID: ${id}`);
                    continue;
                }
                let segmentState = null;
                if (isMemoQ) {
                    segmentState = element.getAttribute('m:state');
                }
                else {
                    segmentState = (targetNode && typeof targetNode === 'object' && !Array.isArray(targetNode) && targetNode.nodeType === 1)
                        ? targetNode.getAttribute('state')
                        : null;
                }
                const status = this.mapXliffStateToStatus(segmentState, !!targetText);
                const segmentData = {
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
            logger_1.default.info(`Successfully extracted ${extractedSegments.length} segments from XLIFF file: ${filePath}.`);
            return {
                segments: extractedSegments,
                metadata: fileMetadata,
                segmentCount: extractedSegments.length
            };
        }
        catch (error) {
            logger_1.default.error(`Error processing XLIFF file ${filePath}:`, error);
            throw new Error(`Failed to process XLIFF file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async writeTranslations(segments, originalFilePath, targetFilePath, options) {
        logger_1.default.info(`Starting XLIFF translation writing for ${segments.length} segments to ${targetFilePath}.`);
        const isMemoQ = options?.isMemoQ ?? false;
        try {
            const originalFileContent = await (0, promises_1.readFile)(originalFilePath, 'utf-8');
            const doc = this.parser.parseFromString(originalFileContent, 'text/xml');
            const select = xpath_1.default.useNamespaces({
                'xliff': 'urn:oasis:names:tc:xliff:document:1.2',
                ...(isMemoQ && { 'm': 'http://www.memoq.com/memoq/xliff' })
            });
            const fragmentParser = new xmldom_1.DOMParser();
            for (const [index, segment] of segments.entries()) {
                const unitId = segment.metadata?.xliffId;
                if (!unitId || typeof unitId !== 'string' || unitId.trim() === '' || unitId.includes("'") || unitId.includes('"')) {
                    logger_1.default.warn(`Skipping segment with invalid, missing, or potentially unsafe xliffId in metadata: segment index ${index}, xliffId: ${unitId}`);
                    continue;
                }
                const transUnitSelector = isMemoQ ? `//m:trans-unit[@id='${unitId}']` : `//xliff:trans-unit[@id='${unitId}']`;
                const transUnitNode = select(transUnitSelector, doc, true);
                if (!transUnitNode || transUnitNode.nodeType !== 1) {
                    logger_1.default.warn(`Could not find trans-unit element node with id '${unitId}' or it is not an Element in original XLIFF file ${originalFilePath}.`);
                    continue;
                }
                const transUnitElement = transUnitNode;
                const targetSelector = isMemoQ ? 'm:target' : 'xliff:target';
                let targetNode = select(targetSelector, transUnitElement, true);
                if (!targetNode) {
                    const sourceSelector = isMemoQ ? 'm:source' : 'xliff:source';
                    const sourceNode = select(sourceSelector, transUnitElement, true);
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
                    }
                    else {
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
                    }
                    catch (parseError) {
                        logger_1.default.warn(`Could not parse target text fragment for unit ${unitId}. Inserting as plain text. Error: ${parseError}`);
                        targetNode.appendChild(doc.createTextNode(textToWrite));
                    }
                }
                else {
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
            await (0, promises_1.writeFile)(targetFilePath, updatedContent, 'utf-8');
            logger_1.default.info(`Finished writing translations to XLIFF file: ${targetFilePath}.`);
        }
        catch (error) {
            logger_1.default.error(`Error processing XLIFF file ${originalFilePath}:`, error);
            throw new Error(`Failed to process XLIFF file ${originalFilePath}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
exports.XliffProcessor = XliffProcessor;
