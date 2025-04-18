// src/controllers/aiConfig.controller.ts
import { Request, Response, NextFunction } from 'express';
import { AIProviderConfig, IAIProviderConfig } from '../models/aiConfig.model'; // Correct model import
// Remove direct service import
// import { aiConfigService, AIConfigPayload } from '../services/aiConfig.service'; 
import { AIConfigService, AIConfigPayload } from '../services/aiConfig.service'; // Keep Payload type, import Service Class
import { validateId } from '../utils/errorHandler'; // Assuming this is the correct path/export for validation
import logger from '../utils/logger';
import { AppError, NotFoundError } from '../utils/errors'; // Removed unused ValidationError
import { Inject, Service } from 'typedi'; // Import typedi

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

@Service() // Add Service decorator
export class AIConfigController {
  private serviceName = 'AIConfigController';
  
  // Inject AIConfigService
  constructor(@Inject() private aiConfigService: AIConfigService) {}

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

  // --- CRUD Methods using injected service --- 

  public getAllConfigs = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
      const methodName = 'getAllConfigs';
      logger.info(`Entering ${this.serviceName}.${methodName}`);
      try {
          // Use injected service
          const configs = await this.aiConfigService.getAllConfigs();
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
          validateId(configId, 'AI 配置');
          // Use injected service
          const config = await this.aiConfigService.getConfigById(configId);
          if (!config) {
              // Use NotFoundError for consistency
              throw new NotFoundError('AI Configuration not found'); 
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
          // Use injected service
          const newConfig = await this.aiConfigService.createConfig(payload);
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
          // Use injected service
          const updatedConfig = await this.aiConfigService.updateConfig(configId, payload);
           if (!updatedConfig) {
              throw new NotFoundError('AI Configuration not found');
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
          // Use injected service
          await this.aiConfigService.deleteConfig(configId);
          // If service call completes without throwing, it succeeded
          res.status(200).json({ success: true, message: 'AI 配置已删除' });
      } catch (error) {
          logger.error(`Error in ${this.serviceName}.${methodName} for ID ${configId}:`, error);
          next(error); // Pass error (e.g., not found from service) to central handler
      }
  }
}
