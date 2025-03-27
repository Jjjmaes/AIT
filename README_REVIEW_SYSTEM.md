# 翻译审校系统

## 系统概述

翻译审校系统是翻译平台的核心组件之一，提供基于AI和人工的翻译质量审校功能。该系统支持单个段落、批量段落、整个文件的审校，以及直接文本审校功能，可以识别翻译错误、提供修改建议，并给出翻译质量评分。

## 核心功能

1. **AI 自动审校**：使用多种AI模型对翻译内容进行自动审校，生成评分和修改建议
2. **队列管理**：通过队列系统异步处理审校任务，支持优先级和并发控制
3. **批量处理**：支持批量段落和整个文件的审校处理
4. **错误识别**：识别多种类型的翻译问题，包括遗漏、误译、语法错误等
5. **修改建议**：提供具体的修改建议，帮助改进翻译质量
6. **质量评分**：为翻译内容提供多维度的质量评分

## 系统架构

审校系统由以下几个主要组件构成：

1. **审校控制器**：处理API请求，管理审校任务
2. **队列服务**：异步处理审校任务，管理任务状态和结果
3. **审校处理器**：执行实际的审校逻辑，处理不同类型的审校任务
4. **AI审校服务**：连接各种AI模型，执行具体的审校操作
5. **数据存储**：保存审校结果、修改建议和评分

## API 接口说明

### 审校队列接口

#### 段落审校

```
POST /api/review/queue/segment
```

将单个段落提交到审校队列中进行异步处理。

请求体：
```json
{
  "segmentId": "60d21b4667d0d8992e610c85",
  "options": {
    "sourceLanguage": "en",
    "targetLanguage": "zh-CN",
    "model": "gpt-4",
    "aiProvider": "openai",
    "customPrompt": "请仔细审校这段翻译，特别注意专业术语",
    "contextSegments": [
      {
        "sourceContent": "Previous paragraph content",
        "targetContent": "前一段落的翻译内容",
        "position": "before"
      }
    ],
    "priority": 2
  }
}
```

#### 文本直接审校

```
POST /api/review/queue/text
```

将一段原文和译文直接提交到审校队列，无需先在系统中创建段落。

请求体：
```json
{
  "originalText": "This is the source text that needs to be reviewed.",
  "translatedText": "这是需要审校的译文。",
  "options": {
    "sourceLanguage": "en",
    "targetLanguage": "zh-CN",
    "model": "gpt-4",
    "aiProvider": "openai",
    "customPrompt": "请审校这段翻译",
    "priority": 1
  }
}
```

#### 批量段落审校

```
POST /api/review/queue/batch
```

将多个段落批量提交到审校队列。

请求体：
```json
{
  "segmentIds": [
    "60d21b4667d0d8992e610c85",
    "60d21b4667d0d8992e610c86",
    "60d21b4667d0d8992e610c87"
  ],
  "options": {
    "sourceLanguage": "en",
    "targetLanguage": "zh-CN",
    "model": "gpt-4",
    "aiProvider": "openai",
    "batchSize": 10,
    "concurrentLimit": 3,
    "stopOnError": false,
    "onlyNew": true,
    "priority": 1
  }
}
```

#### 文件审校

```
POST /api/review/queue/file
```

提交整个文件的所有段落进行审校。

请求体：
```json
{
  "fileId": "60d21b4667d0d8992e610c90",
  "options": {
    "sourceLanguage": "en",
    "targetLanguage": "zh-CN",
    "model": "gpt-4",
    "aiProvider": "openai",
    "onlyNew": true,
    "batchSize": 20,
    "concurrentLimit": 5,
    "stopOnError": false,
    "priority": 3
  }
}
```

#### 查询任务状态

```
GET /api/review/queue/status/:taskId
```

查询审校任务的状态和结果。

返回示例：
```json
{
  "taskId": "task_12345",
  "status": "completed",
  "type": "REVIEW",
  "dataType": "segmentReview",
  "createdAt": "2023-06-15T10:30:00Z",
  "startedAt": "2023-06-15T10:30:05Z",
  "completedAt": "2023-06-15T10:31:00Z",
  "result": {
    "score": 85,
    "suggestedTranslation": "改进后的翻译内容",
    "issues": [
      {
        "type": "mistranslation",
        "description": "术语翻译不准确",
        "position": { "start": 10, "end": 15 },
        "suggestion": "建议的修改"
      }
    ]
  }
}
```

#### 取消任务

```
DELETE /api/review/queue/:taskId
```

取消一个正在等待或执行中的审校任务。

## 审校处理器

审校处理器负责处理从队列接收的审校任务，主要支持以下任务类型：

1. **segmentReview**: 单个段落审校
2. **batchSegmentReview**: 批量段落审校
3. **fileReview**: 文件审校
4. **textReview**: 直接文本审校

处理器会根据任务类型调用相应的处理方法，执行AI审校操作，并将结果保存到数据库。

## 错误处理

审校系统实现了全面的错误处理机制：

1. 任务级重试：队列系统会自动重试失败的任务
2. 段落级重试：批量处理中单个段落失败可以单独重试
3. 错误分类：区分临时性错误和永久性错误
4. 详细日志：记录处理过程中的每一步操作和错误

## 配置选项

审校任务支持多种配置选项：

- **model**: 使用的AI模型 (gpt-3.5-turbo, gpt-4等)
- **aiProvider**: AI提供商 (openai, baidu, aliyun等)
- **customPrompt**: 自定义审校提示
- **contextSegments**: 上下文段落，提供审校参考
- **batchSize**: 批处理大小
- **concurrentLimit**: 并发处理数量
- **stopOnError**: 错误时是否停止整个批处理
- **priority**: 任务优先级 (1-5)

## 性能考虑

审校系统设计时充分考虑了性能因素：

1. 异步处理：使用队列系统异步处理审校任务
2. 批量处理：支持批量审校以提高吞吐量
3. 并发控制：可配置的并发限制，避免系统过载
4. 优先级队列：重要任务可以优先处理

## 使用示例

### JavaScript/TypeScript 客户端示例

```typescript
async function reviewSegment(segmentId) {
  const response = await fetch('/api/review/queue/segment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${yourAuthToken}`
    },
    body: JSON.stringify({
      segmentId,
      options: {
        model: 'gpt-4',
        aiProvider: 'openai',
        priority: 2
      }
    })
  });
  
  const { taskId } = await response.json();
  return taskId;
}

async function checkTaskStatus(taskId) {
  const response = await fetch(`/api/review/queue/status/${taskId}`, {
    headers: {
      'Authorization': `Bearer ${yourAuthToken}`
    }
  });
  
  return await response.json();
}
```

## 集成指南

要将审校系统集成到现有应用中：

1. 确保用户通过 JWT 身份验证
2. 根据需要调用审校 API 接口
3. 使用任务ID查询审校结果
4. 根据审校结果更新翻译内容或呈现给用户

## 常见问题

1. **任务处理时间**：审校任务处理时间取决于AI模型和任务复杂度，通常在几秒到几分钟不等
2. **最大批量大小**：建议批量审校不超过100个段落，文件审校不限制段落数量但会内部分批处理
3. **支持的语言**：支持所有主流语言对，具体支持情况取决于所选AI模型

## 未来扩展计划

1. 添加人工审校工作流
2. 支持更多AI模型和提供商
3. 增加审校模板功能
4. 添加质量报告和统计功能
5. 实现自适应审校策略 