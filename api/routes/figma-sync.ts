import { Router } from 'express';
import db from '../models/database.js';
import cacheService from '../services/cache.js';
import { authenticateToken, rateLimiter } from '../middleware/auth.js';

const router = Router();

// 应用频率限制
router.use(rateLimiter(50, 15 * 60 * 1000)); // 每15分钟最多50次请求

// 错误处理包装器
const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Figma工位数据同步接口
router.post('/workstations/sync-figma', asyncHandler(async (req: any, res: any) => {
  const { department, workstations, syncTime } = req.body;

  if (!department || !Array.isArray(workstations)) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      error: 'department和workstations参数必需'
    });
  }

  try {
    console.log(`🔄 开始Figma工位数据同步 - 部门: ${department}, 工位数量: ${workstations.length}`);

    const syncResults = [];
    const errors = [];

    // 逐个处理工位数据
    for (const workstation of workstations) {
      try {
        const result = await syncWorkstationData(workstation, department);
        syncResults.push(result);
      } catch (error) {
        console.error(`工位同步失败 - ID: ${workstation.id}`, error);
        errors.push({
          workstationId: workstation.id,
          error: error.message
        });
      }
    }

    // 清除相关缓存
    await clearDepartmentCache(department);

    res.json({
      success: true,
      message: `Figma工位数据同步完成`,
      data: {
        department,
        syncTime,
        totalWorkstations: workstations.length,
        successCount: syncResults.length,
        errorCount: errors.length,
        results: syncResults,
        errors: errors.length > 0 ? errors : undefined
      }
    });

    console.log(`✅ Figma同步完成 - 成功: ${syncResults.length}, 失败: ${errors.length}`);
  } catch (error) {
    console.error('Figma工位数据同步失败:', error);
    res.status(500).json({
      success: false,
      message: 'Figma工位数据同步失败',
      error: error.message
    });
  }
}));

// 同步单个工位数据 (Redis + PostgreSQL双写)
async function syncWorkstationData(workstation: any, department: string) {
  const workstationId = workstation.id;
  
  try {
    // 1. 准备数据
    const workstationData = {
      id: workstationId,
      name: workstation.name,
      department: department,
      location: {
        position: workstation.position,
        dimensions: workstation.dimensions
      },
      assignedUser: workstation.assignedUser?.name,
      status: workstation.status || 'available',
      specifications: JSON.stringify(workstation.equipment || {}),
      figmaNodeId: workstation.figmaNodeId,
      figmaSyncTime: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 2. PostgreSQL写入 (主存储)
    let dbResult;
    const existingWorkstation = await db.getWorkstationById(workstationId);
    
    if (existingWorkstation) {
      // 更新现有工位
      dbResult = await db.updateWorkstation(workstationId, workstationData);
      console.log(`📝 PostgreSQL更新工位: ${workstationId}`);
    } else {
      // 创建新工位
      dbResult = await db.createWorkstation(workstationData);
      console.log(`➕ PostgreSQL创建工位: ${workstationId}`);
    }

    // 3. Redis缓存写入 (实时访问)
    const cacheKey = `workstation:${workstationId}`;
    const cacheData = {
      ...workstationData,
      cachedAt: new Date().toISOString()
    };

    await cacheService.set(cacheKey, JSON.stringify(cacheData), 3600); // 1小时过期
    console.log(`💾 Redis缓存工位: ${workstationId}`);

    // 4. 部门工位列表缓存更新
    const deptCacheKey = `workstations:department:${department}`;
    await cacheService.delete(deptCacheKey); // 删除旧缓存，强制重新加载

    // 5. 实时同步缓存
    const syncCacheKey = `figma:sync:${department}`;
    const syncData = {
      department,
      lastSyncTime: new Date().toISOString(),
      workstationCount: 1,
      syncStatus: 'completed'
    };
    await cacheService.set(syncCacheKey, JSON.stringify(syncData), 1800); // 30分钟过期

    return {
      workstationId,
      status: 'success',
      dbResult: !!dbResult,
      cached: true,
      syncTime: new Date().toISOString()
    };
  } catch (error) {
    console.error(`工位数据同步失败 - ID: ${workstationId}`, error);
    
    // 记录同步错误到Redis
    const errorCacheKey = `figma:sync:error:${workstationId}`;
    const errorData = {
      workstationId,
      error: error.message,
      timestamp: new Date().toISOString()
    };
    await cacheService.set(errorCacheKey, JSON.stringify(errorData), 3600);

    throw error;
  }
}

// 清除部门相关缓存
async function clearDepartmentCache(department: string) {
  try {
    const cacheKeys = [
      `workstations:department:${department}`,
      `departments:${department}`,
      `stats:department:${department}`
    ];

    for (const key of cacheKeys) {
      await cacheService.delete(key);
    }

    console.log(`🧹 清除部门缓存: ${department}`);
  } catch (error) {
    console.error('清除部门缓存失败:', error);
  }
}

// 获取Figma同步状态
router.get('/figma/sync-status/:department', asyncHandler(async (req: any, res: any) => {
  const { department } = req.params;

  try {
    const syncCacheKey = `figma:sync:${department}`;
    const syncDataStr = await cacheService.get(syncCacheKey);
    
    let syncData = null;
    if (syncDataStr) {
      syncData = JSON.parse(syncDataStr);
    }

    // 获取同步错误
    const errorKeys = await cacheService.keys(`figma:sync:error:*`);
    const errors = [];
    
    for (const errorKey of errorKeys) {
      const errorDataStr = await cacheService.get(errorKey);
      if (errorDataStr) {
        errors.push(JSON.parse(errorDataStr));
      }
    }

    res.json({
      success: true,
      data: {
        department,
        syncData,
        errors,
        hasErrors: errors.length > 0,
        lastCheck: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('获取Figma同步状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取同步状态失败',
      error: error.message
    });
  }
}));

// 手动触发Figma同步
router.post('/figma/trigger-sync/:department', asyncHandler(async (req: any, res: any) => {
  const { department } = req.params;

  try {
    // 这里可以触发Figma数据获取和同步
    console.log(`🔄 手动触发Figma同步 - 部门: ${department}`);

    // 模拟同步过程
    const syncResult = {
      department,
      triggered: true,
      triggerTime: new Date().toISOString(),
      estimatedCompletion: new Date(Date.now() + 30000).toISOString() // 30秒后完成
    };

    res.json({
      success: true,
      message: 'Figma同步已触发',
      data: syncResult
    });
  } catch (error) {
    console.error('触发Figma同步失败:', error);
    res.status(500).json({
      success: false,
      message: '触发同步失败',
      error: error.message
    });
  }
}));

export default router;