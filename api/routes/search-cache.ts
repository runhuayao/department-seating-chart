import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { executeQuery, getDatabaseMode } from '../config/database.js';
import { authenticateToken, rateLimit } from '../middleware/auth.js';
import { MemoryDatabase } from '../database/memory.js';

const router = express.Router();

// 缓存文件路径
const CACHE_DIR = path.join(process.cwd(), 'cache');
const SEARCH_CACHE_FILE = path.join(CACHE_DIR, 'search-data.json');
const DEPARTMENT_CACHE_FILE = path.join(CACHE_DIR, 'departments.json');
const EMPLOYEE_CACHE_FILE = path.join(CACHE_DIR, 'employees.json');
const WORKSTATION_CACHE_FILE = path.join(CACHE_DIR, 'workstations.json');

// 应用频率限制
router.use(rateLimit(200, 15 * 60 * 1000)); // 每15分钟最多200次请求

// 确保缓存目录存在
async function ensureCacheDir() {
  try {
    await fs.access(CACHE_DIR);
  } catch {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  }
}

// 生成搜索缓存数据
async function generateSearchCache(): Promise<any> {
  try {
    const dbMode = getDatabaseMode();
    console.log('🔍 生成搜索缓存，数据库模式:', dbMode);
    
    let employees, workstations, departments;
    
    if (dbMode === 'memory') {
      // 内存数据库模式
      const memoryDb = new MemoryDatabase();
      
      // 获取员工数据
      const empResult = await memoryDb.query({
        text: 'SELECT * FROM employee_search_view ORDER BY department_name, name'
      });
      employees = empResult.rows;
      
      // 获取工位数据
      const deskResult = await memoryDb.query({
        text: 'SELECT * FROM desks ORDER BY department_id, desk_number'
      });
      const desks = deskResult.rows;
      
      // 获取部门数据
      const deptResult = await memoryDb.query({
        text: 'SELECT * FROM departments ORDER BY name'
      });
      const depts = deptResult.rows;
      
      // 构建工位数据（包含部门和员工信息）
      workstations = desks.map((desk: any) => {
        const dept = depts.find((d: any) => d.id === desk.department_id);
        const emp = employees.find((e: any) => e.id === desk.assigned_employee_id);
        return {
          id: desk.id,
          desk_number: desk.desk_number,
          x_coordinate: desk.x_position,
          y_coordinate: desk.y_position,
          status: desk.status,
          equipment: desk.equipment_info,
          ip_address: desk.ip_address,
          computer_name: desk.computer_name,
          description: desk.description || '',
          department_id: dept?.id,
          department_name: dept?.name,
          department_code: dept?.code,
          building: dept?.building,
          floor: dept?.floor,
          employee_id: emp?.id,
          employee_name: emp?.name,
          employee_code: emp?.employee_id,
          employee_position: emp?.position
        };
      });
      
      // 构建部门统计数据
      departments = depts.map((dept: any) => {
        const deptEmployees = employees.filter((e: any) => e.department_id === dept.id);
        const deptDesks = desks.filter((d: any) => d.department_id === dept.id);
        const occupiedDesks = deptDesks.filter((d: any) => d.status === 'occupied');
        
        return {
          id: dept.id,
          name: dept.name,
          code: dept.code,
          building: dept.building,
          floor: dept.floor,
          description: dept.description,
          employee_count: deptEmployees.length,
          desk_count: deptDesks.length,
          occupied_desks: occupiedDesks.length,
          available_desks: deptDesks.length - occupiedDesks.length
        };
      });
      
    } else {
      // PostgreSQL模式
      employees = await executeQuery(`
        SELECT 
          e.id,
          e.employee_id,
          e.name,
          e.email,
          e.phone,
          e.position,
          e.hire_date,
          e.status,
          d.id as department_id,
          d.name as department_name,
          d.code as department_code,
          d.building,
          d.floor,
          desk.id as desk_id,
          desk.desk_number,
          desk.x_coordinate,
          desk.y_coordinate,
          desk.status as desk_status
        FROM employees e
        LEFT JOIN departments d ON e.department_id = d.id
        LEFT JOIN desk_assignments da ON e.id = da.employee_id AND da.status = 'active'
        LEFT JOIN desks desk ON da.desk_id = desk.id
        WHERE e.status = 'active'
        ORDER BY d.name, e.name
      `);

      // 获取所有工位数据（包含员工信息）
      workstations = await executeQuery(`
        SELECT 
          d.id,
          d.desk_number,
          d.x_coordinate,
          d.y_coordinate,
          d.status,
          d.equipment,
          d.ip_address,
          d.computer_name,
          d.description,
          dept.id as department_id,
          dept.name as department_name,
          dept.code as department_code,
          dept.building,
          dept.floor,
          e.id as employee_id,
          e.name as employee_name,
          e.employee_id as employee_code,
          e.position as employee_position
        FROM desks d
        LEFT JOIN departments dept ON d.department_id = dept.id
        LEFT JOIN desk_assignments da ON d.id = da.desk_id AND da.status = 'active'
        LEFT JOIN employees e ON da.employee_id = e.id
        ORDER BY dept.name, d.desk_number
      `);

      // 获取部门统计数据
      departments = await executeQuery(`
        SELECT 
          d.id,
          d.name,
          d.code,
          d.building,
          d.floor,
          d.description,
          COUNT(DISTINCT e.id) as employee_count,
          COUNT(DISTINCT desk.id) as desk_count,
          COUNT(DISTINCT CASE WHEN desk.status = 'occupied' THEN desk.id END) as occupied_desks,
          COUNT(DISTINCT CASE WHEN desk.status = 'available' THEN desk.id END) as available_desks
        FROM departments d
        LEFT JOIN employees e ON d.id = e.department_id AND e.status = 'active'
        LEFT JOIN desks desk ON d.id = desk.department_id
        GROUP BY d.id, d.name, d.code, d.building, d.floor, d.description
        ORDER BY d.name
      `);
    }

    // 构建搜索索引
    const searchIndex = {
      employees: employees.map((emp: any) => ({
        id: emp.id,
        type: 'employee',
        name: emp.name,
        employee_id: emp.employee_id,
        email: emp.email,
        phone: emp.phone,
        position: emp.position,
        department: {
          id: emp.department_id,
          name: emp.department_name,
          code: emp.department_code,
          building: emp.building,
          floor: emp.floor
        },
        desk: emp.desk_id ? {
          id: emp.desk_id,
          desk_number: emp.desk_number,
          x_coordinate: emp.x_coordinate,
          y_coordinate: emp.y_coordinate,
          status: emp.desk_status
        } : null,
        searchText: `${emp.name} ${emp.employee_id} ${emp.email} ${emp.position} ${emp.department_name}`.toLowerCase()
      })),
      workstations: workstations.map((ws: any) => ({
        id: ws.id,
        type: 'workstation',
        desk_number: ws.desk_number,
        coordinates: {
          x: ws.x_coordinate,
          y: ws.y_coordinate
        },
        status: ws.status,
        equipment: ws.equipment,
        ip_address: ws.ip_address,
        computer_name: ws.computer_name,
        description: ws.description,
        department: {
          id: ws.department_id,
          name: ws.department_name,
          code: ws.department_code,
          building: ws.building,
          floor: ws.floor
        },
        employee: ws.employee_id ? {
          id: ws.employee_id,
          name: ws.employee_name,
          employee_id: ws.employee_code,
          position: ws.employee_position
        } : null,
        searchText: `${ws.desk_number} ${ws.department_name} ${ws.employee_name || ''} ${ws.description || ''}`.toLowerCase()
      })),
      departments: departments.map((dept: any) => ({
        id: dept.id,
        type: 'department',
        name: dept.name,
        code: dept.code,
        building: dept.building,
        floor: dept.floor,
        description: dept.description,
        stats: {
          employee_count: parseInt(dept.employee_count) || 0,
          desk_count: parseInt(dept.desk_count) || 0,
          occupied_desks: parseInt(dept.occupied_desks) || 0,
          available_desks: parseInt(dept.available_desks) || 0
        },
        searchText: `${dept.name} ${dept.code} ${dept.description || ''}`.toLowerCase()
      })),
      lastUpdated: new Date().toISOString(),
      version: '2.0'
    };

    return searchIndex;
  } catch (error) {
    console.error('生成搜索缓存失败:', error);
    throw error;
  }
}

