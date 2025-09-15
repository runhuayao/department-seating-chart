/**
 * 部门数据同步Hook
 * 通过WebSocket实现前后端部门数据实时同步
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';

interface Department {
  id: string;
  name: string;
  english_name: string;
  description?: string;
  manager?: string;
  location?: string;
  employee_count?: number;
  created_at?: string;
  updated_at?: string;
}

interface WebSocketMessage {
  type: string;
  action?: string;
  data?: any;
  message?: string;
  timestamp?: string;
  error?: string;
}

interface UseDepartmentSyncOptions {
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onDepartmentUpdate?: (department: Department, action: string) => void;
  onMappingUpdate?: (mappingData: any) => void;
  onConnectionChange?: (connected: boolean) => void;
}

export function useDepartmentSync(options: UseDepartmentSyncOptions = {}) {
  const {
    autoReconnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
    onDepartmentUpdate,
    onMappingUpdate,
    onConnectionChange
  } = options;

  const [connected, setConnected] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const mountedRef = useRef(true);

  // 连接WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/department-sync`;
      
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        if (!mountedRef.current) return;
        
        console.log('部门同步WebSocket连接成功');
        setConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
        onConnectionChange?.(true);
        
        // 订阅部门更新
        wsRef.current?.send(JSON.stringify({ type: 'subscribe' }));
        
        // 获取初始部门数据
        wsRef.current?.send(JSON.stringify({ type: 'get_departments' }));
      };

      wsRef.current.onmessage = (event) => {
        if (!mountedRef.current) return;
        
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (error) {
          console.error('解析WebSocket消息失败:', error);
        }
      };

      wsRef.current.onclose = () => {
        if (!mountedRef.current) return;
        
        console.log('部门同步WebSocket连接关闭');
        setConnected(false);
        onConnectionChange?.(false);
        
        // 自动重连
        if (autoReconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          console.log(`尝试重连 (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              connect();
            }
          }, reconnectInterval);
        }
      };

      wsRef.current.onerror = (error) => {
        if (!mountedRef.current) return;
        
        console.error('部门同步WebSocket错误:', error);
        setError('WebSocket连接错误');
      };

    } catch (error) {
      console.error('创建WebSocket连接失败:', error);
      setError('无法创建WebSocket连接');
    }
  }, [autoReconnect, reconnectInterval, maxReconnectAttempts, onConnectionChange]);

  // 处理WebSocket消息
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    const { type, action, data, message: msg, error: errorMsg } = message;

    switch (type) {
      case 'connection':
        console.log('WebSocket连接确认:', msg);
        break;

      case 'subscribed':
        console.log('已订阅部门更新通知');
        break;

      case 'departments_data':
        if (data && Array.isArray(data)) {
          setDepartments(data);
          setLoading(false);
        }
        break;

      case 'department_updated':
        if (data && action) {
          handleDepartmentUpdate(data, action);
          onDepartmentUpdate?.(data, action);
        }
        break;

      case 'mapping_updated':
        if (data) {
          console.log('部门映射已更新:', data);
          onMappingUpdate?.(data);
          toast.success('部门映射配置已更新');
        }
        break;

      case 'error':
        console.error('WebSocket错误:', errorMsg);
        setError(errorMsg || '未知错误');
        toast.error(errorMsg || 'WebSocket通信错误');
        break;

      case 'pong':
        // 心跳响应
        break;

      default:
        console.log('未知WebSocket消息类型:', type);
    }
  }, [onDepartmentUpdate, onMappingUpdate]);

  // 处理部门更新
  const handleDepartmentUpdate = useCallback((department: Department, action: string) => {
    setDepartments(prev => {
      switch (action) {
        case 'create':
          toast.success(`新增部门: ${department.name}`);
          return [...prev, department];
          
        case 'update':
          toast.success(`部门信息已更新: ${department.name}`);
          return prev.map(dept => 
            dept.id === department.id ? { ...dept, ...department } : dept
          );
          
        case 'delete':
          toast.info(`部门已删除: ${department.name}`);
          return prev.filter(dept => dept.id !== department.id);
          
        default:
          return prev;
      }
    });
  }, []);

  // 断开连接
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setConnected(false);
    onConnectionChange?.(false);
  }, [onConnectionChange]);

  // 发送心跳
  const sendPing = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'ping' }));
    }
  }, []);

  // 手动刷新部门数据
  const refreshDepartments = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setLoading(true);
      wsRef.current.send(JSON.stringify({ type: 'get_departments' }));
    }
  }, []);

  // 初始化连接
  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    connect();

    // 设置心跳
    const heartbeatInterval = setInterval(sendPing, 30000);

    return () => {
      mountedRef.current = false;
      clearInterval(heartbeatInterval);
      disconnect();
    };
  }, [connect, disconnect, sendPing]);

  return {
    connected,
    departments,
    loading,
    error,
    connect,
    disconnect,
    refreshDepartments,
    sendPing
  };
}

export default useDepartmentSync;