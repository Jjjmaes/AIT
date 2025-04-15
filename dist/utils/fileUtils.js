"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MIME_TYPE_MAP = exports.FILE_EXTENSION_MAP = void 0;
exports.getFileTypeFromFilename = getFileTypeFromFilename;
exports.getFileTypeFromMimeType = getFileTypeFromMimeType;
exports.detectFileType = detectFileType;
exports.validateFileType = validateFileType;
exports.getSupportedExtensions = getSupportedExtensions;
exports.getSupportedMimeTypes = getSupportedMimeTypes;
exports.getMimeTypeFromExtension = getMimeTypeFromExtension;
exports.generateUniqueFilename = generateUniqueFilename;
exports.buildFilePath = buildFilePath;
exports.extractFilenameFromPath = extractFilenameFromPath;
exports.checkFileSize = checkFileSize;
exports.isImageFile = isImageFile;
exports.getSupportedFileExtensions = getSupportedFileExtensions;
exports.getMimeTypeForExtension = getMimeTypeForExtension;
const path_1 = __importDefault(require("path"));
const file_model_1 = require("../models/file.model");
const logger_1 = __importDefault(require("./logger"));
const errors_1 = require("./errors");
const uuid_1 = require("uuid");
// 最大文件大小（100MB）
const MAX_FILE_SIZE = 100 * 1024 * 1024;
/**
 * 支持的文件扩展名和对应的文件类型映射
 */
exports.FILE_EXTENSION_MAP = {
    'txt': file_model_1.FileType.TXT,
    'text': file_model_1.FileType.TXT,
    'json': file_model_1.FileType.JSON,
    'md': file_model_1.FileType.MD,
    'markdown': file_model_1.FileType.MD,
    'docx': file_model_1.FileType.DOCX,
    'doc': file_model_1.FileType.DOCX,
    'mqxliff': file_model_1.FileType.MEMOQ_XLIFF,
    'xliff': file_model_1.FileType.XLIFF,
    'xlf': file_model_1.FileType.XLIFF
};
/**
 * 支持的MIME类型和对应的文件类型映射
 */
exports.MIME_TYPE_MAP = {
    'text/plain': file_model_1.FileType.TXT,
    'application/json': file_model_1.FileType.JSON,
    'text/markdown': file_model_1.FileType.MD,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': file_model_1.FileType.DOCX,
    'application/msword': file_model_1.FileType.DOCX,
    'application/x-xliff+xml': file_model_1.FileType.XLIFF,
    'application/xliff+xml': file_model_1.FileType.XLIFF,
    'application/x-memoq-xliff': file_model_1.FileType.MEMOQ_XLIFF
};
/**
 * 检查文件扩展名，返回对应的文件类型
 * @param filename 文件名
 * @returns 文件类型
 */
function getFileTypeFromFilename(filename) {
    if (!filename) {
        throw new errors_1.ValidationError('文件名不能为空');
    }
    const ext = filename.split('.').pop()?.toLowerCase();
    if (!ext) {
        throw new errors_1.ValidationError('无法识别文件扩展名');
    }
    switch (ext) {
        case 'txt':
            return file_model_1.FileType.TXT;
        case 'docx':
        case 'doc':
            return file_model_1.FileType.DOCX;
        case 'xlsx':
        case 'xls':
            return file_model_1.FileType.JSON;
        case 'csv':
            return file_model_1.FileType.JSON;
        case 'json':
            return file_model_1.FileType.JSON;
        case 'xml':
            return file_model_1.FileType.XLIFF;
        case 'html':
        case 'htm':
            return file_model_1.FileType.TXT;
        case 'md':
            return file_model_1.FileType.MD;
        case 'pdf':
            return file_model_1.FileType.DOCX;
        case 'po':
        case 'pot':
            return file_model_1.FileType.XLIFF;
        case 'srt':
        case 'vtt':
            return file_model_1.FileType.TXT;
        case 'resx':
        case 'resw':
            return file_model_1.FileType.XLIFF;
        default:
            throw new errors_1.ValidationError(`不支持的文件类型: ${ext}`);
    }
}
/**
 * 从MIME类型获取文件类型
 *
 * @param mimeType MIME类型
 * @returns 文件类型或null（如果不支持）
 */
function getFileTypeFromMimeType(mimeType) {
    if (!mimeType) {
        return null;
    }
    const fileType = exports.MIME_TYPE_MAP[mimeType.toLowerCase()];
    if (!fileType) {
        logger_1.default.warn(`不支持的MIME类型: ${mimeType}`);
    }
    return fileType || null;
}
/**
 * 检测文件类型（尝试从文件名和MIME类型获取）
 *
 * @param filename 文件名
 * @param mimeType MIME类型
 * @returns 文件类型或null（如果不支持）
 */
