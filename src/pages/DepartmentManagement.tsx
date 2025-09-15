import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import { Loader2, Edit, Save, X, Cloud, Database, Users, MapPin, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { useDepartmentSync } from '@/hooks/useDepartmentSync';

interface Department {
  id: string | number;
  name: string;
  code?: string;
  description?: string;
  floor?: string;
  building?: string;
  manager_id?: number;
  created_at?: string;
  updated_at?: string;
  english_name?: string;
  manager?: string;
  location?: string;
  employee_count?: number;
}

interface DepartmentCloudData {
  department_id: number;
  department_name: string;
  total_desks: number;
  occupied_desks: number;
  available_desks: number;
  total_employees: number;
  occupancy_rate: number;
}

const DepartmentManagement: React.FC = () => {
  const [cloudData, setCloudData] = useState<DepartmentCloudData[]>([]);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Department>>({});
  const [loading, setLoading] = useState(true);
  const [showCloudData, setShowCloudData] = useState(false);
  
  // 使用WebSocket同步Hook
  const {
    connected: wsConnected,
    departments,
    loading: wsLoading,
    error: wsError,
    refreshDepartments
  } = useDepartmentSync({
    onDepartmentUpdate: (department, action) => {
      console.log(`部门${action}:`, department.name);
    },
    onConnectionChange: (connected) => {
      if (connected) {
        toast.success('实时同步已连接');
      } else {
        toast.warning('实时同步已断开');
      }
    }
  });

  // 获取部门列表（保留作为备用方法）
  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/departments');
      const data = await response.json();
      if (data.success) {
        // 如果WebSocket未连接，则使用HTTP获取的数据
        if (!wsConnected) {
          // setDepartments(data.data); // 现在由WebSocket Hook管理
        }
      } else {
        toast.error('获取部门列表失败');
      }
    } catch (error) {
      console.error('获取部门列表失败:', error);
      toast.error('获取部门列表失败');
    }
  };

  // 获取云数据
  const fetchCloudData = async () => {
    try {
      const response = await fetch('/api/departments/cloud-data');
      const data = await response.json();
      if (data.success) {
        setCloudData(data.data);
      } else {
        toast.error('获取云数据失败');
      }
    } catch (error) {
      console.error('获取云数据失败:', error);
      toast.error('获取云数据失败');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchCloudData();
      // 部门数据由WebSocket Hook管理
      setLoading(wsLoading);
    };
    
    loadData();
  }, [wsLoading]);

  // 开始编辑
  const startEdit = (department: Department) => {
    setEditingId(department.id);
    setEditForm({ ...department });
  };

  // 取消编辑
  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  // 保存编辑
  const saveEdit = async () => {
    if (!editingId || !editForm.name) {
      toast.error('部门名称不能为空');
      return;
    }

    try {
      const response = await fetch(`/api/departments/${editingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...editForm,
          code: editForm.code || '' // 确保code字段有值
        }),
      });

      const data = await response.json();
      if (data.success) {
        // WebSocket会自动更新部门数据，无需手动更新状态
        toast.success('部门信息更新成功');
        cancelEdit();
      } else {
        toast.error(data.message || '更新失败');
      }
    } catch (error) {
      console.error('更新部门信息失败:', error);
      toast.error('更新部门信息失败');
    }
  };

  // 处理表单输入
  const handleInputChange = (field: keyof Department, value: string) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  if (loading || wsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">部门管理</h1>
        <div className="flex items-center mt-2 gap-2 mb-4">
          {wsConnected ? (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              <Wifi className="w-3 h-3 mr-1" />
              实时同步
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
              <Database className="w-3 h-3 mr-1" />
              连接断开
            </span>
          )}
          {wsError && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              {wsError}
            </span>
          )}
        </div>
        <div className="flex gap-4">
          <button
            onClick={refreshDepartments}
            disabled={!wsConnected}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Database className="w-4 h-4" />
            刷新数据
          </button>
          <button
            onClick={() => setShowCloudData(!showCloudData)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              showCloudData
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <Database className="w-4 h-4" />
            {showCloudData ? '隐藏云数据' : '查看云数据'}
          </button>
        </div>
      </div>

      {/* 云数据展示 */}
      {showCloudData && (
        <div className="mb-8 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Wifi className="w-5 h-5 text-blue-500" />
            部门云数据统计
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cloudData.map((data) => (
              <div key={data.department_id} className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-lg mb-2">{data.department_name}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>总工位数:</span>
                    <span className="font-medium">{data.total_desks}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>已占用:</span>
                    <span className="font-medium text-red-600">{data.occupied_desks}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>可用:</span>
                    <span className="font-medium text-green-600">{data.available_desks}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>员工数:</span>
                    <span className="font-medium">{data.total_employees}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>占用率:</span>
                    <span className="font-medium text-blue-600">{data.occupancy_rate}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 部门列表 */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold">部门信息管理</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  部门名称
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  部门代码
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  描述
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  楼层
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  建筑
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {departments.map((department) => (
                <tr key={department.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingId === department.id ? (
                      <input
                        type="text"
                        value={editForm.name || ''}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        className="w-full px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <div className="text-sm font-medium text-gray-900">{department.name}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingId === department.id ? (
                      <input
                        type="text"
                        value={editForm.code || ''}
                        onChange={(e) => handleInputChange('code', e.target.value)}
                        className="w-full px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <div className="text-sm text-gray-900">{(department as any).code || '-'}</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {editingId === department.id ? (
                      <textarea
                        value={editForm.description || ''}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        className="w-full px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={2}
                      />
                    ) : (
                      <div className="text-sm text-gray-900 max-w-xs truncate">
                        {department.description || '-'}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingId === department.id ? (
                      <input
                        type="text"
                        value={editForm.floor || ''}
                        onChange={(e) => handleInputChange('floor', e.target.value)}
                        className="w-full px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <div className="text-sm text-gray-900">{(department as any).floor || '-'}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingId === department.id ? (
                      <input
                        type="text"
                        value={editForm.building || ''}
                        onChange={(e) => handleInputChange('building', e.target.value)}
                        className="w-full px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <div className="text-sm text-gray-900">{(department as any).building || '-'}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {editingId === department.id ? (
                      <div className="flex gap-2">
                        <button
                          onClick={saveEdit}
                          className="text-green-600 hover:text-green-900 flex items-center gap-1"
                        >
                          <Save className="w-4 h-4" />
                          保存
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="text-gray-600 hover:text-gray-900 flex items-center gap-1"
                        >
                          <X className="w-4 h-4" />
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(department)}
                        className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                      >
                        <Edit className="w-4 h-4" />
                        编辑
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DepartmentManagement;