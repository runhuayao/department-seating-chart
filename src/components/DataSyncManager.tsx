import React, { useState, useEffect, useRef } from 'react';
import { 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Database,
  Clock,
  Users,
  Monitor,
  Building,
  Wifi,
  WifiOff
} from 'lucide-react';
import { dataSyncService } from '../services/dataSync';
import { toast } from 'sonner';
import { io, Socket } from 'socket.io-client';

interface SyncStatus {
  database: {
    connected: boolean;
    lastSync: string;
    latency: number;
  };
  lastSync: string;
  recentChanges: number;
  isHealthy: boolean;
}

interface ConsistencyReport {
  workstations: {
    total: number;
    online: number;
    offline: number;
    maintenance: number;
    orphaned: number;
    consistent: boolean;
  };
  employees: {
    total: number;
    active: number;
    inactive: number;
    orphaned: number;
    consistent: boolean;
  };
  departments: {
    total: number;
    withEmployees: number;
    consistent: boolean;
  };
  overall: {
    consistent: boolean;
    issues: number;
  };
}

interface AuditLog {
  id: number;
  user_id: number;
  action: string;
  table_name: string;
  record_id: number | null;
  old_values: any;
  new_values: any;
  ip_address: string;
  created_at: string;
}

const DataSyncManager: React.FC = () => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [consistencyReport, setConsistencyReport] = useState<ConsistencyReport | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'status' | 'consistency' | 'logs' | 'events'>('status');
  const [wsConnected, setWsConnected] = useState(false);
  const [realTimeEvents, setRealTimeEvents] = useState<any[]>([]);
  const socketRef = useRef<Socket | null>(null);

  // 加载同步状态
  const loadSyncStatus = async () => {
    try {
      setLoading(true);
      const status = await dataSyncService.getSyncStatus();
      setSyncStatus(status);
      setError(null);
    } catch (err) {
      setError('获取同步状态失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 检查数据一致性
  const checkConsistency = async () => {
    try {
      setLoading(true);
      const report = await dataSyncService.checkConsistency();
      setConsistencyReport(report);
      setError(null);
      toast.success('数据一致性检查完成');
    } catch (err) {
      setError('数据一致性检查失败');
      toast.error('数据一致性检查失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 修复数据
  const repairData = async (type: string) => {
    try {
      setLoading(true);
      const result = await dataSyncService.repairData(type);
      toast.success(`数据修复完成: ${result.message}`);
      // 重新检查一致性
      await checkConsistency();
    } catch (err) {
      toast.error('数据修复失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 强制同步
  const forceSync = async () => {
    try {
      setLoading(true);
      const result = await dataSyncService.forceSync();
      toast.success('强制同步完成');
      await loadSyncStatus();
    } catch (err) {
      toast.error('强制同步失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 加载审计日志
  const loadAuditLogs = async () => {
    try {
      setLoading(true);
      const logs = await dataSyncService.getAuditLogs({ limit: 20 });
      setAuditLogs(logs);
      setError(null);
    } catch (err) {
      setError('获取审计日志失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 初始化WebSocket连接
  const initWebSocket = () => {
    console.log('🔌 初始化WebSocket连接到数据同步服务...');
    const socket = io('http://localhost:8080', {
      path: '/data-sync/',
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('✅ WebSocket连接成功');
      setWsConnected(true);
      toast.success('实时同步已连接');
    });

    socket.on('disconnect', () => {
      console.log('❌ WebSocket连接断开');
      setWsConnected(false);
      toast.warning('实时同步已断开');
    });

    socket.on('connect_error', (error: any) => {
      console.error('❌ WebSocket连接错误:', error);
      setWsConnected(false);
    });

    socket.on('data-change', (event: any) => {
      console.log('📡 收到数据变更事件:', event);
      setRealTimeEvents(prev => [event, ...prev.slice(0, 9)]); // 保留最近10条事件
      
      // 根据事件类型显示通知
      if (event.type === 'data_repair') {
        toast.info(`数据修复完成: ${event.data.repairType}`);
      } else if (event.type === 'force_sync') {
        toast.info('数据强制同步完成');
      }
      
      // 自动刷新相关数据
      if (activeTab === 'status') {
        loadSyncStatus();
      } else if (activeTab === 'consistency') {
        checkConsistency();
      } else if (activeTab === 'logs') {
        loadAuditLogs();
      }
    });

    socket.on('sync-status', (status: any) => {
      console.log('📊 收到同步状态更新:', status);
      setSyncStatus(status);
    });

    socketRef.current = socket;
  };

  useEffect(() => {
    loadSyncStatus();
    loadAuditLogs();
    initWebSocket();
    
    return () => {
      if (socketRef.current) {
        console.log('🔌 断开WebSocket连接');
        socketRef.current.disconnect();
      }
    };
  }, []);

  const getStatusIcon = (isHealthy: boolean) => {
    return isHealthy ? (
      <CheckCircle className="h-5 w-5 text-green-500" />
    ) : (
      <XCircle className="h-5 w-5 text-red-500" />
    );
  };

  const getStatusBadge = (consistent: boolean) => {
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        consistent ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      }`}>
        {consistent ? '正常' : '异常'}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN');
  };

  return (
    <div className="space-y-6">
      {/* 标题和操作按钮 */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-bold">数据同步管理</h2>
          <div className="flex items-center space-x-2">
            {wsConnected ? (
              <div className="flex items-center text-green-600">
                <Wifi className="h-4 w-4 mr-1" />
                <span className="text-sm">实时同步</span>
              </div>
            ) : (
              <div className="flex items-center text-red-600">
                <WifiOff className="h-4 w-4 mr-1" />
                <span className="text-sm">连接断开</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex space-x-4 mb-6">
          <button 
            onClick={loadSyncStatus} 
            disabled={loading}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新状态
          </button>
          <button 
            onClick={checkConsistency} 
            disabled={loading}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            检查一致性
          </button>
          <button 
            onClick={forceSync} 
            disabled={loading}
            className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Database className="h-4 w-4 mr-2" />
            强制同步
          </button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <AlertTriangle className="h-4 w-4 text-red-600 mr-2" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* 标签页导航 */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        {[
          { key: 'status', label: '同步状态', icon: Database },
          { key: 'consistency', label: '数据一致性', icon: CheckCircle },
          { key: 'logs', label: '审计日志', icon: Clock },
          { key: 'events', label: '实时事件', icon: Wifi }
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as any)}
            className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === key
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Icon className="h-4 w-4 mr-2" />
            {label}
          </button>
        ))}
      </div>

      {/* 同步状态页面 */}
      {activeTab === 'status' && syncStatus && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 className="text-sm font-medium flex items-center">
                <Database className="h-4 w-4 mr-2" />
                数据库连接
              </h3>
              {getStatusBadge(syncStatus.database.connected)}
            </div>
            <div className="mt-4">
              <div className="text-2xl font-bold">
                {syncStatus.database.connected ? '已连接' : '未连接'}
              </div>
              <p className="text-xs text-gray-500">
                延迟: {syncStatus.database.latency}ms
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 className="text-sm font-medium flex items-center">
                <Clock className="h-4 w-4 mr-2" />
                同步状态
              </h3>
              {getStatusBadge(syncStatus.isHealthy)}
            </div>
            <div className="mt-4">
              <div className="text-2xl font-bold">
                {syncStatus.isHealthy ? '正常' : '异常'}
              </div>
              <p className="text-xs text-gray-500">
                最后同步: {formatDate(syncStatus.lastSync)}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 className="text-sm font-medium flex items-center">
                <Monitor className="h-4 w-4 mr-2" />
                近期变更
              </h3>
              {getStatusIcon(syncStatus.recentChanges > 0)}
            </div>
            <div className="mt-4">
              <div className="text-2xl font-bold">
                {syncStatus.recentChanges}
              </div>
              <p className="text-xs text-gray-500">
                自动同步已启用
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 数据一致性页面 */}
      {activeTab === 'consistency' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">数据一致性检查</h3>
            <button 
              onClick={checkConsistency} 
              disabled={loading}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              检查一致性
            </button>
          </div>

          {consistencyReport && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* 工作站数据 */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <h3 className="text-sm font-medium flex items-center">
                    <Monitor className="h-4 w-4 mr-2" />
                    工作站数据
                  </h3>
                  {getStatusBadge(consistencyReport.workstations.consistent)}
                </div>
                <div className="mt-4 space-y-2">
                  <div className="text-sm">
                    <div className="flex justify-between">
                      <span>总数:</span>
                      <span>{consistencyReport.workstations.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>在线:</span>
                      <span className="text-green-600">{consistencyReport.workstations.online}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>离线:</span>
                      <span className="text-gray-600">{consistencyReport.workstations.offline}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>维护:</span>
                      <span className="text-yellow-600">{consistencyReport.workstations.maintenance}</span>
                    </div>
                    {consistencyReport.workstations.orphaned > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>孤立数据:</span>
                        <span>{consistencyReport.workstations.orphaned}</span>
                      </div>
                    )}
                  </div>
                  {!consistencyReport.workstations.consistent && (
                    <button 
                      className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50" 
                      onClick={() => repairData('orphaned-workstations')}
                      disabled={loading}
                    >
                      修复数据
                    </button>
                  )}
                </div>
              </div>

              {/* 员工数据 */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <h3 className="text-sm font-medium flex items-center">
                    <Users className="h-4 w-4 mr-2" />
                    员工数据
                  </h3>
                  {getStatusBadge(consistencyReport.employees.consistent)}
                </div>
                <div className="mt-4 space-y-2">
                  <div className="text-sm">
                    <div className="flex justify-between">
                      <span>总数:</span>
                      <span>{consistencyReport.employees.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>活跃:</span>
                      <span className="text-green-600">{consistencyReport.employees.active}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>非活跃:</span>
                      <span className="text-gray-600">{consistencyReport.employees.inactive}</span>
                    </div>
                    {consistencyReport.employees.orphaned > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>孤立数据:</span>
                        <span>{consistencyReport.employees.orphaned}</span>
                      </div>
                    )}
                  </div>
                  {!consistencyReport.employees.consistent && (
                    <button 
                      className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50" 
                      onClick={() => repairData('orphaned-employees')}
                      disabled={loading}
                    >
                      修复数据
                    </button>
                  )}
                </div>
              </div>

              {/* 部门数据 */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <h3 className="text-sm font-medium flex items-center">
                    <Building className="h-4 w-4 mr-2" />
                    部门数据
                  </h3>
                  {getStatusBadge(consistencyReport.departments.consistent)}
                </div>
                <div className="mt-4 space-y-2">
                  <div className="text-sm">
                    <div className="flex justify-between">
                      <span>总数:</span>
                      <span>{consistencyReport.departments.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>有员工:</span>
                      <span className="text-green-600">{consistencyReport.departments.withEmployees}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 整体状态 */}
          {consistencyReport && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">整体数据一致性</h3>
                {getStatusBadge(consistencyReport.overall.consistent)}
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500">
                    发现 {consistencyReport.overall.issues} 个数据一致性问题
                  </p>
                </div>
                {!consistencyReport.overall.consistent && (
                  <button 
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50" 
                    onClick={() => repairData('full-repair')}
                    disabled={loading}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    修复所有问题
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 审计日志页面 */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">审计日志</h3>
            <button 
              onClick={loadAuditLogs} 
              disabled={loading}
              className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              刷新日志
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        时间
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        操作
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        表名
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        用户ID
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        IP地址
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(log.created_at)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            log.action === 'create' ? 'bg-blue-100 text-blue-800' : 
                            log.action === 'update' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {log.table_name}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {log.user_id}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                          {log.ip_address}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {auditLogs.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  暂无审计日志
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 实时事件页面 */}
      {activeTab === 'events' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">实时事件</h3>
            <button 
              onClick={() => setRealTimeEvents([])} 
              className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              清空事件
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        时间
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        事件类型
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        表名
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        操作
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        详情
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {realTimeEvents.map((event, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(event.timestamp).toLocaleString()}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            event.type === 'data-change' ? 'bg-blue-100 text-blue-800' : 
                            event.type === 'sync-status' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {event.type === 'data-change' ? '数据变更' : 
                             event.type === 'sync-status' ? '同步状态' : event.type}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {event.data?.table || '-'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {event.data?.operation || event.data?.action || '-'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                          {event.data?.message || JSON.stringify(event.data || {})}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {realTimeEvents.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  {wsConnected ? '暂无实时事件' : 'WebSocket未连接，无法接收实时事件'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataSyncManager;