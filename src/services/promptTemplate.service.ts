import { PromptTemplate, IPromptTemplate, PromptTaskType, IPromptLanguagePair } from '../models/promptTemplate.model';
import { IUser } from '../models/user.model'; // Assuming IUser interface for permissions
import { handleServiceError, validateId, validateEntityExists } from '../utils/errorHandler';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors';
import logger from '../utils/logger';
import mongoose, { Types } from 'mongoose';

// Export the DTOs/Interfaces so they can be imported elsewhere

// DTO for creating a new template
export interface CreatePromptTemplateDto {
  name: string;
  description?: string;
  systemInstruction: string;
  userPrompt: string;
  domain?: string;
  languagePairs?: IPromptLanguagePair[];
  taskType: PromptTaskType;
  isPublic?: boolean;
}

// DTO for updating a template
export interface UpdatePromptTemplateDto {
  name?: string;
  description?: string;
  systemInstruction?: string;
  userPrompt?: string;
  domain?: string;
  languagePairs?: IPromptLanguagePair[];
  isPublic?: boolean;
  // Note: taskType and createdBy generally shouldn't be updated
}

// Interface for filtering templates
export interface GetTemplatesFilter {
  createdBy?: string; // User ID
  taskType?: PromptTaskType;
  domain?: string;
  isPublic?: boolean;
  search?: string; // Optional search term for name/description
  page?: number;
  limit?: number;
}

export class PromptTemplateService {
  private serviceName = 'PromptTemplateService';

  /**
   * Create a new prompt template
   */
  async createTemplate(userId: string, data: CreatePromptTemplateDto): Promise<IPromptTemplate> {
    const methodName = 'createTemplate';
    validateId(userId, '创建用户');
    // Basic validation for required fields
    if (!data.name || !data.systemInstruction || !data.userPrompt || !data.taskType) {
        throw new ValidationError('Missing required fields for prompt template (name, systemInstruction, userPrompt, taskType).');
    }

    try {
      const newTemplate = new PromptTemplate({
        ...data,
        createdBy: new Types.ObjectId(userId),
        isPublic: data.isPublic ?? false, // Default to private
      });

      await newTemplate.save();
      logger.info(`Prompt template '${newTemplate.name}' created by user ${userId}`);
      return newTemplate;
    } catch (error) {
      logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
      throw handleServiceError(error, this.serviceName, methodName, '创建提示模板');
    }
  }

  /**
   * Get a template by its ID
   */
  async getTemplateById(templateId: string, userId?: string): Promise<IPromptTemplate> {
    const methodName = 'getTemplateById';
    validateId(templateId, '模板');

    try {
      const template = await PromptTemplate.findById(templateId).populate('createdBy', 'id username fullName').exec();
      validateEntityExists(template, '提示模板');

      // Permission check: Allow access if public or if user created it
      // If userId is not provided, assume public access check only (e.g., internal service call)
      if (!template.isPublic && userId) {
          const templateCreatorId = template.createdBy instanceof Types.ObjectId 
              ? template.createdBy 
              : (template.createdBy as IUser)?._id;
          if (!templateCreatorId || !templateCreatorId.equals(userId)) {
              // TODO: Add role check? Allow admins?
              throw new ForbiddenError(`User ${userId} does not have permission to access private template ${templateId}`);
          }
      }

      return template;
    } catch (error) {
      logger.error(`Error in ${this.serviceName}.${methodName} for template ${templateId}:`, error);
      throw handleServiceError(error, this.serviceName, methodName, '获取提示模板');
    }
  }