function detectFileType(filename, mimeType) {
    // 优先使用文件扩展名
    const fileTypeFromName = getFileTypeFromFilename(filename);
    if (fileTypeFromName) {
        return fileTypeFromName;
    }
    // 如果提供了MIME类型，尝试从MIME类型获取
    if (mimeType) {
        return getFileTypeFromMimeType(mimeType);
    }
    return null;
}
/**
 * 验证文件类型是否支持
 * @param filename 文件名
 * @param mimeType MIME类型
 * @returns 支持的文件类型
 */
function validateFileType(filename, mimeType) {
    try {
        return getFileTypeFromFilename(filename);
    }
    catch (error) {
        if (error instanceof errors_1.ValidationError) {
            throw new errors_1.ValidationError(`不支持的文件类型: ${filename} (${mimeType})`);
        }
        throw error;
    }
}
/**
 * 获取所有支持的文件扩展名
 *
 * @returns 支持的文件扩展名数组
 */
function getSupportedExtensions() {
    return Object.keys(exports.FILE_EXTENSION_MAP);
}
/**
 * 获取支持的MIME类型
 *
 * @returns 支持的MIME类型数组
 */
function getSupportedMimeTypes() {
    return Object.keys(exports.MIME_TYPE_MAP);
}
/**
 * 获取文件扩展名对应的MIME类型
 *
 * @param extension 文件扩展名
 * @returns MIME类型
 */
function getMimeTypeFromExtension(extension) {
    const mimeTypeEntries = Object.entries(exports.MIME_TYPE_MAP);
    for (const [mimeType, fileType] of mimeTypeEntries) {
        if (fileType === exports.FILE_EXTENSION_MAP[extension]) {
            return mimeType;
        }
    }
    return null;
}
/**
 * 生成唯一的文件名，保留原始扩展名
 * @param originalFilename 原始文件名
 * @returns 唯一的文件名
 */
function generateUniqueFilename(originalFilename) {
    const ext = path_1.default.extname(originalFilename);
    const baseName = path_1.default.basename(originalFilename, ext);
    const uniqueId = (0, uuid_1.v4)().slice(0, 8);
    return `${baseName}-${uniqueId}${ext}`;
}
/**
 * 构建存储路径
 * @param options 路径选项
 * @returns 存储路径
 */
function buildFilePath(options) {
    const { projectId, fileName, isProjectFile, subfolder } = options;
    // 主要文件夹基于文件类型
    const mainFolder = isProjectFile ? 'projects' : 'files';
    // 如果有子文件夹，则包括在路径中
    if (subfolder) {
        return `${mainFolder}/${projectId}/${subfolder}/${fileName}`;
    }
    return `${mainFolder}/${projectId}/${fileName}`;
}
/**
 * 从路径中提取文件名
 * @param filePath 文件路径
 * @returns 文件名
 */
function extractFilenameFromPath(filePath) {
    if (!filePath) {
        return '';
    }
    return path_1.default.basename(filePath);
}
/**
 * 检查文件大小是否在允许范围内
 * @param fileSize 文件大小（字节）
 */
function checkFileSize(fileSize) {
    if (!fileSize || fileSize <= 0) {
        throw new errors_1.ValidationError('无效的文件大小');
    }
    if (fileSize > MAX_FILE_SIZE) {
        throw new errors_1.ValidationError(`文件大小超过限制: ${fileSize} > ${MAX_FILE_SIZE} 字节 (${MAX_FILE_SIZE / 1024 / 1024} MB)`);
    }
}
/**
 * 检查文件是否是图片
 * @param mimeType 文件的MIME类型
 * @returns 是否是图片
 */
function isImageFile(mimeType) {
    return mimeType.startsWith('image/');
}
/**
 * 获取支持的文件扩展名列表
 * @returns 支持的文件扩展名数组
 */
function getSupportedFileExtensions() {
    return [
        'txt', 'doc', 'docx', 'xls', 'xlsx', 'csv',
        'json', 'xml', 'html', 'htm', 'md', 'pdf',
        'po', 'pot', 'srt', 'vtt', 'resx', 'resw'
    ];
}
/**
 * 获取文件扩展名对应的MIME类型
 * @param ext 文件扩展名
 * @returns MIME类型
 */
function getMimeTypeForExtension(ext) {
    const mimeTypes = {
        txt: 'text/plain',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xls: 'application/vnd.ms-excel',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        csv: 'text/csv',
        json: 'application/json',
        xml: 'application/xml',
        html: 'text/html',
        htm: 'text/html',
        md: 'text/markdown',
        pdf: 'application/pdf',
        po: 'text/x-gettext-translation',
        pot: 'text/x-gettext-translation-template',
        srt: 'application/x-subrip',
        vtt: 'text/vtt',
        resx: 'application/xml',
        resw: 'application/xml'
    };
    return mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
}
