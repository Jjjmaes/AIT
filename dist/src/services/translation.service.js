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
const ai_service_factory_1 = require("./translation/ai-adapters/ai-service.factory");
const translationQueue_service_1 = require("./translationQueue.service");
const segment_service_1 = require("./segment.service");
const aiConfig_service_1 = require("./aiConfig.service");
const terminology_service_1 = require("./terminology.service");
const translationMemory_service_1 = require("./translationMemory.service");
const ai_provider_manager_1 = require("../services/ai-provider.manager");
const promptProcessor_1 = require("../utils/promptProcessor");
class TranslationService {
    constructor(segmentSvc, projectSvc, translationMemorySvc, terminologySvc, aiConfigSvc, aiSvcFactory, promptProc) {
        this.segmentSvc = segmentSvc;
        this.projectSvc = projectSvc;
        this.translationMemorySvc = translationMemorySvc;
        this.terminologySvc = terminologySvc;
        this.aiConfigSvc = aiConfigSvc;
        this.aiSvcFactory = aiSvcFactory;
        this.promptProc = promptProc;
        this.serviceName = 'TranslationService';
    }
    async translateSegment(segmentId, userId, requesterRoles = [], aiConfigId, promptTemplateId, options) {
        const methodName = 'translateSegment';
        (0, errorHandler_1.validateId)(segmentId, '段落');
        (0, errorHandler_1.validateId)(userId, '用户');
        (0, errorHandler_1.validateId)(aiConfigId, 'AI 配置');
        // No need to validate promptTemplateId as string, can be ObjectId
        // validateId(promptTemplateId.toString(), '提示词模板');
        try {
            const segment = await segment_service_1.segmentService.getSegmentById(segmentId);
            (0, errorHandler_1.validateEntityExists)(segment, '段落');
            if (segment.status !== segment_model_1.SegmentStatus.PENDING && segment.status !== segment_model_1.SegmentStatus.ERROR) {
                logger_1.default.warn(`Segment ${segmentId} already processed or in progress (status: ${segment.status}). Skipping translation.`);
                return segment;
            }
            const file = await file_model_1.File.findById(segment.fileId).exec();
            (0, errorHandler_1.validateEntityExists)(file, '关联文件');
            const project = await this.projectSvc.getProjectById(file.projectId.toString(), userId, requesterRoles);
            (0, errorHandler_1.validateEntityExists)(project, '关联项目');
            // Use nullish coalescing for metadata
            const fileMetadata = file.metadata ?? {};
            const sourceLang = options?.sourceLanguage || fileMetadata.sourceLanguage;
            const targetLang = options?.targetLanguage || fileMetadata.targetLanguage;
            if (!sourceLang || !targetLang) {
                throw new errors_1.ValidationError('Source or target language missing for translation.');
            }
            // --- Check Translation Memory --- 
            const tmMatches = await this.translationMemorySvc.findMatches(segment.sourceText, sourceLang, targetLang, project._id.toString());
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
                    const terminologyList = await this.terminologySvc.getTerminologyById(project.terminology.toString());
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
            const aiConfig = await aiConfig_service_1.aiConfigService.getConfigById(aiConfigId);
            if (!aiConfig) {
                throw new errors_1.AppError(`AI 配置 ${aiConfigId} 未找到`, 404);
            }
            if (!aiConfig.providerName || !aiConfig.models || aiConfig.models.length === 0) {
                throw new errors_1.AppError(`AI 配置 ${aiConfigId} 缺少提供商或模型信息`, 404);
            }
            const promptContext = {
                promptTemplateId: promptTemplateId,
                sourceLanguage: sourceLang, // Assert non-null after check
                targetLanguage: targetLang, // Assert non-null after check
                domain: options?.domain || project.domain,
                terms: terms, // Pass the fetched terms
                // Include other context variables if needed by templates
            };
            const promptData = await this.promptProc.buildTranslationPrompt(segment.sourceText, promptContext);
            // Determine the model to use (from options, or AIConfig default)
            const modelToUse = options?.aiModel || aiConfig.models[0]; // Use first model as default for now
            // Convert providerName string to AIProvider enum
            const providerEnumKey = aiConfig.providerName.toUpperCase();
            const providerEnumValue = ai_provider_manager_1.AIProvider[providerEnumKey];
            if (!providerEnumValue) {
                throw new errors_1.AppError(`Unsupported AI provider name: ${aiConfig.providerName}`, 400);
            }
            // Get the adapter using the AIProvider enum value
            // Pass only the provider enum, assuming factory handles config loading
            const adapter = this.aiSvcFactory.getAdapter(providerEnumValue);
            // Validate adapter existence
            if (!adapter) {
                throw new errors_1.AppError(`Could not get AI adapter for provider: ${aiConfig.providerName}`, 500);
            }
            // Prepare options specifically for the adapter call, including overrides
            const adapterOptions = {
                ...options, // Spread original options first
                sourceLanguage: sourceLang, // Ensure languages are set
                targetLanguage: targetLang,
                // Pass specific overrides
                aiModel: modelToUse,
                temperature: options?.temperature,
                // Include other relevant fields from TranslationOptions if needed by adapter
                aiProvider: aiConfig.providerName, // Keep original string for metadata?
                promptTemplateId: promptTemplateId?.toString(),
                domain: promptContext.domain
            };
            let promptTemplateObjectId = undefined;
            if (promptTemplateId instanceof mongoose_1.Types.ObjectId) {
                promptTemplateObjectId = promptTemplateId;
            }
            else if (mongoose_1.Types.ObjectId.isValid(promptTemplateId)) {
                promptTemplateObjectId = new mongoose_1.Types.ObjectId(promptTemplateId);
            }
            else {
                logger_1.default.warn(`Invalid promptTemplateId format: ${promptTemplateId}. Cannot convert to ObjectId.`);
            }
            const startTime = Date.now();
            // Call translateText with sourceText, promptData, and adapterOptions
            const response = await adapter.translateText(segment.sourceText, promptData, adapterOptions // Pass the combined options
            );
            const processingTime = Date.now() - startTime;
            const updateData = {
                translation: response.translatedText,
                status: segment_model_1.SegmentStatus.TRANSLATED,
                translatedLength: response.translatedText?.length ?? 0, // Handle potential null/undefined
                translationMetadata: {
                    aiModel: response.modelInfo.model, // Store the actual model used
                    promptTemplateId: promptTemplateObjectId, // Store the ObjectId if valid
                    tokenCount: response.tokenCount?.total,
                    processingTime: processingTime,
                    // Removed aiConfigId, maybe store providerName or model used from response?
                    // aiProvider: response.modelInfo.provider (example)
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
    async translateFile(projectId, fileId, userId, requesterRoles = [], aiConfigId, promptTemplateId, options) {
        const methodName = 'translateFile';
        (0, errorHandler_1.validateId)(projectId, '项目');
        (0, errorHandler_1.validateId)(fileId, '文件');
        (0, errorHandler_1.validateId)(userId, '用户');
        (0, errorHandler_1.validateId)(aiConfigId, 'AI 配置');
        // validateId(promptTemplateId.toString(), '提示词模板');
        try {
            const project = await project_service_1.projectService.getProjectById(projectId, userId, requesterRoles);
            const file = await file_model_1.File.findOne({ _id: new mongoose_1.Types.ObjectId(fileId), projectId: project._id }).exec();
            (0, errorHandler_1.validateEntityExists)(file, '文件');
            // Check for required metadata *immediately* after getting the file
            const targetLanguage = options?.targetLanguage || file.metadata?.targetLanguage;
            const sourceLanguage = options?.sourceLanguage || file.metadata?.sourceLanguage; // Allow source from options too
            if (!targetLanguage || !sourceLanguage) {
                const missing = !targetLanguage && !sourceLanguage ? 'Source and target language' : !targetLanguage ? 'Target language' : 'Source language';
                logger_1.default.error(`[${this.serviceName}.${methodName}] ${missing} not found for file ${fileId}. Cannot translate.`);
                throw new errors_1.AppError(`${missing} is required for translation.`, 400);
            }
            // Check if file status allows translation (e.g., EXTRACTED)
            // Allow retrying from ERROR status as well?
            if (file.status !== file_model_1.FileStatus.EXTRACTED && file.status !== file_model_1.FileStatus.ERROR) {
                logger_1.default.warn(`[${this.serviceName}.${methodName}] File ${fileId} is not in EXTRACTED or ERROR status (current: ${file.status}). Skipping translation request.`);
                // Changed to warning and return, maybe not an error to try translating completed file?
                // throw new ValidationError(`File ${fileId} is not in EXTRACTED status.`); 
                return;
            }
            // Check if there are actually segments to translate
            // Find segments that need translation (PENDING or ERROR state)
            const segmentsToTranslateCount = await segment_model_1.Segment.countDocuments({
                fileId: file._id,
                status: { $in: [segment_model_1.SegmentStatus.PENDING, segment_model_1.SegmentStatus.ERROR, segment_model_1.SegmentStatus.TRANSLATION_FAILED] } // Include error states for retry
            }).exec();
            if (segmentsToTranslateCount === 0) {
                logger_1.default.info(`[${this.serviceName}.${methodName}] No pending or failed segments found for file ${fileId}. Nothing to translate.`);
                // Not necessarily an error, could be already completed or empty
                // throw new ValidationError(`No pending segments found for file ${fileId}.`); 
                return;
            }
            logger_1.default.info(`[${this.serviceName}.${methodName}] Found ${segmentsToTranslateCount} segments needing translation for file ${fileId}.`);
            // --- Update File status --- 
            // Simply mark the file for translation; workers/other processes handle segments.
            file.status = file_model_1.FileStatus.TRANSLATING;
            file.errorDetails = undefined; // Clear previous errors
            await file.save();
            logger_1.default.info(`[${this.serviceName}.${methodName}] Marked file ${fileId} as TRANSLATING.`);
            // Removed job enqueuing - return void
            return;
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            // Correct handleServiceError call (remove extra context object)
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '文件翻译任务提交');
        }
    }
    async translateProject(projectId, userId, requesterRoles = [], aiConfigId, promptTemplateId, options) {
        const methodName = 'translateProject';
        (0, errorHandler_1.validateId)(projectId, '项目');
        (0, errorHandler_1.validateId)(userId, '用户');
        (0, errorHandler_1.validateId)(aiConfigId, 'AI 配置');
        // validateId(promptTemplateId.toString(), '提示词模板');
        try {
            const project = await project_service_1.projectService.getProjectById(projectId, userId, requesterRoles);
            (0, errorHandler_1.validateEntityExists)(project, '项目');
            const files = await file_model_1.File.find({
                projectId: project._id,
                // Only include files that can be translated (e.g., EXTRACTED)
                status: file_model_1.FileStatus.EXTRACTED
            }).exec();
            if (!files || files.length === 0) {
                // Consider if this should be an error or just a warning/info message
                logger_1.default.warn(`[${this.serviceName}.${methodName}] No extractable files found in project ${projectId}.`);
                throw new errors_1.ValidationError('项目没有待翻译的文件 (状态为 EXTRACTED)');
            }
            // Determine source/target languages for the project job
            // This assumes all files in the project share the same primary language pair
            // Might need more complex logic if languages vary per file
            const firstFileWithLangs = files.find(f => f.metadata?.sourceLanguage && f.metadata?.targetLanguage);
            const sourceLanguage = options?.sourceLanguage || firstFileWithLangs?.metadata?.sourceLanguage;
            const targetLanguage = options?.targetLanguage || firstFileWithLangs?.metadata?.targetLanguage;
            if (!sourceLanguage || !targetLanguage) {
                throw new errors_1.AppError('无法确定项目的源语言或目标语言以进行翻译', 400);
            }
            // Prepare options for the project job
            const jobOptions = {
                ...options, // Spread incoming options
                sourceLanguage: sourceLanguage,
                targetLanguage: targetLanguage,
                aiProvider: options?.aiProvider,
                aiModel: options?.aiModel,
                promptTemplateId: promptTemplateId?.toString(),
            };
            // Call queue service with required arguments (6 args)
            const jobId = await translationQueue_service_1.translationQueueService.addProjectTranslationJob(projectId, aiConfigId, // Added
            promptTemplateId.toString(), // Added (ensure string)
            jobOptions, userId, // Added
            requesterRoles // Added
            );
            logger_1.default.info(`Project translation job ${jobId} added to queue for project ${projectId}`);
            // Update status of included files to QUEUED or TRANSLATING
            const fileIdsToUpdate = files.map(f => f._id);
            await file_model_1.File.updateMany({ _id: { $in: fileIdsToUpdate } }, { $set: { status: file_model_1.FileStatus.TRANSLATING } } // Or specific QUEUED status
            );
            logger_1.default.info(`Updated status for ${files.length} files in project ${projectId} to TRANSLATING.`);
            return jobId;
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            // Correct handleServiceError call (remove extra context object)
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '项目翻译任务提交');
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
// Instantiate with required dependencies
exports.translationService = new TranslationService(segment_service_1.segmentService, project_service_1.projectService, translationMemory_service_1.translationMemoryService, terminology_service_1.terminologyService, aiConfig_service_1.aiConfigService, ai_service_factory_1.aiServiceFactory, promptProcessor_1.promptProcessor);
// Removed the local buildTranslationPrompt function and related interfaces
/*
// Placeholder for prompt building logic - Now needs context object
// ... rest of commented out code ...
*/ 
