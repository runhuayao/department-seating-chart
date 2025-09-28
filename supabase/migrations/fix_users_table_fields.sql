-- 修复users表缺失的字段
-- 添加employee_number、department_id、full_name等字段

-- 添加缺失的字段
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS employee_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS department_id INTEGER,
ADD COLUMN IF NOT EXISTS full_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_failed_login TIMESTAMP,
ADD COLUMN IF NOT EXISTS refresh_token TEXT;

-- 添加外键约束
ALTER TABLE users 
ADD CONSTRAINT IF NOT EXISTS users_department_id_fkey 
FOREIGN KEY (department_id) REFERENCES departments(id);

-- 添加唯一约束
ALTER TABLE users 
ADD CONSTRAINT IF NOT EXISTS users_employee_number_unique 
UNIQUE (employee_number);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_users_department_id ON users(department_id);
CREATE INDEX IF NOT EXISTS idx_users_employee_number ON users(employee_number);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login);

-- 更新现有用户数据（如果有的话）
UPDATE users 
SET employee_number = 'EMP' || LPAD(id::text, 6, '0')
WHERE employee_number IS NULL;

-- 检查desks表是否存在floor字段，如果不存在则添加
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'desks' AND column_name = 'floor') THEN
        ALTER TABLE desks ADD COLUMN floor INTEGER DEFAULT 1;
    END IF;
END $$;

-- 为desks表添加索引
CREATE INDEX IF NOT EXISTS idx_desks_floor ON desks(floor);
CREATE INDEX IF NOT EXISTS idx_desks_department_id ON desks(department_id);

-- 确保权限正确设置
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO authenticated;
GRANT SELECT ON users TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON desks TO authenticated;
GRANT SELECT ON desks TO anon;