import React, { useState, useEffect, useRef } from 'react';
import Canvas from '../components/Canvas';
import PropertiesPanel from '../components/PropertiesPanel';
import DataManager from '../components/DataManager';
import { 
  Layout, 
  Button, 
  Space, 
  Tooltip, 
  Divider, 
  Card, 
  Typography, 
  Modal,
  Input,
  Select,
  App
} from 'antd';
import { 
  SaveOutlined,
  UndoOutlined,
  RedoOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  HomeOutlined,
  SettingOutlined,
  ArrowLeftOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
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

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;

const Editor: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<fabric.Canvas | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const { message } = App.useApp();
  const {
    currentTool,
    selectedObjects,
    currentProject,
    currentFloor,
    canvasZoom,
    canvasOffset,
    setCurrentTool,
    setSelectedObjects,
    setCurrentProject,
    setCurrentFloor,
    setCanvasZoom,
    setCanvasOffset,
    resetEditor
  } = useEditorStore();

  const [isPropertiesPanelVisible, setIsPropertiesPanelVisible] = useState(true);
  const [isLayersPanelVisible, setIsLayersPanelVisible] = useState(true);
  const [isFloorModalVisible, setIsFloorModalVisible] = useState(false);
  const [newFloorName, setNewFloorName] = useState('');

  // 工具栏配置
  const toolbarItems = [
    {
      key: 'select',
      tool: EditorTool.SELECT,
      icon: '🔍',
      tooltip: '选择工具',
      shortcut: 'V'
    },
    {
      key: 'room',
      tool: EditorTool.DRAW_ROOM,
      icon: '🏠',
      tooltip: '绘制房间',
      shortcut: 'R'
    },
    {
      key: 'point',
      tool: EditorTool.ADD_POINT,
      icon: '📍',
      tooltip: '添加点位',
      shortcut: 'P'
    },
    {
      key: 'wall',
      tool: EditorTool.DRAW_WALL,
      icon: '🧱',
      tooltip: '绘制墙体',
      shortcut: 'W'
    }
  ];

  // 模拟项目数据加载
  useEffect(() => {
    if (projectId) {
      // 模拟加载项目数据
      const mockProject = {
        id: projectId,
        user_id: '1',
        name: '示例项目',
        map_data: {
          buildings: [
            {
              id: 'building-1',
              name: '主楼',
              floors: [
                {
                  id: 'floor-1',
                  name: '一层',
                  level: 1,
                  rooms: [],
                  points: [],
                  walls: []
                }
              ]
            }
          ],
          version: 1,
          metadata: {
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            author: 'User'
          }
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      setCurrentProject(mockProject);
      if (mockProject.map_data.buildings[0]?.floors[0]) {
        setCurrentFloor(mockProject.map_data.buildings[0].floors[0]);
      }
    }

    return () => {
      resetEditor();
    };
  }, [projectId, setCurrentProject, setCurrentFloor, resetEditor]);

  // 画布尺寸初始化
  useEffect(() => {
    const updateCanvasSize = () => {
      if (canvasContainerRef.current) {
        const container = canvasContainerRef.current;
        const rect = container.getBoundingClientRect();
        setCanvasSize({
          width: rect.width,
          height: rect.height
        });
      }
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    
    return () => {
      window.removeEventListener('resize', updateCanvasSize);
    };
  }, []);

  const handleToolChange = (tool: EditorTool) => {
    setCurrentTool(tool);
    message.info(`已切换到${toolbarItems.find(item => item.tool === tool)?.tooltip}`);
  };

  const handleSave = () => {
    message.success('项目已保存');
  };

  const handleZoomIn = () => {
    const newZoom = Math.min(canvasZoom * 1.2, 5);
    setCanvasZoom(newZoom);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(canvasZoom / 1.2, 0.1);
    setCanvasZoom(newZoom);
  };

  const handleZoomReset = () => {
    setCanvasZoom(1);
    setCanvasOffset({ x: 0, y: 0 });
  };

  const handleAddFloor = () => {
    if (newFloorName.trim()) {
      message.success(`楼层 "${newFloorName}" 已添加`);
      setNewFloorName('');
      setIsFloorModalVisible(false);
    }
  };

  return (
    <Layout className="h-screen">
      {/* 顶部工具栏 */}
      <Header className="bg-white border-b px-4 h-14 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate('/projects')}
            type="text"
          >
            返回项目
          </Button>
          <Divider type="vertical" />
          <Title level={4} className="mb-0">
            {currentProject?.name || '未命名项目'}
          </Title>
          {currentFloor && (
            <Text type="secondary">
              - {currentFloor.name}
            </Text>
          )}
        </div>
        
        <Space>
          <DataManager canvas={canvasRef.current} />
          <Divider type="vertical" />
          <Button icon={<UndoOutlined />} disabled>
            撤销
          </Button>
          <Button icon={<RedoOutlined />} disabled>
            重做
          </Button>
          <Divider type="vertical" />
          <Button icon={<SaveOutlined />} type="primary" onClick={handleSave}>
            保存
          </Button>
        </Space>
      </Header>

      <Layout>
        {/* 左侧工具面板 */}
        <Sider width={80} className="bg-white border-r">
          <div className="p-2 space-y-2">
            {toolbarItems.map((item) => (
              <Tooltip key={item.key} title={`${item.tooltip} (${item.shortcut})`} placement="right">
                <Button
                  className={`w-full h-12 flex flex-col items-center justify-center text-xs ${
                    currentTool === item.tool ? 'bg-blue-50 border-blue-300' : ''
                  }`}
                  onClick={() => handleToolChange(item.tool)}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span className="mt-1">{item.key}</span>
                </Button>
              </Tooltip>
            ))}
          </div>
        </Sider>

        <Layout>
          {/* 主画布区域 */}
          <Content className="relative bg-gray-100">
            {/* 画布控制栏 */}
            <div className="absolute top-4 left-4 z-10">
              <Space>
                <Space.Compact>
                  <Button icon={<ZoomInOutlined />} onClick={handleZoomIn} />
                  <Button onClick={handleZoomReset}>
                    {Math.round(canvasZoom * 100)}%
                  </Button>
                  <Button icon={<ZoomOutOutlined />} onClick={handleZoomOut} />
                </Space.Compact>
                <Button icon={<HomeOutlined />} onClick={handleZoomReset}>
                  适应画布
                </Button>
              </Space>
            </div>

            {/* 楼层选择器 */}
            <div className="absolute top-4 right-4 z-10">
              <Space>
                <Select
                  value={currentFloor?.id}
                  style={{ width: 120 }}
                  placeholder="选择楼层"
                >
                  {currentProject?.map_data.buildings[0]?.floors.map(floor => (
                    <Option key={floor.id} value={floor.id}>
                      {floor.name}
                    </Option>
                  ))}
                </Select>
                <Button 
                  icon={<PlusOutlined />} 
                  onClick={() => setIsFloorModalVisible(true)}
                >
                  新建楼层
                </Button>
              </Space>
            </div>

            {/* 主画布 */}
            <div 
              ref={canvasContainerRef}
              className="w-full h-full"
            >
              <Canvas 
                width={canvasSize.width}
                height={canvasSize.height}
                className="w-full h-full"
                ref={canvasRef}
              />
            </div>
          </Content>

          {/* 右侧面板 */}
          <Sider 
            width={300} 
            className="bg-white border-l"
            collapsible
            collapsed={!isPropertiesPanelVisible && !isLayersPanelVisible}
            onCollapse={(collapsed) => {
              setIsPropertiesPanelVisible(!collapsed);
              setIsLayersPanelVisible(!collapsed);
            }}
          >
            <div className="p-4 space-y-4">
              {/* 图层管理 */}
              {isLayersPanelVisible && (
                <Card size="small" title="图层管理">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
                      <span>房间图层</span>
                      <Space>
                        <Button size="small" type="text" icon={<EditOutlined />} />
                        <Button size="small" type="text" icon={<DeleteOutlined />} />
                      </Space>
                    </div>
                    <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                      <span>点位图层</span>
                      <Space>
                        <Button size="small" type="text" icon={<EditOutlined />} />
                        <Button size="small" type="text" icon={<DeleteOutlined />} />
                      </Space>
                    </div>
                    <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                      <span>墙体图层</span>
                      <Space>
                        <Button size="small" type="text" icon={<EditOutlined />} />
                        <Button size="small" type="text" icon={<DeleteOutlined />} />
                      </Space>
                    </div>
                  </div>
                </Card>
              )}

              {/* 属性面板 */}
              {isPropertiesPanelVisible && (
                <PropertiesPanel canvas={canvasRef.current} />
              )}

              {/* 工具设置 */}
              <Card size="small" title="工具设置">
                <div className="space-y-3">
                  <div>
                    <Text strong>当前工具：</Text>
                    <Text>{toolbarItems.find(item => item.tool === currentTool)?.tooltip}</Text>
                  </div>
                  <div>
                    <Text strong>网格吸附：</Text>
                    <Button size="small" type="primary">开启</Button>
                  </div>
                  <div>
                    <Text strong>网格大小：</Text>
                    <Input size="small" defaultValue="20" addonAfter="px" />
                  </div>
                </div>
              </Card>
            </div>
          </Sider>
        </Layout>
      </Layout>

      {/* 新建楼层弹窗 */}
      <Modal
        title="新建楼层"
        open={isFloorModalVisible}
        onOk={handleAddFloor}
        onCancel={() => {
          setIsFloorModalVisible(false);
          setNewFloorName('');
        }}
        okText="创建"
        cancelText="取消"
      >
        <Input
          placeholder="请输入楼层名称"
          value={newFloorName}
          onChange={(e) => setNewFloorName(e.target.value)}
          onPressEnter={handleAddFloor}
        />
      </Modal>
    </Layout>
  );
};

export default Editor;