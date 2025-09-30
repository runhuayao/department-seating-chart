import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Typography, 
  Row, 
  Col, 
  Input, 
  Modal, 
  Form, 
  Dropdown, 
  Space,
  Empty,
  Avatar,
  App
} from 'antd';
import { 
  PlusOutlined, 
  SearchOutlined, 
  MoreOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  ExportOutlined,
  ImportOutlined,
  UserOutlined,
  LogoutOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

// 临时定义Project接口
interface Project {
  id: string;
  user_id: string;
  name: string;
  map_data: {
    buildings: any[];
    version: number;
    metadata: {
      created_at: string;
      updated_at: string;
      author: string;
    };
  };
  thumbnail_url?: string;
  created_at: string;
  updated_at: string;
}

const { Title, Text } = Typography;
const { Search } = Input;

const Projects: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [searchText, setSearchText] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { message } = App.useApp();

  // 模拟项目数据
  useEffect(() => {
    const mockProjects: Project[] = [
      {
        id: '1',
        user_id: user?.id || '1',
        name: '万达广场一层',
        map_data: {
          buildings: [],
          version: 1,
          metadata: {
            created_at: '2024-01-15T10:00:00Z',
            updated_at: '2024-01-20T15:30:00Z',
            author: user?.name || 'User'
          }
        },
        thumbnail_url: 'https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=modern%20shopping%20mall%20floor%20plan&image_size=square',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-20T15:30:00Z'
      },
      {
        id: '2',
        user_id: user?.id || '1',
        name: '办公楼B座',
        map_data: {
          buildings: [],
          version: 1,
          metadata: {
            created_at: '2024-01-10T09:00:00Z',
            updated_at: '2024-01-18T14:20:00Z',
            author: user?.name || 'User'
          }
        },
        thumbnail_url: 'https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=office%20building%20floor%20plan%20layout&image_size=square',
        created_at: '2024-01-10T09:00:00Z',
        updated_at: '2024-01-18T14:20:00Z'
      }
    ];
    setProjects(mockProjects);
    setFilteredProjects(mockProjects);
  }, [user]);

  // 搜索功能
  useEffect(() => {
    const filtered = projects.filter(project =>
      project.name.toLowerCase().includes(searchText.toLowerCase())
    );
    setFilteredProjects(filtered);
  }, [searchText, projects]);

  const handleCreateProject = async (values: { name: string; description?: string }) => {
    const newProject: Project = {
      id: Date.now().toString(),
      user_id: user?.id || '1',
      name: values.name,
      map_data: {
        buildings: [],
        version: 1,
        metadata: {
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          author: user?.name || 'User'
        }
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    setProjects([newProject, ...projects]);
    setIsModalVisible(false);
    form.resetFields();
    message.success('项目创建成功！');
    
    // 直接进入编辑器
    navigate(`/editor/${newProject.id}`);
  };

  const handleDeleteProject = (projectId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除这个项目吗？',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        setProjects(projects.filter(p => p.id !== projectId));
        message.success('项目已删除');
      }
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    message.success('已退出登录');
  };

  const getProjectActions = (project: Project) => [
    {
      key: 'edit',
      label: '编辑',
      icon: <EditOutlined />,
      onClick: () => navigate(`/editor/${project.id}`)
    },
    {
      key: 'export',
      label: '导出',
      icon: <ExportOutlined />,
      onClick: () => message.info('导出功能开发中...')
    },
    {
      key: 'delete',
      label: '删除',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: () => handleDeleteProject(project.id)
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 头部导航 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Title level={3} className="mb-0 text-primary">
                室内地图编辑器
              </Title>
            </div>
            <div className="flex items-center space-x-4">
              <Text>欢迎，{user?.name}</Text>
              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'profile',
                      label: '个人资料',
                      icon: <UserOutlined />
                    },
                    {
                      key: 'logout',
                      label: '退出登录',
                      icon: <LogoutOutlined />,
                      onClick: handleLogout
                    }
                  ]
                }}
                placement="bottomRight"
              >
                <Avatar icon={<UserOutlined />} className="cursor-pointer" />
              </Dropdown>
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 操作栏 */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-4">
            <Title level={2} className="mb-0">
              我的项目
            </Title>
            <Text type="secondary">
              共 {projects.length} 个项目
            </Text>
          </div>
          <Space>
            <Button icon={<ImportOutlined />}>
              导入项目
            </Button>
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => setIsModalVisible(true)}
            >
              新建项目
            </Button>
          </Space>
        </div>

        {/* 搜索栏 */}
        <div className="mb-6">
          <Search
            placeholder="搜索项目名称..."
            allowClear
            size="large"
            style={{ maxWidth: 400 }}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>

        {/* 项目列表 */}
        {filteredProjects.length === 0 ? (
          <Empty
            description="暂无项目"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => setIsModalVisible(true)}
            >
              创建第一个项目
            </Button>
          </Empty>
        ) : (
          <Row gutter={[24, 24]}>
            {filteredProjects.map((project) => (
              <Col xs={24} sm={12} lg={8} xl={6} key={project.id}>
                <Card
                  hoverable
                  className="h-full"
                  cover={
                    <div className="h-48 bg-gray-100 flex items-center justify-center overflow-hidden">
                      {project.thumbnail_url ? (
                        <img 
                          src={project.thumbnail_url} 
                          alt={project.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-gray-400 text-center">
                          <div className="text-4xl mb-2">🏢</div>
                          <Text type="secondary">暂无预览</Text>
                        </div>
                      )}
                    </div>
                  }
                  actions={[
                    <Button 
                      type="text" 
                      onClick={() => navigate(`/editor/${project.id}`)}
                      key="edit"
                    >
                      编辑
                    </Button>,
                    <Dropdown
                      menu={{ items: getProjectActions(project) }}
                      key="more"
                    >
                      <Button type="text" icon={<MoreOutlined />} />
                    </Dropdown>
                  ]}
                >
                  <Card.Meta
                    title={
                      <div className="truncate" title={project.name}>
                        {project.name}
                      </div>
                    }
                    description={
                      <div className="space-y-1">
                        <Text type="secondary" className="text-xs">
                          创建时间：{new Date(project.created_at).toLocaleDateString()}
                        </Text>
                        <br />
                        <Text type="secondary" className="text-xs">
                          更新时间：{new Date(project.updated_at).toLocaleDateString()}
                        </Text>
                      </div>
                    }
                  />
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </div>

      {/* 新建项目弹窗 */}
      <Modal
        title="新建项目"
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          form.resetFields();
        }}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateProject}
        >
          <Form.Item
            name="name"
            label="项目名称"
            rules={[
              { required: true, message: '请输入项目名称' },
              { max: 50, message: '项目名称不能超过50个字符' }
            ]}
          >
            <Input placeholder="请输入项目名称" />
          </Form.Item>
          
          <Form.Item
            name="description"
            label="项目描述"
          >
            <Input.TextArea 
              rows={3} 
              placeholder="请输入项目描述（可选）" 
              maxLength={200}
            />
          </Form.Item>

          <Form.Item className="mb-0 text-right">
            <Space>
              <Button onClick={() => {
                setIsModalVisible(false);
                form.resetFields();
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                创建项目
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Projects;