-- M1阶段数据库基础表结构迁移脚本
-- 创建时间: 2024-01-15
-- 版本: v1.1.0-M1
-- 描述: 创建部门、员工、工位、分配关系等基础表

-- 1. 创建部门表
CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#3B82F6', -- 部门主题色
    layout_config JSONB, -- 布局配置信息
    map_image_url VARCHAR(255), -- 地图图片URL
    status VARCHAR(20) DEFAULT 'active', -- active, inactive
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. 创建员工表
CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    employee_number VARCHAR(50) UNIQUE, -- 工号
    department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    position VARCHAR(100), -- 职位
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20),
    avatar_url VARCHAR(255), -- 头像URL
    status VARCHAR(20) DEFAULT 'offline', -- online, offline, away
    last_seen TIMESTAMP WITH TIME ZONE,
    hire_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. 创建工位表
CREATE TABLE IF NOT EXISTS desks (
    id SERIAL PRIMARY KEY,
    desk_number VARCHAR(50) NOT NULL, -- 工位编号
    department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    position_x INTEGER NOT NULL, -- X坐标
    position_y INTEGER NOT NULL, -- Y坐标
    width INTEGER DEFAULT 80, -- 宽度
    height INTEGER DEFAULT 60, -- 高度
    status VARCHAR(20) DEFAULT 'available', -- available, occupied, maintenance, reserved
    equipment JSONB, -- 设备信息
    notes TEXT, -- 备注
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(department_id, desk_number)
);

-- 4. 创建工位分配表
CREATE TABLE IF NOT EXISTS desk_assignments (
    id SERIAL PRIMARY KEY,
    desk_id INTEGER NOT NULL REFERENCES desks(id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    released_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'active', -- active, inactive, temporary
    assignment_type VARCHAR(20) DEFAULT 'permanent', -- permanent, temporary, shared
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. 创建员工状态日志表（用于追踪状态变更历史）
CREATE TABLE IF NOT EXISTS employee_status_logs (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    old_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT,
    notes TEXT
);

-- 6. 创建系统配置表
CREATE TABLE IF NOT EXISTS system_configs (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value JSONB NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引以提高查询性能

-- 部门表索引
CREATE INDEX IF NOT EXISTS idx_departments_name ON departments(name);
CREATE INDEX IF NOT EXISTS idx_departments_status ON departments(status);

-- 员工表索引
CREATE INDEX IF NOT EXISTS idx_employees_department_id ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_employee_number ON employees(employee_number);
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
CREATE INDEX IF NOT EXISTS idx_employees_name ON employees(name);
CREATE INDEX IF NOT EXISTS idx_employees_is_active ON employees(is_active);

-- 工位表索引
CREATE INDEX IF NOT EXISTS idx_desks_department_id ON desks(department_id);
CREATE INDEX IF NOT EXISTS idx_desks_status ON desks(status);
CREATE INDEX IF NOT EXISTS idx_desks_desk_number ON desks(desk_number);
CREATE INDEX IF NOT EXISTS idx_desks_position ON desks(position_x, position_y);

-- 工位分配表索引
CREATE INDEX IF NOT EXISTS idx_desk_assignments_desk_id ON desk_assignments(desk_id);
CREATE INDEX IF NOT EXISTS idx_desk_assignments_employee_id ON desk_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_desk_assignments_status ON desk_assignments(status);
CREATE INDEX IF NOT EXISTS idx_desk_assignments_assigned_at ON desk_assignments(assigned_at);

-- 员工状态日志表索引
CREATE INDEX IF NOT EXISTS idx_employee_status_logs_employee_id ON employee_status_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_status_logs_changed_at ON employee_status_logs(changed_at);

-- 系统配置表索引
CREATE INDEX IF NOT EXISTS idx_system_configs_config_key ON system_configs(config_key);
CREATE INDEX IF NOT EXISTS idx_system_configs_is_active ON system_configs(is_active);

-- 创建触发器以自动更新 updated_at 字段
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为各表添加更新时间触发器
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_desks_updated_at BEFORE UPDATE ON desks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_desk_assignments_updated_at BEFORE UPDATE ON desk_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_configs_updated_at BEFORE UPDATE ON system_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 插入初始系统配置
INSERT INTO system_configs (config_key, config_value, description) VALUES
('app_version', '"1.1.0-M1"', 'Application version'),
('api_version', '"v1"', 'API version'),
('heartbeat_interval', '30000', 'Employee status heartbeat interval in milliseconds'),
('session_timeout', '3600000', 'Session timeout in milliseconds'),
('max_desk_assignments_per_employee', '1', 'Maximum number of desk assignments per employee')
ON CONFLICT (config_key) DO NOTHING;

-- 创建视图以简化常用查询

-- 当前活跃的工位分配视图
CREATE OR REPLACE VIEW active_desk_assignments AS
SELECT 
    da.id,
    da.desk_id,
    da.employee_id,
    da.assigned_at,
    da.assignment_type,
    d.desk_number,
    d.department_id,
    e.name as employee_name,
    e.status as employee_status,
    dept.name as department_name
FROM desk_assignments da
JOIN desks d ON da.desk_id = d.id
JOIN employees e ON da.employee_id = e.id
JOIN departments dept ON d.department_id = dept.id
WHERE da.status = 'active' AND da.released_at IS NULL;

-- 部门统计视图
CREATE OR REPLACE VIEW department_statistics AS
SELECT 
    d.id,
    d.name,
    d.display_name,
    COUNT(DISTINCT e.id) as total_employees,
    COUNT(DISTINCT CASE WHEN e.status = 'online' THEN e.id END) as online_employees,
    COUNT(DISTINCT CASE WHEN e.status = 'offline' THEN e.id END) as offline_employees,
    COUNT(DISTINCT desk.id) as total_desks,
    COUNT(DISTINCT CASE WHEN desk.status = 'occupied' THEN desk.id END) as occupied_desks,
    COUNT(DISTINCT CASE WHEN desk.status = 'available' THEN desk.id END) as available_desks,
    ROUND(
        CASE 
            WHEN COUNT(DISTINCT desk.id) > 0 
            THEN (COUNT(DISTINCT CASE WHEN desk.status = 'occupied' THEN desk.id END)::DECIMAL / COUNT(DISTINCT desk.id)) * 100 
            ELSE 0 
        END, 2
    ) as utilization_rate
FROM departments d
LEFT JOIN employees e ON d.id = e.department_id AND e.is_active = true
LEFT JOIN desks desk ON d.id = desk.department_id
GROUP BY d.id, d.name, d.display_name;

COMMIT;