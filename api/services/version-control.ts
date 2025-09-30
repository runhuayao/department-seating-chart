import db from '../models/database.js';
import cacheService from './cache.js';

interface VersionMetadata {
  version: string;
  description: string;
  createdBy: string;
  createdAt: string;
  changeType: 'major' | 'minor' | 'patch';
  changes: VersionChange[];
}

interface VersionChange {
  type: 'seat_added' | 'seat_removed' | 'seat_moved' | 'seat_updated' | 'layout_changed';
  seatId?: string;
  oldValue?: any;
  newValue?: any;
  description: string;
}

interface SeatingChartVersion {
  id: string;
  chartId: string;
  version: string;
  data: any;
  metadata: VersionMetadata;
  createdAt: string;
  isActive: boolean;
}

class VersionControlService {
  private static instance: VersionControlService;

  private constructor() {}

  public static getInstance(): VersionControlService {
    if (!VersionControlService.instance) {
      VersionControlService.instance = new VersionControlService();
    }
    return VersionControlService.instance;
  }

  // 创建新版本
  public async createVersion(
    chartId: string, 
    chartData: any, 
    metadata: Partial<VersionMetadata>
  ): Promise<string> {
    try {
      // 获取当前最新版本号
      const currentVersion = await this.getCurrentVersion(chartId);
      const newVersion = this.incrementVersion(currentVersion, metadata.changeType || 'patch');
      
      const versionId = `version-${chartId}-${Date.now()}`;
      const fullMetadata: VersionMetadata = {
        version: newVersion,
        description: metadata.description || '自动版本创建',
        createdBy: metadata.createdBy || 'system',
        createdAt: new Date().toISOString(),
        changeType: metadata.changeType || 'patch',
        changes: metadata.changes || []
      };

      // 存储到数据库
      await this.storeVersionInDB(versionId, chartId, chartData, fullMetadata);
      
      // 缓存版本信息
      await this.cacheVersion(versionId, chartId, chartData, fullMetadata);

      console.log(`📦 版本创建成功 - 图表: ${chartId}, 版本: ${newVersion}`);
      return versionId;
    } catch (error) {
      console.error('创建版本失败:', error);
      throw error;
    }
  }

  // 获取版本历史列表
  public async getVersionHistory(
    chartId: string, 
    page: number = 1, 
    limit: number = 20
  ): Promise<SeatingChartVersion[]> {
    try {
      // 尝试从缓存获取
      const cacheKey = `versions:${chartId}:${page}:${limit}`;
      const cachedData = await cacheService.get(cacheKey);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      // 从数据库获取
      const versions = await this.getVersionsFromDB(chartId, page, limit);
      
      // 缓存结果
      await cacheService.set(cacheKey, JSON.stringify(versions), 300); // 5分钟缓存
      
      return versions;
    } catch (error) {
      console.error('获取版本历史失败:', error);
      throw error;
    }
  }

  // 回滚到指定版本
  public async rollbackToVersion(chartId: string, versionId: string, userId: string): Promise<any> {
    try {
      // 获取目标版本数据
      const targetVersion = await this.getVersionFromDB(versionId);
      if (!targetVersion) {
        throw new Error('目标版本不存在');
      }

      // 获取当前数据作为备份
      const currentData = await this.getCurrentChartData(chartId);
      
      // 创建回滚前的备份版本
      await this.createVersion(chartId, currentData, {
        description: `回滚前备份 - 回滚到版本 ${targetVersion.metadata.version}`,
        createdBy: userId,
        changeType: 'major',
        changes: [{
          type: 'layout_changed',
          description: `回滚到版本 ${targetVersion.metadata.version}`
        }]
      });

      // 应用目标版本数据
      await this.applyVersionData(chartId, targetVersion.data);
      
      // 清除相关缓存
      await this.clearVersionCache(chartId);

      console.log(`🔄 版本回滚成功 - 图表: ${chartId}, 目标版本: ${targetVersion.metadata.version}`);
      return targetVersion.data;
    } catch (error) {
      console.error('版本回滚失败:', error);
      throw error;
    }
  }

  // 比较两个版本的差异
  public async compareVersions(chartId: string, version1Id: string, version2Id: string): Promise<VersionChange[]> {
    try {
      const v1 = await this.getVersionFromDB(version1Id);
      const v2 = await this.getVersionFromDB(version2Id);
      
      if (!v1 || !v2) {
        throw new Error('版本不存在');
      }

      return this.calculateVersionDiff(v1.data, v2.data);
    } catch (error) {
      console.error('版本比较失败:', error);
      throw error;
    }
  }

