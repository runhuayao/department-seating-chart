import React, { useState, useEffect, useRef } from 'react';
import { 
  Server, 
  Monitor, 
  Database, 
  Users, 
  BarChart3, 
  Shield, 
  Terminal, 
  Settings,
  Activity,
  Cpu,
  HardDrive,
  Wifi,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Eye,
  EyeOff,
  RefreshCw,
  Power,
  Trash2,
  Edit,
  Plus,
  MapPin,
  Bell,
  Search,
  Menu,
  X,
  Play,
  Square
} from 'lucide-react';
import ServerMonitor from '../components/ServerMonitor';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, BarElement } from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import { io, Socket } from 'socket.io-client';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement
);

interface ServerStatus {
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  uptime: string;
  status: 'online' | 'warning' | 'offline';
}

interface SystemInfo {
  serverName: string;
  ipAddress: string;
  os: string;
  version: string;
  lastUpdate: string;
}

interface DatabaseConnection {
  name: string;
  type: 'PostgreSQL' | 'Redis' | 'MongoDB';
  status: 'connected' | 'disconnected' | 'error';
  host: string;
  port: number;
  database?: string;
  connections?: number;
  maxConnections?: number;
}

interface UserInfo {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'user' | 'viewer';
  department: string;
  lastLogin: string;
  status: 'active' | 'inactive' | 'suspended';
}

interface ServiceInfo {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'error';
  port: number;
  uptime: string;
  cpu: number;
  memory: number;
}

