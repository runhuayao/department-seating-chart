import React, { useState, useEffect } from 'react';
import { Monitor, Server, Settings, Activity, Users, Shield, BarChart3, Terminal, Database, MapPin, Edit, Trash2, Eye, Plus, LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ServerMonitor from '../components/ServerMonitor';
import ServerDetails from '../components/ServerDetails';
import { getCurrentCSTTime, getRandomPastTime, getFutureTime } from '../utils/timeUtils';
import '../styles/m1-theme.css';

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  component: React.ReactNode;
}

const M1ServerManagement: React.FC = () => {
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [isConnected, setIsConnected] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState({
    status: 'connected',
    lastUpdate: getCurrentCSTTime(),
    uptime: '99.9%',
    responseTime: '12ms'
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setConnectionStatus(prev => ({
        ...prev,
        lastUpdate: getCurrentCSTTime(),
        responseTime: `${Math.floor(Math.random() * 20) + 10}ms`
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
  };

  const navigationItems: NavigationItem[] = [
    {
      id: 'overview',
      label: '系统概览',
      icon: <Monitor className="w-5 h-5" />,
      component: <ServerMonitor />
    },
    {
      id: 'database',
      label: '数据库管理',
      icon: <Database className="w-5 h-5" />,
      component: <DatabaseManagement />
    },
    {
      id: 'workstation',
      label: '工位管理',
      icon: <MapPin className="w-5 h-5" />,
      component: <WorkstationManagement />
    },
    {
      id: 'users',
      label: '用户管理',
      icon: <Users className="w-5 h-5" />,
      component: <UserManagement />
    },
    {
      id: 'processes',
      label: '进程管理',
      icon: <Activity className="w-5 h-5" />,
      component: <ProcessManagement />
    },
    {
      id: 'logs',
      label: '系统日志',
      icon: <Terminal className="w-5 h-5" />,
      component: <SystemLogs />
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

  const getPageDescription = (tabId: string): string => {
    const descriptions: Record<string, string> = {
      overview: '监控服务器状态、性能指标和系统健康度',
      database: '管理数据库连接、备份和性能优化',
      workstation: '管理工位信息、状态和分配',
      users: '管理用户账户、权限和访问控制',
      processes: '监控和管理系统进程',
      logs: '查看和分析系统日志',
      security: '配置安全策略和访问控制',
      analytics: '分析系统性能和使用统计',
      settings: '配置系统参数和偏好设置'
    };
    return descriptions[tabId] || '';
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Server className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">M1 服务器管理</h1>
                  <p className="text-xs text-gray-400">企业级服务器监控与管理平台</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
                <span className="text-sm text-gray-300">
                  {isConnected ? '已连接' : '连接断开'}
                </span>
              </div>
              <div className="text-sm text-gray-400">
                {connectionStatus.lastUpdate}
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                退出登录
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 overflow-x-auto">
            {navigationItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === item.id
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Page Description */}
      <div className="bg-slate-800/50 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <p className="text-sm text-gray-400">
            {getPageDescription(activeTab)}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {navigationItems.find(item => item.id === activeTab)?.component}
      </div>

      {/* Connection Status Modal */}
      {!isConnected && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 max-w-md mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-3 h-3 bg-red-400 rounded-full animate-pulse"></div>
              <h3 className="text-lg font-semibold text-red-400">连接断开</h3>
            </div>
            <p className="text-gray-300 mb-6">
              与服务器的连接已断开，正在尝试重新连接...
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setIsConnected(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                重试连接
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const DatabaseManagement: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [databases] = useState([
    { name: 'department_map', size: '2.3 GB', status: 'active', lastBackup: '2024-01-15 14:30' },
    { name: 'user_sessions', size: '156 MB', status: 'active', lastBackup: '2024-01-15 14:30' },
    { name: 'system_logs', size: '892 MB', status: 'active', lastBackup: '2024-01-15 14:30' }
  ]);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleBackup = (dbName: string) => {
    console.log(`备份数据库: ${dbName}`);
  };

  const handleOptimize = (dbName: string) => {
    console.log(`优化数据库: ${dbName}`);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="m1-card">
          <div className="m1-card-body text-center">
            <div className="text-2xl font-bold text-blue-400">3</div>
            <div className="text-sm text-gray-400">数据库总数</div>
          </div>
        </div>
        <div className="m1-card">
          <div className="m1-card-body text-center">
            <div className="text-2xl font-bold text-green-400">3.4 GB</div>
            <div className="text-sm text-gray-400">总存储空间</div>
          </div>
        </div>
        <div className="m1-card">
          <div className="m1-card-body text-center">
            <div className="text-2xl font-bold text-yellow-400">98.5%</div>
            <div className="text-sm text-gray-400">查询性能</div>
          </div>
        </div>
        <div className="m1-card">
          <div className="m1-card-body text-center">
            <div className="text-2xl font-bold text-purple-400">24h</div>
            <div className="text-sm text-gray-400">备份间隔</div>
          </div>
        </div>
      </div>

      <div className="m1-card">
        <div className="m1-card-header">
          <h3 className="text-lg font-semibold">数据库列表</h3>
          <button className="m1-btn-primary">
            创建数据库
          </button>
        </div>
        <div className="m1-card-body">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
              <span className="ml-2 text-gray-400">加载中...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="m1-table">
                <thead>
                  <tr>
                    <th>数据库名称</th>
                    <th>大小</th>
                    <th>状态</th>
                    <th>最后备份</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {databases.map((db) => (
                    <tr key={db.name}>
                      <td className="font-medium">{db.name}</td>
                      <td>{db.size}</td>
                      <td>
                        <span className="px-2 py-1 text-xs rounded-full bg-green-900 text-green-300">
                          {db.status}
                        </span>
                      </td>
                      <td className="text-gray-400 text-sm">{db.lastBackup}</td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleBackup(db.name)}
                            className="text-blue-400 hover:text-blue-300"
                            title="备份"
                          >
                            备份
                          </button>
                          <button
                            onClick={() => handleOptimize(db.name)}
                            className="text-green-400 hover:text-green-300"
                            title="优化"
                          >
                            优化
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

      <div className="m1-card">
        <div className="m1-card-header">
          <h3 className="text-lg font-semibold">数据库监控</h3>
        </div>
        <div className="m1-card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-2">连接数</h4>
              <div className="text-2xl font-bold text-blue-400">24/100</div>
              <div className="text-xs text-gray-400">当前活跃连接</div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-2">查询/秒</h4>
              <div className="text-2xl font-bold text-green-400">156</div>
              <div className="text-xs text-gray-400">平均查询频率</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ProcessManagement: React.FC = () => {
  const [processes, setProcesses] = useState([
    { id: 1, name: 'nginx', cpu: '2.3%', memory: '45MB', status: 'running' },
    { id: 2, name: 'node', cpu: '15.7%', memory: '234MB', status: 'running' },
    { id: 3, name: 'postgres', cpu: '8.1%', memory: '156MB', status: 'running' }
  ]);
  const [loading, setLoading] = useState(false);

  const generateMockProcesses = () => {
    const processNames = ['nginx', 'node', 'postgres', 'redis', 'docker', 'systemd', 'chrome', 'vscode'];
    const statuses = ['running', 'stopped', 'sleeping'];
    
    return Array.from({ length: 8 }, (_, index) => ({
      id: index + 1,
      name: processNames[index % processNames.length],
      cpu: `${(Math.random() * 20).toFixed(1)}%`,
      memory: `${Math.floor(Math.random() * 500) + 50}MB`,
      status: statuses[Math.floor(Math.random() * statuses.length)]
    }));
  };

  const fetchProcesses = async (forceRefresh = false) => {
    console.log('开始获取进程数据...');
    setLoading(true);
    
    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 生成新的进程数据
      const newProcesses = generateMockProcesses();
      setProcesses(newProcesses);
      console.log('进程数据获取完成');
    } catch (error) {
      console.error('获取进程数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshProcesses = async () => {
    console.log('刷新进程数据...');
    // 清除localStorage中的进程相关数据
    localStorage.removeItem('processes_cache');
    localStorage.removeItem('processes_last_fetch');
    
    // 强制刷新数据
    await fetchProcesses(true);
  };

  return (
    <div className="space-y-6">
      <div className="m1-card">
        <div className="m1-card-header flex justify-between items-center">
          <h3 className="text-lg font-semibold">进程列表</h3>
          <button
            onClick={handleRefreshProcesses}
            disabled={loading}
            className="m1-btn-secondary flex items-center gap-2"
            title="刷新进程数据"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新数据
          </button>
        </div>
        <div className="m1-card-body">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
                <span className="text-gray-400">正在加载进程数据...</span>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="m1-table">
                <thead>
                  <tr>
                    <th>进程名</th>
                    <th>CPU使用率</th>
                    <th>内存使用</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {processes.map((process) => (
                    <tr key={process.id}>
                      <td className="font-medium">{process.name}</td>
                      <td>{process.cpu}</td>
                      <td>{process.memory}</td>
                      <td>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          process.status === 'running' ? 'bg-green-900 text-green-300' :
                          process.status === 'stopped' ? 'bg-red-900 text-red-300' :
                          'bg-yellow-900 text-yellow-300'
                        }`}>
                          {process.status}
                        </span>
                      </td>
                      <td>
                        <button className="text-red-400 hover:text-red-300">
                          终止
                        </button>
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

const SystemLogs: React.FC = () => {
  const [logs, setLogs] = useState([
    { time: '2024-01-15 15:30:25', level: 'INFO', message: '用户登录成功' },
    { time: '2024-01-15 15:29:18', level: 'WARN', message: '数据库连接池接近上限' },
    { time: '2024-01-15 15:28:45', level: 'ERROR', message: '文件上传失败' }
  ]);
  const [loading, setLoading] = useState(false);

  const generateMockLogs = () => {
    const levels = ['INFO', 'WARN', 'ERROR', 'DEBUG'];
    const messages = [
      '用户登录成功',
      '数据库连接池接近上限',
      '文件上传失败',
      '系统启动完成',
      '内存使用率过高',
      '网络连接超时',
      '缓存清理完成',
      '定时任务执行成功',
      '权限验证失败',
      '数据备份完成'
    ];
    
    return Array.from({ length: 10 }, (_, index) => {
      const now = new Date();
      const time = new Date(now.getTime() - Math.random() * 24 * 60 * 60 * 1000);
      
      return {
        id: index + 1,
        time: time.toLocaleString('zh-CN', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit', 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit' 
        }),
        level: levels[Math.floor(Math.random() * levels.length)],
        message: messages[Math.floor(Math.random() * messages.length)]
      };
    }).sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  };

  const fetchLogs = async (forceRefresh = false) => {
    console.log('开始获取日志数据...');
    setLoading(true);
    
    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // 生成新的日志数据
      const newLogs = generateMockLogs();
      setLogs(newLogs);
      console.log('日志数据获取完成');
    } catch (error) {
      console.error('获取日志数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshLogs = async () => {
    console.log('刷新日志数据...');
    // 清除localStorage中的日志相关数据
    localStorage.removeItem('logs_cache');
    localStorage.removeItem('logs_last_fetch');
    
    // 强制刷新数据
    await fetchLogs(true);
  };

  return (
    <div className="space-y-6">
      <div className="m1-card">
        <div className="m1-card-header flex justify-between items-center">
          <h3 className="text-lg font-semibold">系统日志</h3>
          <button
            onClick={handleRefreshLogs}
            disabled={loading}
            className="m1-btn-secondary flex items-center gap-2"
            title="刷新日志数据"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新数据
          </button>
        </div>
        <div className="m1-card-body">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin mr-2" />
              <span>正在加载日志数据...</span>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log, index) => (
                <div key={index} className="flex items-center gap-4 p-3 bg-slate-800 rounded-lg">
                  <span className="text-xs text-gray-400 w-32">{log.time}</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    log.level === 'ERROR' ? 'bg-red-900 text-red-300' :
                    log.level === 'WARN' ? 'bg-yellow-900 text-yellow-300' :
                    log.level === 'DEBUG' ? 'bg-blue-900 text-blue-300' :
                    'bg-green-900 text-green-300'
                  }`}>
                    {log.level}
                  </span>
                  <span className="text-sm text-gray-300 flex-1">{log.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

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
    id: '',
    name: '',
    floor: '1F',
    department: '技术部',
    status: 'available',
    assignedTo: '',
    equipment: []
  });

  // 当workstation prop变化时，更新formData
  useEffect(() => {
    if (workstation) {
      setFormData({
        id: workstation.id || '',
        name: workstation.name || '',
        floor: workstation.floor || '1F',
        department: workstation.department || '技术部',
        status: workstation.status || 'available',
        assignedTo: workstation.assignedTo || '',
        equipment: workstation.equipment || []
      });
    } else {
      // 如果没有workstation（新建模式），重置为默认值
      setFormData({
        id: '',
        name: '',
        floor: '1F',
        department: '技术部',
        status: 'available',
        assignedTo: '',
        equipment: []
      });
    }
  }, [workstation, isOpen]);

  const floors = ['1F', '2F', '3F', '4F', '5F'];
  const departments = ['技术部', '产品部', '设计部', '市场部', '人事部'];
  const statusOptions = [
    { value: 'available', label: '可用', color: 'text-green-600 bg-green-100' },
    { value: 'occupied', label: '已占用', color: 'text-blue-600 bg-blue-100' },
    { value: 'maintenance', label: '维护中', color: 'text-yellow-600 bg-yellow-100' },
    { value: 'reserved', label: '预留', color: 'text-purple-600 bg-purple-100' }
  ];

  const handleSave = () => {
    if (onSave) {
      onSave(formData);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">工位编号</label>
            <input
              type="text"
              value={formData.id}
              onChange={(e) => setFormData({...formData, id: e.target.value})}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
              placeholder="请输入工位编号"
              readOnly={readOnly}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">工位名称</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
              placeholder="请输入工位名称"
              readOnly={readOnly}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">楼层</label>
            <select
              value={formData.floor}
              onChange={(e) => setFormData({...formData, floor: e.target.value})}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
              disabled={readOnly}
            >
              {floors.map(floor => (
                <option key={floor} value={floor}>{floor}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">部门</label>
            <select
              value={formData.department}
              onChange={(e) => setFormData({...formData, department: e.target.value})}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
              disabled={readOnly}
            >
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">状态</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({...formData, status: e.target.value})}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
              disabled={readOnly}
            >
              {statusOptions.map(status => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">分配给</label>
            <input
              type="text"
              value={formData.assignedTo}
              onChange={(e) => setFormData({...formData, assignedTo: e.target.value})}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
              placeholder="请输入用户名"
              readOnly={readOnly}
            />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          {!readOnly && (
            <button
              onClick={handleSave}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
            >
              保存
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors"
          >
            {readOnly ? '关闭' : '取消'}
          </button>
        </div>
      </div>
    </div>
  );
};

const WorkstationManagement: React.FC = () => {
  const [workstations, setWorkstations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedWorkstation, setSelectedWorkstation] = useState<any>(null);

  const generateMockWorkstations = () => {
    const floors = ['1F', '2F', '3F', '4F', '5F'];
    const departments = ['技术部', '产品部', '设计部', '市场部', '人事部'];
    const statuses = ['available', 'occupied', 'maintenance', 'reserved'];
    const users = ['张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十'];
    
    return Array.from({ length: 50 }, (_, index) => ({
      id: `WS-${String(index + 1).padStart(3, '0')}`,
      name: `工位-${index + 1}`,
      floor: floors[Math.floor(Math.random() * floors.length)],
      department: departments[Math.floor(Math.random() * departments.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      assignedTo: Math.random() > 0.3 ? users[Math.floor(Math.random() * users.length)] : '',
      equipment: ['电脑', '显示器', '键盘', '鼠标'].slice(0, Math.floor(Math.random() * 4) + 1),
      lastUpdated: getRandomPastTime(),
      createdAt: getRandomPastTime()
    }));
  };

  const fetchWorkstations = async (forceRefresh = false) => {
    console.log('开始获取工位数据...');
    setLoading(true);
    
    try {
      const response = await fetch('http://localhost:8080/api/workstations');
      console.log('API 响应状态:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('API 返回数据:', data);
        
        // 处理不同的 API 响应格式
        let workstationData = [];
        if (Array.isArray(data)) {
          workstationData = data;
        } else if (data.data && Array.isArray(data.data)) {
          workstationData = data.data;
        } else if (data.workstations && Array.isArray(data.workstations)) {
          workstationData = data.workstations;
        }
        
        if (workstationData.length > 0) {
          setWorkstations(workstationData);
          console.log('成功设置工位数据:', workstationData.length, '条记录');
        } else {
          console.log('API 返回空数据，使用模拟数据');
          const mockData = generateMockWorkstations();
          setWorkstations(mockData);
        }
      } else {
        console.log('API 请求失败，状态码:', response.status);
        const mockData = generateMockWorkstations();
        setWorkstations(mockData);
      }
    } catch (error) {
      console.error('获取工位数据失败:', error);
      console.log('使用模拟数据作为 fallback');
      const mockData = generateMockWorkstations();
      setWorkstations(mockData);
    } finally {
      setLoading(false);
      console.log('工位数据获取完成');
    }
  };

  useEffect(() => {
    fetchWorkstations();
  }, []);

  const handleRefreshWorkstations = async () => {
    console.log('刷新工位数据...');
    
    // 清除localStorage中的工位相关数据
    localStorage.removeItem('workstations_cache');
    localStorage.removeItem('workstations_last_fetch');
    
    try {
      // 强制刷新数据
      await fetchWorkstations(true);
      
      // 显示成功提示
      console.log('✅ 工位数据刷新成功！');
      
      // 可以添加一个临时的成功提示（可选）
      const successMessage = document.createElement('div');
      successMessage.className = 'fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      successMessage.textContent = '工位数据刷新成功！';
      document.body.appendChild(successMessage);
      
      // 3秒后移除提示
      setTimeout(() => {
        if (document.body.contains(successMessage)) {
          document.body.removeChild(successMessage);
        }
      }, 3000);
      
    } catch (error) {
      console.error('❌ 工位数据刷新失败:', error);
      
      // 显示错误提示
      const errorMessage = document.createElement('div');
      errorMessage.className = 'fixed top-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      errorMessage.textContent = '工位数据刷新失败，请重试';
      document.body.appendChild(errorMessage);
      
      // 3秒后移除提示
      setTimeout(() => {
        if (document.body.contains(errorMessage)) {
          document.body.removeChild(errorMessage);
        }
      }, 3000);
    }
  };

  const handleCreateWorkstation = () => {
    setShowCreateModal(true);
  };

  const handleViewWorkstation = (workstation: any) => {
    setSelectedWorkstation(workstation);
    setShowViewModal(true);
  };

  const handleEditWorkstation = (workstation: any) => {
    setSelectedWorkstation(workstation);
    setShowEditModal(true);
  };

  const handleDeleteWorkstation = (workstationId: string) => {
    if (confirm('确定要删除这个工位吗？')) {
      setWorkstations(prev => prev.filter(w => w.id !== workstationId));
    }
  };

  const handleSaveWorkstation = (workstationData: any) => {
    if (showCreateModal) {
      const newWorkstation = {
        ...workstationData,
        id: `WS-${String(workstations.length + 1).padStart(3, '0')}`,
        createdAt: getCurrentCSTTime(),
        lastUpdated: getCurrentCSTTime()
      };
      setWorkstations(prev => [...prev, newWorkstation]);
    } else if (showEditModal) {
      setWorkstations(prev => prev.map(w => 
        w.id === workstationData.id 
          ? { ...workstationData, lastUpdated: getCurrentCSTTime() }
          : w
      ));
    }
  };

  const getStatusDisplay = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      available: { label: '可用', color: 'text-green-600 bg-green-100' },
      occupied: { label: '已占用', color: 'text-blue-600 bg-blue-100' },
      maintenance: { label: '维护中', color: 'text-yellow-600 bg-yellow-100' },
      reserved: { label: '预留', color: 'text-purple-600 bg-purple-100' }
    };
    return statusMap[status] || { label: status, color: 'text-gray-600 bg-gray-100' };
  };

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="m1-card">
          <div className="m1-card-body text-center">
            <div className="text-2xl font-bold text-blue-400">{workstations.length}</div>
            <div className="text-sm text-gray-400">总工位数</div>
          </div>
        </div>
        <div className="m1-card">
          <div className="m1-card-body text-center">
            <div className="text-2xl font-bold text-green-400">{workstations.filter(w => w.status === 'available').length}</div>
            <div className="text-sm text-gray-400">可用工位</div>
          </div>
        </div>
        <div className="m1-card">
          <div className="m1-card-body text-center">
            <div className="text-2xl font-bold text-blue-400">{workstations.filter(w => w.status === 'occupied').length}</div>
            <div className="text-sm text-gray-400">已占用</div>
          </div>
        </div>
        <div className="m1-card">
          <div className="m1-card-body text-center">
            <div className="text-2xl font-bold text-yellow-400">{workstations.filter(w => w.status === 'maintenance').length}</div>
            <div className="text-sm text-gray-400">维护中</div>
          </div>
        </div>
      </div>

      {/* 工位管理 */}
      <div className="m1-card">
        <div className="m1-card-header flex justify-between items-center">
          <h3 className="text-lg font-semibold">工位管理</h3>
          <div className="flex gap-2">
            <button
              onClick={handleRefreshWorkstations}
              disabled={loading}
              className="m1-btn-secondary flex items-center gap-2"
              title="刷新工位数据"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              刷新数据
            </button>
            <button
              onClick={handleCreateWorkstation}
              className="m1-btn-primary flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              添加工位
            </button>
          </div>
        </div>
        <div className="m1-card-body">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
                <span className="text-gray-400">正在加载工位数据...</span>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="m1-table">
                <thead>
                  <tr>
                    <th>工位编号</th>
                    <th>工位名称</th>
                    <th>楼层</th>
                    <th>部门</th>
                    <th>分配给</th>
                    <th>状态</th>
                    <th>最后更新</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {workstations.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-gray-400">
                        暂无工位数据
                      </td>
                    </tr>
                  ) : (
                    workstations.map((workstation) => {
                      const statusDisplay = getStatusDisplay(workstation.status);
                      return (
                        <tr key={workstation.id}>
                          <td className="font-medium text-blue-400">{workstation.id}</td>
                          <td className="text-white">{workstation.name}</td>
                          <td className="text-gray-300">{workstation.floor}</td>
                          <td className="text-gray-300">{workstation.department}</td>
                          <td className="text-gray-300">{workstation.assignedTo || '-'}</td>
                          <td>
                            <span className={`px-2 py-1 text-xs rounded-full ${statusDisplay.color}`}>
                              {statusDisplay.label}
                            </span>
                          </td>
                          <td className="text-gray-400 text-sm">{workstation.lastUpdated}</td>
                          <td>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleViewWorkstation(workstation)}
                                className="text-blue-400 hover:text-blue-300"
                                title="查看"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleEditWorkstation(workstation)}
                                className="text-green-400 hover:text-green-300"
                                title="编辑"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteWorkstation(workstation.id)}
                                className="text-red-400 hover:text-red-300"
                                title="删除"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 模态框 */}
      <WorkstationModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSave={handleSaveWorkstation}
        title="添加新工位"
      />

      <WorkstationModal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        workstation={selectedWorkstation}
        title="查看工位详情"
        readOnly={true}
      />

      <WorkstationModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSave={handleSaveWorkstation}
        workstation={selectedWorkstation}
        title="编辑工位"
      />
    </div>
  );
};

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    role: '普通用户',
    department: '技术部',
    status: 'active'
  });

  const roles = ['系统管理员', '部门经理', '普通用户', '访客'];
  const departments = ['技术部', '产品部', '设计部', '市场部', '人事部'];
  const statusOptions = [
    { value: 'active', label: '活跃', color: 'text-green-600 bg-green-100' },
    { value: 'inactive', label: '禁用', color: 'text-red-600 bg-red-100' },
    { value: 'pending', label: '待激活', color: 'text-yellow-600 bg-yellow-100' }
  ];

  const generateMockUsers = () => {
    const usernames = ['admin', '张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十', '郑十一'];
    const emails = ['admin@company.com', 'zhangsan@company.com', 'lisi@company.com', 'wangwu@company.com', 'zhaoliu@company.com'];
    const permissions = [
      ['用户管理', '系统设置', '数据导出'],
      ['工位管理', '数据查看'],
      ['基础查看'],
      ['工位预订', '个人设置'],
      ['数据分析', '报表生成']
    ];
    
    return Array.from({ length: 25 }, (_, index) => ({
      id: index + 1,
      username: usernames[index % usernames.length] + (index > 9 ? `-${Math.floor(index / 10)}` : ''),
      email: index === 0 ? emails[0] : `user${index}@company.com`,
      role: index === 0 ? '系统管理员' : roles[Math.floor(Math.random() * (roles.length - 1)) + 1],
      department: departments[Math.floor(Math.random() * departments.length)],
      status: ['active', 'inactive', 'pending'][Math.floor(Math.random() * 3)],
      lastLogin: getRandomPastTime(),
      permissions: permissions[Math.floor(Math.random() * permissions.length)],
      createdAt: getRandomPastTime()
    }));
  };

  const fetchUsers = async (forceRefresh = false) => {
    console.log('开始获取用户数据...');
    setLoading(true);
    
    try {
      const response = await fetch('http://localhost:8080/api/users');
      console.log('API 响应状态:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('API 返回数据:', data);
        
        // 处理不同的 API 响应格式
        let userData = [];
        if (Array.isArray(data)) {
          userData = data;
        } else if (data.data && Array.isArray(data.data)) {
          userData = data.data;
        } else if (data.users && Array.isArray(data.users)) {
          userData = data.users;
        }
        
        if (userData.length > 0) {
          setUsers(userData);
          console.log('成功设置用户数据:', userData.length, '条记录');
        } else {
          console.log('API 返回空数据，使用模拟数据');
          const mockData = generateMockUsers();
          setUsers(mockData);
        }
      } else {
        console.log('API 请求失败，状态码:', response.status);
        const mockData = generateMockUsers();
        setUsers(mockData);
      }
    } catch (error) {
      console.error('获取用户数据失败:', error);
      console.log('使用模拟数据作为 fallback');
      const mockData = generateMockUsers();
      setUsers(mockData);
    } finally {
      setLoading(false);
      console.log('用户数据获取完成');
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = () => {
    const user = {
      ...newUser,
      id: users.length + 1,
      permissions: ['基础查看'],
      lastLogin: '从未登录',
      createdAt: getCurrentCSTTime()
    };
    setUsers(prev => [...prev, user]);
    setNewUser({ username: '', email: '', role: '普通用户', department: '技术部', status: 'active' });
    setShowCreateModal(false);
  };

  const handleEditUser = (user: any) => {
    setSelectedUser(user);
    setShowEditModal(true);
  };

  const handleUpdateUser = () => {
    setUsers(prev => prev.map(u => u.id === selectedUser.id ? selectedUser : u));
    setShowEditModal(false);
  };

  const handleDeleteUser = (userId: number) => {
    if (confirm('确定要删除这个用户吗？')) {
      setUsers(prev => prev.filter(u => u.id !== userId));
    }
  };

  const handleRefreshUsers = async () => {
    console.log('刷新用户数据...');
    // 清除localStorage中的用户相关数据
    localStorage.removeItem('users_cache');
    localStorage.removeItem('users_last_fetch');
    
    // 强制刷新数据
    await fetchUsers(true);
  };

  const getStatusDisplay = (status: string) => {
    return statusOptions.find(s => s.value === status) || { label: status, color: 'text-gray-600 bg-gray-100' };
  };

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="m1-card">
          <div className="m1-card-body text-center">
            <div className="text-2xl font-bold text-blue-400">{users.length}</div>
            <div className="text-sm text-gray-400">总用户数</div>
          </div>
        </div>
        <div className="m1-card">
          <div className="m1-card-body text-center">
            <div className="text-2xl font-bold text-green-400">{users.filter(u => u.status === 'active').length}</div>
            <div className="text-sm text-gray-400">活跃用户</div>
          </div>
        </div>
        <div className="m1-card">
          <div className="m1-card-body text-center">
            <div className="text-2xl font-bold text-yellow-400">{users.filter(u => u.role === '系统管理员').length}</div>
            <div className="text-sm text-gray-400">管理员</div>
          </div>
        </div>
        <div className="m1-card">
          <div className="m1-card-body text-center">
            <div className="text-2xl font-bold text-purple-400">{departments.length}</div>
            <div className="text-sm text-gray-400">部门数量</div>
          </div>
        </div>
      </div>

      {/* 用户管理 */}
      <div className="m1-card">
        <div className="m1-card-header flex justify-between items-center">
          <h3 className="text-lg font-semibold">用户管理</h3>
          <div className="flex gap-2">
            <button
              onClick={handleRefreshUsers}
              disabled={loading}
              className="m1-btn-secondary flex items-center gap-2"
              title="刷新用户数据"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              刷新数据
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="m1-btn-primary flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              添加用户
            </button>
          </div>
        </div>
        <div className="m1-card-body">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
                <span className="text-gray-400">正在加载用户数据...</span>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="m1-table">
                <thead>
                  <tr>
                    <th>用户信息</th>
                    <th>角色</th>
                    <th>部门</th>
                    <th>状态</th>
                    <th>最后登录</th>
                    <th>权限</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-gray-400">
                        暂无用户数据
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => {
                      const statusDisplay = getStatusDisplay(user.status);
                      return (
                        <tr key={user.id}>
                          <td>
                            <div>
                              <div className="font-medium text-white">{user.username}</div>
                              <div className="text-sm text-gray-400">{user.email}</div>
                            </div>
                          </td>
                          <td>
                            <span className="px-2 py-1 text-xs rounded-full bg-blue-900 text-blue-300">
                              {user.role}
                            </span>
                          </td>
                          <td className="text-gray-300">{user.department}</td>
                          <td>
                            <span className={`px-2 py-1 text-xs rounded-full ${statusDisplay.color}`}>
                              {statusDisplay.label}
                            </span>
                          </td>
                          <td className="text-gray-400 text-sm">{user.lastLogin}</td>
                          <td>
                            <div className="flex flex-wrap gap-1">
                              {user.permissions.slice(0, 2).map((perm: string, index: number) => (
                                <span key={index} className="px-1 py-0.5 text-xs rounded bg-gray-700 text-gray-300">
                                  {perm}
                                </span>
                              ))}
                              {user.permissions.length > 2 && (
                                <span className="px-1 py-0.5 text-xs rounded bg-gray-700 text-gray-300">
                                  +{user.permissions.length - 2}
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEditUser(user)}
                                className="text-blue-400 hover:text-blue-300"
                                title="编辑"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              {user.username !== 'admin' && (
                                <button
                                  onClick={() => handleDeleteUser(user.id)}
                                  className="text-red-400 hover:text-red-300"
                                  title="删除"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 创建用户模态框 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-white mb-4">添加新用户</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">用户名</label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入用户名"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">邮箱</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入邮箱"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">角色</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                >
                  {roles.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">部门</label>
                <select
                  value={newUser.department}
                  onChange={(e) => setNewUser({...newUser, department: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                >
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCreateUser}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
              >
                创建
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑用户模态框 */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-white mb-4">编辑用户</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">用户名</label>
                <input
                  type="text"
                  value={selectedUser.username}
                  onChange={(e) => setSelectedUser({...selectedUser, username: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">邮箱</label>
                <input
                  type="email"
                  value={selectedUser.email}
                  onChange={(e) => setSelectedUser({...selectedUser, email: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">角色</label>
                <select
                  value={selectedUser.role}
                  onChange={(e) => setSelectedUser({...selectedUser, role: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                >
                  {roles.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">部门</label>
                <select
                  value={selectedUser.department}
                  onChange={(e) => setSelectedUser({...selectedUser, department: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                >
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">状态</label>
                <select
                  value={selectedUser.status}
                  onChange={(e) => setSelectedUser({...selectedUser, status: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                >
                  {statusOptions.map(status => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleUpdateUser}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
              >
                更新
              </button>
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

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