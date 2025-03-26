翻译模块的核心功能
1. AI翻译服务集成

多AI服务支持：集成OpenAI、Grok，Deepseek等多种AI服务
AI模型管理：配置和选择不同的AI模型
请求参数优化：根据文本特性优化API请求参数
错误重试机制：处理API调用失败的重试逻辑
Token使用量管理：监控和优化Token使用

2. 段落翻译处理

单段翻译：处理单个段落的翻译请求
批量翻译：处理多个段落的批量翻译
文件级翻译：协调整个文件的翻译流程
项目级翻译：管理整个项目的翻译过程

3. 提示词应用

提示词模板获取：根据项目设置获取合适的提示词模板
输入项目 提示词
变量填充：使用实际值替换提示词模板中的变量
上下文管理：维护对话历史或上下文信息

4. 翻译记忆集成(暂不开发）

记忆库查询：在翻译前查询匹配的翻译记忆
相似度计算：计算源文与记忆库条目的匹配度
应用匹配结果：使用高匹配度的记忆直接替代翻译
记忆库更新：将已确认的高质量翻译添加到记忆库

5. 术语一致性管理

术语库查询：识别文本中的术语
术语应用：确保术语使用一致性
术语上下文提示：在提示词中加入相关术语信息

6. 翻译结果处理

结果解析：从AI响应中提取翻译结果
质量初筛：执行基本的质量检查
格式保持：确保特殊格式和标记的保留
结果存储：将翻译结果保存到数据库

7. 异步任务管理

翻译队列：维护待处理的翻译任务队列
优先级管理：根据项目优先级调度任务
任务状态跟踪：监控翻译任务的执行状态
性能优化：根据系统负载动态调整并发度

8. 指标收集和分析

翻译时间统计：记录翻译处理时间
Token使用统计：记录Token消耗量
质量指标收集：收集初步质量评估数据
错误率统计：记录翻译失败或异常情况

翻译模块的实现细节
1. 整体架构
翻译模块
├── 翻译服务 (TranslationService)
├── AI服务适配器 (AIServiceAdapter)
│   ├── OpenAI适配器
│   ├── Grok适配器
│   └── Deepseek适配器
├── 提示词处理器 (PromptProcessor)
├── 翻译记忆服务 (TranslationMemoryService)（暂不开发）
├── 术语管理服务 (TerminologyService)
├── 翻译队列 (TranslationQueue)
└── 翻译统计服务 (TranslationStatsService)
2. 翻译服务接口
typescriptCopy// 翻译服务接口
interface ITranslationService {
  // 翻译单个段落
  translateSegment(segmentId: string, options?: TranslationOptions): Promise<TranslationResult>;
  
  // 批量翻译多个段落
  translateMultipleSegments(segmentIds: string[], options?: TranslationOptions): Promise<void>;
  
  // 翻译整个文件
  translateFile(fileId: string, options?: TranslationOptions): Promise<void>;
  
  // 使用自定义文本和设置进行翻译(不保存结果)
  translateText(text: string, options: TranslationOptions): Promise<string>;
  
  // 获取翻译状态
  getTranslationStatus(jobId: string): Promise<TranslationStatus>;
  
  // 取消翻译任务
  cancelTranslation(jobId: string): Promise<boolean>;
}

// 翻译选项接口
interface TranslationOptions {
  sourceLanguage: string;
  targetLanguage: string;
  domain?: string;
  promptTemplateId?: string;
  aiProvider?: string;
  aiModel?: string;
  useTranslationMemory?: boolean;
  useTerminology?: boolean;
  priority?: 'low' | 'normal' | 'high';
  context?: {
    projectName?: string;
    fileName?: string;
    previousSegments?: Array<{source: string, target: string}>;
    followingSegments?: Array<{source: string}>;
  };
}

// 翻译结果接口
interface TranslationResult {
  translatedText: string;
  sourceText: string;
  confidence?: number;
  memoryMatch?: {
    source: string;
    translation: string;
    similarity: number;
  };
  metadata: {
    aiProvider: string;
    aiModel: string;
    promptTemplateId: string;
    tokenCount: number;
    processingTime: number;
  };
}
3. AI服务适配器
使用适配器模式处理不同的AI服务:
typescriptCopy// AI服务适配器接口
interface IAIServiceAdapter {
  translateText(
    sourceText: string, 
    promptData: PromptData
  ): Promise<AIServiceResponse>;
  
  getAvailableModels(): Promise<AIModelInfo[]>;
  
  validateApiKey(): Promise<boolean>;
}

// OpenAI适配器实现
class OpenAIAdapter implements IAIServiceAdapter {
  private client: OpenAI;
  
  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }
  
  async translateText(sourceText: string, promptData: PromptData): Promise<AIServiceResponse> {
    const startTime = Date.now();
    
    try {
      const response = await this.client.chat.completions.create({
        model: promptData.model || 'gpt-4',
        messages: [
          { role: 'system', content: promptData.systemInstruction },
          { role: 'user', content: this.formatUserPrompt(sourceText, promptData) }
        ],
        temperature: promptData.temperature || 0.3,
        max_tokens: promptData.maxTokens || 2000
      });
      
      const processingTime = Date.now() - startTime;
      
      return {
        text: response.choices[0].message.content || '',
        tokenCount: {
          input: response.usage?.prompt_tokens || 0,
          output: response.usage?.completion_tokens || 0,
          total: response.usage?.total_tokens || 0
        },
        processingTime,
        modelInfo: {
          provider: 'openai',
          model: promptData.model || 'gpt-4'
        }
      };
    } catch (error) {
      throw new Error(`OpenAI translation failed: ${error.message}`);
    }
  }
  
  // 其他方法实现...
}