  /**
   * Get a list of templates based on filters
   */
  async getTemplates(userId: string, filters: GetTemplatesFilter = {}): Promise<{ data: IPromptTemplate[], total: number, page: number, limit: number }> {
    const methodName = 'getTemplates';
    // Temporarily comment out validation to test flow
    // validateId(userId, '用户'); 
    logger.info(`[${methodName}] User ID validation skipped (debugging): ${userId}`); // Log after validation
    logger.info(`[${methodName}] Service called by user: ${userId}, Filters: ${JSON.stringify(filters)}`); 

    // Change log level and add log inside try
    logger.info(`[${methodName}] About to enter main try block...`); // Changed to info
    try {
      logger.info(`[${methodName}] Entered main try block.`); // Added log inside try
      const query: mongoose.FilterQuery<IPromptTemplate> = {};
      const page = filters.page || 1;
      const limit = filters.limit || 10;
      const skip = (page - 1) * limit;

      // Build query based on filters
      if (filters.taskType) {
        query.taskType = filters.taskType;
      }
      if (filters.domain) {
        query.domain = filters.domain;
      }
      if (filters.search) {
          query.$or = [
              { name: { $regex: filters.search, $options: 'i' } },
              { description: { $regex: filters.search, $options: 'i' } }
          ];
      }

      // Permission filter: User can see their own templates + public templates
      const userObjectId = new Types.ObjectId(userId);
      const permissionQuery = {
        $or: [
          { createdBy: userObjectId }, // User's own templates
          { isPublic: true } // Public templates
        ]
      };
      
      // Combine base query and permission query
      const finalQuery = { ...query, ...permissionQuery };
      logger.debug(`[${methodName}] Final MongoDB Query: ${JSON.stringify(finalQuery)}`); // Log the final query

      const [templates, total] = await Promise.all([
        PromptTemplate.find(finalQuery)
          .populate('createdBy', 'id username fullName')
          .sort({ createdAt: -1 }) // Sort by newest first
          .skip(skip)
          .limit(limit)
          .exec(),
        PromptTemplate.countDocuments(finalQuery)
      ]);

      logger.debug(`[${methodName}] Found ${total} total matching templates.`); // Log total count found
      logger.debug(`[${methodName}] Returning ${templates.length} templates for page ${page}.`); // Log count for the page
      // logger.debug(`[${methodName}] Template data being returned:`, templates); // Optional: Log full template data if needed, might be large

      return { data: templates, total, page, limit };
    } catch (error) {
      logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
      throw handleServiceError(error, this.serviceName, methodName, '获取提示模板列表');
    }
  }

  /**
   * Update an existing prompt template
   */
  async updateTemplate(templateId: string, userId: string, data: UpdatePromptTemplateDto): Promise<IPromptTemplate> {
    const methodName = 'updateTemplate';
    validateId(templateId, '模板');
    validateId(userId, '用户');

    try {
      const template = await PromptTemplate.findById(templateId).exec();
      validateEntityExists(template, '提示模板');

      // Permission check: Explicitly compare ObjectIds
      const userObjectId = new Types.ObjectId(userId);
      // Cast createdBy to ObjectId before comparing
      if (!template.createdBy || !(template.createdBy as Types.ObjectId).equals(userObjectId)) { 
        throw new ForbiddenError(`User ${userId} does not have permission to update template ${templateId}`);
      }
      
      delete (data as any).taskType; 
      delete (data as any).createdBy;

      Object.assign(template, data);

      await template.save();
      logger.info(`Prompt template ${templateId} updated by user ${userId}`);
      return await template.populate('createdBy', 'id username fullName');

    } catch (error) {
      logger.error(`Error in ${this.serviceName}.${methodName} for template ${templateId}:`, error);
      throw handleServiceError(error, this.serviceName, methodName, '更新提示模板');
    }
  }

  /**
   * Delete a prompt template
   */
  async deleteTemplate(templateId: string, userId: string): Promise<{ success: boolean }> {
    const methodName = 'deleteTemplate';
    validateId(templateId, '模板');
    validateId(userId, '用户');

    try {
      const template = await PromptTemplate.findById(templateId).exec();
      validateEntityExists(template, '提示模板');

      // Permission check: Explicitly compare ObjectIds
      const userObjectId = new Types.ObjectId(userId);
      // Cast createdBy to ObjectId before comparing
      if (!template.createdBy || !(template.createdBy as Types.ObjectId).equals(userObjectId)) { 
        throw new ForbiddenError(`User ${userId} does not have permission to delete template ${templateId}`);
      }

      await PromptTemplate.findByIdAndDelete(templateId);

      logger.info(`Prompt template ${templateId} deleted by user ${userId}`);
      return { success: true };
    } catch (error) {
      logger.error(`Error in ${this.serviceName}.${methodName} for template ${templateId}:`, error);
      throw handleServiceError(error, this.serviceName, methodName, '删除提示模板');
    }
  }
}

// Export singleton instance
export const promptTemplateService = new PromptTemplateService(); 