import { Service } from 'typedi';
import { PromptTemplate, IPromptTemplate, PromptTemplateType } from '../models/promptTemplate.model';
import logger from './logger';
import { Types } from 'mongoose';
import { ITermEntry } from '../models/terminology.model';

// Define the context structure expected by the processor
export interface PromptBuildContext {
  promptTemplateId?: string | Types.ObjectId;
  sourceLanguage: string;
  targetLanguage: string;
  domain?: string;
  terminology?: string; // Placeholder for terminology integration
  terms?: ITermEntry[]; // Added terms based on usage in translation.service
  // Add any other context needed for variable replacement
}

// Define the output structure
export interface ProcessedPrompt {
  systemPrompt: string | null; // System prompt might not always be separate
  userPrompt: string;
}

// Default prompts using {{variable}} format
const DEFAULT_TRANSLATION_SYSTEM_PROMPT = 'You are a professional translator.';
const DEFAULT_TRANSLATION_USER_PROMPT = 'Translate the following text from {{sourceLang}} to {{targetLang}}:\n\n{{sourceText}}';

const DEFAULT_REVIEW_SYSTEM_PROMPT = 'You are a professional translation reviewer.';
const DEFAULT_REVIEW_USER_PROMPT = `Review the following translation. Source ({{sourceLang}}): "{{sourceText}}". Translation ({{targetLang}}): "{{translatedText}}". Provide feedback on accuracy, fluency, style, and terminology.`;

interface VariableMap {
  [key: string]: string | number | undefined;
}

/**
 * Fills placeholders in a prompt string with provided variable values.
 * Placeholders are in the format {{variable_name}}.
 */
export function fillPlaceholders(prompt: string | null | undefined, variables: VariableMap): string {
  // Gracefully handle null or undefined prompt input
  if (prompt === null || prompt === undefined) {
    logger.warn('[fillPlaceholders] Received null or undefined prompt input. Returning empty string.');
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
    logger.warn(`[fillPlaceholders] Unfilled placeholders remaining: ${remainingPlaceholders.join(', ')}`);
  }
  return processedPrompt;
}

@Service()
export class PromptProcessor {

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
    // Log entry and context
    logger.debug(`[PromptProcessor.buildTranslationPrompt] ENTER - context:`, context);
    logger.debug(`[PromptProcessor.buildTranslationPrompt] sourceText length: ${sourceText?.length ?? 'undefined'}`);
    
    let template: IPromptTemplate | null = null;
    if (context.promptTemplateId) {
      logger.debug(`[PromptProcessor.buildTranslationPrompt] Finding template ID: ${context.promptTemplateId}`);
      template = await this.findTemplate(context.promptTemplateId);
      if (!template || template.type !== PromptTemplateType.TRANSLATION) {
        logger.warn(`[PromptProcessor.buildTranslationPrompt] Translation template ${context.promptTemplateId} not found or wrong type. Using default.`);
        template = null; // Fallback to default if wrong type
      } else {
        logger.debug(`[PromptProcessor.buildTranslationPrompt] Found template. Content length: ${template.content?.length ?? 'undefined'}`);
      }
    }

    // Check if template and template.content are valid before using
    const userPromptTemplate = (template && template.content) ? template.content : DEFAULT_TRANSLATION_USER_PROMPT;
    const systemInstructionTemplate = (template && template.content) ? null : DEFAULT_TRANSLATION_SYSTEM_PROMPT; 
    
    if (template && !template.content) {
        logger.warn(`[PromptProcessor.buildTranslationPrompt] Template ${template._id} found, but its content is missing. Falling back to default prompts.`);
    }
    
    logger.debug(`[PromptProcessor.buildTranslationPrompt] Using systemInstruction template ...`); // Simplified log
    logger.debug(`[PromptProcessor.buildTranslationPrompt] Using userPromptTemplate template ...`); // Simplified log

    // Prepare variables map (variables)
    const { promptTemplateId, terms, ...simpleContext } = context;
    const variables: VariableMap = { 
        ...simpleContext, 
        sourceText: sourceText, 
        sourceLang: context.sourceLanguage, 
        targetLang: context.targetLanguage, 
        domain: context.domain || 'general', 
        glossaryName: context.terminology || 'None' 
    };

    // Use fillPlaceholders safely
    logger.debug(`[PromptProcessor.buildTranslationPrompt] Replacing placeholders in user prompt using fillPlaceholders...`);
    const finalUserPrompt = fillPlaceholders(userPromptTemplate, variables);
    
    let finalSystemInstruction: string | null = null;
    if (systemInstructionTemplate) {
      logger.debug(`[PromptProcessor.buildTranslationPrompt] Replacing placeholders in system instruction using fillPlaceholders...`);
      finalSystemInstruction = fillPlaceholders(systemInstructionTemplate, variables);
    } else {
         logger.debug(`[PromptProcessor.buildTranslationPrompt] No system instruction template to process.`);
         finalSystemInstruction = null; 
    }

