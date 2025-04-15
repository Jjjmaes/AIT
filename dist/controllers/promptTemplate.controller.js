"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.promptTemplateController = void 0;
const promptTemplate_service_1 = require("../services/promptTemplate.service");
const errors_1 = require("../utils/errors");
const logger_1 = __importDefault(require("../utils/logger"));
class PromptTemplateController {
    constructor() {
        this.serviceName = 'PromptTemplateController';
    }
    // --- Create Template ---
    async create(req, res, next) {
        const methodName = 'create';
        try {
            const userId = req.user?.id;
            if (!userId) {
                // Use standard UnauthorizedError or similar if defined
                return next(new errors_1.AppError('Authentication required', 401));
            }
            // Basic validation could be added here or via middleware (e.g., express-validator)
            const templateData = req.body;
            logger_1.default.info(`Attempting to create prompt template by user ${userId} with name: ${templateData.name}`);
            const newTemplate = await promptTemplate_service_1.promptTemplateService.createTemplate(userId, templateData);
            res.status(201).json({ success: true, data: newTemplate });
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            next(error); // Pass to central error handler
        }
    }
    // --- Get All Templates (Filtered) ---
    async getAll(req, res, next) {
        const methodName = 'getAll'; // Define methodName for logging
        try {
            const userId = req.user?.id;
            if (!userId) {
                return next(new errors_1.AppError('Authentication required', 401));
            }
            // Extract filters from query parameters
            const filters = {
                taskType: req.query.taskType,
                domain: req.query.domain,
                isPublic: req.query.isPublic ? req.query.isPublic === 'true' : undefined,
                search: req.query.search,
                page: req.query.page ? parseInt(req.query.page, 10) : undefined,
                limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
            };
            logger_1.default.info(`Fetching prompt templates for user ${userId} with filters:`, filters);
            const result = await promptTemplate_service_1.promptTemplateService.getTemplates(userId, filters);
            // Format response to match frontend expectation { success: true, data: { templates: [...] } }
            res.status(200).json({
                success: true,
                data: {
                    templates: result.data,
                    pagination: {
                        total: result.total,
                        page: result.page,
                        limit: result.limit
                    }
                }
            });
        }
        catch (error) {
            // Corrected logger call in catch block
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            next(error); // Pass to central error handler
        }
    }
    // --- Get Template By ID ---
    async getById(req, res, next) {
        const methodName = 'getById';
        try {
            // User ID might be optional depending on if anonymous users can fetch public templates
            const userId = req.user?.id;
            const templateId = req.params.templateId;
            if (!templateId) {
                return next(new errors_1.AppError('Template ID is required', 400));
            }
            logger_1.default.info(`Fetching prompt template ${templateId} for user ${userId}`);
            // Pass userId for permission checks within the service
            const template = await promptTemplate_service_1.promptTemplateService.getTemplateById(templateId, userId);
            res.status(200).json({ success: true, data: template });
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName} for ID ${req.params.templateId}:`, error);
            next(error);
        }
    }
    // --- Update Template By ID ---
    async update(req, res, next) {
        const methodName = 'update';
        try {
            const userId = req.user?.id;
            if (!userId) {
                return next(new errors_1.AppError('Authentication required', 401));
            }
            const templateId = req.params.templateId;
            if (!templateId) {
                return next(new errors_1.AppError('Template ID is required', 400));
            }
            // Add validation for updateData if needed
            const updateData = req.body;
            logger_1.default.info(`Attempting to update prompt template ${templateId} by user ${userId}`);
            const updatedTemplate = await promptTemplate_service_1.promptTemplateService.updateTemplate(templateId, userId, updateData);
            res.status(200).json({ success: true, data: updatedTemplate });
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName} for ID ${req.params.templateId}:`, error);
            next(error);
        }
    }
    // --- Delete Template By ID ---
    async delete(req, res, next) {
        const methodName = 'delete';
        try {
            const userId = req.user?.id;
            if (!userId) {
                return next(new errors_1.AppError('Authentication required', 401));
            }
            const templateId = req.params.templateId;
            if (!templateId) {
                return next(new errors_1.AppError('Template ID is required', 400));
            }
            logger_1.default.info(`Attempting to delete prompt template ${templateId} by user ${userId}`);
            const result = await promptTemplate_service_1.promptTemplateService.deleteTemplate(templateId, userId);
            // Return 200 OK or 204 No Content on successful deletion
            res.status(200).json({ success: result.success, message: 'Prompt template deleted successfully' });
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName} for ID ${req.params.templateId}:`, error);
            next(error);
        }
    }
}
// Export singleton instance of the controller
exports.promptTemplateController = new PromptTemplateController();
