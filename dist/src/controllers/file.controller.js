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
const translationQueue_service_1 = require("../services/translationQueue.service"); // Import queue service AND JobStatus type
const project_service_1 = require("../services/project.service"); // Import project service for validation
const file_model_1 = require("../models/file.model"); // Import File model and status
const segment_model_1 = require("../models/segment.model"); // Import Segment model and status
class FileController {
    constructor() {
        this.serviceName = 'FileController'; // Add service name
        this.uploadFile = async (req, res, next) => {
            const methodName = 'uploadFile';
            const { projectId } = req.params;
            const userId = req.user?.id;
            const userRoles = req.user?.role ? [req.user.role] : [];
            try {
                (0, errorHandler_1.validateId)(projectId, '项目');
                if (!userId) {
                    return next(new errors_1.AppError('认证失败，无法获取用户ID', 401));
                }
                // Check if req.file exists AFTER multer has run
                if (!req.file) {
                    // Log the request body/headers if needed for debugging
                    logger_1.default.error('File upload error: req.file is undefined. Check multer setup and client request.');
                    return next(new errors_1.AppError('未找到上传的文件或上传处理失败', 400));
                }
                // Fetch project details to get language pairs
                const project = await project_service_1.projectService.getProjectById(projectId, userId, userRoles);
                (0, errorHandler_1.validateEntityExists)(project, '项目');
                if (!project.languagePairs || project.languagePairs.length === 0) {
                    // Clean up the uploaded file if project validation fails early
                    if (req.file?.path) {
                        promises_1.default.unlink(req.file.path).catch(unlinkErr => logger_1.default.error(`Failed to delete orphaned file ${req.file?.path}:`, unlinkErr));
                    }
                    return next(new errors_1.AppError(`项目 ${projectId} 未配置语言对，无法上传文件`, 400));
                }
                // Use the first language pair from the project
                const { source: projectSourceLang, target: projectTargetLang } = project.languagePairs[0];
                // --- Filename Decoding ---
                let decodedOriginalName = req.file.originalname;
                try {
                    // Multer should handle RFC 5987 percent-encoding, but this adds robustness
                    decodedOriginalName = decodeURIComponent(req.file.originalname);
                    // Optional: Add further sanitization/normalization if needed
                    // decodedOriginalName = path.normalize(decodedOriginalName);
                }
                catch (e) {
                    // Log if decoding fails, but proceed with the raw name as a fallback
                    // This might happen if the name is already UTF-8 and contains '%' incorrectly
                    logger_1.default.warn(`Failed to decode originalname: "${req.file.originalname}". Using raw value. Error:`, e);
                }
                // --- End Filename Decoding ---
                logger_1.default.info(`User ${userId} uploading file "${decodedOriginalName}" to project ${projectId} (Languages: ${projectSourceLang} -> ${projectTargetLang})`);
                // Use decoded name for validation
                const fileType = (0, fileUtils_1.validateFileType)(decodedOriginalName, req.file.mimetype);
                if (!fileType) {
                    // Use decoded name in error message too
                    // Clean up the uploaded file before throwing error
                    if (req.file?.path) {
                        promises_1.default.unlink(req.file.path).catch(unlinkErr => logger_1.default.error(`Failed to delete invalid file type ${req.file?.path}:`, unlinkErr));
                    }
                    throw new errors_1.ValidationError(`不支持的文件类型: "${decodedOriginalName}" (MIME: ${req.file.mimetype})`);
                }
                // --- Prepare File Info ---
                const fileInfo = {
                    path: req.file.path, // Path where multer saved the temp file
                    filePath: req.file.path, // Duplicate, maybe consolidate later
                    originalName: decodedOriginalName, // *** Use the decoded name ***
                    mimeType: req.file.mimetype,
                    size: req.file.size,
                    fileType: fileType, // Determined file category (e.g., 'document', 'xliff')
                    destination: req.file.destination, // Folder where multer saved the file
                    filename: req.file.filename // Unique temporary filename generated by multer
                };
                // --- End Prepare File Info ---
                // Pass languages obtained from the project to the service
                const fileRecord = await fileManagement_service_1.fileManagementService.processUploadedFile(projectId, userId, fileInfo, projectSourceLang, // Use language from project
                projectTargetLang, // Use language from project
                userRoles);
                // If processUploadedFile succeeds, the file is managed by the service
                // and potentially moved or copied, so no cleanup needed here for success case.
                res.status(201).json({
                    success: true,
                    message: '文件上传成功并开始处理',
                    data: fileRecord.toObject() // Return the created DB record
                });
            }
            catch (error) {
                logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
                // --- Error Cleanup ---
                // Ensure temporary file is deleted if an error occurs AFTER multer succeeded
                // but BEFORE the file is successfully processed by the service.
                if (req.file?.path) {
                    // Use fs.promises.unlink and handle potential errors during cleanup
                    promises_1.default.unlink(req.file.path).catch(unlinkErr => logger_1.default.error(`[Error Cleanup] Failed to delete uploaded file ${req.file?.path} after error:`, unlinkErr));
                }
                // --- End Error Cleanup ---
                next(error); // Pass error to the central error handler
            }
        };
        // Placeholder for starting translation
        this.startTranslation = async (req, res, next) => {
            const methodName = 'startTranslation';
            const { projectId, fileId } = req.params;
            const userId = req.user?.id;
            const userRoles = req.user?.role ? [req.user.role] : [];
            // <<< Get settings from request body >>>
            const { promptTemplateId, aiConfigId, // Assuming frontend sends aiConfigId directly now
            options = {} // Keep options for other potential settings
             } = req.body;
            try {
                (0, errorHandler_1.validateId)(projectId, '项目');
                (0, errorHandler_1.validateId)(fileId, '文件');
                if (!userId)
                    return next(new errors_1.AppError('认证失败', 401));
                // <<< Validate required IDs from body >>>
                if (!promptTemplateId) {
                    return next(new errors_1.ValidationError('缺少必要的参数: promptTemplateId'));
                }
                if (!aiConfigId) {
                    return next(new errors_1.ValidationError('缺少必要的参数: aiConfigId'));
                }
                (0, errorHandler_1.validateId)(promptTemplateId, '提示词模板');
                (0, errorHandler_1.validateId)(aiConfigId, 'AI 配置');
                // 1. Validate user permission (projectService.getProjectById already does this)
                // We don't strictly need the project object here anymore unless we validate 
                // if the chosen templates/configs are compatible, but let's keep it for now.
                const project = await project_service_1.projectService.getProjectById(projectId, userId, userRoles);
                (0, errorHandler_1.validateEntityExists)(project, '项目');
                logger_1.default.info(`User ${userId} queuing translation for file ${fileId} in project ${projectId} using AI Config ${aiConfigId} and Prompt ${promptTemplateId}`);
                // 3. Call QueueService to enqueue the job, passing the determined IDs
                const jobId = await translationQueue_service_1.translationQueueService.addFileTranslationJob(projectId, fileId, aiConfigId, // <<< Pass from req.body
                promptTemplateId, // <<< Pass from req.body
                options, // Pass remaining options
                userId, userRoles);
                // 4. Return job ID or success message
                res.status(202).json({
                    success: true,
                    message: '翻译请求已接收',
                    jobId: jobId // Return job ID
                });
            }
            catch (error) {
                logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
                next(error);
            }
        };
        // --- Method to get job status (ENHANCED) ---
        this.getTranslationJobStatus = async (req, res, next) => {
            const methodName = 'getTranslationJobStatus';
            const { jobId: requestedJobId } = req.params; // Rename to avoid confusion
            const userId = req.user?.id;
            const userRoles = req.user?.role ? [req.user.role] : [];
            try {
                // Extract the actual MongoDB File ID from the Job ID
                const fileId = requestedJobId?.startsWith('file-')
                    ? requestedJobId.split('-')[1]
                    : requestedJobId; // Fallback if prefix is missing
                if (!fileId) {
                    return next(new errors_1.ValidationError('无法从任务ID中解析文件ID'));
                }
                (0, errorHandler_1.validateId)(fileId, '文件ID'); // Validate the extracted ID format
                if (!userId) {
                    return next(new errors_1.AppError('认证失败，无法获取用户ID', 401));
                }
                logger_1.default.info(`User ${userId} fetching status for file/job ${fileId}`);
                // 1. Fetch File temporarily to get projectId (no permission check yet)
                const tempFile = await file_model_1.File.findById(fileId).select('projectId').lean().exec();
                if (!tempFile || !tempFile.projectId) {
                    logger_1.default.warn(`File or project ID not found for file ID: ${fileId}`);
                    return next(new errors_1.NotFoundError(`文件 ${fileId} 未找到`));
                }
                const projectId = tempFile.projectId.toString();
                // --- Move validation here ---
                (0, errorHandler_1.validateId)(projectId, '项目');
                // 2. Fetch the File document properly using service for permission check
                const fileDoc = await fileManagement_service_1.fileManagementService.getFileById(fileId, projectId, userId, userRoles);
                if (!fileDoc) {
                    // This case implies a permission error from the service
                    logger_1.default.warn(`Permission denied for file ID: ${fileId}, User: ${userId}`);
                    return next(new errors_1.AppError(`无权访问文件 ${fileId}`, 403)); // Return 403 Forbidden
                }
                // 3. Fetch Segment counts for progress calculation
                // Use fileDoc!._id as fileDoc is guaranteed non-null here by checks above
                const totalSegments = await segment_model_1.Segment.countDocuments({ fileId: fileDoc._id });
                const completedSegments = await segment_model_1.Segment.countDocuments({
                    fileId: fileDoc._id,
                    status: { $in: [segment_model_1.SegmentStatus.TRANSLATED, segment_model_1.SegmentStatus.TRANSLATED_TM] }
                });
                const erroredSegments = await segment_model_1.Segment.countDocuments({
                    fileId: fileDoc._id,
                    status: { $in: [segment_model_1.SegmentStatus.ERROR, segment_model_1.SegmentStatus.TRANSLATION_FAILED] }
                });
                // Use fileDoc directly here as it passed null checks
                const fileProgress = totalSegments > 0 ? Math.round((completedSegments / totalSegments) * 100) : (fileDoc.status === file_model_1.FileStatus.COMPLETED || fileDoc.status === file_model_1.FileStatus.TRANSLATED ? 100 : 0);
                // 4. Determine overall status (Use File status primarily)
                let overallStatus = 'processing'; // Default
                if (fileDoc.status === file_model_1.FileStatus.PENDING) {
                    overallStatus = 'queued'; // Map PENDING to queued for frontend
                }
                else if (fileDoc.status === file_model_1.FileStatus.PROCESSING || fileDoc.status === file_model_1.FileStatus.TRANSLATING || fileDoc.status === file_model_1.FileStatus.REVIEWING) {
                    overallStatus = 'processing';
                }
                else if (fileDoc.status === file_model_1.FileStatus.COMPLETED || fileDoc.status === file_model_1.FileStatus.TRANSLATED || fileDoc.status === file_model_1.FileStatus.REVIEW_COMPLETED) {
                    overallStatus = 'completed';
                }
                else if (fileDoc.status === file_model_1.FileStatus.ERROR) {
                    overallStatus = 'failed';
                }
                // 5. Construct the detailed response
                const responseData = {
                    status: overallStatus,
                    progress: fileProgress,
                    totalFiles: 1,
                    completedFiles: (overallStatus === 'completed') ? 1 : 0,
                    // Use fileDoc directly
                    errors: fileDoc.status === file_model_1.FileStatus.ERROR ? [{ fileId: fileDoc._id.toString(), message: fileDoc.errorDetails || '文件处理失败' }] : [],
                    files: [
                        {
                            id: fileDoc._id.toString(),
                            originalName: fileDoc.originalName || fileDoc.fileName,
                            status: fileDoc.status,
                            progress: fileProgress,
                            sourceLanguage: fileDoc.metadata?.sourceLanguage,
                            targetLanguage: fileDoc.metadata?.targetLanguage,
                        }
                    ],
                };
                res.status(200).json({
                    success: true,
                    data: responseData
                });
            }
            catch (error) {
                logger_1.default.error(`Error in ${this.serviceName}.${methodName} for file/job ${requestedJobId}:`, error);
                // Handle specific errors like validation or DB issues
                if (error instanceof errors_1.NotFoundError) {
                    return res.status(404).json({ success: false, message: error.message });
                }
                // Use the central error handler for other types of errors
                next(error);
            }
        };
        // --- END Method to get job status ---
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
}
exports.FileController = FileController;
// Export class directly, instantiation happens in routes file
// export default new FileController(); 
