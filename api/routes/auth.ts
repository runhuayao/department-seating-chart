import express, { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { db } from '../database/memory.js';
import { SystemLogDAO } from '../database/dao.js';
import { authenticateToken, generateToken } from '../middleware/auth.js';
import { requireRole, requirePermission, createRateLimitByRole } from '../middleware/authorization.js';

const router = express.Router();

// 应用频率限制中间件
router.use(createRateLimitByRole());

// 登录请求验证schema
const loginSchema = z.object({
  username: z.string().min(1, '用户名不能为空'),
  password: z.string().min(1, '密码不能为空')
});

// 注册请求验证schema
const registerSchema = z.object({
  username: z.string().min(3, '用户名至少3个字符').max(50, '用户名最多50个字符'),
  password: z.string().min(6, '密码至少6个字符'),
  email: z.string().email('邮箱格式不正确'),
  employee_id: z.number().optional(),
  role: z.enum(['admin', 'manager', 'employee']).default('employee')
});

/**
 * 用户登录
 * POST /api/auth/login
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: '请求参数错误',
        errors: validation.error.errors
      });
    }

    const { username, password } = validation.data;
    
    // 查询用户
    const result = await db.query({
      text: `
        SELECT u.*, e.name as employee_name, e.department_id
        FROM users u
        LEFT JOIN employees e ON u.employee_id = e.id
        WHERE u.username = $1 AND u.status = 'active'
      `,
      values: [username]
    });

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    const user = result.rows[0];
    
    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    // 获取用户权限信息
    const permissionsResult = await db.query({
      text: `
        SELECT ARRAY_AGG(DISTINCT p.permission_name) as permissions
        FROM role_permissions rp
        JOIN permissions p ON rp.permission_id = p.id
        WHERE rp.role_name = $1
      `,
      values: [user.role]
    });

    const permissions = permissionsResult.rows[0]?.permissions || [];

    // 生成JWT token
    const token = generateToken({
      id: user.id.toString(),
      username: user.username,
      role: user.role,
      permissions: permissions,
      employeeId: user.employee_id
    });

    // 更新最后登录时间
    await db.query({
      text: 'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
      values: [user.id]
    });

    // 记录登录日志
    await SystemLogDAO.log({
      user_id: user.id,
      action: 'login',
      resource_type: 'auth',
      resource_id: user.id.toString(),
      details: JSON.stringify({ username: user.username }),
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });
    
    // 更新最后登录时间
    await db.query({
      text: 'UPDATE users SET last_login_at = CURRENT_TIMESTAMP, last_login_ip = $1 WHERE id = $2',
      values: [req.ip, user.id]
    });
    
    // 返回用户信息和token（不包含密码）
    const userInfo = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      employee_id: user.employee_id,
      employee_name: user.employee_name,
      department_id: user.department_id,
      created_at: user.created_at,
      permissions: permissions,
      lastLoginAt: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: {
        user: userInfo,
        token,
        expires_in: 24 * 3600
      },
      message: '登录成功'
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

/**
 * 用户注册
 * POST /api/auth/register
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const validation = registerSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: '请求参数错误',
        errors: validation.error.errors
      });
    }

    const { username, password, email, employee_id, role } = validation.data;
    
    // 检查用户名是否已存在
    const existingUser = await db.query({
      text: 'SELECT id FROM users WHERE username = $1',
      values: [username]
    });
    
    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: '用户名已存在'
      });
    }
    
    // 检查邮箱是否已存在
    const existingEmail = await db.query({
      text: 'SELECT id FROM users WHERE email = $1',
      values: [email]
    });
    
    if (existingEmail.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: '邮箱已被使用'
      });
    }
    
    // 如果指定了员工ID，检查员工是否存在
    if (employee_id) {
      const employee = await db.query({
        text: 'SELECT id FROM employees WHERE id = $1',
        values: [employee_id]
      });
      
      if (employee.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: '指定的员工不存在'
        });
      }
    }
    
    // 加密密码
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // 创建用户
    const result = await db.query({
      text: `
        INSERT INTO users (username, password_hash, email, employee_id, role)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, username, email, role, employee_id, created_at
      `,
      values: [username, passwordHash, email, employee_id, role]
    });
    
    const newUser = result.rows[0];
    
    // 记录注册日志
    await SystemLogDAO.log({
      user_id: newUser.id,
      action: 'register',
      resource_type: 'auth',
      resource_id: newUser.id.toString(),
      details: JSON.stringify({ username: newUser.username, role: newUser.role }),
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });
    
    res.status(201).json({
      success: true,
      data: {
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          role: newUser.role,
          employee_id: newUser.employee_id,
          created_at: newUser.created_at
        }
      },
      message: '注册成功'
    });
  } catch (error) {
    console.error('注册失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

/**
 * 验证token
 * GET /api/auth/verify
 */
router.get('/verify', authenticateToken, async (req: Request, res: Response) => {
  try {
    // 中间件已经验证了token并设置了req.user
    if (!(req as any).user) {
      return res.status(401).json({
        success: false,
        message: '用户信息获取失败'
      });
    }

    res.json({
      success: true,
      message: 'Token有效',
      data: {
        user: {
          id: (req as any).user.userId,
          username: (req as any).user.username,
          role: (req as any).user.role,
          employeeId: (req as any).user.employeeId,
          departmentId: (req as any).user.departmentId,
          permissions: (req as any).user.permissions
        }
      }
    });
  } catch (error) {
    console.error('Token验证失败:', error);
    res.status(401).json({
      success: false,
      message: 'Token验证失败'
    });
  }
});

// 获取用户权限列表
router.get('/permissions', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    res.json({
      success: true,
      message: '权限获取成功',
      data: {
        permissions: user.permissions,
        role: user.role
      }
    });
  } catch (error) {
    console.error('权限获取失败:', error);
    res.status(500).json({
      success: false,
      message: '权限获取失败'
    });
  }
});

