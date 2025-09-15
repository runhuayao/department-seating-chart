-- PostgreSQL数据库增强初始化脚本 v2.0
-- 创建部门地图系统所需的表结构和全量索引

BEGIN;

-- 删除现有表（如果存在）以确保干净的重建
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

-- 创建系统日志表
CREATE TABLE system_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(100),
    details TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建全文搜索索引和性能优化索引
-- 基础索引
CREATE INDEX idx_departments_name ON departments(name);
CREATE INDEX idx_departments_building_floor ON departments(building, floor);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_department_id ON users(department_id);
CREATE INDEX idx_users_employee_id ON users(employee_id);
CREATE INDEX idx_users_status ON users(status);

CREATE INDEX idx_desks_desk_number ON desks(desk_number);
CREATE INDEX idx_desks_department_id ON desks(department_id);
CREATE INDEX idx_desks_status ON desks(status);
CREATE INDEX idx_desks_position ON desks(position_x, position_y);
CREATE INDEX idx_desks_ip_address ON desks(ip_address);

CREATE INDEX idx_employees_employee_id ON employees(employee_id);
CREATE INDEX idx_employees_name ON employees(name);
CREATE INDEX idx_employees_email ON employees(email);
CREATE INDEX idx_employees_department_id ON employees(department_id);
CREATE INDEX idx_employees_status ON employees(status);
CREATE INDEX idx_employees_desk_id ON employees(desk_id);

-- 全文搜索索引
CREATE INDEX idx_employees_name_trgm ON employees USING gin(name gin_trgm_ops);
CREATE INDEX idx_employees_position_trgm ON employees USING gin(position gin_trgm_ops);
CREATE INDEX idx_departments_name_trgm ON departments USING gin(name gin_trgm_ops);
CREATE INDEX idx_desks_desk_number_trgm ON desks USING gin(desk_number gin_trgm_ops);

-- 复合索引用于复杂查询
CREATE INDEX idx_employees_dept_status ON employees(department_id, status);
CREATE INDEX idx_desks_dept_status ON desks(department_id, status);
CREATE INDEX idx_search_logs_query_type ON search_logs(query, search_type);
CREATE INDEX idx_system_logs_user_action ON system_logs(user_id, action);

-- 插入部门数据
INSERT INTO departments (id, name, description, floor, building, location) VALUES
(1, '技术部', '负责系统开发、技术架构设计和系统维护', 3, 'A座', 'A座3楼东区'),
(2, '产品部', '负责产品设计、需求分析和产品规划', 2, 'A座', 'A座2楼西区'),
(3, '运营部', '负责日常运营管理、市场推广和客户服务', 1, 'A座', 'A座1楼南区'),
(4, '人事部', '负责人力资源管理、招聘和员工关系', 1, 'B座', 'B座1楼北区'),
(5, '财务部', '负责财务管理、预算控制和成本分析', 2, 'B座', 'B座2楼中区');

-- 插入用户数据
INSERT INTO users (id, username, password_hash, email, role, department_id, employee_id, status) VALUES
(1, 'admin', '$2b$12$rOzJqQjQjQjQjQjQjQjQjO', 'admin@company.com', 'admin', 1, 'EMP001', 'active'),
(2, 'tech_lead', '$2b$12$rOzJqQjQjQjQjQjQjQjQjO', 'tech.lead@company.com', 'manager', 1, 'EMP002', 'active'),
(3, 'product_manager', '$2b$12$rOzJqQjQjQjQjQjQjQjQjO', 'pm@company.com', 'manager', 2, 'EMP003', 'active'),
(4, 'hr_manager', '$2b$12$rOzJqQjQjQjQjQjQjQjQjO', 'hr@company.com', 'manager', 4, 'EMP004', 'active'),
(5, 'finance_lead', '$2b$12$rOzJqQjQjQjQjQjQjQjQjO', 'finance@company.com', 'manager', 5, 'EMP005', 'active');

-- 插入工位数据
INSERT INTO desks (id, desk_number, department_id, position_x, position_y, status, ip_address, computer_name, location) VALUES
-- 技术部工位
(1, 'TECH-001', 1, 100.0, 100.0, 'occupied', '192.168.1.101', 'TECH-PC-001', 'A座3楼技术部001'),
(2, 'TECH-002', 1, 250.0, 100.0, 'occupied', '192.168.1.102', 'TECH-PC-002', 'A座3楼技术部002'),
(3, 'TECH-003', 1, 400.0, 100.0, 'occupied', '192.168.1.103', 'TECH-PC-003', 'A座3楼技术部003'),
(4, 'TECH-004', 1, 100.0, 250.0, 'available', '192.168.1.104', 'TECH-PC-004', 'A座3楼技术部004'),
(5, 'TECH-005', 1, 250.0, 250.0, 'occupied', '192.168.1.105', 'TECH-PC-005', 'A座3楼技术部005'),
-- 产品部工位
(6, 'PROD-001', 2, 100.0, 100.0, 'occupied', '192.168.2.101', 'PROD-PC-001', 'A座2楼产品部001'),
(7, 'PROD-002', 2, 250.0, 100.0, 'occupied', '192.168.2.102', 'PROD-PC-002', 'A座2楼产品部002'),
(8, 'PROD-003', 2, 400.0, 100.0, 'available', '192.168.2.103', 'PROD-PC-003', 'A座2楼产品部003'),
-- 运营部工位
(9, 'OPS-001', 3, 100.0, 100.0, 'occupied', '192.168.3.101', 'OPS-PC-001', 'A座1楼运营部001'),
(10, 'OPS-002', 3, 250.0, 100.0, 'occupied', '192.168.3.102', 'OPS-PC-002', 'A座1楼运营部002'),
(11, 'OPS-003', 3, 400.0, 100.0, 'available', '192.168.3.103', 'OPS-PC-003', 'A座1楼运营部003'),
-- 人事部工位
(12, 'HR-001', 4, 100.0, 100.0, 'occupied', '192.168.4.101', 'HR-PC-001', 'B座1楼人事部001'),
(13, 'HR-002', 4, 250.0, 100.0, 'occupied', '192.168.4.102', 'HR-PC-002', 'B座1楼人事部002'),
-- 财务部工位
(14, 'FIN-001', 5, 100.0, 100.0, 'occupied', '192.168.5.101', 'FIN-PC-001', 'B座2楼财务部001'),
(15, 'FIN-002', 5, 250.0, 100.0, 'available', '192.168.5.102', 'FIN-PC-002', 'B座2楼财务部002');

