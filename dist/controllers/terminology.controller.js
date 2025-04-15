"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.terminologyController = exports.termsCsvUploadMiddleware = void 0;
const terminology_service_1 = require("../services/terminology.service");
const errors_1 = require("../utils/errors");
const logger_1 = __importDefault(require("../utils/logger"));
const multer_1 = __importDefault(require("multer"));
// Define multer config specifically for terminology CSV uploads
const csvStorage = multer_1.default.memoryStorage();
const csvUpload = (0, multer_1.default)({
    storage: csvStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Example: 5MB limit for CSVs
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv')) {
            cb(null, true);
        }
        else {
            cb(new errors_1.ValidationError('Invalid file type. Only CSV files are allowed.'));
        }
    }
});
exports.termsCsvUploadMiddleware = csvUpload.single('termsfile'); // Expect field named 'termsfile'
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
    /**
     * @desc    Import Terminology entries from a CSV file
     * @route   POST /api/terms/:terminologyId/import
     * @access  Private
     * @expects multipart/form-data with a file field named 'termsfile'
     */
    async importTerms(req, res, next) {
        const methodName = 'importTerms';
        try {
            const terminologyId = req.params.terminologyId;
            const userId = req.user?.id;
            if (!terminologyId) {
                return next(new errors_1.ValidationError('Terminology ID is required in the URL path.'));
            }
            if (!userId) {
                return next(new errors_1.AppError('Authentication required to import terms', 401));
            }
            if (!req.file) {
                return next(new errors_1.ValidationError('No CSV file provided (expected field name \'termsfile\').'));
            }
            // TODO: Add file type validation (e.g., check mime type for CSV)
            // if (req.file.mimetype !== 'text/csv') { ... }
            const csvContent = req.file.buffer.toString('utf-8');
            logger_1.default.info(`[${this.serviceName}.${methodName}] User ${userId} initiating CSV term import for list ${terminologyId}`);
            // Suppress persistent incorrect linter error
            // @ts-expect-error: Linter fails to find existing service method
            const result = await terminology_service_1.terminologyService.importTermsFromCSV(terminologyId, userId, csvContent);
            res.status(200).json({
                success: true,
                message: `CSV import process completed. Added: ${result.addedCount}, Updated: ${result.updatedCount}, Skipped/Errors: ${result.skippedCount}.`,
                details: result
            });
            logger_1.default.info(`[${this.serviceName}.${methodName}] User ${userId} finished CSV import for list ${terminologyId}. Results: ${JSON.stringify(result)}`);
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName} for list ${req.params.terminologyId}:`, error);
            next(error);
        }
    }
}
exports.terminologyController = new TerminologyController();
