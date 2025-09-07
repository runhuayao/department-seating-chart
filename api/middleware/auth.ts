import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

// JWT密钥 - 在生产环境中应该使用环境变量
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
console.log('🔑 JWT_SECRET loaded in auth middleware:', JWT_SECRET);

// 扩展Request接口以包含用户信息
interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    username: string;
    role: string;
  };
}

// 生成JWT令牌
export const generateToken = (user: { id: string; username: string; role: string }) => {
  console.log('🔑 Generating token with JWT_SECRET:', JWT_SECRET);
  const token = jwt.sign(
    {
      userId: user.id,
      username: user.username,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
  console.log('✅ Token generated:', token);
  return token;
};

// 验证JWT令牌中间件
export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: '访问令牌缺失' });
  }

  console.log('🔍 Verifying token:', token);
  console.log('🔑 Using JWT_SECRET for verification:', JWT_SECRET);
  
  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      console.log('❌ Token verification failed:', err.message);
      return res.status(403).json({ error: '令牌无效或已过期' });
    }
    console.log('✅ Token verified successfully:', user);
    req.user = user;
    next();
  });
};

// 角色权限验证中间件
export const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: '用户未认证' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: '权限不足' });
    }

    next();
  };
};

// 管理员权限验证
export const requireAdmin = requireRole(['admin']);

// 用户或管理员权限验证
export const requireUserOrAdmin = requireRole(['employee', 'manager', 'admin']);

// API密钥验证中间件（用于内部API调用）
export const validateApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'];
  const validApiKey = process.env.API_KEY || 'default-api-key-change-in-production';

  if (!apiKey || apiKey !== validApiKey) {
    return res.status(401).json({ error: 'API密钥无效' });
  }

  next();
};

// 请求频率限制中间件
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export const rateLimit = (maxRequests: number = 100, windowMs: number = 15 * 60 * 1000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    
    const clientData = requestCounts.get(clientIp);
    
    if (!clientData || now > clientData.resetTime) {
      // 重置或初始化计数
      requestCounts.set(clientIp, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }
    
    if (clientData.count >= maxRequests) {
      return res.status(429).json({
        error: '请求过于频繁，请稍后再试',
        retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
      });
    }
    
    clientData.count++;
    next();
  };
};

// 输入验证中间件
export const validateInput = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: '输入数据验证失败',
        details: error.details.map((detail: any) => detail.message)
      });
    }
    next();
  };
};

export { AuthenticatedRequest };