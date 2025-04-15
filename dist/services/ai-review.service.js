"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIReviewService = void 0;
const ai_service_types_1 = require("../types/ai-service.types");
const ai_adapters_1 = require("./translation/ai-adapters");
const logger_1 = __importDefault(require("../utils/logger"));
const promptTemplate_service_1 = require("./promptTemplate.service");
const promptTemplate_model_1 = require("../models/promptTemplate.model");
const terminology_service_1 = require("./terminology.service");
const project_service_1 = require("./project.service");
const errorHandler_1 = require("../utils/errorHandler");
/**
 * AI审校服务
 * 提供独立的AI审校功能，可以被其他服务或控制器调用
 */
class AIReviewService {
    constructor(promptSvc = promptTemplate_service_1.promptTemplateService, aiFactory = ai_adapters_1.AIServiceFactory.getInstance(), termSvc = terminology_service_1.terminologyService, projSvc = project_service_1.projectService) {
        this.aiServiceFactory = aiFactory;
        this.promptTemplateService = promptSvc;
        this.terminologyService = termSvc;
        this.projectService = projSvc;
    }
    /**
     * 获取AI审校适配器
     */
    getReviewAdapter(config) {
        const adapterConfig = {
            provider: config.provider,
            apiKey: config.apiKey,
            model: config.model,
            temperature: 0.3,
            maxTokens: 4000
        };
        return this.aiServiceFactory.createReviewAdapter(adapterConfig);
    }
    /**
     * 执行文本审校
     * @param original 原文
     * @param translation 翻译
     * @param options 审校选项
     */
    async reviewTranslation(original, translation, options // Use the defined interface
    ) {
        const methodName = 'reviewTranslation';
        logger_1.default.debug(`[${methodName}] Starting review process.`);
        try {
            // 获取API密钥（首选传入的，否则使用环境变量）
            const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
            if (!apiKey) {
                logger_1.default.error(`[${methodName}] API key is missing.`);
                throw new Error('未配置API密钥');
            }
            // 获取提供商（首选传入的，否则默认为OpenAI）
            const provider = options.provider || ai_service_types_1.AIProvider.OPENAI;
            // 获取模型（首选传入的，否则使用默认值）
            const model = options.model || 'gpt-3.5-turbo';
            // --- Fetch Terminology if projectId is available ---
            let terms = [];
            if (options.projectId && options.userId) { // Check for userId too
                try {
                    // Pass roles from options
                    const project = await this.projectService.getProjectById(options.projectId, options.userId, options.requesterRoles || [] // Pass roles, default to empty array
                    );
                    (0, errorHandler_1.validateEntityExists)(project, '关联项目 for terminology');
                    if (project.terminology) {
                        const terminologyList = await this.terminologyService.getTerminologyById(project.terminology.toString());
                        if (terminologyList?.terms) {
                            terms = terminologyList.terms;
                            logger_1.default.info(`[${methodName}] Fetched ${terms.length} terms for project ${options.projectId}.`);
                        }
                    }
                }
                catch (error) {
                    logger_1.default.error(`[${methodName}] Failed to fetch project or terminology for project ${options.projectId}. Proceeding without terms.`, { error });
                }
            }
            // ---------------------------------------------------
            // 获取并渲染提示模板
            let effectivePrompt = options.customPrompt;
            // Fetch and process prompt template
            if (!effectivePrompt && options.promptTemplateId) {
                logger_1.default.debug(`[${methodName}] Attempting to fetch prompt template ID: ${options.promptTemplateId}`);
                try {
                    const template = await this.promptTemplateService.getTemplateById(options.promptTemplateId);
                    if (template && template.taskType === promptTemplate_model_1.PromptTaskType.REVIEW) {
                        logger_1.default.info(`[${methodName}] Using prompt template ID: ${options.promptTemplateId}`);
                        // Start with the base user prompt from the template
                        let promptText = template.userPrompt
                            .replace('{SOURCE_LANGUAGE}', options.sourceLanguage)
                            .replace('{TARGET_LANGUAGE}', options.targetLanguage)
                            .replace('{ORIGINAL_CONTENT}', original)
                            .replace('{TRANSLATED_CONTENT}', translation);
                        // Inject terminology if available
                        if (terms.length > 0) {
                            const formattedTerms = terms.map(term => `[${term.source} -> ${term.target}]`).join(', ');
                            // Prepend a clear instruction about terminology
                            const terminologyInstruction = `Strictly adhere to the following terminology: ${formattedTerms}.\n\n`;
                            // Check if a placeholder exists for more structured injection (optional)
                            if (promptText.includes('{TERMINOLOGY_LIST}')) {
                                promptText = promptText.replace('{TERMINOLOGY_LIST}', formattedTerms); // Replace placeholder if exists
                                logger_1.default.info(`[${methodName}] Injected ${terms.length} terms into {TERMINOLOGY_LIST} placeholder.`);
                            }
                            else {
                                // Otherwise, prepend the instruction to the main prompt text
                                promptText = terminologyInstruction + promptText;
                                logger_1.default.warn(`[${methodName}] Prompt template ${options.promptTemplateId} lacks {TERMINOLOGY_LIST} placeholder. Prepending terminology instruction.`);
                            }
                        }
                        effectivePrompt = promptText;
                    }
                    else {
                        logger_1.default.warn(`[${methodName}] Prompt template ${options.promptTemplateId} not found or not a REVIEW template. Falling back.`);
                    }
                }
                catch (error) {
                    // Catch errors specifically from fetching/processing the template
                    logger_1.default.error(`[${methodName}] Error processing prompt template ${options.promptTemplateId}. Falling back.`, { error });
                    // effectivePrompt remains null or the original customPrompt, allowing fallback
                }
            }
            // This handles the case where a customPrompt was provided initially
            else if (effectivePrompt && terms.length > 0) {
                // Inject terms into the custom prompt if provided
                const formattedTerms = terms.map(term => `[${term.source} -> ${term.target}]`).join(', ');
                const terminologyInstruction = `Strictly adhere to the following terminology: ${formattedTerms}.\n\n`;
                effectivePrompt = terminologyInstruction + effectivePrompt;
                logger_1.default.info(`[${methodName}] Injected ${terms.length} terms into custom review prompt.`);
            }
            else if (!effectivePrompt) { // Log if still no prompt after checking template and custom
                logger_1.default.debug(`[${methodName}] No prompt template ID or customPrompt provided/processed. Using default adapter prompt.`);
            }
            // 获取审校适配器
            logger_1.default.debug(`[${methodName}] Getting review adapter for provider: ${provider}, model: ${model}`);
            const reviewAdapter = this.getReviewAdapter({
                provider,
                apiKey,
                model
            });
            // 构建审校选项
            const reviewOptions = {
                sourceLanguage: options.sourceLanguage,
                targetLanguage: options.targetLanguage,
                originalContent: original,
                translatedContent: translation,
                customPrompt: effectivePrompt, // Pass the potentially modified prompt
                requestedScores: options.requestedScores,
                checkIssueTypes: options.checkIssueTypes,
                contextSegments: options.contextSegments,
                projectId: options.projectId // Pass projectId if needed by adapter
            };
            // 执行审校并返回结果
            logger_1.default.info(`[${methodName}] Starting AI review using ${provider} model ${model}`);
            const result = await reviewAdapter.reviewText(reviewOptions);
            logger_1.default.info(`[${methodName}] AI review completed successfully`);
            return result;
        }
        catch (error) {
            logger_1.default.error(`[${methodName}] AI review failed`, { error });
            throw new Error(`AI审校失败: ${error.message}`);
        }
    }
    /**
     * 执行文本审校（简化别名方法）
     * @param original 原文
     * @param translation 翻译
     * @param options 审校选项
     */
    async reviewText(original, translation, options // Use the defined interface
    ) {
        return this.reviewTranslation(original, translation, options);
    }
    /**
     * 获取支持的审校模型列表
     * @param provider AI提供商
     * @param apiKey API密钥
     */
    async getSupportedModels(provider = ai_service_types_1.AIProvider.OPENAI, apiKey) {
        try {
            // 获取API密钥（首选传入的，否则使用环境变量）
            const key = apiKey || process.env.OPENAI_API_KEY;
            if (!key) {
                throw new Error('未配置API密钥');
            }
            // 获取审校适配器
            const reviewAdapter = this.getReviewAdapter({
                provider,
                apiKey: key,
                model: 'gpt-3.5-turbo' // 这里只是用来初始化适配器，不会真正使用该模型
            });
            // 获取适配器支持的模型
            const models = await reviewAdapter.getAvailableModels();
            // 过滤出具有审校能力的模型
            return models.filter(model => model.capabilities.includes('review'));
        }
        catch (error) {
            logger_1.default.error('Failed to get supported models', { error });
            throw new Error(`获取支持的模型失败: ${error.message}`);
        }
    }
    /**
     * 验证API密钥是否有效
     * @param provider AI提供商
     * @param apiKey API密钥
     */
    async validateApiKey(provider = ai_service_types_1.AIProvider.OPENAI, apiKey) {
        try {
            // 获取审校适配器
            const reviewAdapter = this.getReviewAdapter({
                provider,
                apiKey,
                model: 'gpt-3.5-turbo' // 这里只是用来初始化适配器，不会真正使用该模型
            });
            // 验证API密钥
            return await reviewAdapter.validateApiKey();
        }
        catch (error) {
            logger_1.default.error('API key validation failed', { error });
            return false;
        }
    }
}
exports.AIReviewService = AIReviewService;
// 导出服务实例
exports.default = new AIReviewService();
