-- M0静态数据到M1数据库迁移脚本
-- 创建时间: 2024-01-15
-- 版本: v1.1.0-M1
-- 描述: 将M0版本的静态数据迁移到M1数据库表中

-- 注意：此脚本需要配合Node.js迁移程序使用
-- 静态数据来源：src/data/departmentData.ts

-- 1. 插入部门数据
-- 基于M0版本的departmentConfigs数据
INSERT INTO departments (name, display_name, description, color, layout_config, map_image_url, status) VALUES
('development', '研发部', '负责产品研发和技术创新', '#3B82F6', 
 '{
   "gridSize": 20,
   "canvasWidth": 1200,
   "canvasHeight": 800,
   "showGrid": true,
   "snapToGrid": true
 }', 
 '/images/departments/development.jpg', 'active'),

('design', '设计部', '负责产品设计和用户体验', '#10B981', 
 '{
   "gridSize": 20,
   "canvasWidth": 1000,
   "canvasHeight": 600,
   "showGrid": true,
   "snapToGrid": true
 }', 
 '/images/departments/design.jpg', 'active'),

('marketing', '市场部', '负责市场推广和品牌建设', '#F59E0B', 
 '{
   "gridSize": 20,
   "canvasWidth": 800,
   "canvasHeight": 600,
   "showGrid": true,
   "snapToGrid": true
 }', 
 '/images/departments/marketing.jpg', 'active'),

('hr', '人事部', '负责人力资源管理和企业文化建设', '#EF4444', 
 '{
   "gridSize": 20,
   "canvasWidth": 600,
   "canvasHeight": 400,
   "showGrid": true,
   "snapToGrid": true
 }', 
 '/images/departments/hr.jpg', 'active')
ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    color = EXCLUDED.color,
    layout_config = EXCLUDED.layout_config,
    map_image_url = EXCLUDED.map_image_url,
    updated_at = CURRENT_TIMESTAMP;

-- 2. 插入员工数据
-- 基于M0版本的employeeData数据
WITH dept_mapping AS (
    SELECT id, name FROM departments
)
INSERT INTO employees (name, employee_number, department_id, position, email, phone, status, hire_date, is_active) 
SELECT 
    emp_data.name,
    emp_data.employee_number,
    dm.id as department_id,
    emp_data.position,
    emp_data.email,
    emp_data.phone,
    CASE 
        WHEN emp_data.status = 'present' THEN 'online'
        WHEN emp_data.status = 'absent' THEN 'offline'
        ELSE 'offline'
    END as status,
    emp_data.hire_date::DATE,
    true as is_active
FROM (
    VALUES 
    -- 研发部员工
    ('张三', 'DEV001', 'development', '前端工程师', 'zhangsan@company.com', '13800138001', 'present', '2023-01-15'),
    ('李四', 'DEV002', 'development', '后端工程师', 'lisi@company.com', '13800138002', 'present', '2023-02-20'),
    ('王五', 'DEV003', 'development', '全栈工程师', 'wangwu@company.com', '13800138003', 'absent', '2023-03-10'),
    ('赵六', 'DEV004', 'development', '架构师', 'zhaoliu@company.com', '13800138004', 'present', '2022-12-01'),
    
    -- 设计部员工
    ('钱七', 'DES001', 'design', 'UI设计师', 'qianqi@company.com', '13800138005', 'present', '2023-04-05'),
    ('孙八', 'DES002', 'design', 'UX设计师', 'sunba@company.com', '13800138006', 'present', '2023-05-12'),
    ('周九', 'DES003', 'design', '视觉设计师', 'zhoujiu@company.com', '13800138007', 'absent', '2023-06-18'),
    
    -- 市场部员工
    ('吴十', 'MKT001', 'marketing', '市场经理', 'wushi@company.com', '13800138008', 'present', '2023-01-08'),
    ('郑十一', 'MKT002', 'marketing', '品牌专员', 'zhengshiyi@company.com', '13800138009', 'present', '2023-07-22'),
    
    -- 人事部员工
    ('王十二', 'HR001', 'hr', '人事经理', 'wangshier@company.com', '13800138010', 'present', '2022-11-15'),
    ('李十三', 'HR002', 'hr', '招聘专员', 'lishisan@company.com', '13800138011', 'absent', '2023-08-30')
) AS emp_data(name, employee_number, dept_name, position, email, phone, status, hire_date)
JOIN dept_mapping dm ON dm.name = emp_data.dept_name
ON CONFLICT (employee_number) DO UPDATE SET
    name = EXCLUDED.name,
    department_id = EXCLUDED.department_id,
    position = EXCLUDED.position,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    status = EXCLUDED.status,
    hire_date = EXCLUDED.hire_date,
    updated_at = CURRENT_TIMESTAMP;

