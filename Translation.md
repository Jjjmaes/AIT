# AI辅助翻译审校平台 - 软件设计说明书

## 1. 引言

### 1.1 目的
本软件设计说明书详细描述了AI辅助翻译审校平台的功能、架构和交互方式，旨在为开发团队提供明确的实施指导，确保系统按照预期要求构建。本说明书涵盖首期开发范围内的文件处理、翻译和审校三个核心模块。

### 1.2 项目背景
随着全球化进程的加速和内容本地化需求的增长，高效准确的翻译服务变得日益重要。传统翻译流程效率低下且成本高昂，AI辅助翻译审校平台旨在利用先进的人工智能技术，结合专业人工审校，提供高质量、高效率的翻译解决方案。

### 1.3 系统概述
AI辅助翻译审校平台是一个基于Web的应用系统，集成了AI翻译引擎和专业审校工具，实现从文件上传、文本提取、AI翻译到人工审校的完整流程管理。系统支持多种文件格式，多语言对翻译，并提供友好的翻译和审校界面，通过提示词模板优化AI翻译质量，通过专业审校确保最终翻译的准确性。

### 1.4 适用范围
本说明书主要针对首期开发的三个核心模块：
- 文件处理模块
- 翻译模块
- 审校模块

后续模块如用户管理、项目管理、提示词管理等将在系统迭代中开发。

## 2. 系统架构

### 2.1 技术架构
- **前端**：React, TypeScript, Ant Design, TailwindCSS
- **后端**：Node.js, Express, TypeScript, MongoDB
- **AI服务**：OpenAI API, Grok API
- **文件处理**：多种库用于处理不同格式文件
- **队列系统**：Bull，用于异步任务管理
- **WebSocket**：Socket.IO，用于实时通知
- **存储**：MongoDB (数据), 文件存储 (文档)

### 2.2 模块架构

```
AI辅助翻译审校平台
├── 文件处理模块
│   ├── 文件上传组件
│   ├── 文件解析服务
│   ├── 文件分段处理器
│   └── 段落管理器
├── 翻译模块
│   ├── AI服务适配器
│   ├── 翻译队列管理器
│   ├── 提示词处理器
│   └── 翻译结果管理器
└── 审校模块
    ├── AI审校服务
    ├── 问题管理器
    ├── 质量评估服务
    └── 审校工作流管理器
```

### 2.3 数据模型

