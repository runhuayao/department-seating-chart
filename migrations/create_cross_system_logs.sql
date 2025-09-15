-- 创建跨系统查询日志表
CREATE TABLE IF NOT EXISTS cross_system_logs (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL, -- 'query_from_target', 'send_to_target', 'data_sync', 'sync_receive'
  endpoint VARCHAR(255), -- API端点
  params TEXT, -- 查询参数（JSON格式）
  status VARCHAR(20) NOT NULL, -- 'success', 'error'
  error TEXT, -- 错误信息
  data_size INTEGER DEFAULT 0, -- 数据大小（字节）
  response_size INTEGER DEFAULT 0, -- 响应大小（字节）
  table_name VARCHAR(100), -- 涉及的表名
  operation VARCHAR(20), -- 操作类型：'create', 'update', 'delete'
  source VARCHAR(100), -- 数据源系统
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_cross_system_logs_type ON cross_system_logs (type);
CREATE INDEX IF NOT EXISTS idx_cross_system_logs_status ON cross_system_logs (status);
CREATE INDEX IF NOT EXISTS idx_cross_system_logs_created_at ON cross_system_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_cross_system_logs_table_operation ON cross_system_logs (table_name, operation);

-- 插入初始测试数据
INSERT INTO cross_system_logs (
  type, endpoint, params, status, data_size, response_size
) VALUES (
  'query_from_target',
  'workstations',
  '{}',
  'success',
  0,
  1024
);

INSERT INTO cross_system_logs (
  type, status, table_name, operation, source
) VALUES (
  'data_sync',
  'success',
  'workstations',
  'create',
  'localhost:3000'
)