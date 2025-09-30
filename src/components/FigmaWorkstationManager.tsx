import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, X, MapPin, User, Monitor } from 'lucide-react';

// 基于Figma设计规范的工位类型
interface FigmaWorkstationType {
  id: string;
  name: string;
  figmaComponentId: string;
  category: 'desk' | 'meeting' | 'lounge' | 'special';
  defaultWidth: number;
  defaultHeight: number;
  color: string;
  shape: 'rectangle' | 'circle' | 'triangle' | 'arc';
  description: string;
}

interface Workstation {
  id: string;
  name: string;
  department: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: string;
  assignedUser?: string;
  status: 'available' | 'occupied' | 'maintenance' | 'reserved';
  equipment?: {
    computer?: string;
    monitor?: string;
    phone?: string;
    other?: string;
  };
}

interface FigmaWorkstationManagerProps {
  department: string;
  onWorkstationAdd?: (workstation: Workstation) => void;
  onWorkstationUpdate?: (workstation: Workstation) => void;
  onWorkstationDelete?: (id: string) => void;
}

// Figma设计规范中的工位类型定义
const FIGMA_WORKSTATION_TYPES: FigmaWorkstationType[] = [
  {
    id: 'single-desk-blue',
    name: '单人工位',
    figmaComponentId: '11:2542',
    category: 'desk',
    defaultWidth: 80,
    defaultHeight: 60,
    color: '#3B82F6',
    shape: 'rectangle',
    description: '标准单人办公工位'
  },
  {
    id: 'rect-desk-group-blue',
    name: '矩形桌组',
    figmaComponentId: '11:2886',
    category: 'desk',
    defaultWidth: 120,
    defaultHeight: 80,
    color: '#3B82F6',
    shape: 'rectangle',
    description: '矩形桌椅组合'
  },
  {
    id: 'circle-table-blue',
    name: '圆桌会议',
    figmaComponentId: '13:4108',
    category: 'meeting',
    defaultWidth: 100,
    defaultHeight: 100,
    color: '#10B981',
    shape: 'circle',
    description: '圆桌会议区域'
  },
  {
    id: 'arc-table-blue',
    name: '弧形桌组',
    figmaComponentId: '14:3355',
    category: 'meeting',
    defaultWidth: 140,
    defaultHeight: 90,
    color: '#F59E0B',
    shape: 'arc',
    description: '弧形会议桌组'
  },
  {
    id: 'couch-lounge',
    name: '休息沙发',
    figmaComponentId: '11:2824',
    category: 'lounge',
    defaultWidth: 120,
    defaultHeight: 50,
    color: '#8B5CF6',
    shape: 'rectangle',
    description: '休息区沙发'
  }
];

