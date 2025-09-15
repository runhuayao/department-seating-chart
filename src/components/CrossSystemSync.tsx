import React, { useState, useEffect, useRef } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertCircle, CheckCircle, Clock, Activity } from 'lucide-react';

interface SyncEvent {
  id: string;
  type: 'data_change' | 'sync_request' | 'sync_response' | 'connection';
  source: string;
  target: string;
  data: any;
  timestamp: string;
  status: 'pending' | 'success' | 'error';
}

interface ConnectionStatus {
  port: number;
  connected: boolean;
  lastPing: string;
  latency: number;
}

const CrossSystemSync: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [syncEvents, setSyncEvents] = useState<SyncEvent[]>([]);
  const [connections, setConnections] = useState<ConnectionStatus[]>([]);
  const [autoSync, setAutoSync] = useState(true);
  const [syncInterval, setSyncInterval] = useState(5000);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // WebSocket连接管理
  const connectWebSocket = () => {
    try {
      const wsUrl = `ws://localhost:8080/ws/data-sync`;
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('WebSocket连接已建立');
        setIsConnected(true);
        setError(null);
        
        // 发送初始化消息
        if (wsRef.current) {
          wsRef.current.send(JSON.stringify({
            type: 'init',
            clientId: `client-${Date.now()}`,
            port: 5173
          }));
        }
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (err) {
          console.error('解析WebSocket消息失败:', err);
        }
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket连接已关闭');
        setIsConnected(false);
        
        // 自动重连
        if (autoSync) {
          setTimeout(connectWebSocket, 3000);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket错误:', error);
        setError('WebSocket连接错误');
        setIsConnected(false);
      };
    } catch (err) {
      console.error('创建WebSocket连接失败:', err);
      setError('无法创建WebSocket连接');
    }
  };

  // 处理WebSocket消息
  const handleWebSocketMessage = (data: any) => {
    switch (data.type) {
      case 'sync_event':
        addSyncEvent({
          id: data.id || `event-${Date.now()}`,
          type: data.eventType,
          source: data.source,
          target: data.target,
          data: data.payload,
          timestamp: data.timestamp || new Date().toISOString(),
          status: data.status || 'success'
        });
        break;
        
      case 'connection_status':
        setConnections(data.connections || []);
        break;
        
      case 'sync_complete':
        setLastSyncTime(new Date().toISOString());
        break;
        
      case 'error':
        setError(data.message);
        break;
        
      default:
        console.log('未知消息类型:', data.type);
    }
  };

  // 添加同步事件
  const addSyncEvent = (event: SyncEvent) => {
    setSyncEvents(prev => {
      const newEvents = [event, ...prev].slice(0, 100); // 保留最近100条记录
      return newEvents;
    });
  };

  // 手动触发同步
  const triggerSync = async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError('WebSocket未连接');
      return;
    }

    try {
      wsRef.current.send(JSON.stringify({
        type: 'sync_request',
        timestamp: new Date().toISOString(),
        source: 5173,
        targets: [3000, 8080]
      }));
      
      addSyncEvent({
        id: `sync-${Date.now()}`,
        type: 'sync_request',
        source: '5173',
        target: 'all',
        data: { manual: true },
        timestamp: new Date().toISOString(),
        status: 'pending'
      });
    } catch (err) {
      setError('发送同步请求失败');
    }
  };

  // 测试连接
  const testConnection = async (port: number) => {
    try {
      const startTime = Date.now();
      const response = await fetch(`http://localhost:${port}/api/health`, {
        method: 'GET',
        timeout: 5000
      } as any);
      
      const latency = Date.now() - startTime;
      const connected = response.ok;
      
      setConnections(prev => {
        const updated = prev.filter(c => c.port !== port);
        updated.push({
          port,
          connected,
          lastPing: new Date().toISOString(),
          latency
        });
        return updated.sort((a, b) => a.port - b.port);
      });
    } catch (err) {
      setConnections(prev => {
        const updated = prev.filter(c => c.port !== port);
        updated.push({
          port,
          connected: false,
          lastPing: new Date().toISOString(),
          latency: -1
        });
        return updated.sort((a, b) => a.port - b.port);
      });
    }
  };

  // 测试所有连接
  const testAllConnections = () => {
    [3000, 8080].forEach(port => testConnection(port));
  };

  // 组件初始化
  useEffect(() => {
    connectWebSocket();
    testAllConnections();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // 自动同步定时器
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    if (autoSync && isConnected) {
      intervalRef.current = setInterval(() => {
        testAllConnections();
      }, syncInterval);
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoSync, isConnected, syncInterval]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500 animate-pulse" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getConnectionIcon = (connected: boolean) => {
    return connected ? (
      <Wifi className="w-4 h-4 text-green-500" />
    ) : (
      <WifiOff className="w-4 h-4 text-red-500" />
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* 连接状态 */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5" />
            跨系统数据同步
          </h2>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <div className="flex items-center gap-2 text-green-600">
                <Wifi className="w-4 h-4" />
                <span className="text-sm">已连接</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-red-600">
                <WifiOff className="w-4 h-4" />
                <span className="text-sm">未连接</span>
              </div>
            )}
          </div>
        </div>

        {/* 错误信息 */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="w-4 h-4" />
              {error}
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-600 hover:text-red-800"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* 控制面板 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={autoSync}
                onChange={(e) => setAutoSync(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">自动同步</span>
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              同步间隔 (毫秒)
            </label>
            <input
              type="number"
              value={syncInterval}
              onChange={(e) => setSyncInterval(parseInt(e.target.value) || 5000)}
              min="1000"
              max="60000"
              step="1000"
              className="w-full px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={triggerSync}
              disabled={!isConnected}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className="w-4 h-4" />
              手动同步
            </button>
            <button
              onClick={testAllConnections}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              <Activity className="w-4 h-4" />
              测试连接
            </button>
          </div>
        </div>

        {/* 连接状态 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {connections.map((conn) => (
            <div key={conn.port} className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getConnectionIcon(conn.connected)}
                  <span className="font-medium">端口 {conn.port}</span>
                </div>
                <span className={`text-sm px-2 py-1 rounded ${
                  conn.connected 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {conn.connected ? '在线' : '离线'}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                <div>延迟: {conn.latency >= 0 ? `${conn.latency}ms` : 'N/A'}</div>
                <div>最后检测: {new Date(conn.lastPing).toLocaleTimeString()}</div>
              </div>
            </div>
          ))}
        </div>

        {lastSyncTime && (
          <div className="mt-4 text-sm text-gray-600">
            最后同步时间: {new Date(lastSyncTime).toLocaleString()}
          </div>
        )}
      </div>

      {/* 同步事件日志 */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold mb-4">同步事件日志</h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {syncEvents.length === 0 ? (
            <div className="text-gray-500 text-center py-4">暂无同步事件</div>
          ) : (
            syncEvents.map((event) => (
              <div key={event.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                <div className="flex items-center gap-3">
                  {getStatusIcon(event.status)}
                  <div>
                    <div className="font-medium">{event.type}</div>
                    <div className="text-sm text-gray-600">
                      {event.source} → {event.target}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </div>
                  {event.data && (
                    <div className="text-xs text-gray-400">
                      {JSON.stringify(event.data).length} chars
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default CrossSystemSync;