import React, { useState, useEffect } from 'react';
import { Save, Download, Upload, Undo, Redo, Grid, Eye, Settings } from 'lucide-react';
import SeatingChart from './SeatingChart';

interface FigmaSeatingEditorProps {
  department: string;
  onSave?: (layoutData: any) => void;
  onExport?: (format: 'svg' | 'png' | 'pdf') => void;
}

// Figma风格的编辑器界面
const FigmaSeatingEditor: React.FC<FigmaSeatingEditorProps> = ({
  department,
  onSave,
  onExport
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [layoutData, setLayoutData] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isDirty, setIsDirty] = useState(false);

  // 保存布局数据
  const handleSave = async () => {
    if (!layoutData) return;
    
    try {
      const response = await fetch(`/api/departments/${department}/seating-layout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          department,
          layout: layoutData,
          timestamp: new Date().toISOString()
        })
      });
      
      if (response.ok) {
        setIsDirty(false);
        onSave?.(layoutData);
        console.log('座位布局保存成功');
      }
    } catch (error) {
      console.error('保存座位布局失败:', error);
    }
  };

  // 导出功能
  const handleExport = (format: 'svg' | 'png' | 'pdf') => {
    onExport?.(format);
    
    // 基于Figma的导出逻辑
    const exportData = {
      format,
      department,
      layout: layoutData,
      metadata: {
        exportTime: new Date().toISOString(),
        version: '1.0.0',
        source: 'Figma Seating Editor'
      }
    };
    
    // 创建下载链接
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${department}-seating-layout.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 撤销/重做功能
  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setLayoutData(history[historyIndex - 1]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setLayoutData(history[historyIndex + 1]);
    }
  };

  // 布局变更处理
  const handleLayoutChange = (seats: any[]) => {
    const newLayoutData = {
      department,
      seats,
      timestamp: new Date().toISOString()
    };
    
    setLayoutData(newLayoutData);
    setIsDirty(true);
    
    // 添加到历史记录
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newLayoutData);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  return (
    <div className="figma-seating-editor h-full flex flex-col bg-gray-50">
      {/* Figma风格的顶部工具栏 */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-semibold text-gray-800">
            {department} - 座位图编辑器
          </h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                isEditing 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {isEditing ? '编辑模式' : '查看模式'}
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* 撤销/重做 */}
          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-50"
            title="撤销"
          >
            <Undo size={16} />
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-50"
            title="重做"
          >
            <Redo size={16} />
          </button>

          {/* 视图控制 */}
          <div className="border-l border-gray-200 pl-2 ml-2">
            <button
              onClick={() => setShowGrid(!showGrid)}
              className={`p-2 rounded ${showGrid ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
              title="显示网格"
            >
              <Grid size={16} />
            </button>
            <button
              className="p-2 rounded hover:bg-gray-100"
              title="预览模式"
            >
              <Eye size={16} />
            </button>
          </div>

          {/* 缩放控制 */}
          <div className="flex items-center space-x-2 border-l border-gray-200 pl-2 ml-2">
            <button
              onClick={() => setZoomLevel(Math.max(25, zoomLevel - 25))}
              className="px-2 py-1 text-sm hover:bg-gray-100 rounded"
            >
              -
            </button>
            <span className="text-sm font-medium w-12 text-center">{zoomLevel}%</span>
            <button
              onClick={() => setZoomLevel(Math.min(200, zoomLevel + 25))}
              className="px-2 py-1 text-sm hover:bg-gray-100 rounded"
            >
              +
            </button>
          </div>

          {/* 保存和导出 */}
          <div className="border-l border-gray-200 pl-2 ml-2 flex space-x-2">
            <button
              onClick={handleSave}
              disabled={!isDirty}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              <Save size={14} className="inline mr-1" />
              保存
            </button>
            
            <div className="relative group">
              <button className="p-2 rounded hover:bg-gray-100" title="导出">
                <Download size={16} />
              </button>
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                <button
                  onClick={() => handleExport('svg')}
                  className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                >
                  导出为 SVG
                </button>
                <button
                  onClick={() => handleExport('png')}
                  className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                >
                  导出为 PNG
                </button>
                <button
                  onClick={() => handleExport('pdf')}
                  className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                >
                  导出为 PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 主编辑区域 */}
      <div className="flex-1 relative overflow-hidden">
        <div 
          className="absolute inset-0 flex items-center justify-center"
          style={{ 
            transform: `scale(${zoomLevel / 100})`,
            transformOrigin: 'center center'
          }}
        >
          <SeatingChart
            department={department}
            width={800}
            height={600}
            editable={isEditing}
            onLayoutChange={handleLayoutChange}
          />
        </div>
      </div>

      {/* 底部状态栏 */}
      <div className="bg-white border-t border-gray-200 px-4 py-2 flex items-center justify-between text-sm text-gray-600">
        <div className="flex items-center space-x-4">
          <span>部门: {department}</span>
          <span>缩放: {zoomLevel}%</span>
          <span>模式: {isEditing ? '编辑' : '查看'}</span>
          {isDirty && <span className="text-orange-600">● 未保存</span>}
        </div>
        
        <div className="flex items-center space-x-4">
          <span>基于 Figma 设计规范</span>
          <button className="hover:text-gray-800">
            <Settings size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FigmaSeatingEditor;