#### 文件模型 (File)
```typescript
interface IFile extends Document {
  name: string;
  originalName: string;
  project: mongoose.Types.ObjectId;
  path: string;
  type: 'docx' | 'txt' | 'html' | 'xml' | 'json' | 'md' | 'csv' | 'xlsx' | 'xliff' | 'memoqxliff';
  size: number;
  status: 'pending' | 'processing' | 'translated' | 'reviewing' | 'completed' | 'error';
  segmentCount: number;
  translatedCount: number;
  reviewedCount: number;
  errorDetails?: string;
  processingStartedAt?: Date;
  processingCompletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

#### 段落模型 (Segment)
```typescript
interface ISegment extends Document {
  file: mongoose.Types.ObjectId;
  index: number;
  sourceText: string;
  aiTranslation?: string;
  aiReview?: string;
  finalTranslation?: string;
  status: 'pending' | 'translating' | 'translated' | 'reviewing' | 'reviewed' | 'completed' | 'error';
  issues: mongoose.Types.ObjectId[];
  reviewer?: mongoose.Types.ObjectId;
  translationMetadata?: {
    aiModel: string;
    promptTemplateId: string;
    tokenCount: number;
    processingTime: number;
  };
  reviewMetadata?: {
    aiModel: string;
    promptTemplateId: string;
    tokenCount: number;
    processingTime: number;
    acceptedChanges: boolean;
    modificationDegree?: number;
  };
  translationCompletedAt?: Date;
  reviewCompletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

#### 问题模型 (Issue)
```typescript
interface IIssue extends Document {
  segmentId: mongoose.Types.ObjectId;
  type: 'terminology' | 'grammar' | 'style' | 'accuracy' | 'formatting' | 'consistency' | 'omission' | 'addition' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  position?: {
    start: number;
    end: number;
  };
  suggestion?: string;
  status: 'open' | 'in_progress' | 'resolved' | 'rejected' | 'deferred';
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  resolvedBy?: mongoose.Types.ObjectId;
  resolvedAt?: Date;
  resolution?: {
    action: 'accept' | 'modify' | 'reject';
    modifiedText?: string;
    comment?: string;
  };
}
```

#### 项目模型 (Project)
```typescript
interface IProject extends Document {
  name: string;
  description?: string;
  owner: mongoose.Types.ObjectId;
  members: mongoose.Types.ObjectId[];
  languagePairs: {
    source: string;
    target: string;
  }[];
  defaultPromptTemplate?: mongoose.Types.ObjectId;
  domain?: string;
  terminology?: mongoose.Types.ObjectId;
  status: 'active' | 'completed' | 'archived';
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}
```

#### 用户模型 (User)
```typescript
interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  fullName?: string;
  role: 'admin' | 'manager' | 'translator' | 'reviewer' | 'guest';
  languages: {
    code: string;
    proficiency: 'native' | 'fluent' | 'intermediate' | 'basic';
  }[];
  active: boolean;
  comparePassword(candidatePassword: string): Promise<boolean>;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
}
```

#### 提示词模板模型 (PromptTemplate)
```typescript
interface IPromptTemplate extends Document {
  name: string;
  description?: string;
  systemInstruction: string;
  userPrompt: string;
  domain?: string;
  languagePairs?: {
    source: string;
    target: string;
  }[];
  taskType: 'translation' | 'review';
  createdBy: mongoose.Types.ObjectId;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

#### 术语表模型 (Terminology)
```typescript
interface ITerminology extends Document {
  name: string;
  description?: string;
  languagePairs: {
    source: string;
    target: string;
  }[];
  terms: {
    source: string;
    target: string;
    domain?: string;
    notes?: string;
  }[];
  project?: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

## 3. 文件处理模块

### 3.1 功能概述
文件处理模块负责管理翻译文件的上传、解析、分段和段落管理，是翻译流程的入口。该模块支持多种文件格式，能够提取文本内容并将其分割为适合翻译的段落，同时保留文件的格式信息以便后续重建译文文档。

### 3.2 支持的文件格式
- **文档格式**：DOCX
- **纯文本格式**：TXT, Markdown
- **标记语言格式**：HTML, XML
- **数据格式**：JSON, CSV, XLSX
- **本地化格式**：XLIFF, MemoQ XLIFF

### 3.3 功能详细说明

#### 3.3.1 文件上传

**功能描述**：
- 支持多种文件格式上传
- 文件大小限制检查（默认限制10MB）
- 文件类型验证
- 上传进度显示
- 文件与项目关联

**接口设计**：
```
POST /api/files
请求参数：
- file: 文件二进制数据（multipart/form-data）
- projectId: 项目ID

响应数据：
{
  "success": true,
  "data": {
    "file": {
      "id": "file123",
      "name": "generated-filename.docx",
      "originalName": "original-filename.docx",
      "project": "project123",
      "path": "/uploads/file123.docx",
      "type": "docx",
      "size": 52428,
      "status": "pending",
      ...
    }
  }
}
```

#### 3.3.2 文件解析

**功能描述**：
- 根据文件类型选择适当的解析器
- 提取文本内容
- 保存格式信息
- 处理错误与异常
- 支持不同编码和文件格式

**具体实现**：
- DOCX解析：使用mammoth.js提取文本和结构
- HTML/XML解析：使用cheerio提取文本节点
- JSON/YAML解析：解析结构化数据中的文本字段
- CSV/XLSX解析：使用SheetJS处理表格数据
- XLIFF/MemoQ XLIFF解析：使用xmldom和xpath处理XML结构
- 纯文本解析：直接处理，识别段落分隔

#### 3.3.3 文本分段

**功能描述**：
- 将提取的文本分割为适合翻译的段落
- 考虑上下文和语义完整性
- 段落编号和关联
- 不同文件类型的专用分段策略

**分段策略**：
1. **DOCX文档**：按段落标记、标题、列表项分段
2. **HTML/XML**：按标签边界、段落标签分段
3. **纯文本**：按空行、固定模式分段
4. **表格数据**：按单元格或行分段
5. **XLIFF文件**：按trans-unit元素分段

#### 3.3.4 文件状态管理

**功能描述**：
- 跟踪文件处理状态
- 提供处理进度更新
- 处理错误和异常情况
- 支持手动重试失败的操作

**状态转换**：
```
pending → processing → translated → reviewing → completed
      ↓                     ↓
    error ← ─ ─ ─ ─ ─ ─ ─ ─ ┘
```

### 3.4 技术实现

#### 3.4.1 文件处理器接口

```typescript
interface FileProcessorInterface {
  // 从文件中提取段落
  extractSegments(filePath: string, ...options: any[]): Promise<{
    segments: any[],
    metadata: any
  }>;
  
  // 将翻译结果写入文件
  writeTranslations?(
    segments: ISegment[],
    inputFilePath: string,
    outputFilePath: string,
    ...options: any[]
  ): Promise<void>;
}
```

#### 3.4.2 文件处理器工厂

```typescript
class FileProcessorFactory {
  // 创建文件处理器
  static createProcessor(fileType: FileType): FileProcessorInterface {
    switch (fileType) {
      case 'docx':
        return new DocxProcessor();
      case 'txt':
        return new TextProcessor();
      // ...其他处理器
      case 'xliff':
        return new XliffProcessor();
      case 'memoqxliff':
        const processor = new XliffProcessor();
        // MemoQ专用配置
        return processor;
      default:
        throw new Error(`不支持的文件类型: ${fileType}`);
    }
  }

  // 处理文件
  static async processFile(filePath: string, fileType: FileType): Promise<{
    segments: any[],
    metadata: any
  }> {
    const processor = this.createProcessor(fileType);
    
    // 对于特定类型的文件需要特殊处理
    if (fileType === 'memoqxliff') {
      return (processor as XliffProcessor).extractSegments(filePath, true);
    }
    
    if (fileType === 'xliff') {
      return (processor as XliffProcessor).extractSegments(filePath, false);
    }
    
    return processor.extractSegments(filePath);
  }
}
```

#### 3.4.3 XLIFF处理器实现

```typescript
class XliffProcessor implements FileProcessorInterface {
  private parser: DOMParser;
  private serializer: XMLSerializer;
  private select: xpath.XPathSelect;

  constructor() {
    this.parser = new DOMParser();
    this.serializer = new XMLSerializer();
    this.select = xpath.useNamespaces({
      xliff: 'urn:oasis:names:tc:xliff:document:1.2',
      m: 'http://www.memoq.com/memoq/xliff'
    });
  }

  // 解析XLIFF文件
  async extractSegments(filePath: string, isMemoQ: boolean = false): Promise<{
    segments: any[],
    metadata: any
  }> {
    // 读取文件内容
    const content = await readFile(filePath, 'utf8');
    
    // 解析XML文档
    const doc = this.parser.parseFromString(content, 'text/xml');
    
    // 提取文件元数据
    const metadata = this.extractMetadata(doc, isMemoQ);
    
    // 根据不同XLIFF类型提取段落
    const segments = isMemoQ 
      ? this.extractMemoQSegments(doc) 
      : this.extractStandardXliffSegments(doc);
    
    return { segments, metadata };
  }

  // 将翻译结果写入XLIFF文件
  async writeTranslations(
    segments: ISegment[], 
    inputFilePath: string, 
    outputFilePath: string, 
    isMemoQ: boolean = false
  ): Promise<void> {
    // 读取原始文件
    const content = await readFile(inputFilePath, 'utf8');
    const doc = this.parser.parseFromString(content, 'text/xml');
    
    // 创建ID到翻译结果的映射
    const translations = new Map<string, string>();
    segments.forEach(segment => {
      if (segment.finalTranslation) {
        translations.set(segment.id as string, segment.finalTranslation);
      }
    });
    
    // 更新翻译单元
    const transUnits = isMemoQ
      ? this.select('//m:trans-unit', doc) as Node[]
      : this.select('//xliff:trans-unit', doc) as Node[];
    
    // 更新每个翻译单元的target元素
    transUnits.forEach(unit => {
      const id = (unit as Element).getAttribute('id');
      if (id && translations.has(id)) {
        // 更新翻译内容
        // ...实现细节
      }
    });
    
    // 将更新后的文档写入输出文件
    const outputXML = this.serializer.serializeToString(doc);
    await writeFile(outputFilePath, outputXML, 'utf8');
  }

  // 其他辅助方法
  // ...
}
```
## 4. 翻译模块

### 4.1 功能概述
翻译模块是系统的核心组件，负责将源文本翻译成目标语言。它集成多种AI翻译服务，应用提示词模板，处理翻译任务队列，并管理翻译结果。该模块既支持大规模批量翻译，也能处理单个段落的翻译请求。

### 4.2 功能详细说明

#### 4.2.1 AI服务集成

**功能描述**：
- 支持多种AI服务（OpenAI GPT、Grok等）
- 适配器模式处理不同API差异
- 服务参数配置与优化
- 服务切换与负载均衡
- 请求重试与错误处理

**支持的AI服务**：
1. **OpenAI**：GPT-4, GPT-3.5-Turbo
2. **Grok**
3. **扩展支持**：未来可添加更多AI服务

#### 4.2.2 提示词处理

**功能描述**：
- 加载项目指定的提示词模板
- 替换提示词模板中的变量
- 构建翻译上下文
- 应用领域特定指导
- 术语表整合

**提示词变量**：
- `{{sourceLanguage}}`：源语言
- `{{targetLanguage}}`：目标语言
- `{{domain}}`：专业领域
- `{{input}}`：需翻译的源文本
- `{{context}}`：上下文信息（可选）
- `{{terminology}}`：相关术语（可选）

#### 4.2.3 翻译队列管理

**功能描述**：
- 创建和调度翻译任务
- 优先级管理
- 批量任务处理
- 任务状态跟踪
- 资源使用监控

**任务类型**：
1. **段落翻译任务**：翻译单个段落
2. **文件翻译任务**：翻译整个文件的所有段落
3. **项目翻译任务**：翻译项目中的所有文件

#### 4.2.4 翻译处理

**功能描述**：
- 单个段落翻译
- 批量段落翻译
- 上下文感知翻译
- 术语应用
- 翻译记忆使用

**翻译流程**：
1. 接收翻译请求
2. 检查翻译记忆匹配
3. 准备提示词和上下文
4. 调用AI服务
5. 解析和处理返回结果
6. 更新段落状态和翻译结果
7. 通知翻译完成

### 4.3 技术实现

#### 4.3.1 AI服务适配器

```typescript
// AI服务适配器接口
interface IAIServiceAdapter {
  translateText(
    sourceText: string, 
    promptData: PromptData,
    options?: TranslationOptions
  ): Promise<{
    translatedText: string;
    tokenCount: { input: number; output: number; total: number };
    processingTime: number;
    modelInfo: { provider: string; model: string };
  }>;
  
  getAvailableModels(): Promise<AIModelInfo[]>;
}

// OpenAI适配器实现
class OpenAIAdapter implements IAIServiceAdapter {
  constructor(private apiKey: string) {}
  
  async translateText(
    sourceText: string,
    promptData: PromptData,
    options?: TranslationOptions
  ): Promise<TranslationResponse> {
    const startTime = Date.now();
    
    try {
      const response = await openai.chat.completions.create({
        model: options?.model || 'gpt-4',
        messages: [
          { role: 'system', content: promptData.systemInstruction },
          { role: 'user', content: this.formatUserPrompt(sourceText, promptData) }
        ],
        temperature: options?.temperature || 0.3
      });
      
      return {
        translatedText: response.choices[0].message.content || '',
        tokenCount: {
          input: response.usage?.prompt_tokens || 0,
          output: response.usage?.completion_tokens || 0,
          total: response.usage?.total_tokens || 0
        },
        processingTime: Date.now() - startTime,
        modelInfo: {
          provider: 'openai',
          model: options?.model || 'gpt-4'
        }
      };
    } catch (error) {
      // 处理错误...
      throw error;
    }
  }
  
  // 其他方法实现...
}
```

#### 4.3.2 翻译队列实现

```typescript
// 翻译队列服务
class TranslationQueueService {
  private translationQueue: Queue;
  
  constructor() {
    this.translationQueue = new Queue('translation', {
      redis: { host: 'localhost', port: 6379 }
    });
    
    this.setupQueueProcessor();
  }
  
  private setupQueueProcessor() {
    this.translationQueue.process(async (job) => {
      const { type, id, options } = job.data;
      
      try {
        switch (type) {
          case 'segment':
            return await this.processSegmentJob(id, options);
          case 'file':
            return await this.processFileJob(id, options);
          case 'project':
            return await this.processProjectJob(id, options);
          default:
            throw new Error(`Unknown job type: ${type}`);
        }
      } catch (error) {
        // 处理错误...
        throw error;
      }
    });
  }
  
  // 任务处理方法...
  
  // 添加任务方法...
}
```

#### 4.3.3 翻译服务实现

```typescript
// 翻译服务
class TranslationService {
  constructor(
    private aiServiceFactory: AIServiceFactory,
    private promptProcessor: PromptProcessor,
    private segmentService: SegmentService,
    private fileService: FileService,
    private translationQueue: TranslationQueueService
  ) {}
  
  async translateSegment(
    segmentId: string,
    options?: TranslationOptions
  ): Promise<TranslationResult> {
    // 实现段落翻译...
    // 1. 获取段落信息
    const segment = await this.segmentService.getSegmentById(segmentId);
    if (!segment) {
      throw new Error(`段落不存在: ${segmentId}`);
    }
    
    // 2. 更新段落状态
    segment.status = 'translating';
    await segment.save();
    
    try {
      // 3. 准备翻译上下文
      const file = await this.fileService.getFileById(segment.file.toString());
      
      // 4. 获取提示词模板
      const project = await this.projectService.getProjectById(file.project.toString());
      const promptTemplateId = options?.promptTemplateId || project.defaultPromptTemplate?.toString();
      
      // 5. 处理提示词
      const promptData = await this.promptProcessor.buildTranslationPrompt(
        segment.sourceText,
        {
          promptTemplateId,
          sourceLanguage: options?.sourceLanguage,
          targetLanguage: options?.targetLanguage,
          domain: project.domain,
          terminology: project.terminology?.toString()
        }
      );
      
      // 6. 获取AI服务
      const aiService = this.aiServiceFactory.getService(
        options?.aiProvider || 'openai'
      );
      
      // 7. 执行翻译
      const startTime = Date.now();
      const response = await aiService.translateText(
        segment.sourceText,
        promptData,
        options
      );
      
      // 8. 更新段落翻译结果
      segment.aiTranslation = response.translatedText;
      segment.status = 'translated';
      segment.translationMetadata = {
        aiModel: response.modelInfo.model,
        promptTemplateId: promptTemplateId || '',
        tokenCount: response.tokenCount.total,
        processingTime: Date.now() - startTime
      };
      segment.translationCompletedAt = new Date();
      
      await segment.save();
      
      // 9. 更新文件翻译进度
      await this.fileService.updateFileProgress(segment.file.toString());
      
      return {
        segmentId,
        translatedText: response.translatedText,
        tokenCount: response.tokenCount,
        processingTime: response.processingTime,
        aiModel: response.modelInfo.model
      };
    } catch (error) {
      // 处理错误
      segment.status = 'error';
      await segment.save();
      
      throw error;
    }
  }
  
  async translateFile(
    fileId: string,
    options?: TranslationOptions
  ): Promise<string> { // 返回jobId
    // 将文件翻译任务添加到队列
    const job = await this.translationQueue.add(
      {
        type: 'file',
        id: fileId,
        options
      },
      {
        priority: options?.priority || 10,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000
        }
      }
    );
    
    return job.id.toString();
  }
  
  // 其他翻译方法...
}
```

### 4.4 用户界面

#### 4.4.1 翻译控制面板

- AI服务和模型选择
- 翻译参数调整
- 批量翻译控件
- 翻译记忆和术语选项
- 翻译进度显示

#### 4.4.2 翻译界面

- 源文本显示
- 实时翻译结果
- 编辑功能
- 上下文段落显示
- 术语高亮
- 质量指标预览

#### 4.4.3 批量翻译管理

- 任务队列显示
- 优先级调整
- 进度监控
- 错误处理控件
- 资源使用统计

## 5. 审校模块

### 5.1 功能概述
审校模块是系统的质量保障环节，负责检查和改进AI翻译结果，确保最终译文的准确性、流畅性和一致性。该模块结合AI自动审校和人工专业审校，提供全面的问题检测、修改建议和质量评估功能。

### 5.2 功能详细说明

#### 5.2.1 AI审校

**功能描述**：
- 使用AI模型审查翻译结果
- 检测多种类型的翻译问题
- 生成修改建议
- 评估翻译质量
- 提供差异比较

**问题类型**：
1. **术语问题**：术语翻译不准确或不一致
2. **语法问题**：目标语言的语法错误
3. **风格问题**：与领域风格不符
4. **准确性问题**：意思传达不准确或有遗漏
5. **格式问题**：格式不保留或异常
6. **一致性问题**：表达不一致

#### 5.2.2 问题管理

**功能描述**：
- 问题识别和分类
- 问题严重程度评估
- 问题跟踪和状态管理
- 修改建议提供
- 问题解决流程管理

**问题严重程度**：
- **低**：不影响理解的小问题
- **中**：轻微影响理解的问题
- **高**：明显误导或混淆的问题
- **关键**：完全错误的翻译

#### 5.2.3 人工审校工作流

**功能描述**：
// 批量审校文件
  async reviewFile(
    fileId: string,
    options?: ReviewOptions
  ): Promise<string> { // 返回jobId
    // 这里可以实现添加到队列的逻辑
    // 类似于翻译服务中的translateFile方法
    
    // 简单实现：直接获取文件的所有已翻译段落并审校
    const segments = await this.segmentService.getSegmentsByFileId(fileId, { status: 'translated' });
    
    // 创建审校任务
    const job = await this.reviewQueue.add(
      {
        type: 'file',
        id: fileId,
        segmentIds: segments.map(s => s._id.toString()),
        options
      },
      {
        priority: options?.priority || 5,
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 5000
        }
      }
    );
    
