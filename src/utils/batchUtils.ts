import { encoding_for_model, Tiktoken, TiktokenModel } from "tiktoken";
import { ISegment } from '../models/segment.model'; // Assuming ISegment has index and sourceText
import logger from './logger';
import { Types } from 'mongoose';
// --- Import necessary types and functions ---
import { PromptBuildContext } from './promptProcessor'; // For context type
import { PromptTemplate, IPromptTemplate, PromptTemplateType } from '../models/promptTemplate.model'; // For template model
import { fillPlaceholders } from './promptProcessor'; // For substituting variables

// --- Token Counting Utility ---

// Cache the encoder instance
let enc: Tiktoken | null = null;

/**
 * Gets the Tiktoken encoder for the specified model (or GPT-4 default).
 * Caches the encoder instance for performance.
 * @param modelName - The model name compatible with tiktoken (e.g., "gpt-4", "gpt-3.5-turbo"). Defaults to "gpt-4".
 * @returns The Tiktoken encoder instance.
 */
function getEncoder(modelName: TiktokenModel = "gpt-4"): Tiktoken {
  if (!enc) {
    try {
      // Grok and potentially other models might be compatible with gpt-4 tokenizer
      // Make the model configurable if needed in the future
      enc = encoding_for_model(modelName);
      logger.info(`[batchUtils] Tiktoken encoder initialized for model: ${modelName}`);
    } catch (e) {
      logger.error(`[batchUtils] Failed to initialize Tiktoken encoder for model ${modelName}. Falling back to gpt-4.`, e);
      // Fallback or handle error appropriately
      enc = encoding_for_model("gpt-4");
    }
  }
  return enc;
}

/**
 * Calculates the number of tokens for a given text using the specified model's tokenizer.
 * @param text - The text to count tokens for.
 * @param modelName - The model name compatible with tiktoken.
 * @returns The number of tokens.
 */
export function tokenCount(text: string, modelName: TiktokenModel = "gpt-4"): number {
  if (!text) {
    return 0;
  }
  try {
    const encoder = getEncoder(modelName);
    return encoder.encode(text).length;
  } catch (e) {
      logger.error(`[batchUtils.tokenCount] Error encoding text: "${text.substring(0, 50)}..."`, e);
      // Fallback strategy: estimate based on characters?
      return Math.ceil(text.length / 3); // Rough estimate
  }
}

// --- Segment Batch Splitting Utility ---

// Define a clearer interface for segments used in batching
export interface BatchSegment extends Pick<ISegment, 'sourceText' | '_id'> {
    index: number; // Ensure index is present and is a number
    fileId?: Types.ObjectId; // Optional: Needed for project-level grouping/updates
}


const SEGMENT_SEPARATOR = '\\n\\n'; // Separator between segments in the user prompt
const SEGMENT_TAG_PREFIX = '[SEG';
const SEGMENT_TAG_SUFFIX = ']\\n';

/**
 * Splits segments into batches based on a maximum token limit for the combined prompt.
 * Considers the system prompt tokens and the tokens of each segment formatted with its tag.
 * @param segments - Array of segments to batch, MUST be sorted by index and have index/sourceText.
 * @param systemPrompt - The system prompt string.
 * @param maxInputTokens - The maximum allowed tokens for systemPrompt + userPrompt.
 * @param modelName - The model name for token counting.
 * @returns An array of segment batches.
 */
export function splitSegmentsByTokenLimit(
    segments: BatchSegment[],
    systemPrompt: string,
    maxInputTokens: number = 96000, // Default based on GPT-4o, adjust as needed
    modelName: TiktokenModel = "gpt-4"
): BatchSegment[][] {
    const systemTokens = tokenCount(systemPrompt, modelName);
    const separatorTokens = tokenCount(SEGMENT_SEPARATOR, modelName);
    const batches: BatchSegment[][] = [];
    let currentBatch: BatchSegment[] = [];
    // Start with system tokens + tokens for the first segment's tag and separator (approximated)
    let currentTokens = systemTokens;
    let isFirstSegmentInBatch = true;

    if (systemTokens > maxInputTokens) {
        logger.error(`[batchUtils.split] System prompt alone (${systemTokens} tokens) exceeds max token limit (${maxInputTokens}). Cannot process.`);
        // Maybe throw an error?
        return []; // Cannot form any valid batch
    }

    for (const seg of segments) {
        // Format the text exactly as it will appear in the user prompt for accurate counting
        const thisSegTag = `${SEGMENT_TAG_PREFIX}${seg.index}${SEGMENT_TAG_SUFFIX}`;
        const thisSegText = `${thisSegTag}${seg.sourceText}`;
        const thisSegTokens = tokenCount(thisSegText, modelName);

        // Calculate tokens needed if this segment is added
        // Add separator tokens only if it's not the very first segment in the batch
        const additionalTokens = (isFirstSegmentInBatch ? 0 : separatorTokens) + thisSegTokens;

        if (currentTokens + additionalTokens > maxInputTokens) {
            // Current batch is full (or this segment is too large to fit), push current batch
            if (currentBatch.length > 0) {
                batches.push(currentBatch);
                logger.debug(`[batchUtils.split] Batch created with ${currentBatch.length} segments, approx ${currentTokens} tokens.`);
            } else if (additionalTokens > maxInputTokens) {
                // Single segment itself (with system prompt) is too large
                 logger.error(`[batchUtils.split] Segment index ${seg.index} (${thisSegTokens} tokens) with system prompt (${systemTokens} tokens) exceeds max token limit (${maxInputTokens}). Skipping segment.`);
                 // TODO: How to handle segments that are too large on their own? Mark as error?
                 continue; // Skip this segment
            }

            // Start a new batch with the current segment
            currentBatch = [seg];
            currentTokens = systemTokens + thisSegTokens; // Reset token count for the new batch
            isFirstSegmentInBatch = false; // It's the first, but separator logic applies to the *next* one
        } else {
            // Add segment to the current batch
            currentBatch.push(seg);
            currentTokens += additionalTokens;
            isFirstSegmentInBatch = false;
        }
    }

    // Push the last remaining batch if it's not empty
    if (currentBatch.length > 0) {
        batches.push(currentBatch);
        logger.debug(`[batchUtils.split] Final batch created with ${currentBatch.length} segments, approx ${currentTokens} tokens.`);
    }

    logger.info(`[batchUtils.split] Split ${segments.length} segments into ${batches.length} batches based on ${maxInputTokens} token limit.`);
    return batches;
}


// --- Prompt Building Utility ---

// Define a default user prompt template if a custom one isn't found or valid
// (Similar to the one in promptProcessor, but maybe simpler for batch context)
const DEFAULT_BATCH_USER_PROMPT = `Translate the following text segments from {{sourceLang}} to {{targetLang}}. Maintain the original [SEG#] tags for each segment.
Domain: {{domain}}
Terminology: {{terms}}

{{sourceText}}`; // {{sourceText}} will hold the formatted segments

// Interface for variables used in placeholder filling
interface VariableMap {
  [key: string]: string | number | undefined;
}

/**
 * Builds the user prompt string for a batch of segments, incorporating context and custom templates.
 * @param segments - A batch of segments.
 * @param context - The PromptBuildContext containing languages, domain, template ID, terms.
 * @returns The final user prompt string ready for the AI.
 */
