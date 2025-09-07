import express from 'express';
import { z } from 'zod';
import { db } from '../database/memory.js';
import { authenticateToken, requireUserOrAdmin, rateLimit } from '../middleware/auth.js';

const router = express.Router();

// 应用频率限制和认证
router.use(rateLimit(100, 15 * 60 * 1000)); // 每15分钟最多100次搜索请求
router.use(authenticateToken); // 所有搜索API都需要认证
router.use(requireUserOrAdmin); // 需要用户或管理员权限

// 搜索验证schema
const searchSchema = z.object({
  query: z.string().min(1, '搜索关键词不能为空'),
  type: z.enum(['all', 'employee', 'workstation']).optional().default('all'),
  department: z.string().optional()
});

// 搜索接口
router.get('/', async (req, res) => {
  try {
    const validation = searchSchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: '参数验证失败',
        errors: validation.error.errors
      });
    }

    const { query, type, department } = validation.data;
    const searchResults = {
      employees: [],
      workstations: [],
      total: 0
    };

    // 搜索员工
    if (type === 'all' || type === 'employee') {
      let employeeQuery = `
        SELECT e.*, d.name as department_name 
        FROM employees e 
        LEFT JOIN departments d ON e.department_id = d.id 
        WHERE (e.name LIKE ? OR e.email LIKE ? OR e.position LIKE ?)
      `;
      const params = [`%${query}%`, `%${query}%`, `%${query}%`];
      
      if (department) {
        employeeQuery += ' AND d.name = ?';
        params.push(department);
      }
      
      employeeQuery += ' ORDER BY e.name LIMIT 20';
      
      const employees = await db.query(employeeQuery, params);
      searchResults.employees = employees;
    }

    // 搜索工位
    if (type === 'all' || type === 'workstation') {
      let workstationQuery = `
        SELECT w.*, d.name as department_name 
        FROM workstations w 
        LEFT JOIN departments d ON w.department_id = d.id 
        WHERE (w.name LIKE ? OR w.ip_address LIKE ? OR w.username LIKE ? OR w.description LIKE ?)
      `;
      const params = [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`];
      
      if (department) {
        workstationQuery += ' AND d.name = ?';
        params.push(department);
      }
      
      workstationQuery += ' ORDER BY w.name LIMIT 20';
      
      const workstations = await db.query(workstationQuery, params);
      searchResults.workstations = workstations;
    }

    searchResults.total = searchResults.employees.length + searchResults.workstations.length;

    // 记录搜索日志
    await db.query(
      'INSERT INTO system_logs (action, details, ip_address, created_at) VALUES (?, ?, ?, ?)',
      [
        'search',
        JSON.stringify({ query, type, department, results_count: searchResults.total }),
        req.ip || 'unknown',
        new Date().toISOString()
      ]
    );

    res.json({
      success: true,
      data: searchResults,
      message: `找到 ${searchResults.total} 条结果`
    });

  } catch (error) {
    console.error('搜索时出错:', error);
    res.status(500).json({
      success: false,
      message: '搜索失败，请稍后重试'
    });
  }
});

// 获取搜索建议
router.get('/suggestions', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || typeof query !== 'string' || query.length < 2) {
      return res.json({
        success: true,
        data: { suggestions: [] }
      });
    }

    // 获取员工姓名建议
    const employeeNames = await db.query(
      'SELECT DISTINCT name FROM employees WHERE name LIKE ? LIMIT 5',
      [`%${query}%`]
    );

    // 获取工位名称建议
    const workstationNames = await db.query(
      'SELECT DISTINCT name FROM workstations WHERE name LIKE ? LIMIT 5',
      [`%${query}%`]
    );

    // 获取部门名称建议
    const departmentNames = await db.query(
      'SELECT DISTINCT name FROM departments WHERE name LIKE ? LIMIT 3',
      [`%${query}%`]
    );

    const suggestions = [
      ...employeeNames.map((item: any) => ({ type: 'employee', value: item.name })),
      ...workstationNames.map((item: any) => ({ type: 'workstation', value: item.name })),
      ...departmentNames.map((item: any) => ({ type: 'department', value: item.name }))
    ];

    res.json({
      success: true,
      data: { suggestions: suggestions.slice(0, 10) }
    });

  } catch (error) {
    console.error('获取搜索建议时出错:', error);
    res.status(500).json({
      success: false,
      message: '获取建议失败'
    });
  }
});

export default router;