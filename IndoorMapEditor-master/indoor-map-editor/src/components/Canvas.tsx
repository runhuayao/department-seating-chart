import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import * as fabric from 'fabric';
import { useEditorStore } from '../stores/editorStore';

// 临时定义EditorTool枚举
enum EditorTool {
  SELECT = 'select',
  DRAW_ROOM = 'draw_room',
  ADD_POINT = 'add_point',
  DRAW_WALL = 'draw_wall',
  SPLIT = 'split',
  MERGE = 'merge',
  ZOOM = 'zoom',
  PAN = 'pan'
}
import DrawingTools from './DrawingTools';

interface CanvasProps {
  width?: number;
  height?: number;
  className?: string;
}

const Canvas = forwardRef<fabric.Canvas | null, CanvasProps>(({ 
  width = 800, 
  height = 600, 
  className = '' 
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const drawingToolsRef = useRef<DrawingTools | null>(null);
  
  // 暴露canvas实例给父组件
  useImperativeHandle(ref, () => fabricCanvasRef.current, []);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const {
    currentTool,
    selectedObjects,
    canvasZoom,
    canvasOffset,
    setSelectedObjects,
    setCanvasZoom,
    setCanvasOffset
  } = useEditorStore();

  // 初始化Fabric.js画布
  useEffect(() => {
    if (canvasRef.current && !fabricCanvasRef.current && !isInitialized) {
      const canvas = new fabric.Canvas(canvasRef.current, {
        width,
        height,
        backgroundColor: '#ffffff',
        selection: true,
        preserveObjectStacking: true,
        renderOnAddRemove: true,
        stateful: true,
        fireRightClick: true,
        stopContextMenu: true,
      });

      // 设置画布网格背景
      const gridSize = 20;
      const gridOptions = {
        distance: gridSize,
        width: width,
        height: height,
        param: {
          stroke: '#e0e0e0',
          strokeWidth: 1,
          selectable: false,
          evented: false,
        }
      };

      // 创建网格
      const createGrid = () => {
        const grid = [];
        
        // 垂直线
        for (let i = 0; i <= width / gridSize; i++) {
          const line = new fabric.Line([
            i * gridSize, 0,
            i * gridSize, height
          ], {
            stroke: '#e0e0e0',
            strokeWidth: 0.5,
            selectable: false,
            evented: false,
            excludeFromExport: true
          });
          grid.push(line);
        }
        
        // 水平线
        for (let i = 0; i <= height / gridSize; i++) {
          const line = new fabric.Line([
            0, i * gridSize,
            width, i * gridSize
          ], {
            stroke: '#e0e0e0',
            strokeWidth: 0.5,
            selectable: false,
            evented: false,
            excludeFromExport: true
          });
          grid.push(line);
        }
        
        return grid;
      };

      // 添加网格到画布
      const gridLines = createGrid();
      gridLines.forEach(line => {
        canvas.add(line);
        canvas.sendToBack(line);
      });

      // 初始化绘制工具
      drawingToolsRef.current = new DrawingTools(canvas);
      
      // 设置画布事件监听
      setupCanvasEvents(canvas);
      
      fabricCanvasRef.current = canvas;
      setIsInitialized(true);
    }

    return () => {
      if (drawingToolsRef.current) {
        drawingToolsRef.current.resetDrawing();
        drawingToolsRef.current = null;
      }
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
      setIsInitialized(false);
    };
  }, []);

  // 设置画布事件
  const setupCanvasEvents = (canvas: fabric.Canvas) => {
    // 选择事件
    canvas.on('selection:created', (e) => {
      const activeObjects = canvas.getActiveObjects();
      setSelectedObjects(activeObjects.map(obj => obj.toObject()));
    });

    canvas.on('selection:updated', (e) => {
      const activeObjects = canvas.getActiveObjects();
      setSelectedObjects(activeObjects.map(obj => obj.toObject()));
    });

    canvas.on('selection:cleared', () => {
      setSelectedObjects([]);
    });

    // 鼠标事件
    canvas.on('mouse:down', (e) => {
      handleMouseDown(e, canvas);
    });

    canvas.on('mouse:move', (e) => {
      handleMouseMove(e, canvas);
    });

    canvas.on('mouse:up', (e) => {
      handleMouseUp(e, canvas);
    });

    // 缩放事件
    canvas.on('mouse:wheel', (opt) => {
      const delta = opt.e.deltaY;
      let zoom = canvas.getZoom();
      zoom *= 0.999 ** delta;
      if (zoom > 20) zoom = 20;
      if (zoom < 0.01) zoom = 0.01;
      
      canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
      setCanvasZoom(zoom);
      
      opt.e.preventDefault();
      opt.e.stopPropagation();
    });
  };

  // 鼠标按下事件处理
  const handleMouseDown = (e: fabric.IEvent, canvas: fabric.Canvas) => {
    const pointer = canvas.getPointer(e.e as MouseEvent);
    
    if (!drawingToolsRef.current) return;
    
    switch (currentTool) {
      case EditorTool.SELECT:
        // 选择工具的默认行为
        break;
        
      case EditorTool.DRAW_ROOM:
        drawingToolsRef.current.startRoomDrawing(pointer);
        break;
        
      case EditorTool.ADD_POINT:
        drawingToolsRef.current.addPoint(pointer);
        break;
        
      case EditorTool.DRAW_WALL:
        // 墙体绘制需要起始点和结束点，这里先存储起始点
        if (!(canvas as any).wallStartPoint) {
          (canvas as any).wallStartPoint = pointer;
        } else {
          drawingToolsRef.current.drawWall((canvas as any).wallStartPoint, pointer);
          delete (canvas as any).wallStartPoint;
        }
        break;
        
      default:
        break;
    }
  };

  // 鼠标移动事件处理
  const handleMouseMove = (e: fabric.IEvent, canvas: fabric.Canvas) => {
    const pointer = canvas.getPointer(e.e as MouseEvent);
    
    if (!drawingToolsRef.current) return;
    
    // 房间绘制时显示临时线条
    if (currentTool === EditorTool.DRAW_ROOM) {
      drawingToolsRef.current.updateRoomDrawing(pointer);
    }
  };

  // 鼠标释放事件处理
  const handleMouseUp = (e: fabric.IEvent, canvas: fabric.Canvas) => {
    // 鼠标抬起时的处理逻辑
  };



  // 缩放控制
  useEffect(() => {
    if (fabricCanvasRef.current && isInitialized) {
      fabricCanvasRef.current.setZoom(canvasZoom);
      fabricCanvasRef.current.renderAll();
    }
  }, [canvasZoom, isInitialized]);

  // 偏移控制
  useEffect(() => {
    if (fabricCanvasRef.current && isInitialized) {
      fabricCanvasRef.current.relativePan({
        x: canvasOffset.x,
        y: canvasOffset.y
      });
      fabricCanvasRef.current.renderAll();
    }
  }, [canvasOffset, isInitialized]);

  // 工具切换时的处理
  useEffect(() => {
    if (fabricCanvasRef.current && isInitialized) {
      const canvas = fabricCanvasRef.current;
      
      // 当工具切换时重置绘制状态
      if (drawingToolsRef.current) {
        drawingToolsRef.current.resetDrawing();
        // 清除墙体绘制的起始点
        delete (canvas as any).wallStartPoint;
      }
      
      // 根据工具设置画布状态
      switch (currentTool) {
        case EditorTool.SELECT:
          canvas.selection = true;
          canvas.defaultCursor = 'default';
          canvas.hoverCursor = 'move';
          break;
          
        case EditorTool.DRAW_ROOM:
        case EditorTool.ADD_POINT:
        case EditorTool.DRAW_WALL:
          canvas.selection = false;
          canvas.defaultCursor = 'crosshair';
          canvas.hoverCursor = 'crosshair';
          break;
          
        default:
          canvas.selection = true;
          canvas.defaultCursor = 'default';
          break;
      }
      
      canvas.renderAll();
    }
  }, [currentTool, isInitialized]);

  // 公共方法
  const getCanvas = () => fabricCanvasRef.current;
  
  const clearCanvas = () => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.clear();
    }
  };
  
  const exportCanvas = () => {
    if (fabricCanvasRef.current) {
      return fabricCanvasRef.current.toJSON();
    }
    return null;
  };
  
  const importCanvas = (data: any) => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.loadFromJSON(data, () => {
        fabricCanvasRef.current?.renderAll();
      });
    }
  };

  return (
    <div className={`canvas-container ${className}`}>
      <canvas 
        ref={canvasRef}
        className="fabric-canvas"
      />
    </div>
  );
});

Canvas.displayName = 'Canvas';

export default Canvas;