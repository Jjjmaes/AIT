// src/services/aiConfig.service.ts
import mongoose from 'mongoose'; // Import mongoose
// This now correctly uses the IAIProviderConfig from the model file
import { AIProviderConfig, IAIProviderConfig } from '../models/aiConfig.model';
import { handleServiceError, validateId } from '../utils/errorHandler';
import logger from '../utils/logger';
import { NotFoundError, AppError, ValidationError } from '../utils/errors'; // Added ValidationError

// Define interface for create/update payloads
export interface AIConfigPayload {
    providerName: string;
    apiKey: string;
    baseURL?: string;
    models: string[];
    defaultModel?: string;
    defaultParams?: Record<string, any>;
    isActive?: boolean; // Allow setting active status
    notes?: string;
}

// The conflicting local definition that was here has been removed.

class AIConfigService {
    private serviceName = 'AIConfigService';

    /**
     * Retrieves a specific AI Provider configuration by its ID.
     * Does not check for isActive status.
     * @param configId The ID of the configuration to retrieve.
     * @returns The AI provider configuration document or null if not found.
     */
    async getConfigById(configId: string): Promise<IAIProviderConfig | null> {
        const methodName = 'getConfigById';
        validateId(configId, 'AI 配置');
        try {
            const config = await AIProviderConfig.findById(configId).exec();
            if (!config) {
                logger.warn(`${this.serviceName}.${methodName}: AI Config not found for ID ${configId}`);
                return null;
            }
            logger.info(`${this.serviceName}.${methodName}: Retrieved AI Config ${configId}`);
            // Note: We might not want to log the API key here
            // Consider masking sensitive fields before logging if needed
            return config;
        } catch (error) {
            logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
            throw handleServiceError(error, this.serviceName, methodName, '获取 AI 配置');
        }
    }

    /**
     * Retrieves all *active* AI Provider configurations.
     * @returns An array of active AI provider configuration documents.
     */
    async getActiveConfigs(): Promise<IAIProviderConfig[]> {
        const methodName = 'getActiveConfigs';
        try {
            // Find only active configurations
            const configs = await AIProviderConfig.find({ isActive: true }).exec();
            logger.info(`${this.serviceName}.${methodName}: Retrieved ${configs.length} active AI configs`);
            // Consider masking API keys before returning if exposing to less trusted layers
            return configs;
        } catch (error) {
            logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
            throw handleServiceError(error, this.serviceName, methodName, '获取活动 AI 配置列表');
        }
    }

    /**
     * Retrieves all AI Provider configurations (for admin purposes).
     * @returns An array of all AI provider configuration documents.
     */
    async getAllConfigs(): Promise<IAIProviderConfig[]> {
        const methodName = 'getAllConfigs';
        try {
            const configs = await AIProviderConfig.find().exec();
            logger.info(`${this.serviceName}.${methodName}: Retrieved ${configs.length} total AI configs`);
            // Mask API keys before returning for admin listing? Maybe not needed if admin only.
            return configs;
        } catch (error) {
            logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
            throw handleServiceError(error, this.serviceName, methodName, '获取所有 AI 配置列表');
        }
    }

    // --- CREATE ---
    /**
     * Creates a new AI Provider configuration.
     * @param payload Data for the new configuration.
     * @returns The created AI provider configuration document.
     */
    async createConfig(payload: AIConfigPayload): Promise<IAIProviderConfig> {
        const methodName = 'createConfig';
        try {
            // Basic validation (more specific validation can be added)
            if (!payload.providerName || !payload.apiKey || !payload.models || payload.models.length === 0) {
                throw new ValidationError('Provider name, API key, and at least one model are required.');
            }

            const newConfig = new AIProviderConfig({
                ...payload,
                // Ensure default values are handled if not provided in payload
                isActive: payload.isActive !== undefined ? payload.isActive : true,
                defaultParams: payload.defaultParams || {},
            });

            await newConfig.save();
            logger.info(`${this.serviceName}.${methodName}: Created new AI Config for provider ${newConfig.providerName}`);
            // Return the saved document (consider masking API key on return if needed)
            return newConfig;
        } catch (error) {
            logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
            throw handleServiceError(error, this.serviceName, methodName, '创建 AI 配置');
        }
    }

    // --- UPDATE ---
    /**
     * Updates an existing AI Provider configuration.
     * @param configId The ID of the configuration to update.
     * @param payload The fields to update.
     * @returns The updated AI provider configuration document or null if not found.
     */
    async updateConfig(configId: string, payload: Partial<AIConfigPayload>): Promise<IAIProviderConfig | null> {
        const methodName = 'updateConfig';
        validateId(configId, 'AI 配置');
        try {
             // Prevent accidental clearing of required fields if payload is partial
             if (payload.providerName === '') throw new ValidationError('Provider name cannot be empty.');
             if (payload.apiKey === '') throw new ValidationError('API key cannot be empty.');
             if (payload.models && payload.models.length === 0) throw new ValidationError('Model list cannot be empty.');

            // Find and update
            const updatedConfig = await AIProviderConfig.findByIdAndUpdate(
                configId,
                { $set: payload }, // Use $set to apply partial updates
                { new: true, runValidators: true } // Return updated doc, run schema validators
            ).exec();

            if (!updatedConfig) {
                 throw new NotFoundError(`AI 配置 ID ${configId} 未找到`);
            }

            logger.info(`${this.serviceName}.${methodName}: Updated AI Config ${configId}`);
            return updatedConfig;
        } catch (error) {
            logger.error(`Error in ${this.serviceName}.${methodName} for ID ${configId}:`, error);
            throw handleServiceError(error, this.serviceName, methodName, '更新 AI 配置');
        }
    }

    // --- DELETE ---
    /**
     * Deletes an AI Provider configuration.
     * @param configId The ID of the configuration to delete.
     */
    async deleteConfig(configId: string): Promise<void> {
        const methodName = 'deleteConfig';
        validateId(configId, 'AI 配置');
        try {
            // TODO: Add check if this config is currently used by any projects before deleting?

            const result = await AIProviderConfig.findByIdAndDelete(configId).exec();

            if (!result) {
                 throw new NotFoundError(`AI 配置 ID ${configId} 未找到`);
            }

            logger.info(`${this.serviceName}.${methodName}: Deleted AI Config ${configId}`);
        } catch (error) {
            logger.error(`Error in ${this.serviceName}.${methodName} for ID ${configId}:`, error);
            throw handleServiceError(error, this.serviceName, methodName, '删除 AI 配置');
        }
    }
}

export const aiConfigService = new AIConfigService();