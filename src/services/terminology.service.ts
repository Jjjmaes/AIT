import { Service } from 'typedi';
import { Terminology, ITerminology, ITermEntry, ITerminologyLanguagePair } from '../models/terminology.model';
import User, { IUser } from '../models/user.model'; // Assuming User model for permissions
import { Project, IProject } from '../models/project.model'; // <-- Restored import
import { handleServiceError, validateId, validateEntityExists } from '../utils/errorHandler';
import { NotFoundError, ForbiddenError, ValidationError, AppError } from '../utils/errors';
import logger from '../utils/logger';
import mongoose, { Types } from 'mongoose';
// Try namespace import for types if direct import failed
// import * as mongoosePaginate from 'mongoose-paginate-v2';

// DTO for creating a new terminology list
export interface CreateTerminologyDto { 
  name: string;
  description?: string;
  languagePairs: ITerminologyLanguagePair[];
  terms?: ITermEntry[];
  projectId?: string; // Optional project ID to link to
  isPublic?: boolean;
}

// DTO for updating terminology list details (not individual terms)
export interface UpdateTerminologyDto { 
  name?: string;
  description?: string;
  languagePairs?: ITerminologyLanguagePair[];
  isPublic?: boolean;
  projectId?: string | null; // Allow linking/unlinking project
}

// DTO for adding/updating a single term
export interface UpsertTermDto { 
  source: string;
  target: string;
  domain?: string;
  notes?: string;
}

// Interface for filtering terminology lists
export interface GetTerminologyFilter { 
  projectId?: string;
  userId?: string; // To fetch user's own + public lists
  isPublic?: boolean;
  search?: string; // Optional search term for name/description
  page?: number;
  limit?: number;
}

@Service()
export class TerminologyService {
  private serviceName = 'TerminologyService';

  /**
   * Create a new terminology list
   */
  async createTerminology(userId: string, data: CreateTerminologyDto): Promise<ITerminology> {
    const methodName = 'createTerminology';
    validateId(userId, '创建用户');
    if (!data.name || !data.languagePairs || data.languagePairs.length === 0) {
      throw new ValidationError('Missing required fields (name, languagePairs).');
    }

    try {
      let projectObjectId: Types.ObjectId | undefined = undefined;
      if (data.projectId) {
        validateId(data.projectId, '关联项目');
        projectObjectId = new Types.ObjectId(data.projectId);
        // --- Restore project check ---
        const project = await Project.findById(projectObjectId);
        validateEntityExists(project, '关联项目');
        // --- End restore ---
      }

      const newTerminology = new Terminology({
        ...data,
        createdBy: new Types.ObjectId(userId),
        project: projectObjectId ? projectObjectId : null,
        terms: data.terms || [],
        isPublic: data.isPublic ?? false,
      });

      await newTerminology.save();
      logger.info(`Terminology '${newTerminology.name}' created by user ${userId}`);
      return newTerminology;
    } catch (error) {
      logger.error(`Error in ${this.serviceName}.${methodName} (outer catch):`, error);
      throw handleServiceError(error, this.serviceName, methodName, '创建术语表');
    }
  }

  /**
   * Get a terminology list by ID
   */
  async getTerminologyById(terminologyId: string, userId?: string): Promise<ITerminology> {
    const methodName = 'getTerminologyById';
    validateId(terminologyId, '术语表');

    try {
      const terminology = await Terminology.findById(terminologyId)
                                  .populate('createdBy', 'id username fullName')
                                  // --- Restore project populate ---
                                  .populate('project', 'id name manager members')
                                  .exec();
      validateEntityExists(terminology, '术语表');

      // --- Restore project-based permission check ---
      if (!terminology.isPublic && userId) {
          const userObjectId = new Types.ObjectId(userId);
          const creatorId = terminology.createdBy instanceof Types.ObjectId
               ? terminology.createdBy
               : (terminology.createdBy as IUser)?._id;

          let userHasAccess = creatorId?.equals(userObjectId);

          // If not creator, check project access
          if (!userHasAccess && terminology.project && typeof terminology.project === 'object') {
              const project = terminology.project as IProject; // Type assertion
              const isProjectManager = project.manager?.equals(userObjectId);
              const isProjectMember = project.members?.some((m: Types.ObjectId) => m.equals(userObjectId));
              userHasAccess = isProjectManager || isProjectMember;
          }

          if (!userHasAccess) {
             throw new ForbiddenError(`User ${userId} does not have permission to access terminology ${terminologyId}`);
          }
      }
      // --- End restore project-based check ---

      return terminology;
    } catch (error) {
      logger.error(`Error in ${this.serviceName}.${methodName} for ID ${terminologyId}:`, error);
      throw handleServiceError(error, this.serviceName, methodName, '获取术语表');
    }
  }

