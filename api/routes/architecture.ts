/**
 * 系统架构相关路由
 * 提供系统架构信息、健康检查、性能监控等API
 */

import { Router } from 'express';
import { ArchitectureService } from '../services/architecture';
import { authenticateToken, requireRole } from '../middleware/auth';
import { pool } from '../config/database';
import { WebSocketManager } from '../websocket/manager';

const router = Router();

// 这里需要从app.ts传入或通过依赖注入获取
let architectureService: ArchitectureService;

/**
 * 初始化架构服务路由
 */
export function initializeArchitectureRoutes(service: ArchitectureService) {
  architectureService = service;
}

/**
 * 获取系统架构图
 * GET /api/architecture/diagram
 */
router.get('/diagram', authenticateToken, async (req, res) => {
  try {
    const diagram = architectureService.getArchitectureDiagram();
    
    res.json({
      success: true,
      data: diagram
    });
  } catch (error) {
    console.error('Get architecture diagram failed:', error);
    res.status(500).json({
      success: false,
      message: '获取系统架构图失败',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 获取系统健康状态
 * GET /api/architecture/health
 */
router.get('/health', authenticateToken, async (req, res) => {
  try {
    const healthCheck = await architectureService.getSystemHealth();
    
    res.json({
      success: true,
      data: healthCheck
    });
  } catch (error) {
    console.error('Get system health failed:', error);
    res.status(500).json({
      success: false,
      message: '获取系统健康状态失败',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 获取所有组件信息
 * GET /api/architecture/components
 */
router.get('/components', authenticateToken, async (req, res) => {
  try {
    const components = architectureService.getAllComponents();
    
    res.json({
      success: true,
      data: components
    });
  } catch (error) {
    console.error('Get components failed:', error);
    res.status(500).json({
      success: false,
      message: '获取组件信息失败',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 获取单个组件详细信息
 * GET /api/architecture/components/:id
 */
router.get('/components/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const component = architectureService.getComponent(id);
    
    if (!component) {
      return res.status(404).json({
        success: false,
        message: '组件不存在'
      });
    }
    
    res.json({
      success: true,
      data: component
    });
  } catch (error) {
    console.error('Get component failed:', error);
    res.status(500).json({
      success: false,
      message: '获取组件信息失败',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 更新组件配置
 * PUT /api/architecture/components/:id
 */
router.put('/components/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // 验证更新数据
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({
        success: false,
        message: '无效的更新数据'
      });
    }
    
    const success = architectureService.updateComponent(id, updates);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        message: '组件不存在'
      });
    }
    
    res.json({
      success: true,
      message: '组件配置更新成功'
    });
  } catch (error) {
    console.error('Update component failed:', error);
    res.status(500).json({
      success: false,
      message: '更新组件配置失败',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 获取微前端配置
 * GET /api/architecture/microfrontend
 */
router.get('/microfrontend', authenticateToken, async (req, res) => {
  try {
    const config = architectureService.getMicrofrontendConfig();
    
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Get microfrontend config failed:', error);
    res.status(500).json({
      success: false,
      message: '获取微前端配置失败',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 获取系统性能报告
 * GET /api/architecture/performance
 */
router.get('/performance', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const report = await architectureService.getPerformanceReport();
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Get performance report failed:', error);
    res.status(500).json({
      success: false,
      message: '获取性能报告失败',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 触发手动健康检查
 * POST /api/architecture/health/check
 */
router.post('/health/check', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const healthCheck = await architectureService.getSystemHealth();
    
    res.json({
      success: true,
      data: healthCheck,
      message: '健康检查完成'
    });
  } catch (error) {
    console.error('Manual health check failed:', error);
    res.status(500).json({
      success: false,
      message: '手动健康检查失败',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 获取系统监控数据
 * GET /api/architecture/monitoring
 */
router.get('/monitoring', authenticateToken, async (req, res) => {
  try {
    const { timeRange = '1h' } = req.query;
    
    // 这里可以根据时间范围获取历史监控数据
    // 目前返回当前状态
    const healthCheck = await architectureService.getSystemHealth();
    const components = architectureService.getAllComponents();
    
    const monitoringData = {
      timestamp: new Date(),
      timeRange,
      overall: healthCheck.overall,
      metrics: {
        availability: components.filter(c => c.status === 'healthy').length / components.length * 100,
        responseTime: components.reduce((sum, c) => sum + (c.metrics.responseTime || 0), 0) / components.length,
        errorRate: components.reduce((sum, c) => sum + (c.metrics.errorRate || 0), 0) / components.length,
        throughput: components.reduce((sum, c) => sum + (c.metrics.throughput || 0), 0)
      },
      components: components.map(component => ({
        id: component.id,
        name: component.name,
        type: component.type,
        status: component.status,
        metrics: component.metrics,
        lastCheck: component.lastCheck
      })),
      issues: healthCheck.issues
    };
    
    res.json({
      success: true,
      data: monitoringData
    });
  } catch (error) {
    console.error('Get monitoring data failed:', error);
    res.status(500).json({
      success: false,
      message: '获取监控数据失败',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 获取系统拓扑图数据
 * GET /api/architecture/topology
 */
router.get('/topology', authenticateToken, async (req, res) => {
  try {
    const components = architectureService.getAllComponents();
    
    // 构建拓扑图数据
    const nodes = components.map(component => ({
      id: component.id,
      label: component.name,
      type: component.type,
      status: component.status,
      group: component.type,
      level: getComponentLevel(component.type),
      metrics: component.metrics
    }));
    
    const edges = [];
    for (const component of components) {
      for (const dependency of component.dependencies) {
        edges.push({
          from: component.id,
          to: dependency,
          arrows: 'to',
          label: 'depends on',
          color: getEdgeColor(component.status)
        });
      }
    }
    
    res.json({
      success: true,
      data: {
        nodes,
        edges,
        options: {
          layout: {
            hierarchical: {
              direction: 'UD',
              sortMethod: 'directed',
              levelSeparation: 150,
              nodeSpacing: 200
            }
          },
          physics: {
            enabled: false
          }
        }
      }
    });
  } catch (error) {
    console.error('Get topology failed:', error);
    res.status(500).json({
      success: false,
      message: '获取系统拓扑图失败',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 获取组件层级
 */
function getComponentLevel(type: string): number {
  const levels: Record<string, number> = {
    'proxy': 1,
    'frontend': 2,
    'backend': 3,
    'websocket': 3,
    'cache': 4,
    'database': 5
  };
  return levels[type] || 3;
}

/**
 * 获取边的颜色
 */
function getEdgeColor(status: string): string {
  const colors: Record<string, string> = {
    'healthy': '#4CAF50',
    'degraded': '#FF9800',
    'unhealthy': '#F44336',
    'unknown': '#9E9E9E'
  };
  return colors[status] || '#9E9E9E';
}

export default router;
export { initializeArchitectureRoutes };