import React, { useState } from 'react';
import DeptMap from '../components/DeptMap';
import { useMapConfig } from '../hooks/useMapConfig';

interface MapContainerConfig {
  width?: number;
  height?: number;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
}

const MapContainerTest: React.FC = () => {
  const [testDepartment, setTestDepartment] = useState('工程部');
  const [customConfig, setCustomConfig] = useState<MapContainerConfig>({
    width: 560,
    height: 340,
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderWidth: 2,
    borderRadius: 8
  });

  const { config, loading, error, updateConfig, autoResize } = useMapConfig(testDepartment);

  // 测试预设配置
  const testConfigs = [
    {
      name: '默认配置',
      config: {
        width: 560,
        height: 340,
        backgroundColor: '#f8fafc',
        borderColor: '#e2e8f0',
        borderWidth: 2,
        borderRadius: 8
      }
    },
    {
      name: '大尺寸配置',
      config: {
        width: 800,
        height: 600,
        backgroundColor: '#f0f9ff',
        borderColor: '#0ea5e9',
        borderWidth: 3,
        borderRadius: 12
      }
    },
    {
      name: '紧凑配置',
      config: {
        width: 400,
        height: 300,
        backgroundColor: '#fef3c7',
        borderColor: '#f59e0b',
        borderWidth: 1,
        borderRadius: 4
      }
    },
    {
      name: '深色主题',
      config: {
        width: 600,
        height: 400,
        backgroundColor: '#1f2937',
        borderColor: '#6b7280',
        borderWidth: 2,
        borderRadius: 8
      }
    }
  ];

  const handleConfigChange = (key: keyof MapContainerConfig, value: string | number) => {
    setCustomConfig(prev => ({
      ...prev,
      [key]: typeof value === 'string' ? value : Number(value)
    }));
  };

  const applyCustomConfig = async () => {
    try {
      await updateConfig(customConfig);
      alert('配置更新成功！');
    } catch (err) {
      alert('配置更新失败：' + (err instanceof Error ? err.message : '未知错误'));
    }
  };

  const applyTestConfig = async (testConfig: MapContainerConfig) => {
    try {
      await updateConfig(testConfig);
      setCustomConfig(testConfig);
      alert('测试配置应用成功！');
    } catch (err) {
      alert('应用测试配置失败：' + (err instanceof Error ? err.message : '未知错误'));
    }
  };

  const handleAutoResize = async () => {
    try {
      await autoResize();
      alert('自动调整尺寸成功！');
    } catch (err) {
      alert('自动调整失败：' + (err instanceof Error ? err.message : '未知错误'));
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">地图容器功能测试</h1>
        
        {/* 错误显示 */}
        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            错误: {error}
          </div>
        )}
        
        {/* 加载状态 */}
        {loading && (
          <div className="mb-4 p-4 bg-blue-100 border border-blue-400 text-blue-700 rounded">
            正在加载...
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 控制面板 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">控制面板</h2>
              
              {/* 部门选择 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  测试部门
                </label>
                <select
                  value={testDepartment}
                  onChange={(e) => setTestDepartment(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md"
                >
                  <option value="工程部">工程部</option>
                  <option value="设计部">设计部</option>
                  <option value="市场部">市场部</option>
                  <option value="人事部">人事部</option>
                </select>
              </div>

              {/* 当前配置显示 */}
              <div className="mb-4">
                <h3 className="text-lg font-medium mb-2">当前配置</h3>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>宽度: {config?.width || 'N/A'}px</div>
                  <div>高度: {config?.height || 'N/A'}px</div>
                  <div>背景色: {config?.backgroundColor || 'N/A'}</div>
                  <div>边框色: {config?.borderColor || 'N/A'}</div>
                  <div>边框宽度: {config?.borderWidth || 'N/A'}px</div>
                  <div>圆角: {config?.borderRadius || 'N/A'}px</div>
                </div>
              </div>

              {/* 自定义配置 */}
              <div className="mb-4">
                <h3 className="text-lg font-medium mb-2">自定义配置</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">宽度 (px)</label>
                    <input
                      type="number"
                      value={customConfig.width}
                      onChange={(e) => handleConfigChange('width', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md"
                      min="200"
                      max="1200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">高度 (px)</label>
                    <input
                      type="number"
                      value={customConfig.height}
                      onChange={(e) => handleConfigChange('height', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md"
                      min="150"
                      max="800"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">背景色</label>
                    <input
                      type="color"
                      value={customConfig.backgroundColor}
                      onChange={(e) => handleConfigChange('backgroundColor', e.target.value)}
                      className="w-full p-1 border border-gray-300 rounded-md h-10"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">边框色</label>
                    <input
                      type="color"
                      value={customConfig.borderColor}
                      onChange={(e) => handleConfigChange('borderColor', e.target.value)}
                      className="w-full p-1 border border-gray-300 rounded-md h-10"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">边框宽度 (px)</label>
                    <input
                      type="number"
                      value={customConfig.borderWidth}
                      onChange={(e) => handleConfigChange('borderWidth', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md"
                      min="0"
                      max="10"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">圆角 (px)</label>
                    <input
                      type="number"
                      value={customConfig.borderRadius}
                      onChange={(e) => handleConfigChange('borderRadius', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md"
                      min="0"
                      max="20"
                    />
                  </div>
                </div>
                <button
                  onClick={applyCustomConfig}
                  disabled={loading}
                  className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  应用自定义配置
                </button>
              </div>

              {/* 预设配置测试 */}
              <div className="mb-4">
                <h3 className="text-lg font-medium mb-2">预设配置测试</h3>
                <div className="space-y-2">
                  {testConfigs.map((test, index) => (
                    <button
                      key={index}
                      onClick={() => applyTestConfig(test.config)}
                      disabled={loading}
                      className="w-full px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-50"
                    >
                      {test.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* 自动调整 */}
              <div>
                <button
                  onClick={handleAutoResize}
                  disabled={loading}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  自动调整尺寸
                </button>
              </div>
            </div>
          </div>

          {/* 地图显示区域 */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">地图预览</h2>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <DeptMap
                  department={testDepartment}
                  searchQuery=""
                  isHomepage={false}
                  highlightDeskId={null}
                  mapConfig={config || undefined}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 测试说明 */}
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">测试说明</h2>
          <div className="text-gray-700 space-y-2">
            <p><strong>功能测试项目：</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>动态调整地图容器尺寸</li>
              <li>修改背景色和边框色</li>
              <li>调整边框宽度和圆角大小</li>
              <li>样式属性在尺寸调整时保持不变</li>
              <li>自动根据工位数据计算最佳尺寸</li>
              <li>预设配置快速切换</li>
              <li>配置验证和错误处理</li>
            </ul>
            <p className="mt-4"><strong>测试步骤：</strong></p>
            <ol className="list-decimal list-inside space-y-1 ml-4">
              <li>选择不同部门查看地图加载</li>
              <li>使用预设配置测试不同样式</li>
              <li>自定义配置参数并应用</li>
              <li>点击自动调整尺寸功能</li>
              <li>验证圆角等样式在调整后保持不变</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapContainerTest;