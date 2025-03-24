"use strict";
// src/validators/segmentValidator.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBatchUpdateSegmentStatus = exports.validateCompleteSegmentReview = exports.validateResolveSegmentIssue = exports.validateAddSegmentIssue = exports.validateUpdateSegmentTranslation = exports.validateReviewSegment = exports.validateTranslateSegment = void 0;
const express_validator_1 = require("express-validator");
const segment_model_1 = require("../models/segment.model");
// 翻译段落验证
exports.validateTranslateSegment = [
    (0, express_validator_1.param)('segmentId')
        .notEmpty().withMessage('段落ID不能为空')
        .isMongoId().withMessage('段落ID格式无效'),
    (0, express_validator_1.body)('promptTemplateId')
        .optional()
        .isMongoId().withMessage('提示词模板ID格式无效'),
    (0, express_validator_1.body)('aiModel')
        .optional()
        .isString().withMessage('AI模型必须是字符串')
];
// 审校段落验证
exports.validateReviewSegment = [
    (0, express_validator_1.param)('segmentId')
        .notEmpty().withMessage('段落ID不能为空')
        .isMongoId().withMessage('段落ID格式无效'),
    (0, express_validator_1.body)('promptTemplateId')
        .optional()
        .isMongoId().withMessage('提示词模板ID格式无效'),
    (0, express_validator_1.body)('aiModel')
        .optional()
        .isString().withMessage('AI模型必须是字符串')
];
// 更新段落翻译验证
exports.validateUpdateSegmentTranslation = [
    (0, express_validator_1.param)('segmentId')
        .notEmpty().withMessage('段落ID不能为空')
        .isMongoId().withMessage('段落ID格式无效'),
    (0, express_validator_1.body)('finalTranslation')
        .notEmpty().withMessage('最终翻译不能为空')
        .isString().withMessage('最终翻译必须是字符串'),
    (0, express_validator_1.body)('status')
        .optional()
        .isIn([segment_model_1.SegmentStatus.TRANSLATED, segment_model_1.SegmentStatus.REVIEWING]).withMessage('状态值无效')
];
// 添加段落问题验证
exports.validateAddSegmentIssue = [
    (0, express_validator_1.param)('segmentId')
        .notEmpty().withMessage('段落ID不能为空')
        .isMongoId().withMessage('段落ID格式无效'),
    (0, express_validator_1.body)('type')
        .notEmpty().withMessage('问题类型不能为空')
        .isIn(Object.values(segment_model_1.IssueType)).withMessage('问题类型无效'),
    (0, express_validator_1.body)('description')
        .notEmpty().withMessage('问题描述不能为空')
        .isString().withMessage('问题描述必须是字符串'),
    (0, express_validator_1.body)('position')
        .optional()
        .isObject().withMessage('位置必须是对象')
        .custom((value) => {
        if (value && (typeof value.start !== 'number' || typeof value.end !== 'number')) {
            throw new Error('位置的起始和结束必须是数字');
        }
        if (value && value.start > value.end) {
            throw new Error('位置的起始不能大于结束');
        }
        return true;
    }),
    (0, express_validator_1.body)('suggestion')
        .optional()
        .isString().withMessage('建议必须是字符串')
];
// 解决段落问题验证
exports.validateResolveSegmentIssue = [
    (0, express_validator_1.param)('segmentId')
        .notEmpty().withMessage('段落ID不能为空')
        .isMongoId().withMessage('段落ID格式无效'),
    (0, express_validator_1.param)('issueId')
        .notEmpty().withMessage('问题ID不能为空')
        .isMongoId().withMessage('问题ID格式无效')
];
// 完成段落审校验证
exports.validateCompleteSegmentReview = [
    (0, express_validator_1.param)('segmentId')
        .notEmpty().withMessage('段落ID不能为空')
        .isMongoId().withMessage('段落ID格式无效'),
    (0, express_validator_1.body)('finalTranslation')
        .notEmpty().withMessage('最终翻译不能为空')
        .isString().withMessage('最终翻译必须是字符串'),
    (0, express_validator_1.body)('acceptedChanges')
        .optional()
        .isBoolean().withMessage('接受修改必须是布尔值'),
    (0, express_validator_1.body)('modificationDegree')
        .optional()
        .isFloat({ min: 0, max: 1 }).withMessage('修改程度必须是0-1之间的数字')
];
// 批量更新段落状态验证
exports.validateBatchUpdateSegmentStatus = [
    (0, express_validator_1.body)('segmentIds')
        .notEmpty().withMessage('段落ID列表不能为空')
        .isArray().withMessage('段落ID列表必须是数组')
        .custom((value) => {
        if (!Array.isArray(value) || !value.every(id => /^[0-9a-fA-F]{24}$/.test(id))) {
            throw new Error('段落ID列表中包含无效的ID');
        }
        return true;
    }),
    (0, express_validator_1.body)('status')
        .notEmpty().withMessage('状态不能为空')
        .isIn(Object.values(segment_model_1.SegmentStatus)).withMessage('状态值无效')
];
