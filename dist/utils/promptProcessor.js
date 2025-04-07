"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.promptProcessor = void 0;
const promptTemplate_model_1 = require("../models/promptTemplate.model");
const logger_1 = __importDefault(require("./logger"));
const DEFAULT_TRANSLATION_SYSTEM_PROMPT = 'You are a professional translator.';
const DEFAULT_TRANSLATION_USER_PROMPT = 'Translate the following text from {{sourceLanguage}} to {{targetLanguage}}. Domain: {{domain}}. Text: {{input}}';
const DEFAULT_REVIEW_SYSTEM_PROMPT = 'You are an expert translation reviewer.';
const DEFAULT_REVIEW_USER_PROMPT = 'Review the translation from {{sourceLanguage}} to {{targetLanguage}}. Original: {{input}}. Translation: {{translation}}. Domain: {{domain}}.';
class PromptProcessor {
    async findTemplate(templateId) {
        if (!templateId)
            return null;
        try {
            return await promptTemplate_model_1.PromptTemplate.findById(templateId).exec();
        }
        catch (error) {
            logger_1.default.error(`Error finding prompt template ${templateId}:`, error);
            return null;
        }
    }
    // Replace placeholders like {{variableName}}
    replacePlaceholders(template, context, inputText) {
        let result = template;
        for (const key in context) {
            const placeholder = `{{${key}}}`;
            // Replace null/undefined context values with empty string
            result = result.replace(new RegExp(placeholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), context[key] ?? '');
        }
        // Replace input text specifically
        if (inputText !== undefined) {
            result = result.replace(/\{\{input\}\}/g, inputText);
        }
        return result;
    }
    async buildTranslationPrompt(sourceText, context) {
        let template = null;
        if (context.promptTemplateId) {
            template = await this.findTemplate(context.promptTemplateId);
            if (!template || template.taskType !== promptTemplate_model_1.PromptTaskType.TRANSLATION) {
                logger_1.default.warn(`Translation template ${context.promptTemplateId} not found or wrong type. Using default.`);
                template = null; // Fallback to default if wrong type
            }
        }
        const systemInstruction = template ? template.systemInstruction : DEFAULT_TRANSLATION_SYSTEM_PROMPT;
        const userPromptTemplate = template ? template.userPrompt : DEFAULT_TRANSLATION_USER_PROMPT;
        // Prepare context for placeholder replacement
        const fullContext = {
            ...context,
            domain: context.domain || 'general', // Provide default domain
            // Add terminology string if needed later
        };
        // Replace placeholders in user prompt template, including the {{input}}
        const finalUserPrompt = this.replacePlaceholders(userPromptTemplate, fullContext, sourceText);
        // Replace placeholders in system instruction (which usually don't include {{input}})
        const finalSystemInstruction = this.replacePlaceholders(systemInstruction, fullContext);
        return {
            systemInstruction: finalSystemInstruction,
            userPrompt: finalUserPrompt,
        };
    }
    // Similar method for building review prompts
    async buildReviewPrompt(originalText, translatedText, context) {
        let template = null;
        if (context.promptTemplateId) {
            template = await this.findTemplate(context.promptTemplateId);
            if (!template || template.taskType !== promptTemplate_model_1.PromptTaskType.REVIEW) {
                logger_1.default.warn(`Review template ${context.promptTemplateId} not found or wrong type. Using default.`);
                template = null;
            }
        }
        const systemInstruction = template ? template.systemInstruction : DEFAULT_REVIEW_SYSTEM_PROMPT;
        const userPromptTemplate = template ? template.userPrompt : DEFAULT_REVIEW_USER_PROMPT;
        const fullContext = {
            ...context,
            domain: context.domain || 'general',
            translation: translatedText // Add translation for review prompt
        };
        // Replace placeholders, including {{input}} (original) and {{translation}}
        const finalUserPrompt = this.replacePlaceholders(userPromptTemplate, fullContext, originalText);
        const finalSystemInstruction = this.replacePlaceholders(systemInstruction, fullContext);
        return {
            systemInstruction: finalSystemInstruction,
            userPrompt: finalUserPrompt,
        };
    }
}
// Export singleton instance
exports.promptProcessor = new PromptProcessor();
