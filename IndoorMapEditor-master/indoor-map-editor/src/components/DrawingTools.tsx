import React from 'react';
import * as fabric from 'fabric';
import { useEditorStore } from '../stores/editorStore';

// 临时定义接口
interface Position {
  x: number;
  y: number;
}

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

export interface DrawingToolsProps {
  canvas: fabric.Canvas | null;
  currentTool: EditorTool;
}

export class DrawingTools {
  private canvas: fabric.Canvas;
  private isDrawing: boolean = false;
  private currentPolygon: fabric.Polygon | null = null;
  private polygonPoints: Position[] = [];
  private tempLine: fabric.Line | null = null;

  constructor(canvas: fabric.Canvas) {
    this.canvas = canvas;
  }

  // 开始绘制房间（多边形）
  startRoomDrawing(pointer: fabric.Point) {
    if (!this.isDrawing) {
      this.isDrawing = true;
      this.polygonPoints = [{ x: pointer.x, y: pointer.y }];
    } else {
      // 添加新的点
      this.polygonPoints.push({ x: pointer.x, y: pointer.y });
      
      // 移除临时线条
      if (this.tempLine) {
        this.canvas.remove(this.tempLine);
        this.tempLine = null;
      }
      
      // 如果点击的是起始点附近，完成多边形绘制
      const firstPoint = this.polygonPoints[0];
      const distance = Math.sqrt(
        Math.pow(pointer.x - firstPoint.x, 2) + Math.pow(pointer.y - firstPoint.y, 2)
      );
      
      if (distance < 10 && this.polygonPoints.length >= 3) {
        this.finishRoomDrawing();
      }
    }
  }

  // 鼠标移动时更新临时线条
  updateRoomDrawing(pointer: fabric.Point) {
    if (this.isDrawing && this.polygonPoints.length > 0) {
      // 移除之前的临时线条
      if (this.tempLine) {
        this.canvas.remove(this.tempLine);
      }
      
      const lastPoint = this.polygonPoints[this.polygonPoints.length - 1];
      this.tempLine = new fabric.Line(
        [lastPoint.x, lastPoint.y, pointer.x, pointer.y],
        {
          stroke: '#1890ff',
          strokeWidth: 2,
          strokeDashArray: [5, 5],
          selectable: false,
          evented: false
        }
      );
      
      this.canvas.add(this.tempLine);
      this.canvas.renderAll();
    }
  }

  // 完成房间绘制
  finishRoomDrawing() {
    if (this.polygonPoints.length >= 3) {
      // 移除临时线条
      if (this.tempLine) {
        this.canvas.remove(this.tempLine);
        this.tempLine = null;
      }
      
      // 创建多边形
      const polygon = new fabric.Polygon(this.polygonPoints, {
        fill: 'rgba(24, 144, 255, 0.1)',
        stroke: '#1890ff',
        strokeWidth: 2,
        selectable: true,
        evented: true,
        objectCaching: false
      });
      
      // 添加自定义属性
      (polygon as any).roomData = {
        id: `room_${Date.now()}`,
        name: `房间 ${this.canvas.getObjects().filter(obj => (obj as any).roomData).length + 1}`,
        category: 'office',
        area: this.calculatePolygonArea(this.polygonPoints),
        properties: {}
      };
      
      this.canvas.add(polygon);
      this.canvas.setActiveObject(polygon);
      this.canvas.renderAll();
    }
    
    this.resetDrawing();
  }

  // 取消房间绘制
  cancelRoomDrawing() {
    if (this.tempLine) {
      this.canvas.remove(this.tempLine);
      this.tempLine = null;
    }
    this.resetDrawing();
  }

  // 添加点位
  addPoint(pointer: fabric.Point, pointType: string = 'general') {
    const point = new fabric.Circle({
      left: pointer.x - 5,
      top: pointer.y - 5,
      radius: 5,
      fill: this.getPointColor(pointType),
      stroke: '#fff',
      strokeWidth: 2,
      selectable: true,
      evented: true,
      originX: 'center',
      originY: 'center'
    });
    
    // 添加自定义属性
    (point as any).pointData = {
      id: `point_${Date.now()}`,
      name: `点位 ${this.canvas.getObjects().filter(obj => (obj as any).pointData).length + 1}`,
      type: pointType,
      position: { x: pointer.x, y: pointer.y },
      properties: {}
    };
    
    this.canvas.add(point);
    this.canvas.setActiveObject(point);
    this.canvas.renderAll();
  }

  // 绘制墙体
  drawWall(startPoint: fabric.Point, endPoint: fabric.Point) {
    const wall = new fabric.Line(
      [startPoint.x, startPoint.y, endPoint.x, endPoint.y],
      {
        stroke: '#8c8c8c',
        strokeWidth: 8,
        selectable: true,
        evented: true,
        strokeLineCap: 'round'
      }
    );
    
    // 添加自定义属性
    (wall as any).wallData = {
      id: `wall_${Date.now()}`,
      name: `墙体 ${this.canvas.getObjects().filter(obj => (obj as any).wallData).length + 1}`,
      thickness: 8,
      material: 'concrete',
      properties: {}
    };
    
    this.canvas.add(wall);
    this.canvas.setActiveObject(wall);
    this.canvas.renderAll();
  }

  // 重置绘制状态
  resetDrawing() {
    this.isDrawing = false;
    this.polygonPoints = [];
    this.currentPolygon = null;
    if (this.tempLine) {
      this.canvas.remove(this.tempLine);
      this.tempLine = null;
    }
  }

  // 计算多边形面积
  private calculatePolygonArea(points: Position[]): number {
    let area = 0;
    const n = points.length;
    
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    
    return Math.abs(area) / 2;
  }

  // 获取点位颜色
  private getPointColor(pointType: string): string {
    const colors: { [key: string]: string } = {
      'general': '#1890ff',
      'entrance': '#52c41a',
      'exit': '#f5222d',
      'emergency': '#fa8c16',
      'facility': '#722ed1'
    };
    return colors[pointType] || colors['general'];
  }

  // 获取绘制状态
  getDrawingState() {
    return {
      isDrawing: this.isDrawing,
      polygonPoints: this.polygonPoints,
      pointCount: this.polygonPoints.length
    };
  }
}

export default DrawingTools;