// 用户认证路由
// 基于M1用户认证与授权系统设计方案

import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database';
import { authenticateToken, auditLogger } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';

const router = express.Router();

// 用户注册
router.post('/register', auditLogger('user_register'), async (req, res) => {
  const { username, email, password, employeeNumber, departmentId, fullName } = req.body;
  
  // 输入验证
  if (!username || !email || !password) {
    return res.status(400).json({ 
      success: false,
      message: '用户名、邮箱和密码为必填项',
      code: 'MISSING_REQUIRED_FIELDS'
    });
  }

  // 密码强度验证
  if (password.length < 6) {
    return res.status(400).json({ 
      success: false,
      message: '密码长度至少为6位',
      code: 'PASSWORD_TOO_SHORT'
    });
  }
  
  try {
    // 检查用户是否已存在
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ 
        success: false,
        message: '用户名或邮箱已存在',
        code: 'USER_ALREADY_EXISTS'
      });
    }
    
    // 验证部门是否存在
    if (departmentId) {
      const departmentResult = await pool.query(
        'SELECT id FROM departments WHERE id = $1',
        [departmentId]
      );
      
      if (departmentResult.rows.length === 0) {
        return res.status(400).json({ 
          success: false,
          message: '指定的部门不存在',
          code: 'DEPARTMENT_NOT_FOUND'
        });
      }
    }
    
    // 加密密码
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // 创建用户
    const result = await pool.query(
      `INSERT INTO users (
        username, email, password_hash, employee_number, 
        department_id, full_name, role, is_active, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'user', true, NOW()) 
      RETURNING id, username, email, full_name, employee_number, department_id`,
      [username, email, hashedPassword, employeeNumber, departmentId, fullName]
    );
    
    const newUser = result.rows[0];
    
    res.status(201).json({
      success: true,
      message: '注册成功',
      data: {
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          fullName: newUser.full_name,
          employeeNumber: newUser.employee_number,
          departmentId: newUser.department_id
        }
      }
    });
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ 
      success: false,
      message: '服务器内部错误',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// 用户登录
router.post('/login', auditLogger('user_login'), async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ 
      success: false,
      message: '用户名和密码为必填项',
      code: 'MISSING_CREDENTIALS'
    });
  }
  
  try {
    // 查询用户（包含部门信息）
    const userResult = await pool.query(
      `SELECT u.*, d.name as department_name 
       FROM users u 
       LEFT JOIN departments d ON u.department_id = d.id 
       WHERE u.username = $1 AND u.is_active = true`,
      [username]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ 
        success: false,
        message: '用户名或密码错误',
        code: 'INVALID_CREDENTIALS'
      });
    }
    
    const user = userResult.rows[0];
    
    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      // 记录登录失败
      await pool.query(
        'UPDATE users SET failed_login_attempts = failed_login_attempts + 1, last_failed_login = NOW() WHERE id = $1',
        [user.id]
      );
      
      return res.status(401).json({ 
        success: false,
        message: '用户名或密码错误',
        code: 'INVALID_CREDENTIALS'
      });
    }
    
    // 检查账户是否被锁定（连续失败5次）
    if (user.failed_login_attempts >= 5) {
      const lockoutTime = new Date(user.last_failed_login);
      lockoutTime.setMinutes(lockoutTime.getMinutes() + 30); // 锁定30分钟
      
      if (new Date() < lockoutTime) {
        return res.status(423).json({ 
          success: false,
          message: '账户已被锁定，请30分钟后重试',
          code: 'ACCOUNT_LOCKED',
          unlockTime: lockoutTime.toISOString()
        });
      }
    }
    
    // 生成JWT令牌
    const tokenPayload = {
      userId: user.id,
      username: user.username,
      role: user.role,
      departmentId: user.department_id
    };
    
    const accessToken = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: '24h' }
    );
    
    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_REFRESH_SECRET || 'default-refresh-secret',
      { expiresIn: '7d' }
    );
    
    // 更新登录信息
    await pool.query(
      `UPDATE users SET 
        last_login = NOW(), 
        failed_login_attempts = 0,
        refresh_token = $2
       WHERE id = $1`,
      [user.id, refreshToken]
    );
    
    // 返回用户信息和令牌
    res.json({
      success: true,
      message: '登录成功',
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          departmentId: user.department_id,
          departmentName: user.department_name,
          employeeNumber: user.employee_number,
          lastLogin: user.last_login
        }
      }
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ 
      success: false,
      message: '服务器内部错误',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// 刷新令牌
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(401).json({ 
      success: false,
      message: '刷新令牌缺失',
      code: 'REFRESH_TOKEN_MISSING'
    });
  }
  
  try {
    const decoded = jwt.verify(
      refreshToken, 
      process.env.JWT_REFRESH_SECRET || 'default-refresh-secret'
    ) as any;
    
    // 验证刷新令牌是否存在于数据库中
    const userResult = await pool.query(
      'SELECT * FROM users WHERE id = $1 AND refresh_token = $2 AND is_active = true',
      [decoded.userId, refreshToken]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ 
        success: false,
        message: '刷新令牌无效',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }
    
    const user = userResult.rows[0];
    
    // 生成新的访问令牌
    const newAccessToken = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        role: user.role,
        departmentId: user.department_id
      },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: '24h' }
    );
    
    res.json({
      success: true,
      message: '令牌刷新成功',
      data: {
        accessToken: newAccessToken
      }
    });
  } catch (error) {
    console.error('令牌刷新错误:', error);
    res.status(401).json({ 
      success: false,
      message: '刷新令牌无效或已过期',
      code: 'INVALID_REFRESH_TOKEN'
    });
  }
});