  // 获取当前版本号
  private async getCurrentVersion(chartId: string): Promise<string> {
    try {
      const query = `
        SELECT metadata->>'version' as version
        FROM seating_chart_versions
        WHERE chart_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `;
      
      const result = await db.query(query, [chartId]);
      return result.rows.length > 0 ? result.rows[0].version : '0.0.0';
    } catch (error) {
      console.error('获取当前版本失败:', error);
      return '0.0.0';
    }
  }

  // 递增版本号
  private incrementVersion(currentVersion: string, changeType: 'major' | 'minor' | 'patch'): string {
    const [major, minor, patch] = currentVersion.split('.').map(Number);
    
    switch (changeType) {
      case 'major':
        return `${major + 1}.0.0`;
      case 'minor':
        return `${major}.${minor + 1}.0`;
      case 'patch':
        return `${major}.${minor}.${patch + 1}`;
      default:
        return `${major}.${minor}.${patch + 1}`;
    }
  }

  // 存储版本到数据库
  private async storeVersionInDB(
    versionId: string, 
    chartId: string, 
    data: any, 
    metadata: VersionMetadata
  ) {
    const query = `
      INSERT INTO seating_chart_versions (
        id, chart_id, version_data, metadata, created_at, is_active
      ) VALUES ($1, $2, $3, $4, NOW(), true)
    `;
    
    await db.query(query, [
      versionId,
      chartId,
      JSON.stringify(data),
      JSON.stringify(metadata)
    ]);
  }

  // 缓存版本信息
  private async cacheVersion(
    versionId: string, 
    chartId: string, 
    data: any, 
    metadata: VersionMetadata
  ) {
    const cacheKey = `version:${versionId}`;
    const versionData = {
      id: versionId,
      chartId,
      data,
      metadata,
      cachedAt: new Date().toISOString()
    };
    
    await cacheService.set(cacheKey, JSON.stringify(versionData), 3600); // 1小时缓存
  }

  // 从数据库获取版本列表
  private async getVersionsFromDB(chartId: string, page: number, limit: number): Promise<SeatingChartVersion[]> {
    const offset = (page - 1) * limit;
    
    const query = `
      SELECT id, chart_id, version_data, metadata, created_at, is_active
      FROM seating_chart_versions
      WHERE chart_id = $1 AND is_active = true
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await db.query(query, [chartId, limit, offset]);
    return result.rows.map(row => ({
      id: row.id,
      chartId: row.chart_id,
      version: JSON.parse(row.metadata).version,
      data: JSON.parse(row.version_data),
      metadata: JSON.parse(row.metadata),
      createdAt: row.created_at,
      isActive: row.is_active
    }));
  }

  // 从数据库获取单个版本
  private async getVersionFromDB(versionId: string): Promise<SeatingChartVersion | null> {
    const query = `
      SELECT id, chart_id, version_data, metadata, created_at, is_active
      FROM seating_chart_versions
      WHERE id = $1 AND is_active = true
    `;
    
    const result = await db.query(query, [versionId]);
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      chartId: row.chart_id,
      version: JSON.parse(row.metadata).version,
      data: JSON.parse(row.version_data),
      metadata: JSON.parse(row.metadata),
      createdAt: row.created_at,
      isActive: row.is_active
    };
  }

  // 获取当前图表数据
  private async getCurrentChartData(chartId: string): Promise<any> {
    const query = `
      SELECT layout_data, metadata
      FROM seating_charts
      WHERE id = $1 AND is_active = true
    `;
    
    const result = await db.query(query, [chartId]);
    if (result.rows.length === 0) {
      throw new Error('座位图不存在');
    }

    return {
      layout: JSON.parse(result.rows[0].layout_data),
      metadata: JSON.parse(result.rows[0].metadata)
    };
  }

  // 应用版本数据
  private async applyVersionData(chartId: string, versionData: any) {
    const query = `
      UPDATE seating_charts
      SET layout_data = $1, metadata = $2, updated_at = NOW()
      WHERE id = $3
    `;
    
    await db.query(query, [
      JSON.stringify(versionData.layout),
      JSON.stringify(versionData.metadata),
      chartId
    ]);
  }

  // 计算版本差异
  private calculateVersionDiff(data1: any, data2: any): VersionChange[] {
    const changes: VersionChange[] = [];
    
    // 简化的差异计算 - 实际实现需要更复杂的对比逻辑
    if (JSON.stringify(data1.layout) !== JSON.stringify(data2.layout)) {
      changes.push({
        type: 'layout_changed',
        description: '座位图布局发生变化'
      });
    }

    return changes;
  }

  // 清除版本缓存
  private async clearVersionCache(chartId: string) {
    const patterns = [
      `version:*`,
      `versions:${chartId}:*`
    ];

    for (const pattern of patterns) {
      const keys = await cacheService.keys(pattern);
      for (const key of keys) {
        await cacheService.delete(key);
      }
    }
  }
}

export const versionControlService = VersionControlService.getInstance();
export default versionControlService;