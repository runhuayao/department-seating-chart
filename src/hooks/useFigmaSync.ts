import { useState, useEffect, useCallback } from 'react';
import figmaIntegrationService from '../services/figmaIntegrationService';

interface FigmaSyncState {
  isConnected: boolean;
  lastSyncTime: string | null;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  errorMessage: string | null;
  pendingChanges: number;
}

interface FigmaSyncHookReturn {
  syncState: FigmaSyncState;
  triggerSync: (department: string) => Promise<void>;
  subscribeDepartment: (department: string) => void;
  unsubscribeDepartment: (department: string) => void;
}

// Figma实时同步Hook
export const useFigmaSync = (department?: string): FigmaSyncHookReturn => {
  const [syncState, setSyncState] = useState<FigmaSyncState>({
    isConnected: false,
    lastSyncTime: null,
    syncStatus: 'idle',
    errorMessage: null,
    pendingChanges: 0
  });

  // 监听Figma同步更新事件
  useEffect(() => {
    const handleFigmaUpdate = (event: CustomEvent) => {
      const { department: updatedDept, workstations, timestamp } = event.detail;
      
      if (!department || department === updatedDept) {
        setSyncState(prev => ({
          ...prev,
          lastSyncTime: timestamp,
          syncStatus: 'success',
          pendingChanges: workstations.length,
          errorMessage: null
        }));

        console.log(`🔄 Figma同步更新 - 部门: ${updatedDept}, 工位: ${workstations.length}`);
      }
    };

    window.addEventListener('figma-sync-update', handleFigmaUpdate as EventListener);
    
    return () => {
      window.removeEventListener('figma-sync-update', handleFigmaUpdate as EventListener);
    };
  }, [department]);

  // 检查同步状态
  const checkSyncStatus = useCallback(async (dept: string) => {
    try {
      const response = await fetch(`/api/figma/sync-status/${dept}`);
      const result = await response.json();

      if (result.success) {
        setSyncState(prev => ({
          ...prev,
          isConnected: true,
          lastSyncTime: result.data.syncData?.lastSyncTime || null,
          syncStatus: result.data.hasErrors ? 'error' : 'success',
          errorMessage: result.data.hasErrors ? '同步过程中发现错误' : null,
          pendingChanges: result.data.errors?.length || 0
        }));
      }
    } catch (error) {
      console.error('检查同步状态失败:', error);
      setSyncState(prev => ({
        ...prev,
        isConnected: false,
        syncStatus: 'error',
        errorMessage: error.message
      }));
    }
  }, []);

  // 触发手动同步
  const triggerSync = useCallback(async (dept: string) => {
    try {
      setSyncState(prev => ({ ...prev, syncStatus: 'syncing' }));

      const response = await fetch(`/api/figma/trigger-sync/${dept}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (result.success) {
        setSyncState(prev => ({
          ...prev,
          syncStatus: 'success',
          lastSyncTime: result.data.triggerTime,
          errorMessage: null
        }));

        console.log(`✅ 手动同步触发成功 - 部门: ${dept}`);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('触发同步失败:', error);
      setSyncState(prev => ({
        ...prev,
        syncStatus: 'error',
        errorMessage: error.message
      }));
    }
  }, []);

  // 订阅部门同步
  const subscribeDepartment = useCallback((dept: string) => {
    console.log(`📡 订阅部门同步 - 部门: ${dept}`);
    checkSyncStatus(dept);
    
    // 定期检查同步状态
    const interval = setInterval(() => {
      checkSyncStatus(dept);
    }, 30000); // 30秒检查一次

    return () => clearInterval(interval);
  }, [checkSyncStatus]);

  // 取消订阅部门同步
  const unsubscribeDepartment = useCallback((dept: string) => {
    console.log(`📡 取消订阅部门同步 - 部门: ${dept}`);
    // 这里可以添加取消订阅的逻辑
  }, []);

  // 初始化同步状态检查
  useEffect(() => {
    if (department) {
      const cleanup = subscribeDepartment(department);
      return cleanup;
    }
  }, [department, subscribeDepartment]);

  return {
    syncState,
    triggerSync,
    subscribeDepartment,
    unsubscribeDepartment
  };
};

export default useFigmaSync;