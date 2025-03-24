"use strict";
// src/validators/fileValidator.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateGetFileSegments = exports.validateProcessFile = exports.validateGetFiles = exports.validateUpdateFileStatus = exports.validateFileUpload = void 0;
const express_validator_1 = require("express-validator");
const file_model_1 = require("../models/file.model");
// 上传文件验证（针对请求中可能包含的元数据）
exports.validateFileUpload = [
    (0, express_validator_1.body)('projectId')
        .notEmpty().withMessage('项目ID不能为空')
        .isMongoId().withMessage('项目ID格式无效'),
    (0, express_validator_1.body)('type')
        .optional()
        .isIn(Object.values(file_model_1.FileType)).withMessage('文件类型无效')
];
// 更新文件状态验证
exports.validateUpdateFileStatus = [
    (0, express_validator_1.param)('fileId')
        .notEmpty().withMessage('文件ID不能为空')
        .isMongoId().withMessage('文件ID格式无效'),
    (0, express_validator_1.body)('status')
        .notEmpty().withMessage('状态不能为空')
        .isIn(Object.values(file_model_1.FileStatus)).withMessage('状态值无效')
];
// 获取文件列表验证
exports.validateGetFiles = [
    (0, express_validator_1.query)('projectId')
        .notEmpty().withMessage('项目ID不能为空')
        .isMongoId().withMessage('项目ID格式无效'),
    (0, express_validator_1.query)('status')
        .optional()
        .isIn(Object.values(file_model_1.FileStatus)).withMessage('状态值无效'),
    (0, express_validator_1.query)('type')
        .optional()
        .isIn(Object.values(file_model_1.FileType)).withMessage('文件类型无效')
];
// 处理文件验证
exports.validateProcessFile = [
    (0, express_validator_1.param)('fileId')
        .notEmpty().withMessage('文件ID不能为空')
        .isMongoId().withMessage('文件ID格式无效'),
    (0, express_validator_1.body)('segmentationOptions')
        .optional()
        .isObject().withMessage('分段选项必须是对象')
];
// 获取文件段落验证
exports.validateGetFileSegments = [
    (0, express_validator_1.param)('fileId')
        .notEmpty().withMessage('文件ID不能为空')
        .isMongoId().withMessage('文件ID格式无效'),
    (0, express_validator_1.query)('page')
        .optional()
        .isInt({ min: 1 }).withMessage('页码必须是大于0的整数'),
    (0, express_validator_1.query)('limit')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('每页数量必须是1-100之间的整数'),
    (0, express_validator_1.query)('status')
        .optional()
        .isString().withMessage('状态必须是字符串')
];
