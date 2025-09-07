import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Edit, Trash2, Shield, Eye, EyeOff } from 'lucide-react';
import { rbacService } from '../services/rbacService';
import { User, Role } from '../types/rbac';

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');

  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    roleIds: [] as string[],
    isActive: true
  });

  const canManageUsers = rbacService.hasPermission('user', 'create') || rbacService.hasPermission('user', 'update');
  const canDeleteUsers = rbacService.hasPermission('user', 'delete');
  const canViewUsers = rbacService.hasPermission('user', 'read');

  useEffect(() => {
    if (canViewUsers) {
      setUsers(rbacService.getUsers());
      setRoles(rbacService.getRoles());
    }
  }, [canViewUsers]);

  const handleCreateUser = () => {
    if (!canManageUsers) {
      alert('权限不足：无法创建用户');
      return;
    }

    const selectedRoles = roles.filter(role => newUser.roleIds.includes(role.id));
    const userData = {
      username: newUser.username,
      email: newUser.email,
      roles: selectedRoles,
      isActive: newUser.isActive
    };

    const createdUser = rbacService.createUser(userData);
    if (createdUser) {
      setUsers(rbacService.getUsers());
      setShowCreateUser(false);
      setNewUser({
        username: '',
        email: '',
        password: '',
        roleIds: [],
        isActive: true
      });
    }
  };

  const handleUpdateUser = (user: User) => {
    if (!canManageUsers) {
      alert('权限不足：无法更新用户');
      return;
    }

    const updatedUser = rbacService.updateUser(user.id, user);
    if (updatedUser) {
      setUsers(rbacService.getUsers());
      setEditingUser(null);
    }
  };

  const handleDeleteUser = (userId: string) => {
    if (!canDeleteUsers) {
      alert('权限不足：无法删除用户');
      return;
    }

    if (confirm('确定要删除这个用户吗？')) {
      const success = rbacService.deleteUser(userId);
      if (success) {
        setUsers(rbacService.getUsers());
      }
    }
  };

  const getRoleNames = (userRoles: Role[]) => {
    return userRoles.map(role => role.name).join(', ');
  };

  const getPermissionCount = (userRoles: Role[]) => {
    const permissions = new Set();
    userRoles.forEach(role => {
      role.permissions.forEach(permission => {
        permissions.add(`${permission.resource}:${permission.action}`);
      });
    });
    return permissions.size;
  };

  if (!canViewUsers) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center py-8">
          <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">权限不足</h3>
          <p className="text-gray-500">您没有权限查看用户管理功能</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 标签页 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('users')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'users'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              用户管理
            </button>
            <button
              onClick={() => setActiveTab('roles')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'roles'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              角色权限
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'users' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">用户列表</h3>
                {canManageUsers && (
                  <button
                    onClick={() => setShowCreateUser(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>添加用户</span>
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        用户信息
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        角色
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        权限数量
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        状态
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        最后登录
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{user.username}</div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{getRoleNames(user.roles)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {getPermissionCount(user.roles)} 个权限
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {user.isActive ? '活跃' : '禁用'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.lastLogin ? user.lastLogin.toLocaleString() : '从未登录'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => setSelectedUser(user)}
                              className="text-blue-600 hover:text-blue-900"
                              title="查看详情"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {canManageUsers && (
                              <button
                                onClick={() => setEditingUser(user)}
                                className="text-indigo-600 hover:text-indigo-900"
                                title="编辑用户"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            )}
                            {canDeleteUsers && user.username !== 'admin' && (
                              <button
                                onClick={() => handleDeleteUser(user.id)}
                                className="text-red-600 hover:text-red-900"
                                title="删除用户"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'roles' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-6">角色权限</h3>
              <div className="grid gap-6 md:grid-cols-2">
                {roles.map((role) => (
                  <div key={role.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">{role.name}</h4>
                      {role.isSystem && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          系统角色
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{role.description}</p>
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-gray-700">权限列表：</div>
                      <div className="flex flex-wrap gap-1">
                        {role.permissions.map((permission) => (
                          <span
                            key={permission.id}
                            className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700"
                          >
                            {permission.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 创建用户弹窗 */}
      {showCreateUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">创建新用户</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="请输入用户名"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="请输入邮箱"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">角色</label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {roles.map((role) => (
                    <label key={role.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={newUser.roleIds.includes(role.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewUser(prev => ({ ...prev, roleIds: [...prev.roleIds, role.id] }));
                          } else {
                            setNewUser(prev => ({ ...prev, roleIds: prev.roleIds.filter(id => id !== role.id) }));
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{role.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={newUser.isActive}
                  onChange={(e) => setNewUser(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                  启用用户
                </label>
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleCreateUser}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
              >
                创建
              </button>
              <button
                onClick={() => setShowCreateUser(false)}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 用户详情弹窗 */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">用户详情</h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">用户名</label>
                  <p className="text-sm text-gray-900">{selectedUser.username}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">邮箱</label>
                  <p className="text-sm text-gray-900">{selectedUser.email}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">状态</label>
                  <p className={`text-sm ${selectedUser.isActive ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedUser.isActive ? '活跃' : '禁用'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">创建时间</label>
                  <p className="text-sm text-gray-900">{selectedUser.createdAt.toLocaleString()}</p>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">角色</label>
                <div className="flex flex-wrap gap-2">
                  {selectedUser.roles.map((role) => (
                    <span key={role.id} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {role.name}
                    </span>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">权限</label>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {selectedUser.roles.flatMap(role => role.permissions).map((permission) => (
                    <div key={permission.id} className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
                      {permission.name} - {permission.description}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setSelectedUser(null)}
                className="bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;