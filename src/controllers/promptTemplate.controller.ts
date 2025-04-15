import { Request, Response, NextFunction } from 'express';
import { promptTemplateService } from '../services/promptTemplate.service';
import { AuthRequest } from '../middleware/auth.middleware'; // Assuming AuthRequest provides req.user.id
// Import DTOs - they are defined within the service file, might move later
import { CreatePromptTemplateDto, UpdatePromptTemplateDto, GetTemplatesFilter } from '../services/promptTemplate.service';
import { AppError } from '../utils/errors';
import logger from '../utils/logger';

class PromptTemplateController {
  private serviceName = 'PromptTemplateController';

  // --- Create Template ---
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    const methodName = 'create';
    try {
      const userId = req.user?.id;
      if (!userId) {
        // Use standard UnauthorizedError or similar if defined
        return next(new AppError('Authentication required', 401));
      }
      // Basic validation could be added here or via middleware (e.g., express-validator)
      const templateData: CreatePromptTemplateDto = req.body;
      logger.info(`Attempting to create prompt template by user ${userId} with name: ${templateData.name}`);
      const newTemplate = await promptTemplateService.createTemplate(userId, templateData);
      res.status(201).json({ success: true, data: newTemplate });
    } catch (error) {
      logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
      next(error); // Pass to central error handler
    }
  }

  // --- Get All Templates (Filtered) ---
  async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    const methodName = 'getAll'; // Define methodName for logging
    try {
        const userId = req.user?.id;
        if (!userId) {
            return next(new AppError('Authentication required', 401));
        }
        // Extract filters from query parameters
        const filters: GetTemplatesFilter = {
            taskType: req.query.taskType as any,
            domain: req.query.domain as string,
            isPublic: req.query.isPublic ? req.query.isPublic === 'true' : undefined,
            search: req.query.search as string,
            page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
            limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        };
        logger.info(`Fetching prompt templates for user ${userId} with filters:`, filters);
        const result = await promptTemplateService.getTemplates(userId, filters);

        // Format response to match frontend expectation { success: true, data: { templates: [...] } }
        res.status(200).json({
            success: true,
            data: {
                templates: result.data,
                pagination: { // Include pagination info if needed by frontend
                    total: result.total,
                    page: result.page,
                    limit: result.limit
                }
            }
        });
    } catch (error) {
        // Corrected logger call in catch block
        logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
        next(error); // Pass to central error handler
    }
  }

  // --- Get Template By ID ---
  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    const methodName = 'getById';
    try {
        // User ID might be optional depending on if anonymous users can fetch public templates
        const userId = req.user?.id;
        const templateId = req.params.templateId;
        if (!templateId) {
             return next(new AppError('Template ID is required', 400));
        }
        logger.info(`Fetching prompt template ${templateId} for user ${userId}`);
        // Pass userId for permission checks within the service
        const template = await promptTemplateService.getTemplateById(templateId, userId);
        res.status(200).json({ success: true, data: template });
    } catch (error) {
        logger.error(`Error in ${this.serviceName}.${methodName} for ID ${req.params.templateId}:`, error);
        next(error);
    }
  }

  // --- Update Template By ID ---
  async update(req: AuthRequest, res: Response, next: NextFunction) {
    const methodName = 'update';
    try {
        const userId = req.user?.id;
        if (!userId) {
            return next(new AppError('Authentication required', 401));
        }
        const templateId = req.params.templateId;
         if (!templateId) {
             return next(new AppError('Template ID is required', 400));
        }
        // Add validation for updateData if needed
        const updateData: UpdatePromptTemplateDto = req.body;
        logger.info(`Attempting to update prompt template ${templateId} by user ${userId}`);
        const updatedTemplate = await promptTemplateService.updateTemplate(templateId, userId, updateData);
        res.status(200).json({ success: true, data: updatedTemplate });
    } catch (error) {
        logger.error(`Error in ${this.serviceName}.${methodName} for ID ${req.params.templateId}:`, error);
        next(error);
    }
  }

  // --- Delete Template By ID ---
  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    const methodName = 'delete';
    try {
        const userId = req.user?.id;
        if (!userId) {
            return next(new AppError('Authentication required', 401));
        }
        const templateId = req.params.templateId;
         if (!templateId) {
             return next(new AppError('Template ID is required', 400));
        }
        logger.info(`Attempting to delete prompt template ${templateId} by user ${userId}`);
        const result = await promptTemplateService.deleteTemplate(templateId, userId);
        // Return 200 OK or 204 No Content on successful deletion
        res.status(200).json({ success: result.success, message: 'Prompt template deleted successfully' });
    } catch (error) {
        logger.error(`Error in ${this.serviceName}.${methodName} for ID ${req.params.templateId}:`, error);
        next(error);
    }
  }
}

// Export singleton instance of the controller
export const promptTemplateController = new PromptTemplateController();