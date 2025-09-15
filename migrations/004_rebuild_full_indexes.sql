-- 重建PostgreSQL全量索引，确保覆盖所有部门人员数据
-- v2.0版本索引优化：技术部、人事部、产品部、运营部

-- 删除旧索引（如果存在）
DROP INDEX IF EXISTS idx_employees_department;
DROP INDEX IF EXISTS idx_employees_name;
DROP INDEX IF EXISTS idx_employees_name_pinyin;
DROP INDEX IF EXISTS idx_employees_position;
DROP INDEX IF EXISTS idx_employees_email;
DROP INDEX IF EXISTS idx_employees_phone;
DROP INDEX IF EXISTS idx_employees_status;
DROP INDEX IF EXISTS idx_employees_search_text;

DROP INDEX IF EXISTS idx_workstations_department;
DROP INDEX IF EXISTS idx_workstations_status;
DROP INDEX IF EXISTS idx_workstations_employee_id;
DROP INDEX IF EXISTS idx_workstations_coordinates;
DROP INDEX IF EXISTS idx_workstations_server_type;

DROP INDEX IF EXISTS idx_department_mappings_chinese;
DROP INDEX IF EXISTS idx_department_mappings_english;

DROP INDEX IF EXISTS idx_cross_system_logs_department;
DROP INDEX IF EXISTS idx_cross_system_logs_timestamp;
DROP INDEX IF EXISTS idx_cross_system_logs_operation;

-- 员工表索引 - 支持全部门搜索
CREATE INDEX idx_employees_department ON employees(department);
CREATE INDEX idx_employees_name ON employees(name);
CREATE INDEX idx_employees_name_pinyin ON employees(name_pinyin);
CREATE INDEX idx_employees_position ON employees(position);
CREATE INDEX idx_employees_email ON employees(email);
CREATE INDEX idx_employees_phone ON employees(phone);
CREATE INDEX idx_employees_status ON employees(status);

-- 复合索引用于多条件查询
CREATE INDEX idx_employees_dept_status ON employees(department, status);
CREATE INDEX idx_employees_name_dept ON employees(name, department);

-- 全文搜索索引
CREATE INDEX idx_employees_search_text ON employees USING gin(to_tsvector('chinese', name || ' ' || COALESCE(name_pinyin, '') || ' ' || department || ' ' || position));

-- 工位表索引 - M1服务器工位管理
CREATE INDEX idx_workstations_department ON workstations(department);
CREATE INDEX idx_workstations_status ON workstations(status);
CREATE INDEX idx_workstations_employee_id ON workstations(employee_id);
CREATE INDEX idx_workstations_server_type ON workstations(server_type);

-- 坐标索引用于位置查询
CREATE INDEX idx_workstations_coordinates ON workstations(x_coordinate, y_coordinate);

-- 复合索引用于工位管理筛选
CREATE INDEX idx_workstations_dept_status ON workstations(department, status);
CREATE INDEX idx_workstations_server_dept ON workstations(server_type, department);

-- 部门映射表索引
CREATE INDEX idx_department_mappings_chinese ON department_mappings(chinese_name);
CREATE INDEX idx_department_mappings_english ON department_mappings(english_key);
CREATE UNIQUE INDEX idx_department_mappings_unique_chinese ON department_mappings(chinese_name) WHERE is_active = true;
CREATE UNIQUE INDEX idx_department_mappings_unique_english ON department_mappings(english_key) WHERE is_active = true;

-- 跨系统日志表索引
CREATE INDEX idx_cross_system_logs_department ON cross_system_logs(department);
CREATE INDEX idx_cross_system_logs_timestamp ON cross_system_logs(created_at);
CREATE INDEX idx_cross_system_logs_operation ON cross_system_logs(operation_type);
CREATE INDEX idx_cross_system_logs_user ON cross_system_logs(user_id);

-- 复合索引用于日志查询
CREATE INDEX idx_cross_system_logs_dept_time ON cross_system_logs(department, created_at);
CREATE INDEX idx_cross_system_logs_operation_time ON cross_system_logs(operation_type, created_at);

-- 创建视图用于全部门数据查询
CREATE OR REPLACE VIEW v_all_departments_data AS
SELECT 
    e.id,
    e.name,
    e.name_pinyin,
    e.department,
    e.position,
    e.email,
    e.phone,
    e.status as employee_status,
    w.id as workstation_id,
    w.workstation_number,
    w.x_coordinate,
    w.y_coordinate,
    w.status as workstation_status,
    w.server_type,
    dm.english_key as department_english_key,
    dm.is_valid as mapping_valid
