import React from 'react';
import ReactDOM from 'react-dom/client';
import ServerApp from './ServerApp';
import './index.css';

// React DevTools 连接配置已移除，推荐使用浏览器扩展版本

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ServerApp />
  </React.StrictMode>,
);