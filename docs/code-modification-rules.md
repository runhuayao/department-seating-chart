# 代码修改流程规范 v2.0+

## 1. 总体原则

### 1.1 文档先行原则
- 任何代码修改前必须先更新或创建相关技术文档
- 文档必须包含完整的上下文信息：修改背景、目的、影响范围
- 采用分步记录方式，确保每个操作步骤都可追溯

### 1.2 问题追踪原则
- 对重复出现但未彻底解决的问题，必须在本文档中明确标注
- 设置提醒机制，防止问题再次发生
- 建立问题解决方案知识库

## 2. 技术文档要求

### 2.1 文档结构标准
```markdown
# [功能/模块名称] 技术文档

## 1. 修改背景
- 问题现象描述
- 影响范围分析
- 修改必要性说明

## 2. 解决方案
- 技术方案设计
- 实现步骤详述
- 风险评估和预案

## 3. 影响分析
- 系统影响范围
- 用户体验影响
- 性能影响评估

## 4. 测试验证
- 测试用例设计
- 验收标准定义
- 回归测试计划
```

### 2.2 分步记录要求
每个操作步骤必须记录：
- 操作时间戳
- 操作内容描述
- 预期结果
- 实际结果
- 异常情况处理

## 3. 重复问题管理

### 3.1 已知重复问题清单

#### 🚨 高优先级问题

**问题1: 搜索功能部门覆盖不全**
- **现象**: 仅技术部人员可被搜索，其他部门人员无法检索
- **根本原因**: PostgreSQL索引未覆盖所有部门数据
- **解决方案**: 重建全量索引，确保所有部门数据可检索
- **提醒机制**: 每次数据库结构变更后必须验证索引完整性
- **最后发生**: v1.x版本
- **解决状态**: ✅ v2.0已解决

**问题2: 前端数据与数据库不同步**
- **现象**: 前端展示数据与数据库实际数据存在差异
- **根本原因**: 使用虚拟文件作为数据源，缺乏实时同步机制
- **解决方案**: 统一使用SQL查询生成的缓存文件，建立WebSocket实时同步
- **提醒机制**: 禁止使用虚拟文件，所有数据源必须来自数据库
- **最后发生**: v1.x版本
- **解决状态**: ✅ v2.0已解决

#### ⚠️ 中优先级问题

**问题3: TypeScript类型错误**
- **现象**: 编译时出现大量类型错误
- **根本原因**: 接口定义不完整，类型声明缺失
- **解决方案**: 完善类型定义，启用严格模式
- **提醒机制**: 每次提交前必须通过TypeScript检查
- **最后发生**: 当前版本
- **解决状态**: 🔄 进行中

### 3.2 问题预防机制

#### 3.2.1 代码审查检查点
- [ ] 数据源是否来自数据库而非虚拟文件
- [ ] 是否建立了适当的索引
- [ ] 是否有实时同步机制
- [ ] TypeScript类型是否完整
- [ ] 是否有单元测试覆盖

#### 3.2.2 自动化检查
```bash
# 提交前检查脚本
#!/bin/bash
echo "🔍 执行代码质量检查..."

# TypeScript类型检查
npm run check
if [ $? -ne 0 ]; then
  echo "❌ TypeScript检查失败"
  exit 1
fi

# 单元测试
npm run test
if [ $? -ne 0 ]; then
  echo "❌ 单元测试失败"
  exit 1
fi

# 数据库连接测试
npm run test:db
if [ $? -ne 0 ]; then
  echo "❌ 数据库连接测试失败"
  exit 1
fi

echo "✅ 所有检查通过"
```

## 4. Git提交规范

### 4.1 提交信息格式
```
<type>(<scope>): <subject>

<body>

<footer>
```

### 4.2 类型定义
- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建过程或辅助工具变动

### 4.3 提交示例
```bash
# 功能开发
git commit -m "feat(search): 实现跨部门搜索功能

- 重建PostgreSQL全量索引
- 新增搜索缓存系统
- 支持多条件组合查询

Closes #123"

# 问题修复
git commit -m "fix(sync): 修复前端数据与数据库不同步问题

- 禁用虚拟文件数据源
- 实现WebSocket实时同步
- 添加数据一致性验证

Fixes #456"
```

## 5. 代码质量标准

### 5.1 TypeScript配置
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### 5.2 ESLint规则
```json
{
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": "error",
    "prefer-const": "error",
    "no-var": "error"
  }
}
```

### 5.3 测试覆盖率要求
- 单元测试覆盖率 ≥ 80%
- 集成测试覆盖率 ≥ 60%
- 关键业务逻辑覆盖率 = 100%

## 6. 部署流程

### 6.1 部署前检查
```bash
# 1. 代码质量检查
npm run lint
npm run check
npm run test

# 2. 构建测试
npm run build

# 3. 数据库迁移测试
npm run migrate:test

# 4. 性能测试
npm run test:performance
```

### 6.2 部署步骤
1. **备份数据库**
2. **执行数据库迁移**
3. **部署应用代码**
4. **验证服务状态**
5. **执行冒烟测试**
6. **监控系统指标**

### 6.3 回滚预案
```bash
# 快速回滚脚本
#!/bin/bash
echo "🔄 执行紧急回滚..."

# 1. 回滚应用代码
git checkout $PREVIOUS_VERSION
npm run build
npm run deploy

# 2. 回滚数据库（如需要）
npm run migrate:rollback

# 3. 验证服务状态
npm run health-check

echo "✅ 回滚完成"
```

## 7. 监控和告警

### 7.1 关键指标监控
- 搜索响应时间 < 500ms
- 数据同步延迟 < 5s
- 系统可用性 > 99.9%
- 错误率 < 0.1%

### 7.2 告警规则
```yaml
# 搜索性能告警
- alert: SearchPerformanceDegraded
  expr: search_response_time_p95 > 1000
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "搜索性能下降"

# 数据同步告警
- alert: DataSyncDelayed
  expr: data_sync_delay > 30
  for: 2m
  labels:
    severity: critical
  annotations:
    summary: "数据同步延迟"
```

## 8. 文档维护

### 8.1 文档更新时机
- 每次功能开发完成后
- 每次问题修复后
- 每月定期审查
- 版本发布前

### 8.2 文档审查清单
- [ ] 内容是否准确完整
- [ ] 步骤是否可重现
- [ ] 示例是否有效
- [ ] 链接是否可访问
- [ ] 版本信息是否更新

---

**规范版本**: v2.0.0  
**生效日期**: 2024-01-XX  
**适用范围**: 所有v2.0+版本开发  
**维护责任**: 技术负责人  
**审核周期**: 每季度