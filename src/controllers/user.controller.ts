import { Request, Response, NextFunction } from 'express';
import { userService } from '../services/user.service';
import { AuthRequest } from '../middleware/auth.middleware'; // Assuming this defines req.user
import { AppError, UnauthorizedError } from '../utils/errors';
import logger from '../utils/logger';

class UserController {
  private serviceName = 'UserController';

  /**
   * Get all users, potentially filtered by query params (e.g., role)
   */
  async getAllUsers(req: AuthRequest, res: Response, next: NextFunction) {
    const methodName = 'getAllUsers';
    try {
      // Basic permission check: Ensure user is logged in
      // Add more specific role checks if needed (e.g., only admin can list all users)
      if (!req.user) {
          throw new UnauthorizedError('未授权的访问');
      }
      
      // Extract query parameters for filtering
      const { role } = req.query;
      
      const filterOptions = {
        role: role as string | undefined,
        // Add other filters based on query params if implemented
      };

      logger.info(`Request received to get users with filter: ${JSON.stringify(filterOptions)}`);
      const users = await userService.getUsers(filterOptions);

      res.status(200).json({
        success: true,
        data: { 
            users: users.map(u => u.toObject()) // Return plain objects
            // Add pagination info here if implemented
        }
      });

    } catch (error) {
      logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
      next(error);
    }
  }

  /**
   * Get statistics for the currently logged-in user
   */
  async getUserStats(req: AuthRequest, res: Response, next: NextFunction) {
    const methodName = 'getUserStats';
    try {
      if (!req.user?.id) {
        throw new UnauthorizedError('未授权的访问，无法获取用户ID');
      }
      const userId = req.user.id;
      logger.info(`Request received to get stats for user: ${userId}`);

      // Call the service layer to get the actual stats
      const stats = await userService.getUserStats(userId);

      res.status(200).json({
        success: true,
        data: stats // Assuming stats is the object expected by frontend
      });

    } catch (error) {
      logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
      next(error); // Pass error to global error handler
    }
  }

  // Add other user controller methods here if needed

}

export const userController = new UserController(); 