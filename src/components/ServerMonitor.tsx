import React, { useState, useEffect } from 'react';
import { Activity, Cpu, HardDrive, Wifi, Server, AlertTriangle, TrendingUp, BarChart3 } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ServerMetrics {
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  timestamp: string;
}

interface ServerMonitorProps {
  className?: string;
}

const ServerMonitor: React.FC<ServerMonitorProps> = ({ className = '' }) => {
  const [metrics, setMetrics] = useState<ServerMetrics[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState<ServerMetrics>({
    cpu: 0,
    memory: 0,
    disk: 0,
    network: 0,
    timestamp: new Date().toISOString()
  });
  const [isConnected, setIsConnected] = useState(false);
  const [chartType, setChartType] = useState<'line' | 'bar' | 'doughnut'>('line');
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('1h');
  
  const [historicalData, setHistoricalData] = useState<{
    cpu: number[];
    memory: number[];
    disk: number[];
    network: number[];
    timestamps: string[];
  }>({
    cpu: [],
    memory: [],
    disk: [],
    network: [],
    timestamps: []
  });

  // 生成历史数据
  const generateHistoricalData = (range: string) => {
    const dataPoints = range === '1h' ? 60 : range === '6h' ? 72 : range === '24h' ? 96 : 168;
    const interval = range === '1h' ? 1 : range === '6h' ? 5 : range === '24h' ? 15 : 60; // 分钟
    
    const now = new Date();
    const timestamps: string[] = [];
    const cpu: number[] = [];
    const memory: number[] = [];
    const disk: number[] = [];
    const network: number[] = [];
    
    for (let i = dataPoints - 1; i >= 0; i--) {
      const time = new Date(now.getTime() - i * interval * 60 * 1000);
      timestamps.push(range === '7d' ? time.toLocaleDateString() : time.toLocaleTimeString());
      
      // 生成带趋势的模拟数据
      const baseCpu = 40 + Math.sin(i * 0.1) * 20;
      const baseMemory = 60 + Math.cos(i * 0.08) * 25;
      const baseDisk = 30 + Math.sin(i * 0.05) * 10;
      const baseNetwork = 20 + Math.random() * 30;
      
      cpu.push(Math.max(0, Math.min(100, baseCpu + (Math.random() - 0.5) * 10)));
      memory.push(Math.max(0, Math.min(100, baseMemory + (Math.random() - 0.5) * 15)));
      disk.push(Math.max(0, Math.min(100, baseDisk + (Math.random() - 0.5) * 5)));
      network.push(Math.max(0, Math.min(100, baseNetwork + (Math.random() - 0.5) * 20)));
    }
    
    return { cpu, memory, disk, network, timestamps };
  };

  useEffect(() => {
    // 初始化历史数据
    const data = generateHistoricalData(timeRange);
    setHistoricalData(data);
    
    // 设置当前指标为最新数据
    setCurrentMetrics({
      cpu: Math.round(data.cpu[data.cpu.length - 1]),
      memory: Math.round(data.memory[data.memory.length - 1]),
      disk: Math.round(data.disk[data.disk.length - 1]),
      network: Math.round(data.network[data.network.length - 1]),
      timestamp: new Date().toISOString()
    });
  }, [timeRange]);

  // 模拟实时数据获取
  useEffect(() => {
    const generateMockData = (): ServerMetrics => {
      return {
        cpu: Math.floor(Math.random() * 100),
        memory: Math.floor(Math.random() * 100),
        disk: Math.floor(Math.random() * 100),
        network: Math.floor(Math.random() * 100),
        timestamp: new Date().toISOString()
      };
    };

    const interval = setInterval(() => {
      const newMetric = generateMockData();
      setCurrentMetrics(newMetric);
      setMetrics(prev => {
        const updated = [...prev, newMetric];
        // 保持最近20个数据点
        return updated.slice(-20);
      });
      setIsConnected(true);
      
      // 更新历史数据
      setHistoricalData(prev => {
        const now = new Date();
        const timeLabel = timeRange === '7d' ? now.toLocaleDateString() : now.toLocaleTimeString();
        
        const newTimestamps = [...prev.timestamps.slice(1), timeLabel];
        const newCpu = [...prev.cpu.slice(1), newMetric.cpu];
        const newMemory = [...prev.memory.slice(1), newMetric.memory];
        const newDisk = [...prev.disk.slice(1), newMetric.disk];
        const newNetwork = [...prev.network.slice(1), newMetric.network];
        
        return {
          timestamps: newTimestamps,
          cpu: newCpu,
          memory: newMemory,
          disk: newDisk,
          network: newNetwork
        };
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [timeRange]);

  // 性能趋势图表配置
  const trendChartData = {
    labels: metrics.map(m => new Date(m.timestamp).toLocaleTimeString()),
    datasets: [
      {
        label: 'CPU使用率',
        data: metrics.map(m => m.cpu),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
      },
      {
        label: '内存使用率',
        data: metrics.map(m => m.memory),
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
      },
    ],
  };

  const trendChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: '性能趋势监控',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
      },
    },
  };

  // CPU使用率环形图配置
  const cpuChartData = {
    labels: ['已使用', '空闲'],
    datasets: [
      {
        data: [currentMetrics.cpu, 100 - currentMetrics.cpu],
        backgroundColor: [
          currentMetrics.cpu > 80 ? '#ef4444' : currentMetrics.cpu > 60 ? '#f59e0b' : '#10b981',
          '#e5e7eb'
        ],
        borderWidth: 0,
      },
    ],
  };

  // 内存使用率环形图配置
  const memoryChartData = {
    labels: ['已使用', '空闲'],
    datasets: [
      {
        data: [currentMetrics.memory, 100 - currentMetrics.memory],
        backgroundColor: [
          currentMetrics.memory > 80 ? '#ef4444' : currentMetrics.memory > 60 ? '#f59e0b' : '#3b82f6',
          '#e5e7eb'
        ],
        borderWidth: 0,
      },
    ],
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
  };

  const getStatusColor = (value: number) => {
    if (value > 80) return 'text-red-500';
    if (value > 60) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getStatusBg = (value: number) => {
    if (value > 80) return 'bg-red-50 border-red-200';
    if (value > 60) return 'bg-yellow-50 border-yellow-200';
    return 'bg-green-50 border-green-200';
  };

  return (
    <div className={`p-6 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen ${className}`}>
      {/* 页面标题 */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">M1服务器监控中心</h1>
            <p className="text-gray-600">实时监控服务器性能指标和运行状态</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className={`text-sm font-medium ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                {isConnected ? '已连接' : '连接中...'}
              </span>
            </div>
            
            {/* 时间范围选择 */}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="1h">1小时</option>
              <option value="6h">6小时</option>
              <option value="24h">24小时</option>
              <option value="7d">7天</option>
            </select>
            
            {/* 图表类型选择 */}
            <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setChartType('line')}
                className={`p-2 rounded-md transition-colors ${
                  chartType === 'line' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-900'
                }`}
                title="折线图"
              >
                <TrendingUp className="w-4 h-4" />
              </button>
              <button
                onClick={() => setChartType('bar')}
                className={`p-2 rounded-md transition-colors ${
                  chartType === 'bar' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-900'
                }`}
                title="柱状图"
              >
                <BarChart3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setChartType('doughnut')}
                className={`p-2 rounded-md transition-colors ${
                  chartType === 'doughnut' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-900'
                }`}
                title="环形图"
              >
                <Activity className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 关键指标卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* CPU使用率 */}
        <div className={`bg-white rounded-xl shadow-lg border-2 p-6 ${getStatusBg(currentMetrics.cpu)}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Cpu className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-600">CPU使用率</h3>
                <p className={`text-2xl font-bold ${getStatusColor(currentMetrics.cpu)}`}>
                  {currentMetrics.cpu}%
                </p>
              </div>
            </div>
            <div className="w-16 h-16">
              <Doughnut data={cpuChartData} options={doughnutOptions} />
            </div>
          </div>
        </div>

        {/* 内存使用率 */}
        <div className={`bg-white rounded-xl shadow-lg border-2 p-6 ${getStatusBg(currentMetrics.memory)}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Activity className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-600">内存使用率</h3>
                <p className={`text-2xl font-bold ${getStatusColor(currentMetrics.memory)}`}>
                  {currentMetrics.memory}%
                </p>
              </div>
            </div>
            <div className="w-16 h-16">
              <Doughnut data={memoryChartData} options={doughnutOptions} />
            </div>
          </div>
        </div>

        {/* 磁盘使用率 */}
        <div className={`bg-white rounded-xl shadow-lg border-2 p-6 ${getStatusBg(currentMetrics.disk)}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <HardDrive className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-600">磁盘使用率</h3>
                <p className={`text-2xl font-bold ${getStatusColor(currentMetrics.disk)}`}>
                  {currentMetrics.disk}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 网络流量 */}
        <div className={`bg-white rounded-xl shadow-lg border-2 p-6 ${getStatusBg(currentMetrics.network)}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Wifi className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-600">网络流量</h3>
                <p className={`text-2xl font-bold ${getStatusColor(currentMetrics.network)}`}>
                  {currentMetrics.network}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 性能趋势图表 */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Server className="w-6 h-6 text-indigo-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">实时性能趋势</h2>
          </div>
          <div className="text-sm text-gray-500">
            {chartType === 'line' && '折线图'}
            {chartType === 'bar' && '柱状图'}
            {chartType === 'doughnut' && '当前状态分布'}
          </div>
        </div>
        <div className={chartType === 'doughnut' ? 'h-80 flex justify-center' : 'h-80'}>
          {chartType === 'line' && (
            <Line
              data={{
                labels: historicalData.timestamps,
                datasets: [
                  {
                    label: 'CPU使用率',
                    data: historicalData.cpu,
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.4
                  },
                  {
                    label: '内存使用率',
                    data: historicalData.memory,
                    borderColor: 'rgb(16, 185, 129)',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.4
                  }
                ]
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'top' as const,
                  },
                  title: {
                    display: false,
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                      callback: function(value) {
                        return value + '%';
                      }
                    }
                  },
                  x: {
                    ticks: {
                      maxTicksLimit: 10
                    }
                  }
                },
                elements: {
                  point: {
                    radius: 2,
                    hoverRadius: 5
                  }
                },
                interaction: {
                  intersect: false,
                  mode: 'index'
                }
              }}
            />
          )}
          
          {chartType === 'bar' && (
            <Bar
              data={{
                labels: historicalData.timestamps,
                datasets: [
                  {
                    label: 'CPU使用率',
                    data: historicalData.cpu,
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.8)',
                    tension: 0.4
                  },
                  {
                    label: '内存使用率',
                    data: historicalData.memory,
                    borderColor: 'rgb(16, 185, 129)',
                    backgroundColor: 'rgba(16, 185, 129, 0.8)',
                    tension: 0.4
                  }
                ]
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'top' as const,
                  },
                  title: {
                    display: false,
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                      callback: function(value) {
                        return value + '%';
                      }
                    }
                  },
                  x: {
                    ticks: {
                      maxTicksLimit: 10
                    }
                  }
                },
                interaction: {
                  intersect: false,
                  mode: 'index'
                }
              }}
            />
          )}
          
          {chartType === 'doughnut' && (
            <div className="w-80">
              <Doughnut
                data={{
                  labels: ['CPU', '内存', '磁盘', '网络'],
                  datasets: [{
                    data: [currentMetrics.cpu, currentMetrics.memory, currentMetrics.disk, currentMetrics.network],
                    backgroundColor: [
                      'rgba(59, 130, 246, 0.8)',
                      'rgba(16, 185, 129, 0.8)',
                      'rgba(245, 158, 11, 0.8)',
                      'rgba(239, 68, 68, 0.8)'
                    ],
                    borderColor: [
                      'rgb(59, 130, 246)',
                      'rgb(16, 185, 129)',
                      'rgb(245, 158, 11)',
                      'rgb(239, 68, 68)'
                    ],
                    borderWidth: 2
                  }]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom' as const,
                    },
                    tooltip: {
                      callbacks: {
                        label: function(context) {
                          return context.label + ': ' + context.parsed + '%';
                        }
                      }
                    }
                  },
                  cutout: '60%'
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* 服务器状态概览 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">系统信息</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">操作系统</span>
              <span className="font-medium">Windows Server 2022</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">运行时间</span>
              <span className="font-medium">15天 8小时 32分钟</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">处理器</span>
              <span className="font-medium">Intel Xeon E5-2686 v4</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">总内存</span>
              <span className="font-medium">32 GB</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">服务状态</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Web服务</span>
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">运行中</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">数据库服务</span>
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">运行中</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">API服务</span>
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">运行中</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">监控服务</span>
              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">警告</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServerMonitor;