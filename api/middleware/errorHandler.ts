// 统一错误处理中间件
import { Request, Response, NextFunction } from 'express';

// 错误类型定义
export class APIError extends Error {
  public statusCode: number;
  public code: string;
  public details?: any;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR', details?: any) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

// 预定义错误类
export class ValidationError extends APIError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends APIError {
  constructor(message: string = '认证失败') {
    super(message, 401, 'AUTHENTICATION_FAILED');
  }
}

export class AuthorizationError extends APIError {
  constructor(message: string = '权限不足') {
    super(message, 403, 'PERMISSION_DENIED');
  }
}

export class NotFoundError extends APIError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} (ID: ${id}) 不存在` : `${resource} 不存在`;
    super(message, 404, 'RESOURCE_NOT_FOUND', { resource, id });
  }
}

export class ConflictError extends APIError {
  constructor(message: string, details?: any) {
    super(message, 409, 'RESOURCE_CONFLICT', details);
  }
}

export class RateLimitError extends APIError {
  constructor(message: string = '请求频率超限') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

// 生成请求ID
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 统一错误响应格式
function formatErrorResponse(error: any, requestId: string) {
  const timestamp = new Date().toISOString();

  // 如果是自定义API错误
  if (error instanceof APIError) {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      },
      timestamp,
      requestId
    };
  }

  // 数据库错误
  if (error.code === '23505') { // PostgreSQL唯一约束违反
    return {
      success: false,
      error: {
        code: 'DUPLICATE_RESOURCE',
        message: '资源已存在',
        details: { constraint: error.constraint }
      },
      timestamp,
      requestId
    };
  }

  // JWT错误
  if (error.name === 'JsonWebTokenError') {
    return {
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Token无效',
        details: { reason: error.message }
      },
      timestamp,
      requestId
    };
  }

  // 默认服务器错误
  return {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production' ? '服务器内部错误' : error.message,
      details: process.env.NODE_ENV === 'development' ? { stack: error.stack } : undefined
    },
    timestamp,
    requestId
  };
}

// 错误处理中间件
export const errorHandler = (error: any, req: Request, res: Response, next: NextFunction) => {
  const requestId = generateRequestId();
  
  // 记录错误日志
  console.error(`[${requestId}] API错误:`, {
    method: req.method,
    url: req.url,
    error: error.message,
    stack: error.stack,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });

  // 格式化错误响应
  const errorResponse = formatErrorResponse(error, requestId);
  
  // 设置状态码
  const statusCode = error instanceof APIError ? error.statusCode : 500;
  
  res.status(statusCode).json(errorResponse);
};

// 404处理中间件
export const notFoundHandler = (req: Request, res: Response) => {
  const requestId = generateRequestId();
  
  res.status(404).json({
    success: false,
    error: {
      code: 'ENDPOINT_NOT_FOUND',
      message: 'API端点不存在',
      details: {
        method: req.method,
        path: req.path
      }
    },
    timestamp: new Date().toISOString(),
    requestId
  });
};

// 异步错误包装器
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 请求日志中间件
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const requestId = generateRequestId();
  
  // 添加请求ID到响应头
  res.setHeader('X-Request-ID', requestId);
  
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    
    console.log(`[${requestId}] ${req.method} ${req.url} - ${res.statusCode} - ${responseTime}ms`);
    
    // 记录慢请求
    if (responseTime > 1000) {
      console.warn(`🐌 慢请求告警: ${req.method} ${req.url} - ${responseTime}ms`);
    }
  });
  
  next();
};

export default {
  APIError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
  requestLogger
};