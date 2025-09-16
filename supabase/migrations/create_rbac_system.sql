-- 创建角色表
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 创建权限表
CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  permission_name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  category VARCHAR(50) DEFAULT 'general',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 创建角色权限关联表
CREATE TABLE IF NOT EXISTS role_permissions (
  id SERIAL PRIMARY KEY,
  role_name VARCHAR(50) REFERENCES roles(name) ON DELETE CASCADE,
  permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(role_name, permission_id)
);

-- 更新用户表，添加权限相关字段
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_login_ip INET,
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为相关表添加更新时间触发器
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_roles_updated_at ON roles;
CREATE TRIGGER update_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 插入默认角色
INSERT INTO roles (name, description) VALUES
('super_admin', '超级管理员，拥有所有权限'),
('admin', '管理员，拥有大部分管理权限'),
('manager', '部门经理，拥有部门管理权限'),
('user', '普通用户，拥有基本操作权限')
ON CONFLICT (name) DO NOTHING;

-- 插入默认权限
INSERT INTO permissions (permission_name, description, category) VALUES
-- 用户管理权限
('user:create', '创建用户', 'user_management'),
('user:read', '查看用户信息', 'user_management'),
('user:update', '更新用户信息', 'user_management'),
('user:delete', '删除用户', 'user_management'),
('user:list', '查看用户列表', 'user_management'),

-- 角色权限管理
('role:create', '创建角色', 'role_management'),
('role:read', '查看角色信息', 'role_management'),
('role:update', '更新角色信息', 'role_management'),
('role:delete', '删除角色', 'role_management'),
('role:assign', '分配角色', 'role_management'),

-- 工位管理权限
('workstation:create', '创建工位', 'workstation_management'),
('workstation:read', '查看工位信息', 'workstation_management'),
('workstation:update', '更新工位信息', 'workstation_management'),
('workstation:delete', '删除工位', 'workstation_management'),
('workstation:assign', '分配工位', 'workstation_management'),
('workstation:modify', '修改工位状态', 'workstation_management'),
('workstation:admin', '工位管理员权限', 'workstation_management'),

-- 员工管理权限
('employee:create', '创建员工', 'employee_management'),
('employee:read', '查看员工信息', 'employee_management'),
('employee:update', '更新员工信息', 'employee_management'),
('employee:delete', '删除员工', 'employee_management'),
('employee:list', '查看员工列表', 'employee_management'),

-- 部门管理权限
('department:create', '创建部门', 'department_management'),
('department:read', '查看部门信息', 'department_management'),
('department:update', '更新部门信息', 'department_management'),
('department:delete', '删除部门', 'department_management'),
('department:manage', '管理部门', 'department_management'),

-- 系统监控权限
('system:monitor', '系统监控', 'system_management'),
('system:logs', '查看系统日志', 'system_management'),
('system:stats', '查看统计信息', 'system_management'),
('system:backup', '系统备份', 'system_management'),
('system:config', '系统配置', 'system_management'),

-- 数据同步权限
('data:sync', '数据同步', 'data_management'),
('data:export', '数据导出', 'data_management'),
('data:import', '数据导入', 'data_management'),

-- WebSocket权限
('websocket:connect', 'WebSocket连接', 'websocket'),
('websocket:broadcast', 'WebSocket广播', 'websocket')
ON CONFLICT (permission_name) DO NOTHING;

-- 分配权限给角色
-- 超级管理员拥有所有权限
INSERT INTO role_permissions (role_name, permission_id)
SELECT 'super_admin', id FROM permissions
ON CONFLICT (role_name, permission_id) DO NOTHING;

-- 管理员权限（除了超级管理员专有权限）
INSERT INTO role_permissions (role_name, permission_id)
SELECT 'admin', id FROM permissions 
WHERE permission_name NOT IN ('role:delete', 'system:backup', 'system:config')
ON CONFLICT (role_name, permission_id) DO NOTHING;

