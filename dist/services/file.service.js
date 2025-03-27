"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileService = void 0;
const file_model_1 = require("../models/file.model");
const segment_model_1 = require("../models/segment.model");
const errors_1 = require("../utils/errors");
const fileProcessor_1 = require("../utils/fileProcessor");
const s3_1 = require("../utils/s3");
const logger_1 = __importDefault(require("../utils/logger"));
const mongoose_1 = require("mongoose");
const uuid_1 = require("uuid");
class FileService {
    /**
     * 上传文件
     */
    async uploadFile(projectId, userId, fileData) {
        try {
            // 验证文件类型
            const fileType = this.getFileType(fileData.originalName);
            if (!fileType) {
                throw new errors_1.ValidationError('不支持的文件类型');
            }
            // 生成唯一文件名
            const fileName = `${(0, uuid_1.v4)()}-${fileData.originalName}`;
            // 上传到 S3
            const key = `files/${projectId}/${fileName}`;
            const s3Url = await (0, s3_1.uploadToS3)(fileData.filePath, key, fileData.mimeType);
            // 创建文件记录
            const file = await file_model_1.File.create({
                projectId: new mongoose_1.Types.ObjectId(projectId),
                fileName,
                originalName: fileData.originalName,
                fileSize: fileData.fileSize,
                mimeType: fileData.mimeType,
                type: fileType,
                status: file_model_1.FileStatus.PENDING,
                uploadedBy: new mongoose_1.Types.ObjectId(userId),
                storageUrl: s3Url,
                path: key,
                metadata: {
                    sourceLanguage: fileData.sourceLanguage,
                    targetLanguage: fileData.targetLanguage,
                    category: fileData.category,
                    tags: fileData.tags || []
                }
            });
            logger_1.default.info(`File ${file.id} uploaded successfully to project ${projectId}`);
            const result = file.toObject();
            return result;
        }
        catch (error) {
            logger_1.default.error(`Error uploading file: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }
    /**
     * 获取文件详情
     */
    async getFileById(fileId) {
        const file = await file_model_1.File.findById(fileId);
        if (!file) {
            throw new errors_1.NotFoundError('文件不存在');
        }
        const result = file.toObject();
        const { toObject, ...cleanResult } = result;
        return cleanResult;
    }
    /**
     * 获取项目文件列表
     */
    async getProjectFiles(projectId, query = {}) {
        const { status, type, uploadedBy, page = 1, pageSize = 10, sortBy = 'createdAt', sortOrder = 'desc', search, startDate, endDate } = query;
        const filter = { projectId: new mongoose_1.Types.ObjectId(projectId) };
        if (status)
            filter.status = status;
        if (type)
            filter.type = type;
        if (uploadedBy)
            filter.uploadedBy = new mongoose_1.Types.ObjectId(uploadedBy);
        if (search)
            filter.originalName = { $regex: search, $options: 'i' };
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate)
                filter.createdAt.$gte = startDate;
            if (endDate)
                filter.createdAt.$lte = endDate;
        }
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
        const [files, total] = await Promise.all([
            file_model_1.File.find(filter)
                .sort(sort)
                .skip((page - 1) * pageSize)
                .limit(pageSize),
            file_model_1.File.countDocuments(filter)
        ]);
        return {
            files: files.map(file => {
                const result = file.toObject();
                const { toObject, ...cleanResult } = result;
                return cleanResult;
            }),
            pagination: {
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize)
            }
        };
    }
    /**
     * 更新文件状态
     */
    async updateFileStatus(fileId, status) {
        const file = await file_model_1.File.findById(fileId);
        if (!file) {
            throw new errors_1.NotFoundError('文件不存在');
        }
        try {
            file.status = status;
            await file.save();
            logger_1.default.info(`File ${file.id} status updated to ${status}`);
            return file;
        }
        catch (error) {
            logger_1.default.error(`Error updating file status: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }
    /**
     * 删除文件
     */
    async deleteFile(fileId) {
        const file = await file_model_1.File.findById(fileId);
        if (!file) {
            throw new errors_1.NotFoundError('文件不存在');
        }
        try {
            // 删除 S3 文件
            await (0, s3_1.deleteFromS3)(file.path);
            // 删除数据库记录
            await file.deleteOne();
            // 删除相关段落
            await segment_model_1.Segment.deleteMany({ fileId: file._id });
            logger_1.default.info(`File ${fileId} deleted successfully`);
            return true;
        }
        catch (error) {
            logger_1.default.error(`Error deleting file: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }
    /**
     * 处理文件
     */
    async processFile(fileId, options = {}) {
        const file = await file_model_1.File.findById(fileId);
        if (!file) {
            throw new errors_1.NotFoundError('文件不存在');
        }
        if (file.status !== file_model_1.FileStatus.PENDING) {
            throw new errors_1.ValidationError('文件状态不正确，只能处理待处理状态的文件');
        }
        try {
            // 更新处理状态
            file.status = file_model_1.FileStatus.PROCESSING;
            file.processingStartedAt = new Date();
            await file.save();
            // 获取文件内容
            const content = await (0, s3_1.getFileContent)(file.path);
            // 处理文件内容
            const segments = await (0, fileProcessor_1.processFile)(content, file.type, options);
            // 保存段落信息
            await segment_model_1.Segment.create(segments.map((segment, index) => ({
                fileId: file._id,
                content: segment.content,
                order: index + 1,
                status: segment_model_1.SegmentStatus.PENDING,
                originalLength: segment.originalLength,
                translatedLength: segment.translatedLength,
                metadata: segment.metadata
            })));
            // 更新文件状态
            file.status = file_model_1.FileStatus.TRANSLATED;
            file.processingCompletedAt = new Date();
            file.segmentCount = segments.length;
            await file.save();
            logger_1.default.info(`File ${file.id} processed successfully with ${segments.length} segments`);
            return segments;
        }
        catch (error) {
            file.status = file_model_1.FileStatus.ERROR;
            file.error = error instanceof Error ? error.message : 'Unknown error';
            file.errorDetails = error instanceof Error ? error.stack : 'No stack trace available';
            await file.save();
            logger_1.default.error(`Error processing file ${file.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }
    /**
     * 导出文件
     */
    async exportFile(fileId, options) {
        const file = await file_model_1.File.findById(fileId);
        if (!file) {
            throw new errors_1.NotFoundError('文件不存在');
        }
        try {
            // 获取所有段落
            const segments = await segment_model_1.Segment.find({ fileId }).sort({ order: 1 }).exec();
            if (!segments || !Array.isArray(segments)) {
                throw new errors_1.ValidationError('未找到可导出的段落');
            }
            // 根据文件类型和导出选项生成导出内容
            let exportContent = '';
            if (options.format === 'json') {
                exportContent = this.exportAsJson(segments, options);
            }
            else {
                exportContent = this.exportAsText(segments, options);
            }
            // 生成导出文件名
            const timestamp = new Date().getTime();
            const exportFileName = `${file.fileName.replace(/\.[^/.]+$/, '')}_export_${timestamp}.${options.format}`;
            const exportPath = `exports/${exportFileName}`;
            // 上传导出文件
            const exportUrl = await (0, s3_1.uploadToS3)(Buffer.from(exportContent), exportPath, options.format === 'json' ? 'application/json' : 'text/plain');
            return exportUrl;
        }
        catch (error) {
            logger_1.default.error(`Error exporting file: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }
    /**
     * 获取文件类型
     */
    getFileType(filename) {
        const ext = filename.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'txt':
                return file_model_1.FileType.TXT;
            case 'json':
                return file_model_1.FileType.JSON;
            case 'md':
                return file_model_1.FileType.MD;
            case 'docx':
                return file_model_1.FileType.DOCX;
            case 'mqxliff':
                return file_model_1.FileType.MEMOQ_XLIFF;
            case 'xliff':
                return file_model_1.FileType.XLIFF;
            default:
                return null;
        }
    }
    /**
     * 导出为文本格式
     */
    exportAsText(segments, options) {
        if (!Array.isArray(segments)) {
            throw new errors_1.ValidationError('无效的段落数据');
        }
        return segments
            .map(segment => segment.translation || segment.content)
            .join('\n\n');
    }
    /**
     * 导出为 JSON 格式
     */
    exportAsJson(segments, options) {
        if (!Array.isArray(segments)) {
            throw new errors_1.ValidationError('无效的段落数据');
        }
        const exportData = segments.map(segment => {
            const data = {
                content: segment.content,
                translation: segment.translation
            };
            if (options.includeMetadata && segment.metadata) {
                data.metadata = segment.metadata;
            }
            return data;
        });
        return JSON.stringify(exportData, null, 2);
    }
    /**
     * 导出为 XLIFF 格式
     */
    exportAsXliff(segments, options) {
        const xliff = {
            '?xml': {
                '@_version': '1.0',
                '@_encoding': 'UTF-8'
            },
            xliff: {
                '@_version': '2.0',
                '@_xmlns': 'urn:oasis:names:tc:xliff:document:2.0',
                '@_srcLang': options.targetLanguage || 'en',
                '@_trgLang': options.targetLanguage || 'zh',
                file: {
                    '@_id': 'f1',
                    body: {
                        'trans-unit': segments.map((segment, index) => ({
                            '@_id': `tu${index + 1}`,
                            source: segment.content,
                            target: segment.translation || segment.content
                        }))
                    }
                }
            }
        };
        return JSON.stringify(xliff, null, 2);
    }
    /**
     * 获取文件段落列表
     */
    async getFileSegments(fileId, options = {}) {
        const file = await file_model_1.File.findById(fileId);
        if (!file) {
            throw new errors_1.NotFoundError('文件不存在');
        }
        const query = { file: fileId };
        if (options.status) {
            query.status = options.status;
        }
        const page = options.page || 1;
        const limit = options.limit || 10;
        const skip = (page - 1) * limit;
        const [segments, total] = await Promise.all([
            segment_model_1.Segment.find(query)
                .sort({ order: 1 })
                .skip(skip)
                .limit(limit),
            segment_model_1.Segment.countDocuments(query)
        ]);
        return {
            segments,
            total,
            page,
            limit
        };
    }
    /**
     * 更新文件进度
     */
    async updateFileProgress(fileId) {
        const file = await file_model_1.File.findById(fileId);
        if (!file) {
            throw new errors_1.NotFoundError('文件不存在');
        }
        const segments = await segment_model_1.Segment.find({ fileId });
        const totalSegments = segments.length;
        const completedSegments = segments.filter(s => s.status === segment_model_1.SegmentStatus.COMPLETED).length;
        const translatedSegments = segments.filter(s => s.status === segment_model_1.SegmentStatus.TRANSLATED).length;
        file.progress = {
            total: totalSegments,
            completed: completedSegments,
            translated: translatedSegments,
            percentage: totalSegments > 0 ? (completedSegments / totalSegments) * 100 : 0
        };
        await file.save();
    }
}
exports.FileService = FileService;
exports.default = new FileService();