const FigmaWorkstationManager: React.FC<FigmaWorkstationManagerProps> = ({
  department,
  onWorkstationAdd,
  onWorkstationUpdate,
  onWorkstationDelete
}) => {
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const [isAddingWorkstation, setIsAddingWorkstation] = useState(false);
  const [editingWorkstation, setEditingWorkstation] = useState<Workstation | null>(null);
  const [selectedType, setSelectedType] = useState<FigmaWorkstationType>(FIGMA_WORKSTATION_TYPES[0]);
  const [formData, setFormData] = useState({
    name: '',
    x: 100,
    y: 100,
    assignedUser: '',
    equipment: {
      computer: '',
      monitor: '',
      phone: '',
      other: ''
    }
  });

  // 加载工位数据
  useEffect(() => {
    loadWorkstations();
  }, [department]);

  const loadWorkstations = async () => {
    try {
      const response = await fetch(`/api/workstations?department=${department}`);
      const data = await response.json();
      
      const workstationData = data.map((ws: any) => ({
        id: ws.id,
        name: ws.name,
        department: ws.department,
        x: ws.location?.position?.x || 100,
        y: ws.location?.position?.y || 100,
        width: selectedType.defaultWidth,
        height: selectedType.defaultHeight,
        type: selectedType.id,
        assignedUser: ws.assignedUser,
        status: ws.status || 'available',
        equipment: ws.specifications ? JSON.parse(ws.specifications) : {}
      }));
      
      setWorkstations(workstationData);
    } catch (error) {
      console.error('加载工位数据失败:', error);
    }
  };

  // 添加工位
  const handleAddWorkstation = async () => {
    try {
      const newWorkstation: Workstation = {
        id: `ws-${Date.now()}`,
        name: formData.name,
        department,
        x: formData.x,
        y: formData.y,
        width: selectedType.defaultWidth,
        height: selectedType.defaultHeight,
        type: selectedType.id,
        assignedUser: formData.assignedUser,
        status: formData.assignedUser ? 'occupied' : 'available',
        equipment: formData.equipment
      };

      // 调用API创建工位
      const response = await fetch('/api/workstations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newWorkstation.name,
          department: newWorkstation.department,
          location: {
            position: { x: newWorkstation.x, y: newWorkstation.y },
            dimensions: { width: newWorkstation.width, height: newWorkstation.height }
          },
          assignedUser: newWorkstation.assignedUser,
          status: newWorkstation.status,
          specifications: JSON.stringify(newWorkstation.equipment)
        })
      });

      if (response.ok) {
        setWorkstations(prev => [...prev, newWorkstation]);
        onWorkstationAdd?.(newWorkstation);
        setIsAddingWorkstation(false);
        resetForm();
      }
    } catch (error) {
      console.error('添加工位失败:', error);
    }
  };

  // 重置表单
  const resetForm = () => {
    setFormData({
      name: '',
      x: 100,
      y: 100,
      assignedUser: '',
      equipment: {
        computer: '',
        monitor: '',
        phone: '',
        other: ''
      }
    });
    setSelectedType(FIGMA_WORKSTATION_TYPES[0]);
  };

  return (
    <div className="figma-workstation-manager">
      {/* 工位类型选择器 */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Figma 工位类型库</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {FIGMA_WORKSTATION_TYPES.map((type) => (
            <button
              key={type.id}
              onClick={() => setSelectedType(type)}
              className={`p-4 border-2 rounded-lg transition-all ${
                selectedType.id === type.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div
                className="w-full h-16 rounded mb-2 flex items-center justify-center"
                style={{ backgroundColor: type.color + '20' }}
              >
                <div
                  className="w-8 h-6 rounded"
                  style={{ backgroundColor: type.color }}
                ></div>
              </div>
              <div className="text-sm font-medium text-gray-900">{type.name}</div>
              <div className="text-xs text-gray-600">{type.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 添加工位按钮 */}
      <div className="mb-6">
        <button
          onClick={() => setIsAddingWorkstation(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} className="inline mr-2" />
          添加工位
        </button>
      </div>

      {/* 添加工位表单 */}
      {isAddingWorkstation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">添加新工位</h3>
              <button
                onClick={() => setIsAddingWorkstation(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  工位名称
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="例如: E07"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    X坐标
                  </label>
                  <input
                    type="number"
                    value={formData.x}
                    onChange={(e) => setFormData(prev => ({ ...prev, x: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    min="0"
                    max="1000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Y坐标
                  </label>
                  <input
                    type="number"
                    value={formData.y}
                    onChange={(e) => setFormData(prev => ({ ...prev, y: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    min="0"
                    max="800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  分配用户 (可选)
                </label>
                <input
                  type="text"
                  value={formData.assignedUser}
                  onChange={(e) => setFormData(prev => ({ ...prev, assignedUser: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="用户姓名"
                />
              </div>

              {/* 选中的工位类型预览 */}
              <div className="p-3 bg-gray-50 rounded-md">
                <div className="text-sm font-medium text-gray-700 mb-2">选中类型:</div>
                <div className="flex items-center space-x-3">
                  <div
                    className="w-12 h-8 rounded"
                    style={{ backgroundColor: selectedType.color }}
                  ></div>
                  <div>
                    <div className="font-medium">{selectedType.name}</div>
                    <div className="text-xs text-gray-600">
                      {selectedType.defaultWidth} × {selectedType.defaultHeight}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleAddWorkstation}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <Save size={16} className="inline mr-2" />
                保存工位
              </button>
              <button
                onClick={() => setIsAddingWorkstation(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 工位列表 */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {department} 工位列表 ({workstations.length})
          </h3>
        </div>
        
        <div className="divide-y divide-gray-200">
          {workstations.map((workstation) => (
            <div key={workstation.id} className="px-6 py-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ 
                      backgroundColor: workstation.status === 'occupied' ? '#10B981' : 
                                     workstation.status === 'maintenance' ? '#EF4444' : '#3B82F6'
                    }}
                  ></div>
                  <div>
                    <div className="font-medium text-gray-900">{workstation.name}</div>
                    <div className="text-sm text-gray-600">
                      位置: ({workstation.x}, {workstation.y}) · 
                      尺寸: {workstation.width}×{workstation.height}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  {workstation.assignedUser && (
                    <div className="text-sm">
                      <User size={14} className="inline mr-1" />
                      {workstation.assignedUser}
                    </div>
                  )}
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setEditingWorkstation(workstation)}
                      className="p-1 text-gray-400 hover:text-blue-600"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('确定要删除这个工位吗？')) {
                          onWorkstationDelete?.(workstation.id);
                        }
                      }}
                      className="p-1 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {workstations.length === 0 && (
            <div className="px-6 py-8 text-center text-gray-500">
              <MapPin size={48} className="mx-auto mb-4 text-gray-300" />
              <div className="text-lg font-medium mb-2">暂无工位</div>
              <div className="text-sm">点击"添加工位"开始创建第一个工位</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FigmaWorkstationManager;