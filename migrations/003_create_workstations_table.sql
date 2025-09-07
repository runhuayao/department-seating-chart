-- M1阶段工位自主管理功能数据库迁移脚本
-- 创建时间: 2024-01-20
-- 版本: v1.3.0-M1
-- 描述: 创建工位自主管理相关表结构

BEGIN;

-- 1. 创建工位管理表（用户自主添加的工位信息）
CREATE TABLE IF NOT EXISTS workstations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL, -- 工位名称
    ip_address INET NOT NULL UNIQUE, -- IP地址
    username VARCHAR(100) NOT NULL, -- 用户名
    department VARCHAR(100) NOT NULL, -- 部门信息
    metadata JSONB DEFAULT '{}', -- 其他元数据信息
    status VARCHAR(20) DEFAULT 'active', -- active, inactive, maintenance
    created_by VARCHAR(100) NOT NULL, -- 创建者
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- 约束
    CONSTRAINT workstations_status_check CHECK (status IN ('active', 'inactive', 'maintenance')),
    CONSTRAINT workstations_name_length CHECK (char_length(name) >= 2),
    CONSTRAINT workstations_username_length CHECK (char_length(username) >= 2),
    CONSTRAINT workstations_department_length CHECK (char_length(department) >= 2)
);

-- 2. 创建工位操作日志表（记录所有操作历史）
CREATE TABLE IF NOT EXISTS workstation_logs (
    id SERIAL PRIMARY KEY,
    workstation_id UUID REFERENCES workstations(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- create, update, delete, status_change
    old_data JSONB, -- 操作前的数据
    new_data JSONB, -- 操作后的数据
    operator VARCHAR(100) NOT NULL, -- 操作者
    operator_role VARCHAR(50), -- 操作者角色
    ip_address INET, -- 操作者IP
    user_agent TEXT, -- 用户代理
    notes TEXT, -- 操作备注
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- 约束
    CONSTRAINT workstation_logs_action_check CHECK (action IN ('create', 'update', 'delete', 'status_change'))
);

-- 3. 创建工位访问统计表（记录访问和搜索统计）
CREATE TABLE IF NOT EXISTS workstation_access_stats (
    id SERIAL PRIMARY KEY,
    workstation_id UUID REFERENCES workstations(id) ON DELETE CASCADE,
    access_type VARCHAR(50) NOT NULL, -- view, search, api_call
    accessor VARCHAR(100), -- 访问者
    access_source VARCHAR(100), -- 访问来源（web, api, mobile等）
    search_query TEXT, -- 搜索查询（如果是搜索访问）
    ip_address INET,
    user_agent TEXT,
    response_time INTEGER, -- 响应时间（毫秒）
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- 约束
    CONSTRAINT workstation_access_stats_access_type_check CHECK (access_type IN ('view', 'search', 'api_call'))
);

-- 4. 创建工位标签表（支持标签分类）
CREATE TABLE IF NOT EXISTS workstation_tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    color VARCHAR(7) DEFAULT '#3B82F6', -- 标签颜色
    description TEXT,
    is_system BOOLEAN DEFAULT false, -- 是否为系统标签
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- 约束
    CONSTRAINT workstation_tags_name_length CHECK (char_length(name) >= 1),
    CONSTRAINT workstation_tags_color_format CHECK (color ~ '^#[0-9A-Fa-f]{6}$')
);

-- 5. 创建工位标签关联表
CREATE TABLE IF NOT EXISTS workstation_tag_relations (
    id SERIAL PRIMARY KEY,
    workstation_id UUID NOT NULL REFERENCES workstations(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES workstation_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- 唯一约束
    UNIQUE(workstation_id, tag_id)
);

-- 创建索引以提高查询性能

-- workstations表索引
CREATE INDEX IF NOT EXISTS idx_workstations_ip_address ON workstations(ip_address);
CREATE INDEX IF NOT EXISTS idx_workstations_username ON workstations(username);
CREATE INDEX IF NOT EXISTS idx_workstations_department ON workstations(department);
CREATE INDEX IF NOT EXISTS idx_workstations_status ON workstations(status);
CREATE INDEX IF NOT EXISTS idx_workstations_created_by ON workstations(created_by);
CREATE INDEX IF NOT EXISTS idx_workstations_created_at ON workstations(created_at);
CREATE INDEX IF NOT EXISTS idx_workstations_name_text ON workstations USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_workstations_metadata ON workstations USING gin(metadata);

-- workstation_logs表索引
CREATE INDEX IF NOT EXISTS idx_workstation_logs_workstation_id ON workstation_logs(workstation_id);
CREATE INDEX IF NOT EXISTS idx_workstation_logs_action ON workstation_logs(action);
CREATE INDEX IF NOT EXISTS idx_workstation_logs_operator ON workstation_logs(operator);
CREATE INDEX IF NOT EXISTS idx_workstation_logs_created_at ON workstation_logs(created_at);

-- workstation_access_stats表索引
CREATE INDEX IF NOT EXISTS idx_workstation_access_stats_workstation_id ON workstation_access_stats(workstation_id);
CREATE INDEX IF NOT EXISTS idx_workstation_access_stats_access_type ON workstation_access_stats(access_type);
CREATE INDEX IF NOT EXISTS idx_workstation_access_stats_accessor ON workstation_access_stats(accessor);
CREATE INDEX IF NOT EXISTS idx_workstation_access_stats_created_at ON workstation_access_stats(created_at);

-- workstation_tags表索引
CREATE INDEX IF NOT EXISTS idx_workstation_tags_name ON workstation_tags(name);
CREATE INDEX IF NOT EXISTS idx_workstation_tags_is_system ON workstation_tags(is_system);

-- workstation_tag_relations表索引
CREATE INDEX IF NOT EXISTS idx_workstation_tag_relations_workstation_id ON workstation_tag_relations(workstation_id);
CREATE INDEX IF NOT EXISTS idx_workstation_tag_relations_tag_id ON workstation_tag_relations(tag_id);

-- 创建触发器以自动更新 updated_at 字段
CREATE TRIGGER update_workstations_updated_at 
    BEFORE UPDATE ON workstations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workstation_tags_updated_at 
    BEFORE UPDATE ON workstation_tags 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 创建触发器以自动记录操作日志
CREATE OR REPLACE FUNCTION log_workstation_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO workstation_logs (workstation_id, action, new_data, operator, notes)
        VALUES (NEW.id, 'create', to_jsonb(NEW), NEW.created_by, 'Workstation created');
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO workstation_logs (workstation_id, action, old_data, new_data, operator, notes)
        VALUES (NEW.id, 'update', to_jsonb(OLD), to_jsonb(NEW), NEW.created_by, 'Workstation updated');
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO workstation_logs (workstation_id, action, old_data, operator, notes)
        VALUES (OLD.id, 'delete', to_jsonb(OLD), 'system', 'Workstation deleted');
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 为workstations表添加操作日志触发器
CREATE TRIGGER workstation_changes_log
    AFTER INSERT OR UPDATE OR DELETE ON workstations
    FOR EACH ROW EXECUTE FUNCTION log_workstation_changes();

-- 插入初始系统标签
INSERT INTO workstation_tags (name, color, description, is_system) VALUES
('开发环境', '#10B981', '开发相关工位', true),
('测试环境', '#F59E0B', '测试相关工位', true),
('生产环境', '#EF4444', '生产环境工位', true),
('办公工位', '#3B82F6', '日常办公工位', true),
('会议室', '#8B5CF6', '会议室设备', true),
('服务器', '#6B7280', '服务器设备', true)
ON CONFLICT (name) DO NOTHING;

-- 插入初始示例数据
INSERT INTO workstations (name, ip_address, username, department, metadata, created_by) VALUES
('开发工位-DEV001', '192.168.1.101', 'developer01', '技术部', '{
    "location": "A区-1楼-001",
    "equipment": ["台式机", "双显示器", "机械键盘"],
    "specs": {
        "cpu": "Intel i7-12700K",
        "ram": "32GB",
        "storage": "1TB SSD",
        "gpu": "RTX 4070"
    },
    "software": ["VS Code", "Docker", "Node.js", "PostgreSQL"],
    "network": {
        "speed": "1Gbps",
        "type": "有线"
    }
}', 'admin'),
('设计工位-DES001', '192.168.1.102', 'designer01', '设计部', '{
    "location": "B区-2楼-015",
    "equipment": ["MacBook Pro", "4K显示器", "数位板"],
    "specs": {
        "cpu": "Apple M2 Pro",
        "ram": "32GB",
        "storage": "1TB SSD"
    },
    "software": ["Adobe Creative Suite", "Figma", "Sketch"],
    "network": {
        "speed": "1Gbps",
        "type": "WiFi 6"
    }
}', 'designer01'),
('测试工位-QA001', '192.168.1.103', 'tester01', '质量保证部', '{
    "location": "C区-1楼-008",
    "equipment": ["台式机", "多设备测试架", "网络分析仪"],
    "specs": {
        "cpu": "Intel i5-12400",
        "ram": "16GB",
        "storage": "512GB SSD"
    },
    "software": ["Selenium", "Postman", "JMeter", "TestRail"],
    "network": {
        "speed": "1Gbps",
        "type": "有线"
    }
}', 'tester01')
ON CONFLICT (ip_address) DO NOTHING;

-- 创建工位统计视图
CREATE OR REPLACE VIEW workstation_statistics AS
SELECT 
    COUNT(*) as total_workstations,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_workstations,
    COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_workstations,
    COUNT(CASE WHEN status = 'maintenance' THEN 1 END) as maintenance_workstations,
    COUNT(DISTINCT department) as total_departments,
    COUNT(DISTINCT created_by) as total_creators,
    MIN(created_at) as first_created,
    MAX(created_at) as last_created
FROM workstations;

-- 创建部门工位统计视图
CREATE OR REPLACE VIEW workstation_department_stats AS
SELECT 
    department,
    COUNT(*) as total_workstations,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_workstations,
    COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_workstations,
    COUNT(CASE WHEN status = 'maintenance' THEN 1 END) as maintenance_workstations,
    COUNT(DISTINCT created_by) as unique_creators,
    MIN(created_at) as first_created,
    MAX(created_at) as last_created
FROM workstations
GROUP BY department
ORDER BY total_workstations DESC;

-- 创建工位详细信息视图（包含标签）
CREATE OR REPLACE VIEW workstation_details AS
SELECT 
    w.id,
    w.name,
    w.ip_address,
    w.username,
    w.department,
    w.metadata,
    w.status,
    w.created_by,
    w.created_at,
    w.updated_at,
    COALESCE(
        json_agg(
            json_build_object(
                'id', t.id,
                'name', t.name,
                'color', t.color,
                'description', t.description
            )
        ) FILTER (WHERE t.id IS NOT NULL), 
        '[]'
    ) as tags
FROM workstations w
LEFT JOIN workstation_tag_relations wtr ON w.id = wtr.workstation_id
LEFT JOIN workstation_tags t ON wtr.tag_id = t.id
GROUP BY w.id, w.name, w.ip_address, w.username, w.department, w.metadata, w.status, w.created_by, w.created_at, w.updated_at;

-- 更新系统配置
INSERT INTO system_configs (config_key, config_value, description) VALUES
('workstation_management_enabled', 'true', 'Enable workstation self-management feature'),
('workstation_deletion_admin_only', 'true', 'Only administrators can delete workstations'),
('workstation_max_per_user', '5', 'Maximum workstations per user'),
('workstation_ip_validation_strict', 'true', 'Enable strict IP address validation')
ON CONFLICT (config_key) DO UPDATE SET 
    config_value = EXCLUDED.config_value,
    updated_at = CURRENT_TIMESTAMP;

COMMIT;

-- 创建工位管理相关的存储过程

-- 1. 获取工位统计信息的存储过程
CREATE OR REPLACE FUNCTION get_workstation_stats()
RETURNS TABLE(
    total_count INTEGER,
    active_count INTEGER,
    inactive_count INTEGER,
    maintenance_count INTEGER,
    department_count INTEGER,
    creator_count INTEGER,
    avg_per_department NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_count,
        COUNT(CASE WHEN w.status = 'active' THEN 1 END)::INTEGER as active_count,
        COUNT(CASE WHEN w.status = 'inactive' THEN 1 END)::INTEGER as inactive_count,
        COUNT(CASE WHEN w.status = 'maintenance' THEN 1 END)::INTEGER as maintenance_count,
        COUNT(DISTINCT w.department)::INTEGER as department_count,
        COUNT(DISTINCT w.created_by)::INTEGER as creator_count,
        CASE 
            WHEN COUNT(DISTINCT w.department) > 0 
            THEN ROUND(COUNT(*)::NUMERIC / COUNT(DISTINCT w.department), 2)
            ELSE 0
        END as avg_per_department
    FROM workstations w;
END;
$$ LANGUAGE plpgsql;

-- 2. 搜索工位的存储过程
CREATE OR REPLACE FUNCTION search_workstations(
    search_term TEXT DEFAULT '',
    search_department TEXT DEFAULT '',
    search_status TEXT DEFAULT '',
    limit_count INTEGER DEFAULT 50,
    offset_count INTEGER DEFAULT 0
)
RETURNS TABLE(
    id UUID,
    name VARCHAR,
    ip_address INET,
    username VARCHAR,
    department VARCHAR,
    status VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE,
    match_score REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        w.id,
        w.name,
        w.ip_address,
        w.username,
        w.department,
        w.status,
        w.created_at,
        (
            CASE WHEN w.name ILIKE '%' || search_term || '%' THEN 0.4 ELSE 0 END +
            CASE WHEN w.username ILIKE '%' || search_term || '%' THEN 0.3 ELSE 0 END +
            CASE WHEN w.department ILIKE '%' || search_term || '%' THEN 0.2 ELSE 0 END +
            CASE WHEN host(w.ip_address) ILIKE '%' || search_term || '%' THEN 0.1 ELSE 0 END
        )::REAL as match_score
    FROM workstations w
    WHERE 
        (search_term = '' OR (
            w.name ILIKE '%' || search_term || '%' OR
            w.username ILIKE '%' || search_term || '%' OR
            w.department ILIKE '%' || search_term || '%' OR
            host(w.ip_address) ILIKE '%' || search_term || '%'
        ))
        AND (search_department = '' OR w.department ILIKE '%' || search_department || '%')
        AND (search_status = '' OR w.status = search_status)
    ORDER BY match_score DESC, w.created_at DESC
    LIMIT limit_count OFFSET offset_count;
END;
$$ LANGUAGE plpgsql;