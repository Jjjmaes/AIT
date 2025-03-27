"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectProgressSchema = exports.updateProjectSchema = exports.createProjectSchema = void 0;
const zod_1 = require("zod");
const project_types_1 = require("../types/project.types");
exports.createProjectSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, '项目名称不能为空'),
    description: zod_1.z.string().min(1, '项目描述不能为空'),
    sourceLanguage: zod_1.z.string().min(1, '源语言不能为空'),
    targetLanguage: zod_1.z.string().min(1, '目标语言不能为空'),
    translationPromptTemplate: zod_1.z.string().min(1, '翻译提示模板不能为空'),
    reviewPromptTemplate: zod_1.z.string().min(1, '审核提示模板不能为空'),
    deadline: zod_1.z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
    priority: zod_1.z.nativeEnum(project_types_1.ProjectPriority).optional()
});
exports.updateProjectSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, '项目名称不能为空').optional(),
    description: zod_1.z.string().min(1, '项目描述不能为空').optional(),
    status: zod_1.z.nativeEnum(project_types_1.ProjectStatus).optional(),
    priority: zod_1.z.nativeEnum(project_types_1.ProjectPriority).optional(),
    deadline: zod_1.z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
    translationPromptTemplate: zod_1.z.string().min(1, '翻译提示模板不能为空').optional(),
    reviewPromptTemplate: zod_1.z.string().min(1, '审核提示模板不能为空').optional()
});
exports.projectProgressSchema = zod_1.z.object({
    completionPercentage: zod_1.z.number().min(0).max(100),
    translatedWords: zod_1.z.number().min(0),
    totalWords: zod_1.z.number().min(0)
});
