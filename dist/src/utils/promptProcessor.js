"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.promptProcessor = void 0;
exports.processTranslationPrompt = processTranslationPrompt;
exports.processReviewPrompt = processReviewPrompt;
const promptTemplate_model_1 = require("../models/promptTemplate.model");
const logger_1 = __importDefault(require("./logger"));
// Default prompts using {{variable}} format
const DEFAULT_TRANSLATION_SYSTEM_PROMPT = 'You are a professional translator.';
const DEFAULT_TRANSLATION_USER_PROMPT = 'Translate the following text from {{sourceLang}} to {{targetLang}}:\n\n{{sourceText}}';
const DEFAULT_REVIEW_SYSTEM_PROMPT = 'You are a professional translation reviewer.';
const DEFAULT_REVIEW_USER_PROMPT = `Review the following translation. Source ({{sourceLang}}): "{{sourceText}}". Translation ({{targetLang}}): "{{translatedText}}". Provide feedback on accuracy, fluency, style, and terminology.`;
/**
 * Fills placeholders in a prompt string with provided variable values.
 * Placeholders are in the format {{variable_name}}.
 */
function fillPlaceholders(prompt, variables) {
    // Gracefully handle null or undefined prompt input
    if (prompt === null || prompt === undefined) {
        logger_1.default.warn('[fillPlaceholders] Received null or undefined prompt input. Returning empty string.');
        return '';
    }
    let processedPrompt = prompt;
    for (const key in variables) {
        const value = variables[key] !== undefined ? String(variables[key]) : '';
        const escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`\{\{${escapedKey}\}\}`, 'g');
        processedPrompt = processedPrompt.replace(regex, value);
    }
    const remainingPlaceholders = processedPrompt.match(/\{\{[a-zA-Z0-9_]+\}\}/g);
    if (remainingPlaceholders) {
        logger_1.default.warn(`[fillPlaceholders] Unfilled placeholders remaining: ${remainingPlaceholders.join(', ')}`);
    }
    return processedPrompt;
}
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
        // Log entry and context
        logger_1.default.debug(`[PromptProcessor.buildTranslationPrompt] ENTER - context:`, context);
        logger_1.default.debug(`[PromptProcessor.buildTranslationPrompt] sourceText length: ${sourceText?.length ?? 'undefined'}`);
        let template = null;
        if (context.promptTemplateId) {
            logger_1.default.debug(`[PromptProcessor.buildTranslationPrompt] Finding template ID: ${context.promptTemplateId}`);
            template = await this.findTemplate(context.promptTemplateId);
            if (!template || template.type !== promptTemplate_model_1.PromptTemplateType.TRANSLATION) {
                logger_1.default.warn(`[PromptProcessor.buildTranslationPrompt] Translation template ${context.promptTemplateId} not found or wrong type. Using default.`);
                template = null; // Fallback to default if wrong type
            }
            else {
                logger_1.default.debug(`[PromptProcessor.buildTranslationPrompt] Found template. Content length: ${template.content?.length ?? 'undefined'}`);
            }
        }
        // Check if template and template.content are valid before using
        const userPromptTemplate = (template && template.content) ? template.content : DEFAULT_TRANSLATION_USER_PROMPT;
        const systemInstructionTemplate = (template && template.content) ? null : DEFAULT_TRANSLATION_SYSTEM_PROMPT;
        if (template && !template.content) {
            logger_1.default.warn(`[PromptProcessor.buildTranslationPrompt] Template ${template._id} found, but its content is missing. Falling back to default prompts.`);
        }
        logger_1.default.debug(`[PromptProcessor.buildTranslationPrompt] Using systemInstruction template ...`); // Simplified log
        logger_1.default.debug(`[PromptProcessor.buildTranslationPrompt] Using userPromptTemplate template ...`); // Simplified log
        // Prepare variables map (variables)
        const { promptTemplateId, terms, ...simpleContext } = context;
        const variables = {
            ...simpleContext,
            sourceText: sourceText,
            sourceLang: context.sourceLanguage,
            targetLang: context.targetLanguage,
            domain: context.domain || 'general',
            glossaryName: context.terminology || 'None'
        };
        // Use fillPlaceholders safely
        logger_1.default.debug(`[PromptProcessor.buildTranslationPrompt] Replacing placeholders in user prompt using fillPlaceholders...`);
        const finalUserPrompt = fillPlaceholders(userPromptTemplate, variables);
        let finalSystemInstruction = null;
        if (systemInstructionTemplate) {
            logger_1.default.debug(`[PromptProcessor.buildTranslationPrompt] Replacing placeholders in system instruction using fillPlaceholders...`);
            finalSystemInstruction = fillPlaceholders(systemInstructionTemplate, variables);
        }
        else {
            logger_1.default.debug(`[PromptProcessor.buildTranslationPrompt] No system instruction template to process.`);
            finalSystemInstruction = null;
        }
        logger_1.default.debug(`[PromptProcessor.buildTranslationPrompt] EXIT - Returning processed prompt.`);
        return {
            systemPrompt: finalSystemInstruction,
            userPrompt: finalUserPrompt,
        };
    }
    async buildReviewPrompt(originalText, translatedText, context) {
        let template = null;
        if (context.promptTemplateId) {
            template = await this.findTemplate(context.promptTemplateId);
            if (!template || template.type !== promptTemplate_model_1.PromptTemplateType.REVIEW) {
                logger_1.default.warn(`Review template ${context.promptTemplateId} not found or wrong type. Using default.`);
                template = null;
            }
        }
        // Check template content validity here too
        const userPromptTemplate = (template && template.content) ? template.content : DEFAULT_REVIEW_USER_PROMPT;
        const systemInstructionTemplate = (template && template.content) ? null : DEFAULT_REVIEW_SYSTEM_PROMPT;
        if (template && !template.content) {
            logger_1.default.warn(`[PromptProcessor.buildReviewPrompt] Template ${template._id} found, but its content is missing. Falling back to default prompts.`);
        }
        // Prepare variables map (variables)
        const { promptTemplateId, terms, ...simpleContext } = context;
        const variables = {
            ...simpleContext,
            sourceText: originalText,
            translatedText: translatedText,
            sourceLang: context.sourceLanguage,
            targetLang: context.targetLanguage,
            domain: context.domain || 'general',
            glossaryName: context.terminology || 'None'
        };
        // Use fillPlaceholders for review prompts too
        const finalUserPrompt = fillPlaceholders(userPromptTemplate, variables);
        let finalSystemInstruction = null;
        if (systemInstructionTemplate) {
            finalSystemInstruction = fillPlaceholders(systemInstructionTemplate, variables);
        }
        else {
            finalSystemInstruction = null;
        }
        return {
            systemPrompt: finalSystemInstruction,
            userPrompt: finalUserPrompt,
        };
    }
}
// Export singleton instance
exports.promptProcessor = new PromptProcessor();
/**
 * Processes a translation prompt using an optional template.
 */
