"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectProgressSchema = exports.updateProjectSchema = exports.createProjectSchema = void 0;
const zod_1 = require("zod");
const project_model_1 = require("../models/project.model");
const languagePairSchema = zod_1.z.object({
    source: zod_1.z.string(),
    target: zod_1.z.string()
});
// Define allowed priority values
const allowedPriorities = [1, 2, 3];
exports.createProjectSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, '项目名称不能为空'),
    description: zod_1.z.string().optional(),
    languagePairs: zod_1.z.array(languagePairSchema).min(1, '至少需要一个语言对'),
    manager: zod_1.z.string().optional(), // Make manager optional here
    // Add fields based on CreateProjectDto in service
    reviewers: zod_1.z.array(zod_1.z.string()).optional(),
    defaultTranslationPromptTemplate: zod_1.z.string().optional(),
    defaultReviewPromptTemplate: zod_1.z.string().optional(),
    translationPromptTemplate: zod_1.z.string().optional(),
    reviewPromptTemplate: zod_1.z.string().optional(),
    deadline: zod_1.z.string().datetime({ message: "无效的日期时间格式" }).optional(), // Validate as ISO datetime string
    priority: zod_1.z.number().refine(val => allowedPriorities.includes(val), {
        message: '优先级必须是 1 (低), 2 (中), 或 3 (高)'
    }).optional(),
    domain: zod_1.z.string().optional(),
    industry: zod_1.z.string().optional(), // Add industry field
});
exports.updateProjectSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, '项目名称不能为空').optional(),
    description: zod_1.z.string().optional(),
    languagePairs: zod_1.z.array(languagePairSchema).optional(),
    manager: zod_1.z.string().optional(), // Assuming manager ID can be updated
    reviewers: zod_1.z.array(zod_1.z.string()).optional(),
    defaultTranslationPromptTemplate: zod_1.z.string().optional(),
    defaultReviewPromptTemplate: zod_1.z.string().optional(),
    translationPromptTemplate: zod_1.z.string().optional(),
    reviewPromptTemplate: zod_1.z.string().optional(),
    deadline: zod_1.z.string().datetime({ message: "无效的日期时间格式" }).optional(),
    priority: zod_1.z.number().refine(val => allowedPriorities.includes(val), {
        message: '优先级必须是 1 (低), 2 (中), 或 3 (高)'
    }).optional(),
    domain: zod_1.z.string().optional(),
    industry: zod_1.z.string().optional(), // Add industry field
    status: zod_1.z.nativeEnum(project_model_1.ProjectStatus).optional(), // Allow status updates from frontend?
});
exports.projectProgressSchema = zod_1.z.object({
    completionPercentage: zod_1.z.number().min(0).max(100),
    translatedWords: zod_1.z.number().min(0),
    totalWords: zod_1.z.number().min(0)
});
