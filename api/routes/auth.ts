import express, { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { getSqliteConnection } from '../database/sqlite-connection.js';
const db = getSqliteConnection();
import { SystemLogDAO } from '../database/dao.js';
import { authenticateToken, generateToken } from '../middleware/auth.js';

const router = express.Router();

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
    const result = await db.query(`
      SELECT u.*, e.name as employee_name, e.department
      FROM users u
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE u.username = ? AND u.status = 'active'
    `, [username]);

    if (result.length === 0) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    const user = result[0];
    
    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    // 生成JWT token
    const token = generateToken({
      id: user.id.toString(),
      username: user.username,
      role: user.role
    });

    // 更新最后登录时间
    await db.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

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
    
    // 返回用户信息和token（不包含密码）
    const userInfo = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      employee_id: user.employee_id,
      employee_name: user.employee_name,
      department_id: user.department_id,
      created_at: user.created_at
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
    const userId = (req as any).user?.userId;
    
    const result = await db.query({
      text: `
        SELECT u.id, u.username, u.email, u.role, u.employee_id, u.created_at,
               e.name as employee_name, e.department_id
        FROM users u
        LEFT JOIN employees e ON u.employee_id = e.id
        WHERE u.id = $1 AND u.status = 'active'
      `,
      values: [userId]
    });

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: '用户不存在或已被禁用'
      });
    }

    const user = result.rows[0];
    
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          employee_id: user.employee_id,
          employee_name: user.employee_name,
          department_id: user.department_id,
          created_at: user.created_at
        }
      },
      message: 'Token验证成功'
    });
  } catch (error) {
    console.error('Token验证失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

export default router;