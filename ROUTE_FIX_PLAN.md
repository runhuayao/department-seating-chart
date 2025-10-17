# 路由配置修复方案

## 问题诊断

### 当前状态
- **端口 5173**: 主客户端应用 (vite.config.ts)
- **端口 3000**: 服务器管理应用 (vite.server-management.config.ts) 
- **端口 8080**: 后端API服务 + 静态文件服务

### 发现的问题
1. **端口冲突**: `vite.server.config.ts` 和 `vite.server-management.config.ts` 都使用端口 3000
2. **静态文件混乱**: 8080端口同时提供API和静态文件服务
3. **路由缺失**: 5173端口缺少 `/server-management` 路径的处理

## 修复方案

### 方案一：端口分离（推荐）

#### 1. 修改端口配置
- **端口 5173**: 主客户端应用
- **端口 3001**: 服务器管理应用（修改 vite.server-management.config.ts）
- **端口 8080**: 纯API服务（移除静态文件服务）

#### 2. 更新 package.json 脚本
```json
{
  "scripts": {
    "client:dev": "vite --config vite.config.ts",
    "server-management:dev": "vite --config vite.server-management.config.ts --port 3001",
    "server:dev": "tsx watch api/server.ts"
  }
}
```

#### 3. 移除后端静态文件服务
从 `api/server.ts` 中移除：
```javascript
app.use(express.static(join(__dirname, '../dist-server-management')));
```

### 方案二：前端路由集成

#### 1. 在主应用中添加路由
在 `src/App.tsx` 中添加 `/server-management` 路由：
```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ServerApp from './ServerApp';

// 在 App 组件中添加路由
<BrowserRouter>
  <Routes>
    <Route path="/server-management/*" element={<ServerApp />} />
    <Route path="/*" element={<HomePage />} />
  </Routes>
</BrowserRouter>
```

#### 2. 统一使用端口 5173
停用其他前端服务，只使用主应用端口。

## 实施步骤

### 立即执行
1. 修改 `vite.server-management.config.ts` 端口为 3001
2. 更新 `package.json` 脚本配置
3. 移除后端静态文件服务配置
4. 重启所有服务

### 验证测试
1. 访问 http://localhost:5173/ - 主应用
2. 访问 http://localhost:3001/ - 服务器管理
3. 访问 http://localhost:8080/api/health - API服务
4. 确认各端口功能独立且正确

## 预期结果

修复后的端口分配：
- **5173**: 部门地图主应用
- **3001**: M1服务器管理系统  
- **8080**: 纯API后端服务

每个端口将提供独立且明确的功能，消除路由混乱问题。