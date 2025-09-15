-- Enhanced PostgreSQL 初始化脚本
-- 包含完整的数据库结构和内存数据库导出的数据
-- 生成时间: 2025-09-15

-- 创建数据库（如果不存在）
-- CREATE DATABASE department_map;
-- \c department_map;

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 删除现有表（如果存在）
DROP TABLE IF EXISTS desk_assignments CASCADE;
DROP TABLE IF EXISTS desks CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 创建部门表
CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_id INTEGER REFERENCES departments(id),
    manager_id INTEGER,
    location VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建员工表
CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    position VARCHAR(100),
    department_id INTEGER NOT NULL REFERENCES departments(id),
    hire_date DATE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated')),
    employee_number VARCHAR(50) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建工位表
CREATE TABLE desks (
    id SERIAL PRIMARY KEY,
    desk_number VARCHAR(50) NOT NULL UNIQUE,
    department_id INTEGER NOT NULL REFERENCES departments(id),
    floor INTEGER,
    area VARCHAR(100),
    x_position DECIMAL(10,2),
    y_position DECIMAL(10,2),
    width DECIMAL(10,2) DEFAULT 120,
    height DECIMAL(10,2) DEFAULT 80,
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance', 'reserved')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建工位分配表
CREATE TABLE desk_assignments (
    id SERIAL PRIMARY KEY,
    desk_id INTEGER NOT NULL REFERENCES desks(id),
    employee_id INTEGER NOT NULL REFERENCES employees(id),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    unassigned_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'temporary')),
    notes TEXT,
    UNIQUE(desk_id, employee_id, assigned_at)
);

-- 创建用户表
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user')),
    employee_id INTEGER REFERENCES employees(id),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 添加外键约束
ALTER TABLE departments ADD CONSTRAINT fk_departments_manager 
    FOREIGN KEY (manager_id) REFERENCES employees(id) DEFERRABLE INITIALLY DEFERRED;

-- 创建索引
CREATE INDEX idx_employees_department ON employees(department_id);
CREATE INDEX idx_employees_status ON employees(status);
CREATE INDEX idx_employees_email ON employees(email);
CREATE INDEX idx_desks_department ON desks(department_id);
CREATE INDEX idx_desks_status ON desks(status);
CREATE INDEX idx_desk_assignments_desk ON desk_assignments(desk_id);
CREATE INDEX idx_desk_assignments_employee ON desk_assignments(employee_id);
CREATE INDEX idx_desk_assignments_status ON desk_assignments(status);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_employee ON users(employee_id);

-- 创建全文搜索索引
CREATE INDEX idx_employees_name_gin ON employees USING gin(to_tsvector('simple', name));
CREATE INDEX idx_departments_name_gin ON departments USING gin(to_tsvector('simple', name || ' ' || display_name));

-- 插入内存数据库导出的数据
-- 清空现有数据（按依赖关系顺序）
TRUNCATE TABLE desk_assignments, desks, employees, departments, users RESTART IDENTITY CASCADE;

-- 插入部门数据
INSERT INTO departments (id, name, display_name, description, parent_id, manager_id, location, created_at, updated_at) VALUES
    (1, '技术部', '技术部', '负责公司技术研发和系统维护', NULL, 1, '3楼', NOW(), NOW()),
    (2, '市场部', '市场部', '负责市场推广和客户关系维护', NULL, 4, '2楼', NOW(), NOW()),
    (3, '人事部', '人事部', '负责人力资源管理和招聘', NULL, 6, '1楼', NOW(), NOW()),
    (4, '产品部', '产品部', '负责产品设计和用户体验', NULL, 9, '4楼', NOW(), NOW()),
    (5, '运营部', '运营部', '负责业务运营和数据分析', NULL, 12, '2楼', NOW(), NOW());

