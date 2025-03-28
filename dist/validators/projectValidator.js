"use strict";
// src/validators/projectValidator.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUpdateProjectProgress = exports.validateUpdateProject = exports.validateCreateProject = void 0;
const zod_1 = require("zod");
const project_types_1 = require("../types/project.types");
const common_1 = require("./common");
// 项目创建验证
exports.validateCreateProject = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string()
            .min(1, '项目名称不能为空'),
        description: zod_1.z.string()
            .optional(),
        sourceLanguage: zod_1.z.string()
            .min(1, '源语言不能为空'),
        targetLanguage: zod_1.z.string()
            .min(1, '目标语言不能为空'),
        manager: common_1.mongoIdSchema
            .optional(),
        reviewers: zod_1.z.array(common_1.mongoIdSchema)
            .optional(),
        translationPromptTemplate: zod_1.z.string()
            .min(1, '翻译提示模板不能为空'),
        reviewPromptTemplate: zod_1.z.string()
            .min(1, '审阅提示模板不能为空'),
        deadline: zod_1.z.string()
            .datetime('截止日期格式无效')
            .optional(),
        priority: (0, common_1.createEnumValidator)(project_types_1.ProjectPriority)
            .optional()
    })
});
// 项目更新验证
exports.validateUpdateProject = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string()
            .optional(),
        description: zod_1.z.string()
            .optional(),
        sourceLanguage: zod_1.z.string()
            .optional(),
        targetLanguage: zod_1.z.string()
            .optional(),
        manager: common_1.mongoIdSchema
            .optional(),
        reviewers: zod_1.z.array(common_1.mongoIdSchema)
            .optional(),
        translationPromptTemplate: zod_1.z.string()
            .optional(),
        reviewPromptTemplate: zod_1.z.string()
            .optional(),
        deadline: zod_1.z.string()
            .datetime('截止日期格式无效')
            .optional(),
        priority: (0, common_1.createEnumValidator)(project_types_1.ProjectPriority)
            .optional(),
        status: (0, common_1.createEnumValidator)(project_types_1.ProjectStatus)
            .optional()
    })
});
// 更新项目进度验证
exports.validateUpdateProjectProgress = zod_1.z.object({
    params: zod_1.z.object({
        projectId: common_1.mongoIdSchema
    }),
    body: zod_1.z.object({
        status: (0, common_1.createEnumValidator)(project_types_1.ProjectStatus)
            .optional(),
        progress: zod_1.z.object({
            totalSegments: zod_1.z.number()
                .optional(),
            translatedSegments: zod_1.z.number()
                .optional(),
            reviewedSegments: zod_1.z.number()
                .optional()
        })
            .optional()
    })
});
