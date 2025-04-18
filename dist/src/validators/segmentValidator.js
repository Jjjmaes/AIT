"use strict";
// src/validators/segmentValidator.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBatchSegmentReview = exports.validateFileReview = exports.validateDirectTextReview = exports.validateBatchUpdateSegmentStatus = exports.validateCompleteSegmentReview = exports.validateResolveSegmentIssue = exports.validateAddSegmentIssue = exports.validateUpdateSegmentTranslation = exports.validateReviewSegment = exports.validateTranslateSegment = void 0;
const zod_1 = require("zod");
const segment_model_1 = require("../models/segment.model");
const common_1 = require("./common");
// 翻译段落验证
exports.validateTranslateSegment = zod_1.z.object({
    params: zod_1.z.object({
        segmentId: common_1.mongoIdSchema
    }),
    body: zod_1.z.object({
        promptTemplateId: common_1.mongoIdSchema
            .optional(),
        aiModel: zod_1.z.string()
            .optional()
    })
});
// 审校段落验证
exports.validateReviewSegment = zod_1.z.object({
    params: zod_1.z.object({
        segmentId: common_1.mongoIdSchema
    }),
    body: zod_1.z.object({
        promptTemplateId: common_1.mongoIdSchema
            .optional(),
        aiModel: zod_1.z.string()
            .optional()
    })
});
// 更新段落翻译验证
exports.validateUpdateSegmentTranslation = zod_1.z.object({
    params: zod_1.z.object({
        segmentId: common_1.mongoIdSchema
    }),
    body: zod_1.z.object({
        finalTranslation: zod_1.z.string()
            .min(1, '最终翻译不能为空'),
        status: (0, common_1.createEnumValidator)(segment_model_1.SegmentStatus)
            .optional()
    })
});
// 添加段落问题验证
exports.validateAddSegmentIssue = zod_1.z.object({
    params: zod_1.z.object({
        segmentId: common_1.mongoIdSchema
    }),
    body: zod_1.z.object({
        type: (0, common_1.createEnumValidator)(segment_model_1.IssueType),
        description: zod_1.z.string()
            .min(1, '问题描述不能为空'),
        position: zod_1.z.object({
            start: zod_1.z.number()
                .min(0, '位置的起始必须是非负数'),
            end: zod_1.z.number()
                .min(0, '位置的结束必须是非负数')
        })
            .refine(data => data.start <= data.end, {
            message: '起始位置不能大于结束位置'
        })
            .optional(),
        suggestion: zod_1.z.string()
            .optional()
    })
});
// 解决段落问题验证
exports.validateResolveSegmentIssue = zod_1.z.object({
    params: zod_1.z.object({
        segmentId: common_1.mongoIdSchema,
        issueId: common_1.mongoIdSchema
    })
});
// 完成段落审校验证
exports.validateCompleteSegmentReview = zod_1.z.object({
    params: zod_1.z.object({
        segmentId: common_1.mongoIdSchema
    }),
    body: zod_1.z.object({
        finalTranslation: zod_1.z.string()
            .min(1, '最终翻译不能为空'),
        acceptedChanges: zod_1.z.boolean()
            .optional(),
        modificationDegree: zod_1.z.number()
            .min(0, '修改程度必须是0-1之间的数字')
            .max(1, '修改程度必须是0-1之间的数字')
            .optional()
    })
});
// 批量更新段落状态验证
exports.validateBatchUpdateSegmentStatus = zod_1.z.object({
    body: zod_1.z.object({
        segmentIds: zod_1.z.array(common_1.mongoIdSchema)
            .min(1, '段落ID列表不能为空'),
        status: (0, common_1.createEnumValidator)(segment_model_1.SegmentStatus)
    })
});
// 直接审校文本验证
exports.validateDirectTextReview = zod_1.z.object({
    body: zod_1.z.object({
        original: zod_1.z.string()
            .min(1, '原文不能为空'),
        translation: zod_1.z.string()
            .min(1, '翻译不能为空'),
        sourceLanguage: zod_1.z.string()
            .min(1, '源语言不能为空'),
        targetLanguage: zod_1.z.string()
            .min(1, '目标语言不能为空'),
        model: zod_1.z.string()
            .optional(),
        customPrompt: zod_1.z.string()
            .optional(),
        requestedScores: zod_1.z.array((0, common_1.createEnumValidator)(segment_model_1.ReviewScoreType))
            .optional(),
        checkIssueTypes: zod_1.z.array((0, common_1.createEnumValidator)(segment_model_1.IssueType))
            .optional(),
        contextSegments: zod_1.z.array(zod_1.z.object({
            original: zod_1.z.string(),
            translation: zod_1.z.string()
        }))
            .optional()
    })
});
/**
 * 验证文件审校请求
 */
exports.validateFileReview = zod_1.z.object({
    body: zod_1.z.object({
        fileId: zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, '文件ID必须是有效的MongoDB ID'),
        options: zod_1.z.object({
            sourceLanguage: zod_1.z.string().min(2).max(10).optional(),
            targetLanguage: zod_1.z.string().min(2).max(10).optional(),
            model: zod_1.z.string().optional(),
            aiProvider: zod_1.z.string().optional(),
            provider: zod_1.z.string().optional(),
            customPrompt: zod_1.z.string().max(1000).optional(),
            onlyNew: zod_1.z.boolean().optional(),
            includeStatuses: zod_1.z.array(zod_1.z.string()).optional(),
            excludeStatuses: zod_1.z.array(zod_1.z.string()).optional(),
            batchSize: zod_1.z.number().int().min(1).max(100).optional(),
            concurrentLimit: zod_1.z.number().int().min(1).max(10).optional(),
            stopOnError: zod_1.z.boolean().optional(),
            priority: zod_1.z.number().int().min(1).max(5).optional()
        }).optional()
    })
});
/**
 * 验证批量段落审校请求
 */
exports.validateBatchSegmentReview = zod_1.z.object({
    body: zod_1.z.object({
        segmentIds: zod_1.z.array(zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, '段落ID必须是有效的MongoDB ID')).min(1, '至少需要一个段落ID').max(100, '一次最多可以提交100个段落'),
        options: zod_1.z.object({
            sourceLanguage: zod_1.z.string().min(2).max(10).optional(),
            targetLanguage: zod_1.z.string().min(2).max(10).optional(),
            model: zod_1.z.string().optional(),
            aiProvider: zod_1.z.string().optional(),
            provider: zod_1.z.string().optional(),
            customPrompt: zod_1.z.string().max(1000).optional(),
            contextSegments: zod_1.z.array(zod_1.z.object({
                sourceContent: zod_1.z.string(),
                targetContent: zod_1.z.string().optional(),
                position: zod_1.z.enum(['before', 'after'])
            })).max(10).optional(),
            batchSize: zod_1.z.number().int().min(1).max(50).optional(),
            concurrentLimit: zod_1.z.number().int().min(1).max(10).optional(),
            stopOnError: zod_1.z.boolean().optional(),
            onlyNew: zod_1.z.boolean().optional(),
            includeStatuses: zod_1.z.array(zod_1.z.string()).optional(),
            excludeStatuses: zod_1.z.array(zod_1.z.string()).optional(),
            priority: zod_1.z.number().int().min(1).max(5).optional()
        }).optional()
    })
});
