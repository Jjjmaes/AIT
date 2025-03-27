"use strict";
// src/validators/segmentValidator.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBatchUpdateSegmentStatus = exports.validateCompleteSegmentReview = exports.validateResolveSegmentIssue = exports.validateAddSegmentIssue = exports.validateUpdateSegmentTranslation = exports.validateReviewSegment = exports.validateTranslateSegment = void 0;
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
