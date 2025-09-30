import React, { useState, useEffect } from 'react';
import { Save, X, User, Monitor, Phone, Wifi, MapPin, Calendar, Clock } from 'lucide-react';

interface WorkstationInfo {
  id: string;
  name: string;
  department: string;
  position: { x: number; y: number };
  dimensions: { width: number; height: number };
  assignedUser?: {
    id: string;
    name: string;
    email: string;
    department: string;
  };
  equipment: {
    computer?: string;
    monitor?: string;
    phone?: string;
    network?: string;
    accessories?: string[];
  };
  status: 'available' | 'occupied' | 'maintenance' | 'reserved';
  metadata: {
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    lastModifiedBy: string;
  };
  figmaSync: {
    nodeId?: string;
    lastSyncTime?: string;
    syncStatus: 'synced' | 'pending' | 'error';
  };
}

interface WorkstationInfoManagerProps {
  workstationId?: string;
  department: string;
  onSave?: (workstation: WorkstationInfo) => void;
  onCancel?: () => void;
  isVisible: boolean;
}

const WorkstationInfoManager: React.FC<WorkstationInfoManagerProps> = ({
  workstationId,
  department,
  onSave,
  onCancel,
  isVisible
}) => {
  const [workstationInfo, setWorkstationInfo] = useState<WorkstationInfo>({
    id: workstationId || `ws-${Date.now()}`,
    name: '',
    department,
    position: { x: 100, y: 100 },
    dimensions: { width: 80, height: 60 },
    equipment: {},
    status: 'available',
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'current-user',
      lastModifiedBy: 'current-user'
    },
    figmaSync: {
      syncStatus: 'pending'
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 加载工位信息
  useEffect(() => {
    if (workstationId && isVisible) {
      loadWorkstationInfo();
    }
  }, [workstationId, isVisible]);

  const loadWorkstationInfo = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/workstations/${workstationId}`);
      
      if (response.ok) {
        const data = await response.json();
        setWorkstationInfo(transformApiDataToWorkstationInfo(data));
      }
    } catch (error) {
      console.error('加载工位信息失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 转换API数据为工位信息格式
  const transformApiDataToWorkstationInfo = (apiData: any): WorkstationInfo => {
    return {
      id: apiData.id,
      name: apiData.name,
      department: apiData.department,
      position: {
        x: apiData.location?.position?.x || 0,
        y: apiData.location?.position?.y || 0
      },
      dimensions: {
        width: apiData.location?.dimensions?.width || 80,
        height: apiData.location?.dimensions?.height || 60
      },
      assignedUser: apiData.assignedUser ? {
        id: apiData.assignedUser.id || '',
        name: apiData.assignedUser,
        email: apiData.assignedUser.email || '',
        department: apiData.department
      } : undefined,
      equipment: apiData.specifications ? JSON.parse(apiData.specifications) : {},
      status: apiData.status || 'available',
      metadata: {
        createdAt: apiData.createdAt || new Date().toISOString(),
        updatedAt: apiData.updatedAt || new Date().toISOString(),
        createdBy: apiData.createdBy || 'system',
        lastModifiedBy: apiData.lastModifiedBy || 'system'
      },
      figmaSync: {
        nodeId: apiData.figmaNodeId,
        lastSyncTime: apiData.lastSyncTime,
        syncStatus: apiData.syncStatus || 'pending'
      }
    };
  };

  // 验证表单数据
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!workstationInfo.name.trim()) {
      newErrors.name = '工位名称不能为空';
    }

    if (workstationInfo.position.x < 0 || workstationInfo.position.x > 1000) {
      newErrors.x = 'X坐标必须在0-1000之间';
    }

    if (workstationInfo.position.y < 0 || workstationInfo.position.y > 800) {
      newErrors.y = 'Y坐标必须在0-800之间';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 保存工位信息
  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setIsLoading(true);

      // 更新元数据
      const updatedInfo = {
        ...workstationInfo,
        metadata: {
          ...workstationInfo.metadata,
          updatedAt: new Date().toISOString(),
          lastModifiedBy: 'current-user'
        }
      };

      // 调用保存API
      const response = await fetch(`/api/workstations/${workstationInfo.id}`, {
        method: workstationId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: updatedInfo.name,
          department: updatedInfo.department,
          location: {
            position: updatedInfo.position,
            dimensions: updatedInfo.dimensions
          },
          assignedUser: updatedInfo.assignedUser?.name,
          status: updatedInfo.status,
          specifications: JSON.stringify(updatedInfo.equipment),
          figmaNodeId: updatedInfo.figmaSync.nodeId,
          metadata: updatedInfo.metadata
        })
      });

      if (response.ok) {
        onSave?.(updatedInfo);
        console.log('✅ 工位信息保存成功');
      } else {
        throw new Error(`保存失败: ${response.status}`);
      }
    } catch (error) {
      console.error('保存工位信息失败:', error);
      alert(`保存失败: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 更新工位信息
  const updateWorkstationInfo = (field: string, value: any) => {
    setWorkstationInfo(prev => {
      const keys = field.split('.');
      const updated = { ...prev };
      let current: any = updated;

      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = value;
      return updated;
    });

    // 清除相关错误
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {workstationId ? '编辑工位信息' : '新增工位信息'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              配置工位的详细属性和设备信息
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        {/* 表单内容 */}
        <div className="p-6 space-y-6">
          {/* 基本信息 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin size={16} className="inline mr-1" />
                工位名称
              </label>
              <input
                type="text"
                value={workstationInfo.name}
                onChange={(e) => updateWorkstationInfo('name', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
                  errors.name ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="例如: E07"
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                状态
              </label>
              <select
                value={workstationInfo.status}
                onChange={(e) => updateWorkstationInfo('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="available">可用</option>
                <option value="occupied">已占用</option>
                <option value="maintenance">维护中</option>
                <option value="reserved">预留</option>
              </select>
            </div>
          </div>

          {/* 位置信息 */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">位置信息</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">X坐标</label>
                <input
                  type="number"
                  value={workstationInfo.position.x}
                  onChange={(e) => updateWorkstationInfo('position.x', parseInt(e.target.value) || 0)}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
                    errors.x ? 'border-red-300' : 'border-gray-300'
                  }`}
                  min="0"
                  max="1000"
                />
                {errors.x && <p className="text-red-500 text-xs mt-1">{errors.x}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Y坐标</label>
                <input
                  type="number"
                  value={workstationInfo.position.y}
                  onChange={(e) => updateWorkstationInfo('position.y', parseInt(e.target.value) || 0)}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
                    errors.y ? 'border-red-300' : 'border-gray-300'
                  }`}
                  min="0"
                  max="800"
                />
                {errors.y && <p className="text-red-500 text-xs mt-1">{errors.y}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">宽度</label>
                <input
                  type="number"
                  value={workstationInfo.dimensions.width}
                  onChange={(e) => updateWorkstationInfo('dimensions.width', parseInt(e.target.value) || 80)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  min="40"
                  max="200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">高度</label>
                <input
                  type="number"
                  value={workstationInfo.dimensions.height}
                  onChange={(e) => updateWorkstationInfo('dimensions.height', parseInt(e.target.value) || 60)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  min="30"
                  max="150"
                />
              </div>
            </div>
          </div>

          {/* 分配用户 */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">
              <User size={18} className="inline mr-2" />
              分配用户
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">用户姓名</label>
                <input
                  type="text"
                  value={workstationInfo.assignedUser?.name || ''}
                  onChange={(e) => updateWorkstationInfo('assignedUser.name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="输入用户姓名"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">邮箱地址</label>
                <input
                  type="email"
                  value={workstationInfo.assignedUser?.email || ''}
                  onChange={(e) => updateWorkstationInfo('assignedUser.email', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="user@company.com"
                />
              </div>
            </div>
          </div>

          {/* 设备信息 */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">
              <Monitor size={18} className="inline mr-2" />
              设备配置
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Monitor size={14} className="inline mr-1" />
                  电脑配置
                </label>
                <input
                  type="text"
                  value={workstationInfo.equipment.computer || ''}
                  onChange={(e) => updateWorkstationInfo('equipment.computer', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="例如: ThinkPad T14"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">显示器</label>
                <input
                  type="text"
                  value={workstationInfo.equipment.monitor || ''}
                  onChange={(e) => updateWorkstationInfo('equipment.monitor', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="例如: 24inch 4K"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Phone size={14} className="inline mr-1" />
                  电话配置
                </label>
                <input
                  type="text"
                  value={workstationInfo.equipment.phone || ''}
                  onChange={(e) => updateWorkstationInfo('equipment.phone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="例如: IP电话"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Wifi size={14} className="inline mr-1" />
                  网络配置
                </label>
                <input
                  type="text"
                  value={workstationInfo.equipment.network || ''}
                  onChange={(e) => updateWorkstationInfo('equipment.network', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="例如: 千兆网口"
                />
              </div>
            </div>
          </div>

          {/* Figma同步信息 */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Figma同步状态</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">节点ID:</span>
                  <span className="ml-2 font-mono text-gray-900">
                    {workstationInfo.figmaSync.nodeId || '未关联'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">同步状态:</span>
                  <span className={`ml-2 px-2 py-1 rounded text-xs ${
                    workstationInfo.figmaSync.syncStatus === 'synced' ? 'bg-green-100 text-green-800' :
                    workstationInfo.figmaSync.syncStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {workstationInfo.figmaSync.syncStatus === 'synced' ? '已同步' :
                     workstationInfo.figmaSync.syncStatus === 'pending' ? '待同步' : '同步错误'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">最后同步:</span>
                  <span className="ml-2 text-gray-900">
                    {workstationInfo.figmaSync.lastSyncTime ? 
                      new Date(workstationInfo.figmaSync.lastSyncTime).toLocaleString() : 
                      '从未同步'
                    }
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 元数据信息 */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">
              <Calendar size={18} className="inline mr-2" />
              创建信息
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <Clock size={14} className="inline mr-1" />
                创建时间: {new Date(workstationInfo.metadata.createdAt).toLocaleString()}
              </div>
              <div>
                <User size={14} className="inline mr-1" />
                创建者: {workstationInfo.metadata.createdBy}
              </div>
              <div>
                <Clock size={14} className="inline mr-1" />
                更新时间: {new Date(workstationInfo.metadata.updatedAt).toLocaleString()}
              </div>
              <div>
                <User size={14} className="inline mr-1" />
                最后修改: {workstationInfo.metadata.lastModifiedBy}
              </div>
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            <Save size={16} className="inline mr-2" />
            {isLoading ? '保存中...' : '保存工位'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkstationInfoManager;