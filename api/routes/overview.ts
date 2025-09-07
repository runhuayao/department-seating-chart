/**
 * 概览数据API路由
 * 提供首页概览、统计数据等相关接口
 */
import { Router, type Request, type Response } from 'express';

const router = Router();

/**
 * 获取首页概览数据
 * GET /api/overview/homepage
 */
router.get('/homepage', async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: 从数据库统计各部门数据
    // 临时返回模拟数据，格式与M0版本兼容
    const mockOverview = {
      Engineering: {
        totalDesks: 25,
        occupiedDesks: 18,
        onlineCount: 15,
        offlineCount: 3
      },
      Marketing: {
        totalDesks: 20,
        occupiedDesks: 14,
        onlineCount: 12,
        offlineCount: 2
      },
      Sales: {
        totalDesks: 30,
        occupiedDesks: 22,
        onlineCount: 18,
        offlineCount: 4
      },
      HR: {
        totalDesks: 15,
        occupiedDesks: 10,
        onlineCount: 8,
        offlineCount: 2
      }
    };
    
    res.json({
      success: true,
      data: mockOverview
    });
  } catch (error) {
    console.error('获取首页概览数据失败:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch homepage overview'
    });
  }
});

/**
 * 获取实时统计数据
 * GET /api/overview/realtime
 */
router.get('/realtime', async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: 从数据库获取实时统计数据
    const mockRealtime = {
      totalEmployees: 87,
      onlineEmployees: 53,
      offlineEmployees: 34,
      totalDesks: 90,
      occupiedDesks: 64,
      availableDesks: 26,
      utilizationRate: 71.1, // 占用率
      onlineRate: 60.9, // 在线率
      departments: [
        {
          name: 'Engineering',
          employees: 25,
          onlineEmployees: 15,
          desks: 25,
          occupiedDesks: 18
        },
        {
          name: 'Marketing',
          employees: 20,
          onlineEmployees: 12,
          desks: 20,
          occupiedDesks: 14
        },
        {
          name: 'Sales',
          employees: 30,
          onlineEmployees: 18,
          desks: 30,
          occupiedDesks: 22
        },
        {
          name: 'HR',
          employees: 12,
          onlineEmployees: 8,
          desks: 15,
          occupiedDesks: 10
        }
      ],
      lastUpdated: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: mockRealtime
    });
  } catch (error) {
    console.error('获取实时统计数据失败:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch realtime statistics'
    });
  }
});

/**
 * 获取历史趋势数据
 * GET /api/overview/trends?period=7d
 */
router.get('/trends', async (req: Request, res: Response): Promise<void> => {
  try {
    const period = req.query.period as string || '7d';
    
    // TODO: 根据period参数从数据库获取历史趋势数据
    // 支持的period: 1d, 7d, 30d, 90d
    
    const mockTrends = {
      period,
      data: Array.from({ length: 7 }, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - index));
        
        return {
          date: date.toISOString().split('T')[0],
          totalEmployees: 85 + Math.floor(Math.random() * 10),
          onlineEmployees: 45 + Math.floor(Math.random() * 20),
          utilizationRate: 65 + Math.floor(Math.random() * 20),
          peakHour: {
            hour: 14 + Math.floor(Math.random() * 4), // 14-17点
            onlineCount: 60 + Math.floor(Math.random() * 15)
          }
        };
      })
    };
    
    res.json({
      success: true,
      data: mockTrends
    });
  } catch (error) {
    console.error('获取历史趋势数据失败:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trend data'
    });
  }
});

/**
 * 获取部门对比数据
 * GET /api/overview/departments-comparison
 */
router.get('/departments-comparison', async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: 从数据库获取各部门对比数据
    const mockComparison = {
      departments: [
        {
          name: 'Engineering',
          displayName: '工程部',
          metrics: {
            employeeCount: 25,
            onlineRate: 60.0,
            utilizationRate: 72.0,
            avgDailyOnlineHours: 8.2
          }
        },
        {
          name: 'Marketing',
          displayName: '市场部',
          metrics: {
            employeeCount: 20,
            onlineRate: 60.0,
            utilizationRate: 70.0,
            avgDailyOnlineHours: 7.8
          }
        },
        {
          name: 'Sales',
          displayName: '销售部',
          metrics: {
            employeeCount: 30,
            onlineRate: 60.0,
            utilizationRate: 73.3,
            avgDailyOnlineHours: 8.5
          }
        },
        {
          name: 'HR',
          displayName: '人力资源部',
          metrics: {
            employeeCount: 12,
            onlineRate: 66.7,
            utilizationRate: 66.7,
            avgDailyOnlineHours: 7.5
          }
        }
      ],
      generatedAt: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: mockComparison
    });
  } catch (error) {
    console.error('获取部门对比数据失败:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch departments comparison'
    });
  }
});

export default router;