import React, { useRef } from 'react';
import { Button, Modal, Space, App } from 'antd';
import { DownloadOutlined, UploadOutlined, SaveOutlined } from '@ant-design/icons';
import * as fabric from 'fabric';
import { useEditorStore } from '../stores/editorStore';

// 临时定义类型接口
interface Position {
  x: number;
  y: number;
}

interface Room {
  id: string;
  name: string;
  category: number;
  area: number;
  points: Position[];
  properties?: Record<string, any>;
}

interface PublicPoint {
  id: string;
  name: string;
  position: Position;
  type: string;
  properties?: Record<string, any>;
}

interface Floor {
  id: string;
  name: string;
  level: number;
  rooms: Room[];
  publicPoints: PublicPoint[];
  backgroundImage?: string;
  scale: number;
  offset: Position;
}

interface Building {
  id: string;
  name: string;
  address: string;
  floors: Floor[];
}

interface MapData {
  version: string;
  building: Building;
  metadata: {
    createdAt: string;
    updatedAt: string;
    author: string;
  };
}

interface DataManagerProps {
  canvas: fabric.Canvas | null;
}

const DataManager: React.FC<DataManagerProps> = ({ canvas }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { currentProject, currentFloor, setCurrentProject, setCurrentFloor } = useEditorStore();
  const { message } = App.useApp();

  // 导出地图数据为JSON
  const exportMapData = () => {
    if (!canvas || !currentProject || !currentFloor) {
      message.error('请先创建项目和楼层');
      return;
    }

    try {
      const objects = canvas.getObjects();
      const rooms: Room[] = [];
      const points: PublicPoint[] = [];
      const walls: any[] = [];

      // 提取房间、点位和墙体数据
      objects.forEach(obj => {
        if ((obj as any).roomData) {
          const roomData = (obj as any).roomData;
          const room: Room = {
            id: roomData.id,
            name: roomData.name,
            category: roomData.category,
            area: roomData.area,
            geometry: {
              type: 'polygon',
              coordinates: (obj as fabric.Polygon).points?.map(p => ({ x: p.x, y: p.y })) || []
            },
            properties: {
              fill: obj.fill as string,
              stroke: obj.stroke as string,
              strokeWidth: obj.strokeWidth || 1,
              ...roomData.properties
            }
          };
          rooms.push(room);
        } else if ((obj as any).pointData) {
          const pointData = (obj as any).pointData;
          const point: PublicPoint = {
            id: pointData.id,
            name: pointData.name,
            type: pointData.type,
            position: { x: obj.left || 0, y: obj.top || 0 },
            properties: {
              fill: obj.fill as string,
              stroke: obj.stroke as string,
              strokeWidth: obj.strokeWidth || 1,
              radius: (obj as fabric.Circle).radius || 5,
              ...pointData.properties
            }
          };
          points.push(point);
        } else if ((obj as any).wallData) {
          const wallData = (obj as any).wallData;
          const line = obj as fabric.Line;
          const wall = {
            id: wallData.id,
            name: wallData.name,
            thickness: wallData.thickness,
            material: wallData.material,
            geometry: {
              type: 'line',
              coordinates: [
                { x: line.x1 || 0, y: line.y1 || 0 },
                { x: line.x2 || 0, y: line.y2 || 0 }
              ]
            },
            properties: {
              stroke: obj.stroke as string,
              strokeWidth: obj.strokeWidth || 1,
              ...wallData.properties
            }
          };
          walls.push(wall);
        }
      });

      // 构建完整的地图数据
      const mapData: MapData = {
        id: currentProject.id,
        name: currentProject.name,
        description: currentProject.description,
        createdAt: currentProject.createdAt,
        updatedAt: new Date().toISOString(),
        buildings: [{
          id: 'building_1',
          name: '主建筑',
          floors: [{
            id: currentFloor.id,
            name: currentFloor.name,
            level: currentFloor.level,
            rooms,
            points,
            walls,
            metadata: {
              canvasWidth: canvas.width || 800,
              canvasHeight: canvas.height || 600,
              zoom: canvas.getZoom(),
              viewportTransform: canvas.viewportTransform
            }
          }]
        }]
      };

      // 下载JSON文件
      const dataStr = JSON.stringify(mapData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${currentProject.name}_${currentFloor.name}_${new Date().getTime()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      message.success('地图数据导出成功');
    } catch (error) {
      console.error('导出失败:', error);
      message.error('导出失败，请检查数据格式');
    }
  };

  // 导入地图数据
  const importMapData = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target?.result as string);
        loadMapData(jsonData);
      } catch (error) {
        console.error('导入失败:', error);
        message.error('文件格式错误，请选择有效的JSON文件');
      }
    };
    reader.readAsText(file);
  };

  // 加载地图数据到画布
  const loadMapData = (mapData: MapData) => {
    if (!canvas) {
      message.error('画布未初始化');
      return;
    }

    Modal.confirm({
      title: '确认导入',
      content: '导入新数据将清除当前画布内容，是否继续？',
      onOk: () => {
        try {
          // 清空画布
          canvas.clear();

          // 更新项目信息
          setCurrentProject({
            id: mapData.id,
            name: mapData.name,
            description: mapData.description,
            createdAt: mapData.createdAt,
            updatedAt: mapData.updatedAt
          });

          // 加载第一个建筑的第一个楼层
          if (mapData.buildings.length > 0 && mapData.buildings[0].floors.length > 0) {
            const floor = mapData.buildings[0].floors[0];
            setCurrentFloor({
              id: floor.id,
              name: floor.name,
              level: floor.level
            });

            // 加载房间
            floor.rooms?.forEach(room => {
              if (room.geometry.type === 'polygon') {
                const polygon = new fabric.Polygon(room.geometry.coordinates, {
                  fill: room.properties?.fill || 'rgba(24, 144, 255, 0.1)',
                  stroke: room.properties?.stroke || '#1890ff',
                  strokeWidth: room.properties?.strokeWidth || 2,
                  selectable: true,
                  evented: true
                });
                
                (polygon as any).roomData = {
                  id: room.id,
                  name: room.name,
                  category: room.category,
                  area: room.area,
                  properties: room.properties
                };
                
                canvas.add(polygon);
              }
            });

            // 加载点位
            floor.points?.forEach(point => {
              const circle = new fabric.Circle({
                left: point.position.x - (point.properties?.radius || 5),
                top: point.position.y - (point.properties?.radius || 5),
                radius: point.properties?.radius || 5,
                fill: point.properties?.fill || '#1890ff',
                stroke: point.properties?.stroke || '#fff',
                strokeWidth: point.properties?.strokeWidth || 2,
                selectable: true,
                evented: true,
                originX: 'center',
                originY: 'center'
              });
              
              (circle as any).pointData = {
                id: point.id,
                name: point.name,
                type: point.type,
                position: point.position,
                properties: point.properties
              };
              
              canvas.add(circle);
            });

            // 加载墙体
            floor.walls?.forEach(wall => {
              if (wall.geometry.type === 'line' && wall.geometry.coordinates.length >= 2) {
                const line = new fabric.Line([
                  wall.geometry.coordinates[0].x,
                  wall.geometry.coordinates[0].y,
                  wall.geometry.coordinates[1].x,
                  wall.geometry.coordinates[1].y
                ], {
                  stroke: wall.properties?.stroke || '#8c8c8c',
                  strokeWidth: wall.properties?.strokeWidth || 8,
                  selectable: true,
                  evented: true,
                  strokeLineCap: 'round'
                });
                
                (line as any).wallData = {
                  id: wall.id,
                  name: wall.name,
                  thickness: wall.thickness,
                  material: wall.material,
                  properties: wall.properties
                };
                
                canvas.add(line);
              }
            });

            // 恢复画布状态
            if (floor.metadata) {
              if (floor.metadata.zoom) {
                canvas.setZoom(floor.metadata.zoom);
              }
              if (floor.metadata.viewportTransform) {
                canvas.setViewportTransform(floor.metadata.viewportTransform);
              }
            }

            canvas.renderAll();
            message.success('地图数据导入成功');
          } else {
            message.warning('导入的数据中没有找到楼层信息');
          }
        } catch (error) {
          console.error('加载数据失败:', error);
          message.error('加载数据失败，请检查文件格式');
        }
      }
    });
  };

  // 处理文件选择
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'application/json' || file.name.endsWith('.json')) {
        importMapData(file);
      } else {
        message.error('请选择JSON格式的文件');
      }
    }
    // 清空input值，允许重复选择同一文件
    event.target.value = '';
  };

  // 保存到本地存储
  const saveToLocalStorage = () => {
    if (!canvas || !currentProject || !currentFloor) {
      message.error('请先创建项目和楼层');
      return;
    }

    try {
      const canvasData = canvas.toJSON(['roomData', 'pointData', 'wallData']);
      const saveData = {
        project: currentProject,
        floor: currentFloor,
        canvasData,
        timestamp: new Date().toISOString()
      };
      
      localStorage.setItem(`map_${currentProject.id}_${currentFloor.id}`, JSON.stringify(saveData));
      message.success('已保存到本地');
    } catch (error) {
      console.error('保存失败:', error);
      message.error('保存失败');
    }
  };

  return (
    <>
      <Space>
        <Button 
          icon={<SaveOutlined />} 
          onClick={saveToLocalStorage}
          title="保存到本地"
        >
          保存
        </Button>
        <Button 
          icon={<DownloadOutlined />} 
          onClick={exportMapData}
          title="导出JSON文件"
        >
          导出
        </Button>
        <Button 
          icon={<UploadOutlined />} 
          onClick={() => fileInputRef.current?.click()}
          title="导入JSON文件"
        >
          导入
        </Button>
      </Space>
      
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
    </>
  );
};

export default DataManager;