    return job.id.toString();
  }
  
  // 计算修改程度
  private calculateModificationDegree(original: string, modified: string): number {
    // 简单实现，实际项目中可使用更复杂的算法
    // 这里使用字符串长度差异作为简单示例
    const maxLength = Math.max(original.length, modified.length);
    const lengthDiff = Math.abs(original.length - modified.length);
    return (lengthDiff / maxLength) * 100;
  }
  
  // 比较文本差异并生成HTML差异视图
  generateDiffView(original: string, modified: string): string {
    // 实现文本差异比较
    // 可以使用diff库生成HTML差异视图
    // 这里是简化实现
    
    try {
      const diff = require('diff');
      const changes = diff.diffWords(original, modified);
      
      // 生成HTML差异视图
      let diffHtml = '';
      changes.forEach(part => {
        // 添加表示增加的部分
        if (part.added) {
          diffHtml += `<span class="diff-added">${part.value}</span>`;
        }
        // 添加表示删除的部分
        else if (part.removed) {
          diffHtml += `<span class="diff-removed">${part.value}</span>`;
        }
        // 保持不变的部分
        else {
          diffHtml += `<span>${part.value}</span>`;
        }
      });
      
      return diffHtml;
    } catch (error) {
      console.error('生成差异视图时出错:', error);
      return `<div class="error">无法生成差异视图</div>`;
    }
  }
  
