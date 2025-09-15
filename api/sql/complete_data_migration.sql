-- 数据迁移SQL脚本
-- 从内存数据库导出的完整数据

-- 清空现有数据
TRUNCATE TABLE desk_assignments CASCADE;
TRUNCATE TABLE desks CASCADE;
TRUNCATE TABLE employees CASCADE;
TRUNCATE TABLE departments CASCADE;

-- 插入部门数据
INSERT INTO departments (id, name, description, manager_id, floor, area, created_at, updated_at) VALUES
(1, '技术部', '负责产品开发和技术支持', 1, 3, '开发区A', NOW(), NOW()),
(2, '市场部', '负责市场推广和销售', 4, 2, '市场区B', NOW(), NOW()),
(3, '人事部', '负责人力资源管理', 7, 1, '行政区C', NOW(), NOW()),
(4, '设计部', '负责产品设计和用户体验', 10, 4, '设计区D', NOW(), NOW()),
(5, '运营部', '负责产品运营和数据分析', 12, 2, '运营区E', NOW(), NOW());

-- 插入员工数据
INSERT INTO employees (id, name, email, phone, position, department_id, hire_date, status, created_at, updated_at) VALUES
(1, '张三', 'zhangsan@company.com', '13800138001', '技术总监', 1, '2022-01-15', 'active', NOW(), NOW()),
(2, '李四', 'lisi@company.com', '13800138002', '高级开发工程师', 1, '2022-03-01', 'active', NOW(), NOW()),
(3, '王五', 'wangwu@company.com', '13800138003', '前端开发工程师', 1, '2022-05-10', 'active', NOW(), NOW()),
(4, '赵六', 'zhaoliu@company.com', '13800138004', '市场总监', 2, '2021-12-01', 'active', NOW(), NOW()),
(5, '钱七', 'qianqi@company.com', '13800138005', '销售经理', 2, '2022-02-15', 'active', NOW(), NOW()),
(6, '孙八', 'sunba@company.com', '13800138006', '市场专员', 2, '2022-04-01', 'active', NOW(), NOW()),
(7, '周九', 'zhoujiu@company.com', '13800138007', '人事总监', 3, '2021-11-01', 'active', NOW(), NOW()),
(8, '吴十', 'wushi@company.com', '13800138008', '招聘专员', 3, '2022-06-01', 'active', NOW(), NOW()),
(9, '郑十一', 'zhengshiyi@company.com', '13800138009', '薪酬专员', 3, '2022-07-15', 'active', NOW(), NOW()),
(10, '王十二', 'wangshier@company.com', '13800138010', '设计总监', 4, '2022-01-01', 'active', NOW(), NOW()),
(11, '冯十三', 'fengshisan@company.com', '13800138011', 'UX设计师', 4, '2023-06-01', 'active', NOW(), NOW()),
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

-- 重置序列
SELECT setval('departments_id_seq', 5);
SELECT setval('employees_id_seq', 14);
SELECT setval('desks_id_seq', 5);

-- 创建搜索视图
CREATE OR REPLACE VIEW employee_search_view AS
SELECT 
    e.id,
    e.name,
    e.email,
    e.phone,
    e.position,
    e.department_id,
    d.name as department_name,
    e.hire_date,
    e.status,
    (e.name || ' ' || e.position || ' ' || d.name || ' ' || COALESCE(e.email, '')) as search_text
FROM employees e
LEFT JOIN departments d ON e.department_id = d.id
WHERE e.status = 'active';

-- 创建全文搜索索引
CREATE INDEX IF NOT EXISTS idx_employees_search ON employees USING gin(to_tsvector('simple', name || ' ' || position || ' ' || email));
CREATE INDEX IF NOT EXISTS idx_departments_search ON departments USING gin(to_tsvector('simple', name || ' ' || description));
CREATE INDEX IF NOT EXISTS idx_desks_search ON desks USING gin(to_tsvector('simple', desk_number || ' ' || area));

