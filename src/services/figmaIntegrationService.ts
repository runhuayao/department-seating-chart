// Figma集成服务
// 处理Figma编辑界面跳转和实时同步功能

interface FigmaProject {
  id: string;
  name: string;
  url: string;
  teamId: string;
  lastModified: string;
}

interface FigmaEditSession {
  projectId: string;
  department: string;
  userId: string;
  startTime: string;
  isActive: boolean;
}

interface WorkstationSyncData {
  id: string;
  name: string;
  department: string;
  position: { x: number; y: number };
  dimensions: { width: number; height: number };
  type: string;
  color: string;
  assignedUser?: string;
  status: 'available' | 'occupied' | 'maintenance' | 'reserved';
  figmaNodeId?: string;
  lastModified: string;
}

class FigmaIntegrationService {
  private static instance: FigmaIntegrationService;
  private activeSessions: Map<string, FigmaEditSession> = new Map();
  private syncInterval: NodeJS.Timeout | null = null;

  // Figma项目配置
  private readonly FIGMA_CONFIG = {
    teamId: '1543117153416854380',
    projectTemplate: 'rfmihgScThZhZjvJUzsCiw',
    baseUrl: 'https://www.figma.com',
    apiUrl: 'https://api.figma.com/v1'
  };

  private constructor() {
    this.initializeSyncService();
  }

  public static getInstance(): FigmaIntegrationService {
    if (!FigmaIntegrationService.instance) {
      FigmaIntegrationService.instance = new FigmaIntegrationService();
    }
    return FigmaIntegrationService.instance;
  }

  // 初始化同步服务
  private initializeSyncService() {
    // 每30秒检查一次Figma更新
    this.syncInterval = setInterval(() => {
      this.checkFigmaUpdates();
    }, 30000);
  }

  // 跳转到Figma编辑界面
  public async redirectToFigmaEditor(department: string, userId: string): Promise<string> {
    try {
      console.log(`🎨 准备跳转到Figma编辑界面 - 部门: ${department}, 用户: ${userId}`);

      // 1. 检查或创建部门专用的Figma项目
      const projectId = await this.ensureDepartmentProject(department);
      
      // 2. 生成编辑会话
      const sessionId = this.createEditSession(projectId, department, userId);
      
      // 3. 构建Figma编辑URL
      const figmaUrl = this.buildFigmaEditUrl(projectId, department);
      
      // 4. 记录编辑会话
      this.activeSessions.set(sessionId, {
        projectId,
        department,
        userId,
        startTime: new Date().toISOString(),
        isActive: true
      });

      // 5. 打开Figma编辑界面
      console.log(`🚀 跳转到Figma编辑界面: ${figmaUrl}`);
      window.open(figmaUrl, '_blank', 'width=1400,height=900,scrollbars=yes,resizable=yes');

      // 6. 返回会话ID用于后续同步
      return sessionId;
    } catch (error) {
      console.error('跳转到Figma编辑界面失败:', error);
      throw new Error(`无法跳转到Figma编辑界面: ${error.message}`);
    }
  }

  // 确保部门有对应的Figma项目
  private async ensureDepartmentProject(department: string): Promise<string> {
    try {
      // 检查是否已存在部门项目
      const existingProject = await this.findDepartmentProject(department);
      if (existingProject) {
        return existingProject.id;
      }

      // 基于模板创建新项目
      const newProject = await this.createProjectFromTemplate(department);
      return newProject.id;
    } catch (error) {
      console.error('确保部门项目失败:', error);
      // 使用默认模板项目
      return this.FIGMA_CONFIG.projectTemplate;
    }
  }

  // 查找部门对应的Figma项目
  private async findDepartmentProject(department: string): Promise<FigmaProject | null> {
    try {
      // 这里应该调用Figma API查找项目
      // 由于需要API token，暂时返回null使用模板
      return null;
    } catch (error) {
      console.error('查找部门项目失败:', error);
      return null;
    }
  }

  // 基于模板创建新项目
  private async createProjectFromTemplate(department: string): Promise<FigmaProject> {
    // 由于需要Figma API权限，暂时返回模板项目信息
    return {
      id: this.FIGMA_CONFIG.projectTemplate,
      name: `${department} 座位图`,
      url: `${this.FIGMA_CONFIG.baseUrl}/board/${this.FIGMA_CONFIG.projectTemplate}`,
      teamId: this.FIGMA_CONFIG.teamId,
      lastModified: new Date().toISOString()
    };
  }

  // 构建Figma编辑URL
  private buildFigmaEditUrl(projectId: string, department: string): string {
    const baseUrl = `${this.FIGMA_CONFIG.baseUrl}/board/${projectId}`;
    const params = new URLSearchParams({
      'node-id': '0-1',
      't': 'ML5JFZizCaxHTZLp-0',
      'department': department,
      'mode': 'edit'
    });
    
    return `${baseUrl}?${params.toString()}`;
  }

  // 创建编辑会话
  private createEditSession(projectId: string, department: string, userId: string): string {
    return `session-${department}-${userId}-${Date.now()}`;
  }

  // 检查Figma更新
  private async checkFigmaUpdates() {
    for (const [sessionId, session] of this.activeSessions) {
      if (session.isActive) {
        try {
          await this.syncFigmaChanges(session);
        } catch (error) {
          console.error(`同步Figma更改失败 - 会话: ${sessionId}`, error);
        }
      }
    }
  }

