"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleError = void 0;
const errors_1 = require("./errors");
const handleError = (error, res) => {
    console.error('Error:', error);
    if (error instanceof errors_1.AppError) {
        return res.status(error.statusCode).json({
            success: false,
            status: error.status,
            message: error.message
        });
    }
    // 处理 Mongoose 验证错误
    if (error.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            status: 'fail',
            message: Object.values(error.errors).map((err) => err.message).join(', ')
        });
    }
    // 处理 Mongoose 重复键错误
    if (error.code === 11000) {
        return res.status(409).json({
            success: false,
            status: 'fail',
            message: '数据已存在'
        });
    }
    // 处理其他错误
    return res.status(500).json({
        success: false,
        status: 'error',
        message: '服务器内部错误'
    });
};
exports.handleError = handleError;