    logger.debug(`[PromptProcessor.buildTranslationPrompt] EXIT - Returning processed prompt.`);
    return {
      systemPrompt: finalSystemInstruction,
      userPrompt: finalUserPrompt,
    };
  }

  async buildReviewPrompt(
    originalText: string,
    translatedText: string, 
    context: PromptBuildContext
  ): Promise<ProcessedPrompt> {
     let template: IPromptTemplate | null = null;
    if (context.promptTemplateId) {
      template = await this.findTemplate(context.promptTemplateId);
      if (!template || template.type !== PromptTemplateType.REVIEW) {
        logger.warn(`Review template ${context.promptTemplateId} not found or wrong type. Using default.`);
        template = null; 
      }
    }

    // Check template content validity here too
    const userPromptTemplate = (template && template.content) ? template.content : DEFAULT_REVIEW_USER_PROMPT;
    const systemInstructionTemplate = (template && template.content) ? null : DEFAULT_REVIEW_SYSTEM_PROMPT;
    
    if (template && !template.content) {
        logger.warn(`[PromptProcessor.buildReviewPrompt] Template ${template._id} found, but its content is missing. Falling back to default prompts.`);
    }

    // Prepare variables map (variables)
    const { promptTemplateId, terms, ...simpleContext } = context;
    const variables: VariableMap = { 
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
    
    let finalSystemInstruction: string | null = null;
    if (systemInstructionTemplate) {
        finalSystemInstruction = fillPlaceholders(systemInstructionTemplate, variables);
    } else {
        finalSystemInstruction = null;
    }

    return {
      systemPrompt: finalSystemInstruction,
      userPrompt: finalUserPrompt,
    };
  }

  /**
   * Builds only the base system prompt based on context and template ID.
   * Excludes sourceText from placeholder filling.
   * @param context - The prompt build context.
   * @returns The processed system prompt string, or null if no system prompt is defined.
   */
  async buildBaseSystemPrompt(
    context: PromptBuildContext
  ): Promise<string | null> {
    const methodName = 'buildBaseSystemPrompt';
    logger.debug(`[PromptProcessor.${methodName}] ENTER - context:`, context);

    let template: IPromptTemplate | null = null;
    if (context.promptTemplateId) {
      logger.debug(`[PromptProcessor.${methodName}] Finding template ID: ${context.promptTemplateId}`);
      template = await this.findTemplate(context.promptTemplateId);
      // Assuming translation type for now, might need context for type later
      if (!template || template.type !== PromptTemplateType.TRANSLATION) { 
        logger.warn(`[PromptProcessor.${methodName}] Translation template ${context.promptTemplateId} not found or wrong type. Using default system prompt.`);
        template = null; 
      }
    }

    // Determine the system prompt template to use
    // TODO: Revisit how system prompt is determined. Does template.content contain both?
    // Or should template have a separate systemPrompt field?
    // --- FIX: Always use the default system prompt for now, regardless of custom template existence ---
    const systemInstructionTemplate = DEFAULT_TRANSLATION_SYSTEM_PROMPT;
    
    // Log if a custom template was found but its content is missing (relevant for user prompt later)
    if (template && !template.content) {
         logger.warn(`[PromptProcessor.${methodName}] Template ${template._id} found, but its content is missing. User prompt might be affected.`);
    }

    // This check is no longer needed as we always assign a system prompt template
    // if (!systemInstructionTemplate) {

    // Prepare variables map, EXCLUDING sourceText
    const { promptTemplateId, terms, ...simpleContext } = context;
    const variables: VariableMap = { 
        ...simpleContext, 
        // sourceText: undefined, // Explicitly exclude
        sourceLang: context.sourceLanguage, 
        targetLang: context.targetLanguage, 
        domain: context.domain || 'general', 
        glossaryName: context.terminology || 'None', 
         // Format terms if provided (example, adjust formatting as needed)
        terms: terms?.map(t => `${t.source}=${t.target}`).join(', ') || 'None' 
    };

    logger.debug(`[PromptProcessor.${methodName}] Replacing placeholders in system instruction using fillPlaceholders...`);
    const finalSystemInstruction = fillPlaceholders(systemInstructionTemplate, variables);

    logger.debug(`[PromptProcessor.${methodName}] EXIT - Returning processed system prompt.`);
    return finalSystemInstruction;
  }
}

/**
 * Processes a translation prompt using an optional template.
 */
export function processTranslationPrompt(template: IPromptTemplate | null | undefined, variables: VariableMap): ProcessedPrompt {
    // Use the corrected type check
    if (!template || template.type !== PromptTemplateType.TRANSLATION) {
        if (template) {
             logger.warn(`[processTranslationPrompt] Provided template ID ${template._id} is not a TRANSLATION template. Using default.`);
        } else {
             logger.debug(`[processTranslationPrompt] No template provided. Using default.`);
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

    logger.debug(`[processTranslationPrompt] Using template ID: ${template._id}`);
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
export function processReviewPrompt(template: IPromptTemplate | null | undefined, variables: VariableMap): ProcessedPrompt {
     // Use the corrected type check
    if (!template || template.type !== PromptTemplateType.REVIEW) {
       if (template) {
             logger.warn(`[processReviewPrompt] Provided template ID ${template._id} is not a REVIEW template. Using default.`);
        } else {
             logger.debug(`[processReviewPrompt] No template provided. Using default.`);
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

    logger.debug(`[processReviewPrompt] Using template ID: ${template._id}`);
     // Fill placeholders in the user prompt template from the template's content
    const finalUserPrompt = fillPlaceholders(userPromptTemplate, variables);

    return {
        systemPrompt: systemInstruction, // Use the determined system instruction (null in this case)
        userPrompt: finalUserPrompt
    };
}