function processTranslationPrompt(template, variables) {
    // Use the corrected type check
    if (!template || template.type !== promptTemplate_model_1.PromptTemplateType.TRANSLATION) {
        if (template) {
            logger_1.default.warn(`[processTranslationPrompt] Provided template ID ${template._id} is not a TRANSLATION template. Using default.`);
        }
        else {
            logger_1.default.debug(`[processTranslationPrompt] No template provided. Using default.`);
        }
        // Fallback to default prompts if no valid template
        // Assume default system prompt might not be needed if AI handles it
        return {
            systemPrompt: null, // Or DEFAULT_TRANSLATION_SYSTEM_PROMPT if needed
            userPrompt: fillPlaceholders(DEFAULT_TRANSLATION_USER_PROMPT, variables)
        };
    }
    // Use the template content
    // We assume the content field contains the full prompt structure.
    // The concept of a separate systemInstruction isn't directly mapped anymore.
    const systemInstruction = null; // System instruction is part of content or handled by AI
    const userPromptTemplate = template.content; // Use the main content field
    logger_1.default.debug(`[processTranslationPrompt] Using template ID: ${template._id}`);
    // Fill placeholders in the user prompt template from the template's content
    const finalUserPrompt = fillPlaceholders(userPromptTemplate, variables);
    return {
        systemPrompt: systemInstruction, // Use the determined system instruction (null in this case)
        userPrompt: finalUserPrompt
    };
}
/**
 * Processes a review prompt using an optional template.
 */
function processReviewPrompt(template, variables) {
    // Use the corrected type check
    if (!template || template.type !== promptTemplate_model_1.PromptTemplateType.REVIEW) {
        if (template) {
            logger_1.default.warn(`[processReviewPrompt] Provided template ID ${template._id} is not a REVIEW template. Using default.`);
        }
        else {
            logger_1.default.debug(`[processReviewPrompt] No template provided. Using default.`);
        }
        // Fallback to default prompts
        return {
            systemPrompt: null, // Or DEFAULT_REVIEW_SYSTEM_PROMPT
            userPrompt: fillPlaceholders(DEFAULT_REVIEW_USER_PROMPT, variables)
        };
    }
    // Use the template content
    const systemInstruction = null; // System instruction is part of content or handled by AI
    const userPromptTemplate = template.content; // Use the main content field
    logger_1.default.debug(`[processReviewPrompt] Using template ID: ${template._id}`);
    // Fill placeholders in the user prompt template from the template's content
    const finalUserPrompt = fillPlaceholders(userPromptTemplate, variables);
    return {
        systemPrompt: systemInstruction, // Use the determined system instruction (null in this case)
        userPrompt: finalUserPrompt
    };
}
