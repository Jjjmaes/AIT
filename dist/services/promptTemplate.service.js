"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.promptTemplateService = exports.PromptTemplateService = void 0;
const promptTemplate_model_1 = require("../models/promptTemplate.model");
const errorHandler_1 = require("../utils/errorHandler");
const errors_1 = require("../utils/errors");
const logger_1 = __importDefault(require("../utils/logger"));
const mongoose_1 = require("mongoose");
class PromptTemplateService {
    constructor() {
        this.serviceName = 'PromptTemplateService';
    }
    /**
     * Create a new prompt template
     */
    async createTemplate(userId, data) {
        const methodName = 'createTemplate';
        (0, errorHandler_1.validateId)(userId, '创建用户');
        // Basic validation for required fields
        if (!data.name || !data.systemInstruction || !data.userPrompt || !data.taskType) {
            throw new errors_1.ValidationError('Missing required fields for prompt template (name, systemInstruction, userPrompt, taskType).');
        }
        try {
            const newTemplate = new promptTemplate_model_1.PromptTemplate({
                ...data,
                createdBy: new mongoose_1.Types.ObjectId(userId),
                isPublic: data.isPublic ?? false, // Default to private
            });
            await newTemplate.save();
            logger_1.default.info(`Prompt template '${newTemplate.name}' created by user ${userId}`);
            return newTemplate;
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '创建提示模板');
        }
    }
    /**
     * Get a template by its ID
     */
    async getTemplateById(templateId, userId) {
        const methodName = 'getTemplateById';
        (0, errorHandler_1.validateId)(templateId, '模板');
        try {
            const template = await promptTemplate_model_1.PromptTemplate.findById(templateId).populate('createdBy', 'id username fullName').exec();
            (0, errorHandler_1.validateEntityExists)(template, '提示模板');
            // Permission check: Allow access if public or if user created it
            // If userId is not provided, assume public access check only (e.g., internal service call)
            if (!template.isPublic && userId) {
                const templateCreatorId = template.createdBy instanceof mongoose_1.Types.ObjectId
                    ? template.createdBy
                    : template.createdBy?._id;
                if (!templateCreatorId || !templateCreatorId.equals(userId)) {
                    // TODO: Add role check? Allow admins?
                    throw new errors_1.ForbiddenError(`User ${userId} does not have permission to access private template ${templateId}`);
                }
            }
            return template;
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName} for template ${templateId}:`, error);
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '获取提示模板');
        }
    }
    /**
     * Get a list of templates based on filters
     */
    async getTemplates(userId, filters = {}) {
        const methodName = 'getTemplates';
        (0, errorHandler_1.validateId)(userId, '用户');
        try {
            const query = {};
            const page = filters.page || 1;
            const limit = filters.limit || 10;
            const skip = (page - 1) * limit;
            // Build query based on filters
            if (filters.taskType) {
                query.taskType = filters.taskType;
            }
            if (filters.domain) {
                query.domain = filters.domain;
            }
            if (filters.search) {
                query.$or = [
                    { name: { $regex: filters.search, $options: 'i' } },
                    { description: { $regex: filters.search, $options: 'i' } }
                ];
            }
            // Permission filter: User can see their own templates + public templates
            const userObjectId = new mongoose_1.Types.ObjectId(userId);
            const permissionQuery = {
                $or: [
                    { createdBy: userObjectId }, // User's own templates
                    { isPublic: true } // Public templates
                ]
            };
            // Combine base query and permission query
            const finalQuery = { ...query, ...permissionQuery };
            const [templates, total] = await Promise.all([
                promptTemplate_model_1.PromptTemplate.find(finalQuery)
                    .populate('createdBy', 'id username fullName')
                    .sort({ createdAt: -1 }) // Sort by newest first
                    .skip(skip)
                    .limit(limit)
                    .exec(),
                promptTemplate_model_1.PromptTemplate.countDocuments(finalQuery)
            ]);
            return { data: templates, total, page, limit };
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '获取提示模板列表');
        }
    }
    /**
     * Update an existing prompt template
     */
    async updateTemplate(templateId, userId, data) {
        const methodName = 'updateTemplate';
        (0, errorHandler_1.validateId)(templateId, '模板');
        (0, errorHandler_1.validateId)(userId, '用户');
        try {
            const template = await promptTemplate_model_1.PromptTemplate.findById(templateId).exec();
            (0, errorHandler_1.validateEntityExists)(template, '提示模板');
            // Permission check: Explicitly compare ObjectIds
            const userObjectId = new mongoose_1.Types.ObjectId(userId);
            // Cast createdBy to ObjectId before comparing
            if (!template.createdBy || !template.createdBy.equals(userObjectId)) {
                throw new errors_1.ForbiddenError(`User ${userId} does not have permission to update template ${templateId}`);
            }
            delete data.taskType;
            delete data.createdBy;
            Object.assign(template, data);
            await template.save();
            logger_1.default.info(`Prompt template ${templateId} updated by user ${userId}`);
            return await template.populate('createdBy', 'id username fullName');
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName} for template ${templateId}:`, error);
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '更新提示模板');
        }
    }
    /**
     * Delete a prompt template
     */
    async deleteTemplate(templateId, userId) {
        const methodName = 'deleteTemplate';
        (0, errorHandler_1.validateId)(templateId, '模板');
        (0, errorHandler_1.validateId)(userId, '用户');
        try {
            const template = await promptTemplate_model_1.PromptTemplate.findById(templateId).exec();
            (0, errorHandler_1.validateEntityExists)(template, '提示模板');
            // Permission check: Explicitly compare ObjectIds
            const userObjectId = new mongoose_1.Types.ObjectId(userId);
            // Cast createdBy to ObjectId before comparing
            if (!template.createdBy || !template.createdBy.equals(userObjectId)) {
                throw new errors_1.ForbiddenError(`User ${userId} does not have permission to delete template ${templateId}`);
            }
            await promptTemplate_model_1.PromptTemplate.findByIdAndDelete(templateId);
            logger_1.default.info(`Prompt template ${templateId} deleted by user ${userId}`);
            return { success: true };
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName} for template ${templateId}:`, error);
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '删除提示模板');
        }
    }
}
exports.PromptTemplateService = PromptTemplateService;
// Export singleton instance
exports.promptTemplateService = new PromptTemplateService();
