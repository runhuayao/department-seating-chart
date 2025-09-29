/**
 * 地图缓存服务 - 优化地图加载性能
 * 实现懒加载、缓存机制和预加载策略
 */

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
  size: number;
}

interface MapData {
  svgContent: string;
  metadata: {
    width: number;
    height: number;
    department: string;
    version: string;
    lastModified: string;
  };
}

interface LoadingState {
  isLoading: boolean;
  progress: number;
  error?: string;
}

export class MapCacheService {
  private static instance: MapCacheService;
  private cache: Map<string, CacheItem<MapData>> = new Map();
  private loadingStates: Map<string, LoadingState> = new Map();
  private maxCacheSize = 50 * 1024 * 1024; // 50MB
  private currentCacheSize = 0;
  private defaultTTL = 30 * 60 * 1000; // 30分钟
  private preloadQueue: string[] = [];
  private isPreloading = false;

  private constructor() {
    // 初始化时清理过期缓存
    this.startCacheCleanup();
    // 监听内存压力
    this.monitorMemoryUsage();
  }

  public static getInstance(): MapCacheService {
    if (!MapCacheService.instance) {
      MapCacheService.instance = new MapCacheService();
    }
    return MapCacheService.instance;
  }

  /**
   * 获取地图数据（支持懒加载）
   */
  async getMapData(mapPath: string, priority: 'high' | 'normal' | 'low' = 'normal'): Promise<MapData> {
    const cacheKey = this.getCacheKey(mapPath);
    
    // 检查缓存
    const cached = this.getCachedItem(cacheKey);
    if (cached) {
      console.log(`📦 从缓存获取地图: ${mapPath}`);
      return cached;
    }

    // 检查是否正在加载
    const loadingState = this.loadingStates.get(cacheKey);
    if (loadingState?.isLoading) {
      console.log(`⏳ 等待地图加载: ${mapPath}`);
      return this.waitForLoading(cacheKey);
    }

    // 开始加载
    return this.loadMapData(mapPath, priority);
  }

  /**
   * 预加载地图数据
   */
  preloadMap(mapPath: string): void {
    const cacheKey = this.getCacheKey(mapPath);
    
    // 如果已缓存或正在加载，跳过
    if (this.cache.has(cacheKey) || this.loadingStates.has(cacheKey)) {
      return;
    }

    // 添加到预加载队列
    if (!this.preloadQueue.includes(mapPath)) {
      this.preloadQueue.push(mapPath);
      console.log(`📋 添加到预加载队列: ${mapPath}`);
    }

    // 启动预加载
    this.startPreloading();
  }

  /**
   * 批量预加载常用地图
   */
  preloadCommonMaps(): void {
    const commonMaps = [
      '/maps/building-layout.svg',
      '/maps/engineering-floor.svg',
      '/maps/marketing-floor.svg',
      '/maps/sales-floor.svg',
      '/maps/hr-floor.svg'
    ];

    commonMaps.forEach(mapPath => this.preloadMap(mapPath));
  }

  /**
   * 加载地图数据
   */
  private async loadMapData(mapPath: string, priority: 'high' | 'normal' | 'low'): Promise<MapData> {
    const cacheKey = this.getCacheKey(mapPath);
    
    // 设置加载状态
    this.loadingStates.set(cacheKey, {
      isLoading: true,
      progress: 0
    });

    try {
      console.log(`🔄 开始加载地图: ${mapPath} (优先级: ${priority})`);
      
      // 根据优先级设置超时时间
      const timeout = priority === 'high' ? 5000 : priority === 'normal' ? 10000 : 15000;
      
      const response = await this.fetchWithTimeout(mapPath, timeout);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // 更新加载进度
      this.updateLoadingProgress(cacheKey, 50);

      const svgContent = await response.text();
      
      // 解析SVG元数据
      const metadata = this.parseSVGMetadata(svgContent, mapPath);
      
      const mapData: MapData = {
        svgContent,
        metadata
      };

      // 更新加载进度
      this.updateLoadingProgress(cacheKey, 100);

      // 缓存数据
      this.setCachedItem(cacheKey, mapData);
      
      // 清除加载状态
      this.loadingStates.delete(cacheKey);
      
      console.log(`✅ 地图加载完成: ${mapPath} (${this.formatSize(svgContent.length)})`);
      
      return mapData;
    } catch (error) {
      console.error(`❌ 地图加载失败: ${mapPath}`, error);
      
      // 设置错误状态
      this.loadingStates.set(cacheKey, {
        isLoading: false,
        progress: 0,
        error: error instanceof Error ? error.message : '未知错误'
      });

      // 返回默认地图数据
      return this.getDefaultMapData(mapPath);
    }
  }