  // 合并审校结果
  async finalizeFileReview(fileId: string): Promise<void> {
    // 获取文件所有已审校的段落
    const segments = await this.segmentService.getSegmentsByFileId(fileId, { status: 'reviewed' });
    
    // 检查是否所有段落都已审校
    const totalSegments = await this.segmentService.countSegmentsByFileId(fileId);
    if (segments.length < totalSegments) {
      throw new Error(`文件尚未完成全部审校: ${fileId}`);
    }
    
    // 更新文件状态
    await this.fileService.updateFileStatus(fileId, 'completed');
    
    // 发送完成通知
    this.notificationService.notifyFileReviewCompleted(fileId);
  }
}
```

### 5.4 用户界面

#### 5.4.1 审校工作区

- 原文/译文对照显示
- AI审校结果差异对比
- 问题列表和详情
- 文本编辑器
- 修改建议应用控件
- 批量操作工具栏
- 审校提交按钮

#### 5.4.2 问题面板

- 按类型和严重程度分组的问题列表
- 问题详情展示
- 修改建议预览
- 接受/拒绝/编辑按钮
- 问题状态指示器

#### 5.4.3 质量报告

- 质量评分和等级
- 问题类型分布图表
- 修改率统计
- 质量趋势图
- 主要问题总结

### 5.5 质量评估系统

#### 5.5.1 评估指标

```typescript
// 质量评估服务
class QualityAssessmentService {
  constructor(
    private issueManager: IssueManager,
    private segmentService: SegmentService,
    private fileService: FileService
  ) {}
  
