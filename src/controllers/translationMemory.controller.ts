import { Request, Response, NextFunction } from 'express';
import { translationMemoryService, AddTMEntryDto } from '../services/translationMemory.service';
import logger from '../utils/logger';
import { AppError, ValidationError } from '../utils/errors';
import { authenticateJwt } from '../middleware/auth.middleware'; // Use correct export name
import { body, validationResult } from 'express-validator'; // For input validation
import multer from 'multer';

// Extend Express Request interface to include user property and file
interface AuthenticatedRequest extends Request {
    user?: { id: string; /* add other user properties if available */ };
    file?: Express.Multer.File; // Add file property for multer
}

// Multer configuration (using memory storage)
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // Example: 10MB limit
}); 


export class TranslationMemoryController {
  /**
   * @desc    Add a single Translation Memory entry
   * @route   POST /api/v1/tm
   * @access  Private (requires authentication)
   */
  async addTMEntry(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }

    const { sourceLanguage, targetLanguage, sourceText, targetText, projectId } = req.body;
    const userId = req.user?.id; // Get user ID from authenticated request

    if (!userId) {
        // This check might be redundant if 'protect' middleware handles it, but good for clarity
        return next(new AppError('Authentication required to add TM entry', 401));
    }

    const entryDto: AddTMEntryDto = {
        sourceLanguage,
        targetLanguage,
        sourceText,
        targetText,
        projectId, // projectId is optional
        userId,
    };

    try {
      const result = await translationMemoryService.addEntry(entryDto);
      res.status(201).json({ 
        message: `TM entry successfully ${result.status}.`, 
        data: result.entry 
      });
      logger.info(`User ${userId} ${result.status} TM entry ID ${result.entry._id}`);
    } catch (error) {
      logger.error('Error adding TM entry:', error);
      next(error); // Pass to global error handler
    }
  }

  /**
   * @desc    Import Translation Memory entries from a TMX file
   * @route   POST /api/v1/tm/import/tmx
   * @access  Private (requires authentication)
   * @expects multipart/form-data with a file field named 'tmxfile'
   */
  async importTMXFile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    // Check if file exists (Multer adds it to req.file)
    if (!req.file) {
      return next(new ValidationError("No TMX file provided in the request (expected field name 'tmxfile')."));
    }
    // User ID check might be redundant if 'protect' middleware runs first
    if (!req.user?.id) {
        return next(new AppError('Authentication required to import TM entries', 401));
    }

    const { projectId } = req.body; // Optional project ID from form data
    const userId = req.user.id;
    const tmxContent = req.file.buffer.toString('utf-8'); // Get content from buffer

    try {
      logger.info(`User ${userId} initiating TMX import for project ${projectId || 'global'}`);
      const result = await translationMemoryService.importTMX(tmxContent, projectId, userId);
      res.status(200).json({
        message: `TMX import process completed. Added: ${result.addedCount}, Updated: ${result.updatedCount}, Skipped/Errors: ${result.skippedCount}.`,
        details: result
      });
      logger.info(`User ${userId} finished TMX import. Results: ${JSON.stringify(result)}`);
    } catch (error) {
      logger.error(`Error importing TMX file for user ${userId}:`, error);
      // Service method catches parsing/add errors; this catches unexpected issues.
      next(error);
    }
  }

  // TODO: Add methods for searching/querying TM, deleting entries etc. as needed
}

// Validation rules for addTMEntry
export const addTMEntryValidators = [
    body('sourceLanguage', 'Source language is required').notEmpty().isString(),
    body('targetLanguage', 'Target language is required').notEmpty().isString(),
    body('sourceText', 'Source text is required').notEmpty().isString(),
    body('targetText', 'Target text is required').notEmpty().isString(),
    body('projectId', 'Project ID must be a valid MongoDB ObjectId if provided').optional().isMongoId(),
];

// Export singleton instance and multer middleware
export const translationMemoryController = new TranslationMemoryController();

// Define and export the multer middleware for the 'tmxfile' field
export const tmxUploadMiddleware = upload.single('tmxfile'); 