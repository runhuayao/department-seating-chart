import React, { useRef, useEffect, useState } from 'react';

interface IndoorMapEditorProps {
  department: string;
  onSave?: (mapData: any) => void;
  onCancel?: () => void;
  initialData?: any;
  className?: string;
}

interface MapElement {
  id: string;
  type: 'desk' | 'room' | 'wall' | 'door';
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  properties?: Record<string, any>;
}

interface EditorTool {
  id: string;
  name: string;
  icon: string;
  cursor: string;
}

const IndoorMapEditor: React.FC<IndoorMapEditorProps> = ({
  department,
  onSave,
  onCancel,
  initialData,
  className = ""
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedTool, setSelectedTool] = useState<string>('select');
  const [mapElements, setMapElements] = useState<MapElement[]>([]);
  const [selectedElement, setSelectedElement] = useState<MapElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // 编辑工具配置
  const tools: EditorTool[] = [
    { id: 'select', name: '选择', icon: '🔍', cursor: 'default' },
    { id: 'desk', name: '工位', icon: '🪑', cursor: 'crosshair' },
    { id: 'room', name: '房间', icon: '🏠', cursor: 'crosshair' },
    { id: 'wall', name: '墙体', icon: '🧱', cursor: 'crosshair' },
    { id: 'door', name: '门', icon: '🚪', cursor: 'crosshair' },
    { id: 'move', name: '移动', icon: '✋', cursor: 'move' },
    { id: 'delete', name: '删除', icon: '🗑️', cursor: 'not-allowed' }
  ];

  // 初始化画布
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    
    // 设置画布尺寸
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    // 加载初始数据
    if (initialData && initialData.elements) {
      setMapElements(initialData.elements);
    }

    // 绘制网格和元素
    drawCanvas();
  }, [mapElements, selectedElement, scale, offset]);

  // 绘制画布内容
  const drawCanvas = () => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 保存当前状态
    ctx.save();

    // 应用缩放和偏移
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    // 绘制网格
    drawGrid(ctx, canvas.width, canvas.height);

    // 绘制地图元素
    mapElements.forEach(element => {
      drawElement(ctx, element, element === selectedElement);
    });

    // 恢复状态
    ctx.restore();
  };

  // 绘制网格
  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const gridSize = 20;
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 0.5;

    // 垂直线
    for (let x = 0; x <= width / scale; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height / scale);
      ctx.stroke();
    }

    // 水平线
    for (let y = 0; y <= height / scale; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width / scale, y);
      ctx.stroke();
    }
  };

  // 绘制地图元素
  const drawElement = (ctx: CanvasRenderingContext2D, element: MapElement, isSelected: boolean) => {
    ctx.save();

    // 设置样式
    switch (element.type) {
      case 'desk':
        ctx.fillStyle = isSelected ? '#3b82f6' : '#10b981';
        ctx.strokeStyle = '#374151';
        break;
      case 'room':
        ctx.fillStyle = isSelected ? '#dbeafe' : '#f3f4f6';
        ctx.strokeStyle = '#6b7280';
        break;
      case 'wall':
        ctx.fillStyle = '#374151';
        ctx.strokeStyle = '#1f2937';
        break;
      case 'door':
        ctx.fillStyle = '#f59e0b';
        ctx.strokeStyle = '#d97706';
        break;
    }

    ctx.lineWidth = isSelected ? 3 : 1;

    // 绘制矩形
    ctx.fillRect(element.x, element.y, element.width, element.height);
    ctx.strokeRect(element.x, element.y, element.width, element.height);

    // 绘制标签
    if (element.label) {
      ctx.fillStyle = '#1f2937';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(
        element.label,
        element.x + element.width / 2,
        element.y + element.height / 2 + 4
      );
    }

    ctx.restore();
  };

  // 鼠标事件处理
  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left - offset.x) / scale;
    const y = (event.clientY - rect.top - offset.y) / scale;

    if (selectedTool === 'select') {
      // 选择元素
      const clickedElement = findElementAt(x, y);
      setSelectedElement(clickedElement);
    } else if (selectedTool === 'delete') {
      // 删除元素
      const clickedElement = findElementAt(x, y);
      if (clickedElement) {
        setMapElements(prev => prev.filter(el => el.id !== clickedElement.id));
        setSelectedElement(null);
      }
    } else if (['desk', 'room', 'wall', 'door'].includes(selectedTool)) {
      // 开始绘制
      setIsDrawing(true);
      setStartPoint({ x, y });
    }
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !isDrawing || !startPoint) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left - offset.x) / scale;
    const y = (event.clientY - rect.top - offset.y) / scale;

    // 实时预览绘制
    drawCanvas();
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.save();
      ctx.translate(offset.x, offset.y);
      ctx.scale(scale, scale);
      
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(
        Math.min(startPoint.x, x),
        Math.min(startPoint.y, y),
        Math.abs(x - startPoint.x),
        Math.abs(y - startPoint.y)
      );
      
      ctx.restore();
    }
  };

  const handleMouseUp = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !isDrawing || !startPoint) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left - offset.x) / scale;
    const y = (event.clientY - rect.top - offset.y) / scale;

    // 创建新元素
    const width = Math.abs(x - startPoint.x);
    const height = Math.abs(y - startPoint.y);

    if (width > 10 && height > 10) { // 最小尺寸限制
      const newElement: MapElement = {
        id: `${selectedTool}-${Date.now()}`,
        type: selectedTool as MapElement['type'],
        x: Math.min(startPoint.x, x),
        y: Math.min(startPoint.y, y),
        width,
        height,
        label: selectedTool === 'desk' ? `${selectedTool.toUpperCase()}-${mapElements.length + 1}` : undefined,
        properties: {}
      };

      setMapElements(prev => [...prev, newElement]);
    }

    setIsDrawing(false);
    setStartPoint(null);
  };

  // 查找指定位置的元素
  const findElementAt = (x: number, y: number): MapElement | null => {
    for (let i = mapElements.length - 1; i >= 0; i--) {
      const element = mapElements[i];
      if (
        x >= element.x &&
        x <= element.x + element.width &&
        y >= element.y &&
        y <= element.y + element.height
      ) {
        return element;
      }
    }
    return null;
  };

  // 缩放控制
  const handleZoom = (delta: number) => {
    const newScale = Math.max(0.1, Math.min(3, scale + delta));
    setScale(newScale);
  };

  // 保存地图数据
  const handleSave = () => {
    const mapData = {
      department,
      elements: mapElements,
      metadata: {
        scale,
        offset,
        createdAt: new Date().toISOString(),
        version: '1.0'
      }
    };
    onSave?.(mapData);
  };

  // 导出SVG
  const exportToSVG = () => {
    const svgContent = `
      <svg width="800" height="600" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <style>
            .desk { fill: #10b981; stroke: #374151; stroke-width: 1; }
            .room { fill: #f3f4f6; stroke: #6b7280; stroke-width: 1; }
            .wall { fill: #374151; stroke: #1f2937; stroke-width: 1; }
            .door { fill: #f59e0b; stroke: #d97706; stroke-width: 1; }
            .label { font-family: Arial, sans-serif; font-size: 12px; fill: #1f2937; text-anchor: middle; }
          </style>
        </defs>
        ${mapElements.map(element => `
          <rect 
            x="${element.x}" 
            y="${element.y}" 
            width="${element.width}" 
            height="${element.height}" 
            class="${element.type}"
          />
          ${element.label ? `
            <text 
              x="${element.x + element.width / 2}" 
              y="${element.y + element.height / 2 + 4}" 
              class="label"
            >${element.label}</text>
          ` : ''}
        `).join('')}
      </svg>
    `;

    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${department}-map.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* 工具栏 */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h3 className="text-lg font-semibold text-gray-800">
              {department} 地图编辑器
            </h3>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleZoom(-0.1)}
              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm"
            >
              缩小
            </button>
            <span className="text-sm text-gray-600">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => handleZoom(0.1)}
              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm"
            >
              放大
            </button>
            
            <div className="border-l border-gray-300 pl-2 ml-2">
              <button
                onClick={exportToSVG}
                className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-sm"
              >
                导出SVG
              </button>
              <button
                onClick={handleSave}
                className="ml-2 px-3 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded text-sm"
              >
                保存
              </button>
              <button
                onClick={onCancel}
                className="ml-2 px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm"
              >
                取消
              </button>
            </div>
          </div>
        </div>

        {/* 工具选择 */}
        <div className="flex items-center space-x-2 mt-3">
          {tools.map(tool => (
            <button
              key={tool.id}
              onClick={() => setSelectedTool(tool.id)}
              className={`flex items-center space-x-1 px-3 py-2 rounded text-sm transition-colors ${
                selectedTool === tool.id
                  ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
              title={tool.name}
            >
              <span>{tool.icon}</span>
              <span>{tool.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 编辑区域 */}
      <div className="flex-1 flex">
        {/* 画布容器 */}
        <div 
          ref={containerRef}
          className="flex-1 relative overflow-hidden"
          style={{ cursor: tools.find(t => t.id === selectedTool)?.cursor || 'default' }}
        >
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className="absolute inset-0 bg-white"
          />
        </div>

        {/* 属性面板 */}
        <div className="w-64 bg-gray-50 border-l border-gray-200 p-4">
          <h4 className="font-semibold text-gray-800 mb-3">属性面板</h4>
          
          {selectedElement ? (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  类型
                </label>
                <input
                  type="text"
                  value={selectedElement.type}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  标签
                </label>
                <input
                  type="text"
                  value={selectedElement.label || ''}
                  onChange={(e) => {
                    const updatedElements = mapElements.map(el =>
                      el.id === selectedElement.id
                        ? { ...el, label: e.target.value }
                        : el
                    );
                    setMapElements(updatedElements);
                    setSelectedElement({ ...selectedElement, label: e.target.value });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    X
                  </label>
                  <input
                    type="number"
                    value={Math.round(selectedElement.x)}
                    onChange={(e) => {
                      const newX = parseInt(e.target.value) || 0;
                      const updatedElements = mapElements.map(el =>
                        el.id === selectedElement.id
                          ? { ...el, x: newX }
                          : el
                      );
                      setMapElements(updatedElements);
                      setSelectedElement({ ...selectedElement, x: newX });
                    }}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Y
                  </label>
                  <input
                    type="number"
                    value={Math.round(selectedElement.y)}
                    onChange={(e) => {
                      const newY = parseInt(e.target.value) || 0;
                      const updatedElements = mapElements.map(el =>
                        el.id === selectedElement.id
                          ? { ...el, y: newY }
                          : el
                      );
                      setMapElements(updatedElements);
                      setSelectedElement({ ...selectedElement, y: newY });
                    }}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    宽度
                  </label>
                  <input
                    type="number"
                    value={Math.round(selectedElement.width)}
                    onChange={(e) => {
                      const newWidth = parseInt(e.target.value) || 1;
                      const updatedElements = mapElements.map(el =>
                        el.id === selectedElement.id
                          ? { ...el, width: newWidth }
                          : el
                      );
                      setMapElements(updatedElements);
                      setSelectedElement({ ...selectedElement, width: newWidth });
                    }}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    高度
                  </label>
                  <input
                    type="number"
                    value={Math.round(selectedElement.height)}
                    onChange={(e) => {
                      const newHeight = parseInt(e.target.value) || 1;
                      const updatedElements = mapElements.map(el =>
                        el.id === selectedElement.id
                          ? { ...el, height: newHeight }
                          : el
                      );
                      setMapElements(updatedElements);
                      setSelectedElement({ ...selectedElement, height: newHeight });
                    }}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              选择一个元素来编辑其属性
            </div>
          )}

          {/* 统计信息 */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <h5 className="font-medium text-gray-700 mb-2">统计信息</h5>
            <div className="text-sm text-gray-600 space-y-1">
              <div>总元素: {mapElements.length}</div>
              <div>工位: {mapElements.filter(el => el.type === 'desk').length}</div>
              <div>房间: {mapElements.filter(el => el.type === 'room').length}</div>
              <div>墙体: {mapElements.filter(el => el.type === 'wall').length}</div>
              <div>门: {mapElements.filter(el => el.type === 'door').length}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IndoorMapEditor;