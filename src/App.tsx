import React, { useState, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import DeptMap from './components/DeptMap';
import M1ServerManagement from './pages/M1ServerManagement';
import MapTest from './test/MapTest';
import LoginForm from './components/LoginForm';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { getAllDepartments, getHomepageOverview } from './data/departmentData';
import { workstationAPI } from './utils/api';
import { LogOut, User } from 'lucide-react';
import './styles/m1-theme.css';

// 主页面组件
function HomePage() {
  const { user, logout, isAuthenticated } = useAuth();
  const [currentDept, setCurrentDept] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddWorkstation, setShowAddWorkstation] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [workstationForm, setWorkstationForm] = useState({
    name: '',
    department: '',
    ipAddress: '',
    username: '',
    description: ''
  });
  const [searchResults, setSearchResults] = useState({
    employees: [],
    workstations: [],
    total: 0
  });
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [highlightDeskId, setHighlightDeskId] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const departments = getAllDepartments();
  const homepageOverview = getHomepageOverview();
  
  const handleDepartmentChange = (dept: string) => {
    if (dept === 'home') {
      setCurrentDept(null);
    } else {
      setCurrentDept(dept);
    }
    setSearchQuery('');
    setSearchResults({ employees: [], workstations: [], total: 0 });
    setShowSearchResults(false);
    setHighlightDeskId(null); // 清除工位高亮状态
  };
  
  const handleHomeClick = () => {
    setCurrentDept(null);
    setSearchQuery('');
    setSearchResults({ employees: [], workstations: [], total: 0 });
    setShowSearchResults(false);
    setHighlightDeskId(null); // 清除工位高亮状态
  };

  // 处理工位表单提交
  const handleWorkstationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAuthenticated) {
      alert('请先登录');
      setShowLoginModal(true);
      return;
    }
    
    if (!workstationForm.name || !workstationForm.ipAddress || !workstationForm.department) {
      alert('请填写所有必填字段');
      return;
    }

    try {
      // 使用API工具添加工位
      const result = await workstationAPI.create({
        name: workstationForm.name,
        department: workstationForm.department,
        ipAddress: workstationForm.ipAddress,
        username: workstationForm.username,
        description: workstationForm.description,
        status: 'active'
      });
      
      console.log('工位添加成功:', result);
      alert('工位添加成功！');
      setShowAddWorkstation(false);
      setWorkstationForm({
        name: '',
        department: '',
        ipAddress: '',
        username: '',
        description: ''
      });
    } catch (error) {
      console.error('添加工位请求错误:', error);
      alert('添加工位失败，请检查网络连接');
    }
  };

  // 处理表单输入变化
  const handleFormChange = (field: string, value: string) => {
    setWorkstationForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 搜索处理函数
  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults(null);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    try {
      // 使用API工具进行搜索
      const data = await workstationAPI.search(query);
      setSearchResults(data);
      setShowSearchResults(true);
    } catch (error) {
      console.error('搜索错误:', error);
      setSearchResults(null);
      setShowSearchResults(false);
    } finally {
      setIsSearching(false);
    }
  };

  // 搜索输入变化处理（防抖）
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    
    // 清除之前的定时器
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // 设置新的定时器，300ms后执行搜索
    searchTimeoutRef.current = setTimeout(async () => {
      if (value.trim()) {
        try {
          // 获取认证token
          const token = localStorage.getItem('auth_token');
          const headers: Record<string, string> = {
            'Content-Type': 'application/json'
          };
          
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
          
          // 调用真实的搜索API
          const response = await fetch(`http://localhost:8080/api/search?q=${encodeURIComponent(value)}`, {
            headers
          });
          
          if (response.ok) {
            const results = await response.json();
            // 处理API返回的数据结构
            const searchData = results.success ? results.data : { employees: [], workstations: [], total: 0 };
            setSearchResults(searchData);
            setShowSearchResults(true);
          } else if (response.status === 401) {
            // 认证失败，可能需要重新登录
            console.warn('搜索需要登录认证');
            setSearchResults({ employees: [], workstations: [], total: 0 });
            setShowSearchResults(false);
          } else {
            console.error('搜索请求失败:', response.statusText);
            setSearchResults({ employees: [], workstations: [], total: 0 });
            setShowSearchResults(false);
          }
        } catch (error) {
          console.error('搜索请求错误:', error);
          setSearchResults({ employees: [], workstations: [], total: 0 });
          setShowSearchResults(false);
        }
      } else {
        setSearchResults({ employees: [], workstations: [], total: 0 });
        setShowSearchResults(false);
      }
    }, 300);
  };

  // 处理搜索结果点击
  const handleSearchResultClick = (item: any, type: 'employee' | 'workstation') => {
    const departmentName = item.department_name || item.department;
    
    if (type === 'workstation' && departmentName) {
      // 如果是工位，切换到对应部门并高亮该工位
      setCurrentDept(departmentName);
      setSearchQuery(item.name);
      // 设置需要高亮的工位ID
      if (item.desk_id || item.id) {
        setHighlightDeskId(item.desk_id || item.id);
      }
    } else if (type === 'employee' && departmentName) {
      // 如果是员工，切换到对应部门并搜索该员工
      setCurrentDept(departmentName);
      setSearchQuery(item.name);
      // 如果员工有关联的工位，也进行高亮
      if (item.desk_id) {
        setHighlightDeskId(item.desk_id);
      }
    }
    setShowSearchResults(false);
  };

  // 点击外部区域关闭搜索结果
  const handleClickOutside = (event: MouseEvent) => {
    const searchContainer = document.querySelector('.search-container');
    if (searchContainer && !searchContainer.contains(event.target as Node)) {
      setShowSearchResults(false);
    }
  };

  // 添加和移除点击外部事件监听
  React.useEffect(() => {
    if (showSearchResults) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSearchResults]);

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
            
            {/* 搜索框和工位管理 */}
            <div className="flex items-center space-x-4">
              <div className="relative search-container">
                <input
                  type="text"
                  placeholder="搜索员工或工位..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {isSearching && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  </div>
                )}
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                
                {/* 搜索结果下拉框 */}
                {showSearchResults && searchResults && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-50 max-h-96 overflow-y-auto">
                    {searchResults.employees && searchResults.employees.length > 0 && (
                      <div className="p-2">
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">员工 ({searchResults.employees.length})</div>
                        {searchResults.employees.map((employee, index) => (
                           <div 
                             key={index} 
                             className="px-3 py-2 hover:bg-gray-100 cursor-pointer rounded-md"
                             onClick={() => handleSearchResultClick(employee, 'employee')}
                           >
                             <div className="font-medium text-gray-900">{employee.name}</div>
                             <div className="text-sm text-gray-500">{employee.department_name || employee.department} - {employee.position}</div>
                           </div>
                         ))}
                      </div>
                    )}
                    
                    {searchResults.workstations && searchResults.workstations.length > 0 && (
                      <div className="p-2 border-t border-gray-100">
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">工位 ({searchResults.workstations.length})</div>
                        {searchResults.workstations.map((workstation, index) => (
                           <div 
                             key={index} 
                             className="px-3 py-2 hover:bg-gray-100 cursor-pointer rounded-md"
                             onClick={() => handleSearchResultClick(workstation, 'workstation')}
                           >
                             <div className="font-medium text-gray-900">{workstation.name}</div>
                             <div className="text-sm text-gray-500">{workstation.department_name || workstation.department} - {workstation.ip_address || workstation.ipAddress}</div>
                             {workstation.username && (
                               <div className="text-xs text-gray-400">用户: {workstation.username}</div>
                             )}
                           </div>
                         ))}
                      </div>
                    )}
                    
                    {(!searchResults.employees || searchResults.employees.length === 0) && 
                     (!searchResults.workstations || searchResults.workstations.length === 0) && (
                      <div className="p-4 text-center text-gray-500">
                        <div className="text-sm">未找到相关结果</div>
                        <div className="text-xs mt-1">请尝试其他关键词</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* 添加工位按钮 */}
              <button 
                onClick={() => setShowAddWorkstation(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 transition-colors flex items-center space-x-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>添加工位</span>
              </button>
              
              {/* 用户认证区域 */}
              {isAuthenticated ? (
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2 text-sm text-gray-700">
                    <User className="h-4 w-4" />
                    <span>{user?.username}</span>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {user?.role === 'admin' ? '管理员' : user?.role === 'manager' ? '经理' : '员工'}
                    </span>
                  </div>
                  <button 
                    onClick={logout}
                    className="px-3 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 transition-colors flex items-center space-x-1"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>退出</span>
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setShowLoginModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors"
                >
                  登录
                </button>
              )}
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
                      highlightDeskId={currentDept === dept ? highlightDeskId : null}
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
                highlightDeskId={highlightDeskId}
              />
            </div>
          )}
        </div>
      </main>

      {/* 添加工位弹窗 */}
      {showAddWorkstation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">添加新工位</h3>
              <button
                onClick={() => setShowAddWorkstation(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleWorkstationSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">工位名称</label>
                <input
                  type="text"
                  required
                  value={workstationForm.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入工位名称"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">所属部门</label>
                <select
                  required
                  value={workstationForm.department}
                  onChange={(e) => handleFormChange('department', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">请选择部门</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">IP地址</label>
                <input
                  type="text"
                  required
                  value={workstationForm.ipAddress}
                  onChange={(e) => handleFormChange('ipAddress', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="例如: 192.168.1.100"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
                <input
                  type="text"
                  required
                  value={workstationForm.username}
                  onChange={(e) => handleFormChange('username', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入用户名"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">描述信息</label>
                <textarea
                  value={workstationForm.description}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入描述信息（可选）"
                  rows={3}
                />
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddWorkstation(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  添加工位
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 登录模态框 */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="relative">
            <button
              onClick={() => setShowLoginModal(false)}
              className="absolute -top-4 -right-4 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 z-10"
            >
              <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <LoginForm onClose={() => setShowLoginModal(false)} />
          </div>
        </div>
      )}

      {/* 底部状态栏 */}
      <footer className="bg-white border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-12">
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <span>当前部门: {currentDept || '全部门概览'}</span>
              <span>•</span>
              <span>最后更新: {new Date().toLocaleTimeString()}</span>
            </div>
            <div className="text-sm text-gray-500">
              版本 v1.2.0
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// 导航组件
function Navigation() {
  const location = useLocation();
  
  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <h1 className="text-xl font-bold text-gray-900">
              企业管理系统
            </h1>
            
            <div className="flex space-x-6">
              <Link
                to="/"
                className={`px-4 py-2 rounded-md transition-colors ${
                  location.pathname === '/' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                部门地图
              </Link>
              <Link
                to="/m1-server"
                className={`px-4 py-2 rounded-md transition-colors ${
                  location.pathname === '/m1-server' 
                    ? 'bg-indigo-600 text-white' 
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                M1服务器管理
              </Link>
            </div>
          </div>
          
          <div className="text-sm text-gray-500">
            v1.2.0-M1服务器管理平台
          </div>
        </div>
      </div>
    </nav>
  );
}

// 主应用组件
function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Navigation />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/m1-server" element={<M1ServerManagement />} />
            <Route path="/test-map" element={<MapTest />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
