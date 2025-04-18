"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiConfigService = void 0;
// This now correctly uses the IAIProviderConfig from the model file
const aiConfig_model_1 = require("../models/aiConfig.model");
const errorHandler_1 = require("../utils/errorHandler");
const logger_1 = __importDefault(require("../utils/logger"));
const errors_1 = require("../utils/errors"); // Added ValidationError
// The conflicting local definition that was here has been removed.
class AIConfigService {
    constructor() {
        this.serviceName = 'AIConfigService';
    }
    /**
     * Retrieves a specific AI Provider configuration by its ID.
     * Does not check for isActive status.
     * @param configId The ID of the configuration to retrieve.
     * @returns The AI provider configuration document or null if not found.
     */
    async getConfigById(configId) {
        const methodName = 'getConfigById';
        (0, errorHandler_1.validateId)(configId, 'AI 配置');
        try {
            const config = await aiConfig_model_1.AIProviderConfig.findById(configId).exec();
            if (!config) {
                logger_1.default.warn(`${this.serviceName}.${methodName}: AI Config not found for ID ${configId}`);
                return null;
            }
            logger_1.default.info(`${this.serviceName}.${methodName}: Retrieved AI Config ${configId}`);
            // Note: We might not want to log the API key here
            // Consider masking sensitive fields before logging if needed
            return config;
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '获取 AI 配置');
        }
    }
    /**
     * Retrieves all *active* AI Provider configurations.
     * @returns An array of active AI provider configuration documents.
     */
    async getActiveConfigs() {
        const methodName = 'getActiveConfigs';
        try {
            // Find only active configurations
            const configs = await aiConfig_model_1.AIProviderConfig.find({ isActive: true }).exec();
            logger_1.default.info(`${this.serviceName}.${methodName}: Retrieved ${configs.length} active AI configs`);
            // Consider masking API keys before returning if exposing to less trusted layers
            return configs;
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '获取活动 AI 配置列表');
        }
    }
    /**
     * Retrieves all AI Provider configurations (for admin purposes).
     * @returns An array of all AI provider configuration documents.
     */
    async getAllConfigs() {
        const methodName = 'getAllConfigs';
        try {
            const configs = await aiConfig_model_1.AIProviderConfig.find().exec();
            logger_1.default.info(`${this.serviceName}.${methodName}: Retrieved ${configs.length} total AI configs`);
            // Mask API keys before returning for admin listing? Maybe not needed if admin only.
            return configs;
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '获取所有 AI 配置列表');
        }
    }
    // --- CREATE ---
    /**
     * Creates a new AI Provider configuration.
     * @param payload Data for the new configuration.
     * @returns The created AI provider configuration document.
     */
    async createConfig(payload) {
        const methodName = 'createConfig';
        try {
            // Basic validation (more specific validation can be added)
            if (!payload.providerName || !payload.apiKey || !payload.models || payload.models.length === 0) {
                throw new errors_1.ValidationError('Provider name, API key, and at least one model are required.');
            }
            const newConfig = new aiConfig_model_1.AIProviderConfig({
                ...payload,
                // Ensure default values are handled if not provided in payload
                isActive: payload.isActive !== undefined ? payload.isActive : true,
                defaultParams: payload.defaultParams || {},
            });
            await newConfig.save();
            logger_1.default.info(`${this.serviceName}.${methodName}: Created new AI Config for provider ${newConfig.providerName}`);
            // Return the saved document (consider masking API key on return if needed)
            return newConfig;
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '创建 AI 配置');
        }
    }
    // --- UPDATE ---
    /**
     * Updates an existing AI Provider configuration.
     * @param configId The ID of the configuration to update.
     * @param payload The fields to update.
     * @returns The updated AI provider configuration document or null if not found.
     */
    async updateConfig(configId, payload) {
        const methodName = 'updateConfig';
        (0, errorHandler_1.validateId)(configId, 'AI 配置');
        try {
            // Prevent accidental clearing of required fields if payload is partial
            if (payload.providerName === '')
                throw new errors_1.ValidationError('Provider name cannot be empty.');
            if (payload.apiKey === '')
                throw new errors_1.ValidationError('API key cannot be empty.');
            if (payload.models && payload.models.length === 0)
                throw new errors_1.ValidationError('Model list cannot be empty.');
            // Find and update
            const updatedConfig = await aiConfig_model_1.AIProviderConfig.findByIdAndUpdate(configId, { $set: payload }, // Use $set to apply partial updates
            { new: true, runValidators: true } // Return updated doc, run schema validators
            ).exec();
            if (!updatedConfig) {
                throw new errors_1.NotFoundError(`AI 配置 ID ${configId} 未找到`);
            }
            logger_1.default.info(`${this.serviceName}.${methodName}: Updated AI Config ${configId}`);
            return updatedConfig;
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName} for ID ${configId}:`, error);
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '更新 AI 配置');
        }
    }
    // --- DELETE ---
    /**
     * Deletes an AI Provider configuration.
     * @param configId The ID of the configuration to delete.
     */
    async deleteConfig(configId) {
        const methodName = 'deleteConfig';
        (0, errorHandler_1.validateId)(configId, 'AI 配置');
        try {
            // TODO: Add check if this config is currently used by any projects before deleting?
            const result = await aiConfig_model_1.AIProviderConfig.findByIdAndDelete(configId).exec();
            if (!result) {
                throw new errors_1.NotFoundError(`AI 配置 ID ${configId} 未找到`);
            }
            logger_1.default.info(`${this.serviceName}.${methodName}: Deleted AI Config ${configId}`);
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName} for ID ${configId}:`, error);
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '删除 AI 配置');
        }
    }
}
exports.aiConfigService = new AIConfigService();
