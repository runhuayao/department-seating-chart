import React, { useState } from 'react';
import DeptMap from './components/DeptMap';

function App() {
  const [currentDept, setCurrentDept] = useState('Engineering');
  const [searchQuery, setSearchQuery] = useState('');

  const departments = ['Engineering', 'Marketing', 'Sales', 'HR'];

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
              
              {/* 部门选择器 */}
              <select 
                value={currentDept}
                onChange={(e) => setCurrentDept(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
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
          <nav className="flex mb-6" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-2">
              <li>
                <div className="flex items-center">
                  <span className="text-gray-500 text-sm">首页</span>
                </div>
              </li>
              <li>
                <div className="flex items-center">
                  <svg className="flex-shrink-0 h-4 w-4 text-gray-400 mx-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-900 text-sm font-medium">{currentDept} 部门</span>
                </div>
              </li>
            </ol>
          </nav>

          {/* 地图容器 */}
          <div className="bg-white rounded-lg shadow-sm border h-[calc(100vh-200px)]">
            <DeptMap department={currentDept} />
          </div>
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
