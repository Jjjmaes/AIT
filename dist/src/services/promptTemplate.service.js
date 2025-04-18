"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.promptTemplateService = exports.PromptTemplateService = void 0;
const promptTemplate_model_1 = require("../models/promptTemplate.model");
const errors_1 = require("../utils/errors"); // Assuming custom error class
const logger_1 = __importDefault(require("../utils/logger"));
const mongoose_1 = require("mongoose"); // Import mongoose and Types
class PromptTemplateService {
    constructor() {
        this.serviceName = 'PromptTemplateService';
    }
    /**
     * Get all prompt templates.
     */
    async getAllPromptTemplates() {
        logger_1.default.debug(`${this.serviceName}.getAllPromptTemplates called`);
        try {
            const templates = await promptTemplate_model_1.PromptTemplate.find({})
                .populate('createdBy', 'name email')
                .lean();
            logger_1.default.info(`Found ${templates.length} prompt templates.`);
            return templates;
        }
        catch (error) {
            logger_1.default.error(`Error fetching all prompt templates: ${error.message}`, { error });
            throw new errors_1.AppError('Failed to retrieve prompt templates.', 500);
        }
    }
    /**
     * Get a single prompt template by its ID.
     */
    async getPromptTemplateById(id) {
        logger_1.default.debug(`${this.serviceName}.getPromptTemplateById called with id: ${id}`);
        try {
            if (!mongoose_1.Types.ObjectId.isValid(id)) {
                throw new errors_1.AppError('Invalid prompt template ID format.', 400);
            }
            const template = await promptTemplate_model_1.PromptTemplate.findById(id)
                .populate('createdBy', 'name email')
                .lean();
            return template;
        }
        catch (error) {
            logger_1.default.error(`Error fetching prompt template with id ${id}: ${error.message}`, { error });
            if (error instanceof errors_1.AppError)
                throw error;
            throw new errors_1.AppError('Failed to retrieve prompt template.', 500);
        }
    }
    /**
     * Create a new prompt template.
     */
    async createPromptTemplate(payload) {
        logger_1.default.debug(`${this.serviceName}.createPromptTemplate called with payload:`, payload);
        try {
            const createData = {
                name: payload.name,
                description: payload.description,
                type: payload.type,
                content: payload.content,
                outputFormat: payload.outputFormat,
                modelIdentifier: payload.modelIdentifier,
                isActive: payload.isActive ?? true,
                variables: payload.variables ? Array.from(new Set(payload.variables)) : [],
            };
            if (payload.createdBy && mongoose_1.Types.ObjectId.isValid(payload.createdBy)) {
                createData.createdBy = new mongoose_1.Types.ObjectId(payload.createdBy);
            }
            const newTemplate = new promptTemplate_model_1.PromptTemplate(createData);
            await newTemplate.save();
            logger_1.default.info(`Successfully created prompt template: ${newTemplate.name} (ID: ${newTemplate._id})`);
            const populatedTemplate = await promptTemplate_model_1.PromptTemplate.findById(newTemplate._id)
                .populate('createdBy', 'name email')
                .lean();
            if (!populatedTemplate) {
                throw new errors_1.AppError('Failed to retrieve newly created template after saving.', 500);
            }
            return populatedTemplate;
        }
        catch (error) {
            logger_1.default.error(`Error creating prompt template: ${error.message}`, { error, payload });
            if (error.code === 11000 && error.keyPattern?.name) {
                throw new errors_1.AppError('A prompt template with this name already exists.', 409);
            }
            else if (error.name === 'ValidationError') {
                throw new errors_1.AppError(`Validation failed: ${error.message}`, 400);
            }
            throw new errors_1.AppError('Failed to create prompt template.', 500);
        }
    }
    /**
     * Update an existing prompt template.
     */
    async updatePromptTemplate(id, payload) {
        logger_1.default.debug(`${this.serviceName}.updatePromptTemplate called for id: ${id} with payload:`, payload);
        try {
            if (!mongoose_1.Types.ObjectId.isValid(id)) {
                throw new errors_1.AppError('Invalid prompt template ID format.', 400);
            }
            // Prepare update data, explicitly excluding createdBy during spread
            const { createdBy, ...restOfPayload } = payload; // Destructure to remove createdBy
            const updateData = { ...restOfPayload }; // Spread only the rest
            // delete updateData.createdBy; // No longer needed as it wasn't included
            if (updateData.variables) {
                updateData.variables = Array.from(new Set(updateData.variables));
            }
            const updatedTemplate = await promptTemplate_model_1.PromptTemplate.findByIdAndUpdate(id, updateData, { new: true, runValidators: true } // Return updated doc, run schema validators
            ).populate('createdBy', 'name email').lean();
            return updatedTemplate; // Returns null if not found by findByIdAndUpdate
        }
        catch (error) {
            logger_1.default.error(`Error updating prompt template with id ${id}: ${error.message}`, { error, payload });
            if (error.code === 11000 && error.keyPattern?.name) {
                throw new errors_1.AppError('A prompt template with this name already exists.', 409);
            }
            else if (error.name === 'ValidationError') {
                throw new errors_1.AppError(`Validation failed: ${error.message}`, 400);
            }
            throw new errors_1.AppError('Failed to update prompt template.', 500);
        }
    }
    /**
     * Delete a prompt template by its ID.
     */
    async deletePromptTemplate(id) {
        logger_1.default.debug(`${this.serviceName}.deletePromptTemplate called with id: ${id}`);
        try {
            if (!mongoose_1.Types.ObjectId.isValid(id)) {
                throw new errors_1.AppError('Invalid prompt template ID format.', 400);
            }
            const result = await promptTemplate_model_1.PromptTemplate.findByIdAndDelete(id);
            if (!result) {
                throw new errors_1.AppError('Prompt template not found.', 404);
            }
            logger_1.default.info(`Successfully deleted prompt template with id: ${id}`);
            return true;
        }
        catch (error) {
            logger_1.default.error(`Error deleting prompt template with id ${id}: ${error.message}`, { error });
            if (error instanceof errors_1.AppError)
                throw error;
            throw new errors_1.AppError('Failed to delete prompt template.', 500);
        }
    }
}
exports.PromptTemplateService = PromptTemplateService;
// Export an instance
exports.promptTemplateService = new PromptTemplateService();