  /**
   * Get terminology lists based on filters
   */
  async getTerminologies(filters: GetTerminologyFilter) {
    const methodName = 'getTerminologies';
    try {
      const query: mongoose.FilterQuery<ITerminology> = {};
      const page = filters.page || 1;
      const limit = filters.limit || 10;

      // ... (Build query: projectId, search, isPublic) ...
       if (filters.projectId) {
        query.project = new Types.ObjectId(filters.projectId);
      }
      if (filters.search) {
          query.$or = [
              { name: { $regex: filters.search, $options: 'i' } },
              { description: { $regex: filters.search, $options: 'i' } }
          ];
      }
      if (typeof filters.isPublic === 'boolean') {
          query.isPublic = filters.isPublic;
      }

      // --- Restore project-based permission filter ---
      if (filters.userId) {
          validateId(filters.userId, '用户');
          const userObjectId = new Types.ObjectId(filters.userId);
          // Find projects where the user is manager or member
          const accessibleProjects = await Project.find({ 
              $or: [
                  { manager: userObjectId },
                  { members: userObjectId }
              ]
           }).select('_id').exec();
          const accessibleProjectIds = accessibleProjects.map(p => p._id);

          // Adjusted query: Own OR Public OR Linked to accessible project
          query.$or = [
              { createdBy: userObjectId },
              { isPublic: true },
              { project: { $in: accessibleProjectIds } }
          ];
           // If asking for specific project, this $or is fine as it will be intersected
           // If NOT asking for specific project, this $or correctly includes own, public, and accessible project-linked lists.
      } else if (typeof filters.isPublic !== 'boolean' && !filters.projectId) {
          query.isPublic = true;
      }
      // --- End restore ---
      
      const options = { page, limit, sort: { updatedAt: -1 }, populate: 'createdBy project' };
      const result = await (Terminology as any).paginate(query, options);
      return result;

    } catch (error) {
      logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
      throw handleServiceError(error, this.serviceName, methodName, '获取术语表列表');
    }
  }

  /**
   * Update terminology list details
   */
  async updateTerminology(terminologyId: string, userId: string, data: UpdateTerminologyDto): Promise<ITerminology> {
    const methodName = 'updateTerminology';
    validateId(terminologyId, '术语表');
    validateId(userId, '用户');

    try {
      // --- Restore project populate ---
      const terminology = await Terminology.findById(terminologyId).populate('project', 'id name manager members').exec();
      validateEntityExists(terminology, '术语表');

      // --- Restore permission check ---
      const userObjectId = new Types.ObjectId(userId);
      const creatorId = terminology.createdBy instanceof Types.ObjectId
               ? terminology.createdBy
               : (terminology.createdBy as IUser)?._id;
      const isCreator = creatorId?.equals(userObjectId); 
      let isProjectManager = false;
      if (terminology.project && typeof terminology.project === 'object') {
           isProjectManager = (terminology.project as IProject).manager?.equals(userObjectId);
      }

      if (!isCreator && !isProjectManager) { // Restored check
        throw new ForbiddenError(`User ${userId} does not have permission to update terminology ${terminologyId}`);
      }
      // --- End restore ---

      // ... (update fields) ...
      if (data.name !== undefined) terminology.name = data.name;
      if (data.description !== undefined) terminology.description = data.description;
      if (data.languagePairs !== undefined) {
        terminology.languagePairs = data.languagePairs;
        terminology.markModified('languagePairs');
      }
      if (data.isPublic !== undefined) terminology.isPublic = data.isPublic;
      
      // Handle project linking/unlinking
      if (data.projectId !== undefined) {
          if (data.projectId === null) {
              terminology.project = undefined;
          } else {
              validateId(data.projectId, '关联项目');
              const projectToLink = await Project.findById(data.projectId);
              validateEntityExists(projectToLink, '要关联的项目');
              // Add permission check? Maybe only project manager can link?
              terminology.project = new Types.ObjectId(data.projectId);
          }
          terminology.markModified('project');
      }

      await terminology.save();
      logger.info(`Terminology ${terminologyId} updated by user ${userId}`);
      // Restore project populate
      return await Terminology.findById(terminologyId).populate('createdBy', 'id username fullName').populate('project', 'id name').exec() as ITerminology;

    } catch (error) {
      logger.error(`Error in ${this.serviceName}.${methodName} for ID ${terminologyId}:`, error);
      throw handleServiceError(error, this.serviceName, methodName, '更新术语表');
    }
  }

