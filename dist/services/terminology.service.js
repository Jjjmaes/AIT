"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.terminologyService = exports.TerminologyService = void 0;
const terminology_model_1 = require("../models/terminology.model");
const project_model_1 = require("../models/project.model"); // Import Project for checks
const errorHandler_1 = require("../utils/errorHandler");
const errors_1 = require("../utils/errors");
const logger_1 = __importDefault(require("../utils/logger"));
const mongoose_1 = require("mongoose");
class TerminologyService {
    constructor() {
        this.serviceName = 'TerminologyService';
    }
    /**
     * Create a new terminology list
     */
    async createTerminology(userId, data) {
        const methodName = 'createTerminology';
        (0, errorHandler_1.validateId)(userId, '创建用户');
        if (!data.name || !data.languagePairs || data.languagePairs.length === 0) {
            throw new errors_1.ValidationError('Missing required fields (name, languagePairs).');
        }
        try {
            // Validate projectId if provided
            let projectObjectId = undefined;
            if (data.projectId) {
                (0, errorHandler_1.validateId)(data.projectId, '关联项目');
                projectObjectId = new mongoose_1.Types.ObjectId(data.projectId);
                const project = await project_model_1.Project.findById(projectObjectId);
                (0, errorHandler_1.validateEntityExists)(project, '关联项目');
                // TODO: Add permission check - user must have access to the project?
                // const hasAccess = await projectService.hasAccess(data.projectId, userId);
                // if (!hasAccess) throw new ForbiddenError(...);
            }
            const newTerminology = new terminology_model_1.Terminology({
                ...data,
                createdBy: new mongoose_1.Types.ObjectId(userId),
                project: projectObjectId ? projectObjectId : null,
                terms: data.terms || [], // Ensure terms is an array
                isPublic: data.isPublic ?? false,
            });
            await newTerminology.save();
            logger_1.default.info(`Terminology '${newTerminology.name}' created by user ${userId}`);
            return newTerminology;
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '创建术语表');
        }
    }
    /**
     * Get a terminology list by ID
     */
    async getTerminologyById(terminologyId, userId) {
        const methodName = 'getTerminologyById';
        (0, errorHandler_1.validateId)(terminologyId, '术语表');
        try {
            const terminology = await terminology_model_1.Terminology.findById(terminologyId)
                .populate('createdBy', 'id username fullName')
                .populate('project', 'id name manager members') // Populate necessary project fields for checks
                .exec();
            (0, errorHandler_1.validateEntityExists)(terminology, '术语表');
            // Permission check: Public or created by user or linked to a project user can access?
            if (!terminology.isPublic && userId) {
                const userObjectId = new mongoose_1.Types.ObjectId(userId);
                const creatorId = terminology.createdBy instanceof mongoose_1.Types.ObjectId
                    ? terminology.createdBy
                    : terminology.createdBy?._id;
                let userHasAccess = creatorId?.equals(userObjectId);
                // If not creator, check project access
                if (!userHasAccess && terminology.project && typeof terminology.project === 'object') {
                    const project = terminology.project; // Type assertion
                    const isProjectManager = project.manager?.equals(userObjectId);
                    const isProjectMember = project.members?.some((m) => m.equals(userObjectId));
                    userHasAccess = isProjectManager || isProjectMember;
                }
                if (!userHasAccess) {
                    throw new errors_1.ForbiddenError(`User ${userId} does not have permission to access terminology ${terminologyId}`);
                }
            }
            return terminology;
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName} for ID ${terminologyId}:`, error);
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '获取术语表');
        }
    }
    /**
     * Get terminology lists based on filters
     */
    async getTerminologies(filters) {
        const methodName = 'getTerminologies';
        try {
            const query = {};
            const page = filters.page || 1;
            const limit = filters.limit || 10;
            const skip = (page - 1) * limit;
            // Build query
            if (filters.projectId) {
                query.project = new mongoose_1.Types.ObjectId(filters.projectId);
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
                (0, errorHandler_1.validateId)(filters.userId, '用户');
                const userObjectId = new mongoose_1.Types.ObjectId(filters.userId);
                // Find projects where the user is manager or member
                const accessibleProjects = await project_model_1.Project.find({
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
            }
            else if (typeof filters.isPublic !== 'boolean' && !filters.projectId) {
                // If no user context and not specifically asking for public/project, default to public
                query.isPublic = true;
            }
            const finalQuery = query;
            // Assuming pagination plugin is mixed into the model
            if (!terminology_model_1.Terminology.paginate) {
                logger_1.default.error(`[${this.serviceName}.${methodName}] Pagination is not configured on the Terminology model.`);
                throw new errors_1.AppError('Server configuration error: Pagination not available.', 500);
            }
            const options = { page: filters.page || 1, limit: filters.limit || 10, sort: { updatedAt: -1 }, populate: 'createdBy project' };
            logger_1.default.debug(`[${this.serviceName}.${methodName}] Paginated query: ${JSON.stringify(query)}, Options: ${JSON.stringify(options)}`);
            // Let TS infer the result type
            const result = await terminology_model_1.Terminology.paginate(query, options);
            return result;
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '获取术语表列表');
        }
    }
    /**
     * Update terminology list details
     */
    async updateTerminology(terminologyId, userId, data) {
        const methodName = 'updateTerminology';
        (0, errorHandler_1.validateId)(terminologyId, '术语表');
        (0, errorHandler_1.validateId)(userId, '用户');
        try {
            const terminology = await terminology_model_1.Terminology.findById(terminologyId).populate('project', 'id name manager members').exec();
            (0, errorHandler_1.validateEntityExists)(terminology, '术语表');
            // Permission check: Creator or Manager of linked project
            const userObjectId = new mongoose_1.Types.ObjectId(userId);
            // Cast createdBy as it's populated
            const creatorId = terminology.createdBy instanceof mongoose_1.Types.ObjectId
                ? terminology.createdBy
                : terminology.createdBy?._id;
            const isCreator = creatorId?.equals(userObjectId);
            let isProjectManager = false;
            if (terminology.project && typeof terminology.project === 'object') {
                isProjectManager = terminology.project.manager?.equals(userObjectId);
            }
            if (!isCreator && !isProjectManager) {
                throw new errors_1.ForbiddenError(`User ${userId} does not have permission to update terminology ${terminologyId}`);
            }
            // Validate projectId if changed
            let newProjectObjectId = terminology.project; // Keep existing project object or ObjectId
            if (data.hasOwnProperty('projectId')) { // Check if projectId key exists in update data
                if (data.projectId === null) { // Unlink project
                    newProjectObjectId = undefined; // Assign undefined instead of null
                }
                else if (data.projectId && (!terminology.project || (terminology.project instanceof mongoose_1.Types.ObjectId ? terminology.project.toString() !== data.projectId : terminology.project._id.toString() !== data.projectId))) { // Link to new/different project
                    (0, errorHandler_1.validateId)(data.projectId, '关联项目');
                    const projectObjectIdToLink = new mongoose_1.Types.ObjectId(data.projectId);
                    const project = await project_model_1.Project.findById(projectObjectIdToLink);
                    (0, errorHandler_1.validateEntityExists)(project, '关联项目');
                    // User must be manager of the NEW project to link terminology to it? Or just creator of term?
                    // Let's require manager of the target project for linking.
                    if (!project.manager?.equals(userObjectId)) {
                        throw new errors_1.ForbiddenError(`User ${userId} is not manager of project ${data.projectId} and cannot link terminology to it.`);
                    }
                    newProjectObjectId = projectObjectIdToLink; // Assign the ObjectId
                }
            }
            // Only update project field if it actually changed
            // Need careful comparison as it could be ObjectId or IProject
            const currentProjectId = terminology.project instanceof mongoose_1.Types.ObjectId ? terminology.project : terminology.project?._id;
            const newProjectId = newProjectObjectId instanceof mongoose_1.Types.ObjectId ? newProjectObjectId : newProjectObjectId?._id;
            if (currentProjectId?.toString() !== newProjectId?.toString()) {
                terminology.project = newProjectObjectId;
            }
            // Update other fields
            if (data.name)
                terminology.name = data.name;
            if (data.hasOwnProperty('description'))
                terminology.description = data.description; // Allow setting empty description
            if (data.languagePairs) {
                if (data.languagePairs.length === 0)
                    throw new errors_1.ValidationError('Language pairs cannot be empty.');
                terminology.languagePairs = data.languagePairs;
            }
            if (typeof data.isPublic === 'boolean')
                terminology.isPublic = data.isPublic;
            await terminology.save();
            logger_1.default.info(`Terminology ${terminologyId} updated by user ${userId}`);
            // Repopulate necessary fields before returning
            return await terminology_model_1.Terminology.findById(terminologyId)
                .populate('createdBy', 'id username fullName')
                .populate('project', 'id name')
                .exec(); // Assert non-null as we know it exists
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName} for ID ${terminologyId}:`, error);
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '更新术语表');
        }
    }
    /**
     * Delete a terminology list
     */
    async deleteTerminology(terminologyId, userId) {
        const methodName = 'deleteTerminology';
        (0, errorHandler_1.validateId)(terminologyId, '术语表');
        (0, errorHandler_1.validateId)(userId, '用户');
        try {
            const terminology = await terminology_model_1.Terminology.findById(terminologyId).populate('project', 'manager').populate('createdBy', '_id').exec();
            (0, errorHandler_1.validateEntityExists)(terminology, '术语表');
            // Permission check: Creator or Manager of linked project
            const userObjectId = new mongoose_1.Types.ObjectId(userId);
            // Cast createdBy as it's populated
            const creatorId = terminology.createdBy instanceof mongoose_1.Types.ObjectId
                ? terminology.createdBy
                : terminology.createdBy?._id;
            const isCreator = creatorId?.equals(userObjectId);
            let isProjectManager = false;
            if (terminology.project && typeof terminology.project === 'object') {
                isProjectManager = terminology.project.manager?.equals(userObjectId);
            }
            if (!isCreator && !isProjectManager) {
                throw new errors_1.ForbiddenError(`User ${userId} does not have permission to delete terminology ${terminologyId}`);
            }
            // TODO: Prevent deletion if linked project has this as its primary terminology?
            // const linkedProjects = await Project.find({ terminology: terminology._id });
            // if (linkedProjects.length > 0) throw new ValidationError(...)
            await terminology_model_1.Terminology.findByIdAndDelete(terminologyId);
            logger_1.default.info(`Terminology ${terminologyId} deleted by user ${userId}`);
            return { success: true };
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName} for ID ${terminologyId}:`, error);
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '删除术语表');
        }
    }
    // --- Term Management within a List ---
    /**
     * Add or update a term in a list (Upsert)
     */
    async upsertTerm(terminologyId, userId, termData) {
        const methodName = 'upsertTerm';
        (0, errorHandler_1.validateId)(terminologyId, '术语表');
        (0, errorHandler_1.validateId)(userId, '用户');
        if (!termData || !termData.source || !termData.target) {
            throw new errors_1.ValidationError('Term data requires source and target.');
        }
        try {
            const terminology = await terminology_model_1.Terminology.findById(terminologyId).populate('project', 'manager members').populate('createdBy', '_id').exec();
            (0, errorHandler_1.validateEntityExists)(terminology, '术语表');
            // Permission check (creator or project manager/member?)
            const userObjectId = new mongoose_1.Types.ObjectId(userId);
            // Cast createdBy as it's populated
            const creatorId = terminology.createdBy instanceof mongoose_1.Types.ObjectId
                ? terminology.createdBy
                : terminology.createdBy?._id;
            const isCreator = creatorId?.equals(userObjectId);
            let isProjectMemberOrManager = false;
            if (terminology.project && typeof terminology.project === 'object') {
                const project = terminology.project;
                isProjectMemberOrManager = project.manager?.equals(userObjectId) ||
                    project.members?.some((m) => m.equals(userObjectId));
            }
            if (!isCreator && !isProjectMemberOrManager) {
                throw new errors_1.ForbiddenError(`User ${userId} does not have permission to modify terms in terminology ${terminologyId}`);
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
                logger_1.default.info(`Term '${termData.source}' updated in terminology ${terminologyId} by user ${userId}`);
            }
            else {
                // Add new term - include required fields
                const newTerm = {
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
                logger_1.default.info(`Term '${termData.source}' added to terminology ${terminologyId} by user ${userId}`);
            }
            terminology.markModified('terms'); // Mark the array as modified
            await terminology.save();
            return terminology; // Return the updated list
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName} for ID ${terminologyId}:`, error);
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '添加/更新术语');
        }
    }
    /**
     * Remove a term from a list by its source text
     */
    async removeTerm(terminologyId, userId, sourceTerm) {
        const methodName = 'removeTerm';
        (0, errorHandler_1.validateId)(terminologyId, '术语表');
        (0, errorHandler_1.validateId)(userId, '用户');
        if (!sourceTerm) {
            throw new errors_1.ValidationError('Source term is required to remove.');
        }
        try {
            const terminology = await terminology_model_1.Terminology.findById(terminologyId).populate('project', 'manager members').populate('createdBy', '_id').exec();
            (0, errorHandler_1.validateEntityExists)(terminology, '术语表');
            // Permission check
            const userObjectId = new mongoose_1.Types.ObjectId(userId);
            // Cast createdBy as it's populated
            const creatorId = terminology.createdBy instanceof mongoose_1.Types.ObjectId
                ? terminology.createdBy
                : terminology.createdBy?._id;
            const isCreator = creatorId?.equals(userObjectId);
            let isProjectMemberOrManager = false;
            if (terminology.project && typeof terminology.project === 'object') {
                const project = terminology.project;
                isProjectMemberOrManager = project.manager?.equals(userObjectId) ||
                    project.members?.some((m) => m.equals(userObjectId));
            }
            if (!isCreator && !isProjectMemberOrManager) {
                throw new errors_1.ForbiddenError(`User ${userId} does not have permission to modify terms in terminology ${terminologyId}`);
            }
            const initialLength = terminology.terms.length;
            terminology.terms = terminology.terms.filter(t => t.source !== sourceTerm);
            if (terminology.terms.length === initialLength) {
                throw new errors_1.NotFoundError(`Term with source '${sourceTerm}' not found in terminology ${terminologyId}`);
            }
            terminology.markModified('terms');
            await terminology.save();
            logger_1.default.info(`Term '${sourceTerm}' removed from terminology ${terminologyId} by user ${userId}`);
            return terminology;
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName} for ID ${terminologyId}:`, error);
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '删除术语');
        }
    }
    async upsertTermInternal(terminology, userId, termData) {
        const methodName = 'upsertTermInternal';
        (0, errorHandler_1.validateId)(terminology._id, '术语表');
        (0, errorHandler_1.validateId)(userId, '用户');
        if (!termData || !termData.source || !termData.target) {
            throw new errors_1.ValidationError('Term data requires source and target.');
        }
        try {
            const userObjectId = new mongoose_1.Types.ObjectId(userId);
            const creatorId = terminology.createdBy instanceof mongoose_1.Types.ObjectId
                ? terminology.createdBy
                : terminology.createdBy?._id;
            const isCreator = creatorId?.equals(userObjectId);
            let isProjectMemberOrManager = false;
            if (terminology.project && typeof terminology.project === 'object') {
                const project = terminology.project;
                isProjectMemberOrManager = project.manager?.equals(userObjectId) ||
                    project.members?.some((m) => m.equals(userObjectId));
            }
            if (!isCreator && !isProjectMemberOrManager) {
                throw new errors_1.ForbiddenError(`User ${userId} does not have permission to modify terms in terminology ${terminology._id}`);
            }
            const termIndex = terminology.terms.findIndex(t => t.source === termData.source);
            let termResult;
            let status = 'added';
            const now = new Date();
            if (termIndex > -1) {
                // Update existing term
                const existingTerm = terminology.terms[termIndex];
                existingTerm.target = termData.target;
                existingTerm.domain = termData.domain;
                existingTerm.notes = termData.notes;
                existingTerm.lastModifiedBy = userObjectId;
                existingTerm.lastModifiedAt = now;
                termResult = existingTerm;
                status = 'updated';
            }
            else {
                // Add new term - include required fields
                const newTerm = {
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
                }
                catch (saveError) {
                    logger_1.default.error(`[${this.serviceName}.${methodName}] Error saving terminology list ${terminology._id} after term upsert:`, saveError);
                    throw new errors_1.ValidationError(`Failed to save terminology list after upserting term '${termData.source}'`);
                }
            }
            return { term: termResult, status };
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName} for ID ${terminology._id}:`, error);
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '添加/更新术语');
        }
    }
    // Ensure findTermsForTranslation uses ITermEntry
    async findTermsForTranslation(projectId, sourceLang, targetLang, texts) {
        // ... existing placeholder ...
        return new Map();
    }
}
exports.TerminologyService = TerminologyService;
// Export singleton instance
exports.terminologyService = new TerminologyService();
