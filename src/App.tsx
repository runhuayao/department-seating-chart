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
            // 首页模式：显示所有部门的概况卡片
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {departments.map(dept => {
                const overview = homepageOverview[dept];
                const occupancyRate = overview ? Math.round((overview.onlineCount / overview.totalDesks) * 100) : 0;
                
                return (
                  <div key={dept} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-all duration-200 hover:border-blue-300">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-xl font-semibold text-gray-800">{dept}</h3>
                      <button
                        onClick={() => handleDepartmentChange(dept)}
                        className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors"
                      >
                        查看地图
                      </button>
                    </div>
                    
                    {/* 部门统计信息 */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">总工位数</span>
                        <span className="text-2xl font-bold text-gray-800">{overview?.totalDesks || 0}</span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">在线人数</span>
                        <span className="text-2xl font-bold text-green-600">{overview?.onlineCount || 0}</span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">离线人数</span>
                        <span className="text-2xl font-bold text-red-500">{(overview?.totalDesks || 0) - (overview?.onlineCount || 0)}</span>
                      </div>
                      
                      {/* 使用率进度条 */}
                      <div className="mt-4">
                        <div className="flex justify-between text-sm text-gray-600 mb-1">
                          <span>使用率</span>
                          <span>{occupancyRate}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                            style={{ width: `${occupancyRate}%` }}
                          ></div>
                        </div>
                      </div>
                      
                      {/* 状态指示器 */}
                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                        <div className="flex items-center space-x-4 text-sm">
                          <div className="flex items-center space-x-1">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <span className="text-gray-600">在线</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                            <span className="text-gray-600">离线</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                            <span className="text-gray-600">空闲</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
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
              版本 v1.0.2_M0
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
