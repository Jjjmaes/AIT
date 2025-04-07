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
class TranslationService {
    constructor() {
        this.serviceName = 'TranslationService';
    }
    async translateSegment(segmentId, userId, options) {
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
            const project = await project_service_1.projectService.getProjectById(file.projectId.toString(), userId);
            (0, errorHandler_1.validateEntityExists)(project, '关联项目');
            await segment_service_1.segmentService.updateSegment(segmentId, { status: segment_model_1.SegmentStatus.TRANSLATING });
            const sourceLang = options?.sourceLanguage || file.metadata.sourceLanguage;
            const targetLang = options?.targetLanguage || file.metadata.targetLanguage;
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
                terminology: project.terminology?.toString()
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
            logger_1.default.info(`Segment ${segmentId} translated successfully.`);
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
    async translateFile(projectId, fileId, userId, options) {
        const methodName = 'translateFile';
        (0, errorHandler_1.validateId)(projectId, '项目');
        (0, errorHandler_1.validateId)(fileId, '文件');
        (0, errorHandler_1.validateId)(userId, '用户');
        try {
            const project = await project_service_1.projectService.getProjectById(projectId, userId);
            const file = await file_model_1.File.findOne({ _id: new mongoose_1.Types.ObjectId(fileId), projectId: project._id }).exec();
            (0, errorHandler_1.validateEntityExists)(file, '文件');
            return await translationQueue_service_1.translationQueueService.addFileTranslationJob(projectId, fileId, options, userId);
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '文件翻译任务');
        }
    }
    async translateProject(projectId, userId, options) {
        const methodName = 'translateProject';
        (0, errorHandler_1.validateId)(projectId, '项目');
        (0, errorHandler_1.validateId)(userId, '用户');
        try {
            const project = await project_service_1.projectService.getProjectById(projectId, userId);
            const files = await file_model_1.File.find({ projectId: project._id }).exec();
            if (!files || files.length === 0) {
                throw new errors_1.ValidationError('项目没有要翻译的文件');
            }
            return await translationQueue_service_1.translationQueueService.addProjectTranslationJob(projectId, options, userId);
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
}
exports.TranslationService = TranslationService;
exports.translationService = new TranslationService();
