// 跨系统查询React Hook
// 为前端组件提供便捷的跨系统查询功能

import { useState, useEffect, useCallback, useRef } from 'react';
import { crossSystemQuery } from '../services/crossSystemQuery';

interface CrossSystemQueryState {
  loading: boolean;
  data: any;
  error: string | null;
  lastUpdated: string | null;
}

interface UseCrossSystemQueryOptions {
  autoRefresh?: boolean;
  refreshInterval?: number; // 毫秒
  retryOnError?: boolean;
  maxRetries?: number;
}

interface UseCrossSystemQueryReturn {
  // 状态
  loading: boolean;
  data: any;
  error: string | null;
  lastUpdated: string | null;
  connectionStatus: Record<string, boolean>;
  
  // 方法
  searchEmployee: (name: string, filters?: any) => Promise<any[]>;
  queryWorkstations: (department: string, targetSystem?: string) => Promise<any>;
  syncStatus: (department?: string) => Promise<any>;
  broadcastData: (data: any, excludeSystem?: string) => void;
  refresh: () => void;
  clearError: () => void;
  reconnect: () => void;
}

/**
 * 跨系统查询Hook
 */
export const useCrossSystemQuery = (
  options: UseCrossSystemQueryOptions = {}
): UseCrossSystemQueryReturn => {
  const {
    autoRefresh = false,
    refreshInterval = 30000, // 30秒
    retryOnError = true,
    maxRetries = 3
  } = options;

  const [state, setState] = useState<CrossSystemQueryState>({
    loading: false,
    data: null,
    error: null,
    lastUpdated: null
  });

  const [connectionStatus, setConnectionStatus] = useState<Record<string, boolean>>({});
  const retryCountRef = useRef(0);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 更新连接状态
  const updateConnectionStatus = useCallback(() => {
    const status = crossSystemQuery.getConnectionStatus();
    setConnectionStatus(status);
  }, []);

  // 设置加载状态
  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, loading }));
  }, []);

  // 设置数据
  const setData = useCallback((data: any) => {
    setState(prev => ({
      ...prev,
      data,
      error: null,
      lastUpdated: new Date().toISOString()
    }));
    retryCountRef.current = 0;
  }, []);

  // 设置错误
  const setError = useCallback((error: string) => {
    setState(prev => ({
      ...prev,
      error,
      loading: false
    }));
  }, []);

  // 清除错误
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // 员工搜索
  const searchEmployee = useCallback(async (name: string, filters?: any): Promise<any[]> => {
    if (!name.trim()) {
      setError('搜索关键词不能为空');
      return [];
    }

    setLoading(true);
    clearError();

    try {
      const results = await crossSystemQuery.searchEmployeeAcrossSystems(name, filters);
      setData(results);
      return results;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '员工搜索失败';
      setError(errorMessage);
      
      if (retryOnError && retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        console.log(`重试员工搜索 (${retryCountRef.current}/${maxRetries})`);
        // 延迟重试
        setTimeout(() => searchEmployee(name, filters), 1000 * retryCountRef.current);
      }
      
      return [];
    } finally {
      setLoading(false);
    }
  }, [retryOnError, maxRetries, setLoading, clearError, setData, setError]);

  // 工位查询
  const queryWorkstations = useCallback(async (
    department: string,
    targetSystem?: string
  ): Promise<any> => {
    if (!department.trim()) {
      setError('部门名称不能为空');
      return null;
    }

    setLoading(true);
    clearError();

    try {
      const target = targetSystem as 'dept_map_5175' | 'm1_server_3000' || 'dept_map_5175';
      const result = await crossSystemQuery.executeQuery(
        target,
        'workstation_query',
        department
      );
      setData(result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '工位查询失败';
      setError(errorMessage);
      
      if (retryOnError && retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        console.log(`重试工位查询 (${retryCountRef.current}/${maxRetries})`);
        setTimeout(() => queryWorkstations(department, targetSystem), 1000 * retryCountRef.current);
      }
      
      return null;
    } finally {
      setLoading(false);
    }
  }, [retryOnError, maxRetries, setLoading, clearError, setData, setError]);

  // 状态同步
  const syncStatus = useCallback(async (department?: string): Promise<any> => {
    setLoading(true);
    clearError();

    try {
      const result = await crossSystemQuery.syncWorkstationStatus(department);
      setData(result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '状态同步失败';
      setError(errorMessage);
      
      if (retryOnError && retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        console.log(`重试状态同步 (${retryCountRef.current}/${maxRetries})`);
        setTimeout(() => syncStatus(department), 1000 * retryCountRef.current);
      }
      
      return null;
    } finally {
      setLoading(false);
    }
  }, [retryOnError, maxRetries, setLoading, clearError, setData, setError]);

  // 广播数据
  const broadcastData = useCallback((data: any, excludeSystem?: string) => {
    try {
      crossSystemQuery.broadcastToOtherSystems(data, excludeSystem);
    } catch (error) {
      console.error('广播数据失败:', error);
      setError('广播数据失败');
    }
  }, [setError]);

  // 刷新数据
  const refresh = useCallback(() => {
    updateConnectionStatus();
    // 可以根据需要刷新最后一次查询的数据
  }, [updateConnectionStatus]);

  // 重新连接
  const reconnect = useCallback(() => {
    crossSystemQuery.reconnectAll();
    updateConnectionStatus();
  }, [updateConnectionStatus]);

  // 监听跨系统广播事件
  useEffect(() => {
    const handleBroadcast = (event: CustomEvent) => {
      console.log('收到跨系统广播:', event.detail);
      // 可以根据广播内容更新本地状态
      setData(event.detail);
    };

    window.addEventListener('cross-system-broadcast', handleBroadcast as EventListener);
    
    return () => {
      window.removeEventListener('cross-system-broadcast', handleBroadcast as EventListener);
    };
  }, [setData]);

  // 自动刷新
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      refreshTimerRef.current = setInterval(() => {
        updateConnectionStatus();
      }, refreshInterval);

      return () => {
        if (refreshTimerRef.current) {
          clearInterval(refreshTimerRef.current);
        }
      };
    }
  }, [autoRefresh, refreshInterval, updateConnectionStatus]);

  // 初始化连接状态
  useEffect(() => {
    updateConnectionStatus();
  }, [updateConnectionStatus]);

  // 清理
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, []);

  return {
    // 状态
    loading: state.loading,
    data: state.data,
    error: state.error,
    lastUpdated: state.lastUpdated,
    connectionStatus,
    
    // 方法
    searchEmployee,
    queryWorkstations,
    syncStatus,
    broadcastData,
    refresh,
    clearError,
    reconnect
  };
};

/**
 * 简化的员工搜索Hook
 */
export const useCrossSystemEmployeeSearch = () => {
  const {
    searchEmployee,
    loading,
    data,
    error,
    clearError
  } = useCrossSystemQuery({
    retryOnError: true,
    maxRetries: 2
  });

  return {
    searchEmployee,
    loading,
    results: data || [],
    error,
    clearError
  };
};

/**
 * 实时状态同步Hook
 */
export const useCrossSystemStatusSync = (department?: string) => {
  const {
    syncStatus,
    loading,
    data,
    error,
    connectionStatus,
    refresh
  } = useCrossSystemQuery({
    autoRefresh: true,
    refreshInterval: 60000, // 1分钟
    retryOnError: true
  });

  // 自动同步状态
  useEffect(() => {
    syncStatus(department);
  }, [department, syncStatus]);

  return {
    syncStatus: () => syncStatus(department),
    loading,
    statusData: data,
    error,
    connectionStatus,
    refresh
  };
};

export default useCrossSystemQuery;