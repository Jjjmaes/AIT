"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileService = void 0;
const file_model_1 = require("../../models/file.model");
const logger_1 = __importDefault(require("../../utils/logger"));
/**
 * 文件服务类，负责处理文件相关的操作
 */
class FileService {
    /**
     * 更新文件状态
     * @param fileId 文件ID
     * @param status 新的文件状态
     */
    async updateFileStatus(fileId, status) {
        try {
            await file_model_1.File.findByIdAndUpdate(fileId, {
                status,
                updatedAt: new Date()
            });
            logger_1.default.info(`File status updated to ${status}`, { fileId: fileId.toString() });
        }
        catch (error) {
            logger_1.default.error(`Failed to update file status:`, error);
            throw error;
        }
    }
    /**
     * 获取文件信息
     * @param fileId 文件ID
     */
    async getFileById(fileId) {
        try {
            const file = await file_model_1.File.findById(fileId);
            if (!file) {
                throw new Error(`File not found: ${fileId}`);
            }
            return file;
        }
        catch (error) {
            logger_1.default.error(`Failed to get file:`, error);
            throw error;
        }
    }
    /**
     * 获取项目中的所有文件
     * @param projectId 项目ID
     */
    async getFilesByProjectId(projectId) {
        try {
            return await file_model_1.File.find({ projectId });
        }
        catch (error) {
            logger_1.default.error(`Failed to get project files:`, error);
            throw error;
        }
    }
    /**
     * 更新文件进度
     * @param fileId 文件ID
     * @param progress 进度信息
     */
    async updateFileProgress(fileId, progress) {
        try {
            await file_model_1.File.findByIdAndUpdate(fileId, { progress });
            logger_1.default.info(`File progress updated`, {
                fileId: fileId.toString(),
                progress: JSON.stringify(progress)
            });
        }
        catch (error) {
            logger_1.default.error(`Failed to update file progress:`, error);
            throw error;
        }
    }
    /**
     * 如果文件处理出错，更新文件的错误信息
     * @param fileId 文件ID
     * @param error 错误信息
     * @param errorDetails 详细错误信息
     */
    async updateFileError(fileId, error, errorDetails) {
        try {
            await file_model_1.File.findByIdAndUpdate(fileId, {
                status: file_model_1.FileStatus.ERROR,
                error,
                errorDetails,
                updatedAt: new Date()
            });
            logger_1.default.error(`File processing error`, {
                fileId: fileId.toString(),
                error,
                errorDetails
            });
        }
        catch (err) {
            logger_1.default.error(`Failed to update file error:`, err);
            throw err;
        }
    }
}
exports.FileService = FileService;
