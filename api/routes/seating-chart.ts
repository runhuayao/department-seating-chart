import { Router } from 'express';
import { z } from 'zod';
import db from '../models/database.js';
import cacheService from '../services/cache.js';
import { authenticateToken, requireUserOrAdmin, rateLimiter } from '../middleware/auth.js';

const router = Router();

// 应用频率限制
router.use(rateLimiter(200, 15 * 60 * 1000)); // 每15分钟最多200次请求

// 错误处理包装器
const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// 座位图数据验证Schema
const seatingChartSchema = z.object({
  id: z.string().optional(),
  department: z.string().min(1, '部门名称不能为空'),
  name: z.string().min(1, '座位图名称不能为空'),
  description: z.string().optional(),
  layout: z.object({
    width: z.number().min(100).max(2000),
    height: z.number().min(100).max(1500),
    seats: z.array(z.object({
      id: z.string(),
      x: z.number(),
      y: z.number(),
      width: z.number().min(20).max(200),
      height: z.number().min(20).max(150),
      type: z.string(),
      color: z.string(),
      rotation: z.number().min(0).max(360).optional().default(0),
      label: z.string().optional(),
      assignedUser: z.string().optional(),
      status: z.enum(['available', 'occupied', 'maintenance', 'reserved']).default('available')
    }))
  }),
  metadata: z.object({
    createdBy: z.string(),
    updatedBy: z.string(),
    figmaFileId: z.string().optional(),
    figmaNodeId: z.string().optional(),
    version: z.string().default('1.0.0')
  }),
  isActive: z.boolean().default(true)
});

// 座位更新Schema
const seatUpdateSchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().min(20).max(200).optional(),
  height: z.number().min(20).max(150).optional(),
  type: z.string().optional(),
  color: z.string().optional(),
  rotation: z.number().min(0).max(360).optional(),
  label: z.string().optional(),
  assignedUser: z.string().optional(),
  status: z.enum(['available', 'occupied', 'maintenance', 'reserved']).optional()
});

