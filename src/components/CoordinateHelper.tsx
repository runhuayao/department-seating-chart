import React, { useState } from 'react';

interface CoordinateHelperProps {
  onCoordinateSelect?: (x: number, y: number) => void;
  currentX?: string;
  currentY?: string;
}

const CoordinateHelper: React.FC<CoordinateHelperProps> = ({ 
  onCoordinateSelect, 
  currentX = '', 
  currentY = '' 
}) => {
  const [showHelper, setShowHelper] = useState(false);

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

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowHelper(!showHelper)}
        className="text-xs text-blue-600 hover:text-blue-800 underline"
      >
        📍 坐标助手
      </button>

      {showHelper && (
        <div className="absolute top-6 left-0 z-50 w-80 bg-white border border-gray-300 rounded-lg shadow-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-sm font-medium text-gray-900">坐标选择助手</h4>
            <button
              onClick={() => setShowHelper(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {/* 可视化坐标网格 */}
          <div className="mb-4">
            <div className="text-xs text-gray-600 mb-2">点击选择位置：</div>
            <div className="relative w-full h-32 bg-gray-100 border border-gray-300 rounded">
              {/* 坐标轴标签 */}
              <div className="absolute -top-4 left-0 text-xs text-gray-500">0</div>
              <div className="absolute -top-4 right-0 text-xs text-gray-500">1000</div>
              <div className="absolute -left-6 top-0 text-xs text-gray-500">0</div>
              <div className="absolute -left-6 bottom-0 text-xs text-gray-500">800</div>
              
              {/* 现有工位区域标识 */}
              <div 
                className="absolute bg-blue-200 border border-blue-400 opacity-50"
                style={{
                  left: '10%',
                  top: '12.5%',
                  width: '40%',
                  height: '12.5%'
                }}
                title="现有工位区域"
              >
                <div className="text-xs text-blue-800 p-1">现有工位</div>
              </div>

              {/* 当前选中位置 */}
              {currentX && currentY && (
                <div
                  className="absolute w-2 h-2 bg-red-500 rounded-full transform -translate-x-1 -translate-y-1"
                  style={{
                    left: `${(parseInt(currentX) / 1000) * 100}%`,
                    top: `${(parseInt(currentY) / 800) * 100}%`
                  }}
                  title={`当前位置: (${currentX}, ${currentY})`}
                />
              )}

              {/* 点击区域 */}
              <div
                className="absolute inset-0 cursor-crosshair"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000);
                  const y = Math.round(((e.clientY - rect.top) / rect.height) * 800);
                  handlePositionSelect(x, y);
                }}
              />
            </div>
          </div>

          {/* 常用位置快捷选择 */}
          <div>
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
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="text-xs text-gray-600">
              <div className="font-medium mb-1">坐标系统说明：</div>
              <div>• 原点(0,0)位于地图左上角</div>
              <div>• X轴向右递增，Y轴向下递增</div>
              <div>• 工位大小：60×40像素</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoordinateHelper;