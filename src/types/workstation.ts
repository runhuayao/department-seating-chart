// 工位管理相关类型定义

export interface Workstation {
  id: string;
  name: string;
  ipAddress: string;
  username: string;
  department: string;
  metadata: WorkstationMetadata;
  status: WorkstationStatus;
  tags?: WorkstationTag[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkstationMetadata {
  location?: string;
  equipment?: string[];
  specs?: {
    cpu?: string;
    ram?: string;
    storage?: string;
    gpu?: string;
  };
  software?: string[];
  network?: {
    speed?: string;
    type?: string;
  };
  notes?: string;
  [key: string]: any;
}

export interface WorkstationTag {
  id: number;
  name: string;
  color: string;
  description?: string;
  isSystem: boolean;
}

export type WorkstationStatus = 'active' | 'inactive' | 'maintenance';

export interface WorkstationFormData {
  name: string;
  ipAddress: string;
  username: string;
  department: string;
  location?: string;
  equipment?: string[];
  specs?: {
    cpu?: string;
    ram?: string;
    storage?: string;
    gpu?: string;
  };
  software?: string[];
  network?: {
    speed?: string;
    type?: string;
  };
  notes?: string;
  tagIds?: number[];
}

export interface WorkstationSearchParams {
  searchTerm?: string;
  department?: string;
  status?: WorkstationStatus;
  tags?: number[];
  createdBy?: string;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'department';
  sortOrder?: 'asc' | 'desc';
}

export interface WorkstationSearchResult {
  workstations: Workstation[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface WorkstationStats {
  totalCount: number;
  activeCount: number;
  inactiveCount: number;
  maintenanceCount: number;
  departmentCount: number;
  creatorCount: number;
  avgPerDepartment: number;
}

export interface WorkstationDepartmentStats {
  department: string;
  totalWorkstations: number;
  activeWorkstations: number;
  inactiveWorkstations: number;
  maintenanceWorkstations: number;
  uniqueCreators: number;
  firstCreated: Date;
  lastCreated: Date;
}

export interface WorkstationLog {
  id: number;
  workstationId: string;
  action: 'create' | 'update' | 'delete' | 'status_change';
  oldData?: any;
  newData?: any;
  operator: string;
  operatorRole?: string;
  ipAddress?: string;
  userAgent?: string;
  notes?: string;
  createdAt: Date;
}

export interface WorkstationAccessStat {
  id: number;
  workstationId: string;
  accessType: 'view' | 'search' | 'api_call';
  accessor?: string;
  accessSource?: string;
  searchQuery?: string;
  ipAddress?: string;
  userAgent?: string;
  responseTime?: number;
  createdAt: Date;
}

// API响应类型
export interface WorkstationApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: number;
}

// 工位管理权限
export const WORKSTATION_PERMISSIONS = {
  READ: 'workstation:read',
  CREATE: 'workstation:create',
  UPDATE: 'workstation:update',
  DELETE: 'workstation:delete',
  MANAGE_TAGS: 'workstation:manage_tags',
  VIEW_LOGS: 'workstation:view_logs',
  VIEW_STATS: 'workstation:view_stats'
} as const;

export type WorkstationPermission = typeof WORKSTATION_PERMISSIONS[keyof typeof WORKSTATION_PERMISSIONS];

// 表单验证规则
export interface WorkstationValidationRules {
  name: {
    required: boolean;
    minLength: number;
    maxLength: number;
  };
  ipAddress: {
    required: boolean;
    pattern: RegExp;
  };
  username: {
    required: boolean;
    minLength: number;
    maxLength: number;
  };
  department: {
    required: boolean;
    minLength: number;
    maxLength: number;
  };
}

export const WORKSTATION_VALIDATION_RULES: WorkstationValidationRules = {
  name: {
    required: true,
    minLength: 2,
    maxLength: 200
  },
  ipAddress: {
    required: true,
    pattern: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
  },
  username: {
    required: true,
    minLength: 2,
    maxLength: 100
  },
  department: {
    required: true,
    minLength: 2,
    maxLength: 100
  }
};

// 工位状态选项
export const WORKSTATION_STATUS_OPTIONS = [
  { value: 'active', label: '活跃', color: 'green' },
  { value: 'inactive', label: '非活跃', color: 'gray' },
  { value: 'maintenance', label: '维护中', color: 'yellow' }
] as const;

// 网络类型选项
export const NETWORK_TYPE_OPTIONS = [
  { value: 'wired', label: '有线' },
  { value: 'wifi', label: 'WiFi' },
  { value: 'wifi6', label: 'WiFi 6' },
  { value: 'ethernet', label: '以太网' }
] as const;

// 网络速度选项
export const NETWORK_SPEED_OPTIONS = [
  { value: '100Mbps', label: '100Mbps' },
  { value: '1Gbps', label: '1Gbps' },
  { value: '10Gbps', label: '10Gbps' }
] as const;

// 常用设备选项
export const EQUIPMENT_OPTIONS = [
  '台式机', '笔记本电脑', '显示器', '双显示器', '三显示器',
  '机械键盘', '无线键盘', '鼠标', '无线鼠标', '耳机',
  '摄像头', '麦克风', '音响', '打印机', '扫描仪',
  '数位板', '绘图板', '外置硬盘', 'U盘', '网络设备'
] as const;

// 常用软件选项
export const SOFTWARE_OPTIONS = [
  'VS Code', 'Visual Studio', 'IntelliJ IDEA', 'Eclipse', 'Sublime Text',
  'Docker', 'Node.js', 'Python', 'Java', 'C++',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch',
  'Adobe Creative Suite', 'Photoshop', 'Illustrator', 'Figma', 'Sketch',
  'Office 365', 'Word', 'Excel', 'PowerPoint', 'Outlook',
  'Chrome', 'Firefox', 'Safari', 'Edge', 'Postman'
] as const;