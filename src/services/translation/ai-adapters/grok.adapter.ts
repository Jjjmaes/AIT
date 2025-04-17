import {
  BaseAIServiceAdapter,
  TranslationResponse,
  ITranslationServiceAdapter // Ensure this or BaseAIServiceAdapter covers all needed methods
} from './base.adapter';
import { AIServiceConfig, AIProvider, AIModelInfo } from '../../../types/ai-service.types';
import { TranslationOptions } from '../../../types/translation.types';
import { ProcessedPrompt } from '../../../utils/promptProcessor'; // Assuming this structure is used
import logger from '../../../utils/logger';
import { AppError } from '../../../utils/errors';

// Use a library like axios or node-fetch for making HTTP requests
// For example, if using axios (ensure it's installed):
// import axios from 'axios'; 
// Or use Node's built-in fetch (available in Node 18+)

const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
const DEFAULT_GROK_MODEL = 'grok-3-latest'; // Or choose another default

export class GrokAdapter extends BaseAIServiceAdapter implements ITranslationServiceAdapter {
  private apiKey: string;
  private serviceName = 'GrokAdapter';

  constructor(config: AIServiceConfig) {
    // Ensure provider is set correctly, maybe default to GROK if not provided?
    super({ ...config, provider: AIProvider.GROK }); 
    if (!config.apiKey) {
      throw new AppError('Grok API key is missing in the configuration.', 500);
    }
    this.apiKey = config.apiKey;
    logger.info(`[${this.serviceName}] Initialized with API Key (masked): ****${config.apiKey.slice(-4)}`);
  }

