import mongoose from 'mongoose';
import { File, IFile, FileStatus, FileType } from '../models/file.model';
import { Segment, ISegment, SegmentStatus } from '../models/segment.model';
import { FileProcessorFactory } from './fileProcessing/fileProcessor.factory';
import { projectService } from './project.service';
import { handleServiceError, validateId, validateEntityExists } from '../utils/errorHandler';
import { AppError, NotFoundError, ValidationError } from '../utils/errors';
import logger from '../utils/logger';
import path from 'path';
import fs from 'fs/promises';
import { IFileProcessor } from './fileProcessing/types';

// Define the structure for file info received after upload middleware
interface UploadedFileInfo {
    path: string;           // Temporary path where the uploaded file is stored
    originalName: string;
    mimeType: string;
    size: number;
    fileType: FileType;     // Determined based on extension/mimeType
    destination: string;    // Directory where the file should be permanently stored
    filename: string;       // Generated unique filename for storage
}

class FileManagementService {
    private serviceName = 'FileManagementService';

    /**
     * Processes an uploaded file: stores it, creates DB entry, extracts segments.
     * @param projectId ID of the project the file belongs to.
     * @param userId ID of the user uploading the file.
     * @param fileInfo Information about the uploaded file from middleware.
     * @param sourceLang Source language code.
     * @param targetLang Target language code.
     * @returns The created IFile document.
     */
    async processUploadedFile(
        projectId: string,
        userId: string,
        fileInfo: UploadedFileInfo,
        sourceLang: string,
        targetLang: string
    ): Promise<IFile> {
        const methodName = 'processUploadedFile';
        validateId(projectId, '项目');
        validateId(userId, '用户');

        let fileRecord: IFile | null = null; // Keep track of the created file record for potential cleanup

        try {
            // 1. Validate Project and User Permissions (implicitly via projectService)
            const project = await projectService.getProjectById(projectId, userId);
            validateEntityExists(project, '项目');

            // 2. Create File Record in DB (initially PENDING)
            const storagePath = path.join(fileInfo.destination, fileInfo.filename).replace(/\\/g, '/'); // Normalize path
            fileRecord = new File({
                projectId: project._id,
                fileName: fileInfo.filename,
                originalName: fileInfo.originalName,
                fileSize: fileInfo.size,
                mimeType: fileInfo.mimeType,
                type: fileInfo.fileType,
                status: FileStatus.PENDING,
                uploadedBy: new mongoose.Types.ObjectId(userId),
                storageUrl: storagePath, // Relative path for now, could be full URL later
                path: storagePath, // Use the normalized storage path
                metadata: {
                    sourceLanguage: sourceLang,
                    targetLanguage: targetLang
                },
                segmentCount: 0, // Initial values
                translatedCount: 0,
                reviewedCount: 0,
            });
            await fileRecord.save();
            logger.info(`File record created for ${fileInfo.originalName} with ID ${fileRecord._id}`);

            // 3. Update status to PROCESSING
            fileRecord.status = FileStatus.PROCESSING;
            fileRecord.processingStartedAt = new Date();
            await fileRecord.save();

            // 4. Call FileProcessorFactory to extract segments
            // Note: processFile expects the final stored path, not the temporary upload path
            const processingResult = await FileProcessorFactory.processFile(fileRecord.path, fileRecord.type);

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
                    fileId: fileRecord!._id, // Use non-null assertion here as fileRecord is guaranteed
                    sourceLength: seg.sourceText?.length || 0, // Calculate source length
                    status: seg.status || SegmentStatus.PENDING // Ensure status is set
                }));
                await Segment.insertMany(segmentsToInsert);
                logger.info(`Inserted ${processingResult.segmentCount} segments for file ${fileRecord!._id}`);
            }

            // 7. Update File status to TRANSLATED (or PENDING if no segments?) / COMPLETED?
            // For now, let's set to TRANSLATED assuming segments were extracted for translation.
            // If no segments found, maybe keep as PROCESSING or set to COMPLETED?
            // Let's set to PENDING to indicate ready for translation queue
            fileRecord.status = FileStatus.PENDING; // Ready for translation queue
            fileRecord.processingCompletedAt = new Date();
            await fileRecord.save();

            logger.info(`Successfully processed file ${fileRecord.originalName} (ID: ${fileRecord._id})`);
            return fileRecord;

        } catch (error) {
            logger.error(`Error in ${this.serviceName}.${methodName} for file ${fileInfo?.originalName}:`, error);
            
            // --- Add Null Check --- 
            // Only attempt to update the record if it was successfully created
            if (fileRecord && fileRecord._id) { 
                try {
                    fileRecord.status = FileStatus.ERROR;
                    fileRecord.error = error instanceof Error ? error.message : 'File processing failed';
                    fileRecord.processingCompletedAt = new Date();
                    await fileRecord.save();
                } catch (saveError) {
                    logger.error(`Failed to update file status to ERROR for ${fileRecord._id}:`, saveError);
                }
            } else {
                logger.warn(`File record was not created or ID is missing for ${fileInfo?.originalName}, cannot mark as ERROR in DB.`);
            }
            
             if (fileInfo?.path) {
                 // Attempt cleanup even if DB record failed
                 fs.unlink(fileInfo.path).catch(unlinkErr => logger.error(`Failed to delete file ${fileInfo.path} after error:`, unlinkErr));
             }
            throw handleServiceError(error, this.serviceName, methodName, '文件处理');
        }
    }

    async getFileById(fileId: string, projectId: string, userId: string): Promise<IFile | null> {
        const methodName = 'getFileById';
        validateId(fileId, '文件');
        validateId(projectId, '项目');
        validateId(userId, '用户');
        try {
             // Ensure user has access to the project first
            await projectService.getProjectById(projectId, userId);
            const file = await File.findOne({ _id: new mongoose.Types.ObjectId(fileId), projectId: new mongoose.Types.ObjectId(projectId) }).exec();
            validateEntityExists(file, '文件');
            return file;
        } catch (error) {
            logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
            throw handleServiceError(error, this.serviceName, methodName, '获取文件');
        }
    }

    async getFilesByProjectId(projectId: string, userId: string): Promise<IFile[]> {
        const methodName = 'getFilesByProjectId';
        validateId(projectId, '项目');
        validateId(userId, '用户');
        try {
             // Ensure user has access to the project first
            await projectService.getProjectById(projectId, userId);
            const files = await File.find({ projectId: new mongoose.Types.ObjectId(projectId) }).sort({ createdAt: -1 }).exec();
            return files;
        } catch (error) {
            logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
            throw handleServiceError(error, this.serviceName, methodName, '获取项目文件列表');
        }
    }

    async deleteFile(fileId: string, projectId: string, userId: string): Promise<void> {
        const methodName = 'deleteFile';
        validateId(fileId, '文件');
        validateId(projectId, '项目');
        validateId(userId, '用户');
        try {
            // Ensure user has access and get the file record
            const file = await this.getFileById(fileId, projectId, userId); 
            if (!file) {
                throw new NotFoundError('无法找到要删除的文件'); // Should be caught by getFileById, but double check
            }

            // 1. Delete Segments associated with the file
            const deleteSegmentsResult = await Segment.deleteMany({ fileId: file._id });
            logger.info(`Deleted ${deleteSegmentsResult.deletedCount} segments for file ${fileId}`);

            // 2. Delete File Record from DB
            await File.findByIdAndDelete(file._id);
            logger.info(`Deleted file record ${fileId} from database.`);

            // 3. Delete Physical File from storage
            try {
                await fs.unlink(file.path);
                logger.info(`Deleted physical file ${file.path} from storage.`);
            } catch (unlinkError: any) { 
                // Log error but don't fail the whole operation if DB entries are gone
                logger.error(`Failed to delete physical file ${file.path}: ${unlinkError.message}`);
            }

        } catch (error) {
            logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
            throw handleServiceError(error, this.serviceName, methodName, '删除文件');
        }
    }

    // TODO: Add methods for updating file status, downloading files etc.

}

export const fileManagementService = new FileManagementService(); 