  // 评估单个段落的质量
  async assessSegmentQuality(segmentId: string): Promise<SegmentQualityReport> {
    // 获取段落
    const segment = await this.segmentService.getSegmentById(segmentId);
    if (!segment) {
      throw new Error(`段落不存在: ${segmentId}`);
    }
    
    // 获取问题
    const issues = await this.issueManager.getSegmentIssues(segmentId);
    
    // 计算问题严重度分数
    const severityScores = {
      low: issues.filter(i => i.severity === 'low').length * 1,
      medium: issues.filter(i => i.severity === 'medium').length * 2,
      high: issues.filter(i => i.severity === 'high').length * 4,
      critical: issues.filter(i => i.severity === 'critical').length * 8
    };
    
    // 计算总分
    const totalIssueScore = severityScores.low + severityScores.medium + 
                           severityScores.high + severityScores.critical;
    
    // 根据问题严重度计算质量分数（满分100分）
    const qualityScore = Math.max(0, 100 - totalIssueScore);
    
    // 计算质量等级
    const qualityGrade = this.calculateQualityGrade(qualityScore);
    
    // 计算问题类型分布
    const issueTypeDistribution = this.calculateIssueTypeDistribution(issues);
    
    // 计算修改率
    let modificationRate = 0;
    if (segment.aiTranslation && segment.finalTranslation) {
      modificationRate = this.calculateModificationRate(
        segment.aiTranslation, 
        segment.finalTranslation
      );
    }
    
    return {
      segmentId,
      qualityScore,
      qualityGrade,
      issueCount: issues.length,
      issueTypeDistribution,
      severityCounts: {
        low: severityScores.low / 1,
        medium: severityScores.medium / 2,
        high: severityScores.high / 4,
        critical: severityScores.critical / 8
      },
      modificationRate
    };
  }
  
  // 评估文件的整体质量
  async assessFileQuality(fileId: string): Promise<FileQualityReport> {
    // 获取文件所有段落
    const segments = await this.segmentService.getSegmentsByFileId(fileId);
    
    // 计算每个段落的质量评分
    const segmentQualityReports: SegmentQualityReport[] = [];
    
    for (const segment of segments) {
      const report = await this.assessSegmentQuality(segment._id.toString());
      segmentQualityReports.push(report);
    }
    
    // 计算平均质量分数
    const averageQualityScore = segmentQualityReports.reduce(
      (sum, report) => sum + report.qualityScore, 0
    ) / segmentQualityReports.length;
    
    // 计算质量等级
    const qualityGrade = this.calculateQualityGrade(averageQualityScore);
    
    // 合并问题类型分布
    const issueTypeDistribution = this.mergeIssueTypeDistributions(
      segmentQualityReports.map(report => report.issueTypeDistribution)
    );
    
    // 合并严重程度分布
    const severityCounts = this.mergeSeverityCounts(
      segmentQualityReports.map(report => report.severityCounts)
    );
    
    // 计算平均修改率
    const averageModificationRate = segmentQualityReports.reduce(
      (sum, report) => sum + report.modificationRate, 0
    ) / segmentQualityReports.length;
    
    // 获取文件信息
    const file = await this.fileService.getFileById(fileId);
    
    return {
      fileId,
      fileName: file.name,
      segmentCount: segments.length,
      averageQualityScore,
      qualityGrade,
      totalIssueCount: segmentQualityReports.reduce(
        (sum, report) => sum + report.issueCount, 0
      ),
      issueTypeDistribution,
      severityCounts,
      averageModificationRate,
      worstSegments: this.findWorstSegments(segmentQualityReports, 5),
      completionTime: this.calculateCompletionTime(segments)
    };
  }
  
  // 计算质量等级
  private calculateQualityGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }
  
  // 计算问题类型分布
  private calculateIssueTypeDistribution(issues: IIssue[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    issues.forEach(issue => {
      distribution[issue.type] = (distribution[issue.type] || 0) + 1;
    });
    
    return distribution;
  }
  
  // 计算修改率
  private calculateModificationRate(original: string, modified: string): number {
    // 可以使用Levenshtein距离等算法
    // 这里简化实现
    const maxLength = Math.max(original.length, modified.length);
    if (maxLength === 0) return 0;
    
    let differentChars = 0;
    const minLength = Math.min(original.length, modified.length);
    
    for (let i = 0; i < minLength; i++) {
      if (original[i] !== modified[i]) {
        differentChars++;
      }
    }
    
    // 加上长度差异
    differentChars += Math.abs(original.length - modified.length);
    
    return (differentChars / maxLength) * 100;
  }
  
  // 合并问题类型分布
  private mergeIssueTypeDistributions(
    distributions: Record<string, number>[]
  ): Record<string, number> {
    const merged: Record<string, number> = {};
    
    distributions.forEach(distribution => {
      Object.keys(distribution).forEach(key => {
        merged[key] = (merged[key] || 0) + distribution[key];
      });
    });
    
    return merged;
  }
  
  // 合并严重程度计数
  private mergeSeverityCounts(
    counts: { low: number; medium: number; high: number; critical: number; }[]
  ): { low: number; medium: number; high: number; critical: number; } {
    return {
      low: counts.reduce((sum, count) => sum + count.low, 0),
      medium: counts.reduce((sum, count) => sum + count.medium, 0),
      high: counts.reduce((sum, count) => sum + count.high, 0),
      critical: counts.reduce((sum, count) => sum + count.critical, 0)
    };
  }
  
  // 查找质量最差的段落
  private findWorstSegments(
    reports: SegmentQualityReport[],
    count: number
  ): SegmentQualityReport[] {
    return [...reports]
      .sort((a, b) => a.qualityScore - b.qualityScore)
      .slice(0, count);
  }
  
  // 计算完成时间
  private calculateCompletionTime(segments: ISegment[]): number {
    // 获取第一个翻译开始时间和最后一个审校完成时间
    const translationStartTimes = segments
      .map(s => s.translationCompletedAt)
      .filter(Boolean) as Date[];
    
    const reviewCompletionTimes = segments
      .map(s => s.reviewCompletedAt)
      .filter(Boolean) as Date[];
    
    if (translationStartTimes.length === 0 || reviewCompletionTimes.length === 0) {
      return 0;
    }
    
    const firstTranslation = new Date(
      Math.min(...translationStartTimes.map(d => d.getTime()))
    );
    
    const lastReview = new Date(
      Math.max(...reviewCompletionTimes.map(d => d.getTime()))
    );
    
    // 返回毫秒差异转换为分钟
    return (lastReview.getTime() - firstTranslation.getTime()) / (1000 * 60);
  }
}
```

#### 5.5.2 质量报告生成

```typescript
// 质量报告服务
class QualityReportService {
  constructor(
    private qualityAssessmentService: QualityAssessmentService,
    private fileService: FileService,
    private projectService: ProjectService
  ) {}
  
