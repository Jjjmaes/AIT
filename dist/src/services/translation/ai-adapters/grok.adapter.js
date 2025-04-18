"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GrokAdapter = void 0;
const base_adapter_1 = require("./base.adapter");
const ai_service_types_1 = require("../../../types/ai-service.types");
const logger_1 = __importDefault(require("../../../utils/logger"));
const errors_1 = require("../../../utils/errors");
// Remove ProxyAgent, use axios and https-proxy-agent
// import { ProxyAgent } from 'proxy-agent'; 
const axios_1 = __importDefault(require("axios"));
const https_proxy_agent_1 = require("https-proxy-agent");
// Use a library like axios or node-fetch for making HTTP requests
// For example, if using axios (ensure it's installed):
// import axios from 'axios'; 
// Or use Node's built-in fetch (available in Node 18+)
const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
// --- TEMPORARY DIAGNOSTIC --- 
// const TEST_URL = 'https://www.google.com'; // Use Google for testing - REVERTED
// --- END TEMPORARY DIAGNOSTIC ---
const DEFAULT_GROK_MODEL = 'grok-3-latest'; // Or choose another default
class GrokAdapter extends base_adapter_1.BaseAIServiceAdapter {
    constructor(config) {
        // Ensure provider is set correctly, maybe default to GROK if not provided?
        super({ ...config, provider: ai_service_types_1.AIProvider.GROK });
        this.serviceName = 'GrokAdapter';
        if (!config.apiKey) {
            throw new errors_1.AppError('Grok API key is missing in the configuration.', 500);
        }
        this.apiKey = config.apiKey;
        logger_1.default.info(`[${this.serviceName}] Initialized with API Key (masked): ****${config.apiKey.slice(-4)}`);
    }
    async translateText(sourceText, promptData, options) {
        const methodName = 'translateText';
        const modelToUse = options?.aiModel || this.config.defaultModel || DEFAULT_GROK_MODEL;
        const temperature = options?.temperature ?? 0.3; // Default temperature
        const startTime = Date.now();
        // Use Axios timeout parameter, removing manual AbortController
        // const TIMEOUT_MS = 60000; // Timeout handled by Axios
        const AXIOS_TIMEOUT_MS = 60000; // 60 second timeout for Axios
        logger_1.default.debug(`[${this.serviceName}.${methodName}] Starting translation with model ${modelToUse}`, { sourceTextLength: sourceText.length });
        logger_1.default.debug(`[${this.serviceName}.${methodName}] Prompt Data:`, promptData); // Log prompts
        // Create Agent based on environment variable - USING https-proxy-agent
        const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
        let httpsAgent = undefined;
        if (proxyUrl) {
            // Validate proxy URL format for HttpsProxyAgent
            if (!proxyUrl.startsWith('http://')) {
                logger_1.default.warn(`[${this.serviceName}.${methodName}] HTTPS_PROXY URL does not start with 'http://'. HttpsProxyAgent might fail. URL: ${proxyUrl}`);
                // Consider throwing an error or attempting to proceed cautiously.
                // For now, let's try to proceed but log the warning.
            }
            logger_1.default.debug(`[${this.serviceName}.${methodName}] Using HTTP proxy for HTTPS request: ${proxyUrl}`);
            httpsAgent = new https_proxy_agent_1.HttpsProxyAgent(proxyUrl);
        }
        else {
            logger_1.default.debug(`[${this.serviceName}.${methodName}] No HTTPS_PROXY environment variable detected.`);
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
        let axiosResponse = null; // Define type explicitly if needed
        // Remove AbortController as Axios handles timeouts
        // const controller = new AbortController();
        // const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
            logger_1.default.debug(`[${this.serviceName}.${methodName}] Request Body to Grok:`, requestBody);
            logger_1.default.debug(`[${this.serviceName}.${methodName}] Preparing to send request to Grok API via Axios with ${AXIOS_TIMEOUT_MS}ms timeout...`, { url: GROK_API_URL, model: modelToUse, usingProxy: !!proxyUrl });
            // --- Use Axios for the HTTP Request ---           
            axiosResponse = await axios_1.default.post(GROK_API_URL, requestBody, {
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
            logger_1.default.debug(`[${this.serviceName}.${methodName}] Axios request completed. Status: ${axiosResponse?.status} ${axiosResponse?.statusText}`);
            // clearTimeout(timeoutId); // Remove manual timeout clear
            // Check if response is null or undefined right away (less likely with Axios successful await)
            if (!axiosResponse) {
                logger_1.default.error(`[${this.serviceName}.${methodName}] Axios POST returned null or undefined response object.`);
                throw this.createError('GROK_AXIOS_NULL_RESPONSE', 'Axios POST operation completed but returned a null/undefined response.', null);
            }
            const processingTime = Date.now() - startTime;
            const responseData = axiosResponse.data; // Data is already parsed by Axios
            // Check for logical errors within the response data if needed (based on Grok API docs)
            // Grok might return 200 OK but have an error object in the body
            if (responseData.error) {
                logger_1.default.error(`[${this.serviceName}.${methodName}] Grok API returned an error in the response body`, { error: responseData.error });
                throw this.createError(`GROK_API_BODY_ERROR`, `Grok API Error: ${responseData.error.message || 'Unknown error in response body'}`, responseData.error);
            }
            // --- Response Parsing (Simpler with Axios) --- 
            logger_1.default.debug(`[${this.serviceName}.${methodName}] Axios response data received.`);
            const translatedText = responseData.choices?.[0]?.message?.content?.trim() || '';
            if (!translatedText) {
                logger_1.default.warn(`[${this.serviceName}.${methodName}] Grok response parsed, but missing translated text.`, { responseData });
                // Consider throwing an error if empty translation is unexpected
            }
            const tokenCount = responseData.usage ? {
                input: responseData.usage.prompt_tokens || 0,
                output: responseData.usage.completion_tokens || 0,
                total: responseData.usage.total_tokens || 0
            } : undefined;
            // --- End Response Parsing --- 
            logger_1.default.info(`[${this.serviceName}.${methodName}] Grok translation successful via Axios. Time: ${processingTime}ms`, { tokenCount });
            return {
                translatedText,
                tokenCount,
                processingTime,
                modelInfo: { provider: ai_service_types_1.AIProvider.GROK, model: modelToUse }
            };
        }
        catch (error) {
            // clearTimeout(timeoutId); // Remove manual timeout clear
            const processingTime = Date.now() - startTime;
            logger_1.default.error(`[${this.serviceName}.${methodName}] RAW ERROR caught in Axios catch block:`, error);
            // Check if it's an Axios error first
            if (axios_1.default.isAxiosError(error)) {
                // Handle Axios-specific errors (like timeout, network errors)
                const errorCode = error.code;
                const errorMessage = error.message;
                const responseStatus = error.response?.status;
                const responseData = error.response?.data;
                logger_1.default.error(`[${this.serviceName}.${methodName}] Error during Grok Axios processing. Time: ${processingTime}ms`, {
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
            }
            else {
                // Handle non-Axios errors (e.g., unexpected errors)
                logger_1.default.error(`[${this.serviceName}.${methodName}] Non-Axios error during Grok processing. Time: ${processingTime}ms`, {
                    error: error?.message,
                    stack: error?.stack
                });
                if (error instanceof errors_1.AppError) {
                    throw error; // Re-throw known AppErrors
                }
                // Wrap unknown errors
                throw this.createError('GROK_UNKNOWN_ERROR', `An unexpected error occurred: ${error.message}`, error);
            }
        }
    }
    // TODO: Implement actual API key validation if Grok provides an endpoint
    async validateApiKey() {
        logger_1.default.warn(`[${this.serviceName}] validateApiKey() is not implemented for Grok. Returning true.`);
        // Placeholder: Assume valid for now
        // You might call a simple API endpoint like listing models
        return true;
    }
    // TODO: Implement actual model fetching if Grok provides an endpoint
    async getAvailableModels() {
        logger_1.default.warn(`[${this.serviceName}] getAvailableModels() is not implemented for Grok. Returning default.`);
        // Placeholder: Return default or known models
        return [
            { id: DEFAULT_GROK_MODEL, name: DEFAULT_GROK_MODEL, provider: ai_service_types_1.AIProvider.GROK, /* add other fields if known */ }
        ];
    }
}
exports.GrokAdapter = GrokAdapter;
