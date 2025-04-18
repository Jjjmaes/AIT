"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptTemplateController = void 0;
const promptTemplate_service_1 = require("../services/promptTemplate.service");
const errorHandler_1 = require("../utils/errorHandler"); // Assuming path is correct
const logger_1 = __importDefault(require("../utils/logger"));
const errors_1 = require("../utils/errors");
class PromptTemplateController {
    constructor() {
        this.serviceName = 'PromptTemplateController';
        // GET /api/prompts - Get all templates
        this.getAllTemplates = async (req, res, next) => {
            const methodName = 'getAllTemplates';
            logger_1.default.info(`Entering ${this.serviceName}.${methodName}`);
            try {
                // TODO: Add filtering/pagination based on query params if needed
                const templates = await promptTemplate_service_1.promptTemplateService.getAllPromptTemplates();
                res.status(200).json({ success: true, data: { templates } });
            }
            catch (error) {
                logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
                next(error);
            }
        };
        // GET /api/prompts/:templateId - Get template by ID
        this.getTemplateById = async (req, res, next) => {
            const methodName = 'getTemplateById';
            const { templateId } = req.params;
            try {
                logger_1.default.info(`Entering ${this.serviceName}.${methodName} for ID: ${templateId}`);
                (0, errorHandler_1.validateId)(templateId, 'Prompt Template'); // Use existing validation if available
                const template = await promptTemplate_service_1.promptTemplateService.getPromptTemplateById(templateId);
                if (!template) {
                    throw new errors_1.AppError('Prompt template not found', 404);
                }
                res.status(200).json({ success: true, data: { template } });
            }
            catch (error) {
                logger_1.default.error(`Error in ${this.serviceName}.${methodName} for ID ${templateId}:`, error);
                next(error);
            }
        };
        // POST /api/prompts - Create new template
        this.createTemplate = async (req, res, next) => {
            const methodName = 'createTemplate';
            const payload = req.body;
            // Add creator ID from authenticated user
            const userId = req.user?.id;
            try {
                logger_1.default.info(`Entering ${this.serviceName}.${methodName}`);
                // Basic check for user ID (middleware should ensure user exists)
                if (!userId) {
                    throw new errors_1.AppError('Authentication required: User ID not found.', 401);
                }
                // TODO: Add detailed payload validation (e.g., using Zod/Joi)
                const newTemplate = await promptTemplate_service_1.promptTemplateService.createPromptTemplate({
                    ...payload,
                    createdBy: userId // Pass user ID to service
                });
                res.status(201).json({ success: true, data: { template: newTemplate }, message: 'Prompt template created successfully' });
            }
            catch (error) {
                logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
                next(error);
            }
        };
        // PUT /api/prompts/:templateId - Update template
        this.updateTemplate = async (req, res, next) => {
            const methodName = 'updateTemplate';
            const { templateId } = req.params;
            const payload = req.body;
            // TODO: Add permission check - does req.user.id own this template? (or is admin?)
            try {
                logger_1.default.info(`Entering ${this.serviceName}.${methodName} for ID: ${templateId}`);
                (0, errorHandler_1.validateId)(templateId, 'Prompt Template');
                // TODO: Add detailed payload validation
                const updatedTemplate = await promptTemplate_service_1.promptTemplateService.updatePromptTemplate(templateId, payload);
                if (!updatedTemplate) {
                    throw new errors_1.AppError('Prompt template not found', 404);
                }
                res.status(200).json({ success: true, data: { template: updatedTemplate }, message: 'Prompt template updated successfully' });
            }
            catch (error) {
                logger_1.default.error(`Error in ${this.serviceName}.${methodName} for ID ${templateId}:`, error);
                next(error);
            }
        };
        // DELETE /api/prompts/:templateId - Delete template
        this.deleteTemplate = async (req, res, next) => {
            const methodName = 'deleteTemplate';
            const { templateId } = req.params;
            // TODO: Add permission check - does req.user.id own this template? (or is admin?)
            try {
                logger_1.default.info(`Entering ${this.serviceName}.${methodName} for ID: ${templateId}`);
                (0, errorHandler_1.validateId)(templateId, 'Prompt Template');
                // Service's delete method throws 404 if not found, which next(error) will handle
                await promptTemplate_service_1.promptTemplateService.deletePromptTemplate(templateId);
                res.status(200).json({ success: true, message: 'Prompt template deleted successfully' });
            }
            catch (error) {
                logger_1.default.error(`Error in ${this.serviceName}.${methodName} for ID ${templateId}:`, error);
                next(error);
            }
        };
    }
}
exports.PromptTemplateController = PromptTemplateController;