// Grok适配器实现
class GrokAdapter implements IAIServiceAdapter {
  // 类似的实现...
}
4. 提示词处理
typescriptCopy// 提示词处理器
class PromptProcessor {
  constructor(
    private promptTemplateService: IPromptTemplateService,
    private terminologyService: ITerminologyService
  ) {}
  
  async buildPromptData(options: {
    templateId: string;
    sourceText: string;
    sourceLanguage: string;
    targetLanguage: string;
    domain?: string;
    context?: any;
  }): Promise<PromptData> {
    // 获取提示词模板
    const template = await this.promptTemplateService.getPromptTemplateById(options.templateId);
    
    if (!template) {
      throw new Error(`Prompt template not found: ${options.templateId}`);
    }
    
    // 获取相关术语
    const relevantTerms = await this.terminologyService.findRelevantTerms(
      options.sourceText,
      options.sourceLanguage,
      options.targetLanguage,
      options.domain
    );
    
    // 准备变量
    const variables = {
      sourceLanguage: options.sourceLanguage,
      targetLanguage: options.targetLanguage,
      domain: options.domain || 'general',
      terms: this.formatTerms(relevantTerms),
      ...options.context
    };
    
    // 填充系统指令中的变量
    let systemInstruction = template.systemInstruction;
    for (const [key, value] of Object.entries(variables)) {
      systemInstruction = systemInstruction.replace(
        new RegExp(`\\{\\{${key}\\}\\}`, 'g'), 
        String(value)
      );
    }
    
    // 准备用户提示词
    let userPrompt = template.userInputTemplate.replace(
      '{{input}}',
      options.sourceText
    );
    
    return {
      systemInstruction,
      userPrompt,
      model: template.aiModel,
      temperature: 0.3, // 可配置
      maxTokens: this.estimateRequiredTokens(options.sourceText)
    };
  }
  
  // 其他辅助方法...
}
5. 翻译队列实现
typescriptCopy// 翻译队列服务
class TranslationQueueService {
  private translationQueue: Queue;
  
  constructor(
    private translationService: ITranslationService,
    private segmentService: ISegmentService,
    private fileService: IFileService
  ) {
    // 初始化Bull队列
    this.translationQueue = new Queue('translation', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379')
      }
    });
    
    // 设置处理器
    this.setupQueueProcessor();
  }
  
  private setupQueueProcessor() {
    this.translationQueue.process(async (job) => {
      const { type, id, options } = job.data;
      
      try {
        switch (type) {
          case 'segment':
            await this.processSegmentJob(id, options);
            break;
          case 'file':
            await this.processFileJob(id, options);
            break;
          case 'project':
            await this.processProjectJob(id, options);
            break;
          default:
            throw new Error(`Unknown job type: ${type}`);
        }
        return { success: true };
      } catch (error) {
        console.error(`Translation job failed:`, error);
        // 更新状态为错误
        if (type === 'segment') {
          await this.segmentService.updateSegmentStatus(id, SegmentStatus.ERROR);
        } else if (type === 'file') {
          await this.fileService.updateFileStatus(id, FileStatus.ERROR);
        }
        throw error;
      }
    });
  }
  
  // 添加段落翻译任务
  async addSegmentTranslationJob(
    segmentId: string,
    options?: TranslationOptions
  ): Promise<string> {
    const job = await this.translationQueue.add(
      {
        type: 'segment',
        id: segmentId,
        options
      },
      {
        priority: this.getPriorityValue(options?.priority),
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000
        }
      }
    );
    
    return job.id.toString();
  }
  
  // 其他任务添加和处理方法...
}
6. 主翻译服务实现
typescriptCopy// 翻译服务实现
class TranslationService implements ITranslationService {
  constructor(
    private segmentService: ISegmentService,
    private fileService: IFileService,
    private projectService: IProjectService,
    private aiServiceFactory: AIServiceFactory,
    private promptProcessor: PromptProcessor,
    private translationMemoryService: ITranslationMemoryService,
    private translationQueue: TranslationQueueService,
    private statsService: TranslationStatsService
  ) {}
  
