/**
 * 安全传输工具函数
 * 用于API请求加密、数据安全处理和身份验证
 */

import { rbacService } from '../services/rbacService';

// 简单的加密/解密函数（实际应用中应使用更强的加密算法）
class SimpleEncryption {
  private static readonly key = 'M1_WORKSTATION_SECRET_2024';

  // Base64编码
  static encode(data: string): string {
    try {
      return btoa(encodeURIComponent(data));
    } catch (error) {
      console.error('编码失败:', error);
      return data;
    }
  }

  // Base64解码
  static decode(encodedData: string): string {
    try {
      return decodeURIComponent(atob(encodedData));
    } catch (error) {
      console.error('解码失败:', error);
      return encodedData;
    }
  }

  // 简单XOR加密
  static encrypt(data: string): string {
    let result = '';
    for (let i = 0; i < data.length; i++) {
      const keyChar = this.key.charCodeAt(i % this.key.length);
      const dataChar = data.charCodeAt(i);
      result += String.fromCharCode(dataChar ^ keyChar);
    }
    return this.encode(result);
  }

  // 简单XOR解密
  static decrypt(encryptedData: string): string {
    const decodedData = this.decode(encryptedData);
    let result = '';
    for (let i = 0; i < decodedData.length; i++) {
      const keyChar = this.key.charCodeAt(i % this.key.length);
      const dataChar = decodedData.charCodeAt(i);
      result += String.fromCharCode(dataChar ^ keyChar);
    }
    return result;
  }
}

// API请求签名
export class APISignature {
  private static generateTimestamp(): number {
    return Date.now();
  }

  private static generateNonce(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  // 生成请求签名
  static generateSignature(method: string, url: string, data?: any): {
    timestamp: number;
    nonce: string;
    signature: string;
  } {
    const timestamp = this.generateTimestamp();
    const nonce = this.generateNonce();
    const session = rbacService.getCurrentSession();
    const userId = session?.user.id || 'anonymous';
    
    // 创建签名字符串
    const signatureString = [
      method.toUpperCase(),
      url,
      userId,
      timestamp.toString(),
      nonce,
      data ? JSON.stringify(data) : ''
    ].join('|');

    // 生成签名哈希
    const signature = SimpleEncryption.encrypt(signatureString);

    return { timestamp, nonce, signature };
  }

  // 验证签名
  static verifySignature(
    method: string, 
    url: string, 
    timestamp: number, 
    nonce: string, 
    signature: string, 
    data?: any
  ): boolean {
    try {
      const session = rbacService.getCurrentSession();
      const userId = session?.user.id || 'anonymous';
      
      const expectedSignatureString = [
        method.toUpperCase(),
        url,
        userId,
        timestamp.toString(),
        nonce,
        data ? JSON.stringify(data) : ''
      ].join('|');

      const decryptedSignature = SimpleEncryption.decrypt(signature);
      return decryptedSignature === expectedSignatureString;
    } catch (error) {
      console.error('签名验证失败:', error);
      return false;
    }
  }
}

// 安全的HTTP请求封装
export class SecureHTTP {
  private static readonly baseHeaders = {
    'Content-Type': 'application/json',
    'X-Client-Version': '1.3.0',
    'X-Client-Type': 'M0-Frontend'
  };

  // 添加安全头部
  private static addSecurityHeaders(headers: Record<string, string> = {}): Record<string, string> {
    const session = rbacService.getCurrentSession();
    const securityHeaders = {
      ...this.baseHeaders,
      ...headers
    };

    if (session) {
      securityHeaders['Authorization'] = `Bearer ${session.token}`;
      securityHeaders['X-User-ID'] = session.user.id;
      securityHeaders['X-Session-ID'] = session.token.substring(0, 8);
    }

    return securityHeaders;
  }

  // 安全GET请求
  static async get(url: string, options: RequestInit = {}): Promise<Response> {
    const { timestamp, nonce, signature } = APISignature.generateSignature('GET', url);
    
    const headers = this.addSecurityHeaders({
      ...options.headers as Record<string, string>,
      'X-Timestamp': timestamp.toString(),
      'X-Nonce': nonce,
      'X-Signature': signature
    });

    return fetch(url, {
      ...options,
      method: 'GET',
      headers
    });
  }

