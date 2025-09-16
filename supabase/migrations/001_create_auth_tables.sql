-- 用户认证与授权系统数据表创建
-- 基于M1用户认证与授权系统设计方案

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 创建部门表
CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    parent_id INTEGER REFERENCES departments(id),
    level INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by INTEGER,
    updated_by INTEGER
);

-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    employee_number VARCHAR(50) UNIQUE,
    department_id INTEGER REFERENCES departments(id),
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'department_admin', 'user')),
    is_active BOOLEAN DEFAULT true,
    
    -- 登录相关字段
    last_login TIMESTAMP,
    failed_login_attempts INTEGER DEFAULT 0,
    last_failed_login TIMESTAMP,
    password_changed_at TIMESTAMP,
    
    -- 令牌相关字段
    refresh_token TEXT,
    reset_token TEXT,
    reset_token_expires TIMESTAMP,
    
    -- 审计字段
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by INTEGER,
    updated_by INTEGER
);

-- 创建用户会话表
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token TEXT NOT NULL UNIQUE,
    refresh_token TEXT,
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    last_accessed TIMESTAMP DEFAULT NOW()
);

-- 创建权限表
CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    resource VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 创建角色权限关联表
CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role VARCHAR(20) NOT NULL,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(role, permission_id)
);

-- 创建用户权限表（用户特殊权限）
CREATE TABLE IF NOT EXISTS user_permissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted_by INTEGER REFERENCES users(id),
    granted_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(user_id, permission_id)
);

-- 创建审计日志表
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    username VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100),
    resource_id VARCHAR(100),
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 创建WebSocket连接记录表
CREATE TABLE IF NOT EXISTS websocket_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    connection_id VARCHAR(100) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    connected_at TIMESTAMP DEFAULT NOW(),
    disconnected_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    last_activity TIMESTAMP DEFAULT NOW()
);

