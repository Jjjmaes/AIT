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
    }
    // Helper function to safely get text from xpath results
    getJoinedText(nodes) {
        if (!nodes)
            return '';
        if (Array.isArray(nodes)) {
            // Filter out non-text nodes just in case, though xpath should only return text nodes here
            return nodes.filter(n => n.nodeType === 3).map(n => n.nodeValue).join('');
        }
        // Handle single node case (unlikely for //text() but safer)
        return nodes.nodeType === 3 ? (nodes.nodeValue || '') : '';
    }
    // Helper to map XLIFF state back to internal status during extraction
    mapXliffStateToStatus(state, hasTargetText) {
        if (!state && hasTargetText)
            return segment_model_1.SegmentStatus.TRANSLATED;
        if (!state)
            return segment_model_1.SegmentStatus.PENDING;
        switch (state.toLowerCase()) {
            case 'new':
            case 'needs-translation': // Standard XLIFF states
            case 'needs-adaptation':
            case 'needs-l10n':
                return segment_model_1.SegmentStatus.PENDING;
            case 'translated':
            case 'needs-review-translation':
            case 'needs-review-adaptation':
            case 'needs-review-l10n':
                return segment_model_1.SegmentStatus.TRANSLATED;
            case 'reviewed':
                // Map XLIFF 'reviewed' to internal REVIEW_COMPLETED state
                return segment_model_1.SegmentStatus.REVIEW_COMPLETED;
            case 'signed-off': // MemoQ state often means final
            case 'final': // Standard XLIFF state
                return segment_model_1.SegmentStatus.COMPLETED;
            default:
                logger_1.default.warn(`Unknown XLIFF state encountered: '${state}'. Defaulting to PENDING.`);
                return segment_model_1.SegmentStatus.PENDING;
        }
    }
    /**
     * Extracts segments and metadata from a given file path.
     * Matches the IFileProcessor interface.
     */
    async extractSegments(filePath, ...options) {
        const isMemoQ = options.some(opt => opt && opt.isMemoQ === true);
        logger_1.default.info(`Starting XLIFF segment extraction from file: ${filePath} (MemoQ: ${isMemoQ})`);
        try {
            const fileContent = await (0, promises_1.readFile)(filePath, 'utf-8');
            const doc = this.parser.parseFromString(fileContent, 'text/xml');
            const select = xpath_1.default.useNamespaces({
                'xliff': 'urn:oasis:names:tc:xliff:document:1.2',
                ...(isMemoQ && { 'm': 'http://www.memoq.com/memoq/xliff' })
            });
            const transUnitsXml = select(isMemoQ ? '//m:trans-unit' : '//xliff:trans-unit', doc);
            if (!Array.isArray(transUnitsXml)) {
                logger_1.default.warn(`No trans-unit elements found or xpath returned non-array in ${filePath}`);
                return { segments: [], metadata: {}, segmentCount: 0 };
            }
            const extractedSegments = [];
            let fileMetadata = {};
            // Extract file level metadata
            const fileNodeSelector = isMemoQ ? '//m:file' : '//xliff:file'; // Adjust selector if needed for MemoQ file node
            const fileNode = select(fileNodeSelector, doc, true);
            if (fileNode) {
                fileMetadata = {
                    original: fileNode.getAttribute('original') || '',
                    sourceLanguage: fileNode.getAttribute(isMemoQ ? 'm:source-language' : 'source-language') || '',
                    targetLanguage: fileNode.getAttribute(isMemoQ ? 'm:target-language' : 'target-language') || '',
                    datatype: fileNode.getAttribute('datatype') || '',
                };
            }
            for (const unitNode of transUnitsXml) {
                if (!(unitNode instanceof Node))
                    continue;
                const element = unitNode;
                const id = element.getAttribute('id') ?? '';
                const sourceSelector = isMemoQ ? './/m:source//text()' : './/xliff:source//text()';
                const targetSelector = isMemoQ ? './/m:target//text()' : './/xliff:target//text()';
                const sourceNodes = select(sourceSelector, element);
                const targetNodes = select(targetSelector, element);
                const sourceText = this.getJoinedText(sourceNodes);
                const targetText = this.getJoinedText(targetNodes);
                if (!id || !sourceText) {
                    logger_1.default.warn(`Skipping trans-unit with missing id or source in ${filePath}. ID: ${id}`);
                    continue;
                }
                // Extract segment state
                let segmentState = null;
                if (isMemoQ) {
                    segmentState = element.getAttribute('m:state'); // Or m:status?
                }
                else {
                    const targetElement = select('.//xliff:target', element, true);
                    segmentState = targetElement?.getAttribute('state') ?? null;
                }
                const status = this.mapXliffStateToStatus(segmentState, !!targetText);
                const segmentData = {
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
    /**
     * Writes translations back into an XLIFF file structure.
     * Matches the IFileProcessor interface signature.
     */
    async writeTranslations(segments, // Use full ISegment from DB
    originalFilePath, targetFilePath, ...options // Added options parameter
    ) {
        logger_1.default.info(`Starting XLIFF translation writing for ${segments.length} segments to ${targetFilePath}.`);
        const isMemoQ = options.some(opt => opt && opt.isMemoQ === true);
        try {
            const originalFileContent = await (0, promises_1.readFile)(originalFilePath, 'utf-8');
            const doc = this.parser.parseFromString(originalFileContent, 'text/xml');
            const select = xpath_1.default.useNamespaces({
                'xliff': 'urn:oasis:names:tc:xliff:document:1.2',
                ...(isMemoQ && { 'm': 'http://www.memoq.com/memoq/xliff' })
            });
            for (const segment of segments) {
                const unitId = segment.metadata?.xliffId;
                if (!unitId || typeof unitId !== 'string' || unitId.includes("'")) {
                    logger_1.default.warn(`Skipping segment with invalid or missing xliffId in metadata: segment index ${segment.index}`);
                    continue;
                }
                const transUnitSelector = isMemoQ ? `//m:trans-unit[@id='${unitId}']` : `//xliff:trans-unit[@id='${unitId}']`;
                const transUnitNode = select(transUnitSelector, doc, true);
                if (!transUnitNode || !(transUnitNode instanceof Element)) {
                    logger_1.default.warn(`Could not find trans-unit element with id '${unitId}' in original XLIFF file ${originalFilePath}.`);
                    continue;
                }
                const targetSelector = isMemoQ ? 'm:target' : 'xliff:target';
                let targetNode = select(targetSelector, transUnitNode, true);
                if (!targetNode) {
                    targetNode = doc.createElementNS(isMemoQ ? 'http://www.memoq.com/memoq/xliff' : 'urn:oasis:names:tc:xliff:document:1.2', 'target');
                    const sourceSelector = isMemoQ ? 'm:source' : 'xliff:source';
                    const sourceNode = select(sourceSelector, transUnitNode, true);
                    if (sourceNode && sourceNode.nextSibling) {
                        transUnitNode.insertBefore(targetNode, sourceNode.nextSibling);
                    }
                    else {
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
            await (0, promises_1.writeFile)(targetFilePath, updatedContent, 'utf-8');
            logger_1.default.info(`Finished writing translations to XLIFF file: ${targetFilePath}.`);
        }
        catch (error) {
            logger_1.default.error(`Error writing translations to XLIFF file ${targetFilePath}:`, error);
            throw new Error(`Failed to write translations to XLIFF file ${targetFilePath}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    // Helper to map internal status to XLIFF state
    mapStatusToXliffState(status) {
        switch (status) {
            case segment_model_1.SegmentStatus.TRANSLATED:
            case segment_model_1.SegmentStatus.REVIEW_PENDING:
            case segment_model_1.SegmentStatus.REVIEW_IN_PROGRESS:
                return 'translated';
            case segment_model_1.SegmentStatus.REVIEW_COMPLETED:
                return 'reviewed';
            case segment_model_1.SegmentStatus.COMPLETED:
                return 'final';
            case segment_model_1.SegmentStatus.PENDING:
            case segment_model_1.SegmentStatus.TRANSLATING:
            default:
                return 'needs-translation';
        }
    }
}
exports.XliffProcessor = XliffProcessor;
