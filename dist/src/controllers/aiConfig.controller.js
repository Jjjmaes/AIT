"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIConfigController = void 0;
const aiConfig_model_1 = require("../models/aiConfig.model"); // Correct model import
// Import the service instance directly and the payload type
const aiConfig_service_1 = require("../services/aiConfig.service");
const errorHandler_1 = require("../utils/errorHandler"); // Assuming this is the correct path/export for validation
const logger_1 = __importDefault(require("../utils/logger"));
const errors_1 = require("../utils/errors"); // Assuming AppError is defined here for custom errors
class AIConfigController {
    constructor() {
        this.serviceName = 'AIConfigController';
        // Service instance is imported, no need to instantiate: private aiConfigService = new AIConfigService();
        // --- Method to get active models formatted for selection UI ---
        // Note: This uses the Model directly for robustness, avoiding service dependency here.
        this.getActiveModelsForSelection = async (req, res, next) => {
            const methodName = 'getActiveModelsForSelection';
            logger_1.default.info(`Entering ${this.serviceName}.${methodName}`);
            try {
                // Fetch only active configurations using the Model directly
                // Explicitly include _id along with other fields to ensure projection works with .lean()
                const activeConfigs = await aiConfig_model_1.AIProviderConfig.find({ isActive: true }, '_id providerName models')
                    .lean();
                if (!activeConfigs || activeConfigs.length === 0) {
                    res.status(200).json({ success: true, data: { models: [] }, message: 'No active AI configurations found.' });
                    return;
                }
                const selectableModels = [];
                activeConfigs.forEach((config) => {
                    if (config.models && Array.isArray(config.models)) {
                        config.models.forEach((modelName) => {
                            selectableModels.push({
                                id: `${config.providerName}-${modelName}`,
                                name: `${modelName} (${config.providerName})`,
                                provider: config.providerName
                            });
                        });
                    }
                });
                const responsePayload = { success: true, data: { models: selectableModels } };
                res.status(200).json(responsePayload);
            }
            catch (error) { // Catch any error and pass to central handler
                logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
                next(error);
            }
        };
        // --- CRUD Methods using aiConfigService and next(error) pattern --- 
        this.getAllConfigs = async (req, res, next) => {
            const methodName = 'getAllConfigs';
            logger_1.default.info(`Entering ${this.serviceName}.${methodName}`);
            try {
                // Assuming admin check happens in middleware
                const configs = await aiConfig_service_1.aiConfigService.getAllConfigs();
                // Service should handle masking of sensitive data like API keys
                res.status(200).json({ success: true, data: { configs } });
            }
            catch (error) {
                logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
                next(error); // Pass error to central handler
            }
        };
        this.getConfigById = async (req, res, next) => {
            const methodName = 'getConfigById';
            const { configId } = req.params;
            try {
                logger_1.default.info(`Entering ${this.serviceName}.${methodName} for ID: ${configId}`);
                (0, errorHandler_1.validateId)(configId, 'AI 配置'); // Validate ID format
                // Assuming admin check happens in middleware
                const config = await aiConfig_service_1.aiConfigService.getConfigById(configId);
                if (!config) {
                    // Throw standard AppError for central handler
                    throw new errors_1.AppError('AI Configuration not found', 404);
                }
                // Service should handle masking of sensitive data
                res.status(200).json({ success: true, data: { config } });
            }
            catch (error) {
                logger_1.default.error(`Error in ${this.serviceName}.${methodName} for ID ${configId}:`, error);
                next(error);
            }
        };
        this.createConfig = async (req, res, next) => {
            const methodName = 'createConfig';
            const payload = req.body;
            try {
                logger_1.default.info(`Entering ${this.serviceName}.${methodName}`);
                // Assuming admin check happens in middleware
                // TODO: Add detailed payload validation here or in middleware/service
                const newConfig = await aiConfig_service_1.aiConfigService.createConfig(payload);
                // Service should mask API key before returning
                res.status(201).json({ success: true, data: { config: newConfig }, message: 'AI Configuration created successfully' });
            }
            catch (error) {
                logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
                next(error); // Pass error (e.g., validation, duplicate key) to central handler
            }
        };
        this.updateConfig = async (req, res, next) => {
            const methodName = 'updateConfig';
            const { configId } = req.params;
            const payload = req.body;
            try {
                logger_1.default.info(`Entering ${this.serviceName}.${methodName} for ID: ${configId}`);
                (0, errorHandler_1.validateId)(configId, 'AI 配置');
                // Assuming admin check happens in middleware
                // TODO: Add detailed payload validation
                const updatedConfig = await aiConfig_service_1.aiConfigService.updateConfig(configId, payload);
                if (!updatedConfig) {
                    throw new errors_1.AppError('AI Configuration not found', 404);
                }
                // Service should mask API key
                res.status(200).json({ success: true, data: { config: updatedConfig }, message: 'AI Configuration updated successfully' });
            }
            catch (error) {
                logger_1.default.error(`Error in ${this.serviceName}.${methodName} for ID ${configId}:`, error);
                next(error);
            }
        };
        this.deleteConfig = async (req, res, next) => {
            const methodName = 'deleteConfig';
            const { configId } = req.params;
            try {
                logger_1.default.info(`Entering ${this.serviceName}.${methodName} for ID: ${configId}`);
                (0, errorHandler_1.validateId)(configId, 'AI 配置');
                // Assuming admin check happens in middleware
                // Service method should throw an error if config not found or delete fails
                await aiConfig_service_1.aiConfigService.deleteConfig(configId);
                // If service call completes without throwing, it succeeded
                res.status(200).json({ success: true, message: 'AI 配置已删除' });
            }
            catch (error) {
                logger_1.default.error(`Error in ${this.serviceName}.${methodName} for ID ${configId}:`, error);
                next(error); // Pass error (e.g., not found from service) to central handler
            }
        };
    }
}
exports.AIConfigController = AIConfigController;
