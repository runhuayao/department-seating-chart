import React, { useState, useEffect } from 'react';
import { Monitor, Server, Settings, Activity, Users, Shield, BarChart3, Terminal, Database, MapPin, Edit, Trash2, Eye, Plus, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ServerMonitor from '../components/ServerMonitor';
import ServerDetails from '../components/ServerDetails';
import '../styles/m1-theme.css';

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  component: React.ReactNode;
}

const M1ServerManagement: React.FC = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('monitor');
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [dbStatus, setDbStatus] = useState({
    connected: true,
    tables: 5,
    totalRecords: 1247,
    lastSync: '2024-01-15 14:35:20'
  });

  // 模拟连接状态
  useEffect(() => {
    const timer = setInterval(() => {
      setConnectionStatus(prev => {
        if (prev === 'disconnected') return 'connecting';
        if (prev === 'connecting') return 'connected';
        return 'connected';
      });
    }, 3000);

    return () => clearInterval(timer);
  }, []);

  // 获取真实数据库状态
  const fetchDatabaseStatus = async () => {
    if (!isAuthenticated) return;
    
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('http://localhost:3004/api/database/status', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const status = await response.json();
        setDbStatus({
          connected: status.connected,
          tables: status.tables,
          totalRecords: status.totalRecords,
          lastSync: new Date(status.lastSync).toLocaleString()
        });
      } else if (response.status === 401) {
        // 认证失败，退出登录
        logout();
      }
    } catch (error) {
      console.error('获取数据库状态失败:', error);
      setDbStatus(prev => ({ ...prev, connected: false }));
    }
  };

  // 定期更新数据库状态
  useEffect(() => {
    if (isAuthenticated) {
      // 初始加载
      fetchDatabaseStatus();
      
      // 每30秒更新一次
      const interval = setInterval(fetchDatabaseStatus, 30000);

      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const navigationItems: NavigationItem[] = [
    {
      id: 'monitor',
      label: '实时监控',
      icon: <Activity className="w-5 h-5" />,
      component: <ServerMonitor />
    },
    {
      id: 'details',
      label: '服务器详情',
      icon: <Server className="w-5 h-5" />,
      component: <ServerDetails />
    },
    {
      id: 'database',
      label: '云数据库',
      icon: <Database className="w-5 h-5" />,
      component: <DatabaseManagement />
    },
    {
      id: 'workstations',
      label: '工位管理',
      icon: <MapPin className="w-5 h-5" />,
      component: <WorkstationManagement />
    },
    {
      id: 'processes',
      label: '进程管理',
      icon: <Terminal className="w-5 h-5" />,
      component: <ProcessManagement />
    },
    {
      id: 'logs',
      label: '系统日志',
      icon: <Terminal className="w-5 h-5" />,
      component: <SystemLogs />
    },
    {
      id: 'users',
      label: '用户管理',
      icon: <Users className="w-5 h-5" />,
      component: <UserManagement />
    },
    {
      id: 'security',
      label: '安全设置',
      icon: <Shield className="w-5 h-5" />,
      component: <SecuritySettings />
    },
    {
      id: 'analytics',
      label: '性能分析',
      icon: <BarChart3 className="w-5 h-5" />,
      component: <PerformanceAnalytics />
    },
    {
      id: 'settings',
      label: '系统设置',
      icon: <Settings className="w-5 h-5" />,
      component: <SystemSettings />
    }
  ];

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'online';
      case 'connecting': return 'warning';
      case 'disconnected': return 'offline';
      default: return 'offline';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'M1服务器在线';
      case 'connecting': return '正在连接...';
      case 'disconnected': return 'M1服务器离线';
      default: return '未知状态';
    }
  };

  return (
    <div className="m1-theme min-h-screen">
      {/* 顶部导航栏 */}
      <header className="m1-nav sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <Server className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">M1服务器管理平台</h1>
                  <p className="text-sm text-gray-400">专业级服务器监控与管理</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* 连接状态指示器 */}
              <div className="m1-status-indicator">
                <div className={`m1-status-dot ${getStatusColor()}`}></div>
                <span className="text-sm font-medium">{getStatusText()}</span>
              </div>
              
              {/* 云数据库状态 */}
              <div className="flex items-center gap-3 px-3 py-2 bg-slate-700 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${dbStatus.connected ? 'bg-green-400' : 'bg-red-400'}`}></div>
                  <span className="text-xs text-gray-300">云数据库</span>
                </div>
                <div className="text-xs text-gray-400">|</div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-blue-400">{dbStatus.tables}张表</span>
                  <span className="text-green-400">{dbStatus.totalRecords}条记录</span>
                  <span className="text-gray-400">同步: {dbStatus.lastSync.split(' ')[1]}</span>
                </div>
              </div>
              
              {/* 用户信息 */}
              {isAuthenticated && user ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-700 rounded-lg">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-sm font-semibold text-white">
                        {user.username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{user.username}</span>
                      <span className="text-xs text-gray-400">
                        {user.role === 'admin' ? '管理员' : user.role === 'manager' ? '经理' : '员工'}
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={logout}
                    className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                    title="退出登录"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="px-3 py-2 bg-slate-700 rounded-lg text-sm text-gray-400">
                  未登录
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* 侧边导航 */}
        <aside className="w-64 bg-slate-800 min-h-screen border-r border-slate-700">
          <nav className="p-4">
            <div className="space-y-2">
              {navigationItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`m1-nav-item w-full text-left ${
                    activeTab === item.id ? 'active' : ''
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </nav>
        </aside>

        {/* 主内容区域 */}
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            {/* 页面标题 */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                {navigationItems.find(item => item.id === activeTab)?.icon}
                <h2 className="text-2xl font-bold text-white">
                  {navigationItems.find(item => item.id === activeTab)?.label}
                </h2>
              </div>
              <p className="text-gray-400">
                {getPageDescription(activeTab)}
              </p>
            </div>

            {/* 内容区域 */}
            <div className="m1-fade-in">
              {navigationItems.find(item => item.id === activeTab)?.component}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

// 获取页面描述
const getPageDescription = (tabId: string): string => {
  const descriptions: Record<string, string> = {
    monitor: '实时监控服务器CPU、内存、磁盘等关键指标',
    details: '查看服务器详细运行数据和系统信息',
    database: '管理云数据库连接、表结构和数据同步状态',
    processes: '管理和监控系统进程状态',
    logs: '查看系统日志和错误报告',
    users: '管理用户账户和权限设置',
    security: '配置安全策略和访问控制',
    analytics: '分析服务器性能趋势和优化建议',
    settings: '配置系统参数和服务设置'
  };
  return descriptions[tabId] || '';
};

// 云数据库管理组件
const DatabaseManagement: React.FC = () => {
  const [tables, setTables] = useState<any[]>([]);
  const [syncStatus, setSyncStatus] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 获取数据表信息
  const fetchTables = async () => {
    try {
      const response = await fetch('http://localhost:3004/api/database/tables');
      if (response.ok) {
        const data = await response.json();
        setTables(data.tables || []);
      }
    } catch (error) {
      console.error('获取数据表信息失败:', error);
    }
  };

  // 获取同步状态
  const fetchSyncStatus = async () => {
    try {
      const response = await fetch('http://localhost:3004/api/database/sync-status');
      if (response.ok) {
        const data = await response.json();
        setSyncStatus(data.syncStatus || []);
      }
    } catch (error) {
      console.error('获取同步状态失败:', error);
    }
  };

  // 初始化数据
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchTables(), fetchSyncStatus()]);
      setLoading(false);
    };
    loadData();
  }, []);

  // 默认数据（当API不可用时）
  const defaultTables = [
    { name: 'workstations', records: 156, size: '2.3MB', lastUpdate: '2024-01-15 14:30:25' },
    { name: 'employees', records: 89, size: '1.8MB', lastUpdate: '2024-01-15 14:28:15' },
    { name: 'departments', records: 12, size: '0.5MB', lastUpdate: '2024-01-15 14:25:10' },
    { name: 'users', records: 45, size: '1.2MB', lastUpdate: '2024-01-15 14:20:05' },
    { name: 'audit_logs', records: 945, size: '5.7MB', lastUpdate: '2024-01-15 14:35:20' }
  ];

  const defaultSyncStatus = {
    lastSync: '2024-01-15 14:35:20',
    status: 'success',
    nextSync: '2024-01-15 14:40:20',
    totalSynced: 1247
  };

  // 使用实际数据或默认数据
  const displayTables = tables.length > 0 ? tables : defaultTables;
  const displaySyncStatus = syncStatus.length > 0 ? syncStatus[0] : defaultSyncStatus;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-gray-400">加载数据库信息中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 数据库概览 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="m1-card">
          <div className="m1-card-body text-center">
            <div className="text-2xl font-bold text-blue-400">{displayTables.length}</div>
            <div className="text-sm text-gray-400">数据表</div>
          </div>
        </div>
        <div className="m1-card">
          <div className="m1-card-body text-center">
            <div className="text-2xl font-bold text-green-400">{displaySyncStatus.totalSynced}</div>
            <div className="text-sm text-gray-400">总记录数</div>
          </div>
        </div>
        <div className="m1-card">
          <div className="m1-card-body text-center">
            <div className="text-2xl font-bold text-yellow-400">11.5MB</div>
            <div className="text-sm text-gray-400">数据库大小</div>
          </div>
        </div>
        <div className="m1-card">
          <div className="m1-card-body text-center">
            <div className={`text-2xl font-bold ${displaySyncStatus.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
              {displaySyncStatus.status === 'success' ? '正常' : '异常'}
            </div>
            <div className="text-sm text-gray-400">同步状态</div>
          </div>
        </div>
      </div>

      {/* 数据表详情 */}
      <div className="m1-card">
        <div className="m1-card-header">
          <h3 className="text-lg font-semibold">数据表详情</h3>
          <button 
            onClick={() => Promise.all([fetchTables(), fetchSyncStatus()])}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            刷新
          </button>
        </div>
        <div className="m1-card-body">
          <div className="overflow-x-auto">
            <table className="m1-table">
              <thead>
                <tr>
                  <th>表名</th>
                  <th>记录数</th>
                  <th>大小</th>
                  <th>最后更新</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {displayTables.map((table) => (
                  <tr key={table.name}>
                    <td className="font-mono font-medium">{table.name}</td>
                    <td>{table.records}</td>
                    <td>{table.size}</td>
                    <td className="text-sm text-gray-400">{table.lastUpdate}</td>
                    <td>
                      <div className="flex gap-2">
                        <button className="m1-btn m1-btn-ghost text-xs">查看</button>
                        <button className="m1-btn m1-btn-ghost text-xs">同步</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 同步状态 */}
      <div className="m1-card">
        <div className="m1-card-header">
          <h3 className="text-lg font-semibold">数据同步状态</h3>
        </div>
        <div className="m1-card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">上次同步时间</span>
                  <span className="text-sm font-medium">{displaySyncStatus.lastSync}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">下次同步时间</span>
                  <span className="text-sm font-medium">{displaySyncStatus.nextSync}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">同步状态</span>
                  <span className={`m1-badge ${displaySyncStatus.status === 'success' ? 'm1-badge-success' : 'm1-badge-error'}`}>
                    {displaySyncStatus.status === 'success' ? '成功' : '失败'}
                  </span>
                </div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-center h-full">
                <button className="m1-btn m1-btn-primary">
                  立即同步
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// 进程管理组件
const ProcessManagement: React.FC = () => {
  const [processes] = useState([
    { pid: 1234, name: 'node.exe', cpu: 15.5, memory: '128MB', status: 'running' },
    { pid: 5678, name: 'chrome.exe', cpu: 8.2, memory: '256MB', status: 'running' },
    { pid: 9012, name: 'explorer.exe', cpu: 2.1, memory: '64MB', status: 'running' },
    { pid: 3456, name: 'system', cpu: 0.8, memory: '32MB', status: 'running' }
  ]);

  return (
    <div className="space-y-6">
      <div className="m1-card">
        <div className="m1-card-header">
          <h3 className="text-lg font-semibold">运行中的进程</h3>
        </div>
        <div className="m1-card-body">
          <div className="overflow-x-auto">
            <table className="m1-table">
              <thead>
                <tr>
                  <th>PID</th>
                  <th>进程名称</th>
                  <th>CPU使用率</th>
                  <th>内存使用</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {processes.map((process) => (
                  <tr key={process.pid}>
                    <td className="font-mono">{process.pid}</td>
                    <td className="font-medium">{process.name}</td>
                    <td>{process.cpu}%</td>
                    <td>{process.memory}</td>
                    <td>
                      <span className="m1-badge m1-badge-success">{process.status}</span>
                    </td>
                    <td>
                      <button className="m1-btn m1-btn-ghost text-xs">终止</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

// 系统日志组件
const SystemLogs: React.FC = () => {
  const [logs] = useState([
    { id: 1, time: '2024-01-15 14:30:25', level: 'info', message: '服务器启动成功', source: 'system' },
    { id: 2, time: '2024-01-15 14:28:15', level: 'warn', message: '检测到高内存使用率: 85%', source: 'monitor' },
    { id: 3, time: '2024-01-15 14:25:10', level: 'error', message: '数据库连接失败', source: 'database' },
    { id: 4, time: '2024-01-15 14:20:05', level: 'info', message: '系统监控激活', source: 'monitor' }
  ]);

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'error': return 'm1-badge-error';
      case 'warn': return 'm1-badge-warning';
      case 'info': return 'm1-badge-info';
      default: return 'm1-badge-info';
    }
  };

  return (
    <div className="space-y-6">
      <div className="m1-card">
        <div className="m1-card-header">
          <h3 className="text-lg font-semibold">系统日志</h3>
        </div>
        <div className="m1-card-body">
          <div className="space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-4 p-3 bg-slate-700 rounded-lg">
                <span className="text-xs text-gray-400 font-mono whitespace-nowrap">
                  {log.time}
                </span>
                <span className={`m1-badge ${getLevelBadge(log.level)}`}>
                  {log.level}
                </span>
                <span className="text-sm flex-1">{log.message}</span>
                <span className="text-xs text-gray-500">{log.source}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// 工位模态框组件
interface WorkstationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (workstation: any) => void;
  workstation?: any;
  title: string;
  readOnly?: boolean;
}

const WorkstationModal: React.FC<WorkstationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  workstation,
  title,
  readOnly = false
}) => {
  const [formData, setFormData] = useState({
    name: workstation?.name || '',
    user: workstation?.user || '',
    department: workstation?.department || '',
    ip: workstation?.ip || '',
    location: workstation?.location || '',
    status: workstation?.status || 'offline'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSave && !readOnly) {
      onSave(formData);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            ×
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              工位名称
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              disabled={readOnly}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              required={!readOnly}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              使用者
            </label>
            <input
              type="text"
              name="user"
              value={formData.user}
              onChange={handleChange}
              disabled={readOnly}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              部门
            </label>
            <select
              name="department"
              value={formData.department}
              onChange={handleChange}
              disabled={readOnly}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              required={!readOnly}
            >
              <option value="">选择部门</option>
              <option value="技术部">技术部</option>
              <option value="设计部">设计部</option>
              <option value="产品部">产品部</option>
              <option value="运营部">运营部</option>
              <option value="市场部">市场部</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              IP地址
            </label>
            <input
              type="text"
              name="ip"
              value={formData.ip}
              onChange={handleChange}
              disabled={readOnly}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              pattern="^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$"
              placeholder="192.168.1.100"
              required={!readOnly}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              位置
            </label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
              disabled={readOnly}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              placeholder="3楼东区"
              required={!readOnly}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              状态
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              disabled={readOnly}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="online">在线</option>
              <option value="offline">离线</option>
              <option value="maintenance">维护中</option>
            </select>
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              取消
            </button>
            {!readOnly && (
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                保存
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

// 工位管理组件
const WorkstationManagement: React.FC = () => {
  const [workstations, setWorkstations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    online: 0,
    offline: 0,
    maintenance: 0
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedWorkstation, setSelectedWorkstation] = useState<any>(null);

  // 获取工位数据
  const fetchWorkstations = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3004/api/workstations');
      if (response.ok) {
        const data = await response.json();
        setWorkstations(data);
        updateStats(data);
      } else {
        // 使用默认数据
        const defaultData = [
          {
            id: 1,
            name: '开发部-001',
            user: '张三',
            department: '技术部',
            ip: '192.168.1.101',
            status: 'online',
            location: '3楼东区',
            lastActive: '2024-01-15 15:30:25'
          },
          {
            id: 2,
            name: '设计部-002',
            user: '李四',
            department: '设计部',
            ip: '192.168.1.102',
            status: 'offline',
            location: '3楼西区',
            lastActive: '2024-01-15 12:15:10'
          },
          {
            id: 3,
            name: '产品部-003',
            user: '王五',
            department: '产品部',
            ip: '192.168.1.103',
            status: 'online',
            location: '4楼南区',
            lastActive: '2024-01-15 15:28:45'
          }
        ];
        setWorkstations(defaultData);
        updateStats(defaultData);
      }
    } catch (error) {
      console.error('获取工位数据失败:', error);
      // 使用默认数据
      const defaultData = [
        {
          id: 1,
          name: '开发部-001',
          user: '张三',
          department: '技术部',
          ip: '192.168.1.101',
          status: 'online',
          location: '3楼东区',
          lastActive: '2024-01-15 15:30:25'
        },
        {
          id: 2,
          name: '设计部-002',
          user: '李四',
          department: '设计部',
          ip: '192.168.1.102',
          status: 'offline',
          location: '3楼西区',
          lastActive: '2024-01-15 12:15:10'
        },
        {
          id: 3,
          name: '产品部-003',
          user: '王五',
          department: '产品部',
          ip: '192.168.1.103',
          status: 'online',
          location: '4楼南区',
          lastActive: '2024-01-15 15:28:45'
        }
      ];
      setWorkstations(defaultData);
      updateStats(defaultData);
    } finally {
      setLoading(false);
    }
  };

  // 更新统计数据
  const updateStats = (data: any[]) => {
    const total = data.length;
    const online = data.filter(w => w.status === 'online').length;
    const offline = data.filter(w => w.status === 'offline').length;
    const maintenance = data.filter(w => w.status === 'maintenance').length;
    
    setStats({ total, online, offline, maintenance });
  };

  // 初始化数据
  useEffect(() => {
    fetchWorkstations();
  }, []);

  // 删除工位
  const handleDeleteWorkstation = async (id: number) => {
    if (!confirm('确定要删除这个工位吗？')) return;
    
    try {
      const response = await fetch(`http://localhost:3004/api/workstations/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        const updatedWorkstations = workstations.filter(w => w.id !== id);
        setWorkstations(updatedWorkstations);
        updateStats(updatedWorkstations);
      }
    } catch (error) {
      console.error('删除工位失败:', error);
      // 即使API失败，也允许本地删除
      const updatedWorkstations = workstations.filter(w => w.id !== id);
      setWorkstations(updatedWorkstations);
      updateStats(updatedWorkstations);
    }
  };

  const getStatusBadge = (status: string) => {
    return status === 'online' ? 'm1-badge-success' : 'm1-badge-error';
  };

  const getStatusText = (status: string) => {
    return status === 'online' ? '在线' : '离线';
  };

  return (
    <div className="space-y-6">
      {/* 添加工位模态框 */}
      {showAddModal && (
        <WorkstationModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSave={async (workstation) => {
             try {
               const response = await fetch('http://localhost:3004/api/workstations', {
                 method: 'POST',
                 headers: {
                   'Content-Type': 'application/json',
                 },
                 body: JSON.stringify(workstation),
               });
               
               if (response.ok) {
                 const newWorkstation = await response.json();
                 const updatedWorkstations = [...workstations, newWorkstation];
                 setWorkstations(updatedWorkstations);
                 updateStats(updatedWorkstations);
               } else {
                 // API失败时使用本地添加
                 const newWorkstation = { ...workstation, id: Date.now() };
                 const updatedWorkstations = [...workstations, newWorkstation];
                 setWorkstations(updatedWorkstations);
                 updateStats(updatedWorkstations);
               }
             } catch (error) {
               console.error('添加工位失败:', error);
               // API失败时使用本地添加
               const newWorkstation = { ...workstation, id: Date.now() };
               const updatedWorkstations = [...workstations, newWorkstation];
               setWorkstations(updatedWorkstations);
               updateStats(updatedWorkstations);
             }
             setShowAddModal(false);
           }}
          title="添加工位"
        />
      )}

      {/* 编辑工位模态框 */}
      {showEditModal && selectedWorkstation && (
        <WorkstationModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedWorkstation(null);
          }}
          onSave={async (workstation) => {
             try {
               const response = await fetch(`http://localhost:3004/api/workstations/${selectedWorkstation.id}`, {
                 method: 'PUT',
                 headers: {
                   'Content-Type': 'application/json',
                 },
                 body: JSON.stringify(workstation),
               });
               
               if (response.ok) {
                 const updatedWorkstation = await response.json();
                 const updatedWorkstations = workstations.map(w => 
                   w.id === selectedWorkstation.id ? updatedWorkstation : w
                 );
                 setWorkstations(updatedWorkstations);
                 updateStats(updatedWorkstations);
               } else {
                 // API失败时使用本地更新
                 const updatedWorkstations = workstations.map(w => 
                   w.id === selectedWorkstation.id ? { ...workstation, id: selectedWorkstation.id } : w
                 );
                 setWorkstations(updatedWorkstations);
                 updateStats(updatedWorkstations);
               }
             } catch (error) {
               console.error('更新工位失败:', error);
               // API失败时使用本地更新
               const updatedWorkstations = workstations.map(w => 
                 w.id === selectedWorkstation.id ? { ...workstation, id: selectedWorkstation.id } : w
               );
               setWorkstations(updatedWorkstations);
               updateStats(updatedWorkstations);
             }
             setShowEditModal(false);
             setSelectedWorkstation(null);
           }}
          workstation={selectedWorkstation}
          title="编辑工位"
        />
      )}

      {/* 查看工位模态框 */}
      {showViewModal && selectedWorkstation && (
        <WorkstationModal
          isOpen={showViewModal}
          onClose={() => {
            setShowViewModal(false);
            setSelectedWorkstation(null);
          }}
          workstation={selectedWorkstation}
          title="工位详情"
          readOnly
        />
      )}

      {/* 工位统计 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="m1-card">
          <div className="m1-card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">总工位数</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <MapPin className="w-8 h-8 text-blue-400" />
            </div>
          </div>
        </div>
        <div className="m1-card">
          <div className="m1-card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">在线工位</p>
                <p className="text-2xl font-bold text-green-400">{stats.online}</p>
              </div>
              <Activity className="w-8 h-8 text-green-400" />
            </div>
          </div>
        </div>
        <div className="m1-card">
          <div className="m1-card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">离线工位</p>
                <p className="text-2xl font-bold text-red-400">{stats.offline}</p>
              </div>
              <Monitor className="w-8 h-8 text-red-400" />
            </div>
          </div>
        </div>
        <div className="m1-card">
          <div className="m1-card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">使用率</p>
                <p className="text-2xl font-bold text-blue-400">
                  {stats.total > 0 ? Math.round((stats.online / stats.total) * 100) : 0}%
                </p>
              </div>
              <BarChart3 className="w-8 h-8 text-blue-400" />
            </div>
          </div>
        </div>
      </div>

      {/* 工位管理 */}
      <div className="m1-card">
        <div className="m1-card-header">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">工位管理</h3>
            <div className="flex gap-2">
              <button 
                className="m1-btn m1-btn-ghost"
                onClick={fetchWorkstations}
                disabled={loading}
              >
                {loading ? '刷新中...' : '刷新数据'}
              </button>
              <button 
                className="m1-btn m1-btn-primary flex items-center gap-2"
                onClick={() => setShowAddModal(true)}
              >
                <Plus className="w-4 h-4" />
                添加工位
              </button>
            </div>
          </div>
        </div>
        <div className="m1-card-body">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="m1-table">
                <thead>
                  <tr>
                    <th>工位名称</th>
                    <th>使用者</th>
                    <th>部门</th>
                    <th>IP地址</th>
                    <th>位置</th>
                    <th>状态</th>
                    <th>最后活跃</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {workstations.map((workstation) => (
                    <tr key={workstation.id}>
                      <td className="font-medium">{workstation.name}</td>
                      <td>{workstation.user}</td>
                      <td>{workstation.department}</td>
                      <td className="font-mono text-sm">{workstation.ip}</td>
                      <td>{workstation.location}</td>
                      <td>
                        <span className={`m1-badge ${getStatusBadge(workstation.status)}`}>
                          {getStatusText(workstation.status)}
                        </span>
                      </td>
                      <td className="text-sm text-gray-400">{workstation.lastActive}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <button 
                            className="m1-btn m1-btn-ghost text-xs flex items-center gap-1"
                            onClick={() => {
                              setSelectedWorkstation(workstation);
                              setShowViewModal(true);
                            }}
                          >
                            <Eye className="w-3 h-3" />
                            查看
                          </button>
                          <button 
                            className="m1-btn m1-btn-ghost text-xs flex items-center gap-1"
                            onClick={() => {
                              setSelectedWorkstation(workstation);
                              setShowEditModal(true);
                            }}
                          >
                            <Edit className="w-3 h-3" />
                            编辑
                          </button>
                          <button 
                            className="m1-btn m1-btn-ghost text-xs text-red-400 flex items-center gap-1"
                            onClick={() => handleDeleteWorkstation(workstation.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 用户管理组件
const UserManagement: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="m1-card">
        <div className="m1-card-header">
          <h3 className="text-lg font-semibold">用户管理</h3>
        </div>
        <div className="m1-card-body">
          <p className="text-gray-400">用户管理功能正在开发中...</p>
        </div>
      </div>
    </div>
  );
};

// 安全设置组件
const SecuritySettings: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="m1-card">
        <div className="m1-card-header">
          <h3 className="text-lg font-semibold">安全设置</h3>
        </div>
        <div className="m1-card-body">
          <p className="text-gray-400">安全设置功能正在开发中...</p>
        </div>
      </div>
    </div>
  );
};

// 性能分析组件
const PerformanceAnalytics: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="m1-card">
        <div className="m1-card-header">
          <h3 className="text-lg font-semibold">性能分析</h3>
        </div>
        <div className="m1-card-body">
          <p className="text-gray-400">性能分析功能正在开发中...</p>
        </div>
      </div>
    </div>
  );
};

// 系统设置组件
const SystemSettings: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="m1-card">
        <div className="m1-card-header">
          <h3 className="text-lg font-semibold">系统设置</h3>
        </div>
        <div className="m1-card-body">
          <p className="text-gray-400">系统设置功能正在开发中...</p>
        </div>
      </div>
    </div>
  );
};

export default M1ServerManagement;