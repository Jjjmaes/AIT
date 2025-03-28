import { Response } from 'express';
import { AppError } from './errors';
import logger from './logger';

/**
 * 标准响应接口
 */
export interface ApiResponse<T> {
  success: boolean;
  status: string;
  message?: string;
  data?: T;
  error?: any;
  timestamp: string;
}

/**
 * 分页响应接口
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * 发送成功响应
 * 
 * @param res Express响应对象
 * @param data 响应数据
 * @param message 响应消息
 * @param statusCode HTTP状态码，默认200
 */
export function sendSuccess<T>(
  res: Response, 
  data: T, 
  message: string = '操作成功', 
  statusCode: number = 200
): void {
  const response: ApiResponse<T> = {
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
export function sendPaginated<T>(
  res: Response, 
  data: T[], 
  pagination: { total: number; page: number; limit: number; }, 
  message: string = '查询成功'
): void {
  const totalPages = Math.ceil(pagination.total / pagination.limit);
  
  const response: PaginatedResponse<T> = {
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
export function sendError(res: Response, error: unknown): void {
  let statusCode = 500;
  let errorMessage = '服务器内部错误';
  let errorData: any = undefined;
  
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    errorMessage = error.message;
  } else if (error instanceof Error) {
    errorMessage = error.message;
    errorData = {
      name: error.name,
      // 只在开发环境返回堆栈信息
      ...(process.env.NODE_ENV === 'development' ? { stack: error.stack } : {})
    };
  }
  
  // 记录错误，但对500错误记录更详细信息
  if (statusCode === 500) {
    logger.error(`服务器错误: ${errorMessage}`, { error });
  } else {
    logger.warn(`请求错误(${statusCode}): ${errorMessage}`);
  }
  
  const response: ApiResponse<null> = {
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
export function controllerHandler(handler: Function) {
  return async (req: any, res: Response, next: any) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      sendError(res, error);
    }
  };
} 