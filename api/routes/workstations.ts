/**
 * Workstations API Routes
 * 工位管理相关API接口
 */

import express, { type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// 模拟数据库存储（实际项目中应使用真实数据库）
interface Workstation {
  id: string;
  name: string;
  ip_address: string;
  username: string;
  department: string;
  metadata: Record<string, any>;
  created_by: string;
  created_at: string;
  updated_at: string;
  status: 'active' | 'inactive' | 'maintenance';
}

// 内存存储（实际应用中应使用数据库）
let workstations: Workstation[] = [
  {
    id: '1',
    name: '开发工位-001',
    ip_address: '192.168.1.101',
    username: 'dev001',
    department: '技术部',
    metadata: {
      location: 'A区-1楼-001',
      equipment: ['台式机', '双显示器', '机械键盘'],
      specs: {
        cpu: 'Intel i7-12700K',
        ram: '32GB',
        storage: '1TB SSD'
      }
    },
    created_by: 'admin',
    created_at: '2024-01-15T08:00:00Z',
    updated_at: '2024-01-15T08:00:00Z',
    status: 'active'
  },
  {
    id: '2',
    name: '设计工位-002',
    ip_address: '192.168.1.102',
    username: 'design001',
    department: '设计部',
    metadata: {
      location: 'B区-2楼-015',
      equipment: ['MacBook Pro', '4K显示器', '数位板'],
      specs: {
        cpu: 'Apple M2 Pro',
        ram: '32GB',
        storage: '1TB SSD'
      }
    },
    created_by: 'user_design001',
    created_at: '2024-01-16T09:30:00Z',
    updated_at: '2024-01-16T09:30:00Z',
    status: 'active'
  }
];

/**
 * GET /api/workstations
 * 获取工位列表
 */
router.get('/', (req: Request, res: Response): void => {
  try {
    const { department, status, page = 1, limit = 10 } = req.query;
    
    let filteredWorkstations = [...workstations];
    
    // 按部门筛选
    if (department && typeof department === 'string') {
      filteredWorkstations = filteredWorkstations.filter(
        ws => ws.department.toLowerCase().includes(department.toLowerCase())
      );
    }
    
    // 按状态筛选
    if (status && typeof status === 'string') {
      filteredWorkstations = filteredWorkstations.filter(
        ws => ws.status === status
      );
    }
    
    // 分页
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    
    const paginatedWorkstations = filteredWorkstations.slice(startIndex, endIndex);
    
    res.status(200).json({
      success: true,
      data: {
        workstations: paginatedWorkstations,
        pagination: {
          current_page: pageNum,
          per_page: limitNum,
          total: filteredWorkstations.length,
          total_pages: Math.ceil(filteredWorkstations.length / limitNum)
        }
      },
      message: 'Workstations retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve workstations'
    });
  }
});

/**
 * POST /api/workstations
 * 用户添加工位
 */
router.post('/', (req: Request, res: Response): void => {
  try {
    const { name, ip_address, username, department, metadata = {} } = req.body;
    
    // 基础验证
    if (!name || !ip_address || !username || !department) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: name, ip_address, username, department'
      });
      return;
    }
    
    // IP地址格式验证
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(ip_address)) {
      res.status(400).json({
        success: false,
        error: 'Invalid IP address format'
      });
      return;
    }
    
    // 检查IP地址是否已存在
    const existingWorkstation = workstations.find(ws => ws.ip_address === ip_address);
    if (existingWorkstation) {
      res.status(409).json({
        success: false,
        error: 'IP address already exists'
      });
      return;
    }
    
    // 创建新工位
    const newWorkstation: Workstation = {
      id: uuidv4(),
      name,
      ip_address,
      username,
      department,
      metadata,
      created_by: req.headers['x-user-id'] as string || 'anonymous',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'active'
    };
    
    workstations.push(newWorkstation);
    
    res.status(201).json({
      success: true,
      data: newWorkstation,
      message: 'Workstation created successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create workstation'
    });
  }
});

/**
 * GET /api/workstations/search
 * 搜索工位
 */
router.get('/search', (req: Request, res: Response): void => {
  try {
    const { q, type = 'all' } = req.query;
    
    if (!q || typeof q !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
      return;
    }
    
    const searchTerm = q.toLowerCase();
    let results: Workstation[] = [];
    
    switch (type) {
      case 'name':
        results = workstations.filter(ws => 
          ws.name.toLowerCase().includes(searchTerm)
        );
        break;
      case 'ip':
        results = workstations.filter(ws => 
          ws.ip_address.includes(searchTerm)
        );
        break;
      case 'username':
        results = workstations.filter(ws => 
          ws.username.toLowerCase().includes(searchTerm)
        );
        break;
      case 'department':
        results = workstations.filter(ws => 
          ws.department.toLowerCase().includes(searchTerm)
        );
        break;
      default:
        results = workstations.filter(ws => 
          ws.name.toLowerCase().includes(searchTerm) ||
          ws.ip_address.includes(searchTerm) ||
          ws.username.toLowerCase().includes(searchTerm) ||
          ws.department.toLowerCase().includes(searchTerm)
        );
    }
    
    res.status(200).json({
      success: true,
      data: {
        workstations: results,
        count: results.length,
        search_term: q,
        search_type: type
      },
      message: 'Search completed successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Search failed'
    });
  }
});

