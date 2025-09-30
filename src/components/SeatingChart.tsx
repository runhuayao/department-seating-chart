import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Move, RotateCw, Copy, Trash2, Square, Circle, Triangle } from 'lucide-react';

// Figma设计规范中的座位类型
interface SeatType {
  id: string;
  name: string;
  type: 'single-chair' | 'desk-chair' | 'table-group' | 'couch' | 'special';
  color: 'blue' | 'violet' | 'orange' | 'green' | 'red' | 'grey';
  width: number;
  height: number;
  shape: 'rectangle' | 'circle' | 'triangle' | 'trapezoid' | 'arc';
}

// 座位实例接口
interface SeatInstance {
  id: string;
  seatTypeId: string;
  x: number;
  y: number;
  rotation: number;
  color: SeatType['color'];
  label?: string;
  assignedUser?: string;
  status: 'available' | 'occupied' | 'maintenance' | 'reserved';
}

// 编辑工具类型
type EditTool = 'select' | 'move' | 'rotate' | 'duplicate' | 'delete' | 'add-seat';

interface SeatingChartProps {
  department: string;
  width?: number;
  height?: number;
  editable?: boolean;
  onSeatClick?: (seat: SeatInstance) => void;
  onLayoutChange?: (seats: SeatInstance[]) => void;
}

// Figma设计规范中的座位类型定义
const SEAT_TYPES: SeatType[] = [
  // 单人椅子
  { id: 'single-chair-blue', name: '单人椅', type: 'single-chair', color: 'blue', width: 40, height: 40, shape: 'rectangle' },
  { id: 'single-chair-violet', name: '单人椅', type: 'single-chair', color: 'violet', width: 40, height: 40, shape: 'rectangle' },
  
  // 桌椅组合
  { id: 'desk-chair-rect-blue', name: '矩形桌椅', type: 'desk-chair', color: 'blue', width: 80, height: 60, shape: 'rectangle' },
  { id: 'desk-chair-rect-violet', name: '矩形桌椅', type: 'desk-chair', color: 'violet', width: 80, height: 60, shape: 'rectangle' },
  { id: 'desk-chair-round-blue', name: '圆形桌椅', type: 'desk-chair', color: 'blue', width: 70, height: 70, shape: 'circle' },
  { id: 'desk-chair-round-violet', name: '圆形桌椅', type: 'desk-chair', color: 'violet', width: 70, height: 70, shape: 'circle' },
  
  // 桌子组合
  { id: 'table-group-arc-blue', name: '弧形桌组', type: 'table-group', color: 'blue', width: 120, height: 80, shape: 'arc' },
  { id: 'table-group-circle-blue', name: '圆桌组', type: 'table-group', color: 'blue', width: 100, height: 100, shape: 'circle' },
  { id: 'table-group-square-blue', name: '方桌组', type: 'table-group', color: 'blue', width: 90, height: 90, shape: 'rectangle' },
  
  // 沙发和休息区
  { id: 'couch-three-blue', name: '三人沙发', type: 'couch', color: 'blue', width: 120, height: 50, shape: 'rectangle' },
  { id: 'beanbag-violet', name: '豆袋椅', type: 'special', color: 'violet', width: 50, height: 50, shape: 'circle' },
];

// 颜色映射
const COLOR_MAP = {
  blue: '#3B82F6',
  violet: '#8B5CF6', 
  orange: '#F97316',
  green: '#10B981',
  red: '#EF4444',
  grey: '#6B7280'
};

