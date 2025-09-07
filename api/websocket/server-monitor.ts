import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import os from 'os';

interface ServerMetrics {
  cpu: {
    usage: number;
    cores: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
  };
  disk: {
    drives: Array<{
      drive: string;
      total: number;
      free: number;
      used: number;
      usagePercent: number;
    }>;
  };
  network: {
    interfaces: number;
    activeConnections: number;
  };
  processes: {
    total: number;
    running: number;
    totalCpuUsage: number;
    totalMemoryUsage: number;
  };
  timestamp: string;
}

class ServerMonitorWebSocket {
  private io: SocketIOServer;
  private metricsInterval: NodeJS.Timeout | null = null;
  private connectedClients = new Set<string>();

  constructor(server: HttpServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      },
      path: '/socket.io/'
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);
      this.connectedClients.add(socket.id);

      // 发送初始数据
      this.sendMetrics(socket.id);

      // 开始实时监控（如果是第一个客户端）
      if (this.connectedClients.size === 1) {
        this.startMetricsCollection();
      }

      // 处理客户端请求特定数据
      socket.on('request-metrics', () => {
        this.sendMetrics(socket.id);
      });

      // 处理客户端请求系统日志
      socket.on('request-logs', (params) => {
        this.sendSystemLogs(socket.id, params);
      });

      // 处理客户端请求进程信息
      socket.on('request-processes', () => {
        this.sendProcessInfo(socket.id);
      });

      // 处理断开连接
      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
        this.connectedClients.delete(socket.id);

        // 如果没有客户端连接，停止监控
        if (this.connectedClients.size === 0) {
          this.stopMetricsCollection();
        }
      });
    });
  }

  private startMetricsCollection(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    // 每2秒发送一次实时数据
    this.metricsInterval = setInterval(() => {
      this.broadcastMetrics();
    }, 2000);

    console.log('Started real-time metrics collection');
  }

  private stopMetricsCollection(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
      console.log('Stopped real-time metrics collection');
    }
  }

  private async collectMetrics(): Promise<ServerMetrics> {
    // CPU信息
    const cpus = os.cpus();
    const cpuUsage = this.calculateCpuUsage(cpus);
    
    // 内存信息
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryUsagePercent = (usedMem / totalMem) * 100;

    // 磁盘信息（模拟）
    const diskInfo = {
      drives: [
        {
          drive: 'C:',
          total: 500 * 1024 * 1024 * 1024,
          free: Math.random() * 200 * 1024 * 1024 * 1024 + 50 * 1024 * 1024 * 1024,
          used: 0,
          usagePercent: 0
        },
        {
          drive: 'D:',
          total: 1000 * 1024 * 1024 * 1024,
          free: Math.random() * 600 * 1024 * 1024 * 1024 + 200 * 1024 * 1024 * 1024,
          used: 0,
          usagePercent: 0
        }
      ]
    };

    // 计算磁盘使用率
    diskInfo.drives.forEach(drive => {
      drive.used = drive.total - drive.free;
      drive.usagePercent = (drive.used / drive.total) * 100;
    });

    // 网络信息
    const networkInterfaces = os.networkInterfaces();
    const interfaceCount = Object.keys(networkInterfaces).length;

    // 进程信息（模拟）
    const processInfo = {
      total: Math.floor(Math.random() * 50) + 100,
      running: Math.floor(Math.random() * 30) + 80,
      totalCpuUsage: Math.random() * 50 + 10,
      totalMemoryUsage: Math.random() * usedMem * 0.8
    };

    return {
      cpu: {
        usage: cpuUsage,
        cores: cpus.length,
        loadAverage: os.loadavg()
      },
      memory: {
        total: totalMem,
        free: freeMem,
        used: usedMem,
        usagePercent: Math.round(memoryUsagePercent * 100) / 100
      },
      disk: diskInfo,
      network: {
        interfaces: interfaceCount,
        activeConnections: Math.floor(Math.random() * 20) + 5
      },
      processes: processInfo,
      timestamp: new Date().toISOString()
    };
  }

  private calculateCpuUsage(cpus: os.CpuInfo[]): number {
    // 简化的CPU使用率计算（实际项目中需要更复杂的计算）
    const totalUsage = cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((sum, time) => sum + time, 0);
      const idle = cpu.times.idle;
      const usage = ((total - idle) / total) * 100;
      return acc + usage;
    }, 0);

    return Math.round((totalUsage / cpus.length) * 100) / 100;
  }

  private async broadcastMetrics(): void {
    try {
      const metrics = await this.collectMetrics();
      this.io.emit('metrics-update', metrics);
    } catch (error) {
      console.error('Error collecting metrics:', error);
      this.io.emit('metrics-error', {
        error: 'Failed to collect metrics',
        timestamp: new Date().toISOString()
      });
    }
  }

  private async sendMetrics(socketId: string): void {
    try {
      const metrics = await this.collectMetrics();
      this.io.to(socketId).emit('metrics-update', metrics);
    } catch (error) {
      console.error('Error sending metrics:', error);
      this.io.to(socketId).emit('metrics-error', {
        error: 'Failed to send metrics',
        timestamp: new Date().toISOString()
      });
    }
  }

  private sendSystemLogs(socketId: string, params: any = {}): void {
    const { level = 'all', limit = 20 } = params;
    
    // 模拟系统日志
    const logs = [
      {
        id: Date.now() + 1,
        timestamp: new Date(Date.now() - Math.random() * 1000 * 60 * 10).toISOString(),
        level: 'info',
        message: 'System monitoring active',
        source: 'monitor'
      },
      {
        id: Date.now() + 2,
        timestamp: new Date(Date.now() - Math.random() * 1000 * 60 * 5).toISOString(),
        level: 'warn',
        message: `High CPU usage detected: ${Math.floor(Math.random() * 20 + 80)}%`,
        source: 'system'
      },
      {
        id: Date.now() + 3,
        timestamp: new Date(Date.now() - Math.random() * 1000 * 60 * 2).toISOString(),
        level: 'error',
        message: 'Temporary connection timeout',
        source: 'network'
      }
    ];

    let filteredLogs = logs;
    if (level !== 'all') {
      filteredLogs = logs.filter(log => log.level === level);
    }

    const limitedLogs = filteredLogs.slice(0, Number(limit));

    this.io.to(socketId).emit('logs-update', {
      logs: limitedLogs,
      total: filteredLogs.length,
      timestamp: new Date().toISOString()
    });
  }

  private sendProcessInfo(socketId: string): void {
    // 模拟进程信息
    const processes = [
      {
        pid: Math.floor(Math.random() * 9000) + 1000,
        name: 'node.exe',
        cpu: Math.random() * 20 + 5,
        memory: Math.random() * 200 * 1024 * 1024 + 50 * 1024 * 1024,
        status: 'running'
      },
      {
        pid: Math.floor(Math.random() * 9000) + 1000,
        name: 'chrome.exe',
        cpu: Math.random() * 15 + 2,
        memory: Math.random() * 300 * 1024 * 1024 + 100 * 1024 * 1024,
        status: 'running'
      },
      {
        pid: Math.floor(Math.random() * 9000) + 1000,
        name: 'explorer.exe',
        cpu: Math.random() * 5 + 1,
        memory: Math.random() * 100 * 1024 * 1024 + 30 * 1024 * 1024,
        status: 'running'
      }
    ];

    this.io.to(socketId).emit('processes-update', {
      processes,
      total: processes.length,
      totalCpuUsage: processes.reduce((acc, proc) => acc + proc.cpu, 0),
      totalMemoryUsage: processes.reduce((acc, proc) => acc + proc.memory, 0),
      timestamp: new Date().toISOString()
    });
  }

  public getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }

  public close(): void {
    this.stopMetricsCollection();
    this.io.close();
  }
}

export default ServerMonitorWebSocket;