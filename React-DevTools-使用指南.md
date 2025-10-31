# React DevTools 使用指南

## 🎯 安装与配置

### 1. 全局安装
```bash
npm install -g react-devtools
```

### 2. 启动独立应用
```bash
react-devtools
```

## 🔧 项目配置

已为您的项目配置了React DevTools连接：

### 主应用 (localhost:5173)
- 文件：`src/main.tsx`
- 配置了DevTools连接钩子

### M1服务器管理平台 (localhost:3001)
- 文件：`src/server-main.tsx`
- 配置了DevTools连接钩子

## 🚀 使用方法

### 1. 启动调试环境
1. 在终端运行：`react-devtools`
2. 启动您的React应用
3. DevTools会自动检测并连接

### 2. 调试M1ServerManagement.tsx

#### 组件树查看
- 在DevTools中找到 `M1ServerManagement` 组件
- 查看组件层级结构
- 检查子组件状态

#### State调试
```javascript
// 主要状态变量
- workstations: 工位数据数组
- loading: 加载状态
- error: 错误信息
- stats: 统计数据
```

#### Props检查
- 查看传递给子组件的props
- 验证数据流向是否正确

#### 性能分析
- 使用Profiler标签页
- 记录组件渲染性能
- 识别性能瓶颈

### 3. 常用调试技巧

#### 查找组件
1. 在DevTools中使用搜索功能
2. 输入组件名称快速定位
3. 使用选择工具直接点击页面元素

#### 修改State
1. 选中组件
2. 在右侧面板修改state值
3. 实时查看页面变化

#### 查看Hooks
- useState状态
- useEffect依赖
- 自定义Hook状态

## 🔍 M1平台特定调试

### 工位数据调试
```javascript
// 在DevTools Console中执行
$r.state.workstations  // 查看工位数据
$r.state.stats         // 查看统计信息
$r.state.loading       // 查看加载状态
```

### API调用调试
1. 查看 `fetchWorkstations` 函数执行
2. 监控网络请求状态
3. 检查localStorage数据

### 错误处理调试
1. 查看error state
2. 检查try-catch块
3. 验证降级机制

## 📊 性能优化建议

### 使用Profiler
1. 点击"Start profiling"
2. 执行操作（如刷新数据）
3. 停止录制查看结果

### 关键指标
- 组件渲染时间
- 重新渲染次数
- 内存使用情况

## 🛠️ 故障排除

### DevTools无法连接
1. 确保react-devtools正在运行
2. 检查端口8097是否被占用
3. 重启应用和DevTools

### 组件不显示
1. 确保应用在开发模式运行
2. 检查React版本兼容性
3. 验证配置代码是否正确

### 性能问题
1. 使用React.memo优化组件
2. 检查useEffect依赖数组
3. 避免不必要的重新渲染

## 📝 快捷键

- `Ctrl/Cmd + F`: 搜索组件
- `Ctrl/Cmd + Shift + C`: 选择元素
- `F12`: 切换到浏览器DevTools

## 🎉 高级功能

### 时间旅行调试
- 记录状态变化历史
- 回放用户操作
- 对比不同时间点的状态

### 组件高亮
- 高亮重新渲染的组件
- 识别性能问题
- 优化渲染策略

---

**注意**: React DevTools已成功安装并配置，现在您可以开始调试您的React应用了！