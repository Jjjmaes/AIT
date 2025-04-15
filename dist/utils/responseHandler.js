"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSuccess = sendSuccess;
exports.sendPaginated = sendPaginated;
exports.sendError = sendError;
exports.controllerHandler = controllerHandler;
const errors_1 = require("./errors");
const logger_1 = __importDefault(require("./logger"));
/**
 * 发送成功响应
 *
 * @param res Express响应对象
 * @param data 响应数据
 * @param message 响应消息
 * @param statusCode HTTP状态码，默认200
 */
function sendSuccess(res, data, message = '操作成功', statusCode = 200) {
    const response = {
        success: true,
        status: 'success',
        message,
        data,
        timestamp: new Date().toISOString()
    };
    res.status(statusCode).json(response);
}
/**
 * 发送分页响应
 *
 * @param res Express响应对象
 * @param data 数据数组
 * @param pagination 分页信息
 * @param message 响应消息
 */
function sendPaginated(res, data, pagination, message = '查询成功') {
    const totalPages = Math.ceil(pagination.total / pagination.limit);
    const response = {
        success: true,
        status: 'success',
        message,
        data,
        pagination: {
            ...pagination,
            totalPages
        },
        timestamp: new Date().toISOString()
    };
    res.status(200).json(response);
}
/**
 * 发送错误响应
 *
 * @param res Express响应对象
 * @param error 错误对象
 */
function sendError(res, error) {
    let statusCode = 500;
    let errorMessage = '服务器内部错误';
    let errorData = undefined;
    if (error instanceof errors_1.AppError) {
        statusCode = error.statusCode;
        errorMessage = error.message;
    }
    else if (error instanceof Error) {
        errorMessage = error.message;
        errorData = {
            name: error.name,
            // 只在开发环境返回堆栈信息
            ...(process.env.NODE_ENV === 'development' ? { stack: error.stack } : {})
        };
    }
    // 记录错误，但对500错误记录更详细信息
    if (statusCode === 500) {
        logger_1.default.error(`服务器错误: ${errorMessage}`, { error });
    }
    else {
        logger_1.default.warn(`请求错误(${statusCode}): ${errorMessage}`);
    }
    const response = {
        success: false,
        status: statusCode >= 500 ? 'error' : 'fail',
        message: errorMessage,
        error: errorData,
        timestamp: new Date().toISOString()
    };
    res.status(statusCode).json(response);
}
/**
 * 标准化控制器处理程序
 * 封装控制器处理程序，统一处理异常
 *
 * @param handler 异步控制器处理函数
 * @returns 包装后的控制器处理函数
 */
function controllerHandler(handler) {
    return async (req, res, next) => {
        try {
            await handler(req, res, next);
        }
        catch (error) {
            sendError(res, error);
        }
    };
}
