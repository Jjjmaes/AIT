import { Request, Response, NextFunction } from 'express';
import { terminologyService } from '../services/terminology.service';
import { AuthRequest } from '../middleware/auth.middleware';
// Import DTOs from the service
import { CreateTerminologyDto, UpdateTerminologyDto, UpsertTermDto, GetTerminologyFilter } from '../services/terminology.service';
import { AppError } from '../utils/errors';
import logger from '../utils/logger';

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
      logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
      next(error);
    }
  }

  async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    const methodName = 'getAll';
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
      const result = await terminologyService.getTerminologies(filters);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
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
}

export const terminologyController = new TerminologyController();


