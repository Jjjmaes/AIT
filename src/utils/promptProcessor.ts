import { PromptTemplate, IPromptTemplate, PromptTaskType } from '../models/promptTemplate.model';
import logger from './logger';
import { Types } from 'mongoose';

// Define the context structure expected by the processor
interface PromptBuildContext {
  promptTemplateId?: string | Types.ObjectId;
  sourceLanguage: string;
  targetLanguage: string;
  domain?: string;
  terminology?: string; // Placeholder for terminology integration
  // Add any other context needed for variable replacement
}

// Define the output structure
export interface ProcessedPrompt {
  systemInstruction: string;
  userPrompt: string; // This is the final user prompt with input replaced
}

const DEFAULT_TRANSLATION_SYSTEM_PROMPT = 'You are a professional translator.';
const DEFAULT_TRANSLATION_USER_PROMPT = 'Translate the following text from {{sourceLanguage}} to {{targetLanguage}}. Domain: {{domain}}. Text: {{input}}';

const DEFAULT_REVIEW_SYSTEM_PROMPT = 'You are an expert translation reviewer.';
const DEFAULT_REVIEW_USER_PROMPT = 'Review the translation from {{sourceLanguage}} to {{targetLanguage}}. Original: {{input}}. Translation: {{translation}}. Domain: {{domain}}.';

class PromptProcessor {

  private async findTemplate(templateId: string | Types.ObjectId): Promise<IPromptTemplate | null> {
    if (!templateId) return null;
    try {
      return await PromptTemplate.findById(templateId).exec();
    } catch (error) {
      logger.error(`Error finding prompt template ${templateId}:`, error);
      return null;
    }
  }

  // Replace placeholders like {{variableName}}
  private replacePlaceholders(template: string, context: Record<string, any>, inputText?: string): string {
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

  async buildTranslationPrompt(
    sourceText: string,
    context: PromptBuildContext
  ): Promise<ProcessedPrompt> {
    let template: IPromptTemplate | null = null;
    if (context.promptTemplateId) {
      template = await this.findTemplate(context.promptTemplateId);
      if (!template || template.taskType !== PromptTaskType.TRANSLATION) {
        logger.warn(`Translation template ${context.promptTemplateId} not found or wrong type. Using default.`);
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
  async buildReviewPrompt(
    originalText: string,
    translatedText: string, 
    context: PromptBuildContext
  ): Promise<ProcessedPrompt> {
     let template: IPromptTemplate | null = null;
    if (context.promptTemplateId) {
      template = await this.findTemplate(context.promptTemplateId);
      if (!template || template.taskType !== PromptTaskType.REVIEW) {
        logger.warn(`Review template ${context.promptTemplateId} not found or wrong type. Using default.`);
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
export const promptProcessor = new PromptProcessor(); 