const ServerManagementRoot: React.FC = () => {
  const [activeModule, setActiveModule] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [serverStatus, setServerStatus] = useState<ServerStatus>({
    cpu: 45,
    memory: 68,
    disk: 32,
    network: 78,
    uptime: '15天 8小时 32分钟',
    status: 'online'
  });
  
  const [systemInfo] = useState<SystemInfo>({
    serverName: 'M1-SERVER-001',
    ipAddress: '192.168.1.100',
    os: 'Ubuntu Server 22.04 LTS',
    version: '5.15.0-91-generic',
    lastUpdate: '2024-01-15 14:30:25'
  });

  // 数据库连接状态
  const [databases] = useState<DatabaseConnection[]>([
    {
      name: 'Main Database',
      type: 'PostgreSQL',
      status: 'connected',
      host: 'localhost',
      port: 5432,
      database: 'seating_chart',
      connections: 15,
      maxConnections: 100
    },
    {
      name: 'Cache Server',
      type: 'Redis',
      status: 'connected',
      host: 'localhost',
      port: 6379,
      connections: 8,
      maxConnections: 50
    }
  ]);

  // 用户管理数据
  const [users] = useState<UserInfo[]>([
    {
      id: 1,
      username: 'admin',
      email: 'admin@company.com',
      role: 'admin',
      department: 'IT部门',
      lastLogin: '2024-01-15 09:30:25',
      status: 'active'
    },
    {
      id: 2,
      username: 'john.doe',
      email: 'john.doe@company.com',
      role: 'user',
      department: '研发部',
      lastLogin: '2024-01-15 08:45:12',
      status: 'active'
    },
    {
      id: 3,
      username: 'jane.smith',
      email: 'jane.smith@company.com',
      role: 'viewer',
      department: '人事部',
      lastLogin: '2024-01-14 17:20:33',
      status: 'inactive'
    }
  ]);

  // 服务状态
  const [services] = useState<ServiceInfo[]>([
    {
      id: 'api-server',
      name: 'API服务器',
      status: 'running',
      port: 8080,
      uptime: '15天 8小时',
      cpu: 45,
      memory: 68
    },
    {
      id: 'websocket-server',
      name: 'WebSocket服务',
      status: 'running',
      port: 8081,
      uptime: '15天 8小时',
      cpu: 12,
      memory: 25
    },
    {
      id: 'file-server',
      name: '文件服务器',
      status: 'stopped',
      port: 8082,
      uptime: '0分钟',
      cpu: 0,
      memory: 0
    }
  ]);

  // WebSocket连接状态
  const [wsConnected, setWsConnected] = useState(false);
  const [wsMetrics, setWsMetrics] = useState({
    totalConnections: 0,
    activeConnections: 0,
    messageCount: 0,
    errorCount: 0
  });
  const socketRef = useRef<Socket | null>(null);

  // WebSocket连接管理
  useEffect(() => {
    const connectWebSocket = () => {
      try {
        // 连接到8080端口的WebSocket服务器
        const socket = io('http://localhost:8080', {
          transports: ['websocket', 'polling'],
          timeout: 5000,
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000
        });

        socket.on('connect', () => {
          console.log('WebSocket connected to 8080');
          setWsConnected(true);
          setServices(prev => prev.map(service => 
            service.port === 8080 
              ? { ...service, status: 'running', uptime: '0m' }
              : service
          ));
        });

        socket.on('disconnect', () => {
          console.log('WebSocket disconnected from 8080');
          setWsConnected(false);
          setServices(prev => prev.map(service => 
            service.port === 8080 
              ? { ...service, status: 'stopped', uptime: '0m' }
              : service
          ));
        });

        socket.on('message', (data) => {
          try {
            const message = typeof data === 'string' ? JSON.parse(data) : data;
            
            // 处理系统指标消息
            if (message.type === 'server_metrics') {
              const metrics = message.data;
              setServerStatus(prev => ({
                ...prev,
                cpu: metrics.cpu?.usage || prev.cpu,
                memory: metrics.memory?.usage || prev.memory,
                disk: metrics.disk?.usage || prev.disk,
                network: metrics.network?.bytesIn || prev.network
              }));
            }
            
            // 处理WebSocket指标消息
            if (message.type === 'websocket_metrics') {
              setWsMetrics(message.data);
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        });

        socket.on('connect_error', (error) => {
          console.error('WebSocket connection error:', error);
          setWsConnected(false);
        });

        socketRef.current = socket;
      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        setWsConnected(false);
      }
    };

    // 初始连接
    connectWebSocket();

    // 清理函数
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  // 模拟实时数据更新（作为WebSocket的备用方案）
  useEffect(() => {
    const interval = setInterval(() => {
      // 只有在WebSocket未连接时才使用模拟数据
      if (!wsConnected) {
        setServerStatus(prev => ({
          ...prev,
          cpu: Math.max(10, Math.min(90, prev.cpu + (Math.random() - 0.5) * 10)),
          memory: Math.max(20, Math.min(95, prev.memory + (Math.random() - 0.5) * 8)),
          network: Math.max(5, Math.min(100, prev.network + (Math.random() - 0.5) * 15))
        }));
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [wsConnected]);

  const navigationItems = [
    { id: 'dashboard', label: '仪表板', icon: <Monitor className="w-5 h-5" /> },
    { id: 'servers', label: '服务器', icon: <Server className="w-5 h-5" /> },
    { id: 'monitoring', label: '监控', icon: <Activity className="w-5 h-5" /> },
    { id: 'database', label: '数据库', icon: <Database className="w-5 h-5" /> },
    { id: 'users', label: '用户管理', icon: <Users className="w-5 h-5" /> },
    { id: 'security', label: '安全', icon: <Shield className="w-5 h-5" /> },
    { id: 'analytics', label: '分析', icon: <BarChart3 className="w-5 h-5" /> },
    { id: 'terminal', label: '终端', icon: <Terminal className="w-5 h-5" /> },
    { id: 'settings', label: '设置', icon: <Settings className="w-5 h-5" /> }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-green-500';
      case 'warning': return 'text-yellow-500';
      case 'offline': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getProgressColor = (value: number) => {
    if (value < 50) return 'bg-green-500';
    if (value < 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const renderMainContent = () => {
    switch (activeModule) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">CPU使用率</p>
                    <p className="text-2xl font-bold text-gray-900">{serverStatus.cpu.toFixed(1)}%</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Monitor className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${getProgressColor(serverStatus.cpu)}`}
                      style={{ width: `${serverStatus.cpu}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">内存使用率</p>
                    <p className="text-2xl font-bold text-gray-900">{serverStatus.memory.toFixed(1)}%</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <Database className="w-6 h-6 text-green-600" />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${getProgressColor(serverStatus.memory)}`}
                      style={{ width: `${serverStatus.memory}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">磁盘使用率</p>
                    <p className="text-2xl font-bold text-gray-900">{serverStatus.disk}%</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Server className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${getProgressColor(serverStatus.disk)}`}
                      style={{ width: `${serverStatus.disk}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">网络流量</p>
                    <p className="text-2xl font-bold text-gray-900">{serverStatus.network.toFixed(1)}%</p>
                  </div>
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Activity className="w-6 h-6 text-orange-600" />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${getProgressColor(serverStatus.network)}`}
                      style={{ width: `${serverStatus.network}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">服务器信息</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">服务器名称:</span>
                    <span className="font-medium">{systemInfo.serverName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">IP地址:</span>
                    <span className="font-medium">{systemInfo.ipAddress}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">操作系统:</span>
                    <span className="font-medium">{systemInfo.os}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">内核版本:</span>
                    <span className="font-medium">{systemInfo.version}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">运行时间:</span>
                    <span className="font-medium">{serverStatus.uptime}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">快速操作</h3>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setActiveModule('monitoring')}
                    className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Activity className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                    <p className="text-sm font-medium">实时监控</p>
                  </button>
                  <button 
                    onClick={() => setActiveModule('terminal')}
                    className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Terminal className="w-8 h-8 text-green-600 mx-auto mb-2" />
                    <p className="text-sm font-medium">终端控制</p>
                  </button>
                  <button 
                    onClick={() => setActiveModule('database')}
                    className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Database className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                    <p className="text-sm font-medium">数据库</p>
                  </button>
                  <button 
                    onClick={() => setActiveModule('settings')}
                    className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Settings className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                    <p className="text-sm font-medium">系统设置</p>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'monitoring':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">系统监控</h2>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-sm text-gray-600">
                    WebSocket: {wsConnected ? '已连接' : '未连接'}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${systemInfo.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-sm text-gray-600">
                    {systemInfo.status === 'healthy' ? '系统正常' : '系统异常'}
                  </span>
                </div>
              </div>
            </div>
            
            {/* WebSocket连接状态面板 */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">8080端口监控状态</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-sm text-gray-600">总连接数</p>
                  <p className="text-2xl font-bold text-blue-600">{wsMetrics.totalConnections}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600">活跃连接</p>
                  <p className="text-2xl font-bold text-green-600">{wsMetrics.activeConnections}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600">消息数量</p>
                  <p className="text-2xl font-bold text-purple-600">{wsMetrics.messageCount}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600">错误数量</p>
                  <p className="text-2xl font-bold text-red-600">{wsMetrics.errorCount}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">实时监控</h3>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-gray-600">实时更新</span>
                </div>
              </div>
              <ServerMonitor />
            </div>
          </div>
        );

      case 'servers':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">服务管理</h3>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2">
                  <Plus className="w-4 h-4" />
                  <span>添加服务</span>
                </button>
              </div>
              <div className="space-y-4">
                {services.map((service) => (
                  <div key={service.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className={`w-3 h-3 rounded-full ${
                          service.status === 'running' ? 'bg-green-500' :
                          service.status === 'stopped' ? 'bg-gray-400' : 'bg-red-500'
                        }`}></div>
                        <div>
                          <h4 className="font-medium text-gray-900">{service.name}</h4>
                          <p className="text-sm text-gray-600">端口: {service.port} | 运行时间: {service.uptime}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">CPU: {service.cpu}%</span>
                        <span className="text-sm text-gray-600">内存: {service.memory}%</span>
                        <div className="flex space-x-1">
                          {service.status === 'running' ? (
                            <button className="p-2 text-red-600 hover:bg-red-50 rounded">
                              <Square className="w-4 h-4" />
                            </button>
                          ) : (
                            <button className="p-2 text-green-600 hover:bg-green-50 rounded">
                              <Play className="w-4 h-4" />
                            </button>
                          )}
                          <button className="p-2 text-blue-600 hover:bg-blue-50 rounded">
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-gray-600 hover:bg-gray-50 rounded">
                            <Settings className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'database':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {databases.map((db, index) => (
                <div key={index} className="bg-white rounded-lg shadow-sm border p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${
                        db.status === 'connected' ? 'bg-green-500' :
                        db.status === 'disconnected' ? 'bg-gray-400' : 'bg-red-500'
                      }`}></div>
                      <h3 className="text-lg font-semibold text-gray-900">{db.name}</h3>
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">{db.type}</span>
                    </div>
                    <button className="p-2 text-gray-600 hover:bg-gray-50 rounded">
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">主机:</span>
                      <span className="font-medium">{db.host}:{db.port}</span>
                    </div>
                    {db.database && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">数据库:</span>
                        <span className="font-medium">{db.database}</span>
                      </div>
                    )}
                    {db.connections !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">连接数:</span>
                        <span className="font-medium">{db.connections}/{db.maxConnections}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600">状态:</span>
                      <span className={`font-medium ${
                        db.status === 'connected' ? 'text-green-600' :
                        db.status === 'disconnected' ? 'text-gray-600' : 'text-red-600'
                      }`}>
                        {db.status === 'connected' ? '已连接' :
                         db.status === 'disconnected' ? '未连接' : '错误'}
                      </span>
                    </div>
                  </div>
                  {db.connections !== undefined && (
                    <div className="mt-4">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="h-2 rounded-full bg-blue-500"
                          style={{ width: `${(db.connections / (db.maxConnections || 1)) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">数据库查询</h3>
              <div className="space-y-4">
                <textarea
                  className="w-full h-32 p-3 border border-gray-300 rounded-lg font-mono text-sm"
                  placeholder="输入SQL查询语句..."
                  defaultValue="SELECT * FROM users LIMIT 10;"
                />
                <div className="flex space-x-2">
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    执行查询
                  </button>
                  <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                    清空
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'users':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">用户管理</h3>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2">
                  <Plus className="w-4 h-4" />
                  <span>添加用户</span>
                </button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">用户</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">角色</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">部门</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">最后登录</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                              <Users className="w-5 h-5 text-gray-600" />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{user.username}</div>
                              <div className="text-sm text-gray-500">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            user.role === 'admin' ? 'bg-red-100 text-red-800' :
                            user.role === 'user' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {user.role === 'admin' ? '管理员' : user.role === 'user' ? '用户' : '查看者'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.department}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.lastLogin}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            user.status === 'active' ? 'bg-green-100 text-green-800' :
                            user.status === 'inactive' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {user.status === 'active' ? '活跃' : user.status === 'inactive' ? '非活跃' : '已暂停'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button className="text-blue-600 hover:text-blue-900">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button className="text-green-600 hover:text-green-900">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button className="text-red-600 hover:text-red-900">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );

      case 'analytics':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">系统性能趋势</h3>
                <div className="h-64">
                  <Line
                    data={{
                      labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
                      datasets: [
                        {
                          label: 'CPU使用率',
                          data: [30, 45, 60, 55, 70, 45],
                          borderColor: 'rgb(59, 130, 246)',
                          backgroundColor: 'rgba(59, 130, 246, 0.1)',
                          tension: 0.4,
                        },
                        {
                          label: '内存使用率',
                          data: [40, 50, 65, 60, 75, 50],
                          borderColor: 'rgb(16, 185, 129)',
                          backgroundColor: 'rgba(16, 185, 129, 0.1)',
                          tension: 0.4,
                        }
                      ]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: {
                        y: {
                          beginAtZero: true,
                          max: 100
                        }
                      }
                    }}
                  />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">资源使用分布</h3>
                <div className="h-64">
                  <Doughnut
                    data={{
                      labels: ['CPU', '内存', '磁盘', '网络'],
                      datasets: [{
                        data: [serverStatus.cpu, serverStatus.memory, serverStatus.disk, serverStatus.network],
                        backgroundColor: [
                          'rgba(59, 130, 246, 0.8)',
                          'rgba(16, 185, 129, 0.8)',
                          'rgba(139, 92, 246, 0.8)',
                          'rgba(245, 158, 11, 0.8)'
                        ],
                        borderWidth: 2,
                        borderColor: '#fff'
                      }]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'bottom'
                        }
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">服务状态统计</h3>
              <div className="h-64">
                <Bar
                  data={{
                    labels: services.map(s => s.name),
                    datasets: [
                      {
                        label: 'CPU使用率',
                        data: services.map(s => s.cpu),
                        backgroundColor: 'rgba(59, 130, 246, 0.8)',
                      },
                      {
                        label: '内存使用率',
                        data: services.map(s => s.memory),
                        backgroundColor: 'rgba(16, 185, 129, 0.8)',
                      }
                    ]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      y: {
                        beginAtZero: true,
                        max: 100
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>
        );

      case 'security':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">安全设置</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Shield className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="font-medium">防火墙</p>
                        <p className="text-sm text-gray-600">系统防火墙已启用</p>
                      </div>
                    </div>
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  
                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Shield className="w-5 h-5 text-yellow-600" />
                      <div>
                        <p className="font-medium">SSL证书</p>
                        <p className="text-sm text-gray-600">证书将在30天后过期</p>
                      </div>
                    </div>
                    <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  </div>
                  
                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Shield className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="font-medium">访问控制</p>
                        <p className="text-sm text-gray-600">RBAC权限控制已启用</p>
                      </div>
                    </div>
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">最近安全事件</h4>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <div className="text-sm">
                        <p className="font-medium">成功登录</p>
                        <p className="text-gray-600">admin@company.com - 2分钟前</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 p-3 bg-yellow-50 rounded-lg">
                      <AlertTriangle className="w-4 h-4 text-yellow-600" />
                      <div className="text-sm">
                        <p className="font-medium">异常登录尝试</p>
                        <p className="text-gray-600">未知IP - 1小时前</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'terminal':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">终端控制</h3>
              <div className="bg-black rounded-lg p-4 font-mono text-sm">
                <div className="text-green-400">
                  <p>root@m1-server:~# systemctl status nginx</p>
                  <p className="text-white">● nginx.service - A high performance web server and a reverse proxy server</p>
                  <p className="text-white">   Loaded: loaded (/lib/systemd/system/nginx.service; enabled; vendor preset: enabled)</p>
                  <p className="text-white">   Active: <span className="text-green-400">active (running)</span> since Mon 2024-01-15 09:30:25 UTC; 8h ago</p>
                  <p className="text-white">     Docs: man:nginx(8)</p>
                  <p className="text-white"> Main PID: 1234 (nginx)</p>
                  <p className="text-white">    Tasks: 5 (limit: 4915)</p>
                  <p className="text-white">   Memory: 12.5M</p>
                  <p className="text-white">   CGroup: /system.slice/nginx.service</p>
                  <p className="text-white">           ├─1234 nginx: master process /usr/sbin/nginx -g daemon on; master_process on;</p>
                  <p className="text-white">           └─1235 nginx: worker process</p>
                  <p className="text-green-400 mt-2">root@m1-server:~# <span className="animate-pulse">_</span></p>
                </div>
              </div>
              <div className="mt-4 flex space-x-2">
                <input
                  type="text"
                  placeholder="输入命令..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                />
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  执行
                </button>
              </div>
            </div>
          </div>
        );

      case 'settings':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">系统设置</h3>
              <div className="space-y-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">通知设置</h4>
                  <div className="space-y-3">
                    <label className="flex items-center">
                      <input type="checkbox" className="rounded border-gray-300" defaultChecked />
                      <span className="ml-2 text-sm text-gray-700">系统警告通知</span>
                    </label>
                    <label className="flex items-center">
                      <input type="checkbox" className="rounded border-gray-300" defaultChecked />
                      <span className="ml-2 text-sm text-gray-700">性能监控报告</span>
                    </label>
                    <label className="flex items-center">
                      <input type="checkbox" className="rounded border-gray-300" />
                      <span className="ml-2 text-sm text-gray-700">维护提醒</span>
                    </label>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">监控设置</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">刷新间隔</label>
                      <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                        <option>1秒</option>
                        <option selected>2秒</option>
                        <option>5秒</option>
                        <option>10秒</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">数据保留时间</label>
                      <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                        <option>1小时</option>
                        <option>6小时</option>
                        <option selected>24小时</option>
                        <option>7天</option>
                      </select>
                    </div>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-gray-200">
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    保存设置
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-lg mx-auto mb-4 flex items-center justify-center">
              <Settings className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{navigationItems.find(item => item.id === activeModule)?.label}</h3>
            <p className="text-gray-600">该功能模块正在开发中...</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 lg:hidden"
              >
                {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
              <div className="flex items-center ml-4 lg:ml-0">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <Server className="w-5 h-5 text-white" />
                </div>
                <h1 className="ml-3 text-xl font-bold text-gray-900">M1服务器管理</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="搜索..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button className="p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-lg">
                <Bell className="w-5 h-5" />
              </button>
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${
                serverStatus.status === 'online' ? 'bg-green-100 text-green-800' :
                serverStatus.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  serverStatus.status === 'online' ? 'bg-green-500' :
                  serverStatus.status === 'warning' ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}></div>
                <span>
                  {serverStatus.status === 'online' ? '在线' :
                   serverStatus.status === 'warning' ? '警告' : '离线'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex">
        {/* Sidebar */}
        <div className={`${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}>
          <div className="flex flex-col h-full pt-16 lg:pt-0">
            <div className="flex-1 flex flex-col min-h-0 border-r border-gray-200">
              <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
                <nav className="mt-5 flex-1 px-2 space-y-1">
                  {navigationItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveModule(item.id);
                        setIsSidebarOpen(false);
                      }}
                      className={`${
                        activeModule === item.id
                          ? 'bg-blue-50 border-blue-500 text-blue-700'
                          : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      } group flex items-center px-3 py-2 text-sm font-medium border-l-4 w-full text-left`}
                    >
                      <span className={`${
                        activeModule === item.id ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
                      } mr-3`}>
                        {item.icon}
                      </span>
                      {item.label}
                    </button>
                  ))}
                </nav>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 lg:ml-0">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  {navigationItems.find(item => item.id === activeModule)?.label || '仪表板'}
                </h2>
                <p className="mt-1 text-sm text-gray-600">最后更新: {systemInfo.lastUpdate}</p>
              </div>
              {renderMainContent()}
            </div>
          </div>
        </main>

        {/* Status Information Div */}
        <div className="hidden xl:block w-80 bg-white border-l border-gray-200">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">系统状态</h3>
            
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">服务器状态</span>
                  <span className={`text-sm font-medium ${getStatusColor(serverStatus.status)}`}>
                    {serverStatus.status === 'online' ? '正常运行' :
                     serverStatus.status === 'warning' ? '需要注意' : '离线'}
                  </span>
                </div>
                <div className="text-xs text-gray-500">运行时间: {serverStatus.uptime}</div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-600 mb-3">资源使用情况</h4>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>CPU</span>
                      <span>{serverStatus.cpu.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div 
                        className={`h-1.5 rounded-full ${getProgressColor(serverStatus.cpu)}`}
                        style={{ width: `${serverStatus.cpu}%` }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>内存</span>
                      <span>{serverStatus.memory.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div 
                        className={`h-1.5 rounded-full ${getProgressColor(serverStatus.memory)}`}
                        style={{ width: `${serverStatus.memory}%` }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>磁盘</span>
                      <span>{serverStatus.disk}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div 
                        className={`h-1.5 rounded-full ${getProgressColor(serverStatus.disk)}`}
                        style={{ width: `${serverStatus.disk}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-600 mb-3">最近活动</h4>
                <div className="space-y-2 text-xs text-gray-600">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span>系统启动完成</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                    <span>数据库连接正常</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                    <span>内存使用率较高</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}
    </div>
  );
};

export default ServerManagementRoot;