-- 3. 插入工位数据
-- 基于M0版本的deskData数据
WITH dept_mapping AS (
    SELECT id, name FROM departments
)
INSERT INTO desks (desk_number, department_id, position_x, position_y, width, height, status, equipment)
SELECT 
    desk_data.desk_number,
    dm.id as department_id,
    desk_data.position_x,
    desk_data.position_y,
    desk_data.width,
    desk_data.height,
    CASE 
        WHEN desk_data.occupied THEN 'occupied'
        ELSE 'available'
    END as status,
    desk_data.equipment::JSONB
FROM (
    VALUES 
    -- 研发部工位
    ('A001', 'development', 100, 100, 120, 80, false, '{"computer": "MacBook Pro", "monitor": "27inch 4K", "keyboard": "机械键盘", "mouse": "无线鼠标"}'),
    ('A002', 'development', 250, 100, 120, 80, true, '{"computer": "ThinkPad X1", "monitor": "24inch FHD", "keyboard": "薄膜键盘", "mouse": "有线鼠标"}'),
    ('A003', 'development', 400, 100, 120, 80, true, '{"computer": "MacBook Air", "monitor": "27inch 4K", "keyboard": "机械键盘", "mouse": "无线鼠标"}'),
    ('A004', 'development', 550, 100, 120, 80, false, '{"computer": "iMac 27", "keyboard": "Magic Keyboard", "mouse": "Magic Mouse"}'),
    ('A005', 'development', 100, 220, 120, 80, true, '{"computer": "Dell XPS", "monitor": "32inch 4K", "keyboard": "机械键盘", "mouse": "游戏鼠标"}'),
    ('A006', 'development', 250, 220, 120, 80, false, '{"computer": "Surface Pro", "monitor": "24inch FHD", "keyboard": "无线键盘", "mouse": "无线鼠标"}'),
    
    -- 设计部工位
    ('B001', 'design', 100, 100, 140, 90, true, '{"computer": "MacBook Pro 16", "monitor": "32inch 4K", "tablet": "iPad Pro", "stylus": "Apple Pencil"}'),
    ('B002', 'design', 280, 100, 140, 90, true, '{"computer": "iMac 27", "monitor": "27inch 5K", "tablet": "Wacom Cintiq", "stylus": "Wacom Pen"}'),
    ('B003', 'design', 460, 100, 140, 90, false, '{"computer": "Surface Studio", "tablet": "Surface Pen", "scanner": "A3扫描仪"}'),
    ('B004', 'design', 100, 230, 140, 90, false, '{"computer": "MacBook Air", "monitor": "24inch 4K", "tablet": "iPad Air", "stylus": "Apple Pencil"}'),
    
    -- 市场部工位
    ('C001', 'marketing', 100, 100, 110, 70, true, '{"computer": "ThinkPad T14", "monitor": "24inch FHD", "phone": "IP电话", "printer": "彩色打印机"}'),
    ('C002', 'marketing', 240, 100, 110, 70, true, '{"computer": "MacBook Air", "monitor": "27inch 4K", "phone": "IP电话", "camera": "数码相机"}'),
    ('C003', 'marketing', 380, 100, 110, 70, false, '{"computer": "Surface Laptop", "monitor": "24inch FHD", "phone": "IP电话", "projector": "便携投影仪"}'),
    
    -- 人事部工位
    ('D001', 'hr', 100, 100, 100, 70, true, '{"computer": "ThinkPad E14", "monitor": "22inch FHD", "phone": "IP电话", "printer": "黑白打印机"}'),
    ('D002', 'hr', 230, 100, 100, 70, false, '{"computer": "Dell Inspiron", "monitor": "24inch FHD", "phone": "IP电话", "scanner": "文档扫描仪"}')
) AS desk_data(desk_number, dept_name, position_x, position_y, width, height, occupied, equipment)
JOIN dept_mapping dm ON dm.name = desk_data.dept_name
ON CONFLICT (department_id, desk_number) DO UPDATE SET
    position_x = EXCLUDED.position_x,
    position_y = EXCLUDED.position_y,
    width = EXCLUDED.width,
    height = EXCLUDED.height,
    status = EXCLUDED.status,
    equipment = EXCLUDED.equipment,
    updated_at = CURRENT_TIMESTAMP;

-- 4. 创建工位分配关系
-- 基于M0版本中已占用的工位数据
WITH desk_employee_mapping AS (
    SELECT 
        d.id as desk_id,
        e.id as employee_id,
        d.desk_number,
        e.name as employee_name
    FROM desks d
    JOIN departments dept ON d.department_id = dept.id
    JOIN employees e ON e.department_id = dept.id
    WHERE d.status = 'occupied'
),
manual_assignments AS (
    VALUES 
    -- 手动指定工位分配关系（基于M0数据中的占用情况）
    ('A002', '李四'),
    ('A003', '王五'),
    ('A005', '赵六'),
    ('B001', '钱七'),
    ('B002', '孙八'),
    ('C001', '吴十'),
    ('C002', '郑十一'),
    ('D001', '王十二')
)
INSERT INTO desk_assignments (desk_id, employee_id, assigned_at, status, assignment_type)
SELECT 
    d.id as desk_id,
    e.id as employee_id,
    CURRENT_TIMESTAMP - INTERVAL '30 days' as assigned_at, -- 假设30天前分配
    'active' as status,
    'permanent' as assignment_type
FROM manual_assignments ma
JOIN desks d ON d.desk_number = ma.column1
JOIN employees e ON e.name = ma.column2
JOIN departments dept_d ON d.department_id = dept_d.id
JOIN departments dept_e ON e.department_id = dept_e.id
WHERE dept_d.id = dept_e.id -- 确保员工和工位在同一部门
ON CONFLICT DO NOTHING;

-- 5. 插入员工状态变更日志（模拟历史数据）
INSERT INTO employee_status_logs (employee_id, old_status, new_status, changed_at, notes)
SELECT 
    e.id,
    'offline' as old_status,
    e.status as new_status,
    CURRENT_TIMESTAMP - INTERVAL '1 hour' as changed_at,
    'M0数据迁移时的初始状态' as notes
FROM employees e
WHERE e.status = 'online';

-- 6. 验证数据完整性
-- 检查部门数据
DO $$
DECLARE
    dept_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO dept_count FROM departments;
    IF dept_count < 4 THEN
        RAISE EXCEPTION '部门数据迁移不完整，期望至少4个部门，实际: %', dept_count;
    END IF;
    RAISE NOTICE '部门数据迁移完成，共 % 个部门', dept_count;
END $$;

-- 检查员工数据
DO $$
DECLARE
    emp_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO emp_count FROM employees;
    IF emp_count < 10 THEN
        RAISE EXCEPTION '员工数据迁移不完整，期望至少10个员工，实际: %', emp_count;
    END IF;
    RAISE NOTICE '员工数据迁移完成，共 % 个员工', emp_count;
END $$;

-- 检查工位数据
DO $$
DECLARE
    desk_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO desk_count FROM desks;
    IF desk_count < 15 THEN
        RAISE EXCEPTION '工位数据迁移不完整，期望至少15个工位，实际: %', desk_count;
    END IF;
    RAISE NOTICE '工位数据迁移完成，共 % 个工位', desk_count;
END $$;

-- 检查工位分配数据
DO $$
DECLARE
    assignment_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO assignment_count FROM desk_assignments WHERE status = 'active';
    RAISE NOTICE '活跃工位分配关系: % 个', assignment_count;
END $$;

-- 7. 更新系统配置
UPDATE system_configs 
SET config_value = '"M0数据迁移完成"', updated_at = CURRENT_TIMESTAMP 
WHERE config_key = 'migration_status';

INSERT INTO system_configs (config_key, config_value, description) VALUES
('m0_migration_completed_at', to_jsonb(CURRENT_TIMESTAMP), 'M0数据迁移完成时间'),
('m0_migration_version', '"002"', 'M0数据迁移脚本版本')
ON CONFLICT (config_key) DO UPDATE SET
    config_value = EXCLUDED.config_value,
    updated_at = CURRENT_TIMESTAMP;

COMMIT;

-- 迁移完成提示
SELECT 
    'M0数据迁移完成' as status,
    (SELECT COUNT(*) FROM departments) as departments_count,
    (SELECT COUNT(*) FROM employees) as employees_count,
    (SELECT COUNT(*) FROM desks) as desks_count,
    (SELECT COUNT(*) FROM desk_assignments WHERE status = 'active') as active_assignments_count,
    CURRENT_TIMESTAMP as completed_at;