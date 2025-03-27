"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processFile = processFile;
const file_model_1 = require("../models/file.model");
const segment_model_1 = require("../models/segment.model");
const errors_1 = require("./errors");
async function processFile(content, fileType, options = {}) {
    if (!content) {
        throw new errors_1.ValidationError('文件内容不能为空');
    }
    const { maxSegmentLength = 1000, minSegmentLength = 100, preserveFormatting = true } = options;
    if (maxSegmentLength < minSegmentLength) {
        throw new errors_1.ValidationError('最大段落长度不能小于最小段落长度');
    }
    let segments = [];
    switch (fileType) {
        case file_model_1.FileType.TXT:
            segments = processTextFile(content, maxSegmentLength, minSegmentLength, preserveFormatting);
            break;
        case file_model_1.FileType.JSON:
            try {
                segments = processJsonFile(content, maxSegmentLength, minSegmentLength);
            }
            catch (error) {
                throw new errors_1.ValidationError('JSON格式不正确');
            }
            break;
        case file_model_1.FileType.MD:
            segments = processMarkdownFile(content, maxSegmentLength, minSegmentLength, preserveFormatting);
            break;
        default:
            throw new errors_1.ValidationError(`不支持的文件类型: ${fileType}`);
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
