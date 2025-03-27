"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileUploadConfig = void 0;
const errors_1 = require("../utils/errors");
exports.fileUploadConfig = {
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
        files: 1 // 一次只能上传一个文件
    },
    fileFilter: (req, file, cb) => {
        // 允许的文件类型
        const allowedMimes = [
            'text/plain',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/pdf',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/csv',
            'application/json',
            'text/markdown'
        ];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new errors_1.ValidationError('不支持的文件类型'));
        }
    }
};