  /**
   * 等待加载完成
   */
  private async waitForLoading(cacheKey: string): Promise<MapData> {
    return new Promise((resolve, reject) => {
      const checkLoading = () => {
        const loadingState = this.loadingStates.get(cacheKey);
        const cached = this.getCachedItem(cacheKey);
        
        if (cached) {
          resolve(cached);
        } else if (loadingState?.error) {
          reject(new Error(loadingState.error));
        } else if (loadingState?.isLoading) {
          setTimeout(checkLoading, 100);
        } else {
          reject(new Error('加载状态异常'));
        }
      };
      
      checkLoading();
    });
  }

  /**
   * 启动预加载
   */
  private async startPreloading(): Promise<void> {
    if (this.isPreloading || this.preloadQueue.length === 0) {
      return;
    }

    this.isPreloading = true;
    console.log(`🚀 开始预加载 ${this.preloadQueue.length} 个地图`);

    while (this.preloadQueue.length > 0) {
      const mapPath = this.preloadQueue.shift()!;
      
      try {
        await this.loadMapData(mapPath, 'low');
        // 预加载间隔，避免阻塞主线程
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.warn(`预加载失败: ${mapPath}`, error);
      }
    }

    this.isPreloading = false;
    console.log('✅ 预加载完成');
  }

  /**
   * 获取缓存项
   */
  private getCachedItem(key: string): MapData | null {
    const item = this.cache.get(key);
    if (!item) return null;

    // 检查是否过期
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      this.currentCacheSize -= item.size;
      return null;
    }