  // 生成文件质量报告
  async generateFileReport(fileId: string): Promise<FileQualityReport> {
    return this.qualityAssessmentService.assessFileQuality(fileId);
  }
  
  // 生成项目质量报告
  async generateProjectReport(projectId: string): Promise<ProjectQualityReport> {
    // 获取项目下的所有文件
    const files = await this.fileService.getFilesByProjectId(projectId);
    
    // 生成每个文件的质量报告
    const fileReports: FileQualityReport[] = [];
    for (const file of files) {
      try {
        const report = await this.generateFileReport(file._id.toString());
        fileReports.push(report);
      } catch (error) {
        console.error(`生成文件报告失败: ${file._id}`, error);
      }
    }
    
    // 计算项目平均质量分数
    const averageQualityScore = fileReports.length > 0
      ? fileReports.reduce((sum, report) => sum + report.averageQualityScore, 0) / fileReports.length
      : 0;
    
    // 获取项目信息
    const project = await this.projectService.getProjectById(projectId);
    
    // 合并所有文件的问题类型分布
    const issueTypeDistribution = this.mergeIssueTypeDistributions(
      fileReports.map(report => report.issueTypeDistribution)
    );
    
    // 计算总段落数
    const totalSegments = fileReports.reduce(
      (sum, report) => sum + report.segmentCount, 0
    );
    
    // 构建项目质量报告
    return {
      projectId,
      projectName: project.name,
      fileCount: files.length,
      totalSegments,
      averageQualityScore,
      qualityGrade: this.calculateQualityGrade(averageQualityScore),
      totalIssueCount: fileReports.reduce(
        (sum, report) => sum + report.totalIssueCount, 0
      ),
      issueTypeDistribution,
      severityCounts: this.mergeSeverityCounts(
        fileReports.map(report => report.severityCounts)
      ),
      averageModificationRate: fileReports.length > 0
        ? fileReports.reduce((sum, report) => sum + report.averageModificationRate, 0) / fileReports.length
        : 0,
      fileReports: fileReports.sort((a, b) => a.averageQualityScore - b.averageQualityScore),
      completionTime: this.calculateTotalCompletionTime(fileReports)
    };
  }
  
  // 计算质量等级
  private calculateQualityGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }
  
  // 合并问题类型分布
  private mergeIssueTypeDistributions(
    distributions: Record<string, number>[]
  ): Record<string, number> {
    const merged: Record<string, number> = {};
    
    distributions.forEach(distribution => {
      Object.keys(distribution).forEach(key => {
        merged[key] = (merged[key] || 0) + distribution[key];
      });
    });
    
    return merged;
  }
  
  // 合并严重程度计数
  private mergeSeverityCounts(
    counts: { low: number; medium: number; high: number; critical: number; }[]
  ): { low: number; medium: number; high: number; critical: number; } {
    return {
      low: counts.reduce((sum, count) => sum + count.low, 0),
      medium: counts.reduce((sum, count) => sum + count.medium, 0),
      high: counts.reduce((sum, count) => sum + count.high, 0),
      critical: counts.reduce((sum, count) => sum + count.critical, 0)
    };
  }
  
  // 计算总完成时间
  private calculateTotalCompletionTime(fileReports: FileQualityReport[]): number {
    return fileReports.reduce((sum, report) => sum + report.completionTime, 0);
  }
}
```

### 5.6 跨语言问题检测

系统会特别关注在特定语言对中容易出现的典型翻译问题：

#### 5.6.1 语言相关问题检测

```typescript
// 语言相关问题检测器
class LanguageSpecificIssueDetector {
  // 语言对配置
  private languagePairConfigs: Map<string, LanguagePairConfig> = new Map();
  
  constructor() {
    // 初始化常见语言对的问题检测配置
    this.initLanguagePairConfigs();
  }
  
  // 初始化语言对配置
  private initLanguagePairConfigs() {
    // 英文到中文的常见问题
    this.languagePairConfigs.set('en-zh', {
      terminologyPatterns: [
        // 专业术语正则表达式
      ],
      structuralPatterns: [
        // 句式结构规则
        { source: /(.+) is (.+)/, target: /(.+)是(.+)/ }
      ],
      culturalReferences: [
        // 文化参考词汇
      ],
      specialFormatChecks: [
        // 特殊格式检查
        { type: 'number', source: /(\d+)/, target: /(\d+)/ }
      ]
    });
    
    // 中文到英文的常见问题
    this.languagePairConfigs.set('zh-en', {
      terminologyPatterns: [
        // 专业术语正则表达式
      ],
      structuralPatterns: [
        // 句式结构规则
      ],
      culturalReferences: [
        // 文化参考词汇
      ],
      specialFormatChecks: [
        // 特殊格式检查
      ]
    });
    
    // 可以添加更多语言对...
  }
  