  /**
   * Delete a terminology list
   */
  async deleteTerminology(terminologyId: string, userId: string): Promise<{ success: boolean }> {
    const methodName = 'deleteTerminology';
    validateId(terminologyId, '术语表');
    validateId(userId, '用户');

    try {
      const terminology = await Terminology.findById(terminologyId).populate('project', 'manager').populate('createdBy', '_id').exec();
      validateEntityExists(terminology, '术语表');

      // Permission check: Creator or Manager of linked project
      const userObjectId = new Types.ObjectId(userId);
      // Cast createdBy as it's populated
      const creatorId = terminology.createdBy instanceof Types.ObjectId
               ? terminology.createdBy
               : (terminology.createdBy as IUser)?._id;
      const isCreator = creatorId?.equals(userObjectId);
      let isProjectManager = false;
       if (terminology.project && typeof terminology.project === 'object') {
           isProjectManager = (terminology.project as IProject).manager?.equals(userObjectId);
      }

      if (!isCreator && !isProjectManager) {
          throw new ForbiddenError(`User ${userId} does not have permission to delete terminology ${terminologyId}`);
      }

      // TODO: Prevent deletion if linked project has this as its primary terminology?
      // const linkedProjects = await Project.find({ terminology: terminology._id });
      // if (linkedProjects.length > 0) throw new ValidationError(...)

      await Terminology.findByIdAndDelete(terminologyId);
      logger.info(`Terminology ${terminologyId} deleted by user ${userId}`);
      return { success: true };

    } catch (error) {
      logger.error(`Error in ${this.serviceName}.${methodName} for ID ${terminologyId}:`, error);
      throw handleServiceError(error, this.serviceName, methodName, '删除术语表');
    }
  }

  // --- Term Management within a List ---

  /**
   * Add or update a term in a list (Upsert)
   */
  async upsertTerm(terminologyId: string, userId: string, termData: UpsertTermDto): Promise<ITerminology> {
    const methodName = 'upsertTerm';
    validateId(terminologyId, '术语表');
    validateId(userId, '用户');
    if (!termData || !termData.source || !termData.target) {
        throw new ValidationError('Term data requires source and target.');
    }

    try {
      const terminology = await Terminology.findById(terminologyId).populate('project', 'manager members').populate('createdBy', '_id').exec();
      validateEntityExists(terminology, '术语表');

      // Permission check (creator or project manager/member?)
      const userObjectId = new Types.ObjectId(userId);
      // Cast createdBy as it's populated
       const creatorId = terminology.createdBy instanceof Types.ObjectId
               ? terminology.createdBy
               : (terminology.createdBy as IUser)?._id;
      const isCreator = creatorId?.equals(userObjectId);
      let isProjectMemberOrManager = false;
      if (terminology.project && typeof terminology.project === 'object') {
           const project = terminology.project as IProject;
           isProjectMemberOrManager = project.manager?.equals(userObjectId) ||
                                     project.members?.some((m: Types.ObjectId) => m.equals(userObjectId));
      }

      if (!isCreator && !isProjectMemberOrManager) {
          throw new ForbiddenError(`User ${userId} does not have permission to modify terms in terminology ${terminologyId}`);
      }
      
      const termIndex = terminology.terms.findIndex(t => t.source === termData.source);
      const now = new Date();
      
      if (termIndex > -1) {
          // Update existing term
          const existingTerm = terminology.terms[termIndex];
          existingTerm.target = termData.target;
          existingTerm.domain = termData.domain;
          existingTerm.notes = termData.notes;
          existingTerm.lastModifiedBy = userObjectId;
          existingTerm.lastModifiedAt = now;
          logger.info(`Term '${termData.source}' updated in terminology ${terminologyId} by user ${userId}`);
      } else {
          // Add new term - include required fields
          const newTerm: ITermEntry = {
              source: termData.source,
              target: termData.target,
              domain: termData.domain,
              notes: termData.notes,
              createdBy: userObjectId,
              createdAt: now,
              lastModifiedBy: userObjectId,
              lastModifiedAt: now
          };
          terminology.terms.push(newTerm);
          logger.info(`Term '${termData.source}' added to terminology ${terminologyId} by user ${userId}`);
      }
      
      terminology.markModified('terms'); // Mark the array as modified
      await terminology.save();
      return terminology; // Return the updated list

    } catch (error) {
       logger.error(`Error in ${this.serviceName}.${methodName} for ID ${terminologyId}:`, error);
      throw handleServiceError(error, this.serviceName, methodName, '添加/更新术语');
    }
  }