FROM employees e
LEFT JOIN workstations w ON e.id = w.employee_id
LEFT JOIN department_mappings dm ON e.department = dm.chinese_name AND dm.is_active = true
WHERE e.status = 'active';

-- 创建函数用于全文搜索
CREATE OR REPLACE FUNCTION search_all_departments(
    search_term TEXT DEFAULT '',
    dept_filter TEXT DEFAULT '',
    status_filter TEXT DEFAULT 'active'
)
RETURNS TABLE(
    id INTEGER,
    name VARCHAR,
    name_pinyin VARCHAR,
    department VARCHAR,
    position VARCHAR,
    email VARCHAR,
    phone VARCHAR,
    employee_status VARCHAR,
    workstation_id INTEGER,
    workstation_number VARCHAR,
    x_coordinate DECIMAL,
    y_coordinate DECIMAL,
    workstation_status VARCHAR,
    server_type VARCHAR,
    department_english_key VARCHAR,
    mapping_valid BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM v_all_departments_data v
    WHERE 
        (search_term = '' OR 
         v.name ILIKE '%' || search_term || '%' OR
         v.name_pinyin ILIKE '%' || search_term || '%' OR
         v.department ILIKE '%' || search_term || '%' OR
         v.position ILIKE '%' || search_term || '%' OR
         v.email ILIKE '%' || search_term || '%'
        )
        AND (dept_filter = '' OR v.department = dept_filter)
        AND (status_filter = '' OR v.employee_status = status_filter)
    ORDER BY 
        CASE 
            WHEN v.name = search_term THEN 1
            WHEN v.name ILIKE search_term || '%' THEN 2
            WHEN v.department = search_term THEN 3
            ELSE 4
        END,
        v.department,
        v.name;
END;
$$ LANGUAGE plpgsql;

-- 创建缓存表用于提高查询性能
CREATE TABLE IF NOT EXISTS search_cache (
    id SERIAL PRIMARY KEY,
    cache_key VARCHAR(255) UNIQUE NOT NULL,
    cache_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_search_cache_key ON search_cache(cache_key);
CREATE INDEX idx_search_cache_expires ON search_cache(expires_at);

-- 创建函数用于清理过期缓存
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM search_cache WHERE expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器函数用于数据变更时清理相关缓存
CREATE OR REPLACE FUNCTION invalidate_search_cache()
RETURNS TRIGGER AS $$
BEGIN
    -- 清理所有搜索相关的缓存
    DELETE FROM search_cache WHERE cache_key LIKE 'search_%';
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS trigger_invalidate_cache_employees ON employees;
DROP TRIGGER IF EXISTS trigger_invalidate_cache_workstations ON workstations;
DROP TRIGGER IF EXISTS trigger_invalidate_cache_mappings ON department_mappings;

CREATE TRIGGER trigger_invalidate_cache_employees
    AFTER INSERT OR UPDATE OR DELETE ON employees
    FOR EACH ROW EXECUTE FUNCTION invalidate_search_cache();

CREATE TRIGGER trigger_invalidate_cache_workstations
    AFTER INSERT OR UPDATE OR DELETE ON workstations
    FOR EACH ROW EXECUTE FUNCTION invalidate_search_cache();

CREATE TRIGGER trigger_invalidate_cache_mappings
    AFTER INSERT OR UPDATE OR DELETE ON department_mappings
    FOR EACH ROW EXECUTE FUNCTION invalidate_search_cache();

-- 分析表以优化查询计划
ANALYZE employees;
ANALYZE workstations;
ANALYZE department_mappings;
ANALYZE cross_system_logs;

-- 插入索引重建日志
INSERT INTO cross_system_logs (operation_type, department, details, user_id)
VALUES (
    'INDEX_REBUILD',
    'SYSTEM',
    'v2.0版本全量索引重建完成：覆盖技术部、人事部、产品部、运营部等所有部门数据',
    'system'
);

-- 输出索引重建结果
SELECT 
    'INDEX_REBUILD_COMPLETE' as status,
    'v2.0' as version,
    CURRENT_TIMESTAMP as completed_at,
    (
        SELECT COUNT(*) FROM pg_indexes 
        WHERE tablename IN ('employees', 'workstations', 'department_mappings', 'cross_system_logs')
    ) as total_indexes_created;