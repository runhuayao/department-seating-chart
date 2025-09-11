-- 添加拼音支持的数据库迁移脚本
-- 创建时间: 2024-01-15
-- 版本: v2.1.2
-- 描述: 为employees表添加拼音字段以支持拼音搜索

-- 1. 为employees表添加拼音字段
ALTER TABLE employees ADD COLUMN IF NOT EXISTS name_pinyin VARCHAR(200);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS name_pinyin_short VARCHAR(50);

-- 2. 创建拼音字段索引
CREATE INDEX IF NOT EXISTS idx_employees_name_pinyin ON employees(name_pinyin);
CREATE INDEX IF NOT EXISTS idx_employees_name_pinyin_short ON employees(name_pinyin_short);

-- 3. 插入测试数据到departments表
INSERT INTO departments (name, display_name, description, color, status) VALUES
('技术部', '技术开发部', '负责系统开发和维护', '#3B82F6', 'active'),
('产品部', '产品设计部', '负责产品设计和规划', '#10B981', 'active'),
('运营部', '运营管理部', '负责日常运营管理', '#F59E0B', 'active')
ON CONFLICT (name) DO NOTHING;

-- 4. 插入测试数据到employees表
INSERT INTO employees (name, name_pinyin, name_pinyin_short, employee_number, department_id, position, email, status, is_active) VALUES
('王五', 'wangwu', 'ww', 'EMP003', 1, '产品经理', 'wangwu@company.com', 'online', true),
('张三', 'zhangsan', 'zs', 'EMP001', 1, '高级工程师', 'zhangsan@company.com', 'online', true),
('李四', 'lisi', 'ls', 'EMP002', 1, '前端工程师', 'lisi@company.com', 'offline', true),
('赵六', 'zhaoliu', 'zl', 'EMP004', 3, '运营专员', 'zhaoliu@company.com', 'online', true),
('陈七', 'chenqi', 'cq', 'EMP005', 2, '设计师', 'chenqi@company.com', 'away', true)
ON CONFLICT (employee_number) DO NOTHING;

-- 5. 插入测试数据到desks表
INSERT INTO desks (desk_number, department_id, position_x, position_y, status, equipment) VALUES
('E03', 1, 100, 100, 'occupied', '{"monitor": "双屏", "keyboard": "机械键盘"}'),
('A01', 1, 200, 100, 'occupied', '{"monitor": "单屏", "keyboard": "普通键盘"}'),
('A02', 1, 300, 100, 'available', '{"monitor": "单屏"}'),
('B01', 2, 100, 200, 'occupied', '{"monitor": "双屏", "tablet": "iPad"}'),
('C01', 3, 100, 300, 'available', '{"monitor": "单屏"}')
ON CONFLICT (department_id, desk_number) DO NOTHING;

-- 6. 插入测试数据到desk_assignments表
INSERT INTO desk_assignments (desk_id, employee_id, status, assignment_type) VALUES
(1, 1, 'active', 'permanent'),
(2, 2, 'active', 'permanent'),
(4, 5, 'active', 'permanent')
ON CONFLICT DO NOTHING;

COMMIT;