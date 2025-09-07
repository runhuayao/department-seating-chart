import React, { useState, useEffect } from 'react';
import { Play, Square, Settings, RefreshCw, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { rbacService } from '../services/rbacService';

interface ServiceStatus {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'starting' | 'stopping' | 'error';
  port?: number;
  uptime?: string;
  lastRestart?: Date;
  autoStart: boolean;
}

interface ServerConfig {
  maxMemory: number;
  maxCpu: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  backupEnabled: boolean;
  backupInterval: number;
  maintenanceMode: boolean;
}

const ServerControlPanel: React.FC = () => {
  const [services, setServices] = useState<ServiceStatus[]>([
    {
      id: '1',
      name: 'Web服务器',
      status: 'running',
      port: 3000,
      uptime: '2天 14小时 32分钟',
      lastRestart: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      autoStart: true
    },
    {
      id: '2',
      name: 'API服务器',
      status: 'running',
      port: 8080,
      uptime: '2天 14小时 30分钟',
      lastRestart: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      autoStart: true
    },
    {
      id: '3',
      name: '数据库服务',
      status: 'running',
      port: 5432,
      uptime: '7天 2小时 15分钟',
      lastRestart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      autoStart: true
    },
    {
      id: '4',
      name: '缓存服务',
      status: 'stopped',
      port: 6379,
      uptime: undefined,
      lastRestart: new Date(Date.now() - 1 * 60 * 60 * 1000),
      autoStart: false
    }
  ]);

  const [serverConfig, setServerConfig] = useState<ServerConfig>({
    maxMemory: 8192,
    maxCpu: 80,
    logLevel: 'info',
    backupEnabled: true,
    backupInterval: 24,
    maintenanceMode: false
  });

  const [showConfig, setShowConfig] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const canControl = rbacService.hasPermission('server', 'control');
  const canConfig = rbacService.hasPermission('server', 'config');

  const getStatusIcon = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'running':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'stopped':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'starting':
      case 'stopping':
        return <Clock className="w-5 h-5 text-yellow-500 animate-spin" />;
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default:
        return <XCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusText = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'running': return '运行中';
      case 'stopped': return '已停止';
      case 'starting': return '启动中';
      case 'stopping': return '停止中';
      case 'error': return '错误';
      default: return '未知';
    }
  };

  const getStatusColor = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'running': return 'text-green-600 bg-green-50';
      case 'stopped': return 'text-red-600 bg-red-50';
      case 'starting':
      case 'stopping': return 'text-yellow-600 bg-yellow-50';
      case 'error': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const handleServiceAction = async (serviceId: string, action: 'start' | 'stop' | 'restart') => {
    if (!canControl) {
      alert('权限不足：无法控制服务器服务');
      return;
    }

    setIsLoading(true);
    
    // 更新服务状态为过渡状态
    setServices(prev => prev.map(service => 
      service.id === serviceId 
        ? { ...service, status: action === 'stop' ? 'stopping' : 'starting' }
        : service
    ));

    // 模拟异步操作
    setTimeout(() => {
      setServices(prev => prev.map(service => {
        if (service.id === serviceId) {
          const newStatus = action === 'stop' ? 'stopped' : 'running';
          return {
            ...service,
            status: newStatus,
            uptime: newStatus === 'running' ? '刚刚启动' : undefined,
            lastRestart: new Date()
          };
        }
        return service;
      }));
      setIsLoading(false);
    }, 2000);
  };

  const handleConfigSave = () => {
    if (!canConfig) {
      alert('权限不足：无法修改服务器配置');
      return;
    }

    // 模拟保存配置
    alert('配置已保存');
    setShowConfig(false);
  };

  const handleMaintenanceToggle = () => {
    if (!canConfig) {
      alert('权限不足：无法切换维护模式');
      return;
    }

    setServerConfig(prev => ({
      ...prev,
      maintenanceMode: !prev.maintenanceMode
    }));
  };

  return (
    <div className="space-y-6">
      {/* 服务器状态概览 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">服务控制面板</h3>
          <div className="flex space-x-2">
            {canConfig && (
              <button
                onClick={() => setShowConfig(true)}
                className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Settings className="w-4 h-4" />
                <span>配置</span>
              </button>
            )}
            {canConfig && (
              <button
                onClick={handleMaintenanceToggle}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                  serverConfig.maintenanceMode
                    ? 'bg-orange-600 text-white hover:bg-orange-700'
                    : 'bg-gray-600 text-white hover:bg-gray-700'
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
                <span>{serverConfig.maintenanceMode ? '退出维护' : '维护模式'}</span>
              </button>
            )}
          </div>
        </div>

        {serverConfig.maintenanceMode && (
          <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center space-x-2 text-orange-800">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium">系统维护模式已启用</span>
            </div>
            <p className="text-sm text-orange-700 mt-1">系统正在维护中，部分功能可能不可用</p>
          </div>
        )}

        <div className="grid gap-4">
          {services.map((service) => (
            <div key={service.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(service.status)}
                  <div>
                    <h4 className="font-medium text-gray-900">{service.name}</h4>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      {service.port && <span>端口: {service.port}</span>}
                      {service.uptime && <span>运行时间: {service.uptime}</span>}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(service.status)}`}>
                    {getStatusText(service.status)}
                  </span>
                  
                  {canControl && (
                    <div className="flex space-x-1">
                      {service.status === 'stopped' ? (
                        <button
                          onClick={() => handleServiceAction(service.id, 'start')}
                          disabled={isLoading}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                          title="启动服务"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleServiceAction(service.id, 'stop')}
                          disabled={isLoading}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title="停止服务"
                        >
                          <Square className="w-4 h-4" />
                        </button>
                      )}
                      
                      <button
                        onClick={() => handleServiceAction(service.id, 'restart')}
                        disabled={isLoading}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                        title="重启服务"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 配置弹窗 */}
      {showConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">服务器配置</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  最大内存使用 (MB)
                </label>
                <input
                  type="number"
                  value={serverConfig.maxMemory}
                  onChange={(e) => setServerConfig(prev => ({ ...prev, maxMemory: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  最大CPU使用率 (%)
                </label>
                <input
                  type="number"
                  value={serverConfig.maxCpu}
                  onChange={(e) => setServerConfig(prev => ({ ...prev, maxCpu: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  日志级别
                </label>
                <select
                  value={serverConfig.logLevel}
                  onChange={(e) => setServerConfig(prev => ({ ...prev, logLevel: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="debug">调试</option>
                  <option value="info">信息</option>
                  <option value="warn">警告</option>
                  <option value="error">错误</option>
                </select>
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="backupEnabled"
                  checked={serverConfig.backupEnabled}
                  onChange={(e) => setServerConfig(prev => ({ ...prev, backupEnabled: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="backupEnabled" className="text-sm font-medium text-gray-700">
                  启用自动备份
                </label>
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleConfigSave}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
              >
                保存
              </button>
              <button
                onClick={() => setShowConfig(false)}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
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

export default ServerControlPanel;