// 更新缓存文件
async function updateCacheFiles(searchData: any) {
  await ensureCacheDir();
  
  // 写入完整搜索缓存
  await fs.writeFile(SEARCH_CACHE_FILE, JSON.stringify(searchData, null, 2), 'utf8');
  
  // 写入分类缓存文件
  await fs.writeFile(EMPLOYEE_CACHE_FILE, JSON.stringify({
    employees: searchData.employees,
    lastUpdated: searchData.lastUpdated
  }, null, 2), 'utf8');
  
  await fs.writeFile(WORKSTATION_CACHE_FILE, JSON.stringify({
    workstations: searchData.workstations,
    lastUpdated: searchData.lastUpdated
  }, null, 2), 'utf8');
  
  await fs.writeFile(DEPARTMENT_CACHE_FILE, JSON.stringify({
    departments: searchData.departments,
    lastUpdated: searchData.lastUpdated
  }, null, 2), 'utf8');
}

// 获取缓存数据
router.get('/cache', async (req, res) => {
  try {
    const { type = 'all', refresh = 'false' } = req.query;
    
    // 如果请求刷新或缓存文件不存在，重新生成缓存
    if (refresh === 'true') {
      const searchData = await generateSearchCache();
      await updateCacheFiles(searchData);
      
      return res.json({
        success: true,
        data: searchData,
        message: '缓存已刷新',
        cached: false
      });
    }
    
    // 尝试读取缓存文件
    let cacheFile;
    switch (type) {
      case 'employees':
        cacheFile = EMPLOYEE_CACHE_FILE;
        break;
      case 'workstations':
        cacheFile = WORKSTATION_CACHE_FILE;
        break;
      case 'departments':
        cacheFile = DEPARTMENT_CACHE_FILE;
        break;
      default:
        cacheFile = SEARCH_CACHE_FILE;
    }
    
    try {
      const cacheContent = await fs.readFile(cacheFile, 'utf8');
      const cacheData = JSON.parse(cacheContent);
      
      // 检查缓存是否过期（超过5分钟）
      const cacheAge = Date.now() - new Date(cacheData.lastUpdated).getTime();
      const isExpired = cacheAge > 5 * 60 * 1000; // 5分钟
      
      if (isExpired) {
        // 异步更新缓存，但先返回旧数据
        generateSearchCache().then(updateCacheFiles).catch(console.error);
      }
      
      res.json({
        success: true,
        data: cacheData,
        cached: true,
        cacheAge: Math.floor(cacheAge / 1000), // 秒
        expired: isExpired
      });
      
    } catch (cacheError) {
      // 缓存文件不存在或损坏，重新生成
      const searchData = await generateSearchCache();
      await updateCacheFiles(searchData);
      
      const responseData = type === 'all' ? searchData : 
        type === 'employees' ? { employees: searchData.employees, lastUpdated: searchData.lastUpdated } :
        type === 'workstations' ? { workstations: searchData.workstations, lastUpdated: searchData.lastUpdated } :
        type === 'departments' ? { departments: searchData.departments, lastUpdated: searchData.lastUpdated } :
        searchData;
      
      res.json({
        success: true,
        data: responseData,
        cached: false,
        message: '缓存已重新生成'
      });
    }
    
  } catch (error) {
    console.error('获取缓存数据失败:', error);
    res.status(500).json({
      success: false,
      message: '获取缓存数据失败',
      error: error.message
    });
  }
});