-- 插入员工数据
INSERT INTO employees (id, name, email, phone, position, department_id, hire_date, status, employee_number, created_at, updated_at) VALUES
    (1, '张三', 'zhangsan@company.com', '13800138001', '技术经理', 1, '2023-01-15', 'active', 'EMP001', NOW(), NOW()),
    (2, '李四', 'lisi@company.com', '13800138002', '前端开发', 1, '2023-02-01', 'active', 'EMP002', NOW(), NOW()),
    (3, '王五', 'wangwu@company.com', '13800138003', '后端开发', 1, '2023-02-15', 'active', 'EMP003', NOW(), NOW()),
    (4, '赵六', 'zhaoliu@company.com', '13800138004', '市场经理', 2, '2023-01-10', 'active', 'EMP004', NOW(), NOW()),
    (5, '钱七', 'qianqi@company.com', '13800138005', '销售代表', 2, '2023-03-01', 'active', 'EMP005', NOW(), NOW()),
    (6, '孙八', 'sunba@company.com', '13800138006', '人事经理', 3, '2022-12-01', 'active', 'EMP006', NOW(), NOW()),
    (7, '周九', 'zhoujiu@company.com', '13800138007', '招聘专员', 3, '2023-04-01', 'active', 'EMP007', NOW(), NOW()),
    (8, '吴十', 'wushi@company.com', '13800138008', '薪酬专员', 3, '2023-05-15', 'active', 'EMP008', NOW(), NOW()),
    (9, '郑十一', 'zhengshiyi@company.com', '13800138009', '产品经理', 4, '2022-11-01', 'active', 'EMP009', NOW(), NOW()),
    (10, '王十二', 'wangshier@company.com', '13800138010', 'UI设计师', 4, '2023-03-15', 'active', 'EMP010', NOW(), NOW()),
    (11, '冯十三', 'fengshisan@company.com', '13800138011', 'UX设计师', 4, '2023-06-01', 'active', 'EMP011', NOW(), NOW()),
    (12, '陈十四', 'chenshisi@company.com', '13800138012', '运营经理', 5, '2022-10-01', 'active', 'EMP012', NOW(), NOW()),
    (13, '褚十五', 'chushiwu@company.com', '13800138013', '数据分析师', 5, '2023-07-01', 'active', 'EMP013', NOW(), NOW()),
    (14, '卫十六', 'weishiliu@company.com', '13800138014', '内容运营', 5, '2023-08-15', 'active', 'EMP014', NOW(), NOW());

-- 插入工位数据
INSERT INTO desks (id, desk_number, department_id, floor, area, x_position, y_position, width, height, status, created_at, updated_at) VALUES
    (1, 'A001', 1, 3, '开发区A', 100, 100, 120, 80, 'available', NOW(), NOW()),
    (2, 'A002', 1, 3, '开发区A', 250, 100, 120, 80, 'occupied', NOW(), NOW()),
    (3, 'A003', 1, 3, '开发区A', 400, 100, 120, 80, 'occupied', NOW(), NOW()),
    (4, 'B001', 2, 2, '市场区B', 100, 200, 120, 80, 'occupied', NOW(), NOW()),
    (5, 'B002', 2, 2, '市场区B', 250, 200, 120, 80, 'available', NOW(), NOW());

-- 插入工位分配数据
INSERT INTO desk_assignments (desk_id, employee_id, assigned_at, status) VALUES
    (2, 2, NOW(), 'active'),
    (3, 3, NOW(), 'active'),
    (4, 4, NOW(), 'active');

-- 插入用户数据
INSERT INTO users (id, username, password_hash, email, role, employee_id, status, created_at, updated_at) VALUES
    (1, 'admin', '$2b$12$Mz.2uGUBIsUUTqfrYzV2P.bEuwCwES.k19u7fG3HED44OnHKc30.G', 'admin@company.com', 'admin', 1, 'active', NOW(), NOW()),
    (2, 'manager', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uO.G', 'manager@company.com', 'manager', 4, 'active', NOW(), NOW());

-- 重置序列
SELECT setval('departments_id_seq', 5);
SELECT setval('employees_id_seq', 14);
SELECT setval('desks_id_seq', 5);
SELECT setval('users_id_seq', 2);

-- 创建触发器函数用于更新 updated_at 字段
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为所有表创建更新触发器
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_desks_updated_at BEFORE UPDATE ON desks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 创建视图用于复杂查询
CREATE VIEW employee_desk_view AS
SELECT 
    e.id as employee_id,
    e.name as employee_name,
    e.email,
    e.position,
    d.name as department_name,
    d.display_name as department_display_name,
    desk.desk_number,
    desk.floor,
    desk.area,
    desk.x_position,
    desk.y_position,
    da.assigned_at,
    da.status as assignment_status
FROM employees e
JOIN departments d ON e.department_id = d.id
LEFT JOIN desk_assignments da ON e.id = da.employee_id AND da.status = 'active'
LEFT JOIN desks desk ON da.desk_id = desk.id
WHERE e.status = 'active';

-- 创建部门统计视图
CREATE VIEW department_stats_view AS
SELECT 
    d.id,
    d.name,
    d.display_name,
    d.location,
    COUNT(e.id) as employee_count,
    COUNT(desk.id) as desk_count,
    COUNT(da.id) as occupied_desk_count,
    (COUNT(desk.id) - COUNT(da.id)) as available_desk_count
FROM departments d
LEFT JOIN employees e ON d.id = e.department_id AND e.status = 'active'
LEFT JOIN desks desk ON d.id = desk.department_id AND desk.status IN ('available', 'occupied')
LEFT JOIN desk_assignments da ON desk.id = da.desk_id AND da.status = 'active'
GROUP BY d.id, d.name, d.display_name, d.location;

-- 授予权限（根据需要调整）
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_app_user;

-- 完成初始化
SELECT 'Enhanced PostgreSQL 数据库初始化完成！' as status;
SELECT 'Total departments: ' || COUNT(*) FROM departments;
SELECT 'Total employees: ' || COUNT(*) FROM employees;
SELECT 'Total desks: ' || COUNT(*) FROM desks;
SELECT 'Total users: ' || COUNT(*) FROM users;