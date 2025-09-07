import React, { useState, useEffect } from 'react';
import { Monitor, Server, Settings, Activity, Users, Shield, BarChart3, Terminal } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState('monitor');
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');

  // 模拟连接状态
  useEffect(() => {
    const timer = setTimeout(() => {
      setConnectionStatus('connected');
      setIsConnected(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  const navigationItems: NavigationItem[] = [
    {
      id: 'monitor',
      label: '实时监控',
      icon: <Monitor className="w-5 h-5" />,
      component: <ServerMonitor />
    },
    {
      id: 'details',
      label: '服务器详情',
      icon: <Server className="w-5 h-5" />,
      component: <ServerDetails />
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
              
              {/* 用户信息 */}
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-700 rounded-lg">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-sm font-semibold text-white">管</span>
                </div>
                <span className="text-sm font-medium">管理员</span>
              </div>
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
    processes: '管理和监控系统进程状态',
    logs: '查看系统日志和错误报告',
    users: '管理用户账户和权限设置',
    security: '配置安全策略和访问控制',
    analytics: '分析服务器性能趋势和优化建议',
    settings: '配置系统参数和服务设置'
  };
  return descriptions[tabId] || '';
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