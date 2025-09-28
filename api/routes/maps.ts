import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import { query } from '../database/connection';

const router = Router();

// 地图数据接口类型定义
interface MapData {
  id?: number;
  name: string;
  department: string;
  width: number;
  height: number;
  background_color?: string;
  border_color?: string;
  border_width?: number;
  border_radius?: number;
  created_at?: Date;
  updated_at?: Date;
}

interface MapImportData {
  name: string;
  department: string;
  svg_data: string;
  width: number;
  height: number;
  desks?: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    desk_id: string;
    employee_id?: string;
  }>;
}

// 获取所有地图列表
router.get('/', authenticateToken, async (req, res) => {
  try {
    const maps = await query(
      'SELECT * FROM maps ORDER BY created_at DESC'
    );
    res.json({ success: true, data: maps });
  } catch (error) {
    console.error('获取地图列表失败:', error);
    res.status(500).json({ success: false, message: '获取地图列表失败' });
  }
});

// 根据部门获取地图（移除认证要求）
router.get('/department/:department', async (req, res) => {
  try {
    const { department } = req.params;
    const maps = await query(
      'SELECT * FROM maps WHERE department = $1',
      [department]
    );
    res.json({ success: true, data: maps });
  } catch (error) {
    console.error('获取部门地图失败:', error);
    res.status(500).json({ success: false, message: '获取部门地图失败' });
  }
});

// 导入地图数据 (管理员权限)
router.post('/import', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const mapData: MapImportData = req.body;
    
    // 验证必需字段
    if (!mapData.name || !mapData.department || !mapData.svg_data) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少必需字段: name, department, svg_data' 
      });
    }

    // 解析SVG数据获取尺寸信息
    const svgMatch = mapData.svg_data.match(/width="(\d+)"\s+height="(\d+)"/);
    let width = mapData.width;
    let height = mapData.height;
    
    if (svgMatch) {
      width = parseInt(svgMatch[1]);
      height = parseInt(svgMatch[2]);
    }

    // 插入地图数据
    const mapResult = await query(
      `INSERT INTO maps (name, department, width, height, svg_data, background_color, border_color, border_width, border_radius)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        mapData.name,
        mapData.department,
        width,
        height,
        mapData.svg_data,
        '#f8fafc', // 默认背景色
        '#e2e8f0', // 默认边框色
        2,         // 默认边框宽度
        8          // 默认圆角
      ]
    );

    const mapId = mapResult[0].id;

    // 如果有工位数据，批量插入
    if (mapData.desks && mapData.desks.length > 0) {
      const deskValues = mapData.desks.map(desk => 
        `(${mapId}, '${desk.desk_id}', ${desk.x}, ${desk.y}, ${desk.width}, ${desk.height}, ${desk.employee_id ? `'${desk.employee_id}'` : 'NULL'})`
      ).join(',');
      
      await query(
        `INSERT INTO map_desks (map_id, desk_id, x, y, width, height, employee_id)
         VALUES ${deskValues}`
      );
    }

    res.json({ 
      success: true, 
      message: '地图导入成功',
      data: mapResult[0]
    });
  } catch (error) {
    console.error('地图导入失败:', error);
    res.status(500).json({ success: false, message: '地图导入失败' });
  }
});

// 更新地图容器尺寸
router.put('/:id/dimensions', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { width, height, background_color, border_color, border_width, border_radius } = req.body;

    const result = await query(
      `UPDATE maps 
       SET width = $1, height = $2, background_color = $3, border_color = $4, 
           border_width = $5, border_radius = $6, updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [width, height, background_color, border_color, border_width, border_radius, id]
    );

    if (result.length === 0) {
      return res.status(404).json({ success: false, message: '地图不存在' });
    }

    res.json({ 
      success: true, 
      message: '地图尺寸更新成功',
      data: result[0]
    });
  } catch (error) {
    console.error('更新地图尺寸失败:', error);
    res.status(500).json({ success: false, message: '更新地图尺寸失败' });
  }
});

// 删除地图
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // 先删除相关的工位数据
    await query('DELETE FROM map_desks WHERE map_id = $1', [id]);
    
    // 删除地图
    const result = await query('DELETE FROM maps WHERE id = $1 RETURNING *', [id]);

    if (result.length === 0) {
      return res.status(404).json({ success: false, message: '地图不存在' });
    }

    res.json({ success: true, message: '地图删除成功' });
  } catch (error) {
    console.error('删除地图失败:', error);
    res.status(500).json({ success: false, message: '删除地图失败' });
  }
});

// 获取地图的自动适配尺寸建议
router.get('/:id/auto-size', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 获取地图的工位数据
    const desks = await query(
      'SELECT x, y, width, height FROM map_desks WHERE map_id = $1',
      [id]
    );

    if (desks.length === 0) {
      return res.json({ 
        success: true, 
        data: { width: 560, height: 340, message: '无工位数据，使用默认尺寸' }
      });
    }

    // 计算工位边界
    const minX = Math.min(...desks.map(d => d.x));
    const maxX = Math.max(...desks.map(d => d.x + d.width));
    const minY = Math.min(...desks.map(d => d.y));
    const maxY = Math.max(...desks.map(d => d.y + d.height));

    // 计算建议尺寸（添加边距）
    const padding = 100;
    const suggestedWidth = maxX - minX + padding * 2;
    const suggestedHeight = maxY - minY + padding * 2;

    res.json({ 
      success: true, 
      data: {
        width: suggestedWidth,
        height: suggestedHeight,
        bounds: { minX, maxX, minY, maxY },
        padding
      }
    });
  } catch (error) {
    console.error('计算自动尺寸失败:', error);
    res.status(500).json({ success: false, message: '计算自动尺寸失败' });
  }
});

export default router;