-- 插入员工数据（覆盖所有部门）
INSERT INTO employees (id, employee_id, name, email, phone, department_id, position, status, hire_date, desk_id) VALUES
-- 技术部员工
(1, 'EMP001', '张三', 'zhangsan@company.com', '13800138001', 1, '技术总监', 'active', '2022-01-15', 1),
(2, 'EMP002', '李四', 'lisi@company.com', '13800138002', 1, '高级前端工程师', 'active', '2022-03-20', 2),
(3, 'EMP003', '王五', 'wangwu@company.com', '13800138003', 1, '后端工程师', 'active', '2022-05-10', 3),
(4, 'EMP004', '赵六', 'zhaoliu@company.com', '13800138004', 1, '全栈工程师', 'active', '2022-07-01', 5),
-- 产品部员工
(5, 'EMP005', '钱七', 'qianqi@company.com', '13800138005', 2, '产品经理', 'active', '2022-02-01', 6),
(6, 'EMP006', '孙八', 'sunba@company.com', '13800138006', 2, '产品设计师', 'active', '2022-04-15', 7),
-- 运营部员工
(7, 'EMP007', '周九', 'zhoujiu@company.com', '13800138007', 3, '运营经理', 'active', '2022-01-20', 9),
(8, 'EMP008', '吴十', 'wushi@company.com', '13800138008', 3, '市场专员', 'active', '2022-06-01', 10),
-- 人事部员工
(9, 'EMP009', '郑十一', 'zhengshiyi@company.com', '13800138009', 4, '人事经理', 'active', '2021-12-01', 12),
(10, 'EMP010', '王十二', 'wangshier@company.com', '13800138010', 4, '招聘专员', 'active', '2022-08-15', 13),
-- 财务部员工
(11, 'EMP011', '李十三', 'lishisan@company.com', '13800138011', 5, '财务经理', 'active', '2021-11-01', 14),
(12, 'EMP012', '张十四', 'zhangshisi@company.com', '13800138012', 5, '会计', 'active', '2022-09-01', NULL);

-- 更新部门经理ID
UPDATE departments SET manager_id = 1 WHERE id = 1; -- 技术部
UPDATE departments SET manager_id = 5 WHERE id = 2; -- 产品部
UPDATE departments SET manager_id = 7 WHERE id = 3; -- 运营部
UPDATE departments SET manager_id = 9 WHERE id = 4; -- 人事部
UPDATE departments SET manager_id = 11 WHERE id = 5; -- 财务部

-- 重置序列
SELECT setval('departments_id_seq', (SELECT MAX(id) FROM departments));
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('desks_id_seq', (SELECT MAX(id) FROM desks));
SELECT setval('employees_id_seq', (SELECT MAX(id) FROM employees));

-- 启用pg_trgm扩展（用于模糊搜索）
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 创建搜索视图
CREATE OR REPLACE VIEW employee_search_view AS
SELECT 
    e.id,
    e.employee_id,
    e.name,
    e.email,
    e.phone,
    e.position,
    e.status,
    d.name as department_name,
    d.building,
    d.floor,
    d.location as department_location,
    desk.desk_number,
    desk.location as desk_location,
    desk.ip_address,
    desk.position_x,
    desk.position_y
FROM employees e
LEFT JOIN departments d ON e.department_id = d.id
LEFT JOIN desks desk ON e.desk_id = desk.id
WHERE e.status = 'active';

-- 创建部门统计视图
CREATE OR REPLACE VIEW department_stats_view AS
SELECT 
    d.id,
    d.name,
    d.description,
    d.building,
    d.floor,
    d.location,
    COUNT(e.id) as employee_count,
    COUNT(desk.id) as total_desks,
    COUNT(CASE WHEN desk.status = 'occupied' THEN 1 END) as occupied_desks,
    COUNT(CASE WHEN desk.status = 'available' THEN 1 END) as available_desks
FROM departments d
LEFT JOIN employees e ON d.id = e.department_id AND e.status = 'active'
LEFT JOIN desks desk ON d.id = desk.department_id
GROUP BY d.id, d.name, d.description, d.building, d.floor, d.location;

COMMIT;

-- 插入初始搜索日志（用于测试）
INSERT INTO search_logs (query, search_type, results_count, ip_address) VALUES
('张三', 'employee', 1, '127.0.0.1'),
('技术部', 'department', 4, '127.0.0.1'),
('产品', 'mixed', 2, '127.0.0.1');

-- 验证数据完整性
DO $$
BEGIN
    RAISE NOTICE '数据库初始化完成！';
    RAISE NOTICE '部门数量: %', (SELECT COUNT(*) FROM departments);
    RAISE NOTICE '员工数量: %', (SELECT COUNT(*) FROM employees);
    RAISE NOTICE '工位数量: %', (SELECT COUNT(*) FROM desks);
    RAISE NOTICE '用户数量: %', (SELECT COUNT(*) FROM users);
    RAISE NOTICE '索引数量: %', (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public');
END $$;