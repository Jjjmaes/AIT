// src/validators/segmentValidator.ts

import { z } from 'zod';
import { SegmentStatus, IssueType, ReviewScoreType } from '../models/segment.model';
import { mongoIdSchema, createEnumValidator } from './common';

// 翻译段落验证
export const validateTranslateSegment = z.object({
  params: z.object({
    segmentId: mongoIdSchema
  }),
  body: z.object({
    promptTemplateId: mongoIdSchema
      .optional(),
    aiModel: z.string()
      .optional()
  })
});

// 审校段落验证
export const validateReviewSegment = z.object({
  params: z.object({
    segmentId: mongoIdSchema
  }),
  body: z.object({
    promptTemplateId: mongoIdSchema
      .optional(),
    aiModel: z.string()
      .optional()
  })
});

// 更新段落翻译验证
export const validateUpdateSegmentTranslation = z.object({
  params: z.object({
    segmentId: mongoIdSchema
  }),
  body: z.object({
    finalTranslation: z.string()
      .min(1, '最终翻译不能为空'),
    status: createEnumValidator(SegmentStatus)
      .optional()
  })
});

// 添加段落问题验证
export const validateAddSegmentIssue = z.object({
  params: z.object({
    segmentId: mongoIdSchema
  }),
  body: z.object({
    type: createEnumValidator(IssueType),
    description: z.string()
      .min(1, '问题描述不能为空'),
    position: z.object({
      start: z.number()
        .min(0, '位置的起始必须是非负数'),
      end: z.number()
        .min(0, '位置的结束必须是非负数')
    })
      .refine(data => data.start <= data.end, {
        message: '起始位置不能大于结束位置'
      })
      .optional(),
    suggestion: z.string()
      .optional()
  })
});

// 解决段落问题验证
export const validateResolveSegmentIssue = z.object({
  params: z.object({
    segmentId: mongoIdSchema,
    issueId: mongoIdSchema
  })
});

// 完成段落审校验证
export const validateCompleteSegmentReview = z.object({
  params: z.object({
    segmentId: mongoIdSchema
  }),
  body: z.object({
    finalTranslation: z.string()
      .min(1, '最终翻译不能为空'),
    acceptedChanges: z.boolean()
      .optional(),
    modificationDegree: z.number()
      .min(0, '修改程度必须是0-1之间的数字')
      .max(1, '修改程度必须是0-1之间的数字')
      .optional()
  })
});

// 批量更新段落状态验证
export const validateBatchUpdateSegmentStatus = z.object({
  body: z.object({
    segmentIds: z.array(mongoIdSchema)
      .min(1, '段落ID列表不能为空'),
    status: createEnumValidator(SegmentStatus)
  })
});

// 直接审校文本验证
export const validateDirectTextReview = z.object({
  body: z.object({
    original: z.string()
      .min(1, '原文不能为空'),
    translation: z.string()
      .min(1, '翻译不能为空'),
    sourceLanguage: z.string()
      .min(1, '源语言不能为空'),
    targetLanguage: z.string()
      .min(1, '目标语言不能为空'),
    model: z.string()
      .optional(),
    customPrompt: z.string()
      .optional(),
    requestedScores: z.array(createEnumValidator(ReviewScoreType))
      .optional(),
    checkIssueTypes: z.array(createEnumValidator(IssueType))
      .optional(),
    contextSegments: z.array(
      z.object({
        original: z.string(),
        translation: z.string()
      })
    )
      .optional()
  })
});

/**
 * 验证文件审校请求
 */
export const validateFileReview = z.object({
  body: z.object({
    fileId: z.string().regex(/^[0-9a-fA-F]{24}$/, '文件ID必须是有效的MongoDB ID'),
    options: z.object({
      sourceLanguage: z.string().min(2).max(10).optional(),
      targetLanguage: z.string().min(2).max(10).optional(),
      model: z.string().optional(),
      aiProvider: z.string().optional(),
      provider: z.string().optional(),
      customPrompt: z.string().max(1000).optional(),
      onlyNew: z.boolean().optional(),
      includeStatuses: z.array(z.string()).optional(),
      excludeStatuses: z.array(z.string()).optional(),
      batchSize: z.number().int().min(1).max(100).optional(),
      concurrentLimit: z.number().int().min(1).max(10).optional(),
      stopOnError: z.boolean().optional(),
      priority: z.number().int().min(1).max(5).optional()
    }).optional()
  })
});

/**
 * 验证批量段落审校请求
 */
export const validateBatchSegmentReview = z.object({
  body: z.object({
    segmentIds: z.array(
      z.string().regex(/^[0-9a-fA-F]{24}$/, '段落ID必须是有效的MongoDB ID')
    ).min(1, '至少需要一个段落ID').max(100, '一次最多可以提交100个段落'),
    options: z.object({
      sourceLanguage: z.string().min(2).max(10).optional(),
      targetLanguage: z.string().min(2).max(10).optional(),
      model: z.string().optional(),
      aiProvider: z.string().optional(),
      provider: z.string().optional(),
      customPrompt: z.string().max(1000).optional(),
      contextSegments: z.array(z.object({
        sourceContent: z.string(),
        targetContent: z.string().optional(),
        position: z.enum(['before', 'after'])
      })).max(10).optional(),
      batchSize: z.number().int().min(1).max(50).optional(),
      concurrentLimit: z.number().int().min(1).max(10).optional(),
      stopOnError: z.boolean().optional(),
      onlyNew: z.boolean().optional(),
      includeStatuses: z.array(z.string()).optional(),
      excludeStatuses: z.array(z.string()).optional(),
      priority: z.number().int().min(1).max(5).optional()
    }).optional()
  })
});