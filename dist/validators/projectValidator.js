"use strict";
// src/validators/projectValidator.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUpdateProject = exports.validateCreateProject = void 0;
const express_validator_1 = require("express-validator");
const project_model_1 = require("../models/project.model");
// 项目创建验证
exports.validateCreateProject = [
    (0, express_validator_1.body)('name')
        .trim()
        .notEmpty().withMessage('项目名称不能为空')
        .isLength({ min: 3, max: 100 }).withMessage('项目名称长度必须在3-100个字符之间'),
    (0, express_validator_1.body)('sourceLanguage')
        .trim()
        .notEmpty().withMessage('源语言不能为空'),
    (0, express_validator_1.body)('targetLanguage')
        .trim()
        .notEmpty().withMessage('目标语言不能为空'),
    (0, express_validator_1.body)('manager')
        .optional()
        .isMongoId().withMessage('管理者ID格式无效'),
    (0, express_validator_1.body)('reviewers')
        .optional()
        .isArray().withMessage('审校人员必须是数组')
        .custom((value) => {
        if (value && value.length > 0) {
            // 检查数组中的每个ID是否是有效的MongoDB ID
            const isValid = value.every((id) => /^[0-9a-fA-F]{24}$/.test(id));
            if (!isValid) {
                throw new Error('审校人员ID格式无效');
            }
        }
        return true;
    }),
    (0, express_validator_1.body)('translationPromptTemplate')
        .notEmpty().withMessage('翻译提示词模板不能为空')
        .isMongoId().withMessage('翻译提示词模板ID格式无效'),
    (0, express_validator_1.body)('reviewPromptTemplate')
        .notEmpty().withMessage('审校提示词模板不能为空')
        .isMongoId().withMessage('审校提示词模板ID格式无效'),
    (0, express_validator_1.body)('deadline')
        .optional()
        .isISO8601().withMessage('截止日期格式无效'),
    (0, express_validator_1.body)('priority')
        .optional()
        .isIn(Object.values(project_model_1.ProjectPriority)).withMessage('优先级值无效')
];
// 项目更新验证
exports.validateUpdateProject = [
    (0, express_validator_1.body)('name')
        .optional()
        .trim()
        .isLength({ min: 3, max: 100 }).withMessage('项目名称长度必须在3-100个字符之间'),
    (0, express_validator_1.body)('sourceLanguage')
        .optional()
        .trim(),
    (0, express_validator_1.body)('targetLanguage')
        .optional()
        .trim(),
    (0, express_validator_1.body)('manager')
        .optional()
        .isMongoId().withMessage('管理者ID格式无效'),
    (0, express_validator_1.body)('reviewers')
        .optional()
        .isArray().withMessage('审校人员必须是数组')
        .custom((value) => {
        if (value && value.length > 0) {
            const isValid = value.every((id) => /^[0-9a-fA-F]{24}$/.test(id));
            if (!isValid) {
                throw new Error('审校人员ID格式无效');
            }
        }
        return true;
    }),
    (0, express_validator_1.body)('translationPromptTemplate')
        .optional()
        .isMongoId().withMessage('翻译提示词模板ID格式无效'),
    (0, express_validator_1.body)('reviewPromptTemplate')
        .optional()
        .isMongoId().withMessage('审校提示词模板ID格式无效'),
    (0, express_validator_1.body)('deadline')
        .optional()
        .isISO8601().withMessage('截止日期格式无效'),
    (0, express_validator_1.body)('priority')
        .optional()
        .isIn(Object.values(project_model_1.ProjectPriority)).withMessage('优先级值无效'),
    (0, express_validator_1.body)('status')
        .optional()
        .isIn(Object.values(project_model_1.ProjectStatus)).withMessage('状态值无效')
];