  /**
   * Remove a term from a list by its source text
   */
  async removeTerm(terminologyId: string, userId: string, sourceTerm: string): Promise<ITerminology> {
      const methodName = 'removeTerm';
      validateId(terminologyId, '术语表');
      validateId(userId, '用户');
      if (!sourceTerm) {
          throw new ValidationError('Source term is required to remove.');
      }

      try {
          const terminology = await Terminology.findById(terminologyId).populate('project', 'manager members').populate('createdBy', '_id').exec();
          validateEntityExists(terminology, '术语表');

          // Permission check
          const userObjectId = new Types.ObjectId(userId);
          // Cast createdBy as it's populated
           const creatorId = terminology.createdBy instanceof Types.ObjectId
               ? terminology.createdBy
               : (terminology.createdBy as IUser)?._id;
          const isCreator = creatorId?.equals(userObjectId);
          let isProjectMemberOrManager = false;
          if (terminology.project && typeof terminology.project === 'object') {
               const project = terminology.project as IProject;
               isProjectMemberOrManager = project.manager?.equals(userObjectId) ||
                                         project.members?.some((m: Types.ObjectId) => m.equals(userObjectId));
          }

          if (!isCreator && !isProjectMemberOrManager) {
              throw new ForbiddenError(`User ${userId} does not have permission to modify terms in terminology ${terminologyId}`);
          }

          const initialLength = terminology.terms.length;
          terminology.terms = terminology.terms.filter(t => t.source !== sourceTerm);

          if (terminology.terms.length === initialLength) {
              throw new NotFoundError(`Term with source '${sourceTerm}' not found in terminology ${terminologyId}`);
          }

          terminology.markModified('terms');
          await terminology.save();
          logger.info(`Term '${sourceTerm}' removed from terminology ${terminologyId} by user ${userId}`);
          return terminology;

      } catch (error) {
          logger.error(`Error in ${this.serviceName}.${methodName} for ID ${terminologyId}:`, error);
          throw handleServiceError(error, this.serviceName, methodName, '删除术语');
      }
  }