  // 同步Figma更改到前端
  public async syncFigmaChanges(session: FigmaEditSession): Promise<void> {
    try {
      console.log(`🔄 同步Figma更改 - 部门: ${session.department}`);

      // 1. 获取Figma项目最新数据
      const figmaData = await this.getFigmaProjectData(session.projectId);
      
      // 2. 解析座位图数据
      const workstationData = this.parseFigmaSeatingData(figmaData);
      
      // 3. 同步到后端API
      await this.syncWorkstationData(session.department, workstationData);
      
      // 4. 触发前端更新
      this.notifyFrontendUpdate(session.department, workstationData);

      console.log(`✅ Figma同步完成 - 部门: ${session.department}`);
    } catch (error) {
      console.error('同步Figma更改失败:', error);
      throw error;
    }
  }

  // 获取Figma项目数据
  private async getFigmaProjectData(projectId: string): Promise<any> {
    try {
      // 使用MCP Figma Bridge获取数据
      const response = await fetch('/api/figma/project-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fileKey: projectId,
          includeComponents: true
        })
      });

      if (!response.ok) {
        throw new Error(`Figma API响应错误: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('获取Figma项目数据失败:', error);
      throw error;
    }
  }

  // 解析Figma座位图数据
  private parseFigmaSeatingData(figmaData: any): WorkstationSyncData[] {
    const workstations: WorkstationSyncData[] = [];

    try {
      // 解析Figma节点数据
      if (figmaData.nodes && Array.isArray(figmaData.nodes)) {
        figmaData.nodes.forEach((node: any) => {
          if (this.isSeatComponent(node)) {
            const workstation = this.convertFigmaNodeToWorkstation(node);
            if (workstation) {
              workstations.push(workstation);
            }
          }
        });
      }

      console.log(`📊 解析Figma数据完成 - 工位数量: ${workstations.length}`);
      return workstations;
    } catch (error) {
      console.error('解析Figma座位图数据失败:', error);
      return [];
    }
  }

  // 判断是否为座位组件
  private isSeatComponent(node: any): boolean {
    const seatComponentIds = [
      '11:2542', // single chair
      '11:2886', // rectangle desk and chair
      '13:4108', // circle table and chairs
      '14:3355', // arc table and chairs
      '11:2824'  // three seat couch
    ];

    return seatComponentIds.includes(node.componentId) || 
           (node.name && node.name.toLowerCase().includes('seat')) ||
           (node.name && node.name.toLowerCase().includes('desk')) ||
           (node.name && node.name.toLowerCase().includes('chair'));
  }

  // 转换Figma节点为工位数据
  private convertFigmaNodeToWorkstation(node: any): WorkstationSyncData | null {
    try {
      return {
        id: node.id || `figma-${Date.now()}`,
        name: node.name || '未命名工位',
        department: '', // 将在调用时设置
        position: {
          x: Math.round(node.layout?.x || 0),
          y: Math.round(node.layout?.y || 0)
        },
        dimensions: {
          width: Math.round(node.layout?.width || 80),
          height: Math.round(node.layout?.height || 60)
        },
        type: this.getFigmaComponentType(node.componentId),
        color: this.getFigmaComponentColor(node),
        status: 'available',
        figmaNodeId: node.id,
        lastModified: new Date().toISOString()
      };
    } catch (error) {
      console.error('转换Figma节点失败:', error);
      return null;
    }
  }

  // 获取Figma组件类型
  private getFigmaComponentType(componentId: string): string {
    const typeMapping: Record<string, string> = {
      '11:2542': 'single-chair',
      '11:2886': 'desk-chair-rect',
      '13:4108': 'table-group-circle',
      '14:3355': 'table-group-arc',
      '11:2824': 'couch-three'
    };

    return typeMapping[componentId] || 'desk-chair-rect';
  }

  // 获取Figma组件颜色
  private getFigmaComponentColor(node: any): string {
    // 从组件属性中提取颜色信息
    if (node.componentProperties) {
      const colorProp = node.componentProperties.find((prop: any) => prop.name === 'color');
      if (colorProp) {
        return colorProp.value;
      }
    }

    // 默认颜色
    return 'blue';
  }

  // 同步工位数据到后端
  private async syncWorkstationData(department: string, workstations: WorkstationSyncData[]): Promise<void> {
    try {
      const response = await fetch('/api/workstations/sync-figma', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          department,
          workstations,
          syncTime: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`同步API响应错误: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ 工位数据同步成功:', result);
    } catch (error) {
      console.error('同步工位数据失败:', error);
      throw error;
    }
  }

  // 通知前端更新
  private notifyFrontendUpdate(department: string, workstations: WorkstationSyncData[]): void {
    // 触发自定义事件通知前端组件更新
    const updateEvent = new CustomEvent('figma-sync-update', {
      detail: {
        department,
        workstations,
        timestamp: new Date().toISOString()
      }
    });

    window.dispatchEvent(updateEvent);
    console.log(`📢 已通知前端更新 - 部门: ${department}, 工位数量: ${workstations.length}`);
  }

  // 结束编辑会话
  public endEditSession(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.isActive = false;
      console.log(`🔚 编辑会话结束 - 会话ID: ${sessionId}`);
    }
  }

  // 获取活跃会话
  public getActiveSessions(): FigmaEditSession[] {
    return Array.from(this.activeSessions.values()).filter(session => session.isActive);
  }

  // 清理过期会话
  public cleanupExpiredSessions(): void {
    const now = Date.now();
    const maxAge = 2 * 60 * 60 * 1000; // 2小时

    for (const [sessionId, session] of this.activeSessions) {
      const sessionAge = now - new Date(session.startTime).getTime();
      if (sessionAge > maxAge) {
        this.activeSessions.delete(sessionId);
        console.log(`🧹 清理过期会话 - 会话ID: ${sessionId}`);
      }
    }
  }

  // 销毁服务
  public destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.activeSessions.clear();
  }
}

// 导出单例实例
export const figmaIntegrationService = FigmaIntegrationService.getInstance();
export default figmaIntegrationService;