-- 创建系统配置表
CREATE TABLE IF NOT EXISTS system_configs (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) NOT NULL UNIQUE,
    value TEXT,
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by INTEGER REFERENCES users(id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_department_id ON users(department_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_is_active ON user_sessions(is_active);

CREATE INDEX IF NOT EXISTS idx_departments_parent_id ON departments(parent_id);
CREATE INDEX IF NOT EXISTS idx_departments_is_active ON departments(is_active);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource);

CREATE INDEX IF NOT EXISTS idx_websocket_connections_user_id ON websocket_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_websocket_connections_is_active ON websocket_connections(is_active);

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为需要的表添加更新时间触发器
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_configs_updated_at BEFORE UPDATE ON system_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 插入默认部门数据
INSERT INTO departments (name, description, level, sort_order) VALUES
('总经理办公室', '公司最高管理层', 1, 1),
('人力资源部', '负责人员招聘、培训、薪酬管理', 1, 2),
('财务部', '负责财务管理、会计核算', 1, 3),
('技术部', '负责技术研发、系统维护', 1, 4),
('市场部', '负责市场推广、客户关系', 1, 5),
('运营部', '负责日常运营管理', 1, 6)
ON CONFLICT (name) DO NOTHING;

-- 插入默认权限数据
INSERT INTO permissions (name, description, resource, action) VALUES
-- 用户管理权限
('user.view', '查看用户信息', 'user', 'view'),
('user.create', '创建用户', 'user', 'create'),
('user.update', '更新用户信息', 'user', 'update'),
('user.delete', '删除用户', 'user', 'delete'),
('user.manage', '管理用户（包含所有用户操作）', 'user', 'manage'),

-- 部门管理权限
('department.view', '查看部门信息', 'department', 'view'),
('department.create', '创建部门', 'department', 'create'),
('department.update', '更新部门信息', 'department', 'update'),
('department.delete', '删除部门', 'department', 'delete'),
('department.manage', '管理部门（包含所有部门操作）', 'department', 'manage'),

-- 系统管理权限
('system.config', '系统配置管理', 'system', 'config'),
('system.monitor', '系统监控', 'system', 'monitor'),
('system.audit', '审计日志查看', 'system', 'audit'),

-- 数据权限
('data.export', '数据导出', 'data', 'export'),
('data.import', '数据导入', 'data', 'import')
ON CONFLICT (name) DO NOTHING;

-- 插入角色权限关联数据
INSERT INTO role_permissions (role, permission_id) 
SELECT 'admin', id FROM permissions
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO role_permissions (role, permission_id) 
SELECT 'department_admin', id FROM permissions 
WHERE name IN (
    'user.view', 'user.update', 
    'department.view', 'department.update',
    'system.monitor'
)
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO role_permissions (role, permission_id) 
SELECT 'user', id FROM permissions 
WHERE name IN ('user.view', 'department.view')
ON CONFLICT (role, permission_id) DO NOTHING;

-- 插入默认管理员用户（密码: admin123）
INSERT INTO users (
    username, 
    email, 
    password_hash, 
    full_name, 
    employee_number, 
    department_id, 
    role, 
    is_active
) VALUES (
    'admin',
    'admin@company.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uO8G', -- admin123
    '系统管理员',
    'EMP001',
    1,
    'admin',
    true
)
ON CONFLICT (username) DO NOTHING;

-- 插入系统配置
INSERT INTO system_configs (key, value, description, is_public) VALUES
('system.name', '部门地图系统', '系统名称', true),
('system.version', '3.1.0', '系统版本', true),
('auth.session_timeout', '86400', '会话超时时间（秒）', false),
('auth.max_login_attempts', '5', '最大登录尝试次数', false),
('auth.lockout_duration', '1800', '账户锁定时间（秒）', false),
('websocket.max_connections_per_user', '5', '每用户最大WebSocket连接数', false)
ON CONFLICT (key) DO NOTHING;

-- 启用行级安全策略（RLS）
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE websocket_connections ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略

-- 用户表策略
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (id = current_setting('app.current_user_id')::integer);

CREATE POLICY "Admins can view all users" ON users
    FOR SELECT USING (current_setting('app.current_user_role') = 'admin');

CREATE POLICY "Department admins can view department users" ON users
    FOR SELECT USING (
        current_setting('app.current_user_role') = 'department_admin' AND
        department_id = current_setting('app.current_department_id')::integer
    );

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (id = current_setting('app.current_user_id')::integer);

CREATE POLICY "Admins can manage all users" ON users
    FOR ALL USING (current_setting('app.current_user_role') = 'admin');

-- 部门表策略
CREATE POLICY "All authenticated users can view departments" ON departments
    FOR SELECT USING (current_setting('app.current_user_id') IS NOT NULL);

CREATE POLICY "Admins can manage departments" ON departments
    FOR ALL USING (current_setting('app.current_user_role') = 'admin');

-- 用户会话策略
CREATE POLICY "Users can view own sessions" ON user_sessions
    FOR SELECT USING (user_id = current_setting('app.current_user_id')::integer);

CREATE POLICY "Admins can view all sessions" ON user_sessions
    FOR SELECT USING (current_setting('app.current_user_role') = 'admin');

-- 审计日志策略
CREATE POLICY "Users can view own audit logs" ON audit_logs
    FOR SELECT USING (user_id = current_setting('app.current_user_id')::integer);

CREATE POLICY "Admins can view all audit logs" ON audit_logs
    FOR SELECT USING (current_setting('app.current_user_role') = 'admin');

-- WebSocket连接策略
CREATE POLICY "Users can view own connections" ON websocket_connections
    FOR SELECT USING (user_id = current_setting('app.current_user_id')::integer);

CREATE POLICY "Admins can view all connections" ON websocket_connections
    FOR SELECT USING (current_setting('app.current_user_role') = 'admin');

-- 授予权限给角色
GRANT SELECT ON departments TO anon, authenticated;
GRANT SELECT ON permissions TO authenticated;
GRANT SELECT ON role_permissions TO authenticated;
GRANT SELECT ON system_configs TO anon, authenticated;

GRANT ALL PRIVILEGES ON users TO authenticated;
GRANT ALL PRIVILEGES ON user_sessions TO authenticated;
GRANT ALL PRIVILEGES ON user_permissions TO authenticated;
GRANT ALL PRIVILEGES ON audit_logs TO authenticated;
GRANT ALL PRIVILEGES ON websocket_connections TO authenticated;

GRANT ALL PRIVILEGES ON departments TO authenticated;
GRANT ALL PRIVILEGES ON permissions TO authenticated;
GRANT ALL PRIVILEGES ON role_permissions TO authenticated;
GRANT ALL PRIVILEGES ON system_configs TO authenticated;

-- 授予序列权限
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 创建视图：用户详细信息（包含部门信息）
CREATE OR REPLACE VIEW user_details AS
SELECT 
    u.id,
    u.username,
    u.email,
    u.full_name,
    u.employee_number,
    u.role,
    u.is_active,
    u.last_login,
    u.created_at,
    d.name as department_name,
    d.id as department_id
FROM users u
LEFT JOIN departments d ON u.department_id = d.id;

-- 创建视图：部门统计信息
CREATE OR REPLACE VIEW department_stats AS
SELECT 
    d.id,
    d.name,
    d.description,
    d.level,
    COUNT(u.id) as user_count,
    COUNT(CASE WHEN u.is_active THEN 1 END) as active_user_count,
    d.created_at
FROM departments d
LEFT JOIN users u ON d.id = u.department_id
GROUP BY d.id, d.name, d.description, d.level, d.created_at;

-- 授予视图权限
GRANT SELECT ON user_details TO authenticated;
GRANT SELECT ON department_stats TO authenticated;

COMMIT;