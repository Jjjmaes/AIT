"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userService = exports.UserService = void 0;
const mongoose_1 = require("mongoose");
const user_model_1 = __importDefault(require("../models/user.model"));
const user_1 = require("../types/user");
const errors_1 = require("../utils/errors");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const logger_1 = __importDefault(require("../utils/logger"));
const errorHandler_1 = require("../utils/errorHandler");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const errorHandler_2 = require("../utils/errorHandler");
const project_model_1 = __importDefault(require("../models/project.model"));
class UserService {
    constructor() {
        this.serviceName = 'UserService';
    }
    /**
     * 用户注册
     */
    async registerUser(data) {
        const methodName = 'registerUser';
        try {
            // 检查用户名和邮箱是否已被注册
            const existingUser = await user_model_1.default.findOne({
                $or: [{ username: data.username }, { email: data.email }]
            });
            if (existingUser) {
                throw new errors_1.ConflictError('用户名或邮箱已被注册');
            }
            // 创建新用户
            const hashedPassword = await bcryptjs_1.default.hash(data.password, 10);
            const user = await user_model_1.default.create({
                username: data.username,
                email: data.email,
                password: hashedPassword,
                role: data.role || user_1.UserRole.TRANSLATOR,
                active: true
            });
            // 生成JWT令牌
            const token = jsonwebtoken_1.default.sign({ sub: user._id }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '1d' });
            // 移除密码后返回用户数据
            const userData = {
                id: user._id,
                email: user.email,
                username: user.username,
                role: user.role,
                fullName: user.fullName
            };
            logger_1.default.info(`User registered: ${user._id}`);
            // const userToReturn = user.toObject();
            // delete userToReturn.password;
            // Return the Mongoose document itself
            return user;
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            if (error.code === 11000) {
                throw new errors_1.ConflictError('用户名或邮箱已被注册');
            }
            throw (0, errorHandler_2.handleServiceError)(error, this.serviceName, methodName, '用户注册');
        }
    }
    /**
     * 用户登录
     */
    async loginUser(data) {
        const methodName = 'loginUser';
        try {
            // 查找用户
            logger_1.default.debug(`[${methodName}] Attempting to find user with email: ${data.email}`);
            // Find user, explicitly requesting password
            const user = await user_model_1.default.findOne({ email: data.email }).select('+password').exec();
            // --- Separate Checks --- 
            if (!user) { // First, check if user was found at all
                logger_1.default.warn(`[${methodName}] User not found for email: ${data.email}`);
                throw new errors_1.UnauthorizedError('邮箱或密码不正确 (User not found)'); // More specific error internally
            }
            logger_1.default.debug(`[${methodName}] User found. ID: ${user._id}. Checking password field...`);
            if (!user.password) { // Then, check if password field exists on the found user
                logger_1.default.error(`[${methodName}] Password field missing from user object despite using .select('+password')! User ID: ${user._id}`);
                throw new errors_1.AppError('Internal server error during login (password field missing).', 500); // Indicate internal issue
            }
            // ----------------------
            // --- More Detailed Password Comparison Logging --- 
            const providedPassword = data.password;
            const storedHash = user.password; // Now we know user and user.password exist
            logger_1.default.debug(`[${methodName}] Comparing Provided Password: [${providedPassword}] (Length: ${providedPassword?.length})`);
            logger_1.default.debug(`[${methodName}] With Stored Hash: [${storedHash}] (Length: ${storedHash?.length})`);
            const isPasswordValid = await bcryptjs_1.default.compare(providedPassword, storedHash);
            logger_1.default.debug(`[${methodName}] Password comparison result (isPasswordValid): ${isPasswordValid}`);
            // ------------------------------------------
            if (!isPasswordValid) {
                logger_1.default.warn(`[${methodName}] Password validation failed for user ${user._id}.`);
                throw new errors_1.UnauthorizedError('邮箱或密码不正确');
            }
            // 检查用户是否被禁用
            if (!user.active) {
                throw new errors_1.UnauthorizedError('用户账号已被禁用');
            }
            // Generate JWT令牌 with richer payload
            const payload = {
                id: user._id.toString(), // Use id instead of sub for clarity
                email: user.email,
                role: user.role,
                username: user.username,
                // Add other relevant non-sensitive fields if needed
            };
            const token = jsonwebtoken_1.default.sign(payload, // Use the richer payload
            process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '1d' } // Consider a shorter expiry for security
            );
            // The user data sent back in the login response body remains the same
            const userData = {
                id: user._id,
                email: user.email,
                username: user.username,
                role: user.role,
                fullName: user.fullName
            };
            logger_1.default.info(`User logged in: ${user._id}`);
            return { token, user: userData };
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            // 不要在登录失败时暴露具体的内部错误
            if (error instanceof errors_1.UnauthorizedError || error instanceof errors_1.ValidationError) {
                throw error; // 重新抛出已知的认证或验证错误
            }
            // 为其他错误抛出通用错误
            throw new errors_1.UnauthorizedError('登录失败，请稍后重试');
        }
    }
    /**
     * 获取用户详情
     */
    async getUserById(userId) {
        (0, errorHandler_1.validateId)(userId, '用户');
        const user = await user_model_1.default.findById(userId).select('-password');
        if (!user) {
            throw new errors_1.NotFoundError('用户不存在');
        }
        return {
            id: user._id,
            email: user.email,
            username: user.username,
            role: user.role,
            status: user.status
        };
    }
    /**
     * 更新用户信息
     */
    async updateUser(userId, updateData) {
        (0, errorHandler_1.validateId)(userId, '用户');
        // 检查邮箱是否已被其他用户使用
        if (updateData.email) {
            const existingUser = await user_model_1.default.findOne({
                email: updateData.email,
                _id: { $ne: new mongoose_1.Types.ObjectId(userId) }
            });
            if (existingUser) {
                throw new errors_1.ConflictError('该邮箱已被其他用户使用');
            }
        }
        // 更新用户信息
        const user = await user_model_1.default.findByIdAndUpdate(userId, updateData, { new: true, runValidators: true }).select('-password');
        if (!user) {
            throw new errors_1.NotFoundError('用户不存在');
        }
        logger_1.default.info(`User updated: ${userId}`);
        return {
            id: user._id,
            email: user.email,
            username: user.username,
            role: user.role,
            status: user.status
        };
    }
    /**
     * 修改密码
     */
    async changePassword(userId, data) {
        const methodName = 'changePassword';
        (0, errorHandler_1.validateId)(userId, '用户');
        if (!data.currentPassword || !data.newPassword) {
            throw new errors_1.ValidationError('当前密码和新密码不能为空');
        }
        if (data.newPassword.length < 6) {
            throw new errors_1.ValidationError('新密码长度不能小于6位');
        }
        try {
            // Fetch user including password
            const user = await user_model_1.default.findById(userId).select('+password');
            if (!user || !user.password) {
                throw new errors_1.NotFoundError('用户不存在或无法验证密码');
            }
            // Compare password using bcrypt directly
            const isPasswordValid = await bcryptjs_1.default.compare(data.currentPassword, user.password);
            if (!isPasswordValid) {
                throw new errors_1.UnauthorizedError('当前密码不正确');
            }
            // Hash and save new password
            user.password = await bcryptjs_1.default.hash(data.newPassword, 10);
            await user.save();
            logger_1.default.info(`Password changed for user: ${userId}`);
            return { success: true };
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName} for user ${userId}:`, error);
            throw (0, errorHandler_2.handleServiceError)(error, this.serviceName, methodName, '修改密码');
        }
    }
    /**
     * Get statistics for a specific user.
     * Calculates counts based on projects associated with the user.
     */
    async getUserStats(userId) {
        const methodName = 'getUserStats';
        (0, errorHandler_1.validateId)(userId, '用户');
        const userObjectId = new mongoose_1.Types.ObjectId(userId);
        try {
            // Basic stats: total projects managed or assigned
            const totalProjects = await project_model_1.default.countDocuments({
                $or: [
                    { manager: userObjectId },
                    { reviewers: userObjectId }
                    // Add other roles if needed (e.g., assigned translator)
                ]
            });
            // Pending reviews (count projects/files assigned to user that are in review state)
            // This might require more complex aggregation or separate queries on files/segments
            // Simple approximation: Count projects assigned for review that are 'InProgress' or specific review status
            const pendingReviewsCount = await project_model_1.default.countDocuments({
                reviewers: userObjectId,
                status: { $in: ['InProgress', 'Review', 'PendingReview'] } // Adjust statuses based on your workflow
            });
            // Completed files/projects (count projects assigned to user that are 'Completed')
            const completedProjectsCount = await project_model_1.default.countDocuments({
                $or: [
                    { manager: userObjectId },
                    { reviewers: userObjectId }
                ],
                status: 'Completed'
            });
            // Overall Progress (Placeholder - requires detailed file/segment progress tracking)
            // For now, returning a placeholder or average progress of assigned projects
            const overallProgress = 50; // Placeholder value
            const stats = {
                totalProjects: totalProjects,
                pendingReviews: pendingReviewsCount,
                // Placeholder for completed files - needs File model interaction
                completedFiles: completedProjectsCount, // Using completed projects as placeholder
                overallProgress: overallProgress,
            };
            logger_1.default.info(`Stats retrieved for user ${userId}: ${JSON.stringify(stats)}`);
            return stats;
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            throw (0, errorHandler_2.handleServiceError)(error, this.serviceName, methodName, '获取用户统计');
        }
    }
    /**
     * Get a list of users, potentially filtered.
     */
    async getUsers(options = {}) {
        const methodName = 'getUsers';
        try {
            const query = {};
            if (options.role) {
                // Validate role if necessary
                if (!Object.values(user_1.UserRole).includes(options.role)) {
                    throw new errors_1.ValidationError('无效的用户角色');
                }
                query.role = options.role;
            }
            // Add other filters here based on `options`
            // Exclude password from the result
            const users = await user_model_1.default.find(query).select('-password');
            return users;
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            throw (0, errorHandler_2.handleServiceError)(error, this.serviceName, methodName, '获取用户列表');
        }
    }
}
exports.UserService = UserService;
exports.userService = new UserService();
