import React from 'react';
import M1ServerManagement from './pages/M1ServerManagement';
import { AuthProvider } from './contexts/AuthContext';
import './styles/m1-theme.css';

// 服务器管理系统主应用组件
function ServerApp() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <M1ServerManagement />
      </div>
    </AuthProvider>
  );
}

export default ServerApp;