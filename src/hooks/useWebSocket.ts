import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface ServerMetrics {
  cpu: {
    usage: number;
    cores: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
  };
  disk: {
    drives: Array<{
      filesystem: string;
      size: number;
      used: number;
      available: number;
      usagePercent: number;
      mountpoint: string;
    }>;
  };
  network: {
    interfaces: Array<{
      name: string;
      address: string;
      netmask: string;
      family: string;
      mac: string;
      internal: boolean;
      cidr: string;
    }>;
  };
  processes: Array<{
    pid: number;
    name: string;
    cpu: number;
    memory: number;
    status: string;
  }>;
  timestamp: string;
}

interface SystemLog {
  id: number;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'debug';
  source: string;
  message: string;
}

interface CrossSystemData {
  source: 'M1' | 'local';
  type: 'employee' | 'workstation' | 'department';
  action: 'create' | 'update' | 'delete';
  data: any;
  timestamp: string;
}

interface UseWebSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  metrics: ServerMetrics | null;
  logs: SystemLog[];
  error: string | null;
  crossSystemData: CrossSystemData[];
  requestMetrics: () => void;
  requestLogs: (params?: { level?: string; limit?: number }) => void;
  requestProcessInfo: () => void;
  subscribeToCrossSystemUpdates: () => void;
  unsubscribeFromCrossSystemUpdates: () => void;
}

const useWebSocket = (url: string = 'http://localhost:8080'): UseWebSocketReturn => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [metrics, setMetrics] = useState<ServerMetrics | null>(null);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [crossSystemData, setCrossSystemData] = useState<CrossSystemData[]>([]);

  useEffect(() => {
    // 创建WebSocket连接
    const socket = io(url, {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      timeout: 20000,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10
    });

    socketRef.current = socket;

    // 连接事件处理
    socket.on('connect', () => {
      console.log('WebSocket连接已建立:', socket.id);
      setIsConnected(true);
      setError(null);
    });

    socket.on('disconnect', (reason) => {
      console.log('WebSocket连接已断开:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('WebSocket连接错误:', err);
      setError(`连接错误: ${err.message}`);
      setIsConnected(false);
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('WebSocket重新连接成功:', attemptNumber);
      setIsConnected(true);
      setError(null);
    });

    socket.on('reconnect_error', (err) => {
      console.error('WebSocket重连失败:', err);
      setError(`重连失败: ${err.message}`);
    });

    // 数据事件处理
    socket.on('metrics-update', (data: ServerMetrics) => {
      setMetrics(data);
    });

    socket.on('metrics-error', (data: { error: string; timestamp: string }) => {
      console.error('Metrics错误:', data.error);
      setError(data.error);
    });

    socket.on('system-logs', (data: SystemLog[]) => {
      setLogs(data);
    });

    socket.on('process-info', (data: any) => {
      // 处理进程信息更新
      if (metrics) {
        setMetrics({
          ...metrics,
          processes: data,
          timestamp: new Date().toISOString()
        });
      }
    });

    // 跨系统数据同步事件处理
    socket.on('cross-system-update', (data: CrossSystemData) => {
      console.log('收到跨系统数据更新:', data);
      setCrossSystemData(prev => {
        // 保留最近100条记录
        const updated = [data, ...prev].slice(0, 100);
        return updated;
      });
    });

    socket.on('cross-system-error', (data: { error: string; timestamp: string }) => {
      console.error('跨系统同步错误:', data.error);
      setError(`跨系统同步错误: ${data.error}`);
    });

    socket.on('cross-system-status', (data: { status: string; systems: any[] }) => {
      console.log('跨系统状态更新:', data);
    });

    // 清理函数
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [url]);

  // 请求实时指标数据
  const requestMetrics = () => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('request-metrics');
    }
  };

  // 请求系统日志
  const requestLogs = (params: { level?: string; limit?: number } = {}) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('request-logs', params);
    }
  };

  // 请求进程信息
  const requestProcessInfo = () => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('request-process-info');
    }
  };

  // 订阅跨系统数据更新
  const subscribeToCrossSystemUpdates = () => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('subscribe-cross-system-updates');
    }
  };

  // 取消订阅跨系统数据更新
  const unsubscribeFromCrossSystemUpdates = () => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('unsubscribe-cross-system-updates');
    }
  };

  return {
    socket: socketRef.current,
    isConnected,
    metrics,
    logs,
    error,
    crossSystemData,
    requestMetrics,
    requestLogs,
    requestProcessInfo,
    subscribeToCrossSystemUpdates,
    unsubscribeFromCrossSystemUpdates
  };
};

export default useWebSocket;
export type { ServerMetrics, SystemLog, CrossSystemData, UseWebSocketReturn };