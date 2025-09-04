import React, { useState } from 'react';
import DeptMap from './components/DeptMap';
import { getAllDepartments, getHomepageOverview } from './data/departmentData';

function App() {
  const [currentDept, setCurrentDept] = useState<string | null>(null); // null表示首页模式
  const [searchQuery, setSearchQuery] = useState('');

  const departments = getAllDepartments();
  const homepageOverview = getHomepageOverview();
  
  // 处理部门选择
  const handleDepartmentChange = (dept: string) => {
    if (dept === 'home') {
      setCurrentDept(null); // 返回首页
    } else {
      setCurrentDept(dept);
    }
  };
  
  // 处理首页按钮点击
  const handleHomeClick = () => {
    setCurrentDept(null);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 顶部导航栏 */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold text-gray-900">
                部门地图系统
              </h1>
              
              {/* 导航按钮和部门选择器 */}
              <nav className="flex items-center space-x-6">
                <button
                  onClick={handleHomeClick}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    currentDept === null 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  首页
                </button>
                <select 
                  value={currentDept || ''} 
                  onChange={(e) => handleDepartmentChange(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">选择部门</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </nav>
            </div>
            
            {/* 搜索框 */}
            <div className="flex items-center space-x-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="搜索员工..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
              
              <button className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors">
                登录
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 主要内容区域 */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* 面包屑导航 */}
          <div className="mb-4">
            <nav className="text-sm text-gray-600">
              {currentDept === null ? (
                <span className="text-gray-900 font-medium">首页 - 全部门概览</span>
              ) : (
                <>
                  <button 
                    onClick={handleHomeClick}
                    className="text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    首页
                  </button>
                  <span className="mx-2">/</span>
                  <span className="text-gray-900 font-medium">{currentDept}</span>
                </>
              )}
            </nav>
          </div>

          {/* 地图组件 */}
          {currentDept === null ? (
            // 首页模式：显示所有部门的网格化布局
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {departments.map(dept => (
                <div key={dept} className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold text-gray-800">{dept}</h3>
                    <button
                      onClick={() => handleDepartmentChange(dept)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      查看详情
                    </button>
                  </div>
                  <div className="h-64">
                    <DeptMap 
                      department={dept} 
                      searchQuery={searchQuery} 
                      isHomepage={true}
                    />
                  </div>
                  <div className="mt-3 text-sm text-gray-600">
                    <div>总工位: {homepageOverview[dept]?.totalDesks || 0}</div>
                    <div>在线: {homepageOverview[dept]?.onlineCount || 0}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // 部门详情模式
            <div className="bg-white rounded-lg shadow-sm border h-[calc(100vh-200px)]">
              <DeptMap 
                department={currentDept} 
                searchQuery={searchQuery} 
                isHomepage={false}
              />
            </div>
          )}
        </div>
      </main>

      {/* 底部状态栏 */}
      <footer className="bg-white border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-12">
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <span>当前部门: {currentDept}</span>
              <span>•</span>
              <span>最后更新: {new Date().toLocaleTimeString()}</span>
            </div>
            <div className="text-sm text-gray-500">
              版本 v1.0.0
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