// 验证令牌
router.get('/verify', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userResult = await pool.query(
      `SELECT u.*, d.name as department_name 
       FROM users u 
       LEFT JOIN departments d ON u.department_id = d.id 
       WHERE u.id = $1`,
      [req.user!.id]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ 
        success: false,
        message: '用户不存在',
        code: 'USER_NOT_FOUND'
      });
    }
    
    const user = userResult.rows[0];
    res.json({
      success: true,
      message: '令牌验证成功',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          departmentId: user.department_id,
          departmentName: user.department_name,
          employeeNumber: user.employee_number
        }
      }
    });
  } catch (error) {
    console.error('令牌验证错误:', error);
    res.status(500).json({ 
      success: false,
      message: '服务器内部错误',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// 用户登出
router.post('/logout', authenticateToken, auditLogger('user_logout'), async (req: AuthRequest, res) => {
  try {
    // 清除刷新令牌
    await pool.query(
      'UPDATE users SET refresh_token = NULL WHERE id = $1',
      [req.user!.id]
    );
    
    res.json({
      success: true,
      message: '登出成功'
    });
  } catch (error) {
    console.error('登出错误:', error);
    res.status(500).json({ 
      success: false,
      message: '服务器内部错误',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// 修改密码
router.post('/change-password', authenticateToken, auditLogger('password_change'), async (req: AuthRequest, res) => {
  const { currentPassword, newPassword } = req.body;
  
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ 
      success: false,
      message: '当前密码和新密码为必填项',
      code: 'MISSING_PASSWORDS'
    });
  }
  
  if (newPassword.length < 6) {
    return res.status(400).json({ 
      success: false,
      message: '新密码长度至少为6位',
      code: 'PASSWORD_TOO_SHORT'
    });
  }
  
  try {
    // 获取当前用户信息
    const userResult = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user!.id]
    );
    
    const user = userResult.rows[0];
    
    // 验证当前密码
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false,
        message: '当前密码错误',
        code: 'INVALID_CURRENT_PASSWORD'
      });
    }
    
    // 加密新密码
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // 更新密码
    await pool.query(
      'UPDATE users SET password_hash = $1, password_changed_at = NOW() WHERE id = $2',
      [hashedNewPassword, req.user!.id]
    );
    
    res.json({
      success: true,
      message: '密码修改成功'
    });
  } catch (error) {
    console.error('密码修改错误:', error);
    res.status(500).json({ 
      success: false,
      message: '服务器内部错误',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// 重置密码请求（发送重置邮件）
router.post('/forgot-password', auditLogger('password_reset_request'), async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ 
      success: false,
      message: '邮箱地址为必填项',
      code: 'EMAIL_REQUIRED'
    });
  }
  
  try {
    const userResult = await pool.query(
      'SELECT id, username FROM users WHERE email = $1 AND is_active = true',
      [email]
    );
    
    // 无论用户是否存在都返回成功，防止邮箱枚举攻击
    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      
      // 生成重置令牌
      const resetToken = jwt.sign(
        { userId: user.id, type: 'password_reset' },
        process.env.JWT_SECRET || 'default-secret',
        { expiresIn: '1h' }
      );
      
      // 保存重置令牌到数据库
      await pool.query(
        'UPDATE users SET reset_token = $1, reset_token_expires = NOW() + INTERVAL \'1 hour\' WHERE id = $2',
        [resetToken, user.id]
      );
      
      // TODO: 发送重置邮件
      console.log(`密码重置链接: /reset-password?token=${resetToken}`);
    }
    
    res.json({
      success: true,
      message: '如果邮箱存在，重置链接已发送到您的邮箱'
    });
  } catch (error) {
    console.error('密码重置请求错误:', error);
    res.status(500).json({ 
      success: false,
      message: '服务器内部错误',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// 重置密码
router.post('/reset-password', auditLogger('password_reset'), async (req, res) => {
  const { token, newPassword } = req.body;
  
  if (!token || !newPassword) {
    return res.status(400).json({ 
      success: false,
      message: '重置令牌和新密码为必填项',
      code: 'MISSING_REQUIRED_FIELDS'
    });
  }
  
  if (newPassword.length < 6) {
    return res.status(400).json({ 
      success: false,
      message: '新密码长度至少为6位',
      code: 'PASSWORD_TOO_SHORT'
    });
  }
  
  try {
    // 验证重置令牌
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as any;
    
    if (decoded.type !== 'password_reset') {
      return res.status(400).json({ 
        success: false,
        message: '无效的重置令牌',
        code: 'INVALID_RESET_TOKEN'
      });
    }
    
    // 检查令牌是否存在且未过期
    const userResult = await pool.query(
      'SELECT id FROM users WHERE id = $1 AND reset_token = $2 AND reset_token_expires > NOW()',
      [decoded.userId, token]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: '重置令牌无效或已过期',
        code: 'INVALID_OR_EXPIRED_TOKEN'
      });
    }
    
    // 加密新密码
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // 更新密码并清除重置令牌
    await pool.query(
      `UPDATE users SET 
        password_hash = $1, 
        reset_token = NULL, 
        reset_token_expires = NULL,
        password_changed_at = NOW()
       WHERE id = $2`,
      [hashedPassword, decoded.userId]
    );
    
    res.json({
      success: true,
      message: '密码重置成功'
    });
  } catch (error) {
    console.error('密码重置错误:', error);
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(400).json({ 
        success: false,
        message: '重置令牌无效或已过期',
        code: 'INVALID_OR_EXPIRED_TOKEN'
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: '服务器内部错误',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

export default router;