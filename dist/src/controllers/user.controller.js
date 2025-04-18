"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userController = void 0;
const user_service_1 = require("../services/user.service");
const errors_1 = require("../utils/errors");
const logger_1 = __importDefault(require("../utils/logger"));
class UserController {
    constructor() {
        this.serviceName = 'UserController';
        // Add other user controller methods here if needed
    }
    /**
     * Get all users, potentially filtered by query params (e.g., role)
     */
    async getAllUsers(req, res, next) {
        const methodName = 'getAllUsers';
        try {
            // Basic permission check: Ensure user is logged in
            // Add more specific role checks if needed (e.g., only admin can list all users)
            if (!req.user) {
                throw new errors_1.UnauthorizedError('未授权的访问');
            }
            // Extract query parameters for filtering
            const { role } = req.query;
            const filterOptions = {
                role: role,
                // Add other filters based on query params if implemented
            };
            logger_1.default.info(`Request received to get users with filter: ${JSON.stringify(filterOptions)}`);
            const users = await user_service_1.userService.getUsers(filterOptions);
            res.status(200).json({
                success: true,
                data: {
                    users: users.map(u => u.toObject()) // Return plain objects
                    // Add pagination info here if implemented
                }
            });
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            next(error);
        }
    }
    /**
     * Get statistics for the currently logged-in user
     */
    async getUserStats(req, res, next) {
        const methodName = 'getUserStats';
        try {
            if (!req.user?.id) {
                throw new errors_1.UnauthorizedError('未授权的访问，无法获取用户ID');
            }
            const userId = req.user.id;
            logger_1.default.info(`Request received to get stats for user: ${userId}`);
            // Call the service layer to get the actual stats
            const stats = await user_service_1.userService.getUserStats(userId);
            res.status(200).json({
                success: true,
                data: stats // Assuming stats is the object expected by frontend
            });
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            next(error); // Pass error to global error handler
        }
    }
}
exports.userController = new UserController();
