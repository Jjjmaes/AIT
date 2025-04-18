import { Inject, Service } from 'typedi';
// Import only the instance 
import { aiServiceFactory } from './aiServiceFactory'; 
import { TranslationOptions } from '../../types/translation.types';
import { AIServiceConfig, AIProvider, AIServiceResponse, AIModelInfo } from '../../types/ai-service.types';
import logger from '../../utils/logger';
import { Segment, ISegment, SegmentStatus } from '../../models/segment.model';
import { Types } from 'mongoose';
import { AppError } from '../../utils/errors';
import { encoding_for_model, TiktokenModel } from 'tiktoken';
import { ITranslationServiceAdapter, ChatMessage } from './ai-adapters/base.adapter';
// Assume aiConfigService exists and is importable
import { AIConfigService } from '../aiConfig.service'; // Corrected path
// Assume IAIProviderConfig type exists - corrected to IAIProviderConfig
import { IAIProviderConfig } from '../../models/aiConfig.model'; // Corrected path
import { ProjectService } from '../project.service'; // Corrected path
import { handleServiceError, validateId, validateEntityExists } from '../../utils/errorHandler'; // Corrected path
import { ValidationError } from '../../utils/errors'; // Corrected path (Already corrected above, but keep for consistency)
import { AIServiceFactory } from './ai-adapters/ai-service.factory'; // Corrected path
import { SegmentService } from '../segment.service'; // Corrected path
import { TerminologyService } from '../terminology.service'; // Corrected path
import { TranslationMemoryService } from '../translationMemory.service'; // Corrected path
import { ITermEntry } from '../../models/terminology.model'; // Corrected path

// Comment out problematic imports
// import { CacheService } from '../cache.service'; 
// import { PerformanceMonitor } from '../performance.monitor'; 

type CacheService = any; // Placeholder
type PerformanceMonitor = any; // Placeholder

// Constants for batching 
const DEFAULT_MAX_INPUT_TOKENS = 96000; 
const DEFAULT_MODEL_FOR_TOKEN_COUNT: TiktokenModel = 'gpt-4'; 

@Service()
export class TranslationService {
  // Remove @Inject, use direct assignment in constructor
  private aiServiceFactory: typeof aiServiceFactory;

  // Comment out injections
  private cacheService?: CacheService; 
  private performanceMonitor?: PerformanceMonitor;

  constructor(
    // Inject AIConfigService
    @Inject() private aiConfigService: AIConfigService 
  ) {
    // Assign the imported instance
    this.aiServiceFactory = aiServiceFactory; 
  }

  // REMOVE OLD translateMultipleSegments and related methods
  /*
  async translateMultipleSegments(segments: string[], options: TranslationOptions): Promise<{ 
    // ... old implementation ...
  }> {
    // ... old implementation code from lines ~56 to ~209 ...
  }

  async validateApiKey(): Promise<boolean> {
    // ... old implementation ...
  }

  async getAvailableModels(): Promise<string[]> {
     // ... old implementation ...
  }

  private generateCacheKey(sourceText: string, options: TranslationOptions): string {
     // ... old implementation ...
  }

  async shutdown(): Promise<void> {
     // ... old implementation ...
  }

  public getPerformanceMetrics() {
     // ... old implementation ...
  }

  public getTaskMetrics() {
    // ... old implementation ...
  }
  */

  // --- Helper Functions --- (Keep these)

  private getTokenCount(text: string, model: TiktokenModel = DEFAULT_MODEL_FOR_TOKEN_COUNT): number {
    try {
      const encoder = encoding_for_model(model);
      const tokens = encoder.encode(text).length;
      encoder.free(); 
      return tokens;
    } catch (error) {
      logger.warn('Tiktoken calculation failed, falling back to estimation', { error, model });
      return Math.ceil(text.length / 4);
    }
  }

  private buildSystemPrompt(sourceLang: string, targetLang: string): string {
      return `
You are a professional translator. Translate the following text from ${sourceLang} to ${targetLang}.
Each segment is marked with [SEG#].

Important rules:
- Do not remove or reorder [SEG#] tags.
- Do not merge or split content.
- Output format must be: [SEG#]\\nTranslated text
- Only translate, no explanation.

Example:

[SEG1]
产品名称

[SEG2]
注册证编号

Expected Output:

[SEG1]
Product Name

[SEG2]
Registration Certificate Number
`.trim();
  }

  private buildSegmentedPrompt(segments: ISegment[]): string {
    return segments.map(s => `[SEG${s.index}]\n${s.sourceText}`).join('\n\n');
  }

