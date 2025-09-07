import { User, Role, Permission, UserSession, PermissionCheck, PERMISSIONS, ROLES } from '../types/rbac';

class RBACService {
  private currentSession: UserSession | null = null;
  private users: User[] = [];
  private roles: Role[] = [];
  private permissions: Permission[] = [];

  constructor() {
    this.initializeDefaultData();
  }

  // 初始化默认数据
  private initializeDefaultData() {
    // 初始化权限
    this.permissions = [
      { id: '1', name: '服务器查看', resource: 'server', action: 'read', description: '查看服务器状态信息' },
      { id: '2', name: '服务器监控', resource: 'server', action: 'monitor', description: '实时监控服务器性能' },
      { id: '3', name: '服务器控制', resource: 'server', action: 'control', description: '启停服务器服务' },
      { id: '4', name: '服务器配置', resource: 'server', action: 'config', description: '修改服务器配置' },
      { id: '5', name: '用户查看', resource: 'user', action: 'read', description: '查看用户信息' },
      { id: '6', name: '用户创建', resource: 'user', action: 'create', description: '创建新用户' },
      { id: '7', name: '用户更新', resource: 'user', action: 'update', description: '更新用户信息' },
      { id: '8', name: '用户删除', resource: 'user', action: 'delete', description: '删除用户' },
      { id: '9', name: '工位查看', resource: 'workstation', action: 'read', description: '查看工位信息' },
      { id: '10', name: '工位创建', resource: 'workstation', action: 'create', description: '创建新工位' },
      { id: '11', name: '工位更新', resource: 'workstation', action: 'update', description: '更新工位信息' },
      { id: '12', name: '工位删除', resource: 'workstation', action: 'delete', description: '删除工位' },
      { id: '13', name: '工位搜索', resource: 'workstation', action: 'search', description: '搜索工位' },
      { id: '14', name: '工位统计', resource: 'workstation', action: 'stats', description: '查看工位统计' },
      { id: '15', name: '工位批量操作', resource: 'workstation', action: 'batch', description: '批量导入工位' },
      { id: '16', name: '系统配置', resource: 'system', action: 'config', description: '修改系统配置' },
      { id: '17', name: '系统日志', resource: 'system', action: 'logs', description: '查看系统日志' },
    ];

    // 初始化角色
    this.roles = [
      {
        id: '1',
        name: '超级管理员',
        description: '拥有所有权限',
        permissions: this.permissions,
        isSystem: true
      },
      {
        id: '2',
        name: '管理员',
        description: '拥有大部分管理权限',
        permissions: this.permissions.filter(p => !['user:delete', 'system:config'].includes(`${p.resource}:${p.action}`)),
        isSystem: true
      },
      {
        id: '3',
        name: '操作员',
        description: '可以操作服务器和管理工位',
        permissions: this.permissions.filter(p => p.resource === 'server' || p.resource === 'workstation'),
        isSystem: true
      },
      {
        id: '4',
        name: '观察者',
        description: '只能查看信息',
        permissions: this.permissions.filter(p => p.action === 'read' || p.action === 'monitor' || p.action === 'search'),
        isSystem: true
      },
      {
        id: '5',
        name: '工位用户',
        description: '可以添加和查看工位信息',
        permissions: this.permissions.filter(p => 
          (p.resource === 'workstation' && ['read', 'create', 'search'].includes(p.action)) ||
          (p.resource === 'server' && p.action === 'read')
        ),
        isSystem: true
      }
    ];

    // 初始化用户
    this.users = [
      {
        id: '1',
        username: 'admin',
        email: 'admin@m1server.com',
        roles: [this.roles[0]], // 超级管理员
        isActive: true,
        createdAt: new Date()
      },
      {
        id: '2',
        username: 'operator',
        email: 'operator@m1server.com',
        roles: [this.roles[2]], // 操作员
        isActive: true,
        createdAt: new Date()
      },
      {
        id: '3',
        username: 'workstation_user',
        email: 'workstation@m1server.com',
        roles: [this.roles[4]], // 工位用户
        isActive: true,
        createdAt: new Date()
      }
    ];
  }

  // 用户登录
  async login(username: string, password: string): Promise<UserSession | null> {
    // 模拟密码验证（实际应用中应该使用加密密码）
    const user = this.users.find(u => u.username === username && u.isActive);
    if (!user) {
      return null;
    }

    // 简单密码验证（实际应用中应该使用bcrypt等）
    const validPasswords: { [key: string]: string } = {
      'admin': 'admin123',
      'operator': 'op123',
      'workstation_user': 'ws123'
    };

    if (validPasswords[username] !== password) {
      return null;
    }

    // 创建会话
    const session: UserSession = {
      user: { ...user, lastLogin: new Date() },
      token: this.generateToken(),
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8小时过期
      permissions: this.getUserPermissions(user)
    };

    this.currentSession = session;
    return session;
  }

  // 用户登出
  logout(): void {
    this.currentSession = null;
  }

  // 获取当前会话
  getCurrentSession(): UserSession | null {
    if (this.currentSession && this.currentSession.expiresAt > new Date()) {
      return this.currentSession;
    }
    this.currentSession = null;
    return null;
  }

  // 检查权限
  checkPermission(resource: string, action: string): PermissionCheck {
    const session = this.getCurrentSession();
    if (!session) {
      return { hasPermission: false, reason: '用户未登录' };
    }

    const permissionKey = `${resource}:${action}`;
    const hasPermission = session.permissions.includes(permissionKey);

    return {
      hasPermission,
      reason: hasPermission ? undefined : '权限不足'
    };
  }

  // 检查是否有指定权限
  hasPermission(resource: string, action: string): boolean {
    return this.checkPermission(resource, action).hasPermission;
  }

  // 获取用户所有权限
  private getUserPermissions(user: User): string[] {
    const permissions = new Set<string>();
    
    user.roles.forEach(role => {
      role.permissions.forEach(permission => {
        permissions.add(`${permission.resource}:${permission.action}`);
      });
    });

    return Array.from(permissions);
  }

  // 生成令牌
  private generateToken(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  // 获取所有用户
  getUsers(): User[] {
    if (!this.hasPermission('user', 'read')) {
      return [];
    }
    return this.users;
  }

  // 获取所有角色
  getRoles(): Role[] {
    if (!this.hasPermission('role', 'read')) {
      return [];
    }
    return this.roles;
  }

  // 创建用户
  createUser(userData: Omit<User, 'id' | 'createdAt'>): User | null {
    if (!this.hasPermission('user', 'create')) {
      return null;
    }

    const newUser: User = {
      ...userData,
      id: (this.users.length + 1).toString(),
      createdAt: new Date()
    };

    this.users.push(newUser);
    return newUser;
  }

  // 更新用户
  updateUser(userId: string, updates: Partial<User>): User | null {
    if (!this.hasPermission('user', 'update')) {
      return null;
    }

    const userIndex = this.users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      return null;
    }

    this.users[userIndex] = { ...this.users[userIndex], ...updates };
    return this.users[userIndex];
  }

  // 删除用户
  deleteUser(userId: string): boolean {
    if (!this.hasPermission('user', 'delete')) {
      return false;
    }

    const userIndex = this.users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      return false;
    }

    this.users.splice(userIndex, 1);
    return true;
  }
}

// 导出单例实例
export const rbacService = new RBACService();
export default rbacService;