import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Select,
  InputNumber,
  ColorPicker,
  Button,
  Divider,
  Space,
  Typography,
  Row,
  Col
} from 'antd';
import { DeleteOutlined, CopyOutlined } from '@ant-design/icons';
import { useEditorStore } from '../stores/editorStore';

// 临时定义RoomCategory枚举
enum RoomCategory {
  RETAIL = 0,
  RESTAURANT = 1,
  ENTERTAINMENT = 2,
  SERVICE = 3,
  OFFICE = 4,
  OTHER = 5
}

const { Title, Text } = Typography;
const { Option } = Select;

interface PropertiesPanelProps {
  canvas: fabric.Canvas | null;
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ canvas }) => {
  const { selectedObjects } = useEditorStore();
  const [form] = Form.useForm();
  const [selectedObject, setSelectedObject] = useState<fabric.Object | null>(null);
  const [objectType, setObjectType] = useState<string>('');

  useEffect(() => {
    if (selectedObjects.length === 1) {
      const obj = selectedObjects[0];
      setSelectedObject(obj);
      
      // 判断对象类型
      if ((obj as any).roomData) {
        setObjectType('room');
        const roomData = (obj as any).roomData;
        form.setFieldsValue({
          name: roomData.name,
          category: roomData.category,
          area: roomData.area,
          fill: obj.fill,
          stroke: obj.stroke,
          strokeWidth: obj.strokeWidth
        });
      } else if ((obj as any).pointData) {
        setObjectType('point');
        const pointData = (obj as any).pointData;
        form.setFieldsValue({
          name: pointData.name,
          type: pointData.type,
          fill: obj.fill,
          stroke: obj.stroke,
          strokeWidth: obj.strokeWidth,
          radius: (obj as fabric.Circle).radius
        });
      } else if ((obj as any).wallData) {
        setObjectType('wall');
        const wallData = (obj as any).wallData;
        form.setFieldsValue({
          name: wallData.name,
          thickness: wallData.thickness,
          material: wallData.material,
          stroke: obj.stroke,
          strokeWidth: obj.strokeWidth
        });
      } else {
        setObjectType('unknown');
      }
    } else {
      setSelectedObject(null);
      setObjectType('');
      form.resetFields();
    }
  }, [selectedObjects, form]);

  const handleFormChange = (changedFields: any, allFields: any) => {
    if (!selectedObject || !canvas) return;

    // 更新对象属性
    Object.keys(changedFields).forEach(key => {
      const value = changedFields[key];
      
      switch (key) {
        case 'fill':
          selectedObject.set('fill', value);
          break;
        case 'stroke':
          selectedObject.set('stroke', value);
          break;
        case 'strokeWidth':
          selectedObject.set('strokeWidth', value);
          break;
        case 'radius':
          if (selectedObject instanceof fabric.Circle) {
            selectedObject.set('radius', value);
          }
          break;
        case 'name':
          // 更新自定义数据
          if ((selectedObject as any).roomData) {
            (selectedObject as any).roomData.name = value;
          } else if ((selectedObject as any).pointData) {
            (selectedObject as any).pointData.name = value;
          } else if ((selectedObject as any).wallData) {
            (selectedObject as any).wallData.name = value;
          }
          break;
        case 'category':
          if ((selectedObject as any).roomData) {
            (selectedObject as any).roomData.category = value;
          }
          break;
        case 'type':
          if ((selectedObject as any).pointData) {
            (selectedObject as any).pointData.type = value;
          }
          break;
        case 'material':
          if ((selectedObject as any).wallData) {
            (selectedObject as any).wallData.material = value;
          }
          break;
        case 'thickness':
          if ((selectedObject as any).wallData) {
            (selectedObject as any).wallData.thickness = value;
            selectedObject.set('strokeWidth', value);
          }
          break;
      }
    });

    canvas.renderAll();
  };

  const handleDelete = () => {
    if (selectedObject && canvas) {
      canvas.remove(selectedObject);
      canvas.renderAll();
    }
  };

  const handleDuplicate = () => {
    if (selectedObject && canvas) {
      selectedObject.clone((cloned: fabric.Object) => {
        cloned.set({
          left: (cloned.left || 0) + 20,
          top: (cloned.top || 0) + 20
        });
        
        // 复制自定义数据
        if ((selectedObject as any).roomData) {
          (cloned as any).roomData = {
            ...(selectedObject as any).roomData,
            id: `room_${Date.now()}`,
            name: `${(selectedObject as any).roomData.name} 副本`
          };
        } else if ((selectedObject as any).pointData) {
          (cloned as any).pointData = {
            ...(selectedObject as any).pointData,
            id: `point_${Date.now()}`,
            name: `${(selectedObject as any).pointData.name} 副本`
          };
        } else if ((selectedObject as any).wallData) {
          (cloned as any).wallData = {
            ...(selectedObject as any).wallData,
            id: `wall_${Date.now()}`,
            name: `${(selectedObject as any).wallData.name} 副本`
          };
        }
        
        canvas.add(cloned);
        canvas.setActiveObject(cloned);
        canvas.renderAll();
      });
    }
  };

  if (!selectedObject) {
    return (
      <Card title="属性面板" className="h-full">
        <div className="flex items-center justify-center h-32 text-gray-500">
          <Text type="secondary">请选择一个对象来编辑属性</Text>
        </div>
      </Card>
    );
  }

  const renderRoomProperties = () => (
    <>
      <Form.Item label="房间名称" name="name">
        <Input placeholder="输入房间名称" />
      </Form.Item>
      <Form.Item label="房间类型" name="category">
        <Select placeholder="选择房间类型">
          <Option value="office">办公室</Option>
          <Option value="meeting">会议室</Option>
          <Option value="storage">储藏室</Option>
          <Option value="bathroom">洗手间</Option>
          <Option value="kitchen">厨房</Option>
          <Option value="corridor">走廊</Option>
          <Option value="other">其他</Option>
        </Select>
      </Form.Item>
      <Form.Item label="面积 (m²)" name="area">
        <InputNumber disabled className="w-full" />
      </Form.Item>
      <Divider>样式设置</Divider>
      <Form.Item label="填充颜色" name="fill">
        <ColorPicker showText />
      </Form.Item>
      <Form.Item label="边框颜色" name="stroke">
        <ColorPicker showText />
      </Form.Item>
      <Form.Item label="边框宽度" name="strokeWidth">
        <InputNumber min={1} max={10} className="w-full" />
      </Form.Item>
    </>
  );

  const renderPointProperties = () => (
    <>
      <Form.Item label="点位名称" name="name">
        <Input placeholder="输入点位名称" />
      </Form.Item>
      <Form.Item label="点位类型" name="type">
        <Select placeholder="选择点位类型">
          <Option value="general">普通点位</Option>
          <Option value="entrance">入口</Option>
          <Option value="exit">出口</Option>
          <Option value="emergency">紧急出口</Option>
          <Option value="facility">设施</Option>
        </Select>
      </Form.Item>
      <Divider>样式设置</Divider>
      <Form.Item label="填充颜色" name="fill">
        <ColorPicker showText />
      </Form.Item>
      <Form.Item label="边框颜色" name="stroke">
        <ColorPicker showText />
      </Form.Item>
      <Form.Item label="边框宽度" name="strokeWidth">
        <InputNumber min={1} max={5} className="w-full" />
      </Form.Item>
      <Form.Item label="半径" name="radius">
        <InputNumber min={3} max={20} className="w-full" />
      </Form.Item>
    </>
  );

  const renderWallProperties = () => (
    <>
      <Form.Item label="墙体名称" name="name">
        <Input placeholder="输入墙体名称" />
      </Form.Item>
      <Form.Item label="厚度" name="thickness">
        <InputNumber min={1} max={50} className="w-full" />
      </Form.Item>
      <Form.Item label="材质" name="material">
        <Select placeholder="选择材质">
          <Option value="concrete">混凝土</Option>
          <Option value="brick">砖墙</Option>
          <Option value="wood">木材</Option>
          <Option value="glass">玻璃</Option>
          <Option value="metal">金属</Option>
        </Select>
      </Form.Item>
      <Divider>样式设置</Divider>
      <Form.Item label="颜色" name="stroke">
        <ColorPicker showText />
      </Form.Item>
      <Form.Item label="宽度" name="strokeWidth">
        <InputNumber min={1} max={20} className="w-full" />
      </Form.Item>
    </>
  );

  const getObjectTitle = () => {
    switch (objectType) {
      case 'room': return '房间属性';
      case 'point': return '点位属性';
      case 'wall': return '墙体属性';
      default: return '对象属性';
    }
  };

  return (
    <Card 
      title={getObjectTitle()}
      className="h-full"
      extra={
        <Space>
          <Button 
            type="text" 
            icon={<CopyOutlined />} 
            size="small"
            onClick={handleDuplicate}
            title="复制"
          />
          <Button 
            type="text" 
            icon={<DeleteOutlined />} 
            size="small"
            danger
            onClick={handleDelete}
            title="删除"
          />
        </Space>
      }
    >
      <Form
        form={form}
        layout="vertical"
        size="small"
        onValuesChange={handleFormChange}
      >
        {objectType === 'room' && renderRoomProperties()}
        {objectType === 'point' && renderPointProperties()}
        {objectType === 'wall' && renderWallProperties()}
      </Form>
    </Card>
  );
};

export default PropertiesPanel;