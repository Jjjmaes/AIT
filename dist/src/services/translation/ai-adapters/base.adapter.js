"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseAIServiceAdapter = void 0;
class BaseAIServiceAdapter {
    constructor(config) {
        this.config = config;
        this.provider = config.provider;
    }
    createError(code, message, details) {
        const error = new Error(message);
        error.code = code;
        error.provider = this.provider;
        error.details = details;
        return error;
    }
    calculateWordCount(text) {
        if (!text.trim()) {
            return 0;
        }
        return text.trim().split(/\s+/).length;
    }
    calculateCharacterCount(text) {
        return text.length;
    }
    async buildPrompt(sourceText, options) {
        const { sourceLanguage, targetLanguage, preserveFormatting, useTerminology } = options;
        let prompt = `Translate the following text from ${sourceLanguage} to ${targetLanguage}:\n\n`;
        if (preserveFormatting) {
            prompt += 'Please preserve all formatting, including line breaks, spaces, and special characters.\n\n';
        }
        if (useTerminology) {
            prompt += 'Please use the provided terminology if available.\n\n';
        }
        prompt += `Source text:\n${sourceText}\n\n`;
        prompt += 'Translation:';
        return prompt;
    }
}
exports.BaseAIServiceAdapter = BaseAIServiceAdapter;
