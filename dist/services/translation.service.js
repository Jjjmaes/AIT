"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.translationService = exports.TranslationService = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
const file_model_1 = require("../models/file.model");
const segment_model_1 = require("../models/segment.model");
const project_service_1 = require("./project.service");
const errorHandler_1 = require("../utils/errorHandler");
const errors_1 = require("../utils/errors");
const mongoose_1 = require("mongoose");
const aiServiceFactory_1 = require("./translation/aiServiceFactory");
const promptProcessor_1 = require("../utils/promptProcessor");
const translationQueue_service_1 = require("./translationQueue.service");
const segment_service_1 = require("./segment.service");
const ai_service_factory_1 = require("./translation/ai-adapters/ai-service.factory");
const ai_service_types_1 = require("../types/ai-service.types");
const config_1 = require("../config");
const terminology_service_1 = require("./terminology.service");
const translationMemory_service_1 = require("./translationMemory.service");
class TranslationService {
    constructor() {
        this.serviceName = 'TranslationService';
        this.aiServiceFactory = ai_service_factory_1.AIServiceFactory.getInstance();
        this.terminologyService = terminology_service_1.terminologyService;
        this.projectService = project_service_1.projectService;
        this.translationMemoryService = translationMemory_service_1.translationMemoryService;
    }
    async translateSegment(segmentId, userId, requesterRoles = [], options) {
        const methodName = 'translateSegment';
        (0, errorHandler_1.validateId)(segmentId, '段落');
        (0, errorHandler_1.validateId)(userId, '用户');
        try {
            const segment = await segment_service_1.segmentService.getSegmentById(segmentId);
            (0, errorHandler_1.validateEntityExists)(segment, '段落');
            if (segment.status !== segment_model_1.SegmentStatus.PENDING && segment.status !== segment_model_1.SegmentStatus.ERROR) {
                logger_1.default.warn(`Segment ${segmentId} already processed or in progress (status: ${segment.status}). Skipping translation.`);
                return segment;
            }
            const file = await file_model_1.File.findById(segment.fileId).exec();
            (0, errorHandler_1.validateEntityExists)(file, '关联文件');
            const project = await this.projectService.getProjectById(file.projectId.toString(), userId, requesterRoles);
            (0, errorHandler_1.validateEntityExists)(project, '关联项目');
            // Use nullish coalescing for metadata
            const fileMetadata = file.metadata ?? {};
            const sourceLang = options?.sourceLanguage || fileMetadata.sourceLanguage;
            const targetLang = options?.targetLanguage || fileMetadata.targetLanguage;
            if (!sourceLang || !targetLang) {
                throw new errors_1.ValidationError('Source or target language missing for translation.');
            }
            // --- Check Translation Memory --- 
            const tmMatches = await this.translationMemoryService.findMatches(segment.sourceText, sourceLang, targetLang, project._id.toString());
            const exactMatch = tmMatches.find(match => match.score === 100); // Check for 100% score
            if (exactMatch) {
                logger_1.default.info(`[${methodName}] Found 100% TM match for segment ${segmentId}.`);
                const tmUpdateData = {
                    translation: exactMatch.entry.targetText,
                    status: segment_model_1.SegmentStatus.TRANSLATED_TM, // New status
                    translatedLength: exactMatch.entry.targetText.length,
                    translationMetadata: {
                        // Indicate source was TM
                        aiModel: 'TM_100%',
                        // Optionally store TM entry ID?
                        // promptTemplateId: exactMatch.entry._id, 
                        tokenCount: 0, // No AI tokens used
                        processingTime: 0 // Minimal processing time
                    },
                    translationCompletedAt: new Date(),
                    error: undefined
                };
                const updatedSegment = await segment_service_1.segmentService.updateSegment(segmentId, tmUpdateData);
                // Update project file progress
                project_service_1.projectService.updateFileProgress(file._id.toString(), userId).catch(err => {
                    logger_1.default.error(`Failed to update file progress for ${file._id} after TM match on segment ${segmentId}:`, err);
                });
                logger_1.default.info(`Segment ${segmentId} translated successfully using TM.`);
                return updatedSegment;
            }
            // --- End TM Check --- 
            // --- If no 100% TM match, proceed with AI Translation ---
            logger_1.default.debug(`[${methodName}] No 100% TM match found for segment ${segmentId}. Proceeding with AI.`);
            await segment_service_1.segmentService.updateSegment(segmentId, { status: segment_model_1.SegmentStatus.TRANSLATING });
            // --- Fetch Terminology --- 
            let terms = [];
            try {
                if (project.terminology) {
                    const terminologyList = await this.terminologyService.getTerminologyById(project.terminology.toString());
                    if (terminologyList?.terms) {
                        terms = terminologyList.terms;
                        logger_1.default.info(`[${methodName}] Fetched ${terms.length} terms for project ${project._id}.`);
                    }
                }
            }
            catch (error) {
                logger_1.default.error(`[${methodName}] Failed to fetch terminology for project ${project._id}. Proceeding without terms.`, { error });
            }
            // ---------------------------
            let effectivePromptTemplateId;
            const projectTemplate = options?.promptTemplateId || project.translationPromptTemplate;
            if (projectTemplate) {
                if (typeof projectTemplate === 'string') {
                    effectivePromptTemplateId = projectTemplate;
                }
                else if (projectTemplate instanceof mongoose_1.Types.ObjectId) {
                    effectivePromptTemplateId = projectTemplate;
                }
                else if (typeof projectTemplate === 'object' && projectTemplate._id) {
                    effectivePromptTemplateId = projectTemplate._id;
                }
            }
            const promptContext = {
                promptTemplateId: effectivePromptTemplateId,
                sourceLanguage: sourceLang,
                targetLanguage: targetLang,
                domain: options?.domain || project.domain,
                terms: terms
            };
            const promptData = await promptProcessor_1.promptProcessor.buildTranslationPrompt(segment.sourceText, promptContext);
            const aiAdapter = aiServiceFactory_1.aiServiceFactory.getTranslationAdapter(options?.aiProvider);
            let promptTemplateObjectId = undefined;
            const idToConvert = promptContext.promptTemplateId;
            if (idToConvert && mongoose_1.Types.ObjectId.isValid(idToConvert)) {
                promptTemplateObjectId = new mongoose_1.Types.ObjectId(idToConvert);
            }
            else if (idToConvert) {
                logger_1.default.warn(`Invalid promptTemplateId format: ${idToConvert}. Cannot convert to ObjectId.`);
            }
            const startTime = Date.now();
            const response = await aiAdapter.translateText(segment.sourceText, promptData, options);
            const processingTime = Date.now() - startTime;
            const updateData = {
                translation: response.translatedText,
                status: segment_model_1.SegmentStatus.TRANSLATED,
                translatedLength: response.translatedText.length,
                translationMetadata: {
                    aiModel: response.modelInfo.model,
                    promptTemplateId: promptTemplateObjectId,
                    tokenCount: response.tokenCount?.total,
                    processingTime: processingTime
                },
                translationCompletedAt: new Date(),
                error: undefined
            };
            const updatedSegment = await segment_service_1.segmentService.updateSegment(segmentId, updateData);
            (0, errorHandler_1.validateEntityExists)(updatedSegment, '更新后的段落');
            project_service_1.projectService.updateFileProgress(file._id.toString(), userId).catch(err => {
                logger_1.default.error(`Failed to update file progress for ${file._id} after segment ${segmentId} translation:`, err);
            });
            logger_1.default.info(`Segment ${segmentId} translated successfully using AI.`);
            return updatedSegment;
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName} for segment ${segmentId}:`, error);
            try {
                await segment_service_1.segmentService.updateSegment(segmentId, { status: segment_model_1.SegmentStatus.ERROR, error: (error instanceof Error ? error.message : '未知翻译错误') });
            }
            catch (updateError) {
                logger_1.default.error(`Failed to mark segment ${segmentId} as ERROR after translation failure:`, updateError);
            }
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '段落翻译');
        }
    }
    async translateFile(projectId, fileId, userId, requesterRoles = [], options) {
        const methodName = 'translateFile';
        (0, errorHandler_1.validateId)(projectId, '项目');
        (0, errorHandler_1.validateId)(fileId, '文件');
        (0, errorHandler_1.validateId)(userId, '用户');
        try {
            const project = await project_service_1.projectService.getProjectById(projectId, userId, requesterRoles);
            const file = await file_model_1.File.findOne({ _id: new mongoose_1.Types.ObjectId(fileId), projectId: project._id }).exec();
            (0, errorHandler_1.validateEntityExists)(file, '文件');
            // Check for required metadata *immediately* after getting the file
            const targetLanguage = options?.targetLanguage || file.metadata?.targetLanguage;
            const sourceLanguage = file.metadata?.sourceLanguage;
            if (!targetLanguage || !sourceLanguage) {
                const missing = !targetLanguage && !sourceLanguage ? 'Source and target language' : !targetLanguage ? 'Target language' : 'Source language';
                logger_1.default.error(`[${this.serviceName}.${methodName}] ${missing} not found for file ${fileId}. Cannot translate.`);
                throw new errors_1.AppError(`${missing} is required for translation.`, 400);
            }
            // Check if file status allows translation (e.g., EXTRACTED)
            if (file.status !== file_model_1.FileStatus.EXTRACTED) {
                logger_1.default.warn(`[${this.serviceName}.${methodName}] File ${fileId} is not in EXTRACTED status (current: ${file.status}). Skipping translation.`);
                throw new errors_1.ValidationError(`File ${fileId} is not in EXTRACTED status.`);
            }
            // Find segments that need translation
            const segmentsToTranslate = await segment_model_1.Segment.find({
                fileId: file._id,
                status: segment_model_1.SegmentStatus.PENDING // Only translate pending segments
            }).exec();
            if (segmentsToTranslate.length === 0) {
                logger_1.default.info(`[${this.serviceName}.${methodName}] No pending segments found for file ${fileId}.`);
                throw new errors_1.ValidationError(`No pending segments found for file ${fileId}.`);
            }
            logger_1.default.info(`[${this.serviceName}.${methodName}] Found ${segmentsToTranslate.length} segments to translate for file ${fileId}.`);
            // --- Fetch terminology for the file before the loop --- 
            let termsForFile = [];
            try {
                if (project.terminology) {
                    const terminologyList = await this.terminologyService.getTerminologyById(project.terminology.toString());
                    if (terminologyList?.terms) {
                        termsForFile = terminologyList.terms;
                        logger_1.default.info(`[${this.serviceName}.${methodName}] Fetched ${termsForFile.length} terms for file ${fileId}.`);
                    }
                }
            }
            catch (error) {
                logger_1.default.error(`[${this.serviceName}.${methodName}] Error fetching terminology for file ${fileId}. Proceeding without terms.`, { error });
            }
            // --------------------------------------------------------
            // Update file status to TRANSLATING
            if (file.status === file_model_1.FileStatus.EXTRACTED) {
                file.status = file_model_1.FileStatus.TRANSLATING;
                await file.save();
                logger_1.default.info(`[${this.serviceName}.${methodName}] Set file ${fileId} status to TRANSLATING.`);
            }
            let translatedCount = 0;
            let failedCount = 0;
            for (const segment of segmentsToTranslate) {
                try {
                    logger_1.default.debug(`Translating segment ${segment._id}...`);
                    // 1. Build Prompt context and call builder
                    const promptContext = {
                        sourceLanguage: sourceLanguage,
                        targetLanguage: targetLanguage,
                        // Include project/options details if needed by prompt builder 
                        domain: options?.domain || project.domain,
                        promptTemplateId: options?.promptTemplateId, // Pass template ID if available
                        terms: termsForFile // Pass the fetched terms
                    };
                    const promptData = buildTranslationPrompt(segment.sourceText, promptContext);
                    // Prepare full options for the adapter call
                    const adapterOptions = {
                        ...options, // Include original options
                        sourceLanguage: sourceLanguage, // Ensure languages are passed
                        targetLanguage: targetLanguage,
                        aiProvider: ai_service_types_1.AIProvider.OPENAI, // Pass provider info
                        aiModel: options?.aiModel, // Pass model if specified
                        temperature: options?.temperature // Pass temperature if specified
                    };
                    // Call AI Adapter using this.aiServiceFactory and the correct config
                    const provider = ai_service_types_1.AIProvider.OPENAI; // Assuming OpenAI for now
                    const aiConfig = {
                        provider,
                        apiKey: config_1.config.openai.apiKey,
                        defaultModel: options?.aiModel || config_1.config.openai.defaultModel
                    };
                    const adapter = this.aiServiceFactory.createAdapter(aiConfig);
                    const translationResponse = await adapter.translateText(segment.sourceText, promptData, adapterOptions);
                    // 3. Update Segment
                    segment.translation = translationResponse.translatedText;
                    segment.status = segment_model_1.SegmentStatus.TRANSLATED;
                    segment.error = undefined;
                    // TODO: Store translation metadata
                    await segment.save();
                    translatedCount++;
                    logger_1.default.debug(`Segment ${segment._id} translated successfully.`);
                }
                catch (error) {
                    failedCount++;
                    logger_1.default.error(`Failed to translate segment ${segment._id}:`, error);
                    segment.status = segment_model_1.SegmentStatus.TRANSLATION_FAILED;
                    segment.error = error instanceof Error ? error.message : 'Unknown translation error';
                    await segment.save();
                }
            }
            // --- Update File status and counts ---
            try {
                file.translatedCount = await segment_model_1.Segment.countDocuments({ fileId: file._id, status: segment_model_1.SegmentStatus.TRANSLATED });
                // Potentially count failed? Might need another field.
                if (failedCount > 0) {
                    file.status = file_model_1.FileStatus.ERROR; // Or a new PARTIAL_TRANSLATION_FAILED status?
                    file.errorDetails = `${failedCount} segment(s) failed to translate.`;
                }
                else if (file.translatedCount === file.segmentCount) {
                    file.status = file_model_1.FileStatus.TRANSLATED;
                    file.errorDetails = undefined;
                }
                else {
                    // This case might indicate partial success, keep as TRANSLATING or introduce PARTIAL?
                    file.status = file_model_1.FileStatus.TRANSLATING; // Or PARTIALLY_TRANSLATED
                    logger_1.default.warn(`[${this.serviceName}.${methodName}] File ${fileId} translation partially complete. ${file.translatedCount}/${file.segmentCount} segments translated.`);
                }
                await file.save();
                logger_1.default.info(`[${this.serviceName}.${methodName}] Finished translation attempt for file ID: ${fileId}. Final status: ${file.status}`);
            }
            catch (fileUpdateError) {
                logger_1.default.error(`[${this.serviceName}.${methodName}] Failed to update file status after translation for file ID: ${fileId}:`, fileUpdateError);
            }
            return await translationQueue_service_1.translationQueueService.addFileTranslationJob(projectId, fileId, options, userId, requesterRoles);
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '文件翻译任务');
        }
    }
    async translateProject(projectId, userId, requesterRoles = [], options) {
        const methodName = 'translateProject';
        (0, errorHandler_1.validateId)(projectId, '项目');
        (0, errorHandler_1.validateId)(userId, '用户');
        try {
            const project = await project_service_1.projectService.getProjectById(projectId, userId, requesterRoles);
            const files = await file_model_1.File.find({ projectId: project._id }).exec();
            if (!files || files.length === 0) {
                throw new errors_1.ValidationError('项目没有要翻译的文件');
            }
            return await translationQueue_service_1.translationQueueService.addProjectTranslationJob(projectId, options, userId, requesterRoles);
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '项目翻译任务');
        }
    }
    async getTranslationStatus(jobId) {
        const methodName = 'getTranslationStatus';
        try {
            return await translationQueue_service_1.translationQueueService.getJobStatus(jobId);
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '获取翻译状态');
        }
    }
    async cancelTranslation(jobId) {
        const methodName = 'cancelTranslation';
        try {
            await translationQueue_service_1.translationQueueService.cancelJob(jobId);
            logger_1.default.info(`Translation job ${jobId} cancelled.`);
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '取消翻译任务');
        }
    }
    /**
     * Translates all pending segments for a given file.
     * @param fileId - The ID of the file to translate segments for.
     * @param options - Translation options.
     */
    async translateFileSegments(fileId, options) {
        const methodName = 'translateFileSegments';
        (0, errorHandler_1.validateId)(fileId, '文件');
        logger_1.default.info(`[${this.serviceName}.${methodName}] Starting translation logic (now likely handled by worker calling translateSegment) for file ID: ${fileId}`);
        const file = await file_model_1.File.findById(fileId).exec();
        (0, errorHandler_1.validateEntityExists)(file, '文件');
        // The loop calling buildTranslationPrompt and adapter.translateText is removed 
        // because the worker calls translateSegment individually.
        // The status update logic at the end might still be relevant if called separately.
        // --- Update File status and counts (Keep this logic if method is still used for status updates) ---
        try {
            const translatedCount = await segment_model_1.Segment.countDocuments({ fileId: file._id, status: segment_model_1.SegmentStatus.TRANSLATED });
            const failedCount = await segment_model_1.Segment.countDocuments({ fileId: file._id, status: { $in: [segment_model_1.SegmentStatus.ERROR, segment_model_1.SegmentStatus.TRANSLATION_FAILED] } });
            // Check if total processed matches segment count
            const totalProcessed = translatedCount + failedCount;
            const expectedSegments = file.segmentCount || await segment_model_1.Segment.countDocuments({ fileId: file._id }); // Fallback if segmentCount is not set
            if (totalProcessed >= expectedSegments) { // Use >= in case counts are off slightly
                if (failedCount > 0) {
                    file.status = file_model_1.FileStatus.ERROR;
                    file.errorDetails = `${failedCount} segment(s) failed to translate during batch processing.`;
                }
                else {
                    file.status = file_model_1.FileStatus.TRANSLATED;
                    file.errorDetails = undefined;
                }
            }
            else {
                // If called before all segments are done, maybe keep TRANSLATING?
                // Or introduce PARTIALLY_TRANSLATED?
                // Let's assume it remains TRANSLATING until completion is detected.
                // file.status = FileStatus.TRANSLATING; 
                logger_1.default.warn(`[${this.serviceName}.${methodName}] File ${fileId} status update check: ${totalProcessed}/${expectedSegments} segments processed.`);
            }
            await file.save();
            logger_1.default.info(`[${this.serviceName}.${methodName}] Updated file status after check for file ID: ${fileId}. Final status: ${file.status}`);
        }
        catch (fileUpdateError) {
            logger_1.default.error(`[${this.serviceName}.${methodName}] Failed to update file status after translation check for file ID: ${fileId}:`, fileUpdateError);
        }
    }
}
exports.TranslationService = TranslationService;
exports.translationService = new TranslationService();
// Update buildTranslationPrompt to accept context and use terms
const buildTranslationPrompt = (sourceText, context) => {
    // Base instruction - incorporate language/domain from context if available
    const sourceLang = context.sourceLanguage || '[Source Language]';
    const targetLang = context.targetLanguage || '[Target Language]';
    const domainInfo = context.domain ? ` Domain: ${context.domain}.` : '';
    let systemInstruction = `Translate the following text from ${sourceLang} to ${targetLang}.${domainInfo} Respond only with the translation.`;
    // Add terminology instruction if terms are provided in context
    if (context.terms && context.terms.length > 0) {
        const formattedTerms = context.terms.map(term => `[${term.source} -> ${term.target}]`).join(', ');
        const terminologyInstruction = `\n\nStrictly adhere to the following terminology: ${formattedTerms}.`;
        systemInstruction += terminologyInstruction;
    }
    // TODO: Add prompt template lookup/rendering using context.promptTemplateId
    // For now, just using the built system instruction and source text
    // This should eventually use promptProcessor.buildTranslationPrompt
    return {
        systemInstruction: systemInstruction,
        userPrompt: sourceText, // Placeholder - should use rendered template user prompt
    };
};
