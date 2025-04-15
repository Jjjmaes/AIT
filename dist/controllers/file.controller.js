"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileController = void 0;
const fileManagement_service_1 = require("../services/fileManagement.service");
const errorHandler_1 = require("../utils/errorHandler");
const errors_1 = require("../utils/errors");
const logger_1 = __importDefault(require("../utils/logger"));
const fileUtils_1 = require("../utils/fileUtils"); // Assuming validateFileType exists here
const promises_1 = __importDefault(require("fs/promises")); // Import fs for cleanup
const project_service_1 = require("../services/project.service"); // Import project service for validation
class FileController {
    constructor() {
        this.serviceName = 'FileController'; // Add service name
    }
    async uploadFile(req, res, next) {
        const methodName = 'uploadFile';
        const { projectId } = req.params;
        const userId = req.user?.id;
        const userRoles = req.user?.role ? [req.user.role] : []; // Extract roles
        const { sourceLanguage, targetLanguage } = req.body;
        try {
            (0, errorHandler_1.validateId)(projectId, '项目');
            if (!userId) {
                // Use specific error from errors utility
                return next(new errors_1.AppError('认证失败，无法获取用户ID', 401));
            }
            if (!req.file) {
                return next(new errors_1.AppError('未找到上传的文件', 400));
            }
            if (!sourceLanguage || !targetLanguage) {
                return next(new errors_1.ValidationError('请求体中必须提供源语言 (sourceLanguage) 和目标语言 (targetLanguage)'));
            }
            logger_1.default.info(`User ${userId} uploading file ${req.file.originalname} to project ${projectId}`);
            // Validate and determine FileType
            const fileType = (0, fileUtils_1.validateFileType)(req.file.originalname, req.file.mimetype);
            if (!fileType) {
                // Use specific error
                throw new errors_1.ValidationError(`不支持的文件类型: ${req.file.originalname} (MIME: ${req.file.mimetype})`);
            }
            // Prepare file info for the service
            const fileInfo = {
                path: req.file.path,
                originalName: req.file.originalname,
                mimeType: req.file.mimetype,
                size: req.file.size,
                fileType: fileType,
                destination: req.file.destination,
                filename: req.file.filename
            };
            // Call the service to process the file
            const fileRecord = await fileManagement_service_1.fileManagementService.processUploadedFile(projectId, userId, fileInfo, sourceLanguage, targetLanguage, userRoles // Pass roles
            );
            res.status(201).json({
                success: true,
                message: '文件上传成功并开始处理',
                data: fileRecord.toObject() // Return plain object
            });
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            // Ensure cleanup happens on error
            if (req.file?.path) {
                // Use fs.promises.unlink
                promises_1.default.unlink(req.file.path).catch(unlinkErr => logger_1.default.error(`Failed to delete uploaded file ${req.file?.path} after error:`, unlinkErr));
            }
            next(error);
        }
    }
    async getFiles(req, res, next) {
        const methodName = 'getFiles';
        const { projectId } = req.params;
        const userId = req.user?.id;
        const userRoles = req.user?.role ? [req.user.role] : []; // Extract roles
        try {
            (0, errorHandler_1.validateId)(projectId, '项目');
            if (!userId)
                return next(new errors_1.AppError('认证失败', 401));
            // Pass roles
            const files = await fileManagement_service_1.fileManagementService.getFilesByProjectId(projectId, userId, userRoles);
            // Return plain objects
            res.status(200).json({ success: true, data: files.map(f => f.toObject()) });
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            next(error);
        }
    }
    async getFile(req, res, next) {
        const methodName = 'getFile';
        const { projectId, fileId } = req.params;
        const userId = req.user?.id;
        const userRoles = req.user?.role ? [req.user.role] : []; // Extract roles
        try {
            (0, errorHandler_1.validateId)(projectId, '项目');
            (0, errorHandler_1.validateId)(fileId, '文件');
            if (!userId)
                return next(new errors_1.AppError('认证失败', 401));
            // Pass roles
            const file = await fileManagement_service_1.fileManagementService.getFileById(fileId, projectId, userId, userRoles);
            if (!file) {
                return next(new errors_1.NotFoundError('文件未找到'));
            }
            // Return plain object
            res.status(200).json({ success: true, data: file.toObject() });
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            next(error);
        }
    }
    async deleteFile(req, res, next) {
        const methodName = 'deleteFile';
        const { projectId, fileId } = req.params;
        const userId = req.user?.id;
        const userRoles = req.user?.role ? [req.user.role] : []; // Extract roles
        try {
            (0, errorHandler_1.validateId)(projectId, '项目');
            (0, errorHandler_1.validateId)(fileId, '文件');
            if (!userId)
                return next(new errors_1.AppError('认证失败', 401));
            // Pass roles
            await fileManagement_service_1.fileManagementService.deleteFile(fileId, projectId, userId, userRoles);
            res.status(200).json({ success: true, message: '文件已成功删除' });
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            next(error);
        }
    }
    // Placeholder for starting translation
    async startTranslation(req, res, next) {
        const methodName = 'startTranslation';
        const { projectId, fileId } = req.params;
        const userId = req.user?.id;
        const userRoles = req.user?.role ? [req.user.role] : []; // Extract roles
        // Extract options from request body if needed, otherwise use default/empty
        const options = req.body.options || {};
        try {
            (0, errorHandler_1.validateId)(projectId, '项目');
            (0, errorHandler_1.validateId)(fileId, '文件');
            if (!userId)
                return next(new errors_1.AppError('认证失败', 401));
            // 1. Validate user permission (Example using projectService)
            // This ensures the user triggering the job has access to the project
            await project_service_1.projectService.getProjectById(projectId, userId, userRoles);
            // Optionally add specific validation for the file itself if needed
            logger_1.default.info(`User ${userId} (Roles: ${userRoles.join(',')}) queuing translation for file ${fileId} in project ${projectId}`);
            // 2. Call QueueService to enqueue the job
            // 3. Pass userId and userRoles to the job queue data
            // Temporarily comment out adding job to queue
            /*
            const jobId = await translationQueueService.addFileTranslationJob(
              projectId,
              fileId,
              options,
              userId,
              userRoles // Pass roles here
            );
            */
            const fakeJobId = `temp-job-${fileId}-${Date.now()}`; // Generate fake ID for response
            logger_1.default.warn(`TEMPORARY: Skipped adding translation job for file ${fileId} to queue.`);
            // Return job ID or success message
            res.status(202).json({
                success: true,
                message: 'Translation request received (queue disabled).',
                jobId: fakeJobId // Return fake ID
            });
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            next(error);
        }
    }
}
exports.FileController = FileController;
// Export class directly, instantiation happens in routes file
// export default new FileController(); 
