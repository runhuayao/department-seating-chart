import express from 'express';
import { z } from 'zod';
import { executeQuery } from '../config/database.js';
import { authenticateToken, requireUserOrAdmin, rateLimit } from '../middleware/auth.js';
import { generateSearchCache } from './search-cache.js';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();

// 缓存文件路径
const CACHE_DIR = path.join(process.cwd(), 'cache');
const SEARCH_CACHE_FILE = path.join(CACHE_DIR, 'search-data.json');

// 应用频率限制（移除认证要求以支持无登录搜索）
router.use(rateLimit(100, 15 * 60 * 1000)); // 每15分钟最多100次搜索请求
// 移除认证要求，允许无登录访问搜索功能
// router.use(authenticateToken); // 所有搜索API都需要认证
// router.use(requireUserOrAdmin); // 需要用户或管理员权限

// 搜索验证schema
const searchSchema = z.object({
  q: z.string().min(1, '搜索关键词不能为空'),
  query: z.string().min(1, '搜索关键词不能为空').optional(),
  type: z.enum(['all', 'employee', 'workstation']).optional().default('all'),
  department: z.string().optional()
});

// 获取缓存数据
async function getCachedSearchData() {
  try {
    const cacheContent = await fs.readFile(SEARCH_CACHE_FILE, 'utf8');
    const cacheData = JSON.parse(cacheContent);
    
    // 检查缓存是否过期（超过5分钟）
    const cacheAge = Date.now() - new Date(cacheData.lastUpdated).getTime();
    const isExpired = cacheAge > 5 * 60 * 1000;
    
    if (isExpired) {
      // 异步更新缓存
      generateSearchCache().then(async (newData) => {
        await fs.writeFile(SEARCH_CACHE_FILE, JSON.stringify(newData, null, 2), 'utf8');
      }).catch(console.error);
    }
    
    return cacheData;
  } catch (error) {
    // 缓存不存在或损坏，重新生成
    console.log('缓存文件不存在，重新生成...');
    const newData = await generateSearchCache();
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(SEARCH_CACHE_FILE, JSON.stringify(newData, null, 2), 'utf8');
    return newData;
  }
}

// 搜索接口 - 使用缓存数据实现跨部门搜索
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

    const { q, query, type, department } = validation.data;
    const searchQuery = (q || query || '').toLowerCase().trim();
    
    // 获取缓存数据
    const cacheData = await getCachedSearchData();
    
    const searchResults = {
      employees: [],
      workstations: [],
      departments: [],
      total: 0
    };

    // 搜索员工
    if (type === 'all' || type === 'employee') {
      let employees = cacheData.employees || [];
      
      if (searchQuery) {
        employees = employees.filter((emp: any) => 
          (emp.searchText && emp.searchText.includes(searchQuery)) ||
          (emp.name && emp.name.toLowerCase().includes(searchQuery)) ||
          (emp.employee_id && emp.employee_id.toLowerCase().includes(searchQuery)) ||
          (emp.position && emp.position.toLowerCase().includes(searchQuery)) ||
          (emp.department && emp.department.name && emp.department.name.toLowerCase().includes(searchQuery))
        );
      }
      
      if (department) {
        employees = employees.filter((emp: any) => 
          emp.department && emp.department.name === department
        );
      }
      
      searchResults.employees = employees.slice(0, 20); // 限制结果数量
    }

    // 搜索工位
    if (type === 'all' || type === 'workstation') {
      let workstations = cacheData.workstations || [];
      
      if (searchQuery) {
        workstations = workstations.filter((ws: any) => 
          (ws.searchText && ws.searchText.includes(searchQuery)) ||
          (ws.desk_number && ws.desk_number.toLowerCase().includes(searchQuery)) ||
          (ws.department && ws.department.name && ws.department.name.toLowerCase().includes(searchQuery)) ||
          (ws.employee && ws.employee.name && ws.employee.name.toLowerCase().includes(searchQuery))
        );
      }
      
      if (department) {
        workstations = workstations.filter((ws: any) => 
          ws.department && ws.department.name === department
        );
      }
      
      searchResults.workstations = workstations.slice(0, 20);
    }

    // 搜索部门（新增功能）
    if (type === 'all') {
      let departments = cacheData.departments || [];
      
      if (searchQuery) {
        departments = departments.filter((dept: any) => 
          (dept.searchText && dept.searchText.includes(searchQuery)) ||
          (dept.name && dept.name.toLowerCase().includes(searchQuery)) ||
          (dept.code && dept.code.toLowerCase().includes(searchQuery))
        );
      }
      
      searchResults.departments = departments.slice(0, 10);
    }

    searchResults.total = searchResults.employees.length + 
                         searchResults.workstations.length + 
                         searchResults.departments.length;

    // 记录搜索日志
    try {
      await executeQuery(
        'INSERT INTO system_logs (action, details, ip_address, created_at) VALUES ($1, $2, $3, $4)',
        [
          'search',
          JSON.stringify({ 
            query: searchQuery, 
            type, 
            department, 
            results_count: searchResults.total,
            cache_used: true,
            cross_department: !department // 标记是否为跨部门搜索
          }),
          req.ip || 'unknown',
          new Date().toISOString()
        ]
      );
    } catch (logError) {
      console.warn('记录搜索日志失败:', logError);
    }

    const message = searchResults.total === 0 ? 
      "未找到相关结果\n请尝试其他关键词或检查拼写" : 
      `找到 ${searchResults.total} 条结果${department ? ` (限定在${department})` : ' (跨部门搜索)'}`;
    
    res.json({
      success: true,
      data: {
        ...searchResults,
        cached: true,
        lastUpdated: cacheData.lastUpdated,
        crossDepartment: !department
      },
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
    const employeeNames = await executeQuery<{name: string}[]>(
      'SELECT DISTINCT name FROM employees WHERE (name ILIKE $1 OR name_pinyin ILIKE $1 OR name_pinyin_short ILIKE $1) LIMIT 5',
      [`%${query}%`]
    );

    // 获取工位名称建议
    const workstationNames = await executeQuery<{desk_number: string}[]>(
      'SELECT DISTINCT desk_number FROM desks WHERE desk_number ILIKE $1 LIMIT 5',
      [`%${query}%`]
    );

    // 获取部门名称建议
    const departmentNames = await executeQuery<{name: string}[]>(
      'SELECT DISTINCT name FROM departments WHERE name ILIKE $1 LIMIT 3',
      [`%${query}%`]
    );

    const suggestions = [
      ...employeeNames.map((item: any) => ({ type: 'employee', value: item.name })),
      ...workstationNames.map((item: any) => ({ type: 'workstation', value: item.desk_number })),
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