  // 安全POST请求
  static async post(url: string, data?: any, options: RequestInit = {}): Promise<Response> {
    const { timestamp, nonce, signature } = APISignature.generateSignature('POST', url, data);
    
    const headers = this.addSecurityHeaders({
      ...options.headers as Record<string, string>,
      'X-Timestamp': timestamp.toString(),
      'X-Nonce': nonce,
      'X-Signature': signature
    });

    return fetch(url, {
      ...options,
      method: 'POST',
      headers,
      body: data ? JSON.stringify(data) : undefined
    });
  }

  // 安全PUT请求
  static async put(url: string, data?: any, options: RequestInit = {}): Promise<Response> {
    const { timestamp, nonce, signature } = APISignature.generateSignature('PUT', url, data);
    
    const headers = this.addSecurityHeaders({
      ...options.headers as Record<string, string>,
      'X-Timestamp': timestamp.toString(),
      'X-Nonce': nonce,
      'X-Signature': signature
    });

    return fetch(url, {
      ...options,
      method: 'PUT',
      headers,
      body: data ? JSON.stringify(data) : undefined
    });
  }

  // 安全DELETE请求
  static async delete(url: string, options: RequestInit = {}): Promise<Response> {
    const { timestamp, nonce, signature } = APISignature.generateSignature('DELETE', url);
    
    const headers = this.addSecurityHeaders({
      ...options.headers as Record<string, string>,
      'X-Timestamp': timestamp.toString(),
      'X-Nonce': nonce,
      'X-Signature': signature
    });

    return fetch(url, {
      ...options,
      method: 'DELETE',
      headers
    });
  }
}

// 操作日志记录
export class AuditLogger {
  private static logs: Array<{
    id: string;
    timestamp: Date;
    userId: string;
    username: string;
    action: string;
    resource: string;
    details: any;
    ipAddress?: string;
    userAgent?: string;
  }> = [];

  // 记录操作日志
  static log(
    action: string, 
    resource: string, 
    details: any = {}, 
    additionalInfo: { ipAddress?: string; userAgent?: string } = {}
  ): void {
    const session = rbacService.getCurrentSession();
    if (!session) return;

    const logEntry = {
      id: this.generateLogId(),
      timestamp: new Date(),
      userId: session.user.id,
      username: session.user.username,
      action,
      resource,
      details,
      ipAddress: additionalInfo.ipAddress,
      userAgent: additionalInfo.userAgent || navigator.userAgent
    };

    this.logs.push(logEntry);
    
    // 保持最近1000条日志
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }

    // 在开发环境下输出日志
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 操作日志:', logEntry);
    }
  }

  // 获取操作日志
  static getLogs(filter?: {
    userId?: string;
    action?: string;
    resource?: string;
    startDate?: Date;
    endDate?: Date;
  }): typeof AuditLogger.logs {
    let filteredLogs = [...this.logs];

    if (filter) {
      if (filter.userId) {
        filteredLogs = filteredLogs.filter(log => log.userId === filter.userId);
      }
      if (filter.action) {
        filteredLogs = filteredLogs.filter(log => log.action === filter.action);
      }
      if (filter.resource) {
        filteredLogs = filteredLogs.filter(log => log.resource === filter.resource);
      }
      if (filter.startDate) {
        filteredLogs = filteredLogs.filter(log => log.timestamp >= filter.startDate!);
      }
      if (filter.endDate) {
        filteredLogs = filteredLogs.filter(log => log.timestamp <= filter.endDate!);
      }
    }

    return filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  private static generateLogId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
}

// 数据脱敏工具
export class DataMasking {
  // 脱敏IP地址
  static maskIP(ip: string): string {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
    }
    return ip;
  }

  // 脱敏MAC地址
  static maskMAC(mac: string): string {
    const parts = mac.split(':');
    if (parts.length === 6) {
      return `${parts[0]}:${parts[1]}:${parts[2]}:***:***:***`;
    }
    return mac;
  }

  // 脱敏用户名
  static maskUsername(username: string): string {
    if (username.length <= 2) return username;
    const firstChar = username.charAt(0);
    const lastChar = username.charAt(username.length - 1);
    const middle = '*'.repeat(username.length - 2);
    return `${firstChar}${middle}${lastChar}`;
  }

  // 脱敏敏感数据
  static maskSensitiveData(data: any, fields: string[] = ['password', 'token', 'secret']): any {
    if (typeof data !== 'object' || data === null) return data;
    
    const masked = { ...data };
    
    for (const field of fields) {
      if (masked[field]) {
        masked[field] = '***';
      }
    }
    
    return masked;
  }
}

// 导出加密工具
export { SimpleEncryption };