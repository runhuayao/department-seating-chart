import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import db from '../config/database.js';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
    username: string;
    role: string;
    permissions: string[];
    departmentId?: number;
    employeeId?: number;
  };
}

// JWT密钥
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * JWT Token验证中间件
 */
export const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '访问令牌缺失'
      });
    }

    // 验证token
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // 获取用户详细信息和权限
    const userResult = await db.query({
      text: `
        SELECT u.id, u.username, u.role, u.employee_id, u.status,
               e.department_id,
               ARRAY_AGG(DISTINCT p.permission_name) as permissions
        FROM users u
        LEFT JOIN employees e ON u.employee_id = e.id
        LEFT JOIN role_permissions rp ON u.role = rp.role_name
        LEFT JOIN permissions p ON rp.permission_id = p.id
        WHERE u.id = $1 AND u.status = 'active'
        GROUP BY u.id, u.username, u.role, u.employee_id, u.status, e.department_id
      `,
      values: [decoded.userId]
    });

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: '用户不存在或已被禁用'
      });
    }

    const user = userResult.rows[0];
    
    // 设置用户信息到请求对象
    req.user = {
      userId: user.id,
      username: user.username,
      role: user.role,
      permissions: user.permissions || [],
      departmentId: user.department_id,
      employeeId: user.employee_id
    };

    next();
  } catch (error) {
    console.error('Token验证失败:', error);
    return res.status(403).json({
      success: false,
      message: 'Token无效或已过期'
    });
  }
};

/**
 * 角色权限验证中间件
 * @param requiredRoles 允许的角色列表
 */
export const requireRole = (requiredRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '用户未认证'
      });
    }

    if (!requiredRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: '权限不足，需要角色: ' + requiredRoles.join(', ')
      });
    }

    next();
  };
};

/**
 * 权限验证中间件
 * @param requiredPermissions 需要的权限列表
 */
export const requirePermission = (requiredPermissions: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '用户未认证'
      });
    }

    const hasPermission = requiredPermissions.some(permission => 
      req.user!.permissions.includes(permission)
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: '权限不足，需要权限: ' + requiredPermissions.join(', ')
      });
    }

    next();
  };
};

/**
 * 部门权限验证中间件
 * 确保用户只能访问自己部门的数据
 */
export const requireDepartmentAccess = () => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '用户未认证'
      });
    }

    // 管理员可以访问所有部门
    if (req.user.role === 'admin' || req.user.role === 'super_admin') {
      return next();
    }

    // 从请求参数中获取部门ID
    const requestedDepartmentId = req.params.departmentId || req.query.departmentId || req.body.departmentId;
    
    if (requestedDepartmentId && req.user.departmentId) {
      if (parseInt(requestedDepartmentId) !== req.user.departmentId) {
        return res.status(403).json({
          success: false,
          message: '无权访问其他部门的数据'
        });
      }
    }

    next();
  };
};

/**
 * 资源所有权验证中间件
 * 确保用户只能修改自己的资源
 */
export const requireResourceOwnership = (resourceType: 'workstation' | 'employee' | 'user') => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '用户未认证'
      });
    }

    // 管理员可以修改所有资源
    if (req.user.role === 'admin' || req.user.role === 'super_admin') {
      return next();
    }

    try {
      const resourceId = req.params.id;
      if (!resourceId) {
        return res.status(400).json({
          success: false,
          message: '资源ID缺失'
        });
      }

      let query = '';
      let values: any[] = [];

      switch (resourceType) {
        case 'workstation':
          // 检查工位是否属于用户的部门
          query = `
            SELECT w.id FROM workstations w
            JOIN employees e ON w.employee_id = e.id
            WHERE w.id = $1 AND e.department_id = $2
          `;
          values = [resourceId, req.user.departmentId];
          break;
        
        case 'employee':
          // 检查员工是否属于用户的部门
          query = `
            SELECT id FROM employees
            WHERE id = $1 AND department_id = $2
          `;
          values = [resourceId, req.user.departmentId];
          break;
        
        case 'user':
          // 用户只能修改自己的信息
          if (parseInt(resourceId) !== req.user.userId) {
            return res.status(403).json({
              success: false,
              message: '无权修改其他用户的信息'
            });
          }
          return next();
      }

      const result = await db.query({ text: query, values });
      
      if (result.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: '无权访问该资源'
        });
      }

      next();
    } catch (error) {
      console.error('资源所有权验证失败:', error);
      return res.status(500).json({
        success: false,
        message: '权限验证失败'
      });
    }
  };
};

/**
 * 工位修改权限验证
 * 根据技术文档要求实现工位修改权限控制
 */
export const requireWorkstationModifyPermission = () => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '用户未认证'
      });
    }

    try {
      // 检查用户是否有工位修改权限
      const hasPermission = req.user.permissions.includes('workstation:modify') ||
                           req.user.permissions.includes('workstation:admin') ||
                           req.user.role === 'admin' ||
                           req.user.role === 'super_admin';

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: '无工位修改权限'
        });
      }

      // 如果是修改操作，还需要检查工位所有权
      if (req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE') {
        const workstationId = req.params.id;
        if (workstationId) {
          // 检查工位是否属于用户的部门（除非是管理员）
          if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
            const result = await db.query({
              text: `
                SELECT w.id FROM workstations w
                LEFT JOIN employees e ON w.employee_id = e.id
                WHERE w.id = $1 AND (e.department_id = $2 OR w.employee_id IS NULL)
              `,
              values: [workstationId, req.user.departmentId]
            });

            if (result.rows.length === 0) {
              return res.status(403).json({
                success: false,
                message: '无权修改其他部门的工位'
              });
            }
          }
        }
      }

      next();
    } catch (error) {
      console.error('工位权限验证失败:', error);
      return res.status(500).json({
        success: false,
        message: '权限验证失败'
      });
    }
  };
};

/**
 * API访问频率限制
 * 根据用户角色设置不同的访问频率限制
 */
export const createRateLimitByRole = () => {
  const userRequests = new Map<number, { count: number; resetTime: number }>();
  
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next();
    }

    const now = Date.now();
    const windowMs = 60 * 1000; // 1分钟窗口
    
    // 根据角色设置不同的限制
    let maxRequests = 60; // 默认每分钟60次
    switch (req.user.role) {
      case 'super_admin':
      case 'admin':
        maxRequests = 200;
        break;
      case 'manager':
        maxRequests = 120;
        break;
      case 'user':
        maxRequests = 60;
        break;
    }

    const userRecord = userRequests.get(req.user.userId);
    
    if (!userRecord || now > userRecord.resetTime) {
      // 重置计数器
      userRequests.set(req.user.userId, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }

    if (userRecord.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: '请求过于频繁，请稍后再试',
        retryAfter: Math.ceil((userRecord.resetTime - now) / 1000)
      });
    }

    userRecord.count++;
    next();
  };
};

export default {
  authenticateToken,
  requireRole,
  requirePermission,
  requireDepartmentAccess,
  requireResourceOwnership,
  requireWorkstationModifyPermission,
  createRateLimitByRole
};