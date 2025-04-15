// src/controllers/aiConfig.controller.ts
import { Request, Response, NextFunction } from 'express';
import { AIProviderConfig, IAIProviderConfig } from '../models/aiConfig.model'; // Correct model import
// Import the service instance directly and the payload type
import { aiConfigService, AIConfigPayload } from '../services/aiConfig.service'; 
import { validateId } from '../utils/errorHandler'; // Assuming this is the correct path/export for validation
import logger from '../utils/logger';
import { AppError } from '../utils/errors'; // Assuming AppError is defined here for custom errors

// Interface for Request object potentially augmented by authentication middleware
interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    username: string;
    role: string;
    // Add other user properties if needed
  };
}

// Structure expected by the frontend model selection dropdown
interface SelectableAIModel {
  id: string;
  name: string;
  provider: string;
}

export class AIConfigController {
  private serviceName = 'AIConfigController';
  // Service instance is imported, no need to instantiate: private aiConfigService = new AIConfigService();

  // --- Method to get active models formatted for selection UI ---
  // Note: This uses the Model directly for robustness, avoiding service dependency here.
  public getActiveModelsForSelection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const methodName = 'getActiveModelsForSelection';
      logger.info(`Entering ${this.serviceName}.${methodName}`);
      try {
          // Fetch only active configurations using the Model directly
          // Explicitly include _id along with other fields to ensure projection works with .lean()
          const activeConfigs = await AIProviderConfig.find({ isActive: true }, '_id providerName models')
                                                  .lean();

          if (!activeConfigs || activeConfigs.length === 0) {
              res.status(200).json({ success: true, data: { models: [] }, message: 'No active AI configurations found.' });
              return;
          }

          const selectableModels: SelectableAIModel[] = [];
          activeConfigs.forEach((config) => { // Type inferred from .lean()
              if (config.models && Array.isArray(config.models)) {
                  config.models.forEach((modelName: string) => {
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

      } catch (error) { // Catch any error and pass to central handler
          logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
          next(error);
      }
  }

  // --- CRUD Methods using aiConfigService and next(error) pattern --- 

  public getAllConfigs = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
      const methodName = 'getAllConfigs';
      logger.info(`Entering ${this.serviceName}.${methodName}`);
      try {
          // Assuming admin check happens in middleware
          const configs = await aiConfigService.getAllConfigs();
          // Service should handle masking of sensitive data like API keys
          res.status(200).json({ success: true, data: { configs } });
      } catch (error) {
          logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
          next(error); // Pass error to central handler
      }
  }

  public getConfigById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
      const methodName = 'getConfigById';
      const { configId } = req.params;
      try {
          logger.info(`Entering ${this.serviceName}.${methodName} for ID: ${configId}`);
          validateId(configId, 'AI 配置'); // Validate ID format
          // Assuming admin check happens in middleware
          const config = await aiConfigService.getConfigById(configId);
          if (!config) {
              // Throw standard AppError for central handler
              throw new AppError('AI Configuration not found', 404); 
          }
          // Service should handle masking of sensitive data
          res.status(200).json({ success: true, data: { config } });
      } catch (error) {
          logger.error(`Error in ${this.serviceName}.${methodName} for ID ${configId}:`, error);
          next(error);
      }
  }

  public createConfig = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
      const methodName = 'createConfig';
      const payload: AIConfigPayload = req.body;
      try {
          logger.info(`Entering ${this.serviceName}.${methodName}`);
          // Assuming admin check happens in middleware
          // TODO: Add detailed payload validation here or in middleware/service
          const newConfig = await aiConfigService.createConfig(payload);
          // Service should mask API key before returning
          res.status(201).json({ success: true, data: { config: newConfig }, message: 'AI Configuration created successfully' });
      } catch (error) {
          logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
          next(error); // Pass error (e.g., validation, duplicate key) to central handler
      }
  }

  public updateConfig = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
      const methodName = 'updateConfig';
      const { configId } = req.params;
      const payload: Partial<AIConfigPayload> = req.body;
      try {
          logger.info(`Entering ${this.serviceName}.${methodName} for ID: ${configId}`);
          validateId(configId, 'AI 配置');
          // Assuming admin check happens in middleware
          // TODO: Add detailed payload validation
          const updatedConfig = await aiConfigService.updateConfig(configId, payload);
           if (!updatedConfig) {
              throw new AppError('AI Configuration not found', 404);
          }
          // Service should mask API key
          res.status(200).json({ success: true, data: { config: updatedConfig }, message: 'AI Configuration updated successfully' });
      } catch (error) {
          logger.error(`Error in ${this.serviceName}.${methodName} for ID ${configId}:`, error);
          next(error);
      }
  }

  public deleteConfig = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
      const methodName = 'deleteConfig';
      const { configId } = req.params;
      try {
          logger.info(`Entering ${this.serviceName}.${methodName} for ID: ${configId}`);
          validateId(configId, 'AI 配置');
          // Assuming admin check happens in middleware
          // Service method should throw an error if config not found or delete fails
          await aiConfigService.deleteConfig(configId);
          // If service call completes without throwing, it succeeded
          res.status(200).json({ success: true, message: 'AI 配置已删除' });
      } catch (error) {
          logger.error(`Error in ${this.serviceName}.${methodName} for ID ${configId}:`, error);
          next(error); // Pass error (e.g., not found from service) to central handler
      }
  }
}