  // 检测语言相关问题
  async detectIssues(
    sourceText: string,
    translatedText: string,
    sourceLang: string,
    targetLang: string
  ): Promise<IssueData[]> {
    const issues: IssueData[] = [];
    
    // 获取语言对配置
    const pairKey = `${sourceLang}-${targetLang}`;
    const config = this.languagePairConfigs.get(pairKey);
    
    if (!config) {
      return issues; // 如果没有配置，返回空数组
    }
    
    // 检查专业术语
    issues.push(...this.checkTerminology(
      sourceText, translatedText, config
    ));
    
    // 检查句式结构
    issues.push(...this.checkStructure(
      sourceText, translatedText, config
    ));
    
    // 检查文化参考
    issues.push(...this.checkCulturalReferences(
      sourceText, translatedText, config
    ));
    
    // 检查特殊格式
    issues.push(...this.checkSpecialFormats(
      sourceText, translatedText, config
    ));
    
    return issues;
  }
  
  // 检查专业术语
  private checkTerminology(
    sourceText: string,
    translatedText: string,
    config: LanguagePairConfig
  ): IssueData[] {
    const issues: IssueData[] = [];
    
    // 实现术语检查逻辑
    // ...
    
    return issues;
  }
  
  // 检查句式结构
  private checkStructure(
    sourceText: string,
    translatedText: string,
    config: LanguagePairConfig
  ): IssueData[] {
    const issues: IssueData[] = [];
    
    // 实现句式结构检查逻辑
    // ...
    
    return issues;
  }
  
  // 检查文化参考
  private checkCulturalReferences(
    sourceText: string,
    translatedText: string,
    config: LanguagePairConfig
  ): IssueData[] {
    const issues: IssueData[] = [];
    
    // 实现文化参考检查逻辑
    // ...
    
    return issues;
  }
  
  // 检查特殊格式
  private checkSpecialFormats(
    sourceText: string,
    translatedText: string,
    config: LanguagePairConfig
  ): IssueData[] {
    const issues: IssueData[] = [];
    
    // 实现特殊格式检查逻辑
    // ...
    
    return issues;
  }
}