// 获取所有角色列表（仅管理员）
router.get('/roles', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const result = await db.query({
      text: `
        SELECT DISTINCT role_name, description
        FROM role_permissions rp
        LEFT JOIN roles r ON rp.role_name = r.name
        ORDER BY role_name
      `
    });

    res.json({
      success: true,
      message: '角色列表获取成功',
      data: {
        roles: result.rows
      }
    });
  } catch (error) {
    console.error('角色列表获取失败:', error);
    res.status(500).json({
      success: false,
      message: '角色列表获取失败'
    });
  }
});

// 获取角色权限详情（仅管理员）
router.get('/roles/:roleName/permissions', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { roleName } = req.params;
    
    const result = await db.query({
      text: `
        SELECT p.id, p.permission_name, p.description, p.category
        FROM role_permissions rp
        JOIN permissions p ON rp.permission_id = p.id
        WHERE rp.role_name = $1
        ORDER BY p.category, p.permission_name
      `,
      values: [roleName]
    });

    res.json({
      success: true,
      message: '角色权限获取成功',
      data: {
        role: roleName,
        permissions: result.rows
      }
    });
  } catch (error) {
    console.error('角色权限获取失败:', error);
    res.status(500).json({
      success: false,
      message: '角色权限获取失败'
    });
  }
});

// 修改用户角色（仅超级管理员）
router.put('/users/:userId/role', authenticateToken, requireRole(['super_admin']), async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    const currentUser = (req as any).user;

    if (!role) {
      return res.status(400).json({
        success: false,
        message: '角色参数缺失'
      });
    }

    // 验证角色是否存在
    const roleCheck = await db.query({
      text: 'SELECT name FROM roles WHERE name = $1',
      values: [role]
    });

    if (roleCheck.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: '无效的角色'
      });
    }

    // 不能修改自己的角色
    if (parseInt(userId) === currentUser.userId) {
      return res.status(400).json({
        success: false,
        message: '不能修改自己的角色'
      });
    }

    // 更新用户角色
    await db.query({
      text: 'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2',
      values: [role, userId]
    });

    // 记录操作日志
    await logActivity(currentUser.userId, 'role_change', `修改用户${userId}的角色为${role}`, req.ip);

    res.json({
      success: true,
      message: '用户角色修改成功'
    });
  } catch (error) {
    console.error('用户角色修改失败:', error);
    res.status(500).json({
      success: false,
      message: '用户角色修改失败'
    });
  }
});

// 用户登出
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    // 记录登出日志
    await logActivity(user.userId, 'logout', '用户登出', req.ip);

    res.json({
      success: true,
      message: '登出成功'
    });
  } catch (error) {
    console.error('登出失败:', error);
    res.status(500).json({
      success: false,
      message: '登出失败'
    });
  }
});

// 修改密码
router.put('/password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = (req as any).user;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: '当前密码和新密码不能为空'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: '新密码长度至少6位'
      });
    }

    // 获取用户当前密码
    const userResult = await db.query({
      text: 'SELECT password FROM users WHERE id = $1',
      values: [user.userId]
    });

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 验证当前密码
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, userResult.rows[0].password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: '当前密码错误'
      });
    }

    // 加密新密码
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // 更新密码
    await db.query({
      text: 'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
      values: [hashedNewPassword, user.userId]
    });

    // 记录操作日志
    await logActivity(user.userId, 'password_change', '用户修改密码', req.ip);

    res.json({
      success: true,
      message: '密码修改成功'
    });
  } catch (error) {
    console.error('密码修改失败:', error);
    res.status(500).json({
      success: false,
      message: '密码修改失败'
    });
  }
});

export default router;