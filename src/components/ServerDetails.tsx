import React, { useState, useEffect } from 'react';
import { 
  Monitor, 
  Zap, 
  Network, 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  RefreshCw,
  Search,
  Filter,
  Download
} from 'lucide-react';

interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
  status: 'running' | 'sleeping' | 'stopped';
  user: string;
}

interface NetworkConnection {
  id: string;
  protocol: string;
  localAddress: string;
  remoteAddress: string;
  state: string;
  process: string;
}

interface SystemLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'debug';
  source: string;
  message: string;
}

interface ServerDetailsProps {
  className?: string;
}

const ServerDetails: React.FC<ServerDetailsProps> = ({ className = '' }) => {
  const [activeTab, setActiveTab] = useState<'processes' | 'network' | 'logs'>('processes');
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [connections, setConnections] = useState<NetworkConnection[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [logFilter, setLogFilter] = useState<'all' | 'info' | 'warning' | 'error'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 模拟进程数据
  const generateMockProcesses = (): ProcessInfo[] => {
    const processNames = ['node.exe', 'nginx.exe', 'postgres.exe', 'redis-server.exe', 'chrome.exe'];
    return Array.from({ length: 15 }, (_, i) => ({
      pid: 1000 + i,
      name: processNames[i % processNames.length],
      cpu: Math.floor(Math.random() * 50),
      memory: Math.floor(Math.random() * 1024),
      status: ['running', 'sleeping', 'stopped'][Math.floor(Math.random() * 3)] as any,
      user: ['system', 'admin', 'service'][Math.floor(Math.random() * 3)]
    }));
  };

  // 模拟网络连接数据
  const generateMockConnections = (): NetworkConnection[] => {
    const protocols = ['TCP', 'UDP'];
    const states = ['ESTABLISHED', 'LISTENING', 'TIME_WAIT', 'CLOSE_WAIT'];
    return Array.from({ length: 10 }, (_, i) => ({
      id: `conn_${i}`,
      protocol: protocols[Math.floor(Math.random() * protocols.length)],
      localAddress: `192.168.1.100:${3000 + i}`,
      remoteAddress: `192.168.1.${50 + i}:${8000 + i}`,
      state: states[Math.floor(Math.random() * states.length)],
      process: `process_${i}`
    }));
  };

  // 模拟系统日志数据
  const generateMockLogs = (): SystemLog[] => {
    const levels: SystemLog['level'][] = ['info', 'warning', 'error', 'debug'];
    const sources = ['System', 'Application', 'Security', 'Setup'];
    const messages = [
      '服务启动成功',
      '数据库连接建立',
      '用户登录验证',
      '内存使用率过高',
      '网络连接超时',
      '配置文件更新',
      '定时任务执行',
      '缓存清理完成'
    ];

    return Array.from({ length: 50 }, (_, i) => ({
      id: `log_${i}`,
      timestamp: new Date(Date.now() - i * 60000).toISOString(),
      level: levels[Math.floor(Math.random() * levels.length)],
      source: sources[Math.floor(Math.random() * sources.length)],
      message: messages[Math.floor(Math.random() * messages.length)]
    }));
  };

  // 初始化数据
  useEffect(() => {
    setProcesses(generateMockProcesses());
    setConnections(generateMockConnections());
    setLogs(generateMockLogs());
  }, []);

  // 刷新数据
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (activeTab === 'processes') {
      setProcesses(generateMockProcesses());
    } else if (activeTab === 'network') {
      setConnections(generateMockConnections());
    } else if (activeTab === 'logs') {
      setLogs(generateMockLogs());
    }
    
    setIsRefreshing(false);
  };

  // 过滤进程
  const filteredProcesses = processes.filter(process =>
    process.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    process.user.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 过滤网络连接
  const filteredConnections = connections.filter(conn =>
    conn.localAddress.includes(searchTerm) ||
    conn.remoteAddress.includes(searchTerm) ||
    conn.process.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 过滤日志
  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.source.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = logFilter === 'all' || log.level === logFilter;
    return matchesSearch && matchesFilter;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
      case 'ESTABLISHED':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'sleeping':
      case 'LISTENING':
        return <Zap className="w-4 h-4 text-yellow-500" />;
      case 'stopped':
      case 'CLOSE_WAIT':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getLogIcon = (level: SystemLog['level']) => {
    switch (level) {
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'info':
        return <CheckCircle className="w-4 h-4 text-blue-500" />;
      case 'debug':
        return <Monitor className="w-4 h-4 text-gray-500" />;
      default:
        return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  const getLogBgColor = (level: SystemLog['level']) => {
    switch (level) {
      case 'error':
        return 'bg-red-50 border-l-red-500';
      case 'warning':
        return 'bg-yellow-50 border-l-yellow-500';
      case 'info':
        return 'bg-blue-50 border-l-blue-500';
      case 'debug':
        return 'bg-gray-50 border-l-gray-500';
      default:
        return 'bg-white border-l-gray-300';
    }
  };

  return (
    <div className={`p-6 bg-gradient-to-br from-gray-50 to-slate-100 min-h-screen ${className}`}>
      {/* 页面标题 */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">服务器详细信息</h1>
            <p className="text-gray-600">查看进程信息、网络连接状态和系统日志</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>刷新数据</span>
          </button>
        </div>
      </div>

      {/* 搜索和过滤栏 */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="flex items-center space-x-2 flex-1 max-w-md">
            <Search className="w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="搜索进程、连接或日志..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          {activeTab === 'logs' && (
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">所有日志</option>
                <option value="error">错误</option>
                <option value="warning">警告</option>
                <option value="info">信息</option>
                <option value="debug">调试</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 标签页导航 */}
      <div className="bg-white rounded-xl shadow-lg mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('processes')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'processes'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Monitor className="w-4 h-4" />
                <span>进程信息</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('network')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'network'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Network className="w-4 h-4" />
                <span>网络连接</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'logs'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4" />
                <span>系统日志</span>
              </div>
            </button>
          </nav>
        </div>

        {/* 标签页内容 */}
        <div className="p-6">
          {/* 进程信息标签页 */}
          {activeTab === 'processes' && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">进程名</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CPU %</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">内存 (MB)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">用户</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredProcesses.map((process) => (
                    <tr key={process.pid} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{process.pid}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{process.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{process.cpu}%</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{process.memory}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(process.status)}
                          <span className="text-sm text-gray-900">{process.status}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{process.user}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 网络连接标签页 */}
          {activeTab === 'network' && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">协议</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">本地地址</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">远程地址</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">进程</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredConnections.map((conn) => (
                    <tr key={conn.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{conn.protocol}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{conn.localAddress}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{conn.remoteAddress}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(conn.state)}
                          <span className="text-sm text-gray-900">{conn.state}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{conn.process}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 系统日志标签页 */}
          {activeTab === 'logs' && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredLogs.map((log) => (
                <div key={log.id} className={`border-l-4 p-4 rounded-r-lg ${getLogBgColor(log.level)}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      {getLogIcon(log.level)}
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-sm font-medium text-gray-900">{log.source}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{log.message}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      log.level === 'error' ? 'bg-red-100 text-red-800' :
                      log.level === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                      log.level === 'info' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {log.level.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 导出功能 */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">数据导出</h3>
            <p className="text-gray-600">导出当前显示的数据用于分析或备份</p>
          </div>
          <button className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
            <Download className="w-4 h-4" />
            <span>导出数据</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServerDetails;