-- 内存数据库数据导出
-- 生成时间: 2025-09-15T05:12:23.194Z
-- 此文件包含所有内存数据库中的数据，用于更新PostgreSQL初始化脚本

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

-- 数据导出完成
