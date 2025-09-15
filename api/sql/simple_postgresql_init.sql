-- PostgreSQL数据库简化初始化脚本
-- 创建部门地图系统所需的基本表结构

BEGIN;

-- 删除现有表（如果存在）
DROP TABLE IF EXISTS search_logs CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS desks CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS departments CASCADE;

-- 创建部门表
CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    floor INTEGER,
    building VARCHAR(50),
    manager_id INTEGER,
    location VARCHAR(200),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建用户表
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE,
    role VARCHAR(20) DEFAULT 'user',
    department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    employee_id VARCHAR(50) UNIQUE,
    status VARCHAR(20) DEFAULT 'active',
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建工位表
CREATE TABLE desks (
    id SERIAL PRIMARY KEY,
    desk_number VARCHAR(50) UNIQUE NOT NULL,
    department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE,
    position_x DECIMAL(10,2),
    position_y DECIMAL(10,2),
    width DECIMAL(8,2) DEFAULT 120.0,
    height DECIMAL(8,2) DEFAULT 80.0,
    status VARCHAR(20) DEFAULT 'available',
    ip_address VARCHAR(45),
    computer_name VARCHAR(100),
    equipment_info TEXT,
    location VARCHAR(200),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建员工表
CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    phone VARCHAR(20),
    department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    position VARCHAR(100),
    avatar_url VARCHAR(500),
    status VARCHAR(20) DEFAULT 'active',
    hire_date DATE,
    desk_id INTEGER REFERENCES desks(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建搜索日志表
CREATE TABLE search_logs (
    id SERIAL PRIMARY KEY,
    query VARCHAR(255) NOT NULL,
    search_type VARCHAR(50),
    results_count INTEGER DEFAULT 0,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    ip_address VARCHAR(45),
    response_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建基础索引
CREATE INDEX idx_departments_name ON departments(name);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_desks_desk_number ON desks(desk_number);
CREATE INDEX idx_employees_employee_id ON employees(employee_id);
CREATE INDEX idx_employees_name ON employees(name);

-- 插入基础部门数据
INSERT INTO departments (id, name, description, floor, building, location) VALUES
(1, 'Tech Department', 'Technology and Development', 3, 'Building A', 'A3F East'),
(2, 'Product Department', 'Product Design and Planning', 2, 'Building A', 'A2F West'),
(3, 'Operations Department', 'Daily Operations and Marketing', 1, 'Building A', 'A1F South'),
(4, 'HR Department', 'Human Resources Management', 1, 'Building B', 'B1F North'),
(5, 'Finance Department', 'Financial Management', 2, 'Building B', 'B2F Center');

-- 插入基础用户数据
INSERT INTO users (id, username, password_hash, email, role, department_id, employee_id, status) VALUES
(1, 'admin', '$2b$12$rOzJqQjQjQjQjQjQjQjQjO', 'admin@company.com', 'admin', 1, 'EMP001', 'active'),
(2, 'tech_user', '$2b$12$rOzJqQjQjQjQjQjQjQjQjO', 'tech@company.com', 'user', 1, 'EMP002', 'active'),
(3, 'product_user', '$2b$12$rOzJqQjQjQjQjQjQjQjQjO', 'product@company.com', 'user', 2, 'EMP003', 'active');

-- 插入基础工位数据
INSERT INTO desks (id, desk_number, department_id, position_x, position_y, status, ip_address, location) VALUES
(1, 'TECH-001', 1, 100.0, 100.0, 'occupied', '192.168.1.101', 'A3F Tech Area 001'),
(2, 'TECH-002', 1, 250.0, 100.0, 'available', '192.168.1.102', 'A3F Tech Area 002'),
(3, 'PROD-001', 2, 100.0, 100.0, 'occupied', '192.168.2.101', 'A2F Product Area 001'),
(4, 'PROD-002', 2, 250.0, 100.0, 'available', '192.168.2.102', 'A2F Product Area 002');

-- 插入基础员工数据
INSERT INTO employees (id, employee_id, name, email, phone, department_id, position, status, desk_id) VALUES
(1, 'EMP001', 'Admin User', 'admin@company.com', '13800138001', 1, 'System Administrator', 'active', 1),
(2, 'EMP002', 'Tech User', 'tech@company.com', '13800138002', 1, 'Software Engineer', 'active', NULL),
(3, 'EMP003', 'Product User', 'product@company.com', '13800138003', 2, 'Product Manager', 'active', 3);

-- 更新部门经理ID
UPDATE departments SET manager_id = 1 WHERE id = 1;
UPDATE departments SET manager_id = 3 WHERE id = 2;

COMMIT;