    return item.data;
  }

  /**
   * 设置缓存项
   */
  private setCachedItem(key: string, data: MapData, ttl: number = this.defaultTTL): void {
    const size = this.calculateSize(data);
    
    // 检查缓存空间
    this.ensureCacheSpace(size);
    
    const item: CacheItem<MapData> = {
      data,
      timestamp: Date.now(),
      ttl,
      size
    };

    this.cache.set(key, item);
    this.currentCacheSize += size;
    
    console.log(`💾 缓存地图数据: ${key} (${this.formatSize(size)})`);
  }

  /**
   * 确保缓存空间
   */
  private ensureCacheSpace(requiredSize: number): void {
    if (this.currentCacheSize + requiredSize <= this.maxCacheSize) {
      return;
    }

    console.log('🧹 清理缓存空间...');
    
    // 按时间戳排序，删除最旧的项
    const sortedEntries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp);

    for (const [key, item] of sortedEntries) {
      this.cache.delete(key);
      this.currentCacheSize -= item.size;
      
      if (this.currentCacheSize + requiredSize <= this.maxCacheSize) {
        break;
      }
    }
    
    console.log(`✅ 缓存清理完成，当前大小: ${this.formatSize(this.currentCacheSize)}`);
  }

  /**
   * 解析SVG元数据
   */
  private parseSVGMetadata(svgContent: string, mapPath: string): MapData['metadata'] {
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
    const svgElement = svgDoc.documentElement;

    // 获取尺寸信息
    const viewBox = svgElement.getAttribute('viewBox');
    const [, , width = 1200, height = 800] = viewBox ? viewBox.split(' ').map(Number) : [];

    // 提取部门信息
    const department = mapPath.includes('engineering') ? 'Engineering' :
                     mapPath.includes('marketing') ? 'Marketing' :
                     mapPath.includes('sales') ? 'Sales' :
                     mapPath.includes('hr') ? 'HR' : 'Unknown';

    return {
      width,
      height,
      department,
      version: '1.0',
      lastModified: new Date().toISOString()
    };
  }

  /**
   * 获取默认地图数据
   */
  private getDefaultMapData(mapPath: string): MapData {
    const defaultSVG = `
      <svg width="800" height="600" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
        <rect width="800" height="600" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2"/>
        <text x="400" y="300" text-anchor="middle" font-size="24" fill="#6b7280">
          地图加载失败
        </text>
        <text x="400" y="330" text-anchor="middle" font-size="16" fill="#9ca3af">
          ${mapPath}
        </text>
      </svg>
    `;

    return {
      svgContent: defaultSVG,
      metadata: {
        width: 800,
        height: 600,
        department: 'Unknown',
        version: '1.0',
        lastModified: new Date().toISOString()
      }
    };
  }

  /**
   * 带超时的fetch
   */
  private async fetchWithTimeout(url: string, timeout: number): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: 'force-cache' // 利用浏览器缓存
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * 更新加载进度
   */
  private updateLoadingProgress(cacheKey: string, progress: number): void {
    const loadingState = this.loadingStates.get(cacheKey);
    if (loadingState) {
      loadingState.progress = progress;
    }
  }

  /**
   * 计算数据大小
   */
  private calculateSize(data: MapData): number {
    return new Blob([JSON.stringify(data)]).size;
  }

  /**
   * 格式化大小显示
   */
  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * 获取缓存键
   */
  private getCacheKey(mapPath: string): string {
    return `map:${mapPath}`;
  }

  /**
   * 启动缓存清理定时器
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      let cleanedSize = 0;
      let cleanedCount = 0;

      for (const [key, item] of this.cache.entries()) {
        if (now - item.timestamp > item.ttl) {
          this.cache.delete(key);
          this.currentCacheSize -= item.size;
          cleanedSize += item.size;
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        console.log(`🧹 定时清理缓存: ${cleanedCount} 项, ${this.formatSize(cleanedSize)}`);
      }
    }, 5 * 60 * 1000); // 每5分钟清理一次
  }

  /**
   * 监控内存使用情况
   */
  private monitorMemoryUsage(): void {
    if ('memory' in performance) {
      setInterval(() => {
        const memory = (performance as any).memory;
        const usedMB = memory.usedJSHeapSize / 1024 / 1024;
        const totalMB = memory.totalJSHeapSize / 1024 / 1024;
        const limitMB = memory.jsHeapSizeLimit / 1024 / 1024;

        // 如果内存使用超过80%，主动清理缓存
        if (usedMB / limitMB > 0.8) {
          console.warn('⚠️ 内存使用率过高，主动清理缓存');
          this.clearOldCache();
        }
      }, 30 * 1000); // 每30秒检查一次
    }
  }

  /**
   * 清理旧缓存
   */
  private clearOldCache(): void {
    const now = Date.now();
    const oldThreshold = 10 * 60 * 1000; // 10分钟

    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > oldThreshold) {
        this.cache.delete(key);
        this.currentCacheSize -= item.size;
      }
    }
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): {
    size: number;
    count: number;
    maxSize: number;
    hitRate: number;
    loadingCount: number;
  } {
    return {
      size: this.currentCacheSize,
      count: this.cache.size,
      maxSize: this.maxCacheSize,
      hitRate: 0, // 可以添加命中率统计
      loadingCount: this.loadingStates.size
    };
  }

  /**
   * 清除所有缓存
   */
  clearCache(): void {
    this.cache.clear();
    this.currentCacheSize = 0;
    this.loadingStates.clear();
    console.log('🗑️ 已清除所有地图缓存');
  }

  /**
   * 获取加载状态
   */
  getLoadingState(mapPath: string): LoadingState | null {
    const cacheKey = this.getCacheKey(mapPath);
    return this.loadingStates.get(cacheKey) || null;
  }
}

// 导出单例实例
export const mapCacheService = MapCacheService.getInstance();