  async translateText(
    sourceText: string, // Note: Base class expects promptData, not sourceText directly here typically
    promptData: ProcessedPrompt,
    options?: TranslationOptions & { model?: string; temperature?: number }
  ): Promise<TranslationResponse> {
    const methodName = 'translateText';
    const modelToUse = options?.aiModel || this.config.defaultModel || DEFAULT_GROK_MODEL;
    const temperature = options?.temperature ?? 0.3; // Default temperature
    const startTime = Date.now();
    const TIMEOUT_MS = 30000; // 30 second timeout

    logger.debug(`[${this.serviceName}.${methodName}] Starting translation with model ${modelToUse}`, { sourceTextLength: sourceText.length });
    logger.debug(`[${this.serviceName}.${methodName}] Prompt Data:`, promptData); // Log prompts

    const requestBody = {
      messages: [
        // Use system prompt from promptData if available
        ...(promptData.systemPrompt ? [{ role: 'system', content: promptData.systemPrompt }] : []), 
        { role: 'user', content: promptData.userPrompt } // User prompt contains the text to translate
      ],
      model: modelToUse,
      temperature: temperature,
      stream: false // Assuming non-streaming for translation
    };

    let response: Response | null = null; 
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      // Log the request body just before sending
      logger.debug(`[${this.serviceName}.${methodName}] Request Body to Grok:`, requestBody);

      logger.debug(`[${this.serviceName}.${methodName}] Preparing to send request to Grok API with ${TIMEOUT_MS}ms timeout...`, { url: GROK_API_URL, model: modelToUse });
      
      // --- HTTP Request Logic ---           
      response = await fetch(GROK_API_URL, { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal // Add the AbortSignal for timeout
      });
      
      clearTimeout(timeoutId); // Clear the timeout if fetch completes

      logger.debug(`[${this.serviceName}.${methodName}] Received response from Grok API. Status: ${response.status} ${response.statusText}`);

      const processingTime = Date.now() - startTime;

      let responseData: any; // To hold the parsed JSON
      if (!response.ok) {
        let errorBodyText = 'Failed to read error body';
        try {
           errorBodyText = await response.text(); // Try to get raw text body for errors
        } catch (textError) {
           logger.warn(`[${this.serviceName}.${methodName}] Could not read text body of error response.`, textError);
        }
        logger.error(`[${this.serviceName}.${methodName}] Grok API request failed`, { status: response.status, statusText: response.statusText, body: errorBodyText });
        // Attempt to parse as JSON anyway, in case it contains structured error info
        try { responseData = JSON.parse(errorBodyText); } catch { responseData = null; }
        throw this.createError(`GROK_API_ERROR_${response.status}`, `Grok API Error (${response.status}): ${responseData?.error?.message || response.statusText}`, responseData);
      }
      
      // --- Response Parsing --- 
      logger.debug(`[${this.serviceName}.${methodName}] Attempting to parse JSON response...`);
      try {
          responseData = await response.json();
      } catch (parseError: any) {
           logger.error(`[${this.serviceName}.${methodName}] Failed to parse JSON response from Grok API.`, { error: parseError });
           // Attempt to read raw text if JSON parsing fails
           let rawBody = 'Failed to read raw body after JSON parse failure.';
            try {
                // Need to clone the response to read body again if needed, but response is already potentially consumed or errored.
                // Best effort: log the error and throw.
            } catch (e) {}
           throw this.createError('GROK_RESPONSE_PARSE_ERROR', `Failed to parse JSON response: ${parseError.message}`, { originalError: parseError });
      }
      logger.debug(`[${this.serviceName}.${methodName}] Successfully parsed JSON response.`);
            
      const translatedText = responseData.choices?.[0]?.message?.content?.trim() || '';
      if (!translatedText) {
         logger.warn(`[${this.serviceName}.${methodName}] Grok response parsed, but missing translated text.`, { responseData });
      }

      const tokenCount = responseData.usage ? { 
          input: responseData.usage.prompt_tokens || 0, 
          output: responseData.usage.completion_tokens || 0, 
          total: responseData.usage.total_tokens || 0
      } : undefined; 
      // --- End Response Parsing --- 

      logger.info(`[${this.serviceName}.${methodName}] Grok translation successful. Time: ${processingTime}ms`, { tokenCount });

      return {
        translatedText,
        tokenCount,
        processingTime,
        modelInfo: { provider: AIProvider.GROK, model: modelToUse }
      };

    } catch (error: any) {
      clearTimeout(timeoutId); // Clear timeout in case of error too
      const processingTime = Date.now() - startTime;
      
      // Log the raw error object FIRST
      logger.error(`[${this.serviceName}.${methodName}] RAW ERROR caught in catch block:`, error);

      // Check if the error is due to the abort signal (timeout)
      if (error.name === 'AbortError') {
           logger.error(`[${this.serviceName}.${methodName}] Grok API request timed out after ${TIMEOUT_MS}ms.`);
           // Include original error details in the thrown AppError
           throw this.createError('GROK_TIMEOUT', `Request timed out after ${TIMEOUT_MS}ms. Cause: ${error.message}`, error);
      }
      
      // Log other errors
      logger.error(`[${this.serviceName}.${methodName}] Error during Grok processing. Time: ${processingTime}ms`, { 
          error: error?.message,
          errorCode: error?.code,
          responseStatus: response?.status, 
          // Add cause if available (common in fetch errors)
          cause: error?.cause,
          stack: error?.stack 
      });

      if (error instanceof AppError) {
          throw error; 
      }
      
      // Construct a more detailed error message including the original error's message and cause
      const originalErrorMessage = error?.message || 'Unknown error';
      const originalErrorCause = error?.cause ? ` Cause: ${JSON.stringify(error.cause)}` : '';
      const finalErrorMessage = `Failed to translate using Grok: ${originalErrorMessage}${originalErrorCause}`;
      
      throw this.createError(error.code || 'GROK_REQUEST_FAILED', finalErrorMessage, error);
    }
  }

  // TODO: Implement actual API key validation if Grok provides an endpoint
  async validateApiKey(): Promise<boolean> {
    logger.warn(`[${this.serviceName}] validateApiKey() is not implemented for Grok. Returning true.`);
    // Placeholder: Assume valid for now
    // You might call a simple API endpoint like listing models
    return true; 
  }

  // TODO: Implement actual model fetching if Grok provides an endpoint
  async getAvailableModels(): Promise<AIModelInfo[]> {
     logger.warn(`[${this.serviceName}] getAvailableModels() is not implemented for Grok. Returning default.`);
    // Placeholder: Return default or known models
    return [
      { id: DEFAULT_GROK_MODEL, name: DEFAULT_GROK_MODEL, provider: AIProvider.GROK, /* add other fields if known */ } as AIModelInfo
    ];
  }
} 