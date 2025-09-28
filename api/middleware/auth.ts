// 用户认证与授权中间件
// 基于M1用户认证与授权系统设计方案

import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/database';

// 扩展Request接口
interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: string;
    departmentId: number;
    email: string;
  };
}

// JWT验证中间件
export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false,
      message: '访问令牌缺失',
      code: 'TOKEN_MISSING'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as any;
    
    // 验证用户是否仍然存在且活跃
    const userResult = await pool.query(
      `SELECT u.id, u.username, u.role, u.department_id, u.email, u.is_active,
              d.name as department_name
       FROM users u 
       LEFT JOIN departments d ON u.department_id = d.id 
       WHERE u.id = $1 AND u.is_active = true`,
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ 
        success: false,
        message: '用户不存在或已被禁用',
        code: 'USER_INACTIVE'
      });
    }

    const user = userResult.rows[0];
    req.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      departmentId: user.department_id,
      email: user.email
    };

    // 设置数据库上下文（用于行级安全策略）
    await pool.query('SET app.current_user_id = $1', [user.id]);
    await pool.query('SET app.current_user_role = $1', [user.role]);
    await pool.query('SET app.current_department_id = $1', [user.department_id]);

    next();
  } catch (error) {
    console.error('Token验证错误:', error);
    return res.status(403).json({ 
      success: false,
      message: '令牌无效或已过期',
      code: 'TOKEN_INVALID'
    });
  }
};

// 角色权限验证中间件
export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        message: '用户未认证',
        code: 'USER_NOT_AUTHENTICATED'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false,
        message: '权限不足',
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredRoles: allowedRoles,
        userRole: req.user.role
      });
    }

    next();
  };
};

// 管理员权限验证
export const requireAdmin = requireRole(['admin', 'super_admin']);

// 部门管理员权限验证
export const requireDepartmentAdmin = requireRole(['admin', 'super_admin', 'department_admin']);

// 用户或管理员权限验证
export const requireUserOrAdmin = requireRole(['user', 'admin', 'super_admin', 'department_admin']);

// 部门访问权限验证
export const requireDepartmentAccess = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false,
      message: '用户未认证',
      code: 'USER_NOT_AUTHENTICATED'
    });
  }

  const requestedDepartmentId = parseInt(req.params.departmentId || req.body.departmentId);
  
  // 管理员可以访问所有部门
  if (['admin', 'super_admin'].includes(req.user.role)) {
    return next();
  }

  // 部门管理员和普通用户只能访问自己的部门
  if (req.user.departmentId !== requestedDepartmentId) {
    return res.status(403).json({ 
      success: false,
      message: '无权访问其他部门数据',
      code: 'DEPARTMENT_ACCESS_DENIED'
    });
  }

  next();
};

// 资源所有者权限验证
export const requireResourceOwner = (resourceType: 'user' | 'workstation') => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        message: '用户未认证',
        code: 'USER_NOT_AUTHENTICATED'
      });
    }

    // 管理员可以访问所有资源
    if (['admin', 'super_admin'].includes(req.user.role)) {
      return next();
    }

    const resourceId = parseInt(req.params.id);
    
    try {
      let query: string;
      let params: any[];

      switch (resourceType) {
        case 'user':
          // 用户只能修改自己的信息
          if (req.user.id !== resourceId) {
            return res.status(403).json({ 
              success: false,
              message: '只能修改自己的用户信息',
              code: 'USER_RESOURCE_ACCESS_DENIED'
            });
          }
          break;

        case 'workstation':
          // 检查工位是否属于用户的部门或分配给用户
          query = `
            SELECT id FROM workstations 
            WHERE id = $1 AND (
              department_id = $2 OR 
              assigned_user_id = $3
            )
          `;
          params = [resourceId, req.user.departmentId, req.user.id];
          
          const workstationResult = await pool.query(query, params);
          if (workstationResult.rows.length === 0) {
            return res.status(403).json({ 
              success: false,
              message: '无权访问此工位',
              code: 'WORKSTATION_ACCESS_DENIED'
            });
          }
          break;

        default:
          return res.status(400).json({ 
            success: false,
            message: '不支持的资源类型',
            code: 'UNSUPPORTED_RESOURCE_TYPE'
          });
      }

      next();
    } catch (error) {
      console.error('资源权限验证错误:', error);
      return res.status(500).json({ 
        success: false,
        message: '权限验证失败',
        code: 'PERMISSION_CHECK_ERROR'
      });
    }
  };
};

// API访问频率限制中间件
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export const rateLimiter = (maxRequests: number = 100, windowMs: number = 15 * 60 * 1000) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const key = req.user ? `user_${req.user.id}` : `ip_${req.ip}`;
    const now = Date.now();
    
    const userRequests = requestCounts.get(key);
    
    if (!userRequests || now > userRequests.resetTime) {
      requestCounts.set(key, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }
    
    if (userRequests.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: '请求过于频繁，请稍后再试',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((userRequests.resetTime - now) / 1000)
      });
    }
    
    userRequests.count++;
    next();
  };
};

// 审计日志中间件
export const auditLogger = (action: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // 记录审计日志
      if (req.user) {
        pool.query(
          `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [
            req.user.id,
            action,
            req.route?.path || req.path,
            req.params.id || null,
            req.ip,
            req.get('User-Agent')
          ]
        ).catch(error => {
          console.error('审计日志记录失败:', error);
        });
      }
      
      return originalSend.call(this, data);
    };
    
    next();
  };
};

// 权限检查辅助函数
export const hasPermission = (userRole: string, requiredPermissions: string[]): boolean => {
  const rolePermissions: Record<string, string[]> = {
    'super_admin': ['*'], // 超级管理员拥有所有权限
    'admin': [
      'user.create', 'user.read', 'user.update', 'user.delete',
      'department.create', 'department.read', 'department.update', 'department.delete',
      'workstation.create', 'workstation.read', 'workstation.update', 'workstation.delete',
      'system.monitor', 'system.config'
    ],
    'department_admin': [
      'user.read', 'user.update',
      'department.read',
      'workstation.read', 'workstation.update',
      'report.generate'
    ],
    'user': [
      'user.read.self', 'user.update.self',
      'workstation.read.department',
      'profile.update'
    ]
  };

  const permissions = rolePermissions[userRole] || [];
  
  // 超级管理员拥有所有权限
  if (permissions.includes('*')) {
    return true;
  }
  
  // 检查是否拥有所需权限
  return requiredPermissions.every(permission => permissions.includes(permission));
};

// 导出类型
export type { AuthRequest };