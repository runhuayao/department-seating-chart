-- 创建部门表
CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    floor_number INTEGER,
    building VARCHAR(50),
    manager_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建员工表
CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    employee_id VARCHAR(50) UNIQUE,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20),
    department_id INTEGER REFERENCES departments(id),
    position VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_leave')),
    hire_date DATE,
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建工位表
CREATE TABLE IF NOT EXISTS workstations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    department_id INTEGER REFERENCES departments(id),
    employee_id INTEGER REFERENCES employees(id),
    x_position DECIMAL(10,2) NOT NULL,
    y_position DECIMAL(10,2) NOT NULL,
    width DECIMAL(10,2) DEFAULT 120,
    height DECIMAL(10,2) DEFAULT 80,
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance', 'reserved')),
    equipment TEXT,
    notes TEXT,
    floor_number INTEGER,
    building VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建用户表（用于认证）
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user', 'viewer')),
    employee_id INTEGER REFERENCES employees(id),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_employees_department_id ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_workstations_department_id ON workstations(department_id);
CREATE INDEX IF NOT EXISTS idx_workstations_employee_id ON workstations(employee_id);
CREATE INDEX IF NOT EXISTS idx_workstations_status ON workstations(status);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 添加外键约束（更新部门表的manager_id）
ALTER TABLE departments ADD CONSTRAINT fk_departments_manager 
    FOREIGN KEY (manager_id) REFERENCES employees(id);

-- 创建触发器函数用于自动更新updated_at字段
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为所有表创建updated_at触发器
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workstations_updated_at BEFORE UPDATE ON workstations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 插入初始数据

-- 插入部门数据
INSERT INTO departments (name, description, floor_number, building) VALUES
('Tech Dept', 'Technology Department', 3, 'Building A'),
('Marketing Dept', 'Marketing Department', 2, 'Building A'),
('HR Dept', 'Human Resources Department', 1, 'Building A'),
('Finance Dept', 'Finance Department', 1, 'Building A'),
('Operations Dept', 'Operations Department', 2, 'Building A')
ON CONFLICT (name) DO NOTHING;

-- 插入员工数据
INSERT INTO employees (name, employee_id, email, department_id, position, status) VALUES
('Zhang San', 'EMP001', 'zhangsan@company.com', 1, 'Senior Developer', 'active'),
('Li Si', 'EMP002', 'lisi@company.com', 1, 'Frontend Developer', 'active'),
('Wang Wu', 'EMP003', 'wangwu@company.com', 2, 'Marketing Manager', 'active'),
('Zhao Liu', 'EMP004', 'zhaoliu@company.com', 3, 'HR Specialist', 'active'),
('Qian Qi', 'EMP005', 'qianqi@company.com', 4, 'Financial Analyst', 'active')
ON CONFLICT (employee_id) DO NOTHING;

-- 插入工位数据
INSERT INTO workstations (name, department_id, employee_id, x_position, y_position, status, floor_number, building) VALUES
('工位-A301', 1, 1, 100, 100, 'occupied', 3, 'A座'),
('工位-A302', 1, 2, 250, 100, 'occupied', 3, 'A座'),
('工位-A303', 1, NULL, 400, 100, 'available', 3, 'A座'),
('工位-A201', 2, 3, 100, 200, 'occupied', 2, 'A座'),
('工位-A202', 2, NULL, 250, 200, 'available', 2, 'A座'),
('工位-A101', 3, 4, 100, 300, 'occupied', 1, 'A座'),
('工位-A102', 4, 5, 250, 300, 'occupied', 1, 'A座')
ON CONFLICT DO NOTHING;

-- 创建默认管理员用户
INSERT INTO users (username, email, password_hash, role) VALUES
('admin', 'admin@company.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uO8G', 'admin')
ON CONFLICT (username) DO NOTHING;

COMMIT;