  async translateSegment(
    segmentId: string,
    options?: TranslationOptions
  ): Promise<TranslationResult> {
    // 获取段落信息
    const segment = await this.segmentService.getSegmentById(segmentId);
    if (!segment) {
      throw new Error(`Segment not found: ${segmentId}`);
    }
    
    // 更新段落状态
    await this.segmentService.updateSegmentStatus(
      segmentId,
      SegmentStatus.TRANSLATING
    );
    
    try {
      // 获取文件和项目信息
      const file = await this.fileService.getFileById(segment.file);
      const project = await this.projectService.getProjectById(file.project);
      
      // 合并选项
      const mergedOptions: TranslationOptions = {
        sourceLanguage: project.sourceLanguage,
        targetLanguage: project.targetLanguage,
        domain: project.domain,
        promptTemplateId: project.translationPromptTemplate,
        ...options
      };
      
      // 检查翻译记忆
      let memoryMatch = null;
      if (mergedOptions.useTranslationMemory !== false) {
        memoryMatch = await this.translationMemoryService.findMatch(
          segment.sourceText,
          mergedOptions.sourceLanguage,
          mergedOptions.targetLanguage,
          mergedOptions.domain
        );
        
        // 如果找到高匹配度的记忆，直接使用
        if (memoryMatch && memoryMatch.similarity >= 0.95) {
          const result: TranslationResult = {
            translatedText: memoryMatch.translation,
            sourceText: segment.sourceText,
            confidence: memoryMatch.similarity,
            memoryMatch,
            metadata: {
              aiProvider: 'translation_memory',
              aiModel: 'memory_match',
              promptTemplateId: '',
              tokenCount: 0,
              processingTime: 0
            }
          };
          
          // 更新段落
          await this.updateSegmentWithTranslation(segmentId, result);
          return result;
        }
      }
      
      // 准备提示词数据
      const promptData = await this.promptProcessor.buildPromptData({
        templateId: mergedOptions.promptTemplateId!,
        sourceText: segment.sourceText,
        sourceLanguage: mergedOptions.sourceLanguage,
        targetLanguage: mergedOptions.targetLanguage,
        domain: mergedOptions.domain,
        context: mergedOptions.context
      });
      
      // 获取AI服务适配器
      const aiService = this.aiServiceFactory.getService(
        mergedOptions.aiProvider || 'openai'
      );
      
      // 调用AI服务进行翻译
      const aiResponse = await aiService.translateText(
        segment.sourceText,
        promptData
      );
      
      // 构建翻译结果
      const result: TranslationResult = {
        translatedText: aiResponse.text,
        sourceText: segment.sourceText,
        confidence: 0.8, // 可以基于某些指标计算
        memoryMatch: memoryMatch && memoryMatch.similarity >= 0.7 ? memoryMatch : undefined,
        metadata: {
          aiProvider: aiResponse.modelInfo.provider,
          aiModel: aiResponse.modelInfo.model,
          promptTemplateId: mergedOptions.promptTemplateId!,
          tokenCount: aiResponse.tokenCount.total,
          processingTime: aiResponse.processingTime
        }
      };
      
      // 更新段落
      await this.updateSegmentWithTranslation(segmentId, result);
      
      // 记录统计数据
      await this.statsService.recordTranslation({
        segmentId,
        aiProvider: result.metadata.aiProvider,
        aiModel: result.metadata.aiModel,
        tokenCount: result.metadata.tokenCount,
        processingTime: result.metadata.processingTime,
        memoryUsed: !!memoryMatch
      });
      
      return result;
    } catch (error) {
      // 发生错误时将状态设为错误
      await this.segmentService.updateSegmentStatus(segmentId, SegmentStatus.ERROR);
      throw error;
    }
  }
  
  // 更新段落的翻译结果
  private async updateSegmentWithTranslation(
    segmentId: string,
    result: TranslationResult
  ): Promise<void> {
    await this.segmentService.updateSegment(segmentId, {
      aiTranslation: result.translatedText,
      status: SegmentStatus.TRANSLATED,
      translationMetadata: {
        aiModel: result.metadata.aiModel,
        promptTemplateId: new mongoose.Types.ObjectId(result.metadata.promptTemplateId),
        tokenCount: result.metadata.tokenCount,
        processingTime: result.metadata.processingTime
      },
      translationCompletedAt: new Date()
    });
  }
  
  // 其他方法实现...
}
翻译模块与其他模块的交互

与文件管理模块交互：

接收段落和文件信息
更新翻译状态和结果


与项目管理模块交互：

获取项目配置（语言对、领域等）
更新项目翻译进度


与提示词模块交互：

获取提示词模板
记录模板使用情况


与翻译记忆模块交互：（暂不开发）

查询匹配的翻译记忆（暂不开发）
添加新的翻译记忆（暂不开发）


与术语模块交互：

获取相关术语
确保术语一致性



总结
翻译模块作为系统的核心处理单元，负责协调AI服务、提示词、翻译记忆和术语管理等多个方面，将源文本转换为目标语言文本。通过队列系统和异步处理，它能高效地处理大量翻译任务，并提供灵活的配置选项以适应不同项目的需求。