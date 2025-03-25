import { Response } from 'express';
import { ApiError } from './apiError';

export const handleError = (error: any, res: Response) => {
  console.error('Error:', error);

  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message
    });
  }

  // 处理 Mongoose 验证错误
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: Object.values(error.errors).map((err: any) => err.message).join(', ')
    });
  }

  // 处理 Mongoose 重复键错误
  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message: '数据已存在'
    });
  }

  // 处理其他错误
  return res.status(500).json({
    success: false,
    message: '服务器内部错误'
  });
}; 