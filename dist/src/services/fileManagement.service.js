"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileManagementService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const file_model_1 = require("../models/file.model");
const segment_model_1 = require("../models/segment.model");
const fileProcessor_factory_1 = require("./fileProcessing/fileProcessor.factory");
const project_service_1 = require("./project.service");
const errorHandler_1 = require("../utils/errorHandler");
const errors_1 = require("../utils/errors");
const logger_1 = __importDefault(require("../utils/logger"));
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
class FileManagementService {
    constructor() {
        this.serviceName = 'FileManagementService';
        // TODO: Add methods for updating file status, downloading files etc.
    }
    /**
     * Processes an uploaded file: stores it, creates DB entry, extracts segments.
     * @param projectId ID of the project the file belongs to.
     * @param userId ID of the user uploading the file.
     * @param fileInfo Information about the uploaded file from middleware.
     * @param sourceLang Source language code.
     * @param targetLang Target language code.
     * @param requesterRoles Roles of the user requesting the operation
     * @returns The created IFile document.
     */
    async processUploadedFile(projectId, userId, fileInfo, sourceLang, targetLang, requesterRoles = []) {
        const methodName = 'processUploadedFile';
        (0, errorHandler_1.validateId)(projectId, '项目');
        (0, errorHandler_1.validateId)(userId, '用户');
        let fileRecord = null; // Keep track of the created file record for potential cleanup
        try {
            // 1. Validate Project and User Permissions (implicitly via projectService)
            const project = await project_service_1.projectService.getProjectById(projectId, userId, requesterRoles);
            (0, errorHandler_1.validateEntityExists)(project, '项目');
            // 2. Create File Record in DB (initially PENDING)
            const storagePath = path_1.default.join(fileInfo.destination, fileInfo.filename).replace(/\\/g, '/'); // Normalize path
            fileRecord = new file_model_1.File({
                projectId: project._id,
                fileName: fileInfo.filename,
                originalName: fileInfo.originalName,
                fileSize: fileInfo.size,
                mimeType: fileInfo.mimeType,
                fileType: fileInfo.fileType,
                status: file_model_1.FileStatus.PENDING,
                uploadedBy: new mongoose_1.default.Types.ObjectId(userId),
                storageUrl: storagePath, // Relative path for now, could be full URL later
                filePath: storagePath,
                metadata: {
                    sourceLanguage: sourceLang,
                    targetLanguage: targetLang
                },
                segmentCount: 0, // Initial values
                translatedCount: 0,
                reviewedCount: 0,
            });
            await fileRecord.save();
            logger_1.default.info(`File record created for ${fileInfo.originalName} with ID ${fileRecord._id}`);
            // 3. Update status to PROCESSING
            fileRecord.status = file_model_1.FileStatus.PROCESSING;
            fileRecord.processingStartedAt = new Date();
            await fileRecord.save();
            // 4. Call FileProcessorFactory to extract segments
            // Pass the correct fields: filePath and fileType
            const processingResult = await fileProcessor_factory_1.FileProcessorFactory.processFile(fileRecord.filePath, fileRecord.fileType);
            // 5. Update File record with metadata and segment count
            fileRecord.segmentCount = processingResult.segmentCount;
            // Optionally merge metadata from processor (e.g., if XLIFF had language info)
            if (processingResult.metadata && Object.keys(processingResult.metadata).length > 0) {
                // Be careful not to overwrite essential metadata like targetLang provided by user
                fileRecord.metadata = { ...fileRecord.metadata, ...processingResult.metadata };
            }
            // 6. Bulk-insert Segments
            if (processingResult.segments && processingResult.segments.length > 0) {
                const segmentsToInsert = processingResult.segments.map(seg => ({
                    ...seg,
                    fileId: fileRecord._id, // Use non-null assertion here as fileRecord is guaranteed
                    sourceLength: seg.sourceText?.length || 0, // Calculate source length
                    status: seg.status || segment_model_1.SegmentStatus.PENDING // Ensure status is set
                }));
                await segment_model_1.Segment.insertMany(segmentsToInsert);
                logger_1.default.info(`Inserted ${processingResult.segmentCount} segments for file ${fileRecord._id}`);
            }
            // 7. Update File status to TRANSLATED (or PENDING if no segments?) / COMPLETED?
            // For now, let's set to TRANSLATED assuming segments were extracted for translation.
            // If no segments found, maybe keep as PROCESSING or set to COMPLETED?
            // Let's set to PENDING to indicate ready for translation queue
            fileRecord.status = file_model_1.FileStatus.PENDING; // Ready for translation queue
            fileRecord.processingCompletedAt = new Date();
            await fileRecord.save();
            logger_1.default.info(`Successfully processed file ${fileRecord.originalName} (ID: ${fileRecord._id})`);
            return fileRecord;
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName} for file ${fileInfo?.originalName}:`, error);
            // --- Add Null Check --- 
            // Only attempt to update the record if it was successfully created
            if (fileRecord && fileRecord._id) {
                try {
                    fileRecord.status = file_model_1.FileStatus.ERROR;
                    fileRecord.error = error instanceof Error ? error.message : 'File processing failed';
                    fileRecord.processingCompletedAt = new Date();
                    await fileRecord.save();
                }
                catch (saveError) {
                    logger_1.default.error(`Failed to update file status to ERROR for ${fileRecord._id}:`, saveError);
                }
            }
            else {
                logger_1.default.warn(`File record was not created or ID is missing for ${fileInfo?.originalName}, cannot mark as ERROR in DB.`);
            }
            if (fileInfo?.path) {
                // Attempt cleanup even if DB record failed
                promises_1.default.unlink(fileInfo.path).catch(unlinkErr => logger_1.default.error(`Failed to delete file ${fileInfo.path} after error:`, unlinkErr));
            }
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '文件处理');
        }
    }
    async getFileById(fileId, projectId, userId, requesterRoles = []) {
        const methodName = 'getFileById';
        (0, errorHandler_1.validateId)(fileId, '文件');
        (0, errorHandler_1.validateId)(projectId, '项目');
        (0, errorHandler_1.validateId)(userId, '用户');
        try {
            // Ensure user has access to the project first
            await project_service_1.projectService.getProjectById(projectId, userId, requesterRoles);
            const file = await file_model_1.File.findOne({ _id: new mongoose_1.default.Types.ObjectId(fileId), projectId: new mongoose_1.default.Types.ObjectId(projectId) }).exec();
            (0, errorHandler_1.validateEntityExists)(file, '文件');
            return file;
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '获取文件');
        }
    }
    async getFilesByProjectId(projectId, userId, requesterRoles = []) {
        const methodName = 'getFilesByProjectId';
        (0, errorHandler_1.validateId)(projectId, '项目');
        (0, errorHandler_1.validateId)(userId, '用户');
        try {
            // Ensure user has access to the project first
            await project_service_1.projectService.getProjectById(projectId, userId, requesterRoles);
            const files = await file_model_1.File.find({ projectId: new mongoose_1.default.Types.ObjectId(projectId) }).sort({ createdAt: -1 }).exec();
            return files;
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '获取项目文件列表');
        }
    }
    async deleteFile(fileId, projectId, userId, requesterRoles = []) {
        const methodName = 'deleteFile';
        (0, errorHandler_1.validateId)(fileId, '文件');
        (0, errorHandler_1.validateId)(projectId, '项目');
        (0, errorHandler_1.validateId)(userId, '用户');
        try {
            // Ensure user has access and get the file record
            const file = await this.getFileById(fileId, projectId, userId, requesterRoles);
            if (!file) {
                throw new errors_1.NotFoundError('无法找到要删除的文件'); // Should be caught by getFileById, but double check
            }
            // 1. Delete Segments associated with the file
            const deleteSegmentsResult = await segment_model_1.Segment.deleteMany({ fileId: file._id });
            logger_1.default.info(`Deleted ${deleteSegmentsResult.deletedCount} segments for file ${fileId}`);
            // 2. Delete File Record from DB
            await file_model_1.File.findByIdAndDelete(file._id);
            logger_1.default.info(`Deleted file record ${fileId} from database.`);
            // 3. Delete Physical File from storage
            try {
                await promises_1.default.unlink(file.path);
                logger_1.default.info(`Deleted physical file ${file.path} from storage.`);
            }
            catch (unlinkError) {
                // Log error but don't fail the whole operation if DB entries are gone
                logger_1.default.error(`Failed to delete physical file ${file.path}: ${unlinkError.message}`);
            }
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '删除文件');
        }
    }
}
exports.fileManagementService = new FileManagementService();
