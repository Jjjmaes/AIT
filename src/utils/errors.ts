// ===== 第五步：创建错误处理工具 =====
// src/utils/errors.ts

export class AppError extends Error {
  statusCode: number;
  status: string;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = '未找到资源') {
    super(message, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = '未授权') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = '禁止访问') {
    super(message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = '资源冲突') {
    super(message, 409);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = '验证失败') {
    super(message, 400);
  }
}
