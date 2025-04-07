"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectProgressSchema = exports.updateProjectSchema = exports.createProjectSchema = void 0;
const zod_1 = require("zod");
const project_model_1 = require("../models/project.model");
const languagePairSchema = zod_1.z.object({
    source: zod_1.z.string(),
    target: zod_1.z.string()
});
exports.createProjectSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, '项目名称不能为空'),
    description: zod_1.z.string().optional(),
    languagePairs: zod_1.z.array(languagePairSchema).min(1, '至少需要一个语言对'),
    manager: zod_1.z.string(),
    members: zod_1.z.array(zod_1.z.string()).optional(),
    defaultPromptTemplateId: zod_1.z.string().optional(),
    domain: zod_1.z.string().optional(),
    terminologyId: zod_1.z.string().optional(),
    status: zod_1.z.nativeEnum(project_model_1.ProjectStatus).optional(),
    priority: zod_1.z.number().optional()
});
exports.updateProjectSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, '项目名称不能为空').optional(),
    description: zod_1.z.string().optional(),
    languagePairs: zod_1.z.array(languagePairSchema).optional(),
    manager: zod_1.z.string().optional(),
    members: zod_1.z.array(zod_1.z.string()).optional(),
    defaultPromptTemplateId: zod_1.z.string().optional(),
    domain: zod_1.z.string().optional(),
    terminologyId: zod_1.z.string().optional(),
    status: zod_1.z.nativeEnum(project_model_1.ProjectStatus).optional(),
    priority: zod_1.z.number().optional()
});
exports.projectProgressSchema = zod_1.z.object({
    completionPercentage: zod_1.z.number().min(0).max(100),
    translatedWords: zod_1.z.number().min(0),
    totalWords: zod_1.z.number().min(0)
});
