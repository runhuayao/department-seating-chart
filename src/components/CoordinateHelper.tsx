import React, { useState, useRef, useEffect } from 'react';
import { getDepartmentConfig } from '../data/departmentData';

interface CoordinateHelperProps {
  onCoordinateSelect?: (x: number, y: number) => void;
  onSizeChange?: (width: number, height: number) => void;
  currentX?: string;
  currentY?: string;
  selectedDepartment?: string;
}

const CoordinateHelper: React.FC<CoordinateHelperProps> = ({ 
  onCoordinateSelect, 
  onSizeChange,
  currentX = '', 
  currentY = '',
  selectedDepartment = ''
}) => {
  const [showHelper, setShowHelper] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [workstationSize, setWorkstationSize] = useState({ width: 60, height: 40 });
  const mapRef = useRef<HTMLDivElement>(null);

  // 获取部门配置
  const deptConfig = selectedDepartment ? getDepartmentConfig(selectedDepartment) : null;

  // 预定义的常用位置
  const commonPositions = [
    { name: '左上角', x: 100, y: 100, description: '靠近现有工位区域' },
    { name: '左中', x: 100, y: 350, description: '左侧中间位置' },
    { name: '左下角', x: 100, y: 600, description: '左侧下方区域' },
    { name: '中上', x: 400, y: 100, description: '中间上方位置' },
    { name: '中心', x: 400, y: 350, description: '地图中心位置' },
    { name: '中下', x: 400, y: 600, description: '中间下方位置' },
    { name: '右上角', x: 700, y: 100, description: '右侧上方区域' },
    { name: '右中', x: 700, y: 350, description: '右侧中间位置' },
    { name: '右下角', x: 700, y: 600, description: '右侧下方区域' },
  ];

  const handlePositionSelect = (x: number, y: number) => {
    onCoordinateSelect?.(x, y);
    setShowHelper(false);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mapRef.current) {
      const rect = mapRef.current.getBoundingClientRect();
      const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000);
      const y = Math.round(((e.clientY - rect.top) / rect.height) * 800);
      setMousePosition({ x, y });
    }
  };

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mapRef.current) {
      const rect = mapRef.current.getBoundingClientRect();
      const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000);
      const y = Math.round(((e.clientY - rect.top) / rect.height) * 800);
      handlePositionSelect(x, y);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowHelper(!showHelper)}
        className="text-xs text-blue-600 hover:text-blue-800 underline"
        disabled={!selectedDepartment}
        title={!selectedDepartment ? "请先选择部门" : "打开坐标助手"}
      >
        📍 坐标助手
      </button>

      {showHelper && selectedDepartment && (
        <div className="absolute top-6 left-0 z-50 w-96 bg-white border border-gray-300 rounded-lg shadow-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-sm font-medium text-gray-900">
              {deptConfig?.displayName || selectedDepartment} - 工位坐标助手
            </h4>
            <button
              onClick={() => setShowHelper(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {/* 部门地图预览 */}
          <div className="mb-4">
            <div className="text-xs text-gray-600 mb-2">点击地图选择工位位置：</div>
            <div 
              ref={mapRef}
              className="relative w-full h-40 bg-gray-100 border border-gray-300 rounded cursor-crosshair"
              onMouseMove={handleMouseMove}
              onClick={handleMapClick}
              style={{ cursor: 'crosshair' }}
            >
              {/* 坐标轴标签 */}
              <div className="absolute -top-4 left-0 text-xs text-gray-500">0</div>
              <div className="absolute -top-4 right-0 text-xs text-gray-500">1000</div>
              <div className="absolute -left-6 top-0 text-xs text-gray-500">0</div>
              <div className="absolute -left-6 bottom-0 text-xs text-gray-500">800</div>
              
              {/* 现有工位显示 */}
              {deptConfig?.desks.map((desk, index) => (
                <div
                  key={index}
                  className="absolute bg-blue-300 border border-blue-500 opacity-70"
                  style={{
                    left: `${(desk.x / 1000) * 100}%`,
                    top: `${(desk.y / 800) * 100}%`,
                    width: `${(desk.w / 1000) * 100}%`,
                    height: `${(desk.h / 800) * 100}%`,
                  }}
                  title={`现有工位: ${desk.label} (${desk.x}, ${desk.y})`}
                >
                  <div className="text-xs text-blue-800 p-0.5 truncate">{desk.label}</div>
                </div>
              ))}

              {/* 当前选中位置预览 */}
              {currentX && currentY && (
                <div
                  className="absolute bg-red-400 border-2 border-red-600 opacity-80"
                  style={{
                    left: `${(parseInt(currentX) / 1000) * 100}%`,
                    top: `${(parseInt(currentY) / 800) * 100}%`,
                    width: `${(workstationSize.width / 1000) * 100}%`,
                    height: `${(workstationSize.height / 800) * 100}%`,
                  }}
                  title={`新工位位置: (${currentX}, ${currentY})`}
                >
                  <div className="text-xs text-white p-0.5">新工位</div>
                </div>
              )}

              {/* 鼠标跟随的工位预览 */}
              <div
                className="absolute bg-green-400 border border-green-600 opacity-60 pointer-events-none"
                style={{
                  left: `${(mousePosition.x / 1000) * 100}%`,
                  top: `${(mousePosition.y / 800) * 100}%`,
                  width: `${(workstationSize.width / 1000) * 100}%`,
                  height: `${(workstationSize.height / 800) * 100}%`,
                }}
              />
            </div>
            
            {/* 实时坐标显示 */}
            <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded">
              <span className="font-medium">鼠标位置：</span>
              ({mousePosition.x}, {mousePosition.y})
              {currentX && currentY && (
                <span className="ml-4">
                  <span className="font-medium">选中位置：</span>
                  ({currentX}, {currentY})
                </span>
              )}
            </div>
          </div>

          {/* 工位尺寸设置 */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <div className="text-xs font-medium text-blue-800 mb-2">工位尺寸设置：</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">宽度 (像素)</label>
                <input
                  type="number"
                  value={workstationSize.width}
                  onChange={(e) => {
                    const newWidth = parseInt(e.target.value) || 60;
                    setWorkstationSize(prev => ({ ...prev, width: newWidth }));
                    onSizeChange?.(newWidth, workstationSize.height);
                  }}
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                  min="40"
                  max="120"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">高度 (像素)</label>
                <input
                  type="number"
                  value={workstationSize.height}
                  onChange={(e) => {
                    const newHeight = parseInt(e.target.value) || 40;
                    setWorkstationSize(prev => ({ ...prev, height: newHeight }));
                    onSizeChange?.(workstationSize.width, newHeight);
                  }}
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                  min="30"
                  max="80"
                />
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              默认尺寸：60×40像素 (与现有工位一致)
            </div>
          </div>

          {/* 常用位置快捷选择 */}
          <div className="mb-4">
            <div className="text-xs text-gray-600 mb-2">常用位置：</div>
            <div className="grid grid-cols-3 gap-1">
              {commonPositions.map((pos, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handlePositionSelect(pos.x, pos.y)}
                  className="text-xs p-2 bg-gray-50 hover:bg-blue-50 border border-gray-200 rounded transition-colors"
                  title={pos.description}
                >
                  <div className="font-medium">{pos.name}</div>
                  <div className="text-gray-500">({pos.x},{pos.y})</div>
                </button>
              ))}
            </div>
          </div>

          {/* 坐标说明 */}
          <div className="pt-3 border-t border-gray-200">
            <div className="text-xs text-gray-600">
              <div className="font-medium mb-1">操作说明：</div>
              <div>• 🔵 蓝色区域：现有工位</div>
              <div>• 🔴 红色区域：已选中的新工位位置</div>
              <div>• 🟢 绿色区域：鼠标跟随的工位预览</div>
              <div>• 点击地图任意位置设置工位坐标</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoordinateHelper;