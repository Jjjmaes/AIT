import { Request, Response, NextFunction } from 'express';
import { promptTemplateService, PromptTemplatePayload } from '../services/promptTemplate.service';
import { validateId } from '../utils/errorHandler'; // Assuming path is correct
import logger from '../utils/logger';
import { AppError } from '../utils/errors';

// Assuming AuthRequest interface is defined here or imported
interface AuthRequest extends Request {
  user?: {
    id: string;
    // other user fields...
  };
}

export class PromptTemplateController {
    private serviceName = 'PromptTemplateController';

    // GET /api/prompts - Get all templates
    public getAllTemplates = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        const methodName = 'getAllTemplates';
        logger.info(`Entering ${this.serviceName}.${methodName}`);
        try {
            // TODO: Add filtering/pagination based on query params if needed
            const templates = await promptTemplateService.getAllPromptTemplates();
            res.status(200).json({ success: true, data: { templates } });
        } catch (error) {
            logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
            next(error);
        }
    }

    // GET /api/prompts/:templateId - Get template by ID
    public getTemplateById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        const methodName = 'getTemplateById';
        const { templateId } = req.params;
        try {
            logger.info(`Entering ${this.serviceName}.${methodName} for ID: ${templateId}`);
            validateId(templateId, 'Prompt Template'); // Use existing validation if available
            const template = await promptTemplateService.getPromptTemplateById(templateId);
            if (!template) {
                 throw new AppError('Prompt template not found', 404);
            }
            res.status(200).json({ success: true, data: { template } });
        } catch (error) {
            logger.error(`Error in ${this.serviceName}.${methodName} for ID ${templateId}:`, error);
            next(error);
        }
    }

    // POST /api/prompts - Create new template
    public createTemplate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        const methodName = 'createTemplate';
        const payload: PromptTemplatePayload = req.body;
         // Add creator ID from authenticated user
        const userId = req.user?.id; 

        try {
            logger.info(`Entering ${this.serviceName}.${methodName}`);
            // Basic check for user ID (middleware should ensure user exists)
             if (!userId) {
                 throw new AppError('Authentication required: User ID not found.', 401);
            }
            // TODO: Add detailed payload validation (e.g., using Zod/Joi)
            const newTemplate = await promptTemplateService.createPromptTemplate({
                 ...payload,
                 createdBy: userId // Pass user ID to service
            });
            res.status(201).json({ success: true, data: { template: newTemplate }, message: 'Prompt template created successfully' });
        } catch (error) {
            logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
            next(error);
        }
    }

    // PUT /api/prompts/:templateId - Update template
    public updateTemplate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        const methodName = 'updateTemplate';
        const { templateId } = req.params;
        const payload: Partial<PromptTemplatePayload> = req.body;
        // TODO: Add permission check - does req.user.id own this template? (or is admin?)
        
        try {
            logger.info(`Entering ${this.serviceName}.${methodName} for ID: ${templateId}`);
            validateId(templateId, 'Prompt Template');
            // TODO: Add detailed payload validation
            const updatedTemplate = await promptTemplateService.updatePromptTemplate(templateId, payload);
            if (!updatedTemplate) {
                 throw new AppError('Prompt template not found', 404);
            }
            res.status(200).json({ success: true, data: { template: updatedTemplate }, message: 'Prompt template updated successfully' });
        } catch (error) {
             logger.error(`Error in ${this.serviceName}.${methodName} for ID ${templateId}:`, error);
            next(error);
        }
    }

    // DELETE /api/prompts/:templateId - Delete template
    public deleteTemplate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        const methodName = 'deleteTemplate';
        const { templateId } = req.params;
         // TODO: Add permission check - does req.user.id own this template? (or is admin?)

        try {
            logger.info(`Entering ${this.serviceName}.${methodName} for ID: ${templateId}`);
            validateId(templateId, 'Prompt Template');
            // Service's delete method throws 404 if not found, which next(error) will handle
            await promptTemplateService.deletePromptTemplate(templateId);
            res.status(200).json({ success: true, message: 'Prompt template deleted successfully' });
        } catch (error) {
             logger.error(`Error in ${this.serviceName}.${methodName} for ID ${templateId}:`, error);
            next(error);
        }
    }
}