// 强制刷新缓存
router.post('/refresh', async (req, res) => {
  try {
    const searchData = await generateSearchCache();
    await updateCacheFiles(searchData);
    
    // 记录缓存刷新日志
    try {
      await executeQuery(
        'INSERT INTO system_logs (action, details, ip_address, created_at) VALUES ($1, $2, $3, $4)',
        [
          'cache_refresh',
          JSON.stringify({ 
            type: 'search_cache',
            employee_count: searchData.employees.length,
            workstation_count: searchData.workstations.length,
            department_count: searchData.departments.length
          }),
          req.ip || 'unknown',
          new Date().toISOString()
        ]
      );
    } catch (logError) {
      console.warn('记录缓存刷新日志失败:', logError);
    }
    
    res.json({
      success: true,
      data: {
        employee_count: searchData.employees.length,
        workstation_count: searchData.workstations.length,
        department_count: searchData.departments.length,
        lastUpdated: searchData.lastUpdated
      },
      message: '缓存刷新成功'
    });
    
  } catch (error) {
    console.error('刷新缓存失败:', error);
    res.status(500).json({
      success: false,
      message: '刷新缓存失败',
      error: error.message
    });
  }
});

// 获取缓存统计信息
router.get('/stats', async (req, res) => {
  try {
    const stats = {
      files: {},
      totalSize: 0
    };
    
    const cacheFiles = [
      { name: 'search-data.json', path: SEARCH_CACHE_FILE },
      { name: 'employees.json', path: EMPLOYEE_CACHE_FILE },
      { name: 'workstations.json', path: WORKSTATION_CACHE_FILE },
      { name: 'departments.json', path: DEPARTMENT_CACHE_FILE }
    ];
    
    for (const file of cacheFiles) {
      try {
        const stat = await fs.stat(file.path);
        stats.files[file.name] = {
          size: stat.size,
          lastModified: stat.mtime.toISOString(),
          exists: true
        };
        stats.totalSize += stat.size;
      } catch {
        stats.files[file.name] = {
          size: 0,
          lastModified: null,
          exists: false
        };
      }
    }
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('获取缓存统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取缓存统计失败',
      error: error.message
    });
  }
});

export default router;
export { generateSearchCache, updateCacheFiles };