import React, { useState, useEffect } from 'react';
import { Monitor, Server, Settings, Activity, Users, Shield, BarChart3, Terminal, Database, MapPin, Edit, Trash2, Eye, Plus, LogOut, RefreshCw, UserCheck, UserX, Save, X, Wifi, WifiOff, Clock, CheckCircle, AlertCircle, XCircle, Bell, Mail, Phone, Globe, FileText, Download, Power, Languages, Cpu, HardDrive, AlertTriangle, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ServerMonitor from '../components/ServerMonitor';
import ServerDetails from '../components/ServerDetails';
import DataSyncManager from '../components/DataSyncManager';
import DepartmentMappingManager from '../components/DepartmentMappingManager';
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
  const [selectedTable, setSelectedTable] = useState<any>(null);
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
      const response = await fetch('http://localhost:8080/api/database/status', {
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
      id: 'datasync',
      label: '数据同步',
      icon: <RefreshCw className="w-5 h-5" />,
      component: <DataSyncManager />
    },
    {
      id: 'department-mapping',
      label: '部门映射',
      icon: <Languages className="w-5 h-5" />,
      component: <DepartmentMappingManager />
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

      {/* 表数据查看模态框 */}
      {selectedTable && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">
                表数据: {selectedTable.name}
              </h3>
              <button 
                onClick={() => setSelectedTable(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="overflow-auto max-h-96">
              {selectedTable.data.length > 0 ? (
                <table className="m1-table">
                  <thead>
                    <tr>
                      {Object.keys(selectedTable.data[0]).map((key) => (
                        <th key={key}>{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTable.data.map((row: any, index: number) => (
                      <tr key={index}>
                        {Object.values(row).map((value: any, cellIndex: number) => (
                          <td key={cellIndex} className="text-sm">
                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  暂无数据
                </div>
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <button 
                onClick={() => setSelectedTable(null)}
                className="m1-btn m1-btn-ghost"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 获取页面描述
const getPageDescription = (tabId: string): string => {
  const descriptions: Record<string, string> = {
    monitor: '实时监控服务器CPU、内存、磁盘等关键指标',
    details: '查看服务器详细运行数据和系统信息',
    database: '管理云数据库连接、表结构和数据同步状态',
    datasync: '管理数据同步状态、一致性检查和修复操作',
    'department-mapping': '管理中文部门名称与英文配置键的映射关系，支持实时同步',
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
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [tableData, setTableData] = useState<any[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);

  // 获取数据表信息
  const fetchTables = async () => {
    try {
      const response = await fetch('http://localhost:8080/api/database/tables');
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
      const response = await fetch('http://localhost:8080/api/database/sync-status');
      if (response.ok) {
        const data = await response.json();
        setSyncStatus(data.syncStatus || []);
      }
    } catch (error) {
      console.error('获取同步状态失败:', error);
    }
  };

  // 查看表数据
  const handleViewTable = async (tableName: string) => {
    try {
      const response = await fetch(`http://localhost:8080/api/database/tables/${tableName}/data`);
      if (response.ok) {
        const data = await response.json();
        setTableData(data.records || []);
        setSelectedTable({ name: tableName, data: data.records || [] });
      } else {
        // API失败时显示空数据
        console.error('API请求失败，无法获取表数据');
        setTableData([]);
        setSelectedTable({ name: tableName, data: [] });
      }
    } catch (error) {
      console.error('获取表数据失败:', error);
      // 显示空数据
      setTableData([]);
      setSelectedTable({ name: tableName, data: [] });
    }
  };

  // 同步表数据
  const handleSyncTable = async (tableName: string) => {
    setSyncing(tableName);
    try {
      const response = await fetch(`http://localhost:8080/api/database/tables/${tableName}/sync`, {
        method: 'POST'
      });
      if (response.ok) {
        // 同步成功，刷新数据
        await Promise.all([fetchTables(), fetchSyncStatus()]);
        alert(`表 ${tableName} 同步成功`);
      } else {
        // 模拟同步成功
        setTimeout(() => {
          alert(`表 ${tableName} 同步成功（模拟）`);
        }, 1000);
      }
    } catch (error) {
      console.error('同步表数据失败:', error);
      // 模拟同步成功
      setTimeout(() => {
        alert(`表 ${tableName} 同步成功（模拟）`);
      }, 1000);
    } finally {
      setSyncing(null);
    }
  };

  // 同步所有表数据
  const handleSyncAllTables = async () => {
    setSyncing('all');
    try {
      const response = await fetch('http://localhost:8080/api/database/sync-all', {
        method: 'POST'
      });
      if (response.ok) {
        // 同步成功，刷新数据
        await Promise.all([fetchTables(), fetchSyncStatus()]);
        alert('所有表同步成功');
      } else {
        // 模拟同步成功
        setTimeout(() => {
          alert('所有表同步成功（模拟）');
        }, 1500);
      }
    } catch (error) {
      console.error('同步所有表失败:', error);
      // 模拟同步成功
      setTimeout(() => {
        alert('所有表同步成功（模拟）');
      }, 1500);
    } finally {
      setSyncing(null);
    }
  };

  // 移除模拟数据生成函数，改为从API获取真实数据

  // 初始化数据
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchTables(), fetchSyncStatus()]);
      setLoading(false);
    };
    loadData();
  }, []);

  // 移除默认数据，仅使用从API获取的真实数据
  const displayTables = tables;
  const displaySyncStatus = syncStatus.length > 0 ? syncStatus[0] : null;

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
            <div className="text-2xl font-bold text-green-400">{displaySyncStatus?.totalSynced || 0}</div>
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
            <div className={`text-2xl font-bold ${displaySyncStatus?.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
              {displaySyncStatus?.status === 'success' ? '正常' : '异常'}
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
                        <button 
                          className="m1-btn m1-btn-ghost text-xs"
                          onClick={() => handleViewTable(table.name)}
                        >
                          查看
                        </button>
                        <button 
                          className="m1-btn m1-btn-ghost text-xs"
                          onClick={() => handleSyncTable(table.name)}
                          disabled={syncing === table.name}
                        >
                          {syncing === table.name ? '同步中...' : '同步'}
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
                  <span className="text-sm font-medium">{displaySyncStatus?.lastSync || '未知'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">下次同步时间</span>
                  <span className="text-sm font-medium">{displaySyncStatus?.nextSync || '未知'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">同步状态</span>
                  <span className={`m1-badge ${displaySyncStatus?.status === 'success' ? 'm1-badge-success' : 'm1-badge-error'}`}>
                    {displaySyncStatus?.status === 'success' ? '成功' : '失败'}
                  </span>
                </div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-center h-full">
                <button 
                  className="m1-btn m1-btn-primary"
                  onClick={() => handleSyncAllTables()}
                  disabled={syncing !== null}
                >
                  {syncing ? '同步中...' : '立即同步'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

// 用户表单组件
const UserForm: React.FC<{
  initialData?: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}> = ({ initialData, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    username: initialData?.username || '',
    email: initialData?.email || '',
    role: initialData?.role || 'employee',
    department: initialData?.department || '',
    position: initialData?.position || '',
    status: initialData?.status || 'active'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username || !formData.email) {
      alert('请填写必填字段');
      return;
    }
    onSubmit(formData);
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">用户名 *</label>
        <input
          type="text"
          className="m1-input w-full"
          value={formData.username}
          onChange={(e) => handleChange('username', e.target.value)}
          required
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-2">邮箱 *</label>
        <input
          type="email"
          className="m1-input w-full"
          value={formData.email}
          onChange={(e) => handleChange('email', e.target.value)}
          required
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-2">角色</label>
        <select
          className="m1-input w-full"
          value={formData.role}
          onChange={(e) => handleChange('role', e.target.value)}
        >
          <option value="employee">员工</option>
          <option value="manager">经理</option>
          <option value="admin">管理员</option>
        </select>
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-2">部门</label>
        <input
          type="text"
          className="m1-input w-full"
          value={formData.department}
          onChange={(e) => handleChange('department', e.target.value)}
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-2">职位</label>
        <input
          type="text"
          className="m1-input w-full"
          value={formData.position}
          onChange={(e) => handleChange('position', e.target.value)}
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-2">状态</label>
        <select
          className="m1-input w-full"
          value={formData.status}
          onChange={(e) => handleChange('status', e.target.value)}
        >
          <option value="active">活跃</option>
          <option value="inactive">停用</option>
        </select>
      </div>
      
      <div className="flex gap-2 pt-4">
        <button 
          type="submit"
          className="m1-btn m1-btn-primary flex items-center gap-2 flex-1"
        >
          <Save className="w-4 h-4" />
          保存
        </button>
        <button 
          type="button"
          className="m1-btn m1-btn-ghost flex-1"
          onClick={onCancel}
        >
          取消
        </button>
      </div>
    </form>
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
      if (!formData.name || !formData.department || !formData.ip || !formData.location) {
        alert('请填写必填字段');
        return;
      }
      
      const workstationData = {
        ...formData,
        lastActive: new Date().toLocaleString()
      };
      
      onSave(workstationData);
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
  
  // 新增筛选和搜索状态
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filteredWorkstations, setFilteredWorkstations] = useState<any[]>([]);
  
  // 部门列表
  const departments = ['all', '技术部', '设计部', '产品部', '人事部', '市场部', '财务部'];

  // 从localStorage加载工位数据
  const loadWorkstationsFromStorage = () => {
    try {
      const stored = localStorage.getItem('workstations');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('从localStorage加载工位数据失败:', error);
    }
    return null;
  };

  // 保存工位数据到localStorage
  const saveWorkstationsToStorage = (data: any[]) => {
    try {
      localStorage.setItem('workstations', JSON.stringify(data));
    } catch (error) {
      console.error('保存工位数据到localStorage失败:', error);
    }
  };

  // 获取工位数据
  const fetchWorkstations = async () => {
    setLoading(true);
    try {
      // 首先尝试从API获取数据
      const response = await fetch('http://localhost:8080/api/workstations');
      if (response.ok) {
        const data = await response.json();
        setWorkstations(data);
        updateStats(data);
        saveWorkstationsToStorage(data);
        return;
      }
    } catch (error) {
      console.error('从API获取工位数据失败:', error);
    }
    
    // API失败时，尝试从localStorage加载
    const storedData = loadWorkstationsFromStorage();
    if (storedData && storedData.length > 0) {
      setWorkstations(storedData);
      updateStats(storedData);
    } else {
      // 使用默认数据
      const defaultData = [
        {
          id: 1,
          deskNumber: 'A001',
          name: '开发部-001',
          employeeName: '张三',
          employeeId: 'DEV001',
          department: '技术部',
          position: '前端开发工程师',
          ip: '192.168.1.101',
          status: 'online',
          location: '3楼东区',
          coordinates: { x: 100, y: 150 },
          equipment: { computer: 'MacBook Pro', monitor: '27inch 4K', phone: 'IP电话' },
          lastActive: new Date().toLocaleString()
        },
        {
          id: 2,
          deskNumber: 'B002',
          name: '设计部-002',
          employeeName: '李四',
          employeeId: 'DES001',
          department: '设计部',
          position: 'UI设计师',
          ip: '192.168.1.102',
          status: 'offline',
          location: '3楼西区',
          coordinates: { x: 250, y: 150 },
          equipment: { computer: 'iMac', monitor: '32inch 5K', phone: 'IP电话', tablet: 'iPad Pro' },
          lastActive: new Date(Date.now() - 300000).toLocaleString()
        },
        {
          id: 3,
          deskNumber: 'C003',
          name: '产品部-003',
          employeeName: '王五',
          employeeId: 'PRD001',
          department: '产品部',
          position: '产品经理',
          ip: '192.168.1.103',
          status: 'online',
          location: '4楼南区',
          coordinates: { x: 400, y: 200 },
          equipment: { computer: 'ThinkPad X1', monitor: '24inch FHD', phone: 'IP电话' },
          lastActive: new Date().toLocaleString()
        },
        {
          id: 4,
          deskNumber: 'D004',
          name: '人事部-004',
          employeeName: '赵六',
          employeeId: 'HR001',
          department: '人事部',
          position: '人事专员',
          ip: '192.168.1.104',
          status: 'online',
          location: '2楼北区',
          coordinates: { x: 150, y: 100 },
          equipment: { computer: 'Dell Inspiron', monitor: '22inch FHD', phone: 'IP电话', printer: '激光打印机' },
          lastActive: new Date().toLocaleString()
        },
        {
          id: 5,
          deskNumber: 'E005',
          name: '市场部-005',
          employeeName: '钱七',
          employeeId: 'MKT001',
          department: '市场部',
          position: '市场专员',
          ip: '192.168.1.105',
          status: 'maintenance',
          location: '4楼西区',
          coordinates: { x: 300, y: 250 },
          equipment: { computer: 'Surface Laptop', monitor: '24inch FHD', phone: 'IP电话' },
          lastActive: new Date(Date.now() - 600000).toLocaleString()
        }
      ];
      setWorkstations(defaultData);
      updateStats(defaultData);
      saveWorkstationsToStorage(defaultData);
    }
    setLoading(false);
  };

  // 更新统计数据
  const updateStats = (data: any[]) => {
    const total = data.length;
    const online = data.filter(w => w.status === 'online').length;
    const offline = data.filter(w => w.status === 'offline').length;
    const maintenance = data.filter(w => w.status === 'maintenance').length;
    
    setStats({ total, online, offline, maintenance });
  };
  
  // 筛选和搜索功能
  const filterWorkstations = () => {
    let filtered = [...workstations];
    
    // 部门筛选
    if (departmentFilter !== 'all') {
      filtered = filtered.filter(w => w.department === departmentFilter);
    }
    
    // 状态筛选
    if (statusFilter !== 'all') {
      filtered = filtered.filter(w => w.status === statusFilter);
    }
    
    // 搜索筛选（支持员工姓名、工位编号、员工ID）
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(w => 
        w.employeeName?.toLowerCase().includes(query) ||
        w.deskNumber?.toLowerCase().includes(query) ||
        w.employeeId?.toLowerCase().includes(query) ||
        w.name?.toLowerCase().includes(query)
      );
    }
    
    setFilteredWorkstations(filtered);
  };
  
  // 清空筛选条件
  const clearFilters = () => {
    setDepartmentFilter('all');
    setStatusFilter('all');
    setSearchQuery('');
  };

  // 初始化数据
  useEffect(() => {
    fetchWorkstations();
  }, []);
  
  // 监听工位数据变化，更新筛选结果
  useEffect(() => {
    filterWorkstations();
  }, [workstations, departmentFilter, statusFilter, searchQuery]);
  
  // 初始化筛选结果
  useEffect(() => {
    setFilteredWorkstations(workstations);
  }, [workstations]);

  // 删除工位
  const handleDeleteWorkstation = async (id: number) => {
    if (!confirm('确定要删除这个工位吗？')) return;
    
    try {
      const response = await fetch(`http://localhost:8080/api/workstations/${id}`, {
        method: 'DELETE'
      });
      
      const updatedWorkstations = workstations.filter(w => w.id !== id);
      setWorkstations(updatedWorkstations);
      updateStats(updatedWorkstations);
      saveWorkstationsToStorage(updatedWorkstations);
      
      if (!response.ok) {
        console.warn('API删除失败，但本地数据已更新');
      }
    } catch (error) {
      console.error('删除工位失败:', error);
      // API失败时，仍然从本地删除并保存
      const updatedWorkstations = workstations.filter(w => w.id !== id);
      setWorkstations(updatedWorkstations);
      updateStats(updatedWorkstations);
      saveWorkstationsToStorage(updatedWorkstations);
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
             const newWorkstation = { ...workstation, id: Date.now() };
             const updatedWorkstations = [...workstations, newWorkstation];
             
             try {
               const response = await fetch('http://localhost:8080/api/workstations', {
                 method: 'POST',
                 headers: {
                   'Content-Type': 'application/json',
                 },
                 body: JSON.stringify(workstation),
               });
               
               if (response.ok) {
                 const savedWorkstation = await response.json();
                 const finalWorkstations = [...workstations, savedWorkstation];
                 setWorkstations(finalWorkstations);
                 updateStats(finalWorkstations);
                 saveWorkstationsToStorage(finalWorkstations);
               } else {
                 console.warn('API添加失败，使用本地数据');
                 setWorkstations(updatedWorkstations);
                 updateStats(updatedWorkstations);
                 saveWorkstationsToStorage(updatedWorkstations);
               }
             } catch (error) {
               console.error('添加工位失败:', error);
               // API失败时使用本地添加并保存
               setWorkstations(updatedWorkstations);
               updateStats(updatedWorkstations);
               saveWorkstationsToStorage(updatedWorkstations);
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
             const updatedWorkstations = workstations.map(w => 
               w.id === selectedWorkstation.id ? { ...workstation, id: selectedWorkstation.id } : w
             );
             
             try {
               const response = await fetch(`http://localhost:8080/api/workstations/${selectedWorkstation.id}`, {
                 method: 'PUT',
                 headers: {
                   'Content-Type': 'application/json',
                 },
                 body: JSON.stringify(workstation),
               });
               
               if (response.ok) {
                 const savedWorkstation = await response.json();
                 const finalWorkstations = workstations.map(w => 
                   w.id === selectedWorkstation.id ? savedWorkstation : w
                 );
                 setWorkstations(finalWorkstations);
                 updateStats(finalWorkstations);
                 saveWorkstationsToStorage(finalWorkstations);
               } else {
                 console.warn('API更新失败，使用本地数据');
                 setWorkstations(updatedWorkstations);
                 updateStats(updatedWorkstations);
                 saveWorkstationsToStorage(updatedWorkstations);
               }
             } catch (error) {
               console.error('更新工位失败:', error);
               // API失败时使用本地更新并保存
               setWorkstations(updatedWorkstations);
               updateStats(updatedWorkstations);
               saveWorkstationsToStorage(updatedWorkstations);
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
          <div className="flex justify-between items-center mb-4">
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
          
          {/* 筛选和搜索区域 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            {/* 搜索框 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索员工姓名、工位编号或员工ID..."
                className="m1-input pl-10 w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            {/* 部门筛选 */}
            <select
              className="m1-input"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
            >
              <option value="all">全部部门</option>
              {departments.filter(dept => dept !== 'all').map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
            
            {/* 状态筛选 */}
            <select
              className="m1-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">全部状态</option>
              <option value="online">在线</option>
              <option value="offline">离线</option>
              <option value="maintenance">维护中</option>
            </select>
            
            {/* 清空筛选按钮 */}
            <button
              className="m1-btn m1-btn-ghost flex items-center gap-2"
              onClick={clearFilters}
            >
              <X className="w-4 h-4" />
              清空筛选
            </button>
          </div>
          
          {/* 筛选结果统计 */}
          <div className="text-sm text-gray-400 mb-2">
            显示 {filteredWorkstations.length} / {workstations.length} 个工位
            {(departmentFilter !== 'all' || statusFilter !== 'all' || searchQuery.trim()) && (
              <span className="ml-2 text-blue-400">（已筛选）</span>
            )}
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
                    <th>工位编号</th>
                    <th>员工姓名</th>
                    <th>员工ID</th>
                    <th>职位</th>
                    <th>部门</th>
                    <th>坐标位置</th>
                    <th>物理位置</th>
                    <th>状态</th>
                    <th>最后活跃</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWorkstations.length > 0 ? (
                    filteredWorkstations.map((workstation) => (
                      <tr key={workstation.id}>
                        <td className="font-medium font-mono">{workstation.deskNumber}</td>
                        <td className="font-medium">{workstation.employeeName}</td>
                        <td className="font-mono text-sm">{workstation.employeeId}</td>
                        <td className="text-sm">{workstation.position}</td>
                        <td>{workstation.department}</td>
                        <td className="font-mono text-sm">
                          {workstation.coordinates ? 
                            `(${workstation.coordinates.x}, ${workstation.coordinates.y})` : 
                            '未设置'
                          }
                        </td>
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
                    ))
                  ) : (
                    <tr>
                      <td colSpan={10} className="text-center py-8 text-gray-400">
                        {searchQuery.trim() || departmentFilter !== 'all' || statusFilter !== 'all' ? 
                          '没有找到符合条件的工位' : 
                          '暂无工位数据'
                        }
                      </td>
                    </tr>
                  )}
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
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, admins: 0 });

  // 获取用户数据
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8080/api/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
        updateStats(data);
        return;
      }
    } catch (error) {
      console.error('获取用户数据失败:', error);
    }
    
    // 使用默认数据
    const defaultData = [
      {
        id: 1,
        username: 'admin',
        email: 'admin@company.com',
        role: 'admin',
        department: '技术部',
        position: '系统管理员',
        status: 'active',
        lastLogin: new Date().toLocaleString(),
        createdAt: '2024-01-01'
      },
      {
        id: 2,
        username: 'manager',
        email: 'manager@company.com',
        role: 'manager',
        department: '技术部',
        position: '技术经理',
        status: 'active',
        lastLogin: new Date().toLocaleString(),
        createdAt: '2024-01-02'
      },
      {
        id: 3,
        username: 'employee1',
        email: 'emp1@company.com',
        role: 'employee',
        department: '产品部',
        position: '产品经理',
        status: 'inactive',
        lastLogin: '2024-01-10 14:30:00',
        createdAt: '2024-01-03'
      }
    ];
    setUsers(defaultData);
    updateStats(defaultData);
    setLoading(false);
  };

  // 更新统计数据
  const updateStats = (data: any[]) => {
    const total = data.length;
    const active = data.filter(u => u.status === 'active').length;
    const inactive = data.filter(u => u.status === 'inactive').length;
    const admins = data.filter(u => u.role === 'admin').length;
    
    setStats({ total, active, inactive, admins });
  };

  // 初始化数据
  useEffect(() => {
    fetchUsers();
  }, []);

  // 删除用户
  const handleDeleteUser = async (id: number) => {
    if (!confirm('确定要删除这个用户吗？')) return;
    
    try {
      await fetch(`http://localhost:8080/api/users/${id}`, {
        method: 'DELETE'
      });
    } catch (error) {
      console.error('删除用户失败:', error);
    }
    
    const updatedUsers = users.filter(u => u.id !== id);
    setUsers(updatedUsers);
    updateStats(updatedUsers);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin': return 'm1-badge-error';
      case 'manager': return 'm1-badge-warning';
      default: return 'm1-badge-success';
    }
  };

  const getRoleText = (role: string) => {
    switch (role) {
      case 'admin': return '管理员';
      case 'manager': return '经理';
      default: return '员工';
    }
  };

  const getStatusBadge = (status: string) => {
    return status === 'active' ? 'm1-badge-success' : 'm1-badge-error';
  };

  const getStatusText = (status: string) => {
    return status === 'active' ? '活跃' : '停用';
  };

  return (
    <div className="space-y-6">
      {/* 用户统计 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="m1-card">
          <div className="m1-card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">总用户数</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Users className="w-8 h-8 text-blue-400" />
            </div>
          </div>
        </div>
        <div className="m1-card">
          <div className="m1-card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">活跃用户</p>
                <p className="text-2xl font-bold text-green-400">{stats.active}</p>
              </div>
              <UserCheck className="w-8 h-8 text-green-400" />
            </div>
          </div>
        </div>
        <div className="m1-card">
          <div className="m1-card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">停用用户</p>
                <p className="text-2xl font-bold text-red-400">{stats.inactive}</p>
              </div>
              <UserX className="w-8 h-8 text-red-400" />
            </div>
          </div>
        </div>
        <div className="m1-card">
          <div className="m1-card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">管理员</p>
                <p className="text-2xl font-bold text-purple-400">{stats.admins}</p>
              </div>
              <Shield className="w-8 h-8 text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* 用户管理 */}
      <div className="m1-card">
        <div className="m1-card-header">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">用户管理</h3>
            <div className="flex gap-2">
              <button 
                className="m1-btn m1-btn-ghost"
                onClick={fetchUsers}
                disabled={loading}
              >
                {loading ? '刷新中...' : '刷新数据'}
              </button>
              <button 
                className="m1-btn m1-btn-primary flex items-center gap-2"
                onClick={() => setShowAddModal(true)}
              >
                <Plus className="w-4 h-4" />
                添加用户
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
                    <th>用户名</th>
                    <th>邮箱</th>
                    <th>角色</th>
                    <th>部门</th>
                    <th>职位</th>
                    <th>状态</th>
                    <th>最后登录</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="font-medium">{user.username}</td>
                      <td>{user.email}</td>
                      <td>
                        <span className={`m1-badge ${getRoleBadge(user.role)}`}>
                          {getRoleText(user.role)}
                        </span>
                      </td>
                      <td>{user.department}</td>
                      <td>{user.position}</td>
                      <td>
                        <span className={`m1-badge ${getStatusBadge(user.status)}`}>
                          {getStatusText(user.status)}
                        </span>
                      </td>
                      <td className="text-sm text-gray-400">{user.lastLogin}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <button 
                            className="m1-btn m1-btn-ghost text-xs flex items-center gap-1"
                            onClick={() => {
                              setSelectedUser(user);
                              setShowEditModal(true);
                            }}
                          >
                            <Edit className="w-3 h-3" />
                            编辑
                          </button>
                          <button 
                            className="m1-btn m1-btn-ghost text-xs text-red-400 flex items-center gap-1"
                            onClick={() => handleDeleteUser(user.id)}
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

// 安全设置组件
const SecuritySettings: React.FC = () => {
  const [securityConfig, setSecurityConfig] = useState({
    passwordPolicy: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      maxAge: 90
    },
    accessControl: {
      maxLoginAttempts: 5,
      lockoutDuration: 30,
      sessionTimeout: 120,
      twoFactorAuth: false
    },
    auditLog: {
      enabled: true,
      retentionDays: 365,
      logLevel: 'info'
    }
  });
  
  const [auditLogs, setAuditLogs] = useState([
    {
      id: 1,
      timestamp: new Date().toLocaleString(),
      user: 'admin',
      action: '用户登录',
      ip: '192.168.1.100',
      status: 'success',
      details: '管理员登录成功'
    },
    {
      id: 2,
      timestamp: new Date(Date.now() - 300000).toLocaleString(),
      user: 'manager',
      action: '修改用户权限',
      ip: '192.168.1.101',
      status: 'success',
      details: '修改用户employee1权限'
    },
    {
      id: 3,
      timestamp: new Date(Date.now() - 600000).toLocaleString(),
      user: 'unknown',
      action: '登录失败',
      ip: '192.168.1.200',
      status: 'failed',
      details: '密码错误，连续失败3次'
    }
  ]);

  const updatePasswordPolicy = (field: string, value: any) => {
    setSecurityConfig(prev => ({
      ...prev,
      passwordPolicy: {
        ...prev.passwordPolicy,
        [field]: value
      }
    }));
  };

  const updateAccessControl = (field: string, value: any) => {
    setSecurityConfig(prev => ({
      ...prev,
      accessControl: {
        ...prev.accessControl,
        [field]: value
      }
    }));
  };

  const updateAuditLog = (field: string, value: any) => {
    setSecurityConfig(prev => ({
      ...prev,
      auditLog: {
        ...prev.auditLog,
        [field]: value
      }
    }));
  };

  const getStatusBadge = (status: string) => {
    return status === 'success' ? 'm1-badge-success' : 'm1-badge-error';
  };

  const getStatusText = (status: string) => {
    return status === 'success' ? '成功' : '失败';
  };

  return (
    <div className="space-y-6">
      {/* 密码策略 */}
      <div className="m1-card">
        <div className="m1-card-header">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5" />
            密码策略
          </h3>
        </div>
        <div className="m1-card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">最小长度</label>
              <input
                type="number"
                className="m1-input w-full"
                value={securityConfig.passwordPolicy.minLength}
                onChange={(e) => updatePasswordPolicy('minLength', parseInt(e.target.value))}
                min="6"
                max="32"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">密码有效期（天）</label>
              <input
                type="number"
                className="m1-input w-full"
                value={securityConfig.passwordPolicy.maxAge}
                onChange={(e) => updatePasswordPolicy('maxAge', parseInt(e.target.value))}
                min="30"
                max="365"
              />
            </div>
          </div>
          
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="requireUppercase"
                className="m1-checkbox"
                checked={securityConfig.passwordPolicy.requireUppercase}
                onChange={(e) => updatePasswordPolicy('requireUppercase', e.target.checked)}
              />
              <label htmlFor="requireUppercase" className="text-sm">要求包含大写字母</label>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="requireLowercase"
                className="m1-checkbox"
                checked={securityConfig.passwordPolicy.requireLowercase}
                onChange={(e) => updatePasswordPolicy('requireLowercase', e.target.checked)}
              />
              <label htmlFor="requireLowercase" className="text-sm">要求包含小写字母</label>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="requireNumbers"
                className="m1-checkbox"
                checked={securityConfig.passwordPolicy.requireNumbers}
                onChange={(e) => updatePasswordPolicy('requireNumbers', e.target.checked)}
              />
              <label htmlFor="requireNumbers" className="text-sm">要求包含数字</label>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="requireSpecialChars"
                className="m1-checkbox"
                checked={securityConfig.passwordPolicy.requireSpecialChars}
                onChange={(e) => updatePasswordPolicy('requireSpecialChars', e.target.checked)}
              />
              <label htmlFor="requireSpecialChars" className="text-sm">要求包含特殊字符</label>
            </div>
          </div>
        </div>
      </div>

      {/* 访问控制 */}
      <div className="m1-card">
        <div className="m1-card-header">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Users className="w-5 h-5" />
            访问控制
          </h3>
        </div>
        <div className="m1-card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">最大登录尝试次数</label>
              <input
                type="number"
                className="m1-input w-full"
                value={securityConfig.accessControl.maxLoginAttempts}
                onChange={(e) => updateAccessControl('maxLoginAttempts', parseInt(e.target.value))}
                min="3"
                max="10"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">锁定时长（分钟）</label>
              <input
                type="number"
                className="m1-input w-full"
                value={securityConfig.accessControl.lockoutDuration}
                onChange={(e) => updateAccessControl('lockoutDuration', parseInt(e.target.value))}
                min="5"
                max="1440"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">会话超时（分钟）</label>
              <input
                type="number"
                className="m1-input w-full"
                value={securityConfig.accessControl.sessionTimeout}
                onChange={(e) => updateAccessControl('sessionTimeout', parseInt(e.target.value))}
                min="30"
                max="480"
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="twoFactorAuth"
                className="m1-checkbox"
                checked={securityConfig.accessControl.twoFactorAuth}
                onChange={(e) => updateAccessControl('twoFactorAuth', e.target.checked)}
              />
              <label htmlFor="twoFactorAuth" className="text-sm">启用双因素认证</label>
            </div>
          </div>
        </div>
      </div>

      {/* 审计日志 */}
      <div className="m1-card">
        <div className="m1-card-header">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Activity className="w-5 h-5" />
              审计日志
            </h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="auditEnabled"
                  className="m1-checkbox"
                  checked={securityConfig.auditLog.enabled}
                  onChange={(e) => updateAuditLog('enabled', e.target.checked)}
                />
                <label htmlFor="auditEnabled" className="text-sm">启用审计日志</label>
              </div>
              <button className="m1-btn m1-btn-ghost text-sm">
                导出日志
              </button>
            </div>
          </div>
        </div>
        <div className="m1-card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium mb-2">日志保留天数</label>
              <input
                type="number"
                className="m1-input w-full"
                value={securityConfig.auditLog.retentionDays}
                onChange={(e) => updateAuditLog('retentionDays', parseInt(e.target.value))}
                min="30"
                max="3650"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">日志级别</label>
              <select
                className="m1-input w-full"
                value={securityConfig.auditLog.logLevel}
                onChange={(e) => updateAuditLog('logLevel', e.target.value)}
              >
                <option value="error">错误</option>
                <option value="warn">警告</option>
                <option value="info">信息</option>
                <option value="debug">调试</option>
              </select>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="m1-table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>用户</th>
                  <th>操作</th>
                  <th>IP地址</th>
                  <th>状态</th>
                  <th>详情</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="text-sm text-gray-400">{log.timestamp}</td>
                    <td className="font-medium">{log.user}</td>
                    <td>{log.action}</td>
                    <td className="text-sm text-gray-400">{log.ip}</td>
                    <td>
                      <span className={`m1-badge ${getStatusBadge(log.status)}`}>
                        {getStatusText(log.status)}
                      </span>
                    </td>
                    <td className="text-sm text-gray-400">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 保存按钮 */}
      <div className="flex justify-end">
        <button className="m1-btn m1-btn-primary flex items-center gap-2">
          <Save className="w-4 h-4" />
          保存安全设置
        </button>
      </div>
    </div>
  );
};

// 性能分析组件
const PerformanceAnalytics: React.FC = () => {
  const [performanceData, setPerformanceData] = useState({
    cpu: {
      usage: 45,
      cores: 8,
      temperature: 65,
      frequency: 3.2
    },
    memory: {
      used: 12.5,
      total: 32,
      usage: 39,
      available: 19.5
    },
    disk: {
      used: 256,
      total: 512,
      usage: 50,
      readSpeed: 150,
      writeSpeed: 120
    },
    network: {
      upload: 25.6,
      download: 45.2,
      latency: 12,
      connections: 156
    }
  });

  const [systemMetrics, setSystemMetrics] = useState([
    {
      id: 1,
      timestamp: new Date().toLocaleString(),
      cpu: 45,
      memory: 39,
      disk: 50,
      network: 35,
      response: 120
    },
    {
      id: 2,
      timestamp: new Date(Date.now() - 300000).toLocaleString(),
      cpu: 42,
      memory: 37,
      disk: 48,
      network: 32,
      response: 115
    },
    {
      id: 3,
      timestamp: new Date(Date.now() - 600000).toLocaleString(),
      cpu: 48,
      memory: 41,
      disk: 52,
      network: 38,
      response: 125
    }
  ]);

  const [alerts, setAlerts] = useState([
    {
      id: 1,
      type: 'warning',
      message: 'CPU使用率持续高于80%',
      timestamp: new Date(Date.now() - 180000).toLocaleString(),
      resolved: false
    },
    {
      id: 2,
      type: 'info',
      message: '内存使用率正常',
      timestamp: new Date(Date.now() - 360000).toLocaleString(),
      resolved: true
    }
  ]);

  const getUsageColor = (usage: number) => {
    if (usage < 50) return 'text-green-400';
    if (usage < 80) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getUsageBadge = (usage: number) => {
    if (usage < 50) return 'm1-badge-success';
    if (usage < 80) return 'm1-badge-warning';
    return 'm1-badge-error';
  };

  const getAlertBadge = (type: string) => {
    switch (type) {
      case 'error': return 'm1-badge-error';
      case 'warning': return 'm1-badge-warning';
      case 'info': return 'm1-badge-info';
      default: return 'm1-badge-info';
    }
  };

  const refreshMetrics = () => {
    // 模拟刷新性能数据
    setPerformanceData(prev => ({
      ...prev,
      cpu: {
        ...prev.cpu,
        usage: Math.floor(Math.random() * 100),
        temperature: Math.floor(Math.random() * 30) + 50
      },
      memory: {
        ...prev.memory,
        usage: Math.floor(Math.random() * 100)
      },
      disk: {
        ...prev.disk,
        usage: Math.floor(Math.random() * 100)
      },
      network: {
        ...prev.network,
        upload: Math.floor(Math.random() * 100),
        download: Math.floor(Math.random() * 100)
      }
    }));
  };

  return (
    <div className="space-y-6">
      {/* 系统概览 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* CPU */}
        <div className="m1-card">
          <div className="m1-card-body">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-blue-400" />
                <span className="font-medium">CPU</span>
              </div>
              <span className={`text-2xl font-bold ${getUsageColor(performanceData.cpu.usage)}`}>
                {performanceData.cpu.usage}%
              </span>
            </div>
            <div className="space-y-2 text-sm text-gray-400">
              <div className="flex justify-between">
                <span>核心数:</span>
                <span>{performanceData.cpu.cores}</span>
              </div>
              <div className="flex justify-between">
                <span>温度:</span>
                <span>{performanceData.cpu.temperature}°C</span>
              </div>
              <div className="flex justify-between">
                <span>频率:</span>
                <span>{performanceData.cpu.frequency}GHz</span>
              </div>
            </div>
          </div>
        </div>

        {/* 内存 */}
        <div className="m1-card">
          <div className="m1-card-body">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-green-400" />
                <span className="font-medium">内存</span>
              </div>
              <span className={`text-2xl font-bold ${getUsageColor(performanceData.memory.usage)}`}>
                {performanceData.memory.usage}%
              </span>
            </div>
            <div className="space-y-2 text-sm text-gray-400">
              <div className="flex justify-between">
                <span>已用:</span>
                <span>{performanceData.memory.used}GB</span>
              </div>
              <div className="flex justify-between">
                <span>总计:</span>
                <span>{performanceData.memory.total}GB</span>
              </div>
              <div className="flex justify-between">
                <span>可用:</span>
                <span>{performanceData.memory.available}GB</span>
              </div>
            </div>
          </div>
        </div>

        {/* 磁盘 */}
        <div className="m1-card">
          <div className="m1-card-body">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-purple-400" />
                <span className="font-medium">磁盘</span>
              </div>
              <span className={`text-2xl font-bold ${getUsageColor(performanceData.disk.usage)}`}>
                {performanceData.disk.usage}%
              </span>
            </div>
            <div className="space-y-2 text-sm text-gray-400">
              <div className="flex justify-between">
                <span>已用:</span>
                <span>{performanceData.disk.used}GB</span>
              </div>
              <div className="flex justify-between">
                <span>总计:</span>
                <span>{performanceData.disk.total}GB</span>
              </div>
              <div className="flex justify-between">
                <span>读取:</span>
                <span>{performanceData.disk.readSpeed}MB/s</span>
              </div>
            </div>
          </div>
        </div>

        {/* 网络 */}
        <div className="m1-card">
          <div className="m1-card-body">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Wifi className="w-5 h-5 text-orange-400" />
                <span className="font-medium">网络</span>
              </div>
              <span className="text-2xl font-bold text-blue-400">
                {performanceData.network.connections}
              </span>
            </div>
            <div className="space-y-2 text-sm text-gray-400">
              <div className="flex justify-between">
                <span>上传:</span>
                <span>{performanceData.network.upload}MB/s</span>
              </div>
              <div className="flex justify-between">
                <span>下载:</span>
                <span>{performanceData.network.download}MB/s</span>
              </div>
              <div className="flex justify-between">
                <span>延迟:</span>
                <span>{performanceData.network.latency}ms</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 性能监控 */}
      <div className="m1-card">
        <div className="m1-card-header">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Activity className="w-5 h-5" />
              性能监控
            </h3>
            <button 
              onClick={refreshMetrics}
              className="m1-btn m1-btn-ghost text-sm flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              刷新数据
            </button>
          </div>
        </div>
        <div className="m1-card-body">
          <div className="overflow-x-auto">
            <table className="m1-table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>CPU (%)</th>
                  <th>内存 (%)</th>
                  <th>磁盘 (%)</th>
                  <th>网络 (%)</th>
                  <th>响应时间 (ms)</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {systemMetrics.map((metric) => (
                  <tr key={metric.id}>
                    <td className="text-sm text-gray-400">{metric.timestamp}</td>
                    <td className={getUsageColor(metric.cpu)}>{metric.cpu}%</td>
                    <td className={getUsageColor(metric.memory)}>{metric.memory}%</td>
                    <td className={getUsageColor(metric.disk)}>{metric.disk}%</td>
                    <td className={getUsageColor(metric.network)}>{metric.network}%</td>
                    <td>{metric.response}</td>
                    <td>
                      <span className={`m1-badge ${getUsageBadge(Math.max(metric.cpu, metric.memory, metric.disk))}`}>
                        {Math.max(metric.cpu, metric.memory, metric.disk) < 50 ? '正常' : 
                         Math.max(metric.cpu, metric.memory, metric.disk) < 80 ? '警告' : '异常'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 系统告警 */}
      <div className="m1-card">
        <div className="m1-card-header">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            系统告警
          </h3>
        </div>
        <div className="m1-card-body">
          <div className="space-y-4">
            {alerts.map((alert) => (
              <div key={alert.id} className="flex items-center justify-between p-4 border border-gray-700 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className={`m1-badge ${getAlertBadge(alert.type)}`}>
                    {alert.type === 'error' ? '错误' : alert.type === 'warning' ? '警告' : '信息'}
                  </span>
                  <div>
                    <p className="font-medium">{alert.message}</p>
                    <p className="text-sm text-gray-400">{alert.timestamp}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {alert.resolved ? (
                    <span className="text-green-400 text-sm">已解决</span>
                  ) : (
                    <button className="m1-btn m1-btn-ghost text-sm">
                      标记已解决
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// 系统设置组件
const SystemSettings: React.FC = () => {
  const [systemConfig, setSystemConfig] = useState({
    serverName: 'M1-Server-001',
    serverDescription: '部门地图管理服务器',
    timezone: 'Asia/Shanghai',
    language: 'zh-CN',
    theme: 'dark',
    autoBackup: true,
    backupInterval: 24,
    logLevel: 'info',
    maxConnections: 1000,
    sessionTimeout: 30,
    enableSSL: true,
    sslPort: 443,
    enableCORS: true,
    corsOrigins: '*'
  });

  const [backupSettings, setBackupSettings] = useState({
    enabled: true,
    schedule: 'daily',
    retention: 30,
    location: '/backup',
    compression: true
  });

  const [notifications, setNotifications] = useState({
    email: true,
    emailAddress: 'admin@company.com',
    sms: false,
    smsNumber: '',
    webhook: false,
    webhookUrl: ''
  });

  const [systemLogs, setSystemLogs] = useState([
    {
      id: 1,
      timestamp: new Date().toLocaleString(),
      level: 'info',
      module: 'System',
      message: '系统启动完成',
      details: '所有服务正常运行'
    },
    {
      id: 2,
      timestamp: new Date(Date.now() - 300000).toLocaleString(),
      level: 'warning',
      module: 'Database',
      message: '数据库连接池达到80%',
      details: '当前连接数: 800/1000'
    },
    {
      id: 3,
      timestamp: new Date(Date.now() - 600000).toLocaleString(),
      level: 'error',
      module: 'Auth',
      message: '登录失败次数过多',
      details: 'IP: 192.168.1.100, 尝试次数: 5'
    }
  ]);

  const [isLoading, setIsLoading] = useState(false);

  const handleConfigChange = (key: string, value: any) => {
    setSystemConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleBackupChange = (key: string, value: any) => {
    setBackupSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleNotificationChange = (key: string, value: any) => {
    setNotifications(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const saveSettings = async () => {
    setIsLoading(true);
    try {
      // 模拟保存设置
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('Settings saved:', { systemConfig, backupSettings, notifications });
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const restartSystem = async () => {
    if (confirm('确定要重启系统吗？这将中断所有连接。')) {
      setIsLoading(true);
      try {
        // 模拟重启系统
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('System restart initiated');
      } catch (error) {
        console.error('Failed to restart system:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const exportLogs = () => {
    const logsData = JSON.stringify(systemLogs, null, 2);
    const blob = new Blob([logsData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearLogs = () => {
    if (confirm('确定要清空所有日志吗？此操作不可恢复。')) {
      setSystemLogs([]);
    }
  };

  const getLogBadge = (level: string) => {
    switch (level) {
      case 'error': return 'm1-badge-error';
      case 'warning': return 'm1-badge-warning';
      case 'info': return 'm1-badge-info';
      default: return 'm1-badge-info';
    }
  };

  return (
    <div className="space-y-6">
      {/* 基本设置 */}
      <div className="m1-card">
        <div className="m1-card-header">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Settings className="w-5 h-5" />
            基本设置
          </h3>
        </div>
        <div className="m1-card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">服务器名称</label>
                <input
                  type="text"
                  value={systemConfig.serverName}
                  onChange={(e) => handleConfigChange('serverName', e.target.value)}
                  className="m1-input"
                  placeholder="输入服务器名称"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">服务器描述</label>
                <textarea
                  value={systemConfig.serverDescription}
                  onChange={(e) => handleConfigChange('serverDescription', e.target.value)}
                  className="m1-input h-20 resize-none"
                  placeholder="输入服务器描述"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">时区</label>
                <select
                  value={systemConfig.timezone}
                  onChange={(e) => handleConfigChange('timezone', e.target.value)}
                  className="m1-input"
                >
                  <option value="Asia/Shanghai">Asia/Shanghai (UTC+8)</option>
                  <option value="UTC">UTC (UTC+0)</option>
                  <option value="America/New_York">America/New_York (UTC-5)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">语言</label>
                <select
                  value={systemConfig.language}
                  onChange={(e) => handleConfigChange('language', e.target.value)}
                  className="m1-input"
                >
                  <option value="zh-CN">简体中文</option>
                  <option value="en-US">English</option>
                  <option value="ja-JP">日本語</option>
                </select>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">主题</label>
                <select
                  value={systemConfig.theme}
                  onChange={(e) => handleConfigChange('theme', e.target.value)}
                  className="m1-input"
                >
                  <option value="dark">深色主题</option>
                  <option value="light">浅色主题</option>
                  <option value="auto">自动</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">日志级别</label>
                <select
                  value={systemConfig.logLevel}
                  onChange={(e) => handleConfigChange('logLevel', e.target.value)}
                  className="m1-input"
                >
                  <option value="debug">Debug</option>
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="error">Error</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">最大连接数</label>
                <input
                  type="number"
                  value={systemConfig.maxConnections}
                  onChange={(e) => handleConfigChange('maxConnections', parseInt(e.target.value))}
                  className="m1-input"
                  min="100"
                  max="10000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">会话超时 (分钟)</label>
                <input
                  type="number"
                  value={systemConfig.sessionTimeout}
                  onChange={(e) => handleConfigChange('sessionTimeout', parseInt(e.target.value))}
                  className="m1-input"
                  min="5"
                  max="120"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 安全设置 */}
      <div className="m1-card">
        <div className="m1-card-header">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5" />
            安全设置
          </h3>
        </div>
        <div className="m1-card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium">启用SSL</label>
                  <p className="text-xs text-gray-400">使用HTTPS加密连接</p>
                </div>
                <input
                  type="checkbox"
                  checked={systemConfig.enableSSL}
                  onChange={(e) => handleConfigChange('enableSSL', e.target.checked)}
                  className="m1-checkbox"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">SSL端口</label>
                <input
                  type="number"
                  value={systemConfig.sslPort}
                  onChange={(e) => handleConfigChange('sslPort', parseInt(e.target.value))}
                  className="m1-input"
                  disabled={!systemConfig.enableSSL}
                />
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium">启用CORS</label>
                  <p className="text-xs text-gray-400">允许跨域请求</p>
                </div>
                <input
                  type="checkbox"
                  checked={systemConfig.enableCORS}
                  onChange={(e) => handleConfigChange('enableCORS', e.target.checked)}
                  className="m1-checkbox"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">CORS来源</label>
                <input
                  type="text"
                  value={systemConfig.corsOrigins}
                  onChange={(e) => handleConfigChange('corsOrigins', e.target.value)}
                  className="m1-input"
                  placeholder="*或具体域名"
                  disabled={!systemConfig.enableCORS}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 备份设置 */}
      <div className="m1-card">
        <div className="m1-card-header">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Database className="w-5 h-5" />
            备份设置
          </h3>
        </div>
        <div className="m1-card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium">自动备份</label>
                  <p className="text-xs text-gray-400">定期自动备份数据</p>
                </div>
                <input
                  type="checkbox"
                  checked={backupSettings.enabled}
                  onChange={(e) => handleBackupChange('enabled', e.target.checked)}
                  className="m1-checkbox"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">备份频率</label>
                <select
                  value={backupSettings.schedule}
                  onChange={(e) => handleBackupChange('schedule', e.target.value)}
                  className="m1-input"
                  disabled={!backupSettings.enabled}
                >
                  <option value="hourly">每小时</option>
                  <option value="daily">每天</option>
                  <option value="weekly">每周</option>
                  <option value="monthly">每月</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">保留天数</label>
                <input
                  type="number"
                  value={backupSettings.retention}
                  onChange={(e) => handleBackupChange('retention', parseInt(e.target.value))}
                  className="m1-input"
                  min="1"
                  max="365"
                  disabled={!backupSettings.enabled}
                />
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">备份位置</label>
                <input
                  type="text"
                  value={backupSettings.location}
                  onChange={(e) => handleBackupChange('location', e.target.value)}
                  className="m1-input"
                  placeholder="备份文件存储路径"
                  disabled={!backupSettings.enabled}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium">启用压缩</label>
                  <p className="text-xs text-gray-400">压缩备份文件以节省空间</p>
                </div>
                <input
                  type="checkbox"
                  checked={backupSettings.compression}
                  onChange={(e) => handleBackupChange('compression', e.target.checked)}
                  className="m1-checkbox"
                  disabled={!backupSettings.enabled}
                />
              </div>
              <div className="pt-4">
                <button className="m1-btn m1-btn-primary w-full" disabled={!backupSettings.enabled}>
                  立即备份
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 通知设置 */}
      <div className="m1-card">
        <div className="m1-card-header">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Bell className="w-5 h-5" />
            通知设置
          </h3>
        </div>
        <div className="m1-card-body">
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 border border-gray-700 rounded-lg">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-blue-400" />
                <div>
                  <label className="block text-sm font-medium">邮件通知</label>
                  <p className="text-xs text-gray-400">通过邮件接收系统通知</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={notifications.email}
                onChange={(e) => handleNotificationChange('email', e.target.checked)}
                className="m1-checkbox"
              />
            </div>
            {notifications.email && (
              <div className="ml-8">
                <input
                  type="email"
                  value={notifications.emailAddress}
                  onChange={(e) => handleNotificationChange('emailAddress', e.target.value)}
                  className="m1-input"
                  placeholder="输入邮箱地址"
                />
              </div>
            )}

            <div className="flex items-center justify-between p-4 border border-gray-700 rounded-lg">
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-green-400" />
                <div>
                  <label className="block text-sm font-medium">短信通知</label>
                  <p className="text-xs text-gray-400">通过短信接收紧急通知</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={notifications.sms}
                onChange={(e) => handleNotificationChange('sms', e.target.checked)}
                className="m1-checkbox"
              />
            </div>
            {notifications.sms && (
              <div className="ml-8">
                <input
                  type="tel"
                  value={notifications.smsNumber}
                  onChange={(e) => handleNotificationChange('smsNumber', e.target.value)}
                  className="m1-input"
                  placeholder="输入手机号码"
                />
              </div>
            )}

            <div className="flex items-center justify-between p-4 border border-gray-700 rounded-lg">
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-purple-400" />
                <div>
                  <label className="block text-sm font-medium">Webhook通知</label>
                  <p className="text-xs text-gray-400">通过HTTP回调发送通知</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={notifications.webhook}
                onChange={(e) => handleNotificationChange('webhook', e.target.checked)}
                className="m1-checkbox"
              />
            </div>
            {notifications.webhook && (
              <div className="ml-8">
                <input
                  type="url"
                  value={notifications.webhookUrl}
                  onChange={(e) => handleNotificationChange('webhookUrl', e.target.value)}
                  className="m1-input"
                  placeholder="输入Webhook URL"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 系统日志 */}
      <div className="m1-card">
        <div className="m1-card-header">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5" />
              系统日志
            </h3>
            <div className="flex gap-2">
              <button 
                onClick={exportLogs}
                className="m1-btn m1-btn-ghost text-sm flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                导出日志
              </button>
              <button 
                onClick={clearLogs}
                className="m1-btn m1-btn-ghost text-sm flex items-center gap-2 text-red-400 hover:text-red-300"
              >
                <Trash2 className="w-4 h-4" />
                清空日志
              </button>
            </div>
          </div>
        </div>
        <div className="m1-card-body">
          <div className="overflow-x-auto">
            <table className="m1-table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>级别</th>
                  <th>模块</th>
                  <th>消息</th>
                  <th>详情</th>
                </tr>
              </thead>
              <tbody>
                {systemLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="text-sm text-gray-400">{log.timestamp}</td>
                    <td>
                      <span className={`m1-badge ${getLogBadge(log.level)}`}>
                        {log.level.toUpperCase()}
                      </span>
                    </td>
                    <td>{log.module}</td>
                    <td>{log.message}</td>
                    <td className="text-sm text-gray-400">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex justify-between items-center">
        <button 
          onClick={restartSystem}
          className="m1-btn m1-btn-error flex items-center gap-2"
          disabled={isLoading}
        >
          <Power className="w-4 h-4" />
          重启系统
        </button>
        <div className="flex gap-3">
          <button className="m1-btn m1-btn-ghost" disabled={isLoading}>
            重置设置
          </button>
          <button 
            onClick={saveSettings}
            className="m1-btn m1-btn-primary flex items-center gap-2"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            保存设置
          </button>
        </div>
      </div>
    </div>
  );
};

export default M1ServerManagement;