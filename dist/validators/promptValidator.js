"use strict";
// src/validators/promptValidator.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateTestPrompt = exports.validateUpdatePrompt = exports.validateCreatePrompt = void 0;
const zod_1 = require("zod");
const promptTemplate_model_1 = require("../models/promptTemplate.model");
const common_1 = require("./common");
// 创建提示词模板验证
exports.validateCreatePrompt = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string()
            .min(3, '提示词模板名称长度必须在3-100个字符之间')
            .max(100, '提示词模板名称长度必须在3-100个字符之间'),
        type: (0, common_1.createEnumValidator)(promptTemplate_model_1.PromptTaskType),
        systemInstruction: zod_1.z.string()
            .min(10, '系统指令长度不能少于10个字符'),
        userInputTemplate: zod_1.z.string()
            .min(5, '用户输入模板长度不能少于5个字符'),
        variables: zod_1.z.array(zod_1.z.string())
            .optional(),
        sourceLanguages: zod_1.z.array(zod_1.z.string())
            .optional(),
        targetLanguages: zod_1.z.array(zod_1.z.string())
            .optional(),
        domains: zod_1.z.array(zod_1.z.string())
            .optional(),
        aiProvider: zod_1.z.string()
            .min(1, 'AI提供商不能为空'),
        aiModel: zod_1.z.string()
            .min(1, 'AI模型不能为空'),
        parentTemplate: common_1.mongoIdSchema
            .optional(),
    })
});
// 更新提示词模板验证
exports.validateUpdatePrompt = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string()
            .min(3, '提示词模板名称长度必须在3-100个字符之间')
            .max(100, '提示词模板名称长度必须在3-100个字符之间')
            .optional(),
        description: zod_1.z.string()
            .optional(),
        systemInstruction: zod_1.z.string()
            .min(10, '系统指令长度不能少于10个字符')
            .optional(),
        userInputTemplate: zod_1.z.string()
            .min(5, '用户输入模板长度不能少于5个字符')
            .optional(),
        outputFormat: zod_1.z.string()
            .optional(),
        variables: zod_1.z.array(zod_1.z.string())
            .optional(),
        sourceLanguages: zod_1.z.array(zod_1.z.string())
            .optional(),
        targetLanguages: zod_1.z.array(zod_1.z.string())
            .optional(),
        domains: zod_1.z.array(zod_1.z.string())
            .optional(),
        aiProvider: zod_1.z.string()
            .optional(),
        aiModel: zod_1.z.string()
            .optional(),
        version: zod_1.z.number()
            .int('版本必须是整数')
            .optional()
    })
});
// 测试提示词模板验证
exports.validateTestPrompt = zod_1.z.object({
    body: zod_1.z.object({
        promptId: common_1.mongoIdSchema,
        sampleInput: zod_1.z.string()
            .min(1, '测试输入不能为空'),
        variables: zod_1.z.record(zod_1.z.unknown())
            .optional()
    })
});
