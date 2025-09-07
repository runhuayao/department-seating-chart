// API工具函数
const API_BASE_URL = 'http://localhost:8080/api';

// 重试配置
const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000,
  retryMultiplier: 2,
};

// 获取认证头
function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

// 延迟函数
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 通用API请求函数（带重试机制）
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  retryCount: number = 0
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const config: RequestInit = {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      if (response.status === 401) {
        // 认证失败，清除本地存储的token
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_info');
        // 触发认证状态更新事件
        window.dispatchEvent(new CustomEvent('auth-expired'));
        throw new Error('认证失败，请重新登录');
      }
      
      if (response.status === 429) {
        // 请求频率限制，等待后重试
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : RETRY_CONFIG.retryDelay;
        
        if (retryCount < RETRY_CONFIG.maxRetries) {
          await delay(waitTime);
          return apiRequest(endpoint, options, retryCount + 1);
        }
      }
      
      // 网络错误或服务器错误，尝试重试
      if (response.status >= 500 && retryCount < RETRY_CONFIG.maxRetries) {
        const waitTime = RETRY_CONFIG.retryDelay * Math.pow(RETRY_CONFIG.retryMultiplier, retryCount);
        await delay(waitTime);
        return apiRequest(endpoint, options, retryCount + 1);
      }
      
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    // 网络连接错误，尝试重试
    if (error instanceof TypeError && error.message.includes('fetch') && retryCount < RETRY_CONFIG.maxRetries) {
      const waitTime = RETRY_CONFIG.retryDelay * Math.pow(RETRY_CONFIG.retryMultiplier, retryCount);
      await delay(waitTime);
      return apiRequest(endpoint, options, retryCount + 1);
    }
    
    console.error('API请求失败:', {
      endpoint,
      error: error.message,
      retryCount,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

// 工位相关API
export const workstationAPI = {
  // 获取所有工位
  getAll: () => apiRequest<any[]>('/workstations'),
  
  // 获取单个工位
  getById: (id: string) => apiRequest<any>(`/workstations/${id}`),
  
  // 创建工位
  create: (data: any) => apiRequest<any>('/workstations', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  // 更新工位
  update: (id: string, data: any) => apiRequest<any>(`/workstations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  
  // 删除工位
  delete: (id: string) => apiRequest<any>(`/workstations/${id}`, {
    method: 'DELETE',
  }),
  
  // 搜索工位
  search: (query: string) => apiRequest<any[]>(`/workstations/search?q=${encodeURIComponent(query)}`),
  
  // 获取统计信息
  getStats: () => apiRequest<any>('/workstations/stats'),
};

// 认证相关API
export const authAPI = {
  // 登录
  login: (credentials: { username: string; password: string }) => 
    apiRequest<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),
  
  // 注册
  register: (userData: { username: string; email: string; password: string; role?: string }) => 
    apiRequest<{ message: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),
  
  // 验证token
  verifyToken: () => apiRequest<{ user: any }>('/auth/verify'),
};

// 用户相关API
export const userAPI = {
  // 获取当前用户信息
  getCurrentUser: () => apiRequest<any>('/users/me'),
  
  // 更新用户信息
  updateProfile: (data: any) => apiRequest<any>('/users/me', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
};

// 部门相关API
export const departmentAPI = {
  // 获取所有部门
  getAll: () => apiRequest<any[]>('/departments'),
  
  // 获取部门详情
  getById: (id: string) => apiRequest<any>(`/departments/${id}`),
  
  // 创建部门
  create: (data: any) => apiRequest<any>('/departments', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};

export default {
  workstationAPI,
  authAPI,
  userAPI,
  departmentAPI,
};