/**
 * GET /api/workstations/:id
 * 获取单个工位详情
 */
router.get('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const workstation = workstations.find(ws => ws.id === id);
    
    if (!workstation) {
      res.status(404).json({
        success: false,
        error: 'Workstation not found'
      });
      return;
    }
    
    res.status(200).json({
      success: true,
      data: workstation,
      message: 'Workstation retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve workstation'
    });
  }
});

/**
 * PUT /api/workstations/:id
 * 管理员修改工位（需要管理员权限）
 */
router.put('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const { name, ip_address, username, department, metadata, status } = req.body;
    
    // 简单的权限检查（实际应用中应使用更完善的RBAC系统）
    const userRole = req.headers['x-user-role'] as string;
    if (userRole !== 'admin') {
      res.status(403).json({
        success: false,
        error: 'Admin privileges required'
      });
      return;
    }
    
    const workstationIndex = workstations.findIndex(ws => ws.id === id);
    if (workstationIndex === -1) {
      res.status(404).json({
        success: false,
        error: 'Workstation not found'
      });
      return;
    }
    
    // IP地址格式验证（如果提供了新的IP地址）
    if (ip_address) {
      const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      if (!ipRegex.test(ip_address)) {
        res.status(400).json({
          success: false,
          error: 'Invalid IP address format'
        });
        return;
      }
      
      // 检查IP地址是否已被其他工位使用
      const existingWorkstation = workstations.find(ws => ws.ip_address === ip_address && ws.id !== id);
      if (existingWorkstation) {
        res.status(409).json({
          success: false,
          error: 'IP address already exists'
        });
        return;
      }
    }
    
    // 更新工位信息
    const updatedWorkstation = {
      ...workstations[workstationIndex],
      ...(name && { name }),
      ...(ip_address && { ip_address }),
      ...(username && { username }),
      ...(department && { department }),
      ...(metadata && { metadata: { ...workstations[workstationIndex].metadata, ...metadata } }),
      ...(status && { status }),
      updated_at: new Date().toISOString()
    };
    
    workstations[workstationIndex] = updatedWorkstation;
    
    res.status(200).json({
      success: true,
      data: updatedWorkstation,
      message: 'Workstation updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update workstation'
    });
  }
});

/**
 * DELETE /api/workstations/:id
 * 管理员删除工位（需要管理员权限）
 */
router.delete('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    
    // 简单的权限检查（实际应用中应使用更完善的RBAC系统）
    const userRole = req.headers['x-user-role'] as string;
    if (userRole !== 'admin') {
      res.status(403).json({
        success: false,
        error: 'Admin privileges required'
      });
      return;
    }
    
    const workstationIndex = workstations.findIndex(ws => ws.id === id);
    if (workstationIndex === -1) {
      res.status(404).json({
        success: false,
        error: 'Workstation not found'
      });
      return;
    }
    
    const deletedWorkstation = workstations[workstationIndex];
    workstations.splice(workstationIndex, 1);
    
    res.status(200).json({
      success: true,
      data: deletedWorkstation,
      message: 'Workstation deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete workstation'
    });
  }
});

/**
 * GET /api/workstations/stats/summary
 * 获取工位统计信息
 */
router.get('/stats/summary', (req: Request, res: Response): void => {
  try {
    const totalWorkstations = workstations.length;
    const activeWorkstations = workstations.filter(ws => ws.status === 'active').length;
    const inactiveWorkstations = workstations.filter(ws => ws.status === 'inactive').length;
    const maintenanceWorkstations = workstations.filter(ws => ws.status === 'maintenance').length;
    
    // 按部门统计
    const departmentStats = workstations.reduce((acc, ws) => {
      acc[ws.department] = (acc[ws.department] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    res.status(200).json({
      success: true,
      data: {
        total: totalWorkstations,
        active: activeWorkstations,
        inactive: inactiveWorkstations,
        maintenance: maintenanceWorkstations,
        by_department: departmentStats,
        last_updated: new Date().toISOString()
      },
      message: 'Workstation statistics retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve workstation statistics'
    });
  }
});

export default router;