const SeatingChart: React.FC<SeatingChartProps> = ({
  department,
  width = 800,
  height = 600,
  editable = false,
  onSeatClick,
  onLayoutChange
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [seats, setSeats] = useState<SeatInstance[]>([]);
  const [selectedSeat, setSelectedSeat] = useState<SeatInstance | null>(null);
  const [currentTool, setCurrentTool] = useState<EditTool>('select');
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showLibrary, setShowLibrary] = useState(false);

  // 初始化座位数据
  useEffect(() => {
    loadSeatingData();
  }, [department]);

  // 加载座位数据
  const loadSeatingData = async () => {
    try {
      // 从API获取工位数据并转换为座位实例
      const response = await fetch(`/api/workstations?department=${department}`);
      const workstations = await response.json();
      
      const seatInstances: SeatInstance[] = workstations.map((ws: any, index: number) => ({
        id: ws.id || `seat-${index}`,
        seatTypeId: 'desk-chair-rect-blue',
        x: ws.location?.position?.x || (100 + (index % 6) * 120),
        y: ws.location?.position?.y || (100 + Math.floor(index / 6) * 80),
        rotation: 0,
        color: ws.status === 'occupied' ? 'green' : 'blue',
        label: ws.name,
        assignedUser: ws.assignedUser,
        status: ws.status || 'available'
      }));
      
      setSeats(seatInstances);
    } catch (error) {
      console.error('加载座位数据失败:', error);
      // 使用默认数据
      setSeats([]);
    }
  };

  // 绘制座位
  const drawSeat = useCallback((ctx: CanvasRenderingContext2D, seat: SeatInstance) => {
    const seatType = SEAT_TYPES.find(t => t.id === seat.seatTypeId);
    if (!seatType) return;

    ctx.save();
    ctx.translate(seat.x + seatType.width / 2, seat.y + seatType.height / 2);
    ctx.rotate((seat.rotation * Math.PI) / 180);
    ctx.translate(-seatType.width / 2, -seatType.height / 2);

    // 设置颜色
    const color = COLOR_MAP[seat.color];
    ctx.fillStyle = color;
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 2;

    // 根据形状绘制
    switch (seatType.shape) {
      case 'rectangle':
        ctx.fillRect(0, 0, seatType.width, seatType.height);
        ctx.strokeRect(0, 0, seatType.width, seatType.height);
        break;
      case 'circle':
        ctx.beginPath();
        ctx.arc(seatType.width / 2, seatType.height / 2, seatType.width / 2, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        break;
      case 'triangle':
        ctx.beginPath();
        ctx.moveTo(seatType.width / 2, 0);
        ctx.lineTo(0, seatType.height);
        ctx.lineTo(seatType.width, seatType.height);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
    }

    // 绘制标签
    if (seat.label) {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(seat.label, seatType.width / 2, seatType.height / 2 + 4);
    }

    // 绘制选中状态
    if (selectedSeat?.id === seat.id) {
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(-5, -5, seatType.width + 10, seatType.height + 10);
      ctx.setLineDash([]);
    }

    ctx.restore();
  }, [selectedSeat]);

  // 重绘画布
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 清空画布
    ctx.clearRect(0, 0, width, height);

    // 绘制网格 (编辑模式)
    if (editable) {
      ctx.strokeStyle = '#E5E7EB';
      ctx.lineWidth = 1;
      const gridSize = 20;
      
      for (let x = 0; x <= width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      
      for (let y = 0; y <= height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }

    // 绘制所有座位
    seats.forEach(seat => drawSeat(ctx, seat));
  }, [seats, selectedSeat, width, height, editable, drawSeat]);

  // 画布重绘
  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // 鼠标事件处理
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!editable) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // 查找点击的座位
    const clickedSeat = seats.find(seat => {
      const seatType = SEAT_TYPES.find(t => t.id === seat.seatTypeId);
      if (!seatType) return false;
      
      return x >= seat.x && x <= seat.x + seatType.width &&
             y >= seat.y && y <= seat.y + seatType.height;
    });

    if (clickedSeat) {
      setSelectedSeat(clickedSeat);
      if (currentTool === 'move') {
        setIsDragging(true);
        setDragOffset({
          x: x - clickedSeat.x,
          y: y - clickedSeat.y
        });
      }
      onSeatClick?.(clickedSeat);
    } else {
      setSelectedSeat(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !selectedSeat) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - dragOffset.x;
    const y = e.clientY - rect.top - dragOffset.y;

    // 网格对齐
    const gridSize = 20;
    const snappedX = Math.round(x / gridSize) * gridSize;
    const snappedY = Math.round(y / gridSize) * gridSize;

    // 更新座位位置
    setSeats(prev => prev.map(seat => 
      seat.id === selectedSeat.id 
        ? { ...seat, x: snappedX, y: snappedY }
        : seat
    ));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (onLayoutChange) {
      onLayoutChange(seats);
    }
  };

  // 工具栏操作
  const handleDuplicate = () => {
    if (!selectedSeat) return;
    
    const newSeat: SeatInstance = {
      ...selectedSeat,
      id: `seat-${Date.now()}`,
      x: selectedSeat.x + 20,
      y: selectedSeat.y + 20
    };
    
    setSeats(prev => [...prev, newSeat]);
    setSelectedSeat(newSeat);
  };

  const handleDelete = () => {
    if (!selectedSeat) return;
    
    setSeats(prev => prev.filter(seat => seat.id !== selectedSeat.id));
    setSelectedSeat(null);
  };

  const handleRotate = () => {
    if (!selectedSeat) return;
    
    setSeats(prev => prev.map(seat =>
      seat.id === selectedSeat.id
        ? { ...seat, rotation: (seat.rotation + 90) % 360 }
        : seat
    ));
  };

  const addSeat = (seatTypeId: string, x: number = 100, y: number = 100) => {
    const newSeat: SeatInstance = {
      id: `seat-${Date.now()}`,
      seatTypeId,
      x,
      y,
      rotation: 0,
      color: 'blue',
      status: 'available'
    };
    
    setSeats(prev => [...prev, newSeat]);
    setSelectedSeat(newSeat);
  };

  return (
    <div className="seating-chart-container relative">
      {/* 工具栏 */}
      {editable && (
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-2 z-10">
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentTool('select')}
              className={`p-2 rounded ${currentTool === 'select' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
              title="选择"
            >
              <Move size={16} />
            </button>
            <button
              onClick={() => setCurrentTool('move')}
              className={`p-2 rounded ${currentTool === 'move' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
              title="移动"
            >
              <Move size={16} />
            </button>
            <button
              onClick={handleRotate}
              disabled={!selectedSeat}
              className="p-2 rounded hover:bg-gray-100 disabled:opacity-50"
              title="旋转"
            >
              <RotateCw size={16} />
            </button>
            <button
              onClick={handleDuplicate}
              disabled={!selectedSeat}
              className="p-2 rounded hover:bg-gray-100 disabled:opacity-50"
              title="复制"
            >
              <Copy size={16} />
            </button>
            <button
              onClick={handleDelete}
              disabled={!selectedSeat}
              className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 text-red-600"
              title="删除"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      )}

      {/* 座位库 */}
      {editable && (
        <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 z-10 w-64">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-gray-800">座位库</h3>
            <button
              onClick={() => setShowLibrary(!showLibrary)}
              className="text-gray-500 hover:text-gray-700"
            >
              {showLibrary ? '收起' : '展开'}
            </button>
          </div>
          
          {showLibrary && (
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
              {SEAT_TYPES.map(seatType => (
                <button
                  key={seatType.id}
                  onClick={() => addSeat(seatType.id)}
                  className="p-2 border border-gray-200 rounded hover:bg-gray-50 text-xs"
                  style={{ backgroundColor: COLOR_MAP[seatType.color] + '20' }}
                >
                  <div className="text-center">
                    <div className="mb-1">
                      {seatType.shape === 'rectangle' && <Square size={16} className="mx-auto" />}
                      {seatType.shape === 'circle' && <Circle size={16} className="mx-auto" />}
                      {seatType.shape === 'triangle' && <Triangle size={16} className="mx-auto" />}
                    </div>
                    <div>{seatType.name}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 主画布 */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="border border-gray-300 bg-white cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{ cursor: currentTool === 'move' ? 'move' : 'default' }}
      />

      {/* 座位详情面板 */}
      {selectedSeat && (
        <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 z-10 min-w-48">
          <h4 className="font-semibold text-gray-800 mb-2">座位详情</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">标签:</span>
              <span className="font-medium">{selectedSeat.label || '未命名'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">状态:</span>
              <span className={`font-medium ${
                selectedSeat.status === 'occupied' ? 'text-green-600' : 
                selectedSeat.status === 'maintenance' ? 'text-red-600' : 'text-blue-600'
              }`}>
                {selectedSeat.status === 'occupied' ? '已占用' : 
                 selectedSeat.status === 'maintenance' ? '维护中' : '可用'}
              </span>
            </div>
            {selectedSeat.assignedUser && (
              <div className="flex justify-between">
                <span className="text-gray-600">分配给:</span>
                <span className="font-medium text-green-600">{selectedSeat.assignedUser}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">位置:</span>
              <span className="font-medium">({selectedSeat.x}, {selectedSeat.y})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">旋转:</span>
              <span className="font-medium">{selectedSeat.rotation}°</span>
            </div>
          </div>
        </div>
      )}

      {/* 状态栏 */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-md p-2 text-sm text-gray-600">
        <div>总座位: {seats.length}</div>
        <div>已占用: {seats.filter(s => s.status === 'occupied').length}</div>
        <div>可用: {seats.filter(s => s.status === 'available').length}</div>
      </div>
    </div>
  );
};

export default SeatingChart;