import React, { useState, useEffect } from 'react';
import { Building2, Users, MapPin, Settings, Search, Plus, Grid, List, ExternalLink } from 'lucide-react';
import FigmaSeatingEditor from '../components/FigmaSeatingEditor';
import SeatingChart from '../components/SeatingChart';
import VacantSelectTemplate from '../components/VacantSelectTemplate';
import WorkstationInfoManager from '../components/WorkstationInfoManager';
import { useMockAuth } from '../components/MockAuthProvider';
import figmaIntegrationService from '../services/figmaIntegrationService';
import templateMappingService from '../services/templateMappingService';
import useFigmaSync from '../hooks/useFigmaSync';

interface Department {
  id: string;
  name: string;
  displayName: string;
  color: string;
  workstationCount: number;
  occupiedCount: number;
  floor: number;
}

interface FigmaHomePageProps {
  searchQuery?: string;
  highlightDeskId?: string;
  onResetView?: () => void;
}

// 基于Figma设计规范的主页组件
const FigmaHomePage: React.FC<FigmaHomePageProps> = ({ 
  searchQuery, 
  highlightDeskId, 
  onResetView 
}) => {
  const { user, isAuthenticated } = useMockAuth();
  const [currentView, setCurrentView] = useState<'building' | 'department' | 'seating-editor'>('building');
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const { syncState, triggerSync } = useFigmaSync(selectedDepartment?.name);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isLoading, setIsLoading] = useState(true);
  const [showWorkstationManager, setShowWorkstationManager] = useState(false);
  const [editingWorkstationId, setEditingWorkstationId] = useState<string | null>(null);

  // 加载部门数据
  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/departments');
      
      if (!response.ok) {
        throw new Error(`API响应错误: ${response.status}`);
      }
      
      const text = await response.text();
      if (!text.trim()) {
        throw new Error('API返回空响应');
      }
      
      const result = JSON.parse(text);
      if (result.success && result.data) {
        const deptData = result.data.map((dept: any) => ({
          id: dept.id,
          name: dept.name,
          displayName: dept.displayName || dept.name,
          color: dept.color || '#3B82F6',
          workstationCount: dept.totalDesks || 0,
          occupiedCount: dept.occupiedDesks || 0,
          floor: dept.floor || 1
        }));
        setDepartments(deptData);
      } else {
        throw new Error('API数据格式错误');
      }
    } catch (error) {
      console.warn('API加载失败，使用备用数据:', error.message);
      // 使用默认数据
      setDepartments([
        { id: '1', name: 'Engineering', displayName: '工程部', color: '#3B82F6', workstationCount: 12, occupiedCount: 8, floor: 3 },
        { id: '2', name: 'Marketing', displayName: '市场部', color: '#10B981', workstationCount: 8, occupiedCount: 6, floor: 2 },
        { id: '3', name: 'Sales', displayName: '销售部', color: '#F59E0B', workstationCount: 10, occupiedCount: 7, floor: 2 },
        { id: '4', name: 'HR', displayName: '人力资源部', color: '#EF4444', workstationCount: 6, occupiedCount: 4, floor: 1 }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // 处理部门选择
  const handleDepartmentSelect = (department: Department) => {
    setSelectedDepartment(department);
    setCurrentView('department');
  };

  // 处理Figma编辑跳转
  const handleFigmaEdit = async (department: Department) => {
    try {
      const sessionId = await figmaIntegrationService.redirectToFigmaEditor(
        department.name, 
        user?.username || 'anonymous'
      );
      
      console.log(`🎨 已跳转到Figma编辑界面 - 会话ID: ${sessionId}`);
      
      // 显示编辑提示
      alert(`已跳转到Figma编辑界面！\n\n请在Figma中完成座位图编辑，\n保存后系统将自动同步更新。\n\n会话ID: ${sessionId}`);
    } catch (error) {
      console.error('跳转Figma编辑失败:', error);
      alert(`跳转失败: ${error.message}`);
    }
  };

  // 返回建筑总览
  const handleBackToBuilding = () => {
    setCurrentView('building');
    setSelectedDepartment(null);
  };

  // 渲染建筑总览
  const renderBuildingOverview = () => (
    <div className="h-full bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      {/* 顶部标题栏 */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">部门地图管理系统</h1>
            <p className="text-gray-600">基于 Figma 设计规范的现代化座位管理平台</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex bg-white rounded-lg p-1 shadow-sm">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`}
              >
                <Grid size={16} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`}
              >
                <List size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">总部门数</p>
              <p className="text-2xl font-bold text-gray-900">{departments.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <MapPin className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">总工位数</p>
              <p className="text-2xl font-bold text-gray-900">
                {departments.reduce((sum, dept) => sum + dept.workstationCount, 0)}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center">
            <div className="p-3 bg-orange-100 rounded-lg">
              <Users className="w-6 h-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">已占用</p>
              <p className="text-2xl font-bold text-gray-900">
                {departments.reduce((sum, dept) => sum + dept.occupiedCount, 0)}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Settings className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">使用率</p>
              <p className="text-2xl font-bold text-gray-900">
                {Math.round((departments.reduce((sum, dept) => sum + dept.occupiedCount, 0) / 
                departments.reduce((sum, dept) => sum + dept.workstationCount, 0)) * 100)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 部门列表 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">部门列表</h2>
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="搜索部门..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {isAuthenticated && (
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                <Plus size={16} className="inline mr-2" />
                添加部门
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
            {departments.map((department) => (
              <div
                key={department.id}
                className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer"
                style={{ borderLeftColor: department.color, borderLeftWidth: '4px' }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">{department.displayName}</h3>
                  <span className="text-sm text-gray-500">第{department.floor}层</span>
                </div>
                
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">总工位:</span>
                    <span className="font-medium">{department.workstationCount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">已占用:</span>
                    <span className="font-medium text-green-600">{department.occupiedCount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">可用:</span>
                    <span className="font-medium text-blue-600">
                      {department.workstationCount - department.occupiedCount}
                    </span>
                  </div>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${(department.occupiedCount / department.workstationCount) * 100}%` 
                    }}
                  ></div>
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={() => handleDepartmentSelect(department)}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                  >
                    查看详情
                  </button>
                  <button
                    onClick={() => handleFigmaEdit(department)}
                    className="flex-1 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                  >
                    <ExternalLink size={14} className="inline mr-1" />
                    Figma编辑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // 渲染部门详情（使用VACANT-SELECT模板风格）
  const renderDepartmentDetail = () => (
    <div className="h-full">
      <VacantSelectTemplate
        department={selectedDepartment?.name || ''}
        floorName={`${selectedDepartment?.floor}階 - ${selectedDepartment?.displayName}`}
        onSeatSearch={(seatNumber) => {
          console.log(`🔍 搜索座位: ${seatNumber}`);
          // 这里可以实现座位搜索功能
        }}
        onTeamSelect={(teamId) => {
          console.log(`👥 选择团队: ${teamId}`);
          // 这里可以实现团队筛选功能
        }}
      />
    </div>
  );

  // 渲染座位图编辑器
  const renderSeatingEditor = () => (
    <div className="h-full flex flex-col">
      {/* 编辑器头部 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleBackToBuilding}
              className="text-gray-600 hover:text-gray-800"
            >
              ← 返回总览
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {selectedDepartment?.displayName} - 座位图编辑器
              </h1>
              <p className="text-gray-600">基于 Figma 设计规范的可视化编辑</p>
            </div>
          </div>
        </div>
      </div>

      {/* Figma座位图编辑器 */}
      <div className="flex-1">
        <FigmaSeatingEditor
          department={selectedDepartment?.name || ''}
          onSave={(layoutData) => {
            console.log('保存座位布局:', layoutData);
            // 这里可以调用API保存数据
          }}
          onExport={(format) => {
            console.log(`导出${format}格式`);
            // 这里可以实现导出功能
          }}
        />
      </div>
    </div>
  );

  // 主渲染逻辑
  return (
    <div className="h-screen bg-gray-50">
      {currentView === 'building' && renderBuildingOverview()}
      {currentView === 'department' && renderDepartmentDetail()}
      {currentView === 'seating-editor' && renderSeatingEditor()}
    </div>
  );
};

export default FigmaHomePage;