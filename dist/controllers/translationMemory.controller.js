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
// Multer configuration (using memory storage)
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // Example: 10MB limit
});
class TranslationMemoryController {
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
