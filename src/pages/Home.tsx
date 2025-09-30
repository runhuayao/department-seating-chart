import React, { useState, useEffect } from 'react';
import DeptMap from '../components/DeptMap';
import BuildingOverview from '../components/BuildingOverview';
import IndoorMapEditor from '../components/IndoorMapEditor';
import FigmaSeatingEditor from '../components/FigmaSeatingEditor';
import SeatingChart from '../components/SeatingChart';

interface HomeProps {
  searchQuery?: string;
  highlightDeskId?: string;
  onResetView?: () => void;
}

const Home: React.FC<HomeProps> = ({ searchQuery, highlightDeskId, onResetView }) => {
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [viewMode, setViewMode] = useState<'overview' | 'department' | 'editor' | 'seating-chart'>('overview');
  const [isEditorMode, setIsEditorMode] = useState(false);

  // 处理部门选择
  const handleDepartmentClick = (department: string) => {
    if (department) {
      setSelectedDepartment(department);
      setViewMode('department');
    } else {
      setSelectedDepartment('');
      setViewMode('overview');
    }
  };

  // 处理编辑器模式切换
  const handleEditMode = () => {
    setIsEditorMode(true);
    setViewMode('editor');
  };

  // 处理Seating Chart模式切换
  const handleSeatingChartMode = () => {
    setViewMode('seating-chart');
  };

  const handleEditorSave = (mapData: any) => {
    console.log('保存地图数据:', mapData);
    // 这里可以调用API保存地图数据
    setIsEditorMode(false);
    setViewMode(selectedDepartment ? 'department' : 'overview');
  };

  const handleEditorCancel = () => {
    setIsEditorMode(false);
    setViewMode(selectedDepartment ? 'department' : 'overview');
  };

  const handleSeatingChartSave = (layoutData: any) => {
    console.log('保存座位布局:', layoutData);
    // 保存座位布局数据
  };

  return (
    <div className="h-full flex flex-col">
      {/* 导航栏 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* 面包屑导航 */}
            <nav className="flex items-center space-x-2 text-sm">
              <button
                onClick={() => handleDepartmentClick('')}
                className={`hover:text-blue-600 transition-colors ${
                  viewMode === 'overview' ? 'text-blue-600 font-medium' : 'text-gray-600'
                }`}
              >
                行政楼总览
              </button>
              
              {selectedDepartment && (
                <>
                  <span className="text-gray-400">/</span>
                  <button
                    onClick={() => setViewMode('department')}
                    className={`hover:text-blue-600 transition-colors ${
                      viewMode === 'department' ? 'text-blue-600 font-medium' : 'text-gray-600'
                    }`}
                  >
                    {selectedDepartment === 'Engineering' && '工程部'}
                    {selectedDepartment === 'Marketing' && '市场部'}
                    {selectedDepartment === 'Sales' && '销售部'}
                    {selectedDepartment === 'HR' && '人事部'}
                  </button>
                </>
              )}
              
              {viewMode === 'editor' && (
                <>
                  <span className="text-gray-400">/</span>
                  <span className="text-blue-600 font-medium">地图编辑</span>
                </>
              )}
            </nav>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center space-x-3">
            {viewMode === 'department' && !isEditorMode && (
              <>
                <button
                  onClick={handleEditMode}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
                >
                  编辑地图
                </button>
                <button
                  onClick={handleSeatingChartMode}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium transition-colors"
                >
                  座位图编辑
                </button>
              </>
            )}
            
            {viewMode !== 'overview' && (
              <button
                onClick={() => handleDepartmentClick('')}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm font-medium transition-colors"
              >
                返回总览
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="flex-1 relative">
        {viewMode === 'overview' && (
          <div className="h-full">
            <BuildingOverview
              onDepartmentClick={handleDepartmentClick}
              className="h-full"
            />
          </div>
        )}

        {viewMode === 'department' && selectedDepartment && (
          <div className="h-full">
            <DeptMap
              department={selectedDepartment}
              searchQuery={searchQuery}
              highlightDeskId={highlightDeskId}
              onResetView={onResetView}
              isHomepage={false}
            />
          </div>
        )}

        {viewMode === 'editor' && selectedDepartment && (
          <div className="h-full">
            <IndoorMapEditor
              department={selectedDepartment}
              onSave={handleEditorSave}
              onCancel={handleEditorCancel}
              className="h-full"
            />
          </div>
        )}

        {viewMode === 'seating-chart' && selectedDepartment && (
          <div className="h-full">
            <FigmaSeatingEditor
              department={selectedDepartment}
              onSave={handleSeatingChartSave}
              onExport={(format) => console.log(`导出${format}格式`)}
            />
          </div>
        )}
      </div>

      {/* 状态栏 */}
      <div className="bg-gray-50 border-t border-gray-200 px-6 py-2">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center space-x-4">
            <span>
              当前视图: {
                viewMode === 'overview' ? '行政楼总览' :
                viewMode === 'department' ? `${selectedDepartment} 部门地图` :
                viewMode === 'seating-chart' ? `${selectedDepartment} 座位图编辑` :
                '地图编辑器'
              }
            </span>
            
            {viewMode === 'department' && (
              <span>
                搜索: {searchQuery || '无'}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {viewMode === 'overview' && (
              <span className="text-green-600">
                ✓ 地图数据已加载
              </span>
            )}
            
            <span>
              {new Date().toLocaleTimeString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;