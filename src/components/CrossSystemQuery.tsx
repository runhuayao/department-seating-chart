import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, AlertCircle, CheckCircle, Clock, Database } from 'lucide-react';

interface QueryLog {
  id: string;
  type: string;
  endpoint: string;
  status: string;
  created_at: string;
  data_size?: number;
  response_size?: number;
  error?: string;
}

interface SystemStats {
  total_queries: number;
  successful_queries: number;
  failed_queries: number;
  avg_response_time: number;
  last_sync_time: string;
}

const CrossSystemQuery: React.FC = () => {
  const [queryData, setQueryData] = useState('');
  const [targetSystem, setTargetSystem] = useState('3000');
  const [queryType, setQueryType] = useState('departments');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<QueryLog[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // 获取跨系统活动日志
  const fetchLogs = async () => {
    try {
      const response = await fetch('/api/cross-system/logs');
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (err) {
      console.error('获取日志失败:', err);
    }
  };

  // 获取统计信息
  const fetchStats = async () => {
    try {
      const response = await fetch('/api/cross-system/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('获取统计信息失败:', err);
    }
  };

  // 执行跨系统查询
  const executeQuery = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/cross-system/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetPort: parseInt(targetSystem),
          queryType,
          data: queryData ? JSON.parse(queryData) : undefined
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setResult(data);
      } else {
        setError(data.error || '查询失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络错误');
    } finally {
      setLoading(false);
      // 刷新日志和统计信息
      fetchLogs();
      fetchStats();
    }
  };

  // 发送数据到其他系统
  const sendData = async () => {
    if (!queryData.trim()) {
      setError('请输入要发送的数据');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/cross-system/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetPort: parseInt(targetSystem),
          dataType: queryType,
          data: JSON.parse(queryData)
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setResult(data);
      } else {
        setError(data.error || '发送失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络错误');
    } finally {
      setLoading(false);
      fetchLogs();
      fetchStats();
    }
  };

  // 自动刷新
  useEffect(() => {
    fetchLogs();
    fetchStats();

    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchLogs();
        fetchStats();
      }, 5000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <Database className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Database className="w-5 h-5" />
          跨系统查询与同步
        </h2>

        {/* 统计信息 */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="text-sm text-blue-600">总查询数</div>
              <div className="text-xl font-semibold text-blue-800">{stats.total_queries}</div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="text-sm text-green-600">成功查询</div>
              <div className="text-xl font-semibold text-green-800">{stats.successful_queries}</div>
            </div>
            <div className="bg-red-50 p-3 rounded-lg">
              <div className="text-sm text-red-600">失败查询</div>
              <div className="text-xl font-semibold text-red-800">{stats.failed_queries}</div>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg">
              <div className="text-sm text-purple-600">平均响应时间</div>
              <div className="text-xl font-semibold text-purple-800">{stats.avg_response_time}ms</div>
            </div>
          </div>
        )}

        {/* 查询配置 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              目标系统端口
            </label>
            <select
              value={targetSystem}
              onChange={(e) => setTargetSystem(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="3000">端口 3000</option>
              <option value="5173">端口 5173</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              查询类型
            </label>
            <select
              value={queryType}
              onChange={(e) => setQueryType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="departments">部门信息</option>
              <option value="employees">员工信息</option>
              <option value="workstations">工作站信息</option>
              <option value="stats">统计信息</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">自动刷新</span>
            </label>
          </div>
        </div>

        {/* 查询数据输入 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            查询参数 (JSON格式，可选)
          </label>
          <textarea
            value={queryData}
            onChange={(e) => setQueryData(e.target.value)}
            placeholder='例如: {"id": 1, "status": "active"}'
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
          />
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={executeQuery}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            执行查询
          </button>
          <button
            onClick={sendData}
            disabled={loading || !queryData.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Database className="w-4 h-4" />
            )}
            发送数据
          </button>
          <button
            onClick={() => {
              fetchLogs();
              fetchStats();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
        </div>

        {/* 错误信息 */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          </div>
        )}

        {/* 查询结果 */}
        {result && (
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-2">查询结果</h3>
            <div className="bg-gray-50 p-4 rounded-md">
              <pre className="text-sm overflow-auto max-h-64">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* 活动日志 */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold mb-4">跨系统活动日志</h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {logs.length === 0 ? (
            <div className="text-gray-500 text-center py-4">暂无活动日志</div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                <div className="flex items-center gap-3">
                  {getStatusIcon(log.status)}
                  <div>
                    <div className="font-medium">{log.type}</div>
                    <div className="text-sm text-gray-600">{log.endpoint}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">
                    {new Date(log.created_at).toLocaleString()}
                  </div>
                  {log.data_size && (
                    <div className="text-xs text-gray-400">
                      {log.data_size} bytes
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default CrossSystemQuery;