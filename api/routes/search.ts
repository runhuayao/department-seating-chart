import express from 'express';
import { z } from 'zod';
import dbManager from '../config/database.js';
import { authenticateToken, requireUserOrAdmin, rateLimiter } from '../middleware/auth.js';

const router = express.Router();

// 应用频率限制（移除认证要求以支持无登录搜索）
router.use(rateLimiter(100, 15 * 60 * 1000)); // 每15分钟最多100次搜索请求
// 移除认证要求，允许无登录访问搜索功能
// router.use(authenticateToken); // 所有搜索API都需要认证
// router.use(requireUserOrAdmin); // 需要用户或管理员权限

// 搜索验证schema
const searchSchema = z.object({
  q: z.string().min(1, '搜索关键词不能为空').optional(),
  query: z.string().min(1, '搜索关键词不能为空').optional(),
  type: z.enum(['all', 'employee', 'workstation']).optional().default('all'),
  department: z.string().optional()
}).refine(data => data.q || data.query, {
  message: '必须提供搜索关键词 (q 或 query 参数)'
});

// 搜索接口
router.get('/', async (req, res) => {
  try {
    const validation = searchSchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: '参数验证失败',
        errors: validation.error.issues
      });
    }

    const { q, query, type, department } = validation.data;
    const searchQuery = q || query; // 兼容前端发送的'q'参数和'query'参数
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
        WHERE 1=1
      `;
      const params: any[] = [];
      
      if (searchQuery) {
        employeeQuery += ' AND (e.name ILIKE $1 OR e.employee_id ILIKE $1)';
        params.push(`%${searchQuery}%`);
      }
      
      if (department) {
        employeeQuery += ' AND d.name = $2';
        params.push(department);
      }
      
      employeeQuery += ' ORDER BY e.id LIMIT 10'
      
      const employees = await dbManager.query(employeeQuery, params);
      searchResults.employees = employees.rows;
    }

    // 搜索工位 - 同时搜索desks表和workstations表
    if (type === 'all' || type === 'workstation') {
      // 搜索desks表中的工位
      let deskQuery = `
        SELECT d.*, dept.name as department_name, 
               e.name as employee_name, e.employee_number as employee_code,
               d.desk_number as name
        FROM desks d 
        LEFT JOIN departments dept ON d.department_id = dept.id
        LEFT JOIN desk_assignments da ON d.id = da.desk_id AND da.status = 'active'
        LEFT JOIN employees e ON da.employee_id = e.id
        WHERE (d.desk_number ILIKE $1 OR d.equipment::text ILIKE $2 OR e.name ILIKE $3)
      `;
      const deskParams = [`%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`];
      
      if (department) {
        deskQuery += ' AND dept.name = $4';
        deskParams.push(department);
      }
      
      deskQuery += ' ORDER BY d.desk_number LIMIT 10';
      
      const desks = await dbManager.query(deskQuery, deskParams);
      
      // 搜索workstations表中的工位（新增工位）
      let workstationQuery = `
        SELECT w.id, w.name, w.department, w.status, w.assigned_user as assignedUser,
               w.ip_address, w.location, w.created_at, w.updated_at,
               w.department as department_name, w.assigned_user as employee_name
        FROM workstations w
        WHERE (w.name ILIKE $1 OR w.assigned_user ILIKE $2 OR w.department ILIKE $3)
      `;
      const workstationParams = [`%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`];
      
      if (department) {
        workstationQuery += ' AND w.department = $4';
        workstationParams.push(department);
      }
      
      workstationQuery += ' ORDER BY w.name LIMIT 10';
      
      const workstations = await dbManager.query(workstationQuery, workstationParams);
      
      // 合并两个表的结果
      searchResults.workstations = [...desks.rows, ...workstations.rows];
    }

    searchResults.total = searchResults.employees.length + searchResults.workstations.length;

    // 记录搜索日志
    try {
      await dbManager.query(
        'INSERT INTO system_logs (action, details, ip_address, created_at) VALUES ($1, $2, $3, $4)',
        [
          'search',
          JSON.stringify({ query: searchQuery, type, department, results_count: searchResults.total }),
          req.ip || 'unknown',
          new Date().toISOString()
        ]
      );
    } catch (logError) {
      console.warn('记录搜索日志失败:', logError);
    }

    const message = searchResults.total === 0 ? "未找到相关结果\n请尝试其他关键词" : `找到 ${searchResults.total} 条结果`;
    
    res.json({
      success: true,
      data: searchResults,
      message
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
    const employeeNames = await dbManager.query(
      'SELECT DISTINCT name FROM employees WHERE name ILIKE $1 LIMIT 5',
      [`%${query}%`]
    );

    // 获取工位名称建议
    const workstationNames = await dbManager.query(
      'SELECT DISTINCT desk_number FROM desks WHERE desk_number ILIKE $1 LIMIT 5',
      [`%${query}%`]
    );

    // 获取部门名称建议
    const departmentNames = await dbManager.query(
      'SELECT DISTINCT name FROM departments WHERE name ILIKE $1 LIMIT 3',
      [`%${query}%`]
    );

    const suggestions = [
      ...employeeNames.rows.map((item: any) => ({ type: 'employee', value: item.name })),
      ...workstationNames.rows.map((item: any) => ({ type: 'workstation', value: item.desk_number })),
      ...departmentNames.rows.map((item: any) => ({ type: 'department', value: item.name }))
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