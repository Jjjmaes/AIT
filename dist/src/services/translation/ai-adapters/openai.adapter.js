"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIAdapter = void 0;
const openai_1 = require("openai");
const base_adapter_1 = require("./base.adapter");
const segment_model_1 = require("../../../models/segment.model");
const ai_service_types_1 = require("../../../types/ai-service.types");
const logger_1 = __importDefault(require("../../../utils/logger"));
const errors_1 = require("../../../utils/errors");
class OpenAIAdapter extends base_adapter_1.BaseAIServiceAdapter {
    constructor(config) {
        super(config);
        if (!config.apiKey) {
            throw new Error('OpenAI API key is required.');
        }
        this.openai = new openai_1.OpenAI({ apiKey: config.apiKey });
    }
    async translateText(sourceText, promptData, options) {
        const model = options?.model || this.config.defaultModel || 'gpt-3.5-turbo'; // Default model
        const temperature = options?.temperature ?? 0.3; // Default temperature
        const startTime = Date.now();
        try {
            logger_1.default.debug(`Calling OpenAI translation: model=${model}, temp=${temperature}`);
            const completion = await this.openai.chat.completions.create({
                model: model,
                messages: [
                    { role: 'system', content: promptData.systemInstruction },
                    { role: 'user', content: promptData.userPrompt }, // Assuming userPrompt contains the source text
                ],
                temperature: temperature,
                // Add other parameters like max_tokens if needed
            });
            const processingTime = Date.now() - startTime;
            const translatedText = completion.choices[0]?.message?.content?.trim() || '';
            const tokenCount = completion.usage ? {
                input: completion.usage.prompt_tokens,
                output: completion.usage.completion_tokens,
                total: completion.usage.total_tokens,
            } : undefined;
            logger_1.default.debug(`OpenAI translation completed in ${processingTime}ms. Tokens: ${tokenCount?.total}`);
            return {
                translatedText,
                tokenCount,
                processingTime,
                modelInfo: { provider: 'openai', model },
            };
        }
        catch (error) {
            logger_1.default.error('OpenAI translateText error:', error);
            const errorMessage = error.response?.data?.error?.message || error.message || 'Unknown OpenAI error';
            throw new errors_1.AppError(`OpenAI translation failed: ${errorMessage}`, 500);
        }
    }
    async executeChatCompletion(messages, options) {
        const model = options?.model || this.config.defaultModel || 'gpt-3.5-turbo';
        const temperature = options?.temperature ?? this.config.temperature ?? 0.3;
        const max_tokens = options?.max_tokens ?? this.config.maxTokens;
        const startTime = Date.now();
        // Ensure messages have the correct type expected by the OpenAI SDK
        const apiMessages = messages.map(m => ({
            role: m.role,
            content: m.content
        }));
        try {
            logger_1.default.debug(`Calling OpenAI chat completion: model=${model}, temp=${temperature}, max_tokens=${max_tokens}`);
            const completion = await this.openai.chat.completions.create({
                model: model,
                messages: apiMessages,
                temperature: temperature,
                max_tokens: max_tokens,
                // Consider adding response_format if JSON is always expected for specific tasks
                // response_format: { type: 'json_object' }, 
            });
            const processingTime = Date.now() - startTime;
            const content = completion.choices[0]?.message?.content ?? null;
            const usage = completion.usage;
            logger_1.default.debug(`OpenAI chat completion completed in ${processingTime}ms. Tokens: ${usage?.total_tokens}`);
            return {
                content: content,
                usage: usage ? {
                    prompt_tokens: usage.prompt_tokens,
                    completion_tokens: usage.completion_tokens,
                    total_tokens: usage.total_tokens,
                } : undefined,
                model: model, // Return the model used
            };
        }
        catch (error) {
            logger_1.default.error('OpenAI executeChatCompletion error:', error);
            const errorMessage = error.response?.data?.error?.message || error.message || 'Unknown OpenAI error';
            // Return error details in the response object
            return {
                content: null,
                model: model,
                error: `OpenAI chat completion failed: ${errorMessage}`
            };
            // Alternatively, rethrow a structured error:
            // throw new AppError(`OpenAI chat completion failed: ${errorMessage}`, 500, { provider: 'openai' });
        }
    }
    async reviewTranslation(data) {
        const model = data.options?.model || this.config.defaultModel || 'gpt-4'; // Use GPT-4 for review by default
        const temperature = data.options?.temperature ?? 0.5;
        const startTime = Date.now();
        // Construct a review prompt
        const systemPrompt = data.customPrompt || `You are an expert translator reviewing a translation from ${data.sourceLanguage} to ${data.targetLanguage}. Identify issues (like terminology, grammar, style, accuracy, formatting, consistency, omission, addition) and provide a score (0-100) for accuracy and fluency. Suggest an improved translation if necessary. Respond ONLY with a JSON object containing 'suggestedTranslation' (string), 'issues' (array of {type: string, severity: string, description: string, suggestion?: string}), and 'scores' (array of {type: string, score: number}).`;
        let userPrompt = `Original: ${data.originalContent}\nTranslation: ${data.translatedContent}`;
        if (data.contextSegments && data.contextSegments.length > 0) {
            userPrompt += `\n\nContext:\n${data.contextSegments.map(s => `Original: ${s.original}\nTranslation: ${s.translation}`).join('\n---\n')}`;
        }
        try {
            logger_1.default.debug(`Calling OpenAI review: model=${model}, temp=${temperature}`);
            const completion = await this.openai.chat.completions.create({
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: temperature,
                response_format: { type: 'json_object' }, // Force JSON output
            });
            const processingTime = Date.now() - startTime;
            const jsonResponse = completion.choices[0]?.message?.content;
            const tokenUsage = completion.usage;
            const modelUsed = model;
            logger_1.default.debug(`OpenAI review completed in ${processingTime}ms. Tokens: ${completion.usage?.total_tokens}`);
            if (!jsonResponse) {
                throw new Error('OpenAI review returned empty content.');
            }
            // Safely parse the JSON response
            let parsedResult = {};
            try {
                parsedResult = JSON.parse(jsonResponse);
            }
            catch (parseError) {
                logger_1.default.error('Failed to parse OpenAI review JSON response:', jsonResponse);
                throw new Error('Failed to parse AI review response.');
            }
            // Validate and structure the response
            const validatedIssues = (parsedResult.issues || []).map((issue) => ({
                type: Object.values(segment_model_1.IssueType).includes(issue.type) ? issue.type : segment_model_1.IssueType.OTHER,
                severity: Object.values(segment_model_1.IssueSeverity).includes(issue.severity) ? issue.severity : segment_model_1.IssueSeverity.MEDIUM,
                description: issue.description || 'No description',
                suggestion: issue.suggestion,
                position: issue.position // Pass through position if provided
            }));
            const validatedScores = (parsedResult.scores || []).filter((score) => typeof score.type === 'string' && typeof score.score === 'number');
            const suggestedTranslation = parsedResult.suggestedTranslation || data.translatedContent;
            const modificationDegree = this.calculateModificationDegree(data.translatedContent, suggestedTranslation);
            const wordCount = this.countWords(suggestedTranslation);
            const charCount = suggestedTranslation.length;
            const inputTokens = tokenUsage?.prompt_tokens || 0;
            const outputTokens = tokenUsage?.completion_tokens || 0;
            return {
                suggestedTranslation: suggestedTranslation,
                issues: validatedIssues,
                scores: validatedScores,
                metadata: {
                    provider: ai_service_types_1.AIProvider.OPENAI, // Use enum value
                    model: modelUsed,
                    processingTime,
                    confidence: 0.9, // Placeholder: OpenAI doesn't provide confidence
                    wordCount: wordCount,
                    characterCount: charCount,
                    tokens: {
                        input: inputTokens,
                        output: outputTokens,
                    },
                    modificationDegree: modificationDegree
                },
            };
        }
        catch (error) {
            logger_1.default.error('OpenAI reviewTranslation error:', error);
            const errorMessage = error.response?.data?.error?.message || error.message || 'Unknown OpenAI error';
            throw new errors_1.AppError(`OpenAI review failed: ${errorMessage}`, 500);
        }
    }
    async getAvailableModels() {
        logger_1.default.warn('getAvailableModels returning hardcoded defaults for OpenAI.');
        // Add missing required properties with default/example values
        return [
            {
                provider: ai_service_types_1.AIProvider.OPENAI,
                id: 'gpt-4',
                name: 'GPT-4',
                maxTokens: 8192, // Example value
                capabilities: ['translation', 'review'], // Example value
                pricing: { input: 0.03, output: 0.06 } // Example value
            },
            {
                provider: ai_service_types_1.AIProvider.OPENAI,
                id: 'gpt-3.5-turbo',
                name: 'GPT-3.5 Turbo',
                maxTokens: 16385, // Example value
                capabilities: ['translation', 'review'], // Example value
                pricing: { input: 0.0005, output: 0.0015 } // Example value
            },
        ];
    }
    async validateApiKey() {
        // Basic validation: Try listing models
        try {
            await this.openai.models.list();
            return true;
        }
        catch (error) {
            logger_1.default.error('OpenAI API key validation failed:', error);
            return false;
        }
    }
    // Add helper methods if they don't exist from Base class
    countWords(text) {
        return text.trim().split(/\s+/).filter(Boolean).length;
    }
    calculateModificationDegree(original, modified) {
        // Simple Levenshtein distance based degree (example)
        // In a real app, use a proper library like 'fast-levenshtein'
        if (!original || !modified)
            return 0;
        if (original === modified)
            return 0;
        const len1 = original.length;
        const len2 = modified.length;
        const matrix = [];
        for (let i = 0; i <= len1; i++)
            matrix[i] = [i];
        for (let j = 0; j <= len2; j++)
            matrix[0][j] = j;
        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                const cost = original[i - 1] === modified[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(matrix[i - 1][j] + 1, // Deletion
                matrix[i][j - 1] + 1, // Insertion
                matrix[i - 1][j - 1] + cost // Substitution
                );
            }
        }
        const distance = matrix[len1][len2];
        return distance / Math.max(len1, len2, 1); // Normalize
    }
}
exports.OpenAIAdapter = OpenAIAdapter;