export async function buildSegmentedUserPrompt(
    segments: BatchSegment[],
    context: PromptBuildContext
): Promise<string> { // <-- Make async to fetch template
    const methodName = 'buildSegmentedUserPrompt';
    logger.debug(`[batchUtils.${methodName}] ENTER - Building user prompt for ${segments.length} segments. Context:`, { ...context, terms: context.terms ? `${context.terms.length} terms` : 'None' }); // Avoid logging full terms

    let userPromptTemplate: string = DEFAULT_BATCH_USER_PROMPT;
    let templateFoundAndUsed = false;

    // 1. Fetch Custom Template if ID exists
    if (context.promptTemplateId) {
        try {
            const template: IPromptTemplate | null = await PromptTemplate.findById(context.promptTemplateId).exec();
            if (template && template.type === PromptTemplateType.TRANSLATION && template.content) {
                userPromptTemplate = template.content;
                templateFoundAndUsed = true;
                logger.debug(`[batchUtils.${methodName}] Using custom template ID: ${context.promptTemplateId}`);
            } else if (template) {
                logger.warn(`[batchUtils.${methodName}] Template ${context.promptTemplateId} found but is not a Translation template or has no content. Using default.`);
            } else {
                logger.warn(`[batchUtils.${methodName}] Template ID ${context.promptTemplateId} provided but not found. Using default.`);
            }
        } catch (error) {
            logger.error(`[batchUtils.${methodName}] Error fetching template ${context.promptTemplateId}. Using default.`, error);
        }
    } else {
         logger.debug(`[batchUtils.${methodName}] No custom template ID provided. Using default.`);
    }

    // 2. Format the batch of segments with [SEG#] tags, stripping XML-like tags and braces
    const formattedSegmentsText = segments
        .map(s => {
            // --- Log raw source text before cleaning ---
            logger.debug(`[batchUtils] Raw sourceText for index ${s.index}: "${s.sourceText}"`);
            // --- Reverted: Only Strip XML-like tags, keep {} braces ---
            const cleanedSourceText = s.sourceText.replace(/<[^>]*>/g, ''); // REMOVED .replace(/{}/g, '')
            logger.debug(`[batchUtils] Cleaned sourceText for index ${s.index}: "${cleanedSourceText}"`);
            // --------------------------------------------------
            return `${SEGMENT_TAG_PREFIX}${s.index}${SEGMENT_TAG_SUFFIX}${cleanedSourceText}`;
        })
        .join(SEGMENT_SEPARATOR);
        
    // 3. Prepare Variables for Placeholder Filling
    const variables: VariableMap = {
        sourceLang: context.sourceLanguage,
        targetLang: context.targetLanguage,
        domain: context.domain || 'general',
        // Format terms for inclusion in the prompt (simple example)
        terms: context.terms?.map(t => `${t.source}=${t.target}`).join('; ') || 'None provided',
        // The placeholder for the actual text to translate is {{sourceText}}
        sourceText: formattedSegmentsText
        // Add any other variables your templates might expect from the context
    };

    // 4. Fill Placeholders in the chosen template
    logger.debug(`[batchUtils.${methodName}] Filling placeholders in ${templateFoundAndUsed ? 'custom' : 'default'} template.`);
    const finalUserPrompt = fillPlaceholders(userPromptTemplate, variables);

    logger.debug(`[batchUtils.${methodName}] EXIT - Final user prompt length: ${finalUserPrompt.length}`);
    return finalUserPrompt;
}


// --- Response Parsing Utility ---

export type ParsedTranslationMap = { [key: number]: string };

/**
 * Parses the AI's output text containing multiple translated segments marked with [SEG#].
 * @param outputText - The raw output text from the AI.
 * @returns A map where keys are segment indices (number) and values are translated strings.
 */
export function parseTranslatedSegments(outputText: string): ParsedTranslationMap {
  const result: ParsedTranslationMap = {};
  // Improved Regex: Handles potential whitespace variations and captures content robustly.
  // Looks for [SEG<digits>] followed by optional whitespace, then captures everything
  // until the next [SEG or the end of the string. Uses non-greedy matching ([\s\S]*?).
  const regex = /\[SEG(\d+)\]\s*([\s\S]*?)(?=\[SEG\d+\]\s*| *$)/g;
  let match;

  if (!outputText) {
      logger.warn("[batchUtils.parse] Received empty or null outputText to parse.");
      return result;
  }

  try {
      while ((match = regex.exec(outputText)) !== null) {
        // Match[1] is the index (digits)
        // Match[2] is the captured translation text
        const index = parseInt(match[1], 10);
        // Trim whitespace, newlines from start/end of the captured translation
        const translation = match[2]?.trim() || '';
        if (!isNaN(index)) {
            if (result[index]) {
                 logger.warn(`[batchUtils.parse] Duplicate index ${index} found in AI output. Overwriting previous value. Text: "${translation.substring(0,50)}..."`);
            }
            result[index] = translation;
        } else {
             logger.warn(`[batchUtils.parse] Failed to parse index from match: ${match[0]}`);
        }
      }
  } catch (e) {
       logger.error("[batchUtils.parse] Error during regex execution:", e);
       // Depending on the error, maybe return partial results or empty?
  }

  const foundIndices = Object.keys(result).length;
  if (foundIndices === 0 && outputText.length > 0) {
      logger.warn(`[batchUtils.parse] Parsing finished but found 0 segments in non-empty output. AI output might be malformed. Output starts: "${outputText.substring(0, 100)}..."`);
      // Consider returning the whole output as an error indicator?
  } else {
      logger.debug(`[batchUtils.parse] Parsed ${foundIndices} segments from AI output.`);
  }

  return result;
} 