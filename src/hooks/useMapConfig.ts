import { useState, useEffect } from 'react';

interface MapContainerConfig {
  width?: number;
  height?: number;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
}

interface MapConfigHook {
  config: MapContainerConfig | null;
  loading: boolean;
  error: string | null;
  updateConfig: (newConfig: Partial<MapContainerConfig>) => Promise<void>;
  autoResize: () => Promise<void>;
}

export const useMapConfig = (department: string): MapConfigHook => {
  const [config, setConfig] = useState<MapContainerConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 获取地图配置
  const fetchMapConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/maps/department/${department}`);
      const result = await response.json();
      
      if (result.success && result.data.length > 0) {
        const mapData = result.data[0];
        setConfig({
          width: mapData.width,
          height: mapData.height,
          backgroundColor: mapData.background_color,
          borderColor: mapData.border_color,
          borderWidth: mapData.border_width,
          borderRadius: mapData.border_radius
        });
      } else {
        // 使用默认配置
        setConfig({
          width: 560,
          height: 340,
          backgroundColor: '#f8fafc',
          borderColor: '#e2e8f0',
          borderWidth: 2,
          borderRadius: 8
        });
      }
    } catch (err) {
      setError('获取地图配置失败');
      console.error('获取地图配置失败:', err);
      
      // 使用默认配置作为fallback
      setConfig({
        width: 560,
        height: 340,
        backgroundColor: '#f8fafc',
        borderColor: '#e2e8f0',
        borderWidth: 2,
        borderRadius: 8
      });
    } finally {
      setLoading(false);
    }
  };

  // 更新地图配置
  const updateConfig = async (newConfig: Partial<MapContainerConfig>) => {
    try {
      setLoading(true);
      setError(null);
      
      // 获取当前地图ID
      const mapsResponse = await fetch(`/api/maps/department/${department}`);
      const mapsResult = await mapsResponse.json();
      
      if (!mapsResult.success || mapsResult.data.length === 0) {
        throw new Error('未找到地图数据');
      }
      
      const mapId = mapsResult.data[0].id;
      const updatedConfig = { ...config, ...newConfig };
      
      const response = await fetch(`/api/maps/${mapId}/dimensions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          width: updatedConfig.width,
          height: updatedConfig.height,
          background_color: updatedConfig.backgroundColor,
          border_color: updatedConfig.borderColor,
          border_width: updatedConfig.borderWidth,
          border_radius: updatedConfig.borderRadius
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setConfig(updatedConfig);
      } else {
        throw new Error(result.message || '更新配置失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新配置失败');
      console.error('更新地图配置失败:', err);
    } finally {
      setLoading(false);
    }
  };

  // 自动调整尺寸
  const autoResize = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 获取当前地图ID
      const mapsResponse = await fetch(`/api/maps/department/${department}`);
      const mapsResult = await mapsResponse.json();
      
      if (!mapsResult.success || mapsResult.data.length === 0) {
        throw new Error('未找到地图数据');
      }
      
      const mapId = mapsResult.data[0].id;
      
      // 获取自动尺寸建议
      const sizeResponse = await fetch(`/api/maps/${mapId}/auto-size`);
      const sizeResult = await sizeResponse.json();
      
      if (sizeResult.success) {
        const { width, height } = sizeResult.data;
        await updateConfig({ width, height });
      } else {
        throw new Error(sizeResult.message || '获取自动尺寸失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '自动调整尺寸失败');
      console.error('自动调整尺寸失败:', err);
    } finally {
      setLoading(false);
    }
  };

  // 初始化时获取配置
  useEffect(() => {
    if (department) {
      fetchMapConfig();
    }
  }, [department]);

  return {
    config,
    loading,
    error,
    updateConfig,
    autoResize
  };
};