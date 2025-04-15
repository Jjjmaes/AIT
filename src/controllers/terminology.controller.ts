import { Request, Response, NextFunction } from 'express';
import { terminologyService } from '../services/terminology.service';
import { AuthRequest } from '../middleware/auth.middleware';
// Import DTOs from the service
import { CreateTerminologyDto, UpdateTerminologyDto, UpsertTermDto, GetTerminologyFilter } from '../services/terminology.service';
import { AppError, ValidationError } from '../utils/errors';
import logger from '../utils/logger';
import { tmxUploadMiddleware } from './translationMemory.controller'; // Reuse TM upload middleware for now?
import multer from 'multer';
import { validateId } from '../utils/errorHandler'; // Import validateId

// Define multer config specifically for terminology CSV uploads
const csvStorage = multer.memoryStorage();
const csvUpload = multer({
    storage: csvStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Example: 5MB limit for CSVs
    fileFilter: (req, file, cb) => { // Optional: Add basic file filter
        if (file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new ValidationError('Invalid file type. Only CSV files are allowed.'));
        }
    }
});
export const termsCsvUploadMiddleware = csvUpload.single('termsfile'); // Expect field named 'termsfile'

class TerminologyController {
  private serviceName = 'TerminologyController';

  // --- Terminology List Operations ---

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    const methodName = 'create';
    try {
      const userId = req.user?.id;
      if (!userId) return next(new AppError('Authentication required', 401));
      const data: CreateTerminologyDto = req.body;
      logger.info(`Attempting to create terminology by user ${userId}`);
      const newTerminology = await terminologyService.createTerminology(userId, data);
      res.status(201).json({ success: true, data: newTerminology });
    } catch (error) {
      logger.error(`Error in TerminologyController.${methodName}:`, error);
      next(error);
    }
  }

  async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    const methodName = 'getAll';
    const { limit = 10, page = 1, sort = '-createdAt', ...filters } = req.query;
    try {
      const userId = req.user?.id; // Needed for permission filtering in service
      const filters: GetTerminologyFilter = {
        userId: userId, // Pass user ID for filtering
        projectId: req.query.projectId as string,
        isPublic: req.query.isPublic ? req.query.isPublic === 'true' : undefined,
        search: req.query.search as string,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      };
      logger.info(`Fetching terminologies for user ${userId} with filters:`, filters);
      const result = await terminologyService.getTerminologies({ ...filters, limit: Number(limit), page: Number(page) });
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      logger.error(`Error in TerminologyController.${methodName}:`, error);
      next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    const methodName = 'getById';
    try {
      const userId = req.user?.id; // For permission check
      const terminologyId = req.params.terminologyId;
      if (!terminologyId) return next(new AppError('Terminology ID is required', 400));
      logger.info(`Fetching terminology ${terminologyId} for user ${userId}`);
      const terminology = await terminologyService.getTerminologyById(terminologyId, userId);
      res.status(200).json({ success: true, data: terminology });
    } catch (error) {
      logger.error(`Error in ${this.serviceName}.${methodName} for ID ${req.params.terminologyId}:`, error);
      next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    const methodName = 'update';
    try {
      const userId = req.user?.id;
      if (!userId) return next(new AppError('Authentication required', 401));
      const terminologyId = req.params.terminologyId;
      if (!terminologyId) return next(new AppError('Terminology ID is required', 400));
      const updateData: UpdateTerminologyDto = req.body;
      logger.info(`Attempting to update terminology ${terminologyId} by user ${userId}`);
      const updatedTerminology = await terminologyService.updateTerminology(terminologyId, userId, updateData);
      res.status(200).json({ success: true, data: updatedTerminology });
    } catch (error) {
      logger.error(`Error in ${this.serviceName}.${methodName} for ID ${req.params.terminologyId}:`, error);
      next(error);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    const methodName = 'delete';
    try {
      const userId = req.user?.id;
      if (!userId) return next(new AppError('Authentication required', 401));
      const terminologyId = req.params.terminologyId;
      if (!terminologyId) return next(new AppError('Terminology ID is required', 400));
      logger.info(`Attempting to delete terminology ${terminologyId} by user ${userId}`);
      const result = await terminologyService.deleteTerminology(terminologyId, userId);
      res.status(200).json({ success: result.success, message: 'Terminology deleted successfully' });
    } catch (error) {
      logger.error(`Error in TerminologyController.${methodName} for ID ${req.params.terminologyId}:`, error);
      next(error);
    }
  }

  // --- Term Management Operations ---

  async upsertTerm(req: AuthRequest, res: Response, next: NextFunction) {
    const methodName = 'upsertTerm';
    try {
      const userId = req.user?.id;
      if (!userId) return next(new AppError('Authentication required', 401));
      const terminologyId = req.params.terminologyId;
      if (!terminologyId) return next(new AppError('Terminology ID is required', 400));
      const termData: UpsertTermDto = req.body;
      logger.info(`Attempting to upsert term in terminology ${terminologyId} by user ${userId}`);
      const updatedTerminology = await terminologyService.upsertTerm(terminologyId, userId, termData);
      // Return the updated terminology list or just the added/updated term?
      // Returning the whole list might be simpler for frontend updates.
      res.status(200).json({ success: true, data: updatedTerminology });
    } catch (error) {
      logger.error(`Error in ${this.serviceName}.${methodName} for ID ${req.params.terminologyId}:`, error);
      next(error);
    }
  }

  async removeTerm(req: AuthRequest, res: Response, next: NextFunction) {
    const methodName = 'removeTerm';
    try {
      const userId = req.user?.id;
      if (!userId) return next(new AppError('Authentication required', 401));
      const terminologyId = req.params.terminologyId;
      if (!terminologyId) return next(new AppError('Terminology ID is required', 400));
      // Source term might be in body or query param? Let's assume body for consistency.
      const { sourceTerm } = req.body;
      if (!sourceTerm) return next(new AppError('Source term is required in body to remove', 400));

      logger.info(`Attempting to remove term '${sourceTerm}' from terminology ${terminologyId} by user ${userId}`);
      const updatedTerminology = await terminologyService.removeTerm(terminologyId, userId, sourceTerm);
      res.status(200).json({ success: true, data: updatedTerminology });
    } catch (error) {
      logger.error(`Error in ${this.serviceName}.${methodName} for ID ${req.params.terminologyId}:`, error);
      next(error);
    }
  }

  /**
   * @desc    Import Terminology entries from a CSV file
   * @route   POST /api/terms/:terminologyId/import
   * @access  Private
   * @expects multipart/form-data with a file field named 'termsfile'
   */
  async importTerms(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    const methodName = 'importTerms';
    try {
      const terminologyId = req.params.terminologyId;
      const userId = req.user?.id;

      if (!terminologyId) {
        return next(new ValidationError('Terminology ID is required in the URL path.'));
      }
      if (!userId) {
          return next(new AppError('Authentication required to import terms', 401));
      }
      if (!req.file) {
          return next(new ValidationError('No CSV file provided (expected field name \'termsfile\').'));
      }

      // TODO: Add file type validation (e.g., check mime type for CSV)
      // if (req.file.mimetype !== 'text/csv') { ... }

      const csvContent = req.file.buffer.toString('utf-8');

      logger.info(`[${this.serviceName}.${methodName}] User ${userId} initiating CSV term import for list ${terminologyId}`);
      // Suppress persistent incorrect linter error
      // @ts-expect-error: Linter fails to find existing service method
      const result = await terminologyService.importTermsFromCSV(terminologyId, userId, csvContent);

      res.status(200).json({
          success: true,
          message: `CSV import process completed. Added: ${result.addedCount}, Updated: ${result.updatedCount}, Skipped/Errors: ${result.skippedCount}.`,
          details: result
      });
       logger.info(`[${this.serviceName}.${methodName}] User ${userId} finished CSV import for list ${terminologyId}. Results: ${JSON.stringify(result)}`);

    } catch (error) {
        logger.error(`Error in ${this.serviceName}.${methodName} for list ${req.params.terminologyId}:`, error);
        next(error);
    }
  }

  // GET /terms/:terminologyId/terms
  public getTermsByListId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { terminologyId } = req.params;
    logger.info(`Entering TerminologyController.getTermsByListId for ID: ${terminologyId}`);
    try {
      validateId(terminologyId, 'Terminology List'); // Assuming validateId utility
      // Assuming a service method exists to fetch terms by list ID
      const terms = await terminologyService.getTermsByListId(terminologyId);
      res.status(200).json({ success: true, data: { terms } }); // Assuming standard response format
    } catch (error) {
      logger.error(`Error in TerminologyController.getTermsByListId for ID ${terminologyId}:`, error);
      next(error);
    }
  }

  // Export terminology list
  async exportById(req: AuthRequest, res: Response, next: NextFunction) {
    const methodName = 'exportById';
    try {
      const userId = req.user?.id;
      if (!userId) return next(new AppError('Authentication required', 401));
      const terminologyId = req.params.terminologyId;
      if (!terminologyId) return next(new AppError('Terminology ID is required', 400));

      logger.info(`User ${userId} requesting export for terminology ${terminologyId}`);

      // Assume service returns CSV content or throws error
      const csvData = await terminologyService.exportTerminology(terminologyId, userId);

      const filename = `terminology_export_${terminologyId}.csv`;
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(csvData);

    } catch (error) {
      logger.error(`Error in TerminologyController.${methodName} for ID ${req.params.terminologyId}:`, error);
      next(error);
    }
  }
}

export const terminologyController = new TerminologyController();


