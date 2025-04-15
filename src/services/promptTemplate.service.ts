import { PromptTemplate, IPromptTemplate, PromptTemplateType, OutputFormat } from '../models/promptTemplate.model';
import { AppError } from '../utils/errors'; // Assuming custom error class
import logger from '../utils/logger';
import mongoose, { Types } from 'mongoose'; // Import mongoose and Types

// Remove incorrect DTOs/Interfaces from the merged code
// export interface CreatePromptTemplateDto { ... }
// export interface UpdatePromptTemplateDto { ... }
// export interface GetTemplatesFilter { ... }

// Keep the correct payload definition
export interface PromptTemplatePayload {
    name: string;
    description: string;
    type: PromptTemplateType;
    content: string;
    outputFormat: OutputFormat;
    variables: string[];
    modelIdentifier: string;
    isActive?: boolean;
    createdBy?: string; // User ID as string
}

export class PromptTemplateService {
    private serviceName = 'PromptTemplateService';

    /**
     * Get all prompt templates.
     */
    public async getAllPromptTemplates(): Promise<IPromptTemplate[]> {
        logger.debug(`${this.serviceName}.getAllPromptTemplates called`);
        try {
            const templates = await PromptTemplate.find({})
                .populate('createdBy', 'name email')
                .lean<IPromptTemplate[]>(); 
            logger.info(`Found ${templates.length} prompt templates.`);
            return templates;
        } catch (error: any) {
            logger.error(`Error fetching all prompt templates: ${error.message}`, { error });
            throw new AppError('Failed to retrieve prompt templates.', 500);
        }
    }

    /**
     * Get a single prompt template by its ID.
     */
    public async getPromptTemplateById(id: string): Promise<IPromptTemplate | null> {
        logger.debug(`${this.serviceName}.getPromptTemplateById called with id: ${id}`);
        try {
            if (!Types.ObjectId.isValid(id)) {
                throw new AppError('Invalid prompt template ID format.', 400);
            }
            const template = await PromptTemplate.findById(id)
                .populate('createdBy', 'name email')
                .lean<IPromptTemplate>();
            return template; 
        } catch (error: any) {
            logger.error(`Error fetching prompt template with id ${id}: ${error.message}`, { error });
            if (error instanceof AppError) throw error; 
            throw new AppError('Failed to retrieve prompt template.', 500);
        }
    }

    /**
     * Create a new prompt template.
     */
    public async createPromptTemplate(payload: PromptTemplatePayload): Promise<IPromptTemplate> {
        logger.debug(`${this.serviceName}.createPromptTemplate called with payload:`, payload);
        try {
            const createData: Partial<IPromptTemplate> = {
                name: payload.name,
                description: payload.description,
                type: payload.type,
                content: payload.content,
                outputFormat: payload.outputFormat,
                modelIdentifier: payload.modelIdentifier,
                isActive: payload.isActive ?? true,
                variables: payload.variables ? Array.from(new Set(payload.variables)) : [],
            };

            if (payload.createdBy && Types.ObjectId.isValid(payload.createdBy)) {
                createData.createdBy = new Types.ObjectId(payload.createdBy);
            }

            const newTemplate = new PromptTemplate(createData);
            await newTemplate.save(); 

            logger.info(`Successfully created prompt template: ${newTemplate.name} (ID: ${newTemplate._id})`);
            
            const populatedTemplate = await PromptTemplate.findById(newTemplate._id)
                .populate('createdBy', 'name email')
                .lean<IPromptTemplate>();

            if (!populatedTemplate) {
                throw new AppError('Failed to retrieve newly created template after saving.', 500);
            }
            return populatedTemplate;

        } catch (error: any) {
             logger.error(`Error creating prompt template: ${error.message}`, { error, payload });
             if (error.code === 11000 && error.keyPattern?.name) {
                throw new AppError('A prompt template with this name already exists.', 409); 
            } else if (error.name === 'ValidationError') {
                throw new AppError(`Validation failed: ${error.message}`, 400);
            }
            throw new AppError('Failed to create prompt template.', 500);
        }
    }

    /**
     * Update an existing prompt template.
     */
    public async updatePromptTemplate(id: string, payload: Partial<PromptTemplatePayload>): Promise<IPromptTemplate | null> {
        logger.debug(`${this.serviceName}.updatePromptTemplate called for id: ${id} with payload:`, payload);
         try {
            if (!Types.ObjectId.isValid(id)) {
                throw new AppError('Invalid prompt template ID format.', 400);
            }

            // Prepare update data, explicitly excluding createdBy during spread
            const { createdBy, ...restOfPayload } = payload; // Destructure to remove createdBy
            const updateData: Partial<IPromptTemplate> = { ...restOfPayload }; // Spread only the rest
            // delete updateData.createdBy; // No longer needed as it wasn't included

            if (updateData.variables) {
                updateData.variables = Array.from(new Set(updateData.variables));
            }

            const updatedTemplate = await PromptTemplate.findByIdAndUpdate(
                id,
                updateData,
                { new: true, runValidators: true } // Return updated doc, run schema validators
            ).populate('createdBy', 'name email').lean<IPromptTemplate>();

            return updatedTemplate; // Returns null if not found by findByIdAndUpdate
        } catch (error: any) {
             logger.error(`Error updating prompt template with id ${id}: ${error.message}`, { error, payload });
             if (error.code === 11000 && error.keyPattern?.name) {
                throw new AppError('A prompt template with this name already exists.', 409);
            } else if (error.name === 'ValidationError') {
                 throw new AppError(`Validation failed: ${error.message}`, 400);
            }
            throw new AppError('Failed to update prompt template.', 500);
        }
    }

    /**
     * Delete a prompt template by its ID.
     */
    public async deletePromptTemplate(id: string): Promise<boolean> {
         logger.debug(`${this.serviceName}.deletePromptTemplate called with id: ${id}`);
         try {
            if (!Types.ObjectId.isValid(id)) {
                throw new AppError('Invalid prompt template ID format.', 400);
            }
            const result = await PromptTemplate.findByIdAndDelete(id);
            if (!result) {
                throw new AppError('Prompt template not found.', 404);
            }
            logger.info(`Successfully deleted prompt template with id: ${id}`);
            return true; 
        } catch (error: any) {
            logger.error(`Error deleting prompt template with id ${id}: ${error.message}`, { error });
            if (error instanceof AppError) throw error;
            throw new AppError('Failed to delete prompt template.', 500);
        }
    }
}

// Export an instance
export const promptTemplateService = new PromptTemplateService();