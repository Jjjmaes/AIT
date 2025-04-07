"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.terminologyController = void 0;
const terminology_service_1 = require("../services/terminology.service");
const errors_1 = require("../utils/errors");
const logger_1 = __importDefault(require("../utils/logger"));
class TerminologyController {
    constructor() {
        this.serviceName = 'TerminologyController';
    }
    // --- Terminology List Operations ---
    async create(req, res, next) {
        const methodName = 'create';
        try {
            const userId = req.user?.id;
            if (!userId)
                return next(new errors_1.AppError('Authentication required', 401));
            const data = req.body;
            logger_1.default.info(`Attempting to create terminology by user ${userId}`);
            const newTerminology = await terminology_service_1.terminologyService.createTerminology(userId, data);
            res.status(201).json({ success: true, data: newTerminology });
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            next(error);
        }
    }
    async getAll(req, res, next) {
        const methodName = 'getAll';
        try {
            const userId = req.user?.id; // Needed for permission filtering in service
            const filters = {
                userId: userId, // Pass user ID for filtering
                projectId: req.query.projectId,
                isPublic: req.query.isPublic ? req.query.isPublic === 'true' : undefined,
                search: req.query.search,
                page: req.query.page ? parseInt(req.query.page, 10) : undefined,
                limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
            };
            logger_1.default.info(`Fetching terminologies for user ${userId} with filters:`, filters);
            const result = await terminology_service_1.terminologyService.getTerminologies(filters);
            res.status(200).json({ success: true, ...result });
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            next(error);
        }
    }
    async getById(req, res, next) {
        const methodName = 'getById';
        try {
            const userId = req.user?.id; // For permission check
            const terminologyId = req.params.terminologyId;
            if (!terminologyId)
                return next(new errors_1.AppError('Terminology ID is required', 400));
            logger_1.default.info(`Fetching terminology ${terminologyId} for user ${userId}`);
            const terminology = await terminology_service_1.terminologyService.getTerminologyById(terminologyId, userId);
            res.status(200).json({ success: true, data: terminology });
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName} for ID ${req.params.terminologyId}:`, error);
            next(error);
        }
    }
    async update(req, res, next) {
        const methodName = 'update';
        try {
            const userId = req.user?.id;
            if (!userId)
                return next(new errors_1.AppError('Authentication required', 401));
            const terminologyId = req.params.terminologyId;
            if (!terminologyId)
                return next(new errors_1.AppError('Terminology ID is required', 400));
            const updateData = req.body;
            logger_1.default.info(`Attempting to update terminology ${terminologyId} by user ${userId}`);
            const updatedTerminology = await terminology_service_1.terminologyService.updateTerminology(terminologyId, userId, updateData);
            res.status(200).json({ success: true, data: updatedTerminology });
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName} for ID ${req.params.terminologyId}:`, error);
            next(error);
        }
    }
    async delete(req, res, next) {
        const methodName = 'delete';
        try {
            const userId = req.user?.id;
            if (!userId)
                return next(new errors_1.AppError('Authentication required', 401));
            const terminologyId = req.params.terminologyId;
            if (!terminologyId)
                return next(new errors_1.AppError('Terminology ID is required', 400));
            logger_1.default.info(`Attempting to delete terminology ${terminologyId} by user ${userId}`);
            const result = await terminology_service_1.terminologyService.deleteTerminology(terminologyId, userId);
            res.status(200).json({ success: result.success, message: 'Terminology deleted successfully' });
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName} for ID ${req.params.terminologyId}:`, error);
            next(error);
        }
    }
    // --- Term Management Operations ---
    async upsertTerm(req, res, next) {
        const methodName = 'upsertTerm';
        try {
            const userId = req.user?.id;
            if (!userId)
                return next(new errors_1.AppError('Authentication required', 401));
            const terminologyId = req.params.terminologyId;
            if (!terminologyId)
                return next(new errors_1.AppError('Terminology ID is required', 400));
            const termData = req.body;
            logger_1.default.info(`Attempting to upsert term in terminology ${terminologyId} by user ${userId}`);
            const updatedTerminology = await terminology_service_1.terminologyService.upsertTerm(terminologyId, userId, termData);
            // Return the updated terminology list or just the added/updated term?
            // Returning the whole list might be simpler for frontend updates.
            res.status(200).json({ success: true, data: updatedTerminology });
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName} for ID ${req.params.terminologyId}:`, error);
            next(error);
        }
    }
    async removeTerm(req, res, next) {
        const methodName = 'removeTerm';
        try {
            const userId = req.user?.id;
            if (!userId)
                return next(new errors_1.AppError('Authentication required', 401));
            const terminologyId = req.params.terminologyId;
            if (!terminologyId)
                return next(new errors_1.AppError('Terminology ID is required', 400));
            // Source term might be in body or query param? Let's assume body for consistency.
            const { sourceTerm } = req.body;
            if (!sourceTerm)
                return next(new errors_1.AppError('Source term is required in body to remove', 400));
            logger_1.default.info(`Attempting to remove term '${sourceTerm}' from terminology ${terminologyId} by user ${userId}`);
            const updatedTerminology = await terminology_service_1.terminologyService.removeTerm(terminologyId, userId, sourceTerm);
            res.status(200).json({ success: true, data: updatedTerminology });
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName} for ID ${req.params.terminologyId}:`, error);
            next(error);
        }
    }
}
exports.terminologyController = new TerminologyController();
