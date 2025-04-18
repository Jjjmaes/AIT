"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.translationMemoryService = exports.TranslationMemoryService = void 0;
const typedi_1 = require("typedi");
const mongoose_1 = require("mongoose");
const translationMemory_model_1 = require("../models/translationMemory.model");
const translationMemorySet_model_1 = require("../models/translationMemorySet.model");
const logger_1 = __importDefault(require("../utils/logger"));
const errorHandler_1 = require("../utils/errorHandler");
const errors_1 = require("../utils/errors");
const fast_xml_parser_1 = require("fast-xml-parser"); // Import the parser
let TranslationMemoryService = class TranslationMemoryService {
    constructor() {
        this.serviceName = 'TranslationMemoryService';
        // Initialize parser with options to handle TMX structure
        this.xmlParser = new fast_xml_parser_1.XMLParser({
            ignoreAttributes: false, // Need attributes like xml:lang
            attributeNamePrefix: "@_",
            textNodeName: "#text",
            allowBooleanAttributes: true,
            parseAttributeValue: true,
            trimValues: true,
            // Consider array paths if elements can appear multiple times
            isArray: (name, jpath, isLeafNode, isAttribute) => {
                // Treat 'tu' and 'tuv' as arrays even if only one exists
                return ['tmx.body.tu', 'tmx.body.tu.tuv'].includes(jpath);
            }
        });
        logger_1.default.info(`[${this.serviceName}] Initialized XML Parser.`);
    }
    /**
     * Creates a new Translation Memory Set (Collection).
     */
    async createTMSet(userId, data) {
        const methodName = 'createTMSet';
        (0, errorHandler_1.validateId)(userId, '创建用户');
        if (!data.name || !data.sourceLanguage || !data.targetLanguage) {
            throw new errors_1.ValidationError('Missing required fields (name, sourceLanguage, targetLanguage) for TM set.');
        }
        try {
            const newTMSet = new translationMemorySet_model_1.TranslationMemorySet({
                ...data,
                createdBy: new mongoose_1.Types.ObjectId(userId),
                domain: data.domain || 'general',
                isPublic: data.isPublic ?? false,
                entryCount: 0, // Initialize count
                // project: data.projectId ? new Types.ObjectId(data.projectId) : undefined,
            });
            await newTMSet.save();
            logger_1.default.info(`[${this.serviceName}.${methodName}] TM Set '${newTMSet.name}' created by user ${userId}`);
            return newTMSet;
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '创建翻译记忆库');
        }
    }
    /**
     * Retrieves all Translation Memory Sets, potentially filtering by user.
     */
    async getAllTMSets(userId) {
        const methodName = 'getAllTMSets';
        try {
            // Basic query: find sets created by the user OR public sets
            // Adjust logic based on requirements (e.g., admin sees all, etc.)
            const query = {};
            if (userId) {
                query.$or = [
                    { createdBy: new mongoose_1.Types.ObjectId(userId) },
                    { isPublic: true }
                ];
            }
            else {
                // If no user ID, perhaps only show public sets? Or throw error?
                // For now, let's assume an unauthenticated user sees only public sets.
                query.isPublic = true;
            }
            logger_1.default.debug(`[${this.serviceName}.${methodName}] Fetching TM Sets with query: ${JSON.stringify(query)}`);
            // Sort by creation date descending, add other sorting/pagination later if needed
            const tmSets = await translationMemorySet_model_1.TranslationMemorySet.find(query).sort({ createdAt: -1 }).exec();
            logger_1.default.info(`[${this.serviceName}.${methodName}] Found ${tmSets.length} TM Sets.`);
            return tmSets;
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '获取翻译记忆库列表');
        }
    }
    /**
     * Adds a new entry to the Translation Memory.
     * Typically called after a segment translation is confirmed/approved.
     * Handles potential duplicates by updating usage count/last used date (optional).
     */
    async addEntry(data) {
        const methodName = 'addEntry';
        if (!data.sourceLanguage || !data.targetLanguage || !data.sourceText || !data.targetText) {
            throw new errors_1.ValidationError('Missing required fields (sourceLanguage, targetLanguage, sourceText, targetText) for TM entry.');
        }
        try {
            const existingEntry = await translationMemory_model_1.TranslationMemory.findOne({
                sourceLanguage: data.sourceLanguage,
                targetLanguage: data.targetLanguage,
                sourceText: data.sourceText,
                project: data.projectId ? new mongoose_1.Types.ObjectId(data.projectId) : undefined,
            });
            if (existingEntry) {
                let updated = false;
                if (existingEntry.targetText !== data.targetText) {
                    existingEntry.targetText = data.targetText; // Update target if changed
                    updated = true;
                }
                existingEntry.lastUsedAt = new Date();
                existingEntry.usageCount = (existingEntry.usageCount || 0) + 1;
                // Optionally update createdBy if the new data provides it and is different?
                // if (data.userId && (!existingEntry.createdBy || existingEntry.createdBy.toString() !== data.userId)) {
                //   existingEntry.createdBy = new Types.ObjectId(data.userId);
                //   updated = true;
                // }
                await existingEntry.save();
                if (updated) {
                    logger_1.default.debug(`[${this.serviceName}.${methodName}] Updated existing TM entry target for project ${data.projectId || 'none'}`);
                    return { entry: existingEntry, status: 'updated' };
                }
                else {
                    logger_1.default.debug(`[${this.serviceName}.${methodName}] Found identical TM entry, updated usage stats for project ${data.projectId || 'none'}`);
                    return { entry: existingEntry, status: 'updated' }; // Still consider it 'updated' because usage stats changed
                }
            }
            else {
                const newEntryData = {
                    sourceLanguage: data.sourceLanguage,
                    targetLanguage: data.targetLanguage,
                    sourceText: data.sourceText,
                    targetText: data.targetText,
                    project: data.projectId ? new mongoose_1.Types.ObjectId(data.projectId) : undefined,
                    createdBy: data.userId ? new mongoose_1.Types.ObjectId(data.userId) : undefined,
                    lastUsedAt: new Date(),
                    usageCount: 1,
                };
                const newEntry = new translationMemory_model_1.TranslationMemory(newEntryData);
                await newEntry.save();
                logger_1.default.info(`[${this.serviceName}.${methodName}] Added new TM entry for project ${data.projectId || 'none'}`);
                return { entry: newEntry, status: 'added' };
            }
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '添加/更新翻译记忆条目');
        }
    }
    /**
     * Finds potential matches for a given source text within the Translation Memory.
     * TODO: Implement matching logic (exact first, then fuzzy).
     */
    async findMatches(sourceText, sourceLang, targetLang, projectId) {
        const methodName = 'findMatches';
        logger_1.default.debug(`[${this.serviceName}.${methodName}] Searching TM for: "${sourceText}" (${sourceLang}->${targetLang}), Project: ${projectId || 'any'}`);
        // Placeholder - Implement actual matching logic
        const matches = [];
        try {
            // 1. Exact Match Query (most efficient)
            const query = {
                sourceLanguage: sourceLang,
                targetLanguage: targetLang,
                sourceText: sourceText,
            };
            // Filter by project if provided
            if (projectId) {
                query.project = new mongoose_1.Types.ObjectId(projectId);
            }
            else {
                // If no project, maybe only search global/null-project TMs? Or all?
                // For now, let's allow finding matches without project context if projectId is omitted
                // query.project = null; // Example: Only search global TM
            }
            const exactMatch = await translationMemory_model_1.TranslationMemory.findOne(query).sort({ lastUsedAt: -1 }).exec(); // Prioritize recently used
            if (exactMatch) {
                logger_1.default.info(`[${this.serviceName}.${methodName}] Found exact match (100%).`);
                // Update usage stats asynchronously?
                translationMemory_model_1.TranslationMemory.updateOne({ _id: exactMatch._id }, { $inc: { usageCount: 1 }, $set: { lastUsedAt: new Date() } }).catch(err => logger_1.default.warn(`Failed to update TM usage stats for ${exactMatch._id}: ${err.message}`));
                matches.push({ entry: exactMatch, score: 100 });
                // Return immediately if only exact match is needed? Or continue for fuzzy?
                // For now, we'll continue to potentially find fuzzy matches too, but place exact first.
            }
            // 2. Fuzzy Match Query (more complex)
            // TODO: Implement fuzzy matching if exact match not found or if lower-similarity matches are desired.
            // This might involve:
            //  - Fetching candidate entries based on language pair and project.
            //  - Using a library like 'fuse.js' or Levenshtein distance calculation in memory.
            //  - Example using basic text search (less accurate for fuzzy):
            /*
            if (matches.length === 0) { // Only if no exact match
               const fuzzyQuery: mongoose.FilterQuery<ITranslationMemoryEntry> = {
                   sourceLanguage: sourceLang,
                   targetLanguage: targetLang,
                   $text: { $search: sourceText }, // MongoDB text search
                };
                if (projectId) { fuzzyQuery.project = new Types.ObjectId(projectId); }
                
                const potentialMatches = await TranslationMemory.find(
                   fuzzyQuery,
                   { score: { $meta: "textScore" } } // Get relevance score from text search
                ).sort({ score: { $meta: "textScore" } }).limit(5).exec();
   
                // Calculate actual similarity (e.g., Levenshtein) for potentialMatches
                // Add those above a threshold to the 'matches' array with calculated score.
                // Requires importing a string similarity library.
                potentialMatches.forEach(match => {
                   // const similarity = calculateSimilarity(sourceText, match.sourceText); // Implement this
                   // if (similarity >= threshold) {
                   //     matches.push({ entry: match, score: similarity * 100 });
                   // }
                });
                logger.info(`[${this.serviceName}.${methodName}] Found ${matches.length} potential fuzzy matches.`);
            }
            */
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            // Don't rethrow, just return empty array or partial matches found so far
        }
        // Sort by score descending
        matches.sort((a, b) => b.score - a.score);
        return matches;
    }
    /**
     * Imports Translation Memory entries from a TMX file content string.
     */
    async importTMX(tmxContent, projectId, // Optional: Associate imported entries with a project
    userId // Optional: User performing the import
    ) {
        const methodName = 'importTMX';
        const result = {
            totalUnits: 0,
            addedCount: 0,
            updatedCount: 0,
            skippedCount: 0,
            errors: [],
        };
        try {
            logger_1.default.info(`[${this.serviceName}.${methodName}] Starting TMX import for project ${projectId || 'none'} by user ${userId || 'system'}`);
            const parsedTmx = this.xmlParser.parse(tmxContent);
            // Basic validation of TMX structure
            if (!parsedTmx.tmx || !parsedTmx.tmx.body || !parsedTmx.tmx.body.tu) {
                throw new errors_1.ValidationError('Invalid TMX structure: Missing tmx, body, or tu elements.');
            }
            const translationUnits = parsedTmx.tmx.body.tu;
            // Ensure translationUnits is always an array
            const unitsArray = Array.isArray(translationUnits) ? translationUnits : [translationUnits];
            result.totalUnits = unitsArray.length;
            logger_1.default.info(`[${this.serviceName}.${methodName}] Found ${result.totalUnits} translation units in TMX.`);
            // Use Promise.allSettled to process units concurrently but capture all results/errors
            const processingPromises = unitsArray.map(async (tu, index) => {
                if (!tu || !tu.tuv || !Array.isArray(tu.tuv) || tu.tuv.length < 2) {
                    logger_1.default.warn(`[${this.serviceName}.${methodName}] Skipping TU index ${index}: Invalid structure or missing TUV pairs.`);
                    return { status: 'skipped', reason: `Invalid TUV structure at index ${index}` };
                }
                // Assume first TUV is source, second is target (a common convention)
                // Robust parsing would check xml:lang attributes
                const sourceTuv = tu.tuv.find((t) => t['@_xml:lang']); // Find first TUV with lang
                const targetTuv = tu.tuv.find((t) => t['@_xml:lang'] && t !== sourceTuv); // Find second
                if (!sourceTuv || !targetTuv || !sourceTuv['@_xml:lang'] || !targetTuv['@_xml:lang'] || !sourceTuv.seg || !targetTuv.seg) {
                    logger_1.default.warn(`[${this.serviceName}.${methodName}] Skipping TU index ${index}: Missing lang attribute or seg element in TUVs.`);
                    return { status: 'skipped', reason: `Missing lang or seg at index ${index}` };
                }
                const sourceLang = sourceTuv['@_xml:lang'];
                const targetLang = targetTuv['@_xml:lang'];
                // Handle potentially nested seg elements or complex content if necessary
                const sourceText = (typeof sourceTuv.seg === 'string') ? sourceTuv.seg : (sourceTuv.seg['#text'] || '');
                const targetText = (typeof targetTuv.seg === 'string') ? targetTuv.seg : (targetTuv.seg['#text'] || '');
                if (!sourceText || !targetText) {
                    logger_1.default.warn(`[${this.serviceName}.${methodName}] Skipping TU index ${index}: Empty source or target text.`);
                    return { status: 'skipped', reason: `Empty source/target text at index ${index}` };
                }
                try {
                    const addResult = await this.addEntry({
                        sourceLanguage: sourceLang,
                        targetLanguage: targetLang,
                        sourceText: sourceText,
                        targetText: targetText,
                        projectId: projectId,
                        userId: userId,
                    });
                    return { status: addResult.status }; // 'added' or 'updated'
                }
                catch (addError) {
                    const errorMsg = `Error adding entry from TU index ${index}: ${addError.message}`;
                    logger_1.default.error(`[${this.serviceName}.${methodName}] ${errorMsg}`);
                    return { status: 'error', reason: errorMsg };
                }
            });
            // Wait for all units to be processed
            const outcomes = await Promise.allSettled(processingPromises);
            // Aggregate results
            outcomes.forEach((outcome) => {
                if (outcome.status === 'fulfilled') {
                    const value = outcome.value; // Type assertion for clarity
                    switch (value.status) {
                        case 'added':
                            result.addedCount++;
                            break;
                        case 'updated':
                            result.updatedCount++;
                            break;
                        case 'skipped':
                            result.skippedCount++;
                            if (value.reason)
                                result.errors.push(`Skipped: ${value.reason}`);
                            break;
                        case 'error':
                            result.skippedCount++; // Count errors as skipped for simplicity
                            if (value.reason)
                                result.errors.push(`Error: ${value.reason}`);
                            break;
                    }
                }
                else {
                    // Handle unexpected promise rejection (shouldn't happen with addEntry's catch)
                    const errorMsg = `Unexpected error processing TU: ${outcome.reason}`;
                    logger_1.default.error(`[${this.serviceName}.${methodName}] ${errorMsg}`);
                    result.skippedCount++;
                    result.errors.push(errorMsg);
                }
            });
            logger_1.default.info(`[${this.serviceName}.${methodName}] TMX import completed. Added: ${result.addedCount}, Updated: ${result.updatedCount}, Skipped/Errors: ${result.skippedCount}`);
            if (result.errors.length > 0) {
                logger_1.default.warn(`[${this.serviceName}.${methodName}] Import encountered ${result.errors.length} issues.`);
            }
            return result;
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            // Ensure errors during initial parsing are caught
            if (error instanceof errors_1.ValidationError) {
                result.errors.push(`Validation Error: ${error.message}`);
            }
            else {
                result.errors.push(`General Error: ${error instanceof Error ? error.message : String(error)}`);
            }
            // Return partial results if parsing failed mid-way or at the start
            return result;
            // Or rethrow depending on desired API behavior:
            // throw handleServiceError(error, this.serviceName, methodName, '导入TMX文件');
        }
    }
};
exports.TranslationMemoryService = TranslationMemoryService;
exports.TranslationMemoryService = TranslationMemoryService = __decorate([
    (0, typedi_1.Service)(),
    __metadata("design:paramtypes", [])
], TranslationMemoryService);
// Export singleton instance
exports.translationMemoryService = new TranslationMemoryService();
