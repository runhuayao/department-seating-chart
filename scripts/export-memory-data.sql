-- 数据迁移脚本：从内存数据库导出的完整数据
-- 生成时间: 2024-12-19
-- 用途: 将内存数据库中的测试数据迁移到PostgreSQL数据库

-- 清空现有数据（按依赖关系顺序）
TRUNCATE TABLE system_logs CASCADE;
TRUNCATE TABLE user_sessions CASCADE;
TRUNCATE TABLE desk_assignments CASCADE;
TRUNCATE TABLE role_permissions CASCADE;
TRUNCATE TABLE permissions CASCADE;
TRUNCATE TABLE users CASCADE;
TRUNCATE TABLE desks CASCADE;
TRUNCATE TABLE employees CASCADE;
TRUNCATE TABLE departments CASCADE;

-- 重置序列
ALTER SEQUENCE departments_id_seq RESTART WITH 1;
ALTER SEQUENCE employees_id_seq RESTART WITH 1;
ALTER SEQUENCE desks_id_seq RESTART WITH 1;
ALTER SEQUENCE users_id_seq RESTART WITH 1;
ALTER SEQUENCE permissions_id_seq RESTART WITH 1;
ALTER SEQUENCE role_permissions_id_seq RESTART WITH 1;
ALTER SEQUENCE system_logs_id_seq RESTART WITH 1;
ALTER SEQUENCE desk_assignments_id_seq RESTART WITH 1;
ALTER SEQUENCE user_sessions_id_seq RESTART WITH 1;

-- 插入部门数据
INSERT INTO departments (id, name, description, parent_id, manager_id, location, created_at, updated_at) VALUES
(1, '技术部', '负责公司技术研发和系统维护', NULL, 1, '3楼', NOW(), NOW()),
(2, '市场部', '负责市场推广和客户关系维护', NULL, 4, '2楼', NOW(), NOW()),
(3, '人事部', '负责人力资源管理和招聘', NULL, 6, '1楼', NOW(), NOW()),
(4, '产品部', '负责产品设计和用户体验', NULL, 9, '4楼', NOW(), NOW()),
(5, '运营部', '负责业务运营和数据分析', NULL, 12, '2楼', NOW(), NOW());

-- 插入员工数据
INSERT INTO employees (id, name, email, phone, position, department_id, hire_date, status, created_at, updated_at) VALUES
-- 技术部员工
(1, '张三', 'zhangsan@company.com', '13800138001', '技术经理', 1, '2023-01-15', 'active', NOW(), NOW()),
(2, '李四', 'lisi@company.com', '13800138002', '前端开发', 1, '2023-02-01', 'active', NOW(), NOW()),
(3, '王五', 'wangwu@company.com', '13800138003', '后端开发', 1, '2023-02-15', 'active', NOW(), NOW()),
-- 市场部员工
(4, '赵六', 'zhaoliu@company.com', '13800138004', '市场经理', 2, '2023-01-10', 'active', NOW(), NOW()),
(5, '钱七', 'qianqi@company.com', '13800138005', '销售代表', 2, '2023-03-01', 'active', NOW(), NOW()),
-- 人事部员工
(6, '孙八', 'sunba@company.com', '13800138006', '人事经理', 3, '2022-12-01', 'active', NOW(), NOW()),
(7, '周九', 'zhoujiu@company.com', '13800138007', '招聘专员', 3, '2023-04-01', 'active', NOW(), NOW()),
(8, '吴十', 'wushi@company.com', '13800138008', '薪酬专员', 3, '2023-05-15', 'active', NOW(), NOW()),
-- 产品部员工
(9, '郑十一', 'zhengshiyi@company.com', '13800138009', '产品经理', 4, '2022-11-01', 'active', NOW(), NOW()),
(10, '王十二', 'wangshier@company.com', '13800138010', 'UI设计师', 4, '2023-03-15', 'active', NOW(), NOW()),
(11, '冯十三', 'fengshisan@company.com', '13800138011', 'UX设计师', 4, '2023-06-01', 'active', NOW(), NOW()),
-- 运营部员工
(12, '陈十四', 'chenshisi@company.com', '13800138012', '运营经理', 5, '2022-10-01', 'active', NOW(), NOW()),
(13, '褚十五', 'chushiwu@company.com', '13800138013', '数据分析师', 5, '2023-07-01', 'active', NOW(), NOW()),
(14, '卫十六', 'weishiliu@company.com', '13800138014', '内容运营', 5, '2023-08-15', 'active', NOW(), NOW());

-- 插入工位数据
INSERT INTO desks (id, desk_number, department_id, floor, area, x_position, y_position, width, height, status, assigned_employee_id, assigned_at, ip_address, computer_name, equipment_info, created_at, updated_at) VALUES
(1, 'A001', 1, 3, '开发区A', 100, 100, 120, 80, 'available', NULL, NULL, NULL, NULL, NULL, NOW(), NOW()),
(2, 'A002', 1, 3, '开发区A', 250, 100, 120, 80, 'occupied', 2, NOW(), '192.168.1.101', 'DEV-PC-001', 'Dell OptiPlex 7090', NOW(), NOW()),
(3, 'A003', 1, 3, '开发区A', 400, 100, 120, 80, 'occupied', 3, NOW(), '192.168.1.102', 'DEV-PC-002', 'HP EliteDesk 800', NOW(), NOW()),
(4, 'B001', 2, 2, '市场区B', 100, 200, 120, 80, 'occupied', 4, NOW(), '192.168.1.201', 'MKT-PC-001', 'Lenovo ThinkCentre M720', NOW(), NOW()),
(5, 'B002', 2, 2, '市场区B', 250, 200, 120, 80, 'available', NULL, NULL, NULL, NULL, NULL, NOW(), NOW());

-- 插入用户数据
INSERT INTO users (id, username, password_hash, email, role, employee_id, status, last_login_at, created_at, updated_at) VALUES
(1, 'admin', '$2b$12$Mz.2uGUBIsUUTqfrYzV2P.bEuwCwES.k19u7fG3HED44OnHKc30.G', 'admin@company.com', 'admin', 1, 'active', NULL, NOW(), NOW()),
(2, 'manager', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uO.G', 'manager@company.com', 'manager', 4, 'active', NULL, NOW(), NOW());

-- 更新序列到正确的值
SELECT setval('departments_id_seq', (SELECT MAX(id) FROM departments));
SELECT setval('employees_id_seq', (SELECT MAX(id) FROM employees));
SELECT setval('desks_id_seq', (SELECT MAX(id) FROM desks));
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

-- 验证数据插入
SELECT 'departments' as table_name, COUNT(*) as record_count FROM departments
UNION ALL
SELECT 'employees', COUNT(*) FROM employees
UNION ALL
SELECT 'desks', COUNT(*) FROM desks
UNION ALL
SELECT 'users', COUNT(*) FROM users;

-- 数据完整性检查
SELECT 
    d.name as department_name,
    COUNT(e.id) as employee_count,
    COUNT(dk.id) as desk_count
FROM departments d
LEFT JOIN employees e ON d.id = e.department_id
LEFT JOIN desks dk ON d.id = dk.department_id
GROUP BY d.id, d.name
ORDER BY d.id;

COMMIT;