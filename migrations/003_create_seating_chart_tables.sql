-- 座位图系统数据库表结构迁移脚本
-- 创建时间: 2024-12-29
-- 版本: v3.2.0
-- 描述: 创建座位图、版本控制、协同编辑相关表

-- 1. 创建座位图主表
CREATE TABLE IF NOT EXISTS seating_charts (
    id VARCHAR(255) PRIMARY KEY,
    department VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    layout_data JSONB NOT NULL,
    metadata JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100)
);

-- 2. 创建座位图版本历史表
CREATE TABLE IF NOT EXISTS seating_chart_versions (
    id VARCHAR(255) PRIMARY KEY,
    chart_id VARCHAR(255) NOT NULL,
    version_data JSONB NOT NULL,
    metadata JSONB,
    version_number VARCHAR(20) NOT NULL,
    change_description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    FOREIGN KEY (chart_id) REFERENCES seating_charts(id) ON DELETE CASCADE
);

-- 3. 创建协同编辑会话表
CREATE TABLE IF NOT EXISTS collaborative_sessions (
    id VARCHAR(255) PRIMARY KEY,
    chart_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(100) NOT NULL,
    session_token VARCHAR(500),
    start_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    cursor_position JSONB,
    selected_seats JSONB,
    FOREIGN KEY (chart_id) REFERENCES seating_charts(id) ON DELETE CASCADE
);

-- 4. 创建座位操作日志表
CREATE TABLE IF NOT EXISTS seat_operations (
    id VARCHAR(255) PRIMARY KEY,
    chart_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255),
    operation_type VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete', 'move', 'select'
    seat_id VARCHAR(255),
    operation_data JSONB,
    user_id VARCHAR(100),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_synced BOOLEAN DEFAULT false,
    sync_timestamp TIMESTAMP WITH TIME ZONE,
    FOREIGN KEY (chart_id) REFERENCES seating_charts(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES collaborative_sessions(id) ON DELETE SET NULL
);

-- 5. 创建Figma同步状态表
CREATE TABLE IF NOT EXISTS figma_sync_status (
    id VARCHAR(255) PRIMARY KEY,
    chart_id VARCHAR(255) NOT NULL,
    figma_file_id VARCHAR(255),
    figma_node_id VARCHAR(255),
    last_sync_time TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'syncing', 'completed', 'failed'
    sync_data JSONB,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chart_id) REFERENCES seating_charts(id) ON DELETE CASCADE
);

