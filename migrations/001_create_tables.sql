-- 部门地图系统数据库初始化脚本
-- 创建所有必要的数据表

-- 启用UUID扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 部门表
CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    description TEXT,
    floor INTEGER,
    building VARCHAR(50),
    manager_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 员工表
CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    position VARCHAR(100),
    avatar_url TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_leave')),
    hire_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 工位表
CREATE TABLE IF NOT EXISTS desks (
    id SERIAL PRIMARY KEY,
    desk_number VARCHAR(20) UNIQUE NOT NULL,
    department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    position_x DECIMAL(10,2) NOT NULL,
    position_y DECIMAL(10,2) NOT NULL,
    width DECIMAL(8,2) DEFAULT 80,
    height DECIMAL(8,2) DEFAULT 60,
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance', 'reserved')),
    ip_address INET,
    computer_name VARCHAR(100),
    equipment_info TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 工位分配记录表
CREATE TABLE IF NOT EXISTS desk_assignments (
    id SERIAL PRIMARY KEY,
    desk_id INTEGER NOT NULL REFERENCES desks(id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    released_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'temporary')),
    notes TEXT,
    assigned_by INTEGER REFERENCES employees(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 用户账户表
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user')),
    employee_id INTEGER REFERENCES employees(id),
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 工作站详细信息表
CREATE TABLE IF NOT EXISTS workstation_info (
    id SERIAL PRIMARY KEY,
    desk_id INTEGER NOT NULL REFERENCES desks(id) ON DELETE CASCADE,
    ip_address INET NOT NULL,
    mac_address MACADDR,
    computer_name VARCHAR(100) NOT NULL,
    operating_system VARCHAR(100),
    cpu_info TEXT,
    memory_info TEXT,
    disk_info TEXT,
    network_info TEXT,
    last_online TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'maintenance')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 系统日志表
CREATE TABLE IF NOT EXISTS system_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id INTEGER,
    details TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 数据同步记录表
CREATE TABLE IF NOT EXISTS sync_records (
    id SERIAL PRIMARY KEY,
    sync_type VARCHAR(20) DEFAULT 'manual' CHECK (sync_type IN ('full', 'incremental', 'manual')),
    table_name VARCHAR(50) NOT NULL,
    records_affected INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'success' CHECK (status IN ('success', 'failed', 'partial')),
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_by INTEGER REFERENCES users(id)
);

-- 权限表
CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    resource VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 角色权限关联表
CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role VARCHAR(20) NOT NULL,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role, permission_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_employees_department_id ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_desks_department_id ON desks(department_id);
CREATE INDEX IF NOT EXISTS idx_desks_status ON desks(status);
CREATE INDEX IF NOT EXISTS idx_desk_assignments_desk_id ON desk_assignments(desk_id);
CREATE INDEX IF NOT EXISTS idx_desk_assignments_employee_id ON desk_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_desk_assignments_status ON desk_assignments(status);
CREATE INDEX IF NOT EXISTS idx_workstation_info_desk_id ON workstation_info(desk_id);
CREATE INDEX IF NOT EXISTS idx_workstation_info_status ON workstation_info(status);
CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON system_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_sync_records_table_name ON sync_records(table_name);
CREATE INDEX IF NOT EXISTS idx_sync_records_status ON sync_records(status);

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为需要的表创建更新时间触发器
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_desks_updated_at BEFORE UPDATE ON desks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_desk_assignments_updated_at BEFORE UPDATE ON desk_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_workstation_info_updated_at BEFORE UPDATE ON workstation_info FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_permissions_updated_at BEFORE UPDATE ON permissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 插入初始数据

-- 插入默认部门
INSERT INTO departments (name, code, description, floor, building) VALUES
('技术部', 'TECH', '负责系统开发和维护', 3, 'A座'),
('产品部', 'PROD', '负责产品设计和规划', 2, 'A座'),
('运营部', 'OPS', '负责日常运营管理', 2, 'A座'),
('人事部', 'HR', '负责人力资源管理', 1, 'A座')
ON CONFLICT (code) DO NOTHING;

-- 插入默认权限
INSERT INTO permissions (name, code, description, resource, action) VALUES
('查看部门', 'VIEW_DEPARTMENTS', '查看部门信息', 'departments', 'read'),
('管理部门', 'MANAGE_DEPARTMENTS', '创建、编辑、删除部门', 'departments', 'write'),
('查看员工', 'VIEW_EMPLOYEES', '查看员工信息', 'employees', 'read'),
('管理员工', 'MANAGE_EMPLOYEES', '创建、编辑、删除员工', 'employees', 'write'),
('查看工位', 'VIEW_DESKS', '查看工位信息', 'desks', 'read'),
('管理工位', 'MANAGE_DESKS', '创建、编辑、删除工位', 'desks', 'write'),
('分配工位', 'ASSIGN_DESKS', '分配和释放工位', 'desk_assignments', 'write'),
('查看系统日志', 'VIEW_LOGS', '查看系统操作日志', 'system_logs', 'read'),
('系统管理', 'SYSTEM_ADMIN', '系统管理员权限', 'system', 'admin')
ON CONFLICT (code) DO NOTHING;

-- 插入角色权限关联
INSERT INTO role_permissions (role, permission_id) 
SELECT 'admin', id FROM permissions
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO role_permissions (role, permission_id) 
SELECT 'manager', id FROM permissions WHERE code IN ('VIEW_DEPARTMENTS', 'VIEW_EMPLOYEES', 'VIEW_DESKS', 'ASSIGN_DESKS')
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO role_permissions (role, permission_id) 
SELECT 'user', id FROM permissions WHERE code IN ('VIEW_DEPARTMENTS', 'VIEW_EMPLOYEES', 'VIEW_DESKS')
ON CONFLICT (role, permission_id) DO NOTHING;

COMMIT;