/**
 * 部门名称映射管理组件
 * 提供可视化界面用于管理中文部门名称与英文配置键的映射关系
 */
import React, { useState, useEffect } from 'react';
import { 
  Edit, 
  Save, 
  X, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Languages, 
  CheckCircle,
  AlertCircle,
  ArrowRightLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { useDepartmentSync } from '@/hooks/useDepartmentSync';
import cacheService from '@/services/cacheService';
import { Department, Employee } from '../../api/types/database.js';
import { 
  chineseToEnglishMapping, 
  englishToChineseMapping,
  getEnglishDeptKey,
  getChineseDeptName,
  getDepartmentConfigByChinese
} from '@/data/departmentData';

interface MappingEntry {
  id: string;
  chineseName: string;
  englishKey: string;
  isValid: boolean;
  hasConfig: boolean;
}

interface DepartmentMappingManagerProps {
  onMappingUpdate?: (mappings: MappingEntry[]) => void;
}

export default function DepartmentMappingManager({ onMappingUpdate }: DepartmentMappingManagerProps) {
  const [mappings, setMappings] = useState<MappingEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ chineseName: '', englishKey: '' });
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ employees: Employee[]; departments: Department[] } | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // 使用WebSocket同步
  const { connected: wsConnected, refreshDepartments } = useDepartmentSync({
    onMappingUpdate: (mappingData) => {
      console.log('映射数据已更新:', mappingData);
      loadMappings();
    }
  });

  // 加载映射数据（从SQL查询缓存）
  const loadMappings = async () => {
    setLoading(true);
    try {
      // 从缓存服务获取部门数据
      const departments = await cacheService.getDepartments();
      const mappingEntries: MappingEntry[] = [];
      
      // 从数据库部门数据生成映射
      departments.forEach((dept: Department) => {
        const englishKey = getEnglishDeptKey(dept.name) || dept.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const config = getDepartmentConfigByChinese(dept.name);
        mappingEntries.push({
          id: `${dept.name}-${englishKey}`,
          chineseName: dept.name,
          englishKey: englishKey,
          isValid: validateMapping(dept.name, englishKey),
          hasConfig: !!config
        });
      });
      
      // 同时加载现有静态映射作为补充
      Object.entries(chineseToEnglishMapping).forEach(([chinese, english]) => {
        // 避免重复添加
        if (!mappingEntries.find(entry => entry.chineseName === chinese)) {
          const config = getDepartmentConfigByChinese(chinese);
          mappingEntries.push({
            id: `${chinese}-${english}`,
            chineseName: chinese,
            englishKey: english,
            isValid: true,
            hasConfig: !!config
          });
        }
      });

      setMappings(mappingEntries);
      onMappingUpdate?.(mappingEntries);
      
    } catch (error) {
      console.error('加载映射数据失败:', error);
      toast.error('加载映射数据失败，请检查数据库连接');
      
      // 降级到静态数据
      const mappingEntries: MappingEntry[] = [];
      Object.entries(chineseToEnglishMapping).forEach(([chinese, english]) => {
        const config = getDepartmentConfigByChinese(chinese);
        mappingEntries.push({
          id: `${chinese}-${english}`,
          chineseName: chinese,
          englishKey: english,
          isValid: true,
          hasConfig: !!config
        });
      });
      setMappings(mappingEntries);
      onMappingUpdate?.(mappingEntries);
    } finally {
      setLoading(false);
    }
  };

  // 验证映射有效性
  const validateMapping = (chineseName: string, englishKey: string): boolean => {
    // 检查中文名称是否为空
    if (!chineseName.trim()) return false;
    
    // 检查英文键是否为空
    if (!englishKey.trim()) return false;
    
    // 检查英文键格式（应该是有效的对象键名）
    const validKeyPattern = /^[a-zA-Z][a-zA-Z0-9_]*$/;
    return validKeyPattern.test(englishKey);
  };

  // 开始编辑
  const startEdit = (mapping: MappingEntry) => {
    setEditingId(mapping.id);
    setEditForm({
      chineseName: mapping.chineseName,
      englishKey: mapping.englishKey
    });
  };

  // 取消编辑
  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ chineseName: '', englishKey: '' });
    setIsAddingNew(false);
  };

  // 保存映射
  const saveMapping = async () => {
    const { chineseName, englishKey } = editForm;
    
    if (!validateMapping(chineseName, englishKey)) {
      toast.error('请输入有效的中文名称和英文键名');
      return;
    }

    setLoading(true);
    
    try {
      // 这里应该调用API保存映射关系
      // 目前先更新本地状态
      const newMapping: MappingEntry = {
        id: `${chineseName}-${englishKey}`,
        chineseName,
        englishKey,
        isValid: validateMapping(chineseName, englishKey),
        hasConfig: !!getDepartmentConfigByChinese(chineseName)
      };

      if (isAddingNew) {
        setMappings(prev => [...prev, newMapping]);
        toast.success('新增映射成功');
      } else {
        setMappings(prev => 
          prev.map(mapping => 
            mapping.id === editingId ? newMapping : mapping
          )
        );
        toast.success('映射更新成功');
      }

      cancelEdit();
      onMappingUpdate?.(mappings);
      
    } catch (error) {
      console.error('保存映射失败:', error);
      toast.error('保存映射失败');
    } finally {
      setLoading(false);
    }
  };

  // 删除映射
  const deleteMapping = async (mappingId: string) => {
    if (!confirm('确定要删除这个映射关系吗？')) {
      return;
    }

    setLoading(true);
    
    try {
      setMappings(prev => prev.filter(mapping => mapping.id !== mappingId));
      toast.success('映射删除成功');
      onMappingUpdate?.(mappings);
      
    } catch (error) {
      console.error('删除映射失败:', error);
      toast.error('删除映射失败');
    } finally {
      setLoading(false);
    }
  };

  // 开始添加新映射
  const startAddNew = () => {
    setIsAddingNew(true);
    setEditForm({ chineseName: '', englishKey: '' });
  };

  // 跨部门搜索功能
  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }

    setIsSearching(true);
    try {
      const results = await cacheService.crossDepartmentSearch(query);
      setSearchResults({
        employees: results.employees,
        departments: results.departments
      });
      
      toast.success(`找到 ${results.employees.length} 名员工，${results.departments.length} 个部门`);
    } catch (error) {
      console.error('搜索失败:', error);
      toast.error('搜索失败，请检查网络连接');
      setSearchResults(null);
    } finally {
      setIsSearching(false);
    }
  };

  // 清空搜索结果
  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
  };

  // 测试映射
  const testMapping = (chineseName: string, englishKey: string) => {
    const config = getDepartmentConfigByChinese(chineseName);
    const englishFromChinese = getEnglishDeptKey(chineseName);
    const chineseFromEnglish = getChineseDeptName(englishKey);
    
    console.log('映射测试结果:', {
      chineseName,
      englishKey,
      hasConfig: !!config,
      englishFromChinese,
      chineseFromEnglish
    });
    
    toast.info(`映射测试: ${chineseName} ↔ ${englishKey}`);
  };

  useEffect(() => {
    // 页面初始化时预加载缓存并加载映射数据
    const initializeData = async () => {
      try {
        // 预加载缓存以减少后续加载时间
        await cacheService.preloadCache();
        console.log('[DepartmentMappingManager] 缓存预加载完成');
      } catch (error) {
        console.warn('[DepartmentMappingManager] 缓存预加载失败:', error);
      }
      
      // 加载映射数据
      await loadMappings();
    };
    
    initializeData();
  }, []);

  return (
    <div className="w-full bg-white rounded-lg shadow-sm border">
      <div className="p-6 border-b">
        <div className="flex items-center gap-2 mb-2">
          <Languages className="h-5 w-5" />
          <h2 className="text-lg font-semibold">部门名称映射管理</h2>
          {wsConnected && (
            <span className="px-2 py-1 text-xs bg-green-500 text-white rounded">
              实时同步
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600">
          管理中文部门名称与英文配置键的映射关系，确保系统正确识别和处理部门数据
        </p>
      </div>
      
      <div className="p-6">
        {/* 搜索功能区域 */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex gap-2 mb-3">
            <div className="flex-1">
              <input
                type="text"
                placeholder="跨部门搜索员工或部门..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (e.target.value.trim()) {
                    handleSearch(e.target.value);
                  } else {
                    clearSearch();
                  }
                }}
                disabled={isSearching}
              />
            </div>
            {searchQuery && (
              <button
                className="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
                onClick={clearSearch}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          
          {/* 搜索结果显示 */}
          {searchResults && (
            <div className="space-y-3">
              {searchResults.departments.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">找到的部门 ({searchResults.departments.length})</h4>
                  <div className="flex flex-wrap gap-2">
                    {searchResults.departments.map((dept) => (
                      <span key={dept.id} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                        {dept.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {searchResults.employees.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">找到的员工 ({searchResults.employees.length})</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {searchResults.employees.slice(0, 9).map((emp) => (
                      <div key={emp.id} className="px-3 py-2 text-xs bg-green-50 border border-green-200 rounded">
                        <div className="font-medium">{emp.name}</div>
                        <div className="text-gray-600">{emp.position || '未知职位'}</div>
                      </div>
                    ))}
                    {searchResults.employees.length > 9 && (
                      <div className="px-3 py-2 text-xs bg-gray-100 border border-gray-200 rounded text-center text-gray-600">
                        还有 {searchResults.employees.length - 9} 名员工...
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {searchResults.departments.length === 0 && searchResults.employees.length === 0 && (
                <div className="text-center py-4 text-gray-500">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>未找到匹配的结果</p>
                </div>
              )}
            </div>
          )}
          
          {isSearching && (
            <div className="text-center py-4">
              <RefreshCw className="h-6 w-6 mx-auto animate-spin text-blue-500" />
              <p className="text-sm text-gray-600 mt-2">搜索中...</p>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center mb-4">
          <div className="text-sm text-gray-500">
            共 {mappings.length} 个映射关系
          </div>
          <div className="flex gap-2">
            <button
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              onClick={loadMappings}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              刷新
            </button>
            <button
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              onClick={startAddNew}
              disabled={isAddingNew || editingId !== null}
            >
              <Plus className="h-4 w-4 mr-1" />
              新增映射
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {/* 新增映射表单 */}
          {isAddingNew && (
            <div className="border-2 border-dashed border-blue-300 rounded-lg bg-white">
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">中文名称</label>
                    <input
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={editForm.chineseName}
                      onChange={(e) => setEditForm(prev => ({ ...prev, chineseName: e.target.value }))}
                      placeholder="例如：技术部"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">英文配置键</label>
                    <input
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={editForm.englishKey}
                      onChange={(e) => setEditForm(prev => ({ ...prev, englishKey: e.target.value }))}
                      placeholder="例如：technology"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 flex items-center" onClick={cancelEdit}>
                    <X className="h-4 w-4 mr-1" />
                    取消
                  </button>
                  <button 
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    onClick={saveMapping}
                    disabled={loading || !validateMapping(editForm.chineseName, editForm.englishKey)}
                  >
                    <Save className="h-4 w-4 mr-1" />
                    保存
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 映射列表 */}
          {mappings.map((mapping) => (
            <div key={mapping.id} className={`bg-white rounded-lg border p-4 ${!mapping.isValid ? 'border-red-200' : ''}`}>
                {editingId === mapping.id ? (
                  // 编辑模式
                  <div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">中文名称</label>
                        <input
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={editForm.chineseName}
                          onChange={(e) => setEditForm(prev => ({ ...prev, chineseName: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">英文配置键</label>
                        <input
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={editForm.englishKey}
                          onChange={(e) => setEditForm(prev => ({ ...prev, englishKey: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 flex items-center" onClick={cancelEdit}>
                        <X className="h-4 w-4 mr-1" />
                        取消
                      </button>
                      <button 
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        onClick={saveMapping}
                        disabled={loading || !validateMapping(editForm.chineseName, editForm.englishKey)}
                      >
                        <Save className="h-4 w-4 mr-1" />
                        保存
                      </button>
                    </div>
                  </div>
                ) : (
                  // 显示模式
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-blue-600">{mapping.chineseName}</span>
                        <ArrowRightLeft className="h-4 w-4 text-gray-400" />
                        <span className="font-mono text-green-600">{mapping.englishKey}</span>
                      </div>
                      
                      <div className="flex gap-1">
                        {mapping.isValid ? (
                          <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded flex items-center">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            有效
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded flex items-center">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            无效
                          </span>
                        )}
                        
                        {mapping.hasConfig ? (
                          <span className="px-2 py-1 text-xs border border-blue-600 text-blue-600 rounded">
                            有配置
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs border border-gray-500 text-gray-500 rounded">
                            无配置
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-1">
                      <button
                        className="px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
                        onClick={() => testMapping(mapping.chineseName, mapping.englishKey)}
                      >
                        测试
                      </button>
                      <button
                        className="px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
                        onClick={() => startEdit(mapping)}
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        className="px-2 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                        onClick={() => deleteMapping(mapping.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
            </div>
          ))}
          
          {mappings.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Languages className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>暂无映射关系</p>
              <p className="text-sm">点击"新增映射"开始配置</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}