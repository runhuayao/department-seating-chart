import React, { useState, useEffect } from 'react';
import { 
  Monitor, Plus, Search, Edit, Trash2, Eye, Filter, 
  MapPin, User, Building, Wifi, HardDrive, Cpu,
  Tag, Calendar, Activity, AlertCircle, CheckCircle,
  X, Save, RefreshCw
} from 'lucide-react';
import { rbacService } from '../services/rbacService';
import { 
  Workstation, 
  WorkstationFormData, 
  WorkstationSearchParams,
  WorkstationStats,
  WorkstationTag,
  WORKSTATION_PERMISSIONS,
  WORKSTATION_STATUS_OPTIONS,
  NETWORK_TYPE_OPTIONS,
  NETWORK_SPEED_OPTIONS,
  EQUIPMENT_OPTIONS,
  SOFTWARE_OPTIONS,
  WORKSTATION_VALIDATION_RULES
} from '../types/workstation';

const WorkstationManagement: React.FC = () => {
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const [tags, setTags] = useState<WorkstationTag[]>([]);
  const [stats, setStats] = useState<WorkstationStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 表单状态
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingWorkstation, setEditingWorkstation] = useState<Workstation | null>(null);
  const [selectedWorkstation, setSelectedWorkstation] = useState<Workstation | null>(null);
  
  // 搜索和筛选状态
  const [searchParams, setSearchParams] = useState<WorkstationSearchParams>({
    searchTerm: '',
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });
  const [showFilters, setShowFilters] = useState(false);
  
  // 表单数据
  const [formData, setFormData] = useState<WorkstationFormData>({
    name: '',
    ipAddress: '',
    username: '',
    department: '',
    location: '',
    equipment: [],
    specs: {},
    software: [],
    network: {},
    notes: '',
    tagIds: []
  });
  
  // 表单验证错误
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  // 权限检查
  const canRead = rbacService.hasPermission('workstation', 'read');
  const canCreate = rbacService.hasPermission('workstation', 'create');
  const canUpdate = rbacService.hasPermission('workstation', 'update');
  const canDelete = rbacService.hasPermission('workstation', 'delete');
  const canManageTags = rbacService.hasPermission('workstation', 'manage_tags');
  const canViewStats = rbacService.hasPermission('workstation', 'view_stats');
  
  // 当前用户信息
  const currentUser = rbacService.getCurrentUser();
  const isAdmin = currentUser?.roles.some(role => role.name === 'admin' || role.name === 'super_admin');
  
  useEffect(() => {
    if (canRead) {
      loadWorkstations();
      loadTags();
      if (canViewStats) {
        loadStats();
      }
    }
  }, [canRead, canViewStats, searchParams]);
  
  const loadWorkstations = async () => {
    setLoading(true);
    setError(null);
    try {
      // 模拟API调用 - 实际项目中应该调用workstationService
      const mockWorkstations: Workstation[] = [
        {
          id: '1',
          name: '开发工位-DEV001',
          ipAddress: '192.168.1.101',
          username: 'developer01',
          department: '技术部',
          metadata: {
            location: 'A区-1楼-001',
            equipment: ['台式机', '双显示器', '机械键盘'],
            specs: {
              cpu: 'Intel i7-12700K',
              ram: '32GB',
              storage: '1TB SSD',
              gpu: 'RTX 4070'
            },
            software: ['VS Code', 'Docker', 'Node.js', 'PostgreSQL'],
            network: {
              speed: '1Gbps',
              type: '有线'
            }
          },
          status: 'active',
          tags: [
            { id: 1, name: '开发环境', color: '#10B981', description: '开发相关工位', isSystem: true }
          ],
          createdBy: 'admin',
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-15')
        },
        {
          id: '2',
          name: '设计工位-DES001',
          ipAddress: '192.168.1.102',
          username: 'designer01',
          department: '设计部',
          metadata: {
            location: 'B区-2楼-015',
            equipment: ['MacBook Pro', '4K显示器', '数位板'],
            specs: {
              cpu: 'Apple M2 Pro',
              ram: '32GB',
              storage: '1TB SSD'
            },
            software: ['Adobe Creative Suite', 'Figma', 'Sketch'],
            network: {
              speed: '1Gbps',
              type: 'WiFi 6'
            }
          },
          status: 'active',
          tags: [
            { id: 4, name: '办公工位', color: '#3B82F6', description: '日常办公工位', isSystem: true }
          ],
          createdBy: 'designer01',
          createdAt: new Date('2024-01-16'),
          updatedAt: new Date('2024-01-16')
        }
      ];
      
      // 应用搜索和筛选
      let filteredWorkstations = mockWorkstations;
      if (searchParams.searchTerm) {
        const term = searchParams.searchTerm.toLowerCase();
        filteredWorkstations = filteredWorkstations.filter(w => 
          w.name.toLowerCase().includes(term) ||
          w.username.toLowerCase().includes(term) ||
          w.department.toLowerCase().includes(term) ||
          w.ipAddress.includes(term)
        );
      }
      
      if (searchParams.department) {
        filteredWorkstations = filteredWorkstations.filter(w => 
          w.department.toLowerCase().includes(searchParams.department!.toLowerCase())
        );
      }
      
      if (searchParams.status) {
        filteredWorkstations = filteredWorkstations.filter(w => w.status === searchParams.status);
      }
      
      setWorkstations(filteredWorkstations);
    } catch (err) {
      setError('加载工位数据失败');
      console.error('Load workstations error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const loadTags = async () => {
    try {
      // 模拟API调用
      const mockTags: WorkstationTag[] = [
        { id: 1, name: '开发环境', color: '#10B981', description: '开发相关工位', isSystem: true },
        { id: 2, name: '测试环境', color: '#F59E0B', description: '测试相关工位', isSystem: true },
        { id: 3, name: '生产环境', color: '#EF4444', description: '生产环境工位', isSystem: true },
        { id: 4, name: '办公工位', color: '#3B82F6', description: '日常办公工位', isSystem: true },
        { id: 5, name: '会议室', color: '#8B5CF6', description: '会议室设备', isSystem: true },
        { id: 6, name: '服务器', color: '#6B7280', description: '服务器设备', isSystem: true }
      ];
      setTags(mockTags);
    } catch (err) {
      console.error('Load tags error:', err);
    }
  };
  
  const loadStats = async () => {
    try {
      // 模拟API调用
      const mockStats: WorkstationStats = {
        totalCount: 2,
        activeCount: 2,
        inactiveCount: 0,
        maintenanceCount: 0,
        departmentCount: 2,
        creatorCount: 2,
        avgPerDepartment: 1
      };
      setStats(mockStats);
    } catch (err) {
      console.error('Load stats error:', err);
    }
  };
  
  const validateForm = (data: WorkstationFormData): Record<string, string> => {
    const errors: Record<string, string> = {};
    
    // 名称验证
    if (!data.name.trim()) {
      errors.name = '工位名称不能为空';
    } else if (data.name.length < WORKSTATION_VALIDATION_RULES.name.minLength) {
      errors.name = `工位名称至少${WORKSTATION_VALIDATION_RULES.name.minLength}个字符`;
    } else if (data.name.length > WORKSTATION_VALIDATION_RULES.name.maxLength) {
      errors.name = `工位名称不能超过${WORKSTATION_VALIDATION_RULES.name.maxLength}个字符`;
    }
    
    // IP地址验证
    if (!data.ipAddress.trim()) {
      errors.ipAddress = 'IP地址不能为空';
    } else if (!WORKSTATION_VALIDATION_RULES.ipAddress.pattern.test(data.ipAddress)) {
      errors.ipAddress = 'IP地址格式不正确';
    }
    
    // 用户名验证
    if (!data.username.trim()) {
      errors.username = '用户名不能为空';
    } else if (data.username.length < WORKSTATION_VALIDATION_RULES.username.minLength) {
      errors.username = `用户名至少${WORKSTATION_VALIDATION_RULES.username.minLength}个字符`;
    }
    
    // 部门验证
    if (!data.department.trim()) {
      errors.department = '部门不能为空';
    } else if (data.department.length < WORKSTATION_VALIDATION_RULES.department.minLength) {
      errors.department = `部门名称至少${WORKSTATION_VALIDATION_RULES.department.minLength}个字符`;
    }
    
    return errors;
  };
  
  const handleCreateWorkstation = async () => {
    const errors = validateForm(formData);
    setFormErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      return;
    }
    
    setLoading(true);
    try {
      // 模拟API调用 - 实际项目中应该调用workstationService.create
      const newWorkstation: Workstation = {
        id: Date.now().toString(),
        name: formData.name,
        ipAddress: formData.ipAddress,
        username: formData.username,
        department: formData.department,
        metadata: {
          location: formData.location,
          equipment: formData.equipment,
          specs: formData.specs,
          software: formData.software,
          network: formData.network,
          notes: formData.notes
        },
        status: 'active',
        tags: tags.filter(tag => formData.tagIds?.includes(tag.id)),
        createdBy: currentUser?.username || 'unknown',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      setWorkstations(prev => [newWorkstation, ...prev]);
      setShowCreateForm(false);
      resetForm();
      
      // 显示成功消息
      alert('工位创建成功！');
    } catch (err) {
      setError('创建工位失败');
      console.error('Create workstation error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleUpdateWorkstation = async (workstation: Workstation) => {
    if (!canUpdate) {
      alert('权限不足：无法更新工位');
      return;
    }
    
    setLoading(true);
    try {
      // 模拟API调用
      const updatedWorkstation = {
        ...workstation,
        updatedAt: new Date()
      };
      
      setWorkstations(prev => 
        prev.map(w => w.id === workstation.id ? updatedWorkstation : w)
      );
      setEditingWorkstation(null);
      
      alert('工位更新成功！');
    } catch (err) {
      setError('更新工位失败');
      console.error('Update workstation error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleDeleteWorkstation = async (workstationId: string) => {
    if (!canDelete) {
      alert('权限不足：无法删除工位');
      return;
    }
    
    if (!isAdmin) {
      alert('只有管理员可以删除工位');
      return;
    }
    
    if (!confirm('确定要删除这个工位吗？此操作不可撤销。')) {
      return;
    }
    
    setLoading(true);
    try {
      // 模拟API调用
      setWorkstations(prev => prev.filter(w => w.id !== workstationId));
      alert('工位删除成功！');
    } catch (err) {
      setError('删除工位失败');
      console.error('Delete workstation error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const resetForm = () => {
    setFormData({
      name: '',
      ipAddress: '',
      username: '',
      department: '',
      location: '',
      equipment: [],
      specs: {},
      software: [],
      network: {},
      notes: '',
      tagIds: []
    });
    setFormErrors({});
  };
  
  const getStatusColor = (status: string) => {
    const statusOption = WORKSTATION_STATUS_OPTIONS.find(opt => opt.value === status);
    return statusOption?.color || 'gray';
  };
  
  const getStatusLabel = (status: string) => {
    const statusOption = WORKSTATION_STATUS_OPTIONS.find(opt => opt.value === status);
    return statusOption?.label || status;
  };
  
  if (!canRead) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center py-8">
          <Monitor className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">权限不足</h3>
          <p className="text-gray-500">您没有权限查看工位管理功能</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* 统计卡片 - 响应式优化 */}
      {canViewStats && stats && (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 lg:p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Monitor className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
              </div>
              <div className="ml-2 sm:ml-4 min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">总工位数</p>
                <p className="text-lg sm:text-2xl font-semibold text-gray-900">{stats.totalCount}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 lg:p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
              </div>
              <div className="ml-2 sm:ml-4 min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">活跃工位</p>
                <p className="text-lg sm:text-2xl font-semibold text-gray-900">{stats.activeCount}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 lg:p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Building className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600" />
              </div>
              <div className="ml-2 sm:ml-4 min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">部门数量</p>
                <p className="text-lg sm:text-2xl font-semibold text-gray-900">{stats.departmentCount}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 lg:p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <User className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600" />
              </div>
              <div className="ml-2 sm:ml-4 min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">创建者数量</p>
                <p className="text-lg sm:text-2xl font-semibold text-gray-900">{stats.creatorCount}</p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 主要内容区域 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 space-y-3 sm:space-y-0">
            <h3 className="text-lg font-semibold text-gray-900">工位管理</h3>
            <div className="flex items-center space-x-2 sm:space-x-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors text-sm"
              >
                <Filter className="w-4 h-4" />
                <span className="hidden sm:inline">筛选</span>
              </button>
              
              <button
                onClick={loadWorkstations}
                className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors text-sm"
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">刷新</span>
              </button>
              
              {canCreate && (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="flex items-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  <span>添加工位</span>
                </button>
              )}
            </div>
          </div>
          
          {/* 搜索栏 */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="搜索工位名称、用户名、部门或IP地址..."
                value={searchParams.searchTerm || ''}
                onChange={(e) => setSearchParams(prev => ({ ...prev, searchTerm: e.target.value, page: 1 }))}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
          </div>
          
          {/* 筛选器 */}
          {showFilters && (
            <div className="mt-4 p-3 sm:p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">部门</label>
                  <input
                    type="text"
                    placeholder="筛选部门"
                    value={searchParams.department || ''}
                    onChange={(e) => setSearchParams(prev => ({ ...prev, department: e.target.value, page: 1 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                  <select
                    value={searchParams.status || ''}
                    onChange={(e) => setSearchParams(prev => ({ ...prev, status: e.target.value as any, page: 1 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <option value="">全部状态</option>
                    {WORKSTATION_STATUS_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="sm:col-span-2 lg:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">排序</label>
                  <select
                    value={`${searchParams.sortBy}-${searchParams.sortOrder}`}
                    onChange={(e) => {
                      const [sortBy, sortOrder] = e.target.value.split('-');
                      setSearchParams(prev => ({ ...prev, sortBy: sortBy as any, sortOrder: sortOrder as any, page: 1 }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <option value="createdAt-desc">创建时间（最新）</option>
                    <option value="createdAt-asc">创建时间（最早）</option>
                    <option value="name-asc">名称（A-Z）</option>
                    <option value="name-desc">名称（Z-A）</option>
                    <option value="department-asc">部门（A-Z）</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* 错误提示 */}
        {error && (
          <div className="p-4 bg-red-50 border-l-4 border-red-400">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}
        
        {/* 工位列表 */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-8 h-8 text-gray-400 mx-auto mb-4 animate-spin" />
              <p className="text-gray-500">加载中...</p>
            </div>
          ) : workstations.length === 0 ? (
            <div className="text-center py-8">
              <Monitor className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">暂无工位</h3>
              <p className="text-gray-500 mb-4">还没有添加任何工位</p>
              {canCreate && (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>添加第一个工位</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {workstations.map((workstation) => (
                <div key={workstation.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 mb-1">{workstation.name}</h4>
                      <p className="text-sm text-gray-500">{workstation.ipAddress}</p>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      getStatusColor(workstation.status) === 'green' ? 'bg-green-100 text-green-800' :
                      getStatusColor(workstation.status) === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {getStatusLabel(workstation.status)}
                    </span>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <User className="w-4 h-4 mr-2" />
                      <span>{workstation.username}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Building className="w-4 h-4 mr-2" />
                      <span>{workstation.department}</span>
                    </div>
                    {workstation.metadata.location && (
                      <div className="flex items-center text-sm text-gray-600">
                        <MapPin className="w-4 h-4 mr-2" />
                        <span>{workstation.metadata.location}</span>
                      </div>
                    )}
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="w-4 h-4 mr-2" />
                      <span>{workstation.createdAt.toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  {/* 标签 */}
                  {workstation.tags && workstation.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {workstation.tags.map((tag) => (
                        <span
                          key={tag.id}
                          className="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
                          style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                        >
                          <Tag className="w-3 h-3 mr-1" />
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {/* 操作按钮 */}
                  <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                    <button
                      onClick={() => setSelectedWorkstation(workstation)}
                      className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors font-medium"
                      title="查看详情"
                    >
                      <Eye className="w-4 h-4" />
                      <span>详情</span>
                    </button>
                    
                    {(canUpdate && (isAdmin || workstation.createdBy === currentUser?.username)) && (
                      <button
                        onClick={() => setEditingWorkstation(workstation)}
                        className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 text-sm text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors font-medium"
                        title="编辑工位"
                      >
                        <Edit className="w-4 h-4" />
                        <span>编辑</span>
                      </button>
                    )}
                    
                    {(canDelete && isAdmin) && (
                      <button
                        onClick={() => handleDeleteWorkstation(workstation.id)}
                        className="flex items-center justify-center px-3 py-2 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors font-medium sm:flex-initial"
                        title="删除工位"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="sm:hidden ml-1">删除</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* 创建工位弹窗 */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">添加新工位</h3>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    resetForm();
                  }}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              {/* 基本信息 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    工位名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm ${
                      formErrors.name ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="请输入工位名称"
                  />
                  {formErrors.name && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    IP地址 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.ipAddress}
                    onChange={(e) => setFormData(prev => ({ ...prev, ipAddress: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm ${
                      formErrors.ipAddress ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="192.168.1.100"
                  />
                  {formErrors.ipAddress && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.ipAddress}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    用户名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm ${
                      formErrors.username ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="请输入用户名"
                  />
                  {formErrors.username && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.username}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    部门 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm ${
                      formErrors.department ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="请输入部门名称"
                  />
                  {formErrors.department && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.department}</p>
                  )}
                </div>
              </div>
              
              {/* 位置信息 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">位置</label>
                <input
                  type="text"
                  value={formData.location || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="如：A区-1楼-001"
                />
              </div>
              
              {/* 设备信息 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">设备</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {EQUIPMENT_OPTIONS.slice(0, 10).map((equipment) => (
                    <button
                      key={equipment}
                      type="button"
                      onClick={() => {
                        const current = formData.equipment || [];
                        if (current.includes(equipment)) {
                          setFormData(prev => ({
                            ...prev,
                            equipment: current.filter(e => e !== equipment)
                          }));
                        } else {
                          setFormData(prev => ({
                            ...prev,
                            equipment: [...current, equipment]
                          }));
                        }
                      }}
                      className={`px-2 py-1 text-xs sm:text-sm rounded-full border transition-colors ${
                        (formData.equipment || []).includes(equipment)
                          ? 'bg-blue-100 text-blue-800 border-blue-300'
                          : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                      }`}
                    >
                      {equipment}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="或输入其他设备，用逗号分隔"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                      const newEquipment = e.currentTarget.value.trim().split(',').map(s => s.trim()).filter(s => s);
                      setFormData(prev => ({
                        ...prev,
                        equipment: [...(prev.equipment || []), ...newEquipment]
                      }));
                      e.currentTarget.value = '';
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
                {formData.equipment && formData.equipment.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {formData.equipment.map((equipment, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                      >
                        {equipment}
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              equipment: prev.equipment?.filter((_, i) => i !== index)
                            }));
                          }}
                          className="ml-1 text-blue-600 hover:text-blue-800"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              
              {/* 硬件规格 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">硬件规格</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <input
                      type="text"
                      value={formData.specs?.cpu || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        specs: { ...prev.specs, cpu: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder="CPU型号"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={formData.specs?.ram || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        specs: { ...prev.specs, ram: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder="内存大小"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={formData.specs?.storage || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        specs: { ...prev.specs, storage: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder="存储容量"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={formData.specs?.gpu || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        specs: { ...prev.specs, gpu: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder="显卡型号（可选）"
                    />
                  </div>
                </div>
              </div>
              
              {/* 网络信息 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">网络信息</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <select
                      value={formData.network?.type || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        network: { ...prev.network, type: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    >
                      <option value="">选择网络类型</option>
                      {NETWORK_TYPE_OPTIONS.map(option => (
                        <option key={option.value} value={option.label}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <select
                      value={formData.network?.speed || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        network: { ...prev.network, speed: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    >
                      <option value="">选择网络速度</option>
                      {NETWORK_SPEED_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              
              {/* 标签 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">标签</label>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => {
                        const current = formData.tagIds || [];
                        if (current.includes(tag.id)) {
                          setFormData(prev => ({
                            ...prev,
                            tagIds: current.filter(id => id !== tag.id)
                          }));
                        } else {
                          setFormData(prev => ({
                            ...prev,
                            tagIds: [...current, tag.id]
                          }));
                        }
                      }}
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs sm:text-sm font-medium border transition-colors ${
                        (formData.tagIds || []).includes(tag.id)
                          ? 'border-transparent text-white'
                          : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                      style={{
                        backgroundColor: (formData.tagIds || []).includes(tag.id) ? tag.color : 'transparent',
                        borderColor: (formData.tagIds || []).includes(tag.id) ? tag.color : undefined
                      }}
                    >
                      <Tag className="w-3 h-3 mr-1" />
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* 备注 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea
                  value={formData.notes || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="其他备注信息..."
                />
              </div>
            </div>
            
            <div className="p-4 sm:p-6 border-t border-gray-200">
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                <button
                  onClick={handleCreateWorkstation}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center space-x-2 bg-blue-600 text-white py-2.5 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>{loading ? '创建中...' : '创建工位'}</span>
                </button>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    resetForm();
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 py-2.5 px-4 rounded-lg hover:bg-gray-400 transition-colors text-sm font-medium"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 工位详情弹窗 */}
      {selectedWorkstation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">工位详情</h3>
                <button
                  onClick={() => setSelectedWorkstation(null)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              {/* 基本信息 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">工位名称</label>
                  <p className="text-sm text-gray-900">{selectedWorkstation.name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">IP地址</label>
                  <p className="text-sm text-gray-900">{selectedWorkstation.ipAddress}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">用户名</label>
                  <p className="text-sm text-gray-900">{selectedWorkstation.username}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">部门</label>
                  <p className="text-sm text-gray-900">{selectedWorkstation.department}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">状态</label>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    getStatusColor(selectedWorkstation.status) === 'green' ? 'bg-green-100 text-green-800' :
                    getStatusColor(selectedWorkstation.status) === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {getStatusLabel(selectedWorkstation.status)}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">创建者</label>
                  <p className="text-sm text-gray-900">{selectedWorkstation.createdBy}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">创建时间</label>
                  <p className="text-sm text-gray-900">{selectedWorkstation.createdAt.toLocaleString()}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">更新时间</label>
                  <p className="text-sm text-gray-900">{selectedWorkstation.updatedAt.toLocaleString()}</p>
                </div>
              </div>
              
              {/* 位置信息 */}
              {selectedWorkstation.metadata.location && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">位置</label>
                  <div className="flex items-center text-sm text-gray-900">
                    <MapPin className="w-4 h-4 mr-2 text-gray-500" />
                    {selectedWorkstation.metadata.location}
                  </div>
                </div>
              )}
              
              {/* 设备信息 */}
              {selectedWorkstation.metadata.equipment && selectedWorkstation.metadata.equipment.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">设备</label>
                  <div className="flex flex-wrap gap-2">
                    {selectedWorkstation.metadata.equipment.map((equipment, index) => (
                      <span key={index} className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">
                        {equipment}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* 硬件规格 */}
              {selectedWorkstation.metadata.specs && Object.keys(selectedWorkstation.metadata.specs).length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">硬件规格</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {selectedWorkstation.metadata.specs.cpu && (
                      <div className="flex items-center text-sm text-gray-900">
                        <Cpu className="w-4 h-4 mr-2 text-gray-500" />
                        <span className="font-medium mr-2">CPU:</span>
                        {selectedWorkstation.metadata.specs.cpu}
                      </div>
                    )}
                    {selectedWorkstation.metadata.specs.ram && (
                      <div className="flex items-center text-sm text-gray-900">
                        <HardDrive className="w-4 h-4 mr-2 text-gray-500" />
                        <span className="font-medium mr-2">内存:</span>
                        {selectedWorkstation.metadata.specs.ram}
                      </div>
                    )}
                    {selectedWorkstation.metadata.specs.storage && (
                      <div className="flex items-center text-sm text-gray-900">
                        <HardDrive className="w-4 h-4 mr-2 text-gray-500" />
                        <span className="font-medium mr-2">存储:</span>
                        {selectedWorkstation.metadata.specs.storage}
                      </div>
                    )}
                    {selectedWorkstation.metadata.specs.gpu && (
                      <div className="flex items-center text-sm text-gray-900">
                        <Monitor className="w-4 h-4 mr-2 text-gray-500" />
                        <span className="font-medium mr-2">显卡:</span>
                        {selectedWorkstation.metadata.specs.gpu}
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* 网络信息 */}
              {selectedWorkstation.metadata.network && Object.keys(selectedWorkstation.metadata.network).length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">网络信息</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {selectedWorkstation.metadata.network.type && (
                      <div className="flex items-center text-sm text-gray-900">
                        <Wifi className="w-4 h-4 mr-2 text-gray-500" />
                        <span className="font-medium mr-2">类型:</span>
                        {selectedWorkstation.metadata.network.type}
                      </div>
                    )}
                    {selectedWorkstation.metadata.network.speed && (
                      <div className="flex items-center text-sm text-gray-900">
                        <Activity className="w-4 h-4 mr-2 text-gray-500" />
                        <span className="font-medium mr-2">速度:</span>
                        {selectedWorkstation.metadata.network.speed}
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* 软件信息 */}
              {selectedWorkstation.metadata.software && selectedWorkstation.metadata.software.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">软件</label>
                  <div className="flex flex-wrap gap-2">
                    {selectedWorkstation.metadata.software.map((software, index) => (
                      <span key={index} className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                        {software}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* 标签 */}
              {selectedWorkstation.tags && selectedWorkstation.tags.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">标签</label>
                  <div className="flex flex-wrap gap-2">
                    {selectedWorkstation.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
                        style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                      >
                        <Tag className="w-3 h-3 mr-1" />
                        {tag.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* 备注 */}
              {selectedWorkstation.metadata.notes && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">备注</label>
                  <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">
                    {selectedWorkstation.metadata.notes}
                  </p>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-gray-200">
              <div className="flex justify-end">
                <button
                  onClick={() => setSelectedWorkstation(null)}
                  className="bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkstationManagement;