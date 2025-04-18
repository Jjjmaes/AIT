import { Request, Response, NextFunction } from 'express';
import { TranslationMemoryService, AddTMEntryDto, CreateTMSetDto } from '../services/translationMemory.service';
import logger from '../utils/logger';
import { AppError, ValidationError, UnauthorizedError } from '../utils/errors';
import { authenticateJwt } from '../middleware/auth.middleware'; // Use correct export name
import { body, validationResult } from 'express-validator'; // For input validation
import multer from 'multer';
import { Inject, Service } from 'typedi'; // Import Inject, Service
import { AuthRequest } from '../middleware/auth.middleware';
import { TranslationMemory } from '../models/translationMemory.model'; // Corrected model path
import { TranslationMemorySet } from '../models/translationMemorySet.model'; // Corrected model path

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

@Service() // Add Service decorator
export class TranslationMemoryController {
  // Remove direct Container.get
  // public translationMemoryService = Container.get(TranslationMemoryService);

  // Inject service via constructor
  constructor(@Inject() private translationMemoryService: TranslationMemoryService) {}

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
      // Use injected service
      const result = await this.translationMemoryService.addEntry(entryDto);
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
      // Use injected service
      const result = await this.translationMemoryService.importTMX(tmxContent, projectId, userId);
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

  /**
   * @desc    Create a new Translation Memory Set
   * @route   POST /api/v1/tm
   * @access  Private
   */
  async createTMSet(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }

    const userId = req.user?.id;
    if (!userId) {
        return next(new AppError('Authentication required to create TM set', 401));
    }

    const setData: CreateTMSetDto = {
        name: req.body.name,
        description: req.body.description,
        sourceLanguage: req.body.sourceLanguage,
        targetLanguage: req.body.targetLanguage,
        domain: req.body.domain,
        isPublic: req.body.isPublic,
        // projectId: req.body.projectId // Add if needed
    };

    try {
        // Use injected service
        const newTMSet = await this.translationMemoryService.createTMSet(userId, setData);
        res.status(201).json({ success: true, data: newTMSet });
        logger.info(`User ${userId} created TM Set ID ${newTMSet._id}`);
    } catch (error) {
        logger.error('Error creating TM set:', error);
        next(error); // Pass to global error handler
    }
  }

  public createTranslationMemorySet = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const methodName = 'createTranslationMemorySet';
    try {
      // Assert req.user exists because authenticateJwt middleware should ensure it
      if (!req.user) {
        throw new UnauthorizedError('Authentication required.');
      }

      // Validate input data
      const tmSetData: CreateTMSetDto = req.body; // Use the correct DTO type
      // We don't need to manually add createdBy here, service handles it
      // tmSetData.createdBy = req.user.id;

      logger.info(`[${methodName}] User ${req.user.id} attempting to create TM Set: ${tmSetData.name}`);
      
      // Correct argument order: userId first, then DTO data
      // Use injected service
      const newTmSet = await this.translationMemoryService.createTMSet(req.user.id, tmSetData);
      
      logger.info(`[${methodName}] TM Set created successfully: ${newTmSet._id} by User ${req.user.id}`);
      res.status(201).json({ data: newTmSet, message: 'Translation Memory Set created successfully' });
    } catch (error) {
      logger.error(`[${methodName}] Error creating Translation Memory Set:`, error);
      next(error); // Pass error to the global error handler
    }
  };

  public getAllTMSets = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const methodName = 'getAllTMSets';
    try {
      // Assert req.user exists because authenticateJwt middleware should ensure it
      if (!req.user) {
        throw new UnauthorizedError('Authentication required.');
      }
      logger.info(`[${methodName}] User ${req.user.id} requesting all TM Sets`); // Use req.user.id
      // Use injected service
      const tmSets = await this.translationMemoryService.getAllTMSets(req.user.id); // Use req.user.id
      logger.info(`[${methodName}] Found ${tmSets.length} TM Sets for User ${req.user.id}`);
      res.status(200).json({ data: tmSets, message: 'Translation Memory Sets retrieved successfully' });
    } catch (error) {
      logger.error(`[${methodName}] Error fetching TM Sets:`, error);
      next(error); // Pass error to the global error handler
    }
  };

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

// Define and export the multer middleware for the 'tmxfile' field
export const tmxUploadMiddleware = upload.single('tmxfile'); 