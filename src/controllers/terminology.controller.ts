import { Request, Response, NextFunction } from 'express';
// Remove direct service import
// import { terminologyService } from '../services/terminology.service';
import { TerminologyService, CreateTerminologyDto, UpdateTerminologyDto, UpsertTermDto, GetTerminologyFilter } from '../services/terminology.service'; // Import Service class and DTOs
import { AuthRequest } from '../middleware/auth.middleware';
import { AppError, ValidationError } from '../utils/errors';
import logger from '../utils/logger';
import { tmxUploadMiddleware } from './translationMemory.controller'; // Reuse TM upload middleware for now?
import multer from 'multer';
import { validateId } from '../utils/errorHandler'; // Import validateId
import { Inject, Service } from 'typedi'; // Import typedi

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

@Service()
export class TerminologyController {
  private serviceName = 'TerminologyController';

  // Inject TerminologyService
  constructor(@Inject() private terminologyService: TerminologyService) {}

  // --- Terminology List Operations ---

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    const methodName = 'create';
    try {
      const userId = req.user?.id;
      if (!userId) return next(new AppError('Authentication required', 401));
      const data: CreateTerminologyDto = req.body;
      logger.info(`Attempting to create terminology by user ${userId}`);
      // Use injected service
      const newTerminology = await this.terminologyService.createTerminology(userId, data);
      res.status(201).json({ success: true, data: newTerminology });
    } catch (error) {
      logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
      next(error);
    }
  }

  async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    const methodName = 'getAll';
    const { limit = 10, page = 1, sort = '-createdAt', ...filters } = req.query;
    try {
      const userId = req.user?.id;
      const filterOptions: GetTerminologyFilter = {
        userId: userId,
        projectId: req.query.projectId as string,
        isPublic: req.query.isPublic ? req.query.isPublic === 'true' : undefined,
        search: req.query.search as string,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      };
      logger.info(`Fetching terminologies for user ${userId} with filters:`, filterOptions);
      // Use injected service
      const result = await this.terminologyService.getTerminologies({ ...filterOptions, limit: Number(limit), page: Number(page) });
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
      next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    const methodName = 'getById';
    try {
      const userId = req.user?.id;
      const terminologyId = req.params.terminologyId;
      if (!terminologyId) return next(new AppError('Terminology ID is required', 400));
      logger.info(`Fetching terminology ${terminologyId} for user ${userId}`);
      // Use injected service
      const terminology = await this.terminologyService.getTerminologyById(terminologyId, userId);
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
      // Use injected service
      const updatedTerminology = await this.terminologyService.updateTerminology(terminologyId, userId, updateData);
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
      // Use injected service
      const result = await this.terminologyService.deleteTerminology(terminologyId, userId);
      res.status(200).json({ success: result.success, message: 'Terminology deleted successfully' });
    } catch (error) {
      logger.error(`Error in ${this.serviceName}.${methodName} for ID ${req.params.terminologyId}:`, error);
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
      // Use injected service
      const updatedTerminology = await this.terminologyService.upsertTerm(terminologyId, userId, termData);
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
      const { sourceTerm } = req.body;
      if (!sourceTerm) return next(new AppError('Source term is required in body to remove', 400));
      logger.info(`Attempting to remove term '${sourceTerm}' from terminology ${terminologyId} by user ${userId}`);
      // Use injected service
      const updatedTerminology = await this.terminologyService.removeTerm(terminologyId, userId, sourceTerm);
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
      
      // FIXME: importTermsFromCSV method does not exist on TerminologyService.
      // Need to implement CSV parsing and term upsert logic here or in the service.
      // const result = await this.terminologyService.importTermsFromCSV(terminologyId, userId, csvContent);
      // Placeholder response:
      res.status(501).json({ 
          success: false, 
          message: 'CSV import functionality not implemented yet.' 
          // details: result 
      });
       // logger.info(`[${this.serviceName}.${methodName}] User ${userId} finished CSV import for list ${terminologyId}. Results: ${JSON.stringify(result)}`);

    } catch (error) {
        logger.error(`Error in ${this.serviceName}.${methodName} for list ${req.params.terminologyId}:`, error);
        next(error);
    }
  }

  // GET /terms/:terminologyId/terms
  public getTermsByListId = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const methodName = 'getTermsByListId';
    const { terminologyId } = req.params;
    // Removed unused query params limit, page, search for now as we fetch the whole list first
    // const { limit = 50, page = 1, search } = req.query;
    try {
        const userId = req.user?.id; // Need userId for permission check in getTerminologyById
        validateId(terminologyId, '术语库');
        
        // Fetch the whole terminology list first using the existing service method
        const terminologyList = await this.terminologyService.getTerminologyById(terminologyId, userId);
        
        // TODO: Implement filtering/pagination on the terms array if needed
        // For now, returning all terms
        const terms = terminologyList.terms || [];
        
        res.status(200).json({ 
            success: true, 
            // Adapt response structure if needed, maybe pagination info?
            data: { terms } 
        }); 
    } catch (error) {
        logger.error(`Error in ${this.serviceName}.${methodName} for list ID ${terminologyId}:`, error);
        next(error);
    }
  };

  // Export terminology list
  async exportById(req: AuthRequest, res: Response, next: NextFunction) {
    const methodName = 'exportById';
    try {
      const userId = req.user?.id;
      if (!userId) return next(new AppError('Authentication required', 401));
      const terminologyId = req.params.terminologyId;
      if (!terminologyId) return next(new AppError('Terminology ID is required', 400));

      logger.info(`Attempting to export terminology ${terminologyId} by user ${userId}`);
      const csvContent = await this.terminologyService.exportTerminology(terminologyId, userId);
      
      // Set headers for file download
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="terminology_${terminologyId}.csv"`);
      res.status(200).send(csvContent);

    } catch (error) {
      logger.error(`Error in ${this.serviceName}.${methodName} for ID ${req.params.terminologyId}:`, error);
      next(error);
    }
  }
}

// Remove exported instance
// export const terminologyController = new TerminologyController(); 


