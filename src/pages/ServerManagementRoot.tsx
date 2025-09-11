import React, { useState, useEffect } from 'react';
import { Monitor, Server, Settings, Activity, Users, Shield, BarChart3, Terminal, Database, MapPin, Bell, Search, Menu, X } from 'lucide-react';

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

  // 模拟实时数据更新
  useEffect(() => {
    const interval = setInterval(() => {
      setServerStatus(prev => ({
        ...prev,
        cpu: Math.max(10, Math.min(90, prev.cpu + (Math.random() - 0.5) * 10)),
        memory: Math.max(20, Math.min(95, prev.memory + (Math.random() - 0.5) * 8)),
        network: Math.max(5, Math.min(100, prev.network + (Math.random() - 0.5) * 15))
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

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