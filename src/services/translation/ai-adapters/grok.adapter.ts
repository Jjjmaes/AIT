import {
  BaseAIServiceAdapter,
  TranslationResponse,
  ITranslationServiceAdapter,
  ChatMessage,
  ChatCompletionResponse
} from './base.adapter';
import { AIServiceConfig, AIProvider, AIModelInfo } from '../../../types/ai-service.types';
import { TranslationOptions } from '../../../types/translation.types';
import { ProcessedPrompt } from '../../../utils/promptProcessor'; // Assuming this structure is used
import logger from '../../../utils/logger';
import { AppError } from '../../../utils/errors';
// Remove ProxyAgent, use axios and https-proxy-agent
// import { ProxyAgent } from 'proxy-agent'; 
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

// Use a library like axios or node-fetch for making HTTP requests
// For example, if using axios (ensure it's installed):
// import axios from 'axios'; 
// Or use Node's built-in fetch (available in Node 18+)

const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
// --- TEMPORARY DIAGNOSTIC --- 
// const TEST_URL = 'https://www.google.com'; // Use Google for testing - REVERTED
// --- END TEMPORARY DIAGNOSTIC ---
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
    sourceText: string, 
    promptData: ProcessedPrompt,
    options?: TranslationOptions & { model?: string; temperature?: number }
  ): Promise<TranslationResponse> {
    const methodName = 'translateText';
    const modelToUse = options?.aiModel || this.config.defaultModel || DEFAULT_GROK_MODEL;
    const temperature = options?.temperature ?? 0.3; // Default temperature
    const startTime = Date.now();
    // Use Axios timeout parameter, removing manual AbortController
    // const TIMEOUT_MS = 60000; // Timeout handled by Axios
    const AXIOS_TIMEOUT_MS = 120000; // 120 second timeout for Axios

    logger.debug(`[${this.serviceName}.${methodName}] Starting translation with model ${modelToUse}`, { sourceTextLength: sourceText.length });
    logger.debug(`[${this.serviceName}.${methodName}] Prompt Data:`, promptData); // Log prompts

    // Create Agent based on environment variable - USING https-proxy-agent
    const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
    let httpsAgent: HttpsProxyAgent<string> | undefined = undefined;
    if (proxyUrl) {
        // Validate proxy URL format for HttpsProxyAgent
        if (!proxyUrl.startsWith('http://')) {
            logger.warn(`[${this.serviceName}.${methodName}] HTTPS_PROXY URL does not start with 'http://'. HttpsProxyAgent might fail. URL: ${proxyUrl}`);
            // Consider throwing an error or attempting to proceed cautiously.
            // For now, let's try to proceed but log the warning.
        }
        logger.debug(`[${this.serviceName}.${methodName}] Using HTTP proxy for HTTPS request: ${proxyUrl}`);
        httpsAgent = new HttpsProxyAgent(proxyUrl);
    } else {
        logger.debug(`[${this.serviceName}.${methodName}] No HTTPS_PROXY environment variable detected.`);
    }

    const requestBody = {
      messages: [
        ...(promptData.systemPrompt ? [{ role: 'system', content: promptData.systemPrompt }] : []),
        { role: 'user', content: promptData.userPrompt }
      ],
      model: modelToUse,
      temperature: temperature,
      stream: false 
    };

    let axiosResponse: import('axios').AxiosResponse | null = null; // Define type explicitly if needed
    // Remove AbortController as Axios handles timeouts
    // const controller = new AbortController();
    // const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      logger.debug(`[${this.serviceName}.${methodName}] Request Body to Grok:`, requestBody);
      logger.debug(`[${this.serviceName}.${methodName}] Preparing to send request to Grok API via Axios with ${AXIOS_TIMEOUT_MS}ms timeout...`, { url: GROK_API_URL, model: modelToUse, usingProxy: !!proxyUrl });

      // --- Use Axios for the HTTP Request ---           
      axiosResponse = await axios.post(GROK_API_URL, requestBody, {
         headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'Accept': 'application/json' // Good practice to add Accept header
         },
         // Pass the agent if a proxy is configured
         ...(httpsAgent && { httpsAgent: httpsAgent }), 
         // Disable Axios's default proxy env var reading, rely only on the agent
         proxy: false, 
         timeout: AXIOS_TIMEOUT_MS, // Use Axios's timeout
         // signal: controller.signal, // Remove AbortController signal
      });
      // --- End Axios Request ---
      
      logger.debug(`[${this.serviceName}.${methodName}] Axios request completed. Status: ${axiosResponse?.status} ${axiosResponse?.statusText}`);
      // clearTimeout(timeoutId); // Remove manual timeout clear

      // Check if response is null or undefined right away (less likely with Axios successful await)
      if (!axiosResponse) {
          logger.error(`[${this.serviceName}.${methodName}] Axios POST returned null or undefined response object.`);
          throw this.createError('GROK_AXIOS_NULL_RESPONSE', 'Axios POST operation completed but returned a null/undefined response.', null);
      }

      const processingTime = Date.now() - startTime;
      const responseData = axiosResponse.data; // Data is already parsed by Axios

      // Check for logical errors within the response data if needed (based on Grok API docs)
      // Grok might return 200 OK but have an error object in the body
      if (responseData.error) {
          logger.error(`[${this.serviceName}.${methodName}] Grok API returned an error in the response body`, { error: responseData.error });
           throw this.createError(`GROK_API_BODY_ERROR`, `Grok API Error: ${responseData.error.message || 'Unknown error in response body'}`, responseData.error);
      }

      // --- Response Parsing (Simpler with Axios) --- 
      logger.debug(`[${this.serviceName}.${methodName}] Axios response data received.`);
                  
      const translatedText = responseData.choices?.[0]?.message?.content?.trim() || '';
      if (!translatedText) {
         logger.warn(`[${this.serviceName}.${methodName}] Grok response parsed, but missing translated text.`, { responseData });
         // Consider throwing an error if empty translation is unexpected
      }

      const tokenCount = responseData.usage ? { 
          input: responseData.usage.prompt_tokens || 0, 
          output: responseData.usage.completion_tokens || 0, 
          total: responseData.usage.total_tokens || 0
      } : undefined; 
      // --- End Response Parsing --- 

      logger.info(`[${this.serviceName}.${methodName}] Grok translation successful via Axios. Time: ${processingTime}ms`, { tokenCount });

      return {
        translatedText,
        tokenCount,
        processingTime,
        modelInfo: { provider: AIProvider.GROK, model: modelToUse }
      };

    } catch (error: any) {
      // clearTimeout(timeoutId); // Remove manual timeout clear
      const processingTime = Date.now() - startTime;
      
      logger.error(`[${this.serviceName}.${methodName}] RAW ERROR caught in Axios catch block:`, error);

      // Check if it's an Axios error first
      if (axios.isAxiosError(error)) {
        // Handle Axios-specific errors (like timeout, network errors)
        const errorCode = error.code;
        const errorMessage = error.message;
        const responseStatus = error.response?.status;
        const responseData = error.response?.data;
        
        logger.error(`[${this.serviceName}.${methodName}] Error during Grok Axios processing. Time: ${processingTime}ms`, { 
            error: errorMessage,
            errorCode: errorCode,
            responseStatus: responseStatus, 
            responseData: responseData,
            stack: error?.stack 
        });

        if (errorCode === 'ECONNABORTED' || errorCode === 'ETIMEDOUT') {
             throw this.createError('GROK_TIMEOUT', `Request timed out after ${AXIOS_TIMEOUT_MS}ms. Axios Code: ${errorCode}`, error);
        }
        // Handle HTTP error statuses from the API
        if (responseStatus) {
             const apiErrorMessage = responseData?.error?.message || responseData?.message || error.message;
             throw this.createError(`GROK_API_ERROR_${responseStatus}`, `Grok API Error (${responseStatus}): ${apiErrorMessage}`, responseData);
        }
        // Generic Axios/network error
        throw this.createError(errorCode || 'GROK_AXIOS_REQUEST_FAILED', `Axios request failed: ${errorMessage}`, error);

      } else {
         // Handle non-Axios errors (e.g., unexpected errors)
         logger.error(`[${this.serviceName}.${methodName}] Non-Axios error during Grok processing. Time: ${processingTime}ms`, { 
            error: error?.message,
            stack: error?.stack 
         });
         if (error instanceof AppError) {
             throw error; // Re-throw known AppErrors
         }
         // Wrap unknown errors
         throw this.createError('GROK_UNKNOWN_ERROR', `An unexpected error occurred: ${error.message}`, error);
      }
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

  // --- IMPLEMENTED inherited abstract member ---
  async executeChatCompletion(
    messages: ChatMessage[],
    options: { model?: string; temperature?: number; max_tokens?: number }
  ): Promise<ChatCompletionResponse> {
    const methodName = 'executeChatCompletion';
    const modelToUse = options?.model || this.config.defaultModel || DEFAULT_GROK_MODEL;
    const temperature = options?.temperature ?? 0.3;
    const maxTokens = options?.max_tokens; // Optional max_tokens
    const startTime = Date.now();
    // Use Axios timeout parameter, removing manual AbortController
    // const TIMEOUT_MS = 60000; // Timeout handled by Axios
    // --- FIX: Increase Axios timeout to 120 seconds ---
    const AXIOS_TIMEOUT_MS = 120000; // 120 second timeout
    // const AXIOS_TIMEOUT_MS = 60000; // Original 60 second timeout

    logger.debug(`[${this.serviceName}.${methodName}] Starting chat completion with model ${modelToUse}`, { messageCount: messages.length });

    const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
    let httpsAgent: HttpsProxyAgent<string> | undefined = undefined;
    if (proxyUrl) {
        if (!proxyUrl.startsWith('http://')) {
            logger.warn(`[${this.serviceName}.${methodName}] HTTPS_PROXY URL does not start with 'http://'. HttpsProxyAgent might fail. URL: ${proxyUrl}`);
        }
        logger.debug(`[${this.serviceName}.${methodName}] Using HTTP proxy for HTTPS request: ${proxyUrl}`);
        httpsAgent = new HttpsProxyAgent(proxyUrl);
    } else {
        logger.debug(`[${this.serviceName}.${methodName}] No HTTPS_PROXY environment variable detected.`);
    }

    const requestBody: any = {
      messages: messages, // Use the provided messages array
      model: modelToUse,
      temperature: temperature,
      stream: false
    };

    // Add max_tokens if provided
    if (maxTokens !== undefined) {
        requestBody.max_tokens = maxTokens;
    }

    let axiosResponse: import('axios').AxiosResponse | null = null;

    try {
      logger.debug(`[${this.serviceName}.${methodName}] Request Body to Grok:`, requestBody);
      logger.debug(`[${this.serviceName}.${methodName}] Sending chat completion request to Grok API via Axios...`, { url: GROK_API_URL, model: modelToUse, usingProxy: !!proxyUrl });

      axiosResponse = await axios.post(GROK_API_URL, requestBody, {
         headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'Accept': 'application/json'
         },
         ...(httpsAgent && { httpsAgent: httpsAgent }),
         proxy: false,
         timeout: AXIOS_TIMEOUT_MS,
      });

      logger.debug(`[${this.serviceName}.${methodName}] Axios request completed. Status: ${axiosResponse?.status} ${axiosResponse?.statusText}`);

      if (!axiosResponse) {
          logger.error(`[${this.serviceName}.${methodName}] Axios POST returned null or undefined response object.`);
          throw this.createError('GROK_CHAT_AXIOS_NULL_RESPONSE', 'Axios POST operation completed but returned a null/undefined response.', null);
      }

      const responseData = axiosResponse.data;

      if (responseData.error) {
          logger.error(`[${this.serviceName}.${methodName}] Grok API returned an error in the response body`, { error: responseData.error });
           throw this.createError(`GROK_CHAT_API_BODY_ERROR`, `Grok API Error: ${responseData.error.message || 'Unknown error in response body'}`, responseData.error);
      }

      const content = responseData.choices?.[0]?.message?.content?.trim() || null;
      const usage = responseData.usage ? {
          prompt_tokens: responseData.usage.prompt_tokens || 0,
          completion_tokens: responseData.usage.completion_tokens || 0,
          total_tokens: responseData.usage.total_tokens || 0
      } : undefined;

      logger.info(`[${this.serviceName}.${methodName}] Grok chat completion successful. Time: ${Date.now() - startTime}ms`, { usage });

      return {
        content: content,
        usage: usage,
        model: responseData.model || modelToUse, // Prefer model from response if available
      };

    } catch (error: any) {
       const processingTime = Date.now() - startTime;
       logger.error(`[${this.serviceName}.${methodName}] RAW ERROR caught in chat completion Axios catch block:`, error);

       if (axios.isAxiosError(error)) {
         const errorCode = error.code;
         const errorMessage = error.message;
         const responseStatus = error.response?.status;
         const responseData = error.response?.data;

         logger.error(`[${this.serviceName}.${methodName}] Error during Grok Axios chat completion. Time: ${processingTime}ms`, {
             error: errorMessage,
             errorCode: errorCode,
             responseStatus: responseStatus,
             responseData: responseData,
             stack: error?.stack
         });

         let appErrorCode: string;
         let appErrorMessage: string;

         if (errorCode === 'ECONNABORTED' || errorCode === 'ETIMEDOUT') {
            appErrorCode = 'GROK_CHAT_TIMEOUT';
            appErrorMessage = `Request timed out after ${AXIOS_TIMEOUT_MS}ms. Axios Code: ${errorCode}`;
         } else if (responseStatus) {
            const apiErrorMessage = responseData?.error?.message || responseData?.message || error.message;
            appErrorCode = `GROK_CHAT_API_ERROR_${responseStatus}`;
            appErrorMessage = `Grok API Error (${responseStatus}): ${apiErrorMessage}`;
         } else {
            appErrorCode = errorCode || 'GROK_CHAT_AXIOS_REQUEST_FAILED';
            appErrorMessage = `Axios request failed: ${errorMessage}`;
         }
         throw this.createError(appErrorCode, appErrorMessage, error);

       } else {
          logger.error(`[${this.serviceName}.${methodName}] Non-Axios error during Grok chat completion. Time: ${processingTime}ms`, {
             error: error?.message,
             stack: error?.stack
          });
          if (error instanceof AppError) {
              throw error;
          }
          throw this.createError('GROK_CHAT_UNKNOWN_ERROR', `An unexpected error occurred: ${error.message}`, error);
       }
    }
  }
  // --- END Implementation ---
} 