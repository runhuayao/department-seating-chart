-- PostgreSQL数据库初始化脚本
-- 创建部门地图系统所需的表结构

-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE,
    role VARCHAR(20) DEFAULT 'user',
    department VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建部门表
CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    floor INTEGER,
    building VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建工位表
CREATE TABLE IF NOT EXISTS desks (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    ip_address VARCHAR(45),
    location VARCHAR(200),
    department VARCHAR(100),
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'available',
    equipment TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建员工表
CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    employee_id VARCHAR(50) UNIQUE,
    department VARCHAR(100),
    position VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    desk_id INTEGER REFERENCES desks(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建搜索日志表
CREATE TABLE IF NOT EXISTS search_logs (
    id SERIAL PRIMARY KEY,
    query VARCHAR(255),
    search_type VARCHAR(50),
    results_count INTEGER DEFAULT 0,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_desks_name ON desks(name);
CREATE INDEX IF NOT EXISTS idx_desks_department ON desks(department);
CREATE INDEX IF NOT EXISTS idx_employees_name ON employees(name);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_departments_name ON departments(name);

-- 插入初始部门数据
INSERT INTO departments (name, description, floor, building) VALUES
('技术部', '负责系统开发和维护', 3, 'A座'),
('产品部', '负责产品设计和规划', 2, 'A座'),
('运营部', '负责日常运营管理', 1, 'A座'),
('人事部', '负责人力资源管理', 1, 'B座'),
('财务部', '负责财务管理', 2, 'B座')
ON CONFLICT (name) DO NOTHING;

-- 插入初始用户数据
INSERT INTO users (username, password, email, role, department) VALUES
('admin', '$2b$10$rOzJqQjQjQjQjQjQjQjQjO', 'admin@company.com', 'admin', '技术部'),
('user1', '$2b$10$rOzJqQjQjQjQjQjQjQjQjO', 'user1@company.com', 'user', '产品部')
ON CONFLICT (username) DO NOTHING;

-- 插入初始工位数据
INSERT INTO desks (name, ip_address, location, department, status) VALUES
('W001', '192.168.1.101', 'A座3楼技术部001', '技术部', 'available'),
('W002', '192.168.1.102', 'A座3楼技术部002', '技术部', 'available'),
('W003', '192.168.1.103', 'A座2楼产品部001', '产品部', 'available'),
('W004', '192.168.1.104', 'A座2楼产品部002', '产品部', 'available'),
('W005', '192.168.1.105', 'A座1楼运营部001', '运营部', 'available')
ON CONFLICT (name) DO NOTHING;

-- 插入初始员工数据
INSERT INTO employees (name, employee_id, department, position, email) VALUES
('张三', 'EMP001', '技术部', '高级工程师', 'zhangsan@company.com'),
('李四', 'EMP002', '技术部', '前端工程师', 'lisi@company.com'),
('王五', 'EMP003', '产品部', '产品经理', 'wangwu@company.com'),
('赵六', 'EMP004', '运营部', '运营专员', 'zhaoliu@company.com')
ON CONFLICT (employee_id) DO NOTHING;

COMMIT;