// src/validators/segmentValidator.ts

import { z } from 'zod';
import { SegmentStatus, IssueType } from '../models/segment.model';
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