  private async upsertTermInternal(
      terminology: ITerminology,
      userId: string,
      termData: UpsertTermDto
  ): Promise<{ term: ITermEntry, status: 'added' | 'updated' }> {
      const methodName = 'upsertTermInternal';
      validateId(terminology._id, '术语表');
      validateId(userId, '用户');
      if (!termData || !termData.source || !termData.target) {
          throw new ValidationError('Term data requires source and target.');
      }

      try {
          const userObjectId = new Types.ObjectId(userId);
          const creatorId = terminology.createdBy instanceof Types.ObjectId
                   ? terminology.createdBy
                   : (terminology.createdBy as IUser)?._id;
          const isCreator = creatorId?.equals(userObjectId);
          let isProjectMemberOrManager = false;
          if (terminology.project && typeof terminology.project === 'object') {
               const project = terminology.project as IProject;
               isProjectMemberOrManager = project.manager?.equals(userObjectId) ||
                                         project.members?.some((m: Types.ObjectId) => m.equals(userObjectId));
          }

          if (!isCreator && !isProjectMemberOrManager) {
              throw new ForbiddenError(`User ${userId} does not have permission to modify terms in terminology ${terminology._id}`);
          }
          
          const termIndex = terminology.terms.findIndex(t => t.source === termData.source);
          
          let termResult: ITermEntry;
          let status: 'added' | 'updated' = 'added';
          const now = new Date();

          if (termIndex > -1) {
              // Update existing term
              const existingTerm = terminology.terms[termIndex];
              existingTerm.target = termData.target;
              existingTerm.domain = termData.domain;
              existingTerm.notes = termData.notes;
              existingTerm.lastModifiedBy = userObjectId;
              existingTerm.lastModifiedAt = now;
              termResult = existingTerm as ITermEntry;
              status = 'updated';
          } else {
              // Add new term - include required fields
              const newTerm: ITermEntry = {
                  source: termData.source,
                  target: termData.target,
                  domain: termData.domain,
                  notes: termData.notes,
                  createdBy: userObjectId,
                  createdAt: now,
                  lastModifiedBy: userObjectId,
                  lastModifiedAt: now
              };
              terminology.terms.push(newTerm);
              termResult = newTerm;
          }

          // Save the parent document only if a term was added or updated
          if (status === 'added' || (status === 'updated' && termResult.lastModifiedAt === now)) {
              try {
                terminology.updatedAt = now;
                await terminology.save();
              } catch (saveError) {
                 logger.error(`[${this.serviceName}.${methodName}] Error saving terminology list ${terminology._id} after term upsert:`, saveError);
                 throw new ValidationError(`Failed to save terminology list after upserting term '${termData.source}'`);
              }
          }
          return { term: termResult, status };
      } catch (error) {
          logger.error(`Error in ${this.serviceName}.${methodName} for ID ${terminology._id}:`, error);
          throw handleServiceError(error, this.serviceName, methodName, '添加/更新术语');
      }
  }

  // Ensure findTermsForTranslation uses ITermEntry
  async findTermsForTranslation(projectId: string, sourceLang: string, targetLang: string, texts: string[]): Promise<Map<string, ITermEntry[]>> {
    // ... existing placeholder ...
    return new Map<string, ITermEntry[]>();
  }

  /**
   * Get all terms within a specific terminology list.
   * @param terminologyId The ID of the list.
   * @returns A promise resolving to an array of terms.
   * @throws {AppError} If the list is not found or fetching fails.
   */
  async getTermsByListId(terminologyId: string): Promise<any[]> { throw new Error('Not implemented'); }

  /**
   * Export terminology list to CSV format
   */
  async exportTerminology(terminologyId: string, userId: string): Promise<string> {
    const methodName = 'exportTerminology';
    validateId(terminologyId, '术语表');
    validateId(userId, '用户');

    try {
      // Use getById to leverage existing permission checks
      const terminology = await this.getTerminologyById(terminologyId, userId);

      if (!terminology || !Array.isArray(terminology.terms)) {
        logger.warn(`[${this.serviceName}.${methodName}] No terms found or invalid format for terminology ${terminologyId}`);
        return ''; // Return empty string if no terms
      }

      // Basic CSV Formatting (Consider using a library like 'csv-stringify' for robustness)
      const header = 'source,target,domain,notes\n'; // Define CSV header
      const rows = terminology.terms.map(term => {
        // Escape commas and quotes within fields (basic implementation)
        const escapeCsv = (field: string | undefined | null) => {
          if (field === null || field === undefined) return '';
          const str = String(field);
          // If field contains comma, newline, or double quote, enclose in double quotes and escape existing quotes
          if (str.includes(',') || str.includes('\n') || str.includes('"')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };
        return [
          escapeCsv(term.source),
          escapeCsv(term.target),
          escapeCsv(term.domain),
          escapeCsv(term.notes)
        ].join(',');
      });

      const csvContent = header + rows.join('\n');
      logger.info(`[${this.serviceName}.${methodName}] Exported ${terminology.terms.length} terms for terminology ${terminologyId}`);
      return csvContent;

    } catch (error) {
      logger.error(`Error in ${this.serviceName}.${methodName} for ID ${terminologyId}:`, error);
      // Re-throw using handleServiceError to ensure consistent error handling
      throw handleServiceError(error, this.serviceName, methodName, '导出术语表');
    }
  }
}