// 1. 创建座位图 (CREATE)
router.post('/', asyncHandler(async (req: any, res: any) => {
  const validation = seatingChartSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: '数据验证失败',
      errors: validation.error.issues
    });
  }

  const seatingChartData = validation.data;
  const chartId = `chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    // PostgreSQL主存储
    const dbResult = await createSeatingChartInDB(chartId, seatingChartData);
    
    // Redis缓存
    await cacheSeatingChart(chartId, seatingChartData);
    
    // 清除相关缓存
    await clearDepartmentCache(seatingChartData.department);

    res.status(201).json({
      success: true,
      message: '座位图创建成功',
      data: {
        id: chartId,
        ...seatingChartData,
        createdAt: new Date().toISOString()
      }
    });

    console.log(`✅ 座位图创建成功 - ID: ${chartId}, 部门: ${seatingChartData.department}`);
  } catch (error) {
    console.error('创建座位图失败:', error);
    res.status(500).json({
      success: false,
      message: '创建座位图失败',
      error: error.message
    });
  }
}));

// 2. 获取座位图列表 (READ)
router.get('/', asyncHandler(async (req: any, res: any) => {
  const { department, active, page = 1, limit = 20 } = req.query;

  try {
    // 尝试从缓存获取
    const cacheKey = `seating-charts:${department || 'all'}:${page}:${limit}`;
    const cachedData = await cacheService.get(cacheKey);
    
    if (cachedData) {
      return res.json({
        success: true,
        data: JSON.parse(cachedData),
        source: 'cache'
      });
    }

    // 从数据库获取
    const charts = await getSeatingChartsFromDB({ department, active, page, limit });
    
    // 缓存结果
    await cacheService.set(cacheKey, JSON.stringify(charts), 300); // 5分钟缓存

    res.json({
      success: true,
      data: charts,
      source: 'database'
    });
  } catch (error) {
    console.error('获取座位图列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取座位图列表失败',
      error: error.message
    });
  }
}));

// 3. 获取单个座位图 (READ)
router.get('/:id', asyncHandler(async (req: any, res: any) => {
  const { id } = req.params;

  try {
    // 尝试从缓存获取
    const cacheKey = `seating-chart:${id}`;
    const cachedData = await cacheService.get(cacheKey);
    
    if (cachedData) {
      return res.json({
        success: true,
        data: JSON.parse(cachedData),
        source: 'cache'
      });
    }

    // 从数据库获取
    const chart = await getSeatingChartFromDB(id);
    
    if (!chart) {
      return res.status(404).json({
        success: false,
        message: '座位图不存在'
      });
    }

    // 缓存结果
    await cacheService.set(cacheKey, JSON.stringify(chart), 600); // 10分钟缓存

    res.json({
      success: true,
      data: chart,
      source: 'database'
    });
  } catch (error) {
    console.error('获取座位图失败:', error);
    res.status(500).json({
      success: false,
      message: '获取座位图失败',
      error: error.message
    });
  }
}));

// 4. 更新座位图 (UPDATE)
router.put('/:id', asyncHandler(async (req: any, res: any) => {
  const { id } = req.params;
  const validation = seatingChartSchema.partial().safeParse(req.body);
  
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: '数据验证失败',
      errors: validation.error.issues
    });
  }

  const updateData = validation.data;

  try {
    // 获取当前版本用于版本历史
    const currentChart = await getSeatingChartFromDB(id);
    if (!currentChart) {
      return res.status(404).json({
        success: false,
        message: '座位图不存在'
      });
    }

    // 创建版本历史记录
    await createVersionHistory(id, currentChart);

    // 更新数据库
    const updatedChart = await updateSeatingChartInDB(id, updateData);
    
    // 更新缓存
    await cacheSeatingChart(id, updatedChart);
    
    // 清除相关缓存
    await clearDepartmentCache(updatedChart.department);

    res.json({
      success: true,
      message: '座位图更新成功',
      data: updatedChart
    });

    console.log(`✅ 座位图更新成功 - ID: ${id}`);
  } catch (error) {
    console.error('更新座位图失败:', error);
    res.status(500).json({
      success: false,
      message: '更新座位图失败',
      error: error.message
    });
  }
}));

// 5. 删除座位图 (DELETE)
router.delete('/:id', asyncHandler(async (req: any, res: any) => {
  const { id } = req.params;

  try {
    // 获取座位图信息
    const chart = await getSeatingChartFromDB(id);
    if (!chart) {
      return res.status(404).json({
        success: false,
        message: '座位图不存在'
      });
    }

    // 软删除 - 标记为非活跃
    await updateSeatingChartInDB(id, { 
      isActive: false, 
      deletedAt: new Date().toISOString() 
    });
    
    // 删除缓存
    await cacheService.delete(`seating-chart:${id}`);
    await clearDepartmentCache(chart.department);

    res.json({
      success: true,
      message: '座位图删除成功'
    });

    console.log(`✅ 座位图删除成功 - ID: ${id}`);
  } catch (error) {
    console.error('删除座位图失败:', error);
    res.status(500).json({
      success: false,
      message: '删除座位图失败',
      error: error.message
    });
  }
}));

// 6. 更新单个座位 (UPDATE SEAT)
router.patch('/:id/seats/:seatId', asyncHandler(async (req: any, res: any) => {
  const { id, seatId } = req.params;
  const validation = seatUpdateSchema.safeParse(req.body);
  
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: '座位数据验证失败',
      errors: validation.error.issues
    });
  }

  const seatUpdate = validation.data;

  try {
    // 获取当前座位图
    const chart = await getSeatingChartFromDB(id);
    if (!chart) {
      return res.status(404).json({
        success: false,
        message: '座位图不存在'
      });
    }

    // 更新座位数据
    const updatedChart = await updateSeatInChart(id, seatId, seatUpdate);
    
    // 更新缓存
    await cacheSeatingChart(id, updatedChart);

    res.json({
      success: true,
      message: '座位更新成功',
      data: {
        chartId: id,
        seatId,
        updatedSeat: seatUpdate
      }
    });

    console.log(`✅ 座位更新成功 - 图表: ${id}, 座位: ${seatId}`);
  } catch (error) {
    console.error('更新座位失败:', error);
    res.status(500).json({
      success: false,
      message: '更新座位失败',
      error: error.message
    });
  }
}));

// 7. 获取版本历史
router.get('/:id/versions', asyncHandler(async (req: any, res: any) => {
  const { id } = req.params;
  const { page = 1, limit = 10 } = req.query;

  try {
    const versions = await getVersionHistory(id, page, limit);
    
    res.json({
      success: true,
      data: versions
    });
  } catch (error) {
    console.error('获取版本历史失败:', error);
    res.status(500).json({
      success: false,
      message: '获取版本历史失败',
      error: error.message
    });
  }
}));

// 8. 版本回滚
router.post('/:id/rollback/:versionId', asyncHandler(async (req: any, res: any) => {
  const { id, versionId } = req.params;

  try {
    const rolledBackChart = await rollbackToVersion(id, versionId);
    
    // 更新缓存
    await cacheSeatingChart(id, rolledBackChart);
    await clearDepartmentCache(rolledBackChart.department);

    res.json({
      success: true,
      message: '版本回滚成功',
      data: rolledBackChart
    });

    console.log(`✅ 版本回滚成功 - 图表: ${id}, 版本: ${versionId}`);
  } catch (error) {
    console.error('版本回滚失败:', error);
    res.status(500).json({
      success: false,
      message: '版本回滚失败',
      error: error.message
    });
  }
}));

// 辅助函数实现

// 在数据库中创建座位图
async function createSeatingChartInDB(chartId: string, data: any) {
  const query = `
    INSERT INTO seating_charts (
      id, department, name, description, layout_data, 
      metadata, is_active, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
    RETURNING *
  `;
  
  const values = [
    chartId,
    data.department,
    data.name,
    data.description || '',
    JSON.stringify(data.layout),
    JSON.stringify(data.metadata),
    data.isActive
  ];

  const result = await db.query(query, values);
  return result.rows[0];
}

// 从数据库获取座位图列表
async function getSeatingChartsFromDB(filters: any) {
  let query = `
    SELECT id, department, name, description, layout_data, metadata, 
           is_active, created_at, updated_at
    FROM seating_charts 
    WHERE 1=1
  `;
  const values: any[] = [];
  let paramIndex = 1;

  if (filters.department) {
    query += ` AND department = $${paramIndex}`;
    values.push(filters.department);
    paramIndex++;
  }

  if (filters.active !== undefined) {
    query += ` AND is_active = $${paramIndex}`;
    values.push(filters.active === 'true');
    paramIndex++;
  }

  query += ` ORDER BY updated_at DESC`;
  
  if (filters.limit) {
    query += ` LIMIT $${paramIndex}`;
    values.push(parseInt(filters.limit));
    paramIndex++;
  }

  if (filters.page && filters.page > 1) {
    const offset = (parseInt(filters.page) - 1) * parseInt(filters.limit || 20);
    query += ` OFFSET $${paramIndex}`;
    values.push(offset);
  }

  const result = await db.query(query, values);
  return result.rows.map(transformDBRowToChart);
}

// 从数据库获取单个座位图
async function getSeatingChartFromDB(chartId: string) {
  const query = `
    SELECT id, department, name, description, layout_data, metadata,
           is_active, created_at, updated_at
    FROM seating_charts 
    WHERE id = $1 AND is_active = true
  `;
  
  const result = await db.query(query, [chartId]);
  return result.rows.length > 0 ? transformDBRowToChart(result.rows[0]) : null;
}

// 在数据库中更新座位图
async function updateSeatingChartInDB(chartId: string, updateData: any) {
  const setClause = [];
  const values = [];
  let paramIndex = 1;

  if (updateData.name) {
    setClause.push(`name = $${paramIndex}`);
    values.push(updateData.name);
    paramIndex++;
  }

  if (updateData.description !== undefined) {
    setClause.push(`description = $${paramIndex}`);
    values.push(updateData.description);
    paramIndex++;
  }

  if (updateData.layout) {
    setClause.push(`layout_data = $${paramIndex}`);
    values.push(JSON.stringify(updateData.layout));
    paramIndex++;
  }

  if (updateData.metadata) {
    setClause.push(`metadata = $${paramIndex}`);
    values.push(JSON.stringify(updateData.metadata));
    paramIndex++;
  }

  if (updateData.isActive !== undefined) {
    setClause.push(`is_active = $${paramIndex}`);
    values.push(updateData.isActive);
    paramIndex++;
  }

  setClause.push(`updated_at = NOW()`);
  values.push(chartId);

  const query = `
    UPDATE seating_charts 
    SET ${setClause.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `;

  const result = await db.query(query, values);
  return result.rows.length > 0 ? transformDBRowToChart(result.rows[0]) : null;
}

// 更新座位图中的单个座位
async function updateSeatInChart(chartId: string, seatId: string, seatUpdate: any) {
  const chart = await getSeatingChartFromDB(chartId);
  if (!chart) {
    throw new Error('座位图不存在');
  }

  // 更新座位数据
  const layout = chart.layout;
  const seatIndex = layout.seats.findIndex((seat: any) => seat.id === seatId);
  
  if (seatIndex === -1) {
    throw new Error('座位不存在');
  }

  layout.seats[seatIndex] = { ...layout.seats[seatIndex], ...seatUpdate };

  // 更新数据库
  return await updateSeatingChartInDB(chartId, { layout });
}

// 缓存座位图数据
async function cacheSeatingChart(chartId: string, data: any) {
  const cacheKey = `seating-chart:${chartId}`;
  const cacheData = {
    ...data,
    cachedAt: new Date().toISOString()
  };
  
  await cacheService.set(cacheKey, JSON.stringify(cacheData), 600); // 10分钟缓存
}

// 清除部门相关缓存
async function clearDepartmentCache(department: string) {
  const patterns = [
    `seating-charts:${department}:*`,
    `department:${department}:*`,
    `stats:${department}:*`
  ];

  for (const pattern of patterns) {
    const keys = await cacheService.keys(pattern);
    for (const key of keys) {
      await cacheService.delete(key);
    }
  }
}

// 转换数据库行为座位图对象
function transformDBRowToChart(row: any) {
  return {
    id: row.id,
    department: row.department,
    name: row.name,
    description: row.description,
    layout: JSON.parse(row.layout_data),
    metadata: JSON.parse(row.metadata),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// 创建版本历史记录
async function createVersionHistory(chartId: string, chartData: any) {
  const versionId = `v-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  
  const query = `
    INSERT INTO seating_chart_versions (
      id, chart_id, version_data, created_at
    ) VALUES ($1, $2, $3, NOW())
  `;
  
  await db.query(query, [versionId, chartId, JSON.stringify(chartData)]);
  return versionId;
}

// 获取版本历史
async function getVersionHistory(chartId: string, page: number, limit: number) {
  const offset = (page - 1) * limit;
  
  const query = `
    SELECT id, version_data, created_at
    FROM seating_chart_versions
    WHERE chart_id = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3
  `;
  
  const result = await db.query(query, [chartId, limit, offset]);
  return result.rows.map(row => ({
    id: row.id,
    data: JSON.parse(row.version_data),
    createdAt: row.created_at
  }));
}

// 版本回滚
async function rollbackToVersion(chartId: string, versionId: string) {
  // 获取版本数据
  const versionQuery = `
    SELECT version_data FROM seating_chart_versions
    WHERE id = $1 AND chart_id = $2
  `;
  
  const versionResult = await db.query(versionQuery, [versionId, chartId]);
  if (versionResult.rows.length === 0) {
    throw new Error('版本不存在');
  }

  const versionData = JSON.parse(versionResult.rows[0].version_data);
  
  // 创建当前版本的备份
  const currentChart = await getSeatingChartFromDB(chartId);
  await createVersionHistory(chartId, currentChart);

  // 回滚到指定版本
  return await updateSeatingChartInDB(chartId, versionData);
}

export default router;