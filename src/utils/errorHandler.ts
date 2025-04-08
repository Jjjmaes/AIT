import { 
  ValidationError, 
  ForbiddenError, 
  UnauthorizedError, 
  ConflictError
} from './errors';
import mongoose from 'mongoose';
import logger from './logger';

/**
 * 标准化服务错误，统一错误处理
 * @param error 原始错误
 * @param serviceName 服务名称
 * @param methodName 方法名称
 * @param entityName 实体名称
 * @throws 标准化的错误
 */
export function handleServiceError(error: unknown, serviceName: string, methodName: string, entityName?: string): never {
  // 记录错误日志
  logger.error(
    `Error in ${serviceName}.${methodName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    error instanceof Error ? error.stack : undefined
  );

  // 已经是标准化错误，直接抛出
  if (error instanceof ValidationError || 
      error instanceof UnauthorizedError || 
      error instanceof NotFoundError ||
      error instanceof ConflictError ||
      error instanceof ForbiddenError) {
    throw error;
  }

  // Mongoose验证错误
  if (error instanceof mongoose.Error.ValidationError) {
    const messages = Object.values(error.errors).map(err => err.message).join('; ');
    throw new ValidationError(`${entityName || '数据'}验证失败: ${messages}`);
  }

  // Mongoose重复键错误
  if (error instanceof Error && 'code' in error && error.code === 11000) {
    throw new ConflictError(`${entityName || '记录'}已存在`);
  }

  // 其他Mongoose错误
  if (error instanceof mongoose.Error) {
    throw new AppError(`数据库操作失败: ${error.message}`, 500);
  }

  // 通用错误
  if (error instanceof Error) {
    throw new AppError(`${serviceName}.${methodName} 失败: ${error.message}`, 500);
  }

  // 未知错误
  throw new AppError(`${serviceName}.${methodName} 发生未知错误`, 500);
}

/**
 * 验证MongoDB ID是否有效
 * @param id 要验证的ID
 * @param entityName 实体名称(用于错误消息)
 * @throws ValidationError 如果ID无效
 */
export function validateId(id: string | mongoose.Types.ObjectId, entityName: string): void {
  if (!id) {
    throw new ValidationError(`缺少${entityName}ID`);
  }

  if (typeof id === 'string' && !mongoose.Types.ObjectId.isValid(id)) {
    throw new ValidationError(`无效的${entityName}ID格式`);
  }
}

/**
 * 验证实体是否存在
 * @param entity 要验证的实体
 * @param entityName 实体名称(用于错误消息)
 * @throws NotFoundError 如果实体不存在
 */
export function validateEntityExists<T>(entity: T | null, entityName: string): asserts entity is T {
  if (!entity) {
    throw new NotFoundError(`${entityName}不存在`);
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
export function wrapServiceMethod<T>(
  fn: (...args: any[]) => Promise<T>,
  serviceName: string,
  methodName: string,
  entityName?: string
): (...args: any[]) => Promise<T> {
  return async (...args: any[]): Promise<T> => {
    try {
      return await fn(...args);
    } catch (error) {
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
export function validateOwnership(
  ownerId: string | mongoose.Types.ObjectId,
  requesterId: string | mongoose.Types.ObjectId,
  entityName: string,
  allowAdmin = true,
  requesterRoles: string[] = []
): void {
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
  throw new ForbiddenError(`您没有权限访问此${entityName}`);
}

/**
 * 检查当前环境是否为测试环境
 * @returns 如果是测试环境返回true，否则返回false
 */
export function isTestEnvironment(): boolean {
  return process.env.NODE_ENV === 'test';
}

// Export NotFoundError class
export class NotFoundError extends Error {
  constructor(message: string = '资源未找到') {
    super(message);
    this.name = 'NotFoundError';
  }
}

// Export AppError class
export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    // Ensure the prototype chain is correct
    Object.setPrototypeOf(this, AppError.prototype);
  }
} 