  private parseTranslatedSegments(outputText: string): { [key: number]: string } {
    const result: { [key: number]: string } = {};
    if (!outputText) {
      return result;
    }
    const regex = /\[SEG(\d+)\]\s*([\s\S]*?)(?=\n\[SEG|\n*$)/g;
    let match;
    while ((match = regex.exec(outputText)) !== null) {
      const index = parseInt(match[1], 10);
      const translation = match[2].trim();
      if (!isNaN(index) && translation) {
          result[index] = translation;
      }
    }
    return result;
  }

  private splitSegmentsByTokenLimit(
    segments: ISegment[],
    systemPrompt: string,
    adapterConfig: AIServiceConfig,
    maxInputTokens: number = DEFAULT_MAX_INPUT_TOKENS
  ): ISegment[][] {
    const systemTokens = this.getTokenCount(systemPrompt);
    const batches: ISegment[][] = [];
    let currentBatch: ISegment[] = [];
    let currentTokens = systemTokens;

    for (const seg of segments) {
      if (seg.index === undefined || typeof seg.index !== 'number') {
          logger.warn(`Segment missing valid index, skipping batch inclusion: ${seg._id}`);
          continue;
      }
      const thisSegText = `[SEG${seg.index}]\n${seg.sourceText}`; 
      const thisTokens = this.getTokenCount(thisSegText);

      if (currentBatch.length > 0 && currentTokens + thisTokens > maxInputTokens) {
        batches.push(currentBatch);
        currentBatch = [seg];
        currentTokens = systemTokens + thisTokens; 
      } else if (currentTokens + thisTokens <= maxInputTokens) {
        currentBatch.push(seg);
        currentTokens += thisTokens;
      } else {
          logger.error(`Single segment token count (${thisTokens}) exceeds max input limit (${maxInputTokens}) after adding system prompt (${systemTokens}) for segment index ${seg.index}. Skipping this segment.`);
      }
    }

    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    logger.info(`Split ${segments.length} segments into ${batches.length} batches based on token limit ${maxInputTokens}.`);
    return batches;
  }


  // Batch translation method
  async translateMultipleSegments(
    fileId: Types.ObjectId, 
    options: TranslationOptions & { aiConfigId?: string | Types.ObjectId; promptTemplateId?: string | Types.ObjectId; } 
  ): Promise<{ success: boolean; message: string; fileId: Types.ObjectId; updatedCount: number; failedSegments: Types.ObjectId[] }> {

    const startTime = Date.now();
    let totalUpdatedCount = 0;
    const failedSegmentIds: Types.ObjectId[] = [];
    let segmentsToTranslate: ISegment[] = []; 

    try {
      logger.info(`Starting batch translation for fileId: ${fileId}`);

      // 1. Fetch Segments
      segmentsToTranslate = await Segment.find({
        fileId: fileId,
        status: { $in: [SegmentStatus.PENDING, SegmentStatus.TRANSLATION_FAILED] } 
      }).sort({ index: 1 }).lean(); 

      if (!segmentsToTranslate || segmentsToTranslate.length === 0) {
        logger.info(`No segments requiring translation found for fileId: ${fileId}`);
        return { success: true, message: "No segments to translate.", fileId: fileId, updatedCount: 0, failedSegments: [] };
      }
      logger.info(`Found ${segmentsToTranslate.length} segments to translate for fileId: ${fileId}`);

      // --- Step 3: Implement AI Config Loading --- 
      if (!options.aiConfigId) {
        throw new AppError('AI Configuration ID is required for translation.', 400);
      }
      // Fetch the actual AI config from the service using the injected instance
      // Ensure getConfigById exists and handles ObjectId/string conversion if needed
      const aiConfig: IAIProviderConfig | null = await this.aiConfigService.getConfigById(options.aiConfigId.toString()); // Use instance
      if (!aiConfig) {
          throw new AppError(`AI Configuration not found for ID: ${options.aiConfigId}`, 404);
      }
      // Validate required fields from the fetched config
      if (!aiConfig.apiKey) {
          throw new AppError(`API key is missing in AI Configuration ID: ${options.aiConfigId}`, 500);
      }
      if (!aiConfig.providerName) {
          throw new AppError(`Provider name is missing in AI Configuration ID: ${options.aiConfigId}`, 500);
      }
      const provider = aiConfig.providerName as AIProvider; // Cast to enum
      // -------------------------------------------

      // 2. Get AI Adapter (using fetched config)
      // Prepare the config object for the adapter factory
      const serviceConfig: AIServiceConfig = {
          provider: provider, 
          apiKey: aiConfig.apiKey, 
          // Use model from options first, fallback to fetched config, then potential default
          model: options.aiModel || aiConfig.defaultModel || process.env.DEFAULT_TRANSLATION_MODEL, // Use defaultModel
          temperature: options.temperature ?? aiConfig.defaultParams?.temperature ?? 0.3, // Use defaultParams
          maxTokens: aiConfig.defaultParams?.maxTokens || 4000, // Use defaultParams, maxTokens likely in params
          // Add other potential config fields needed by factory/adapter (e.g., baseURL, defaultModel)
          defaultModel: aiConfig.defaultModel, // Pass the primary model from config
          baseURL: aiConfig.baseURL
      };
      
      // Use assigned factory instance and call the correct adapter method
      const adapter = this.aiServiceFactory.getTranslationAdapter(serviceConfig.provider, serviceConfig);
      if (!adapter) {
          throw new AppError(`Could not get AI adapter for provider: ${serviceConfig.provider}`, 500);
      }

      // 3. Build System Prompt
      // TODO: Fetch and use PromptTemplate based on options.promptTemplateId
      const systemPrompt = this.buildSystemPrompt(options.sourceLanguage, options.targetLanguage);

      // 4. Split into Batches (using fetched config for token calculation if needed by adapter)
      const batches = this.splitSegmentsByTokenLimit(segmentsToTranslate, systemPrompt, serviceConfig);

      // 5. Process Batches
      const batchPromises = batches.map(async (batch, batchIndex) => {
          const batchStartTime = Date.now();
          logger.info(`Processing batch ${batchIndex + 1}/${batches.length} for fileId: ${fileId} with ${batch.length} segments.`);
          let batchSuccess = true;

          try {
              const userPrompt = this.buildSegmentedPrompt(batch);
              const messages: ChatMessage[] = [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: userPrompt }
              ];
              // Use the fetched and prepared serviceConfig here
              const completionOptions = {
                  model: serviceConfig.model,
                  temperature: serviceConfig.temperature,
                  max_tokens: serviceConfig.maxTokens
              };
              const response = await adapter.executeChatCompletion(messages, completionOptions);

              if (response.error || !response.content) {
                  throw new AppError(response.error || 'AI service returned empty content.', 500);
              }

              const translatedMap = this.parseTranslatedSegments(response.content);
              logger.debug(`Batch ${batchIndex + 1}: Parsed ${Object.keys(translatedMap).length} translations from AI response.`);

              const updatePromises = batch.map(async (seg) => {
                  const translation = translatedMap[seg.index];
                  if (translation) {
                      try {
                          await Segment.updateOne(
                              { _id: seg._id },
                              {
                                  $set: {
                                      translation: translation,
                                      translatedLength: translation.length,
                                      status: SegmentStatus.TRANSLATED,
                                      translationMeta: { 
                                          provider: serviceConfig.provider,
                                          model: response.model,
                                          promptTokens: response.usage?.prompt_tokens,
                                          completionTokens: response.usage?.completion_tokens,
                                          timestamp: new Date()
                                      },
                                      updatedAt: new Date()
                                  }
                              }
                          );
                      } catch (dbError) {
                          logger.error(`Failed to update segment _id=${seg._id}, index=${seg.index} in DB:`, dbError);
                          await Segment.updateOne({_id: seg._id}, {$set: { status: SegmentStatus.TRANSLATION_FAILED, error: 'DB update failed after translation' }});
                          batchSuccess = false; 
                          failedSegmentIds.push(seg._id); 
                      }
                  } else {
                      logger.warn(`Translation missing for segment index ${seg.index} in batch ${batchIndex + 1}, fileId ${fileId}.`);
                      await Segment.updateOne({_id: seg._id}, {$set: { status: SegmentStatus.TRANSLATION_FAILED, error: 'Missing in AI response' }});
                      batchSuccess = false; 
                      failedSegmentIds.push(seg._id); 
                  }
              });
              await Promise.allSettled(updatePromises);

              logger.info(`Batch ${batchIndex + 1} processed in ${Date.now() - batchStartTime}ms. Success: ${batchSuccess}`);
              return batchSuccess;

          } catch (batchError: any) {
              logger.error(`Error processing batch ${batchIndex + 1} for fileId ${fileId}:`, batchError);
              const batchSegmentIds = batch.map(s => s._id);
              failedSegmentIds.push(...batchSegmentIds); 
              await Segment.updateMany(
                  { _id: { $in: batchSegmentIds } },
                  { $set: { status: SegmentStatus.TRANSLATION_FAILED, error: batchError.message || 'Batch processing failed' } }
              );
              return false; 
          }
      }); 
      
      await Promise.allSettled(batchPromises);

      totalUpdatedCount = await Segment.countDocuments({
          fileId: fileId,
          _id: { $in: segmentsToTranslate.map(s => s._id) }, 
          status: SegmentStatus.TRANSLATED
      });

      const duration = Date.now() - startTime;
      logger.info(`Batch translation finished for fileId: ${fileId} in ${duration}ms. Updated count: ${totalUpdatedCount}, Failed segments: ${failedSegmentIds.length}`);

      const overallSuccess = failedSegmentIds.length === 0;
      // Use optional chaining for performanceMonitor
      // await this.performanceMonitor?.recordRequest(overallSuccess, duration); 

      return {
          success: overallSuccess,
          message: `Translation process completed. ${totalUpdatedCount} segments updated. ${failedSegmentIds.length} segments failed.`,
          fileId: fileId,
          updatedCount: totalUpdatedCount, 
          failedSegments: [...new Set(failedSegmentIds)] 
      };

    } catch (error: any) {
      logger.error(`Fatal error during batch translation for fileId ${fileId}:`, error);
      // Use optional chaining for performanceMonitor
      // await this.performanceMonitor?.recordRequest(false, Date.now() - startTime); 
      const finalFailedIds = Array.isArray(segmentsToTranslate) ? segmentsToTranslate.map(s => s._id) : [];
      return {
          success: false,
          message: `Translation failed: ${error.message}`,
          fileId: fileId,
          updatedCount: totalUpdatedCount,
          failedSegments: finalFailedIds 
      };
    }
  }

} 