"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processFile = processFile;
const file_model_1 = require("../models/file.model");
const segment_model_1 = require("../models/segment.model");
const errors_1 = require("./errors");
const logger_1 = __importDefault(require("./logger"));
async function processFile(content, fileType, options = {}) {
    if (!content) {
        throw new errors_1.ValidationError('文件内容不能为空');
    }
    const { maxSegmentLength = 1000, minSegmentLength = 100, preserveFormatting = true } = options;
    if (maxSegmentLength < minSegmentLength) {
        throw new errors_1.ValidationError('最大段落长度不能小于最小段落长度');
    }
    let segments = [];
    try {
        switch (fileType) {
            case file_model_1.FileType.TXT:
                segments = processTextFile(content, maxSegmentLength, minSegmentLength, preserveFormatting);
                break;
            case file_model_1.FileType.JSON:
                segments = processJsonFile(content, maxSegmentLength, minSegmentLength);
                break;
            case file_model_1.FileType.MD:
                segments = processMarkdownFile(content, maxSegmentLength, minSegmentLength, preserveFormatting);
                break;
            case file_model_1.FileType.DOCX:
                segments = processDocxFile(content, maxSegmentLength, minSegmentLength, preserveFormatting);
                break;
            case file_model_1.FileType.XLIFF:
                segments = processXliffFile(content, maxSegmentLength, minSegmentLength);
                break;
            case file_model_1.FileType.MEMOQ_XLIFF:
                segments = processMemoqXliffFile(content, maxSegmentLength, minSegmentLength);
                break;
            default:
                throw new errors_1.ValidationError(`不支持的文件类型: ${fileType}`);
        }
    }
    catch (error) {
        if (error instanceof errors_1.ValidationError) {
            throw error;
        }
        logger_1.default.error(`处理文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
        throw new errors_1.ValidationError(`处理文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
    if (segments.length === 0) {
        throw new errors_1.ValidationError('未找到可处理的文本段落');
    }
    return segments;
}
function processTextFile(content, maxLength, minLength, preserveFormatting) {
    const segments = [];
    const lines = content.split('\n');
    let currentSegment = '';
    let currentLength = 0;
    for (const line of lines) {
        if (preserveFormatting) {
            currentSegment += line + '\n';
        }
        else {
            currentSegment += line.trim() + ' ';
        }
        currentLength += line.length;
        if (currentLength >= maxLength) {
            if (currentSegment.length >= minLength) {
                segments.push({
                    content: currentSegment.trim(),
                    originalLength: currentLength,
                    translatedLength: 0,
                    status: segment_model_1.SegmentStatus.PENDING
                });
            }
            currentSegment = '';
            currentLength = 0;
        }
    }
    if (currentSegment.length >= minLength) {
        segments.push({
            content: currentSegment.trim(),
            originalLength: currentLength,
            translatedLength: 0,
            status: segment_model_1.SegmentStatus.PENDING
        });
    }
    return segments;
}
function processJsonFile(content, maxLength, minLength) {
    const segments = [];
    const json = JSON.parse(content);
    function processValue(value, path = []) {
        if (typeof value === 'string') {
            if (value.length >= minLength && value.length <= maxLength) {
                segments.push({
                    content: value,
                    originalLength: value.length,
                    translatedLength: 0,
                    status: segment_model_1.SegmentStatus.PENDING,
                    metadata: {
                        path: path.join('.')
                    }
                });
            }
        }
        else if (Array.isArray(value)) {
            value.forEach((item, index) => {
                processValue(item, [...path, index.toString()]);
            });
        }
        else if (typeof value === 'object' && value !== null) {
            Object.entries(value).forEach(([key, val]) => {
                processValue(val, [...path, key]);
            });
        }
    }
    processValue(json);
    return segments;
}
function processMarkdownFile(content, maxLength, minLength, preserveFormatting) {
    const segments = [];
    const blocks = content.split('\n\n');
    let currentSegment = '';
    let currentLength = 0;
    for (const block of blocks) {
        if (preserveFormatting) {
            currentSegment += block + '\n\n';
        }
        else {
            currentSegment += block.trim() + ' ';
        }
        currentLength += block.length;
        if (currentLength >= maxLength) {
            if (currentSegment.length >= minLength) {
                segments.push({
                    content: currentSegment.trim(),
                    originalLength: currentLength,
                    translatedLength: 0,
                    status: segment_model_1.SegmentStatus.PENDING
                });
            }
            currentSegment = '';
            currentLength = 0;
        }
    }
    if (currentSegment.length >= minLength) {
        segments.push({
            content: currentSegment.trim(),
            originalLength: currentLength,
            translatedLength: 0,
            status: segment_model_1.SegmentStatus.PENDING
        });
    }
    return segments;
}
function processDocxFile(content, maxLength, minLength, preserveFormatting) {
    try {
        // 注意：在实际环境中，需要使用适当的库来解析 docx 文件
        // 这里只是一个简化的实现，实际应用中应替换为真实的 docx 解析逻辑
        logger_1.default.info('处理 DOCX 文件');
        // 由于是 Buffer 转换成的 string，这里我们将其当作纯文本处理
        return processTextFile(content, maxLength, minLength, preserveFormatting);
    }
    catch (error) {
        logger_1.default.error(`解析 DOCX 文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
        throw new errors_1.ValidationError('解析 DOCX 文件失败，请确保文件格式正确');
    }
}
function processXliffFile(content, maxLength, minLength) {
    try {
        // 注意：在实际环境中，需要使用适当的库来解析 XLIFF 文件
        // 这里只是一个简化的实现，应替换为真实的 XLIFF 解析逻辑
        logger_1.default.info('处理 XLIFF 文件');
        // 简单实现：查找 <source> 标签内的内容
        const segments = [];
        const sourceRegex = /<source>([\s\S]*?)<\/source>/g;
        let match;
        while ((match = sourceRegex.exec(content)) !== null) {
            const sourceText = match[1].trim();
            if (sourceText.length >= minLength && sourceText.length <= maxLength) {
                segments.push({
                    content: sourceText,
                    originalLength: sourceText.length,
                    translatedLength: 0,
                    status: segment_model_1.SegmentStatus.PENDING,
                    metadata: {
                        path: `xliff.source.${segments.length}`
                    }
                });
            }
        }
        return segments;
    }
    catch (error) {
        logger_1.default.error(`解析 XLIFF 文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
        throw new errors_1.ValidationError('解析 XLIFF 文件失败，请确保文件格式正确');
    }
}
function processMemoqXliffFile(content, maxLength, minLength) {
    try {
        // MemoQ XLIFF 是 XLIFF 的特定变体，可能有特殊处理
        // 这里为简化实现，我们复用 XLIFF 处理逻辑
        logger_1.default.info('处理 MemoQ XLIFF 文件');
        return processXliffFile(content, maxLength, minLength);
    }
    catch (error) {
        logger_1.default.error(`解析 MemoQ XLIFF 文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
        throw new errors_1.ValidationError('解析 MemoQ XLIFF 文件失败，请确保文件格式正确');
    }
}