-- 部门经理权限
INSERT INTO role_permissions (role_name, permission_id)
SELECT 'manager', id FROM permissions 
WHERE permission_name IN (
  'user:read', 'user:list',
  'workstation:read', 'workstation:update', 'workstation:assign', 'workstation:modify',
  'employee:create', 'employee:read', 'employee:update', 'employee:list',
  'department:read', 'department:manage',
  'system:monitor', 'system:stats',
  'data:sync', 'data:export',
  'websocket:connect'
)
ON CONFLICT (role_name, permission_id) DO NOTHING;

-- 普通用户权限
INSERT INTO role_permissions (role_name, permission_id)
SELECT 'user', id FROM permissions 
WHERE permission_name IN (
  'user:read',
  'workstation:read',
  'employee:read',
  'department:read',
  'websocket:connect'
)
ON CONFLICT (role_name, permission_id) DO NOTHING;

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_name);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_employee_id ON users(employee_id);
CREATE INDEX IF NOT EXISTS idx_permissions_category ON permissions(category);

-- 创建权限查询视图
CREATE OR REPLACE VIEW user_permissions AS
SELECT 
  u.id as user_id,
  u.username,
  u.role,
  u.employee_id,
  e.department_id,
  p.permission_name,
  p.description as permission_description,
  p.category as permission_category
FROM users u
LEFT JOIN employees e ON u.employee_id = e.id
LEFT JOIN role_permissions rp ON u.role = rp.role_name
LEFT JOIN permissions p ON rp.permission_id = p.id
WHERE u.status = 'active';

-- 创建角色权限统计视图
CREATE OR REPLACE VIEW role_permission_stats AS
SELECT 
  r.name as role_name,
  r.description as role_description,
  COUNT(rp.permission_id) as permission_count,
  ARRAY_AGG(p.permission_name ORDER BY p.category, p.permission_name) as permissions
FROM roles r
LEFT JOIN role_permissions rp ON r.name = rp.role_name
LEFT JOIN permissions p ON rp.permission_id = p.id
GROUP BY r.name, r.description
ORDER BY r.name;

-- 启用行级安全策略（RLS）
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
-- 角色表策略
CREATE POLICY "Allow authenticated users to read roles" ON roles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admins to manage roles" ON roles
  FOR ALL TO authenticated 
  USING (auth.jwt() ->> 'role' IN ('admin', 'super_admin'));

-- 权限表策略
CREATE POLICY "Allow authenticated users to read permissions" ON permissions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admins to manage permissions" ON permissions
  FOR ALL TO authenticated 
  USING (auth.jwt() ->> 'role' IN ('admin', 'super_admin'));

-- 角色权限关联表策略
CREATE POLICY "Allow authenticated users to read role_permissions" ON role_permissions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admins to manage role_permissions" ON role_permissions
  FOR ALL TO authenticated 
  USING (auth.jwt() ->> 'role' IN ('admin', 'super_admin'));

-- 授予必要的权限
GRANT SELECT ON roles TO anon, authenticated;
GRANT SELECT ON permissions TO anon, authenticated;
GRANT SELECT ON role_permissions TO anon, authenticated;
GRANT SELECT ON user_permissions TO anon, authenticated;
GRANT SELECT ON role_permission_stats TO anon, authenticated;

GRANT ALL PRIVILEGES ON roles TO authenticated;
GRANT ALL PRIVILEGES ON permissions TO authenticated;
GRANT ALL PRIVILEGES ON role_permissions TO authenticated;

-- 创建权限检查函数
CREATE OR REPLACE FUNCTION check_user_permission(user_id INTEGER, required_permission TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  has_permission BOOLEAN := FALSE;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM user_permissions up
    WHERE up.user_id = $1 AND up.permission_name = $2
  ) INTO has_permission;
  
  RETURN has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建角色检查函数
CREATE OR REPLACE FUNCTION check_user_role(user_id INTEGER, required_roles TEXT[])
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role FROM users WHERE id = $1 AND status = 'active';
  
  RETURN user_role = ANY(required_roles);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;