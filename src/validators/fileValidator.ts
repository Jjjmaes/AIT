// src/validators/fileValidator.ts

import { z } from 'zod';
import { FileStatus, FileType } from '../models/file.model';
import { mongoIdSchema, createEnumValidator, paginationSchema } from './common';

// 上传文件验证
export const validateFileUpload = z.object({
  body: z.object({
    projectId: mongoIdSchema,
    type: createEnumValidator(FileType)
      .optional()
  })
});

// 更新文件状态验证
export const validateUpdateFileStatus = z.object({
  params: z.object({
    fileId: mongoIdSchema
  }),
  body: z.object({
    status: createEnumValidator(FileStatus)
  })
});

// 获取文件列表验证
export const validateGetFiles = z.object({
  query: z.object({
    projectId: mongoIdSchema,
    status: createEnumValidator(FileStatus)
      .optional(),
    type: createEnumValidator(FileType)
      .optional()
  })
});

// 处理文件验证
export const validateProcessFile = z.object({
  params: z.object({
    fileId: mongoIdSchema
  }),
  body: z.object({
    segmentationOptions: z.record(z.unknown())
      .optional(),
    maxSegmentLength: z.number()
      .int('段落最大长度必须是整数')
      .min(1, '段落最大长度必须大于0')
      .optional(),
    minSegmentLength: z.number()
      .int('段落最小长度必须是整数')
      .min(1, '段落最小长度必须大于0')
      .optional(),
    preserveFormatting: z.boolean()
      .optional()
  })
});

// 获取文件段落验证
export const validateGetFileSegments = z.object({
  params: z.object({
    fileId: mongoIdSchema
  }),
  query: z.intersection(
    paginationSchema,
    z.object({
      status: z.string()
        .optional()
    })
  )
});

// 更新文件进度验证
export const validateUpdateFileProgress = z.object({
  params: z.object({
    fileId: mongoIdSchema
  }),
  body: z.object({
    status: createEnumValidator(FileStatus)
      .optional(),
    error: z.string()
      .optional()
  })
});