-- 6. 创建缓存管理表
CREATE TABLE IF NOT EXISTS cache_management (
    id VARCHAR(255) PRIMARY KEY,
    cache_key VARCHAR(500) NOT NULL UNIQUE,
    cache_type VARCHAR(100) NOT NULL, -- 'seating-chart', 'department', 'workstation', 'session'
    related_id VARCHAR(255),
    ttl INTEGER DEFAULT 300,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    hit_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引以提升查询性能

-- 座位图表索引
CREATE INDEX IF NOT EXISTS idx_seating_charts_department ON seating_charts(department);
CREATE INDEX IF NOT EXISTS idx_seating_charts_active ON seating_charts(is_active);
CREATE INDEX IF NOT EXISTS idx_seating_charts_updated ON seating_charts(updated_at DESC);

-- 版本历史表索引
CREATE INDEX IF NOT EXISTS idx_versions_chart_id ON seating_chart_versions(chart_id);
CREATE INDEX IF NOT EXISTS idx_versions_created ON seating_chart_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_versions_active ON seating_chart_versions(is_active);

-- 协同编辑会话表索引
CREATE INDEX IF NOT EXISTS idx_sessions_chart_id ON collaborative_sessions(chart_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON collaborative_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON collaborative_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_sessions_activity ON collaborative_sessions(last_activity DESC);

-- 座位操作日志表索引
CREATE INDEX IF NOT EXISTS idx_operations_chart_id ON seat_operations(chart_id);
CREATE INDEX IF NOT EXISTS idx_operations_session_id ON seat_operations(session_id);
CREATE INDEX IF NOT EXISTS idx_operations_timestamp ON seat_operations(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_operations_sync ON seat_operations(is_synced);

-- Figma同步状态表索引
CREATE INDEX IF NOT EXISTS idx_figma_sync_chart_id ON figma_sync_status(chart_id);
CREATE INDEX IF NOT EXISTS idx_figma_sync_status ON figma_sync_status(sync_status);
CREATE INDEX IF NOT EXISTS idx_figma_sync_time ON figma_sync_status(last_sync_time DESC);

-- 缓存管理表索引
CREATE INDEX IF NOT EXISTS idx_cache_key ON cache_management(cache_key);
CREATE INDEX IF NOT EXISTS idx_cache_type ON cache_management(cache_type);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache_management(expires_at);
CREATE INDEX IF NOT EXISTS idx_cache_accessed ON cache_management(last_accessed DESC);

-- 创建触发器以自动更新时间戳
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为相关表创建更新时间触发器
DROP TRIGGER IF EXISTS update_seating_charts_updated_at ON seating_charts;
CREATE TRIGGER update_seating_charts_updated_at 
    BEFORE UPDATE ON seating_charts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_figma_sync_updated_at ON figma_sync_status;
CREATE TRIGGER update_figma_sync_updated_at 
    BEFORE UPDATE ON figma_sync_status 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 插入初始数据

-- 插入示例座位图配置
INSERT INTO seating_charts (id, department, name, description, layout_data, metadata, created_by) VALUES
('chart-engineering-default', 'Engineering', '工程部默认座位图', '工程部标准座位布局', 
 '{"width": 815, "height": 500, "seats": []}', 
 '{"version": "1.0.0", "template": "VACANT-SELECT", "figmaFileId": "rfmihgScThZhZjvJUzsCiw"}', 
 'system'),
('chart-marketing-default', 'Marketing', '市场部默认座位图', '市场部标准座位布局', 
 '{"width": 815, "height": 500, "seats": []}', 
 '{"version": "1.0.0", "template": "VACANT-SELECT", "figmaFileId": "rfmihgScThZhZjvJUzsCiw"}', 
 'system'),
('chart-sales-default', 'Sales', '销售部默认座位图', '销售部标准座位布局', 
 '{"width": 815, "height": 500, "seats": []}', 
 '{"version": "1.0.0", "template": "VACANT-SELECT", "figmaFileId": "rfmihgScThZhZjvJUzsCiw"}', 
 'system'),
('chart-hr-default', 'HR', '人力资源部默认座位图', '人力资源部标准座位布局', 
 '{"width": 815, "height": 500, "seats": []}', 
 '{"version": "1.0.0", "template": "VACANT-SELECT", "figmaFileId": "rfmihgScThZhZjvJUzsCiw"}', 
 'system')
ON CONFLICT (id) DO NOTHING;

-- 插入初始版本记录
INSERT INTO seating_chart_versions (id, chart_id, version_data, metadata, version_number, change_description, created_by) VALUES
('version-engineering-1.0.0', 'chart-engineering-default', 
 '{"layout": {"width": 815, "height": 500, "seats": []}, "metadata": {"version": "1.0.0"}}',
 '{"changeType": "major", "changes": [{"type": "layout_created", "description": "初始座位图创建"}]}',
 '1.0.0', '初始版本创建', 'system'),
('version-marketing-1.0.0', 'chart-marketing-default', 
 '{"layout": {"width": 815, "height": 500, "seats": []}, "metadata": {"version": "1.0.0"}}',
 '{"changeType": "major", "changes": [{"type": "layout_created", "description": "初始座位图创建"}]}',
 '1.0.0', '初始版本创建', 'system'),
('version-sales-1.0.0', 'chart-sales-default', 
 '{"layout": {"width": 815, "height": 500, "seats": []}, "metadata": {"version": "1.0.0"}}',
 '{"changeType": "major", "changes": [{"type": "layout_created", "description": "初始座位图创建"}]}',
 '1.0.0', '初始版本创建', 'system'),
('version-hr-1.0.0', 'chart-hr-default', 
 '{"layout": {"width": 815, "height": 500, "seats": []}, "metadata": {"version": "1.0.0"}}',
 '{"changeType": "major", "changes": [{"type": "layout_created", "description": "初始座位图创建"}]}',
 '1.0.0', '初始版本创建', 'system')
ON CONFLICT (id) DO NOTHING;

-- 验证表创建
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('seating_charts', 'seating_chart_versions', 'collaborative_sessions', 'seat_operations', 'figma_sync_status', 'cache_management');
    
    IF table_count < 6 THEN
        RAISE EXCEPTION '座位图系统表创建不完整，期望6个表，实际: %', table_count;
    END IF;
    
    RAISE NOTICE '✅ 座位图系统表结构创建完成，共创建 % 个表', table_count;
END $$;