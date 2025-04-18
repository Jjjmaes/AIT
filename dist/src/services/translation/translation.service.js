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
exports.TranslationService = void 0;
const typedi_1 = require("typedi");
// Import only the instance 
const aiServiceFactory_1 = require("./aiServiceFactory");
const logger_1 = __importDefault(require("../../utils/logger"));
const segment_model_1 = require("../../models/segment.model");
const errors_1 = require("../../utils/errors");
const tiktoken_1 = require("tiktoken");
// Assume aiConfigService exists and is importable
const aiConfig_service_1 = require("../aiConfig.service"); // Corrected path
// Constants for batching 
const DEFAULT_MAX_INPUT_TOKENS = 96000;
const DEFAULT_MODEL_FOR_TOKEN_COUNT = 'gpt-4';
let TranslationService = class TranslationService {
    constructor() {
        // Assign the imported instance
        this.aiServiceFactory = aiServiceFactory_1.aiServiceFactory;
    }
    // REMOVE OLD translateMultipleSegments and related methods
    /*
    async translateMultipleSegments(segments: string[], options: TranslationOptions): Promise<{
      // ... old implementation ...
    }> {
      // ... old implementation code from lines ~56 to ~209 ...
    }
  
    async validateApiKey(): Promise<boolean> {
      // ... old implementation ...
    }
  
    async getAvailableModels(): Promise<string[]> {
       // ... old implementation ...
    }
  
    private generateCacheKey(sourceText: string, options: TranslationOptions): string {
       // ... old implementation ...
    }
  
    async shutdown(): Promise<void> {
       // ... old implementation ...
    }
  
    public getPerformanceMetrics() {
       // ... old implementation ...
    }
  
    public getTaskMetrics() {
      // ... old implementation ...
    }
    */
    // --- Helper Functions --- (Keep these)
    getTokenCount(text, model = DEFAULT_MODEL_FOR_TOKEN_COUNT) {
        try {
            const encoder = (0, tiktoken_1.encoding_for_model)(model);
            const tokens = encoder.encode(text).length;
            encoder.free();
            return tokens;
        }
        catch (error) {
            logger_1.default.warn('Tiktoken calculation failed, falling back to estimation', { error, model });
            return Math.ceil(text.length / 4);
        }
    }
    buildSystemPrompt(sourceLang, targetLang) {
        return `
You are a professional translator. Translate the following text from ${sourceLang} to ${targetLang}.
Each segment is marked with [SEG#].

Important rules:
- Do not remove or reorder [SEG#] tags.
- Do not merge or split content.
- Output format must be: [SEG#]\\nTranslated text
- Only translate, no explanation.

Example:

[SEG1]
产品名称

[SEG2]
注册证编号

Expected Output:

[SEG1]
Product Name

[SEG2]
Registration Certificate Number
`.trim();
    }
    buildSegmentedPrompt(segments) {
        return segments.map(s => `[SEG${s.index}]\n${s.sourceText}`).join('\n\n');
    }
    parseTranslatedSegments(outputText) {
        const result = {};
        if (!outputText) {
            return result;
        }
        const regex = /\[SEG(\d+)\]\s*([\s\S]*?)(?=\n\[SEG|\n*$)/g;
        let match;
        while ((match = regex.exec(outputText)) !== null) {
            const index = parseInt(match[1], 10);
            const translation = match[2].trim();
            if (!isNaN(index) && translation) {
                result[index] = translation;
            }
        }
        return result;
    }
    splitSegmentsByTokenLimit(segments, systemPrompt, adapterConfig, maxInputTokens = DEFAULT_MAX_INPUT_TOKENS) {
        const systemTokens = this.getTokenCount(systemPrompt);
        const batches = [];
        let currentBatch = [];
        let currentTokens = systemTokens;
        for (const seg of segments) {
            if (seg.index === undefined || typeof seg.index !== 'number') {
                logger_1.default.warn(`Segment missing valid index, skipping batch inclusion: ${seg._id}`);
                continue;
            }
            const thisSegText = `[SEG${seg.index}]\n${seg.sourceText}`;
            const thisTokens = this.getTokenCount(thisSegText);
            if (currentBatch.length > 0 && currentTokens + thisTokens > maxInputTokens) {
                batches.push(currentBatch);
                currentBatch = [seg];
                currentTokens = systemTokens + thisTokens;
            }
            else if (currentTokens + thisTokens <= maxInputTokens) {
                currentBatch.push(seg);
                currentTokens += thisTokens;
            }
            else {
                logger_1.default.error(`Single segment token count (${thisTokens}) exceeds max input limit (${maxInputTokens}) after adding system prompt (${systemTokens}) for segment index ${seg.index}. Skipping this segment.`);
            }
        }
        if (currentBatch.length > 0) {
            batches.push(currentBatch);
        }
        logger_1.default.info(`Split ${segments.length} segments into ${batches.length} batches based on token limit ${maxInputTokens}.`);
        return batches;
    }
    // Batch translation method
    async translateMultipleSegments(fileId, options) {
        const startTime = Date.now();
        let totalUpdatedCount = 0;
        const failedSegmentIds = [];
        let segmentsToTranslate = [];
        try {
            logger_1.default.info(`Starting batch translation for fileId: ${fileId}`);
            // 1. Fetch Segments
            segmentsToTranslate = await segment_model_1.Segment.find({
                fileId: fileId,
                status: { $in: [segment_model_1.SegmentStatus.PENDING, segment_model_1.SegmentStatus.TRANSLATION_FAILED] }
            }).sort({ index: 1 }).lean();
            if (!segmentsToTranslate || segmentsToTranslate.length === 0) {
                logger_1.default.info(`No segments requiring translation found for fileId: ${fileId}`);
                return { success: true, message: "No segments to translate.", fileId: fileId, updatedCount: 0, failedSegments: [] };
            }
            logger_1.default.info(`Found ${segmentsToTranslate.length} segments to translate for fileId: ${fileId}`);
            // --- Step 3: Implement AI Config Loading --- 
            if (!options.aiConfigId) {
                throw new errors_1.AppError('AI Configuration ID is required for translation.', 400);
            }
            // Fetch the actual AI config from the service
            // Ensure getConfigById exists and handles ObjectId/string conversion if needed
            const aiConfig = await aiConfig_service_1.aiConfigService.getConfigById(options.aiConfigId.toString()); // Corrected type
            if (!aiConfig) {
                throw new errors_1.AppError(`AI Configuration not found for ID: ${options.aiConfigId}`, 404);
            }
            // Validate required fields from the fetched config
            if (!aiConfig.apiKey) {
                throw new errors_1.AppError(`API key is missing in AI Configuration ID: ${options.aiConfigId}`, 500);
            }
            if (!aiConfig.providerName) {
                throw new errors_1.AppError(`Provider name is missing in AI Configuration ID: ${options.aiConfigId}`, 500);
            }
            const provider = aiConfig.providerName; // Cast to enum
            // -------------------------------------------
            // 2. Get AI Adapter (using fetched config)
            // Prepare the config object for the adapter factory
            const serviceConfig = {
                provider: provider,
                apiKey: aiConfig.apiKey,
                // Use model from options first, fallback to fetched config, then potential default
                model: options.aiModel || aiConfig.defaultModel || process.env.DEFAULT_TRANSLATION_MODEL, // Use defaultModel
                temperature: options.temperature ?? aiConfig.defaultParams?.temperature ?? 0.3, // Use defaultParams
                maxTokens: aiConfig.defaultParams?.maxTokens || 4000, // Use defaultParams, maxTokens likely in params
                // Add other potential config fields needed by factory/adapter (e.g., baseURL, defaultModel)
                defaultModel: aiConfig.defaultModel, // Pass the primary model from config
                baseURL: aiConfig.baseURL
            };
            // Use assigned factory instance and call the correct adapter method
            const adapter = this.aiServiceFactory.getTranslationAdapter(serviceConfig.provider, serviceConfig);
            if (!adapter) {
                throw new errors_1.AppError(`Could not get AI adapter for provider: ${serviceConfig.provider}`, 500);
            }
            // 3. Build System Prompt
            // TODO: Fetch and use PromptTemplate based on options.promptTemplateId
            const systemPrompt = this.buildSystemPrompt(options.sourceLanguage, options.targetLanguage);
            // 4. Split into Batches (using fetched config for token calculation if needed by adapter)
            const batches = this.splitSegmentsByTokenLimit(segmentsToTranslate, systemPrompt, serviceConfig);
            // 5. Process Batches
            const batchPromises = batches.map(async (batch, batchIndex) => {
                const batchStartTime = Date.now();
                logger_1.default.info(`Processing batch ${batchIndex + 1}/${batches.length} for fileId: ${fileId} with ${batch.length} segments.`);
                let batchSuccess = true;
                try {
                    const userPrompt = this.buildSegmentedPrompt(batch);
                    const messages = [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ];
                    // Use the fetched and prepared serviceConfig here
                    const completionOptions = {
                        model: serviceConfig.model,
                        temperature: serviceConfig.temperature,
                        max_tokens: serviceConfig.maxTokens
                    };
                    const response = await adapter.executeChatCompletion(messages, completionOptions);
                    if (response.error || !response.content) {
                        throw new errors_1.AppError(response.error || 'AI service returned empty content.', 500);
                    }
                    const translatedMap = this.parseTranslatedSegments(response.content);
                    logger_1.default.debug(`Batch ${batchIndex + 1}: Parsed ${Object.keys(translatedMap).length} translations from AI response.`);
                    const updatePromises = batch.map(async (seg) => {
                        const translation = translatedMap[seg.index];
                        if (translation) {
                            try {
                                await segment_model_1.Segment.updateOne({ _id: seg._id }, {
                                    $set: {
                                        translation: translation,
                                        translatedLength: translation.length,
                                        status: segment_model_1.SegmentStatus.TRANSLATED,
                                        translationMeta: {
                                            provider: serviceConfig.provider,
                                            model: response.model,
                                            promptTokens: response.usage?.prompt_tokens,
                                            completionTokens: response.usage?.completion_tokens,
                                            timestamp: new Date()
                                        },
                                        updatedAt: new Date()
                                    }
                                });
                            }
                            catch (dbError) {
                                logger_1.default.error(`Failed to update segment _id=${seg._id}, index=${seg.index} in DB:`, dbError);
                                await segment_model_1.Segment.updateOne({ _id: seg._id }, { $set: { status: segment_model_1.SegmentStatus.TRANSLATION_FAILED, error: 'DB update failed after translation' } });
                                batchSuccess = false;
                                failedSegmentIds.push(seg._id);
                            }
                        }
                        else {
                            logger_1.default.warn(`Translation missing for segment index ${seg.index} in batch ${batchIndex + 1}, fileId ${fileId}.`);
                            await segment_model_1.Segment.updateOne({ _id: seg._id }, { $set: { status: segment_model_1.SegmentStatus.TRANSLATION_FAILED, error: 'Missing in AI response' } });
                            batchSuccess = false;
                            failedSegmentIds.push(seg._id);
                        }
                    });
                    await Promise.allSettled(updatePromises);
                    logger_1.default.info(`Batch ${batchIndex + 1} processed in ${Date.now() - batchStartTime}ms. Success: ${batchSuccess}`);
                    return batchSuccess;
                }
                catch (batchError) {
                    logger_1.default.error(`Error processing batch ${batchIndex + 1} for fileId ${fileId}:`, batchError);
                    const batchSegmentIds = batch.map(s => s._id);
                    failedSegmentIds.push(...batchSegmentIds);
                    await segment_model_1.Segment.updateMany({ _id: { $in: batchSegmentIds } }, { $set: { status: segment_model_1.SegmentStatus.TRANSLATION_FAILED, error: batchError.message || 'Batch processing failed' } });
                    return false;
                }
            });
            await Promise.allSettled(batchPromises);
            totalUpdatedCount = await segment_model_1.Segment.countDocuments({
                fileId: fileId,
                _id: { $in: segmentsToTranslate.map(s => s._id) },
                status: segment_model_1.SegmentStatus.TRANSLATED
            });
            const duration = Date.now() - startTime;
            logger_1.default.info(`Batch translation finished for fileId: ${fileId} in ${duration}ms. Updated count: ${totalUpdatedCount}, Failed segments: ${failedSegmentIds.length}`);
            const overallSuccess = failedSegmentIds.length === 0;
            // Use optional chaining for performanceMonitor
            // await this.performanceMonitor?.recordRequest(overallSuccess, duration); 
            return {
                success: overallSuccess,
                message: `Translation process completed. ${totalUpdatedCount} segments updated. ${failedSegmentIds.length} segments failed.`,
                fileId: fileId,
                updatedCount: totalUpdatedCount,
                failedSegments: [...new Set(failedSegmentIds)]
            };
        }
        catch (error) {
            logger_1.default.error(`Fatal error during batch translation for fileId ${fileId}:`, error);
            // Use optional chaining for performanceMonitor
            // await this.performanceMonitor?.recordRequest(false, Date.now() - startTime); 
            const finalFailedIds = Array.isArray(segmentsToTranslate) ? segmentsToTranslate.map(s => s._id) : [];
            return {
                success: false,
                message: `Translation failed: ${error.message}`,
                fileId: fileId,
                updatedCount: totalUpdatedCount,
                failedSegments: finalFailedIds
            };
        }
    }
};
exports.TranslationService = TranslationService;
exports.TranslationService = TranslationService = __decorate([
    (0, typedi_1.Service)(),
    __metadata("design:paramtypes", [])
], TranslationService);
