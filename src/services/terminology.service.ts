import { Terminology, ITerminology, ITermEntry, ITerminologyLanguagePair } from '../models/terminology.model';
import User, { IUser } from '../models/user.model'; // Assuming User model for permissions
import { Project, IProject } from '../models/project.model'; // Import Project for checks
import { handleServiceError, validateId, validateEntityExists } from '../utils/errorHandler';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors';
import logger from '../utils/logger';
import mongoose, { Types } from 'mongoose';

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
      // Validate projectId if provided
      let projectObjectId: Types.ObjectId | undefined = undefined;
      if (data.projectId) {
        validateId(data.projectId, '关联项目');
        projectObjectId = new Types.ObjectId(data.projectId);
        const project = await Project.findById(projectObjectId);
        validateEntityExists(project, '关联项目');
        // TODO: Add permission check - user must have access to the project?
        // const hasAccess = await projectService.hasAccess(data.projectId, userId);
        // if (!hasAccess) throw new ForbiddenError(...);
      }

      const newTerminology = new Terminology({
        ...data,
        createdBy: new Types.ObjectId(userId),
        project: projectObjectId ? projectObjectId : null,
        terms: data.terms || [], // Ensure terms is an array
        isPublic: data.isPublic ?? false,
      });

      await newTerminology.save();
      logger.info(`Terminology '${newTerminology.name}' created by user ${userId}`);
      return newTerminology;
    } catch (error) {
      logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
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
                                  .populate('project', 'id name manager members') // Populate necessary project fields for checks
                                  .exec();
      validateEntityExists(terminology, '术语表');

      // Permission check: Public or created by user or linked to a project user can access?
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

      return terminology;
    } catch (error) {
      logger.error(`Error in ${this.serviceName}.${methodName} for ID ${terminologyId}:`, error);
      throw handleServiceError(error, this.serviceName, methodName, '获取术语表');
    }
  }

  /**
   * Get terminology lists based on filters
   */
  async getTerminologies(filters: GetTerminologyFilter): Promise<{ data: ITerminology[], total: number, page: number, limit: number }> {
    const methodName = 'getTerminologies';
    try {
      const query: mongoose.FilterQuery<ITerminology> = {};
      const page = filters.page || 1;
      const limit = filters.limit || 10;
      const skip = (page - 1) * limit;

      // Build query
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

      // Permission filter: User sees their own + public + relevant project lists
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

          query.$or = [
              { createdBy: userObjectId },
              { isPublic: true },
              // Only include project-specific lists if the project filter isn't already set
              ...(filters.projectId ? [] : [{ project: { $in: accessibleProjectIds } }])
          ];
           // If no specific project filter, and not specifically asking for public,
           // apply the permission query to filter project-linked lists
           if (!filters.projectId && typeof filters.isPublic !== 'boolean') {
               query.$and = query.$and || [];
               query.$and.push({
                   $or: [
                       { project: null }, // Not linked to a project OR
                       { project: { $in: accessibleProjectIds } } // Linked to accessible project
                   ]
               });
           }
      } else if (typeof filters.isPublic !== 'boolean' && !filters.projectId) {
          // If no user context and not specifically asking for public/project, default to public
          query.isPublic = true;
      }
      
      const finalQuery = query;

      const [terminologies, total] = await Promise.all([
        Terminology.find(finalQuery)
          .populate('createdBy', 'id username fullName')
          .populate('project', 'id name') // Populate basic project info
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .exec(),
        Terminology.countDocuments(finalQuery)
      ]);

      return { data: terminologies, total, page, limit };

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
      const terminology = await Terminology.findById(terminologyId).populate('project', 'id name manager members').exec();
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
          throw new ForbiddenError(`User ${userId} does not have permission to update terminology ${terminologyId}`);
      }

      // Validate projectId if changed
      let newProjectObjectId: Types.ObjectId | undefined | IProject = terminology.project; // Keep existing project object or ObjectId
      if (data.hasOwnProperty('projectId')) { // Check if projectId key exists in update data
         if (data.projectId === null) { // Unlink project
             newProjectObjectId = undefined; // Assign undefined instead of null
         } else if (data.projectId && (!terminology.project || (terminology.project instanceof Types.ObjectId ? terminology.project.toString() !== data.projectId : terminology.project._id.toString() !== data.projectId))) { // Link to new/different project
             validateId(data.projectId, '关联项目');
             const projectObjectIdToLink = new Types.ObjectId(data.projectId);
             const project = await Project.findById(projectObjectIdToLink);
             validateEntityExists(project, '关联项目');
             // User must be manager of the NEW project to link terminology to it? Or just creator of term?
             // Let's require manager of the target project for linking.
             if (!project.manager?.equals(userObjectId)) {
                 throw new ForbiddenError(`User ${userId} is not manager of project ${data.projectId} and cannot link terminology to it.`);
             }
             newProjectObjectId = projectObjectIdToLink; // Assign the ObjectId
         }
      }
      // Only update project field if it actually changed
      // Need careful comparison as it could be ObjectId or IProject
      const currentProjectId = terminology.project instanceof Types.ObjectId ? terminology.project : (terminology.project as IProject)?._id;
      const newProjectId = newProjectObjectId instanceof Types.ObjectId ? newProjectObjectId : (newProjectObjectId as IProject)?._id;
      
      if (currentProjectId?.toString() !== newProjectId?.toString()) {
           terminology.project = newProjectObjectId;
      }

      // Update other fields
      if (data.name) terminology.name = data.name;
      if (data.hasOwnProperty('description')) terminology.description = data.description; // Allow setting empty description
      if (data.languagePairs) {
          if (data.languagePairs.length === 0) throw new ValidationError('Language pairs cannot be empty.');
          terminology.languagePairs = data.languagePairs;
      }
      if (typeof data.isPublic === 'boolean') terminology.isPublic = data.isPublic;

      await terminology.save();
      logger.info(`Terminology ${terminologyId} updated by user ${userId}`);
      // Repopulate necessary fields before returning
      return await Terminology.findById(terminologyId)
                .populate('createdBy', 'id username fullName')
                .populate('project', 'id name')
                .exec() as ITerminology; // Assert non-null as we know it exists

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
      
      if (termIndex > -1) {
          // Update existing term
          const existingTerm = terminology.terms[termIndex];
          existingTerm.target = termData.target;
          existingTerm.domain = termData.domain;
          existingTerm.notes = termData.notes;
          logger.info(`Term '${termData.source}' updated in terminology ${terminologyId} by user ${userId}`);
      } else {
          // Add new term
          terminology.terms.push({
              source: termData.source,
              target: termData.target,
              domain: termData.domain,
              notes: termData.notes
          });
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

}

// Export singleton instance
export const terminologyService = new TerminologyService();