// 语言对配置接口
interface LanguagePairConfig {
  terminologyPatterns: any[]; // 专业术语模式
  structuralPatterns: { source: RegExp; target: RegExp }[]; // 句式结构模式
  culturalReferences: any[]; // 文化参考词汇
  specialFormatChecks: { type: string; source: RegExp; target: RegExp }[]; // 特殊格式检查
}
```

## 6. 跨模块集成

### 6.1 模块间交互

#### 6.1.1 文件处理→翻译
- 文件处理模块提供段落数据给翻译模块
- 翻译模块更新段落的翻译状态和结果
- 文件处理模块接收翻译完成的通知

#### 6.1.2 翻译→审校
- 翻译模块提供翻译结果给审校模块
- 审校模块返回问题和修改建议
- 翻译模块接收审校反馈用于质量改进

#### 6.1.3 审校→文件处理
- 审校模块提供最终确认的译文
- 文件处理模块重构完整的译文文档
- 审校模块接收文件完成状态更新

### 6.2 数据流

```
文件上传 → 文件解析 → 文本分段 → AI翻译 → AI审校 → 人工审校 → 译文重构 → 译文下载
```

### 6.3 通知系统

- 使用WebSocket提供实时进度更新
- 任务状态变更通知
- 新任务分配通知
- 错误和警告通知
- 完成通知

## 7. API规范

### 7.1 文件处理API

```
POST   /api/files                   - 上传文件
GET    /api/files                   - 获取文件列表
GET    /api/files/:id               - 获取文件详情
DELETE /api/files/:id               - 删除文件
PUT    /api/files/:id/status        - 更新文件状态
POST   /api/files/:id/process       - 处理文件分段
GET    /api/files/:id/segments      - 获取文件段落
GET    /api/files/:id/download      - 下载译文文件
```

### 7.2 翻译API

```
POST   /api/translations/segments/:id       - 翻译单个段落
POST   /api/translations/files/:id          - 翻译整个文件
GET    /api/translations/jobs/:id           - 获取翻译任务状态
DELETE /api/translations/jobs/:id           - 取消翻译任务
POST   /api/translations/text               - 翻译自由文本(不保存)
GET    /api/translations/memory             - 查询翻译记忆
```

### 7.3 审校API

```
POST   /api/reviews/segments/:id           - 审校段落
GET    /api/reviews/segments/:id           - 获取段落审校结果
GET    /api/reviews/segments/:id/issues    - 获取段落问题
POST   /api/reviews/segments/:id/issues    - 创建问题
PUT    /api/reviews/issues/:id             - 更新问题
POST   /api/reviews/issues/:id/resolve     - 解决问题
POST   /api/reviews/segments/:id/submit    - 提交人工审校结果
POST   /api/reviews/files/:id              - 审校整个文件
```

## 8. 部署与配置

### 8.1 环境配置

- 开发环境
- 测试环境
- 生产环境

### 8.2 系统要求

- Node.js v16+
- MongoDB v4.4+
- Redis 6+
- 至少2GB RAM
- 存储空间根据预期文件量调整

### 8.3 安全考虑

- API密钥安全存储
- 文件访问控制
- 用户认证和授权
- 数据加密
- CSRF和XSS防护

## 9. 核心特有功能

### 9.1 本地化文件格式支持

系统特别支持专业翻译和本地化行业使用的标准文件格式：

#### 9.1.1 XLIFF支持

**XLIFF (XML Localization Interchange File Format)**：
- 支持XLIFF 1.2标准
- 提取翻译单元(trans-unit)
- 保留原始标记和格式
- 支持双向翻译（导入/导出）
- 保留翻译状态和批注

#### 9.1.2 MemoQ XLIFF支持

**MemoQ XLIFF**：
- 支持MemoQ特定的XLIFF扩展
- 处理MemoQ命名空间
- 支持MemoQ特有元数据（匹配率、状态等）
- 保留分段信息
- 兼容MemoQ工作流程

### 9.2 翻译记忆与术语管理

- 自动构建翻译记忆数据库
- 模糊匹配和精确匹配支持
- 术语一致性检查
- 领域术语定制
- 术语提取和建议

### 9.3 批量处理优化

- 智能任务分配
- 并行处理大文件
- 断点续传
- 进度实时监控
- 资源使用优化

## 10. 未来扩展

### 10.1 计划功能

- 用户管理与权限系统
- 项目管理工作流
- 高级提示词管理
- 自定义审校规则
- 质量评估报告

### 10.2 集成方向

- 翻译管理系统(TMS)集成
- 内容管理系统(CMS)连接器
- API接口扩展
- 多供应商AI服务整合
- 自动化部署流程

## 11. XLIFF处理器详细设计

### 11.1 XLIFF处理流程

#### 11.1.1 读取流程
1. 解析XLIFF文件XML结构
2. 根据文件类型(标准XLIFF或MemoQ XLIFF)选择不同的命名空间
3. 提取文件元数据(语言对、原始文件名等)
4. 定位并提取所有翻译单元(trans-unit)
5. 为每个翻译单元创建段落记录
6. 读取现有翻译(如果文件中已存在)
7. 保存到数据库

#### 11.1.2 写入流程
1. 读取原始XLIFF文件
2. 从数据库获取所有段落的最终翻译
3. 为每个翻译单元更新或创建target元素
4. 更新翻译状态属性
5. 保留所有原始格式和标记
6. 写入更新后的XLIFF文件

### 11.2 命名空间处理

```typescript
// 命名空间配置
private setupNamespaces(isMemoQ: boolean): void {
  const namespaces: Record<string, string> = {
    'xml': 'http://www.w3.org/XML/1998/namespace'
  };
  
  if (isMemoQ) {
    namespaces['m'] = 'http://www.memoq.com/memoq/xliff';
    namespaces['xliff'] = 'urn:oasis:names:tc:xliff:document:1.2';
  } else {
    namespaces['xliff'] = 'urn:oasis:names:tc:xliff:document:1.2';
  }
  
  this.select = xpath.useNamespaces(namespaces);
}
```

### 11.3 翻译单元提取

#### 11.3.1 标准XLIFF

```typescript
private extractStandardXliffSegments(doc: Document): any[] {
  const segments: any[] = [];
  const transUnits = this.select('//xliff:trans-unit', doc) as Node[];
  
  transUnits.forEach((unit, index) => {
    const id = (unit as Element).getAttribute('id');
    const source = this.select('string(./xliff:source)', unit) as string;
    
    // 获取目标文本(如果存在)
    let target = '';
    const targetNode = this.select('./xliff:target', unit)[0] as Element | undefined;
    if (targetNode) {
      target = targetNode.textContent || '';
    }
    
    segments.push({
      id,
      sourceText: this.cleanText(source),
      aiTranslation: target ? this.cleanText(target) : undefined,
      index,
      metadata: {
        state: (targetNode?.getAttribute('state') || ''),
        approved: (targetNode?.getAttribute('approved') === 'yes')
      }
    });
  });
  
  return segments;
}
```

#### 11.3.2 MemoQ XLIFF

```typescript
private extractMemoQSegments(doc: Document): any[] {
  const segments: any[] = [];
  const transUnits = this.select('//m:trans-unit', doc) as Node[];
  
  transUnits.forEach((unit, index) => {
    const id = (unit as Element).getAttribute('id');
    const source = this.select('string(./m:source)', unit) as string;
    
    // 获取目标文本(如果存在)
    let target = '';
    const targetNode = this.select('./m:target', unit)[0] as Element | undefined;
    if (targetNode) {
      target = targetNode.textContent || '';
    }
    
    // 提取MemoQ特有的元数据
    const matchQuality = (unit as Element).getAttribute('m:match-quality');
    const matchRate = (unit as Element).getAttribute('m:match-rate');
    const status = (unit as Element).getAttribute('m:status');
    
    segments.push({
      id,
      sourceText: this.cleanText(source),
      aiTranslation: target ? this.cleanText(target) : undefined,
      index,
      metadata: {
        matchQuality,
        matchRate,
        status,
        state: (targetNode?.getAttribute('state') || '')
      }
    });
  });
  
  return segments;
}
```

### 11.4 标记和格式处理

```typescript
// 清理文本，保留标记
private cleanText(text: string): string {
  // 基本清理：修剪空白，规范化空格
  let cleaned = text.trim().replace(/\s+/g, ' ');
  
  // 保留内联标记如<g>, <x>, <bx>, <ex>等
  // 这里可以实现复杂的标记保留逻辑
  
  return cleaned;
}

// 还原内联标记
private restoreInlineMarkup(segment: ISegment, originalText: string): string {
  // 实现标记还原逻辑，确保翻译后的文本包含原始标记
  // 这是本地化处理的关键部分
  
  return segment.finalTranslation || segment.aiTranslation || '';
}
```

### 11.5 状态跟踪

```typescript
// 从翻译状态映射到XLIFF状态
private mapStatusToXliffState(segment: ISegment): string {
  switch (segment.status) {
    case 'translated':
      return 'translated';
    case 'reviewed':
    case 'completed':
      return 'final';
    default:
      return 'new';
  }
}

// 更新翻译单元状态
private updateUnitStatus(
  unit: Element, 
  targetNode: Element, 
  segment: ISegment, 
  isMemoQ: boolean
): void {
  const state = this.mapStatusToXliffState(segment);
  
  // 设置target状态
  targetNode.setAttribute('state', state);
  
  // MemoQ特有状态
  if (isMemoQ && segment.status === 'reviewed') {
    unit.setAttribute('m:status', 'Confirmed');
  } else if (isMemoQ && segment.status === 'translated') {
    unit.setAttribute('m:status', 'Translated');
  }
}
```

## 12. 集成测试计划

### 12.1 文件处理测试

- XLIFF文件读取测试
- MemoQ XLIFF文件读取测试
- 段落提取准确性测试
- 元数据提取测试
- 大文件性能测试
- 错误处理测试

### 12.2 翻译流程测试

- 单段落翻译测试
- 整文件翻译流程测试
- 翻译API集成测试
- 翻译记忆匹配测试
- 术语应用测试

### 12.3 审校流程测试

- AI审校准确性测试
- 问题检测测试
- 人工审校流程测试
- 质量评估测试

### 12.4 端到端测试

- 完整翻译工作流测试
- XLIFF导入导出测试
- MemoQ兼容性测试
- 多语言支持测试
- 性能负载测试