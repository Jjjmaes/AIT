"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleServiceError = handleServiceError;
exports.validateId = validateId;
exports.validateEntityExists = validateEntityExists;
exports.wrapServiceMethod = wrapServiceMethod;
exports.validateOwnership = validateOwnership;
exports.isTestEnvironment = isTestEnvironment;
const errors_1 = require("./errors");
const mongoose_1 = __importDefault(require("mongoose"));
const logger_1 = __importDefault(require("./logger"));
// 如果ServiceError不存在，使用AppError代替
const ServiceError = errors_1.AppError;
/**
 * 标准化服务错误，统一错误处理
 * @param error 原始错误
 * @param serviceName 服务名称
 * @param methodName 方法名称
 * @param entityName 实体名称
 * @throws 标准化的错误
 */
function handleServiceError(error, serviceName, methodName, entityName) {
    // 记录错误日志
    logger_1.default.error(`Error in ${serviceName}.${methodName}: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
    // 已经是标准化错误，直接抛出
    if (error instanceof errors_1.ValidationError ||
        error instanceof errors_1.UnauthorizedError ||
        error instanceof errors_1.NotFoundError ||
        error instanceof errors_1.ConflictError ||
        error instanceof errors_1.ForbiddenError) {
        throw error;
    }
    // Mongoose验证错误
    if (error instanceof mongoose_1.default.Error.ValidationError) {
        const messages = Object.values(error.errors).map(err => err.message).join('; ');
        throw new errors_1.ValidationError(`${entityName || '数据'}验证失败: ${messages}`);
    }
    // Mongoose重复键错误
    if (error instanceof Error && 'code' in error && error.code === 11000) {
        throw new errors_1.ConflictError(`${entityName || '记录'}已存在`);
    }
    // 其他Mongoose错误
    if (error instanceof mongoose_1.default.Error) {
        throw new errors_1.AppError(`数据库操作失败: ${error.message}`, 500);
    }
    // 通用错误
    if (error instanceof Error) {
        throw new errors_1.AppError(`${serviceName}.${methodName} 失败: ${error.message}`, 500);
    }
    // 未知错误
    throw new errors_1.AppError(`${serviceName}.${methodName} 发生未知错误`, 500);
}
/**
 * 验证MongoDB ID是否有效
 * @param id 要验证的ID
 * @param entityName 实体名称(用于错误消息)
 * @throws ValidationError 如果ID无效
 */
function validateId(id, entityName) {
    if (!id) {
        throw new errors_1.ValidationError(`缺少${entityName}ID`);
    }
    if (typeof id === 'string' && !mongoose_1.default.Types.ObjectId.isValid(id)) {
        throw new errors_1.ValidationError(`无效的${entityName}ID格式`);
    }
}
/**
 * 验证实体是否存在
 * @param entity 要验证的实体
 * @param entityName 实体名称(用于错误消息)
 * @throws NotFoundError 如果实体不存在
 */
function validateEntityExists(entity, entityName) {
    if (!entity) {
        throw new errors_1.NotFoundError(`${entityName}不存在`);
    }
}
/**
 * 包装异步方法以统一处理错误
 * @param fn 要包装的异步方法
 * @param serviceName 服务名称
 * @param methodName 方法名称
 * @param entityName 实体名称
 * @returns 包装后的函数
 */
function wrapServiceMethod(fn, serviceName, methodName, entityName) {
    return async (...args) => {
        try {
            return await fn(...args);
        }
        catch (error) {
            throw handleServiceError(error, serviceName, methodName, entityName);
        }
    };
}
/**
 * 验证请求者是否有权限访问资源
 * @param ownerId 资源拥有者ID
 * @param requesterId 请求者ID
 * @param entityName 实体名称
 * @param allowAdmin 是否允许管理员访问
 * @param requesterRoles 请求者角色数组
 * @throws ForbiddenError 如果没有权限
 */
function validateOwnership(ownerId, requesterId, entityName, allowAdmin = true, requesterRoles = []) {
    const ownerIdStr = ownerId.toString();
    const requesterIdStr = requesterId.toString();
    // 如果请求者是所有者，直接通过
    if (ownerIdStr === requesterIdStr) {
        return;
    }
    // 如果允许管理员访问且请求者是管理员，通过
    if (allowAdmin && requesterRoles.includes('admin')) {
        return;
    }
    // 其他情况不允许访问
    throw new errors_1.ForbiddenError(`您没有权限访问此${entityName}`);
}
/**
 * 检查当前环境是否为测试环境
 * @returns 如果是测试环境返回true，否则返回false
 */
function isTestEnvironment() {
    return process.env.NODE_ENV === 'test';
}
