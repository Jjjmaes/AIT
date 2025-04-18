"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tmxUploadMiddleware = exports.translationMemoryController = exports.addTMEntryValidators = exports.TranslationMemoryController = void 0;
const translationMemory_service_1 = require("../services/translationMemory.service");
const logger_1 = __importDefault(require("../utils/logger"));
const errors_1 = require("../utils/errors");
const express_validator_1 = require("express-validator"); // For input validation
const multer_1 = __importDefault(require("multer"));
const translationMemory_service_2 = require("../services/translationMemory.service");
const typedi_1 = require("typedi");
const errors_2 = require("../utils/errors");
// Multer configuration (using memory storage)
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // Example: 10MB limit
});
class TranslationMemoryController {
    constructor() {
        this.translationMemoryService = typedi_1.Container.get(translationMemory_service_2.TranslationMemoryService);
        this.createTranslationMemorySet = async (req, res, next) => {
            const methodName = 'createTranslationMemorySet';
            try {
                // Assert req.user exists because authenticateJwt middleware should ensure it
                if (!req.user) {
                    throw new errors_2.UnauthorizedError('Authentication required.');
                }
                // Validate input data
                const tmSetData = req.body; // Use the correct DTO type
                // We don't need to manually add createdBy here, service handles it
                // tmSetData.createdBy = req.user.id;
                logger_1.default.info(`[${methodName}] User ${req.user.id} attempting to create TM Set: ${tmSetData.name}`);
                // Correct argument order: userId first, then DTO data
                const newTmSet = await this.translationMemoryService.createTMSet(req.user.id, tmSetData);
                logger_1.default.info(`[${methodName}] TM Set created successfully: ${newTmSet._id} by User ${req.user.id}`);
                res.status(201).json({ data: newTmSet, message: 'Translation Memory Set created successfully' });
            }
            catch (error) {
                logger_1.default.error(`[${methodName}] Error creating Translation Memory Set:`, error);
                next(error); // Pass error to the global error handler
            }
        };
        this.getAllTMSets = async (req, res, next) => {
            const methodName = 'getAllTMSets';
            try {
                // Assert req.user exists because authenticateJwt middleware should ensure it
                if (!req.user) {
                    throw new errors_2.UnauthorizedError('Authentication required.');
                }
                logger_1.default.info(`[${methodName}] User ${req.user.id} requesting all TM Sets`); // Use req.user.id
                const tmSets = await this.translationMemoryService.getAllTMSets(req.user.id); // Use req.user.id
                logger_1.default.info(`[${methodName}] Found ${tmSets.length} TM Sets for User ${req.user.id}`);
                res.status(200).json({ data: tmSets, message: 'Translation Memory Sets retrieved successfully' });
            }
            catch (error) {
                logger_1.default.error(`[${methodName}] Error fetching TM Sets:`, error);
                next(error); // Pass error to the global error handler
            }
        };
        // TODO: Add methods for searching/querying TM, deleting entries etc. as needed
    }
    /**
     * @desc    Add a single Translation Memory entry
     * @route   POST /api/v1/tm
     * @access  Private (requires authentication)
     */
    async addTMEntry(req, res, next) {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            res.status(400).json({ errors: errors.array() });
            return;
        }
        const { sourceLanguage, targetLanguage, sourceText, targetText, projectId } = req.body;
        const userId = req.user?.id; // Get user ID from authenticated request
        if (!userId) {
            // This check might be redundant if 'protect' middleware handles it, but good for clarity
            return next(new errors_1.AppError('Authentication required to add TM entry', 401));
        }
        const entryDto = {
            sourceLanguage,
            targetLanguage,
            sourceText,
            targetText,
            projectId, // projectId is optional
            userId,
        };
        try {
            const result = await translationMemory_service_1.translationMemoryService.addEntry(entryDto);
            res.status(201).json({
                message: `TM entry successfully ${result.status}.`,
                data: result.entry
            });
            logger_1.default.info(`User ${userId} ${result.status} TM entry ID ${result.entry._id}`);
        }
        catch (error) {
            logger_1.default.error('Error adding TM entry:', error);
            next(error); // Pass to global error handler
        }
    }
    /**
     * @desc    Import Translation Memory entries from a TMX file
     * @route   POST /api/v1/tm/import/tmx
     * @access  Private (requires authentication)
     * @expects multipart/form-data with a file field named 'tmxfile'
     */
    async importTMXFile(req, res, next) {
        // Check if file exists (Multer adds it to req.file)
        if (!req.file) {
            return next(new errors_1.ValidationError("No TMX file provided in the request (expected field name 'tmxfile')."));
        }
        // User ID check might be redundant if 'protect' middleware runs first
        if (!req.user?.id) {
            return next(new errors_1.AppError('Authentication required to import TM entries', 401));
        }
        const { projectId } = req.body; // Optional project ID from form data
        const userId = req.user.id;
        const tmxContent = req.file.buffer.toString('utf-8'); // Get content from buffer
        try {
            logger_1.default.info(`User ${userId} initiating TMX import for project ${projectId || 'global'}`);
            const result = await translationMemory_service_1.translationMemoryService.importTMX(tmxContent, projectId, userId);
            res.status(200).json({
                message: `TMX import process completed. Added: ${result.addedCount}, Updated: ${result.updatedCount}, Skipped/Errors: ${result.skippedCount}.`,
                details: result
            });
            logger_1.default.info(`User ${userId} finished TMX import. Results: ${JSON.stringify(result)}`);
        }
        catch (error) {
            logger_1.default.error(`Error importing TMX file for user ${userId}:`, error);
            // Service method catches parsing/add errors; this catches unexpected issues.
            next(error);
        }
    }
    /**
     * @desc    Create a new Translation Memory Set
     * @route   POST /api/v1/tm
     * @access  Private
     */
    async createTMSet(req, res, next) {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            res.status(400).json({ errors: errors.array() });
            return;
        }
        const userId = req.user?.id;
        if (!userId) {
            return next(new errors_1.AppError('Authentication required to create TM set', 401));
        }
        const setData = {
            name: req.body.name,
            description: req.body.description,
            sourceLanguage: req.body.sourceLanguage,
            targetLanguage: req.body.targetLanguage,
            domain: req.body.domain,
            isPublic: req.body.isPublic,
            // projectId: req.body.projectId // Add if needed
        };
        try {
            const newTMSet = await translationMemory_service_1.translationMemoryService.createTMSet(userId, setData);
            res.status(201).json({ success: true, data: newTMSet });
            logger_1.default.info(`User ${userId} created TM Set ID ${newTMSet._id}`);
        }
        catch (error) {
            logger_1.default.error('Error creating TM set:', error);
            next(error); // Pass to global error handler
        }
    }
}
exports.TranslationMemoryController = TranslationMemoryController;
// Validation rules for addTMEntry
exports.addTMEntryValidators = [
    (0, express_validator_1.body)('sourceLanguage', 'Source language is required').notEmpty().isString(),
    (0, express_validator_1.body)('targetLanguage', 'Target language is required').notEmpty().isString(),
    (0, express_validator_1.body)('sourceText', 'Source text is required').notEmpty().isString(),
    (0, express_validator_1.body)('targetText', 'Target text is required').notEmpty().isString(),
    (0, express_validator_1.body)('projectId', 'Project ID must be a valid MongoDB ObjectId if provided').optional().isMongoId(),
];
// Export singleton instance and multer middleware
exports.translationMemoryController = new TranslationMemoryController();
// Define and export the multer middleware for the 'tmxfile' field
exports.tmxUploadMiddleware = upload.single('tmxfile');
