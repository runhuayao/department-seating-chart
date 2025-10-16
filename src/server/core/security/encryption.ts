import crypto from 'crypto';
import { Logger } from '../../infrastructure/logging/logger';

export interface EncryptionConfig {
  algorithm: string; // 'aes-256-gcm'
  keyDerivationAlgorithm: string; // 'pbkdf2'
  keyDerivationIterations: number;
  keyLength: number; // 32 for AES-256
  ivLength: number; // 16 for AES
  tagLength: number; // 16 for GCM
  saltLength: number; // 32
  masterKey: string;
}

export interface EncryptedData {
  encrypted: string;
  iv: string;
  tag: string;
  salt: string;
}

export interface HashConfig {
  algorithm: string; // 'sha256'
  saltLength: number;
  iterations: number;
}

/**
 * 加密服务
 * 负责敏感数据的加密、解密和哈希处理
 */
export class EncryptionService {
  private logger: Logger;
  private config: EncryptionConfig;
  private hashConfig: HashConfig;
  
  // 缓存派生密钥以提高性能
  private keyCache: Map<string, Buffer> = new Map();

  constructor(logger: Logger, config: EncryptionConfig, hashConfig: HashConfig) {
    this.logger = logger;
    this.config = config;
    this.hashConfig = hashConfig;
    
    this.validateConfig();
  }

  /**
   * 验证配置
   */
  private validateConfig(): void {
    if (!this.config.masterKey || this.config.masterKey.length < 32) {
      throw new Error('Master key must be at least 32 characters long');
    }

    const supportedAlgorithms = ['aes-256-gcm', 'aes-256-cbc'];
    if (!supportedAlgorithms.includes(this.config.algorithm)) {
      throw new Error(`Unsupported encryption algorithm: ${this.config.algorithm}`);
    }

    if (this.config.keyLength < 32) {
      throw new Error('Key length must be at least 32 bytes for AES-256');
    }
  }

  /**
   * 加密敏感数据
   */
  async encryptSensitiveData(
    data: string,
    context?: string
  ): Promise<EncryptedData> {
    try {
      // 生成随机盐和IV
      const salt = crypto.randomBytes(this.config.saltLength);
      const iv = crypto.randomBytes(this.config.ivLength);

      // 派生密钥
      const key = await this.deriveKey(salt, context);

      // 创建加密器
      const cipher = crypto.createCipher(this.config.algorithm, key);
      cipher.setAAD(Buffer.from(context || 'default'));

      // 加密数据
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // 获取认证标签（仅适用于GCM模式）
      let tag = '';
      if (this.config.algorithm.includes('gcm')) {
        tag = (cipher as any).getAuthTag().toString('hex');
      }

      const result: EncryptedData = {
        encrypted,
        iv: iv.toString('hex'),
        tag,
        salt: salt.toString('hex')
      };

      this.logger.debug('Data encrypted successfully', {
        context,
        dataLength: data.length,
        encryptedLength: encrypted.length
      });

      return result;

    } catch (error) {
      this.logger.error('Encryption failed', {
        context,
        error: (error as Error).message
      });
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * 解密敏感数据
   */
  async decryptSensitiveData(
    encryptedData: EncryptedData,
    context?: string
  ): Promise<string> {
    try {
      // 重建盐和IV
      const salt = Buffer.from(encryptedData.salt, 'hex');
      const iv = Buffer.from(encryptedData.iv, 'hex');

      // 派生密钥
      const key = await this.deriveKey(salt, context);

      // 创建解密器
      const decipher = crypto.createDecipher(this.config.algorithm, key);
      
      // 设置认证标签（仅适用于GCM模式）
      if (this.config.algorithm.includes('gcm') && encryptedData.tag) {
        (decipher as any).setAuthTag(Buffer.from(encryptedData.tag, 'hex'));
      }

      decipher.setAAD(Buffer.from(context || 'default'));

      // 解密数据
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      this.logger.debug('Data decrypted successfully', {
        context,
        encryptedLength: encryptedData.encrypted.length,
        decryptedLength: decrypted.length
      });

      return decrypted;

    } catch (error) {
      this.logger.error('Decryption failed', {
        context,
        error: (error as Error).message
      });
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * 加密座位坐标
   */
  async encryptSeatCoordinates(
    coordinates: { x: number; y: number; floor: string }
  ): Promise<EncryptedData> {
    const data = JSON.stringify(coordinates);
    return this.encryptSensitiveData(data, 'seat_coordinates');
  }

  /**
   * 解密座位坐标
   */
  async decryptSeatCoordinates(
    encryptedData: EncryptedData
  ): Promise<{ x: number; y: number; floor: string }> {
    const decrypted = await this.decryptSensitiveData(encryptedData, 'seat_coordinates');
    return JSON.parse(decrypted);
  }

  /**
   * 加密员工工号
   */
  async encryptEmployeeId(employeeId: string): Promise<EncryptedData> {
    return this.encryptSensitiveData(employeeId, 'employee_id');
  }

  /**
   * 解密员工工号
   */
  async decryptEmployeeId(encryptedData: EncryptedData): Promise<string> {
    return this.decryptSensitiveData(encryptedData, 'employee_id');
  }

  /**
   * 加密用户个人信息
   */
  async encryptPersonalInfo(
    personalInfo: Record<string, any>
  ): Promise<EncryptedData> {
    const data = JSON.stringify(personalInfo);
    return this.encryptSensitiveData(data, 'personal_info');
  }

  /**
   * 解密用户个人信息
   */
  async decryptPersonalInfo(
    encryptedData: EncryptedData
  ): Promise<Record<string, any>> {
    const decrypted = await this.decryptSensitiveData(encryptedData, 'personal_info');
    return JSON.parse(decrypted);
  }

  /**
   * 生成安全哈希
   */
  async generateSecureHash(
    data: string,
    salt?: string
  ): Promise<{ hash: string; salt: string }> {
    try {
      // 生成或使用提供的盐
      const saltBuffer = salt 
        ? Buffer.from(salt, 'hex')
        : crypto.randomBytes(this.hashConfig.saltLength);

      // 生成哈希
      const hash = crypto.pbkdf2Sync(
        data,
        saltBuffer,
        this.hashConfig.iterations,
        64, // 输出长度
        this.hashConfig.algorithm
      );

      return {
        hash: hash.toString('hex'),
        salt: saltBuffer.toString('hex')
      };

    } catch (error) {
      this.logger.error('Hash generation failed', {
        error: (error as Error).message
      });
      throw new Error('Failed to generate hash');
    }
  }

  /**
   * 验证哈希
   */
  async verifyHash(
    data: string,
    hash: string,
    salt: string
  ): Promise<boolean> {
    try {
      const { hash: computedHash } = await this.generateSecureHash(data, salt);
      return this.constantTimeCompare(hash, computedHash);
    } catch (error) {
      this.logger.error('Hash verification failed', {
        error: (error as Error).message
      });
      return false;
    }
  }

  /**
   * 生成随机令牌
   */
  generateRandomToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * 生成安全的随机密码
   */
  generateSecurePassword(length: number = 16): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, charset.length);
      password += charset[randomIndex];
    }
    
    return password;
  }

  /**
   * 生成座位锁的随机盐
   */
  generateSeatLockSalt(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * 加密座位锁密钥
   */
  async encryptSeatLockKey(
    seatId: string,
    userId: string,
    salt: string
  ): Promise<string> {
    const data = `${seatId}:${userId}:${Date.now()}`;
    const key = crypto.createHash('sha256')
      .update(data + salt)
      .digest('hex');
    
    return key;
  }

  /**
   * 生成API密钥
   */
  generateApiKey(): string {
    const timestamp = Date.now().toString();
    const random = crypto.randomBytes(16).toString('hex');
    const combined = `${timestamp}:${random}`;
    
    return crypto.createHash('sha256')
      .update(combined)
      .digest('hex');
  }

  /**
   * 加密WebSocket消息
   */
  async encryptWebSocketMessage(
    message: any,
    sessionId: string
  ): Promise<EncryptedData> {
    const data = JSON.stringify(message);
    return this.encryptSensitiveData(data, `websocket:${sessionId}`);
  }

  /**
   * 解密WebSocket消息
   */
  async decryptWebSocketMessage(
    encryptedData: EncryptedData,
    sessionId: string
  ): Promise<any> {
    const decrypted = await this.decryptSensitiveData(
      encryptedData,
      `websocket:${sessionId}`
    );
    return JSON.parse(decrypted);
  }

  /**
   * 派生密钥
   */
  private async deriveKey(salt: Buffer, context?: string): Promise<Buffer> {
    const cacheKey = `${salt.toString('hex')}:${context || 'default'}`;
    
    // 检查缓存
    if (this.keyCache.has(cacheKey)) {
      return this.keyCache.get(cacheKey)!;
    }

    // 派生新密钥
    const baseKey = this.config.masterKey + (context || '');
    const derivedKey = crypto.pbkdf2Sync(
      baseKey,
      salt,
      this.config.keyDerivationIterations,
      this.config.keyLength,
      'sha256'
    );

    // 缓存密钥（限制缓存大小）
    if (this.keyCache.size >= 1000) {
      const firstKey = this.keyCache.keys().next().value;
      this.keyCache.delete(firstKey);
    }
    
    this.keyCache.set(cacheKey, derivedKey);
    return derivedKey;
  }

  /**
   * 常量时间比较（防止时序攻击）
   */
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * 清理敏感数据
   */
  private clearSensitiveData(data: any): void {
    if (typeof data === 'string') {
      // 用零覆盖字符串内存（在JavaScript中有限）
      data = '\0'.repeat(data.length);
    } else if (Buffer.isBuffer(data)) {
      data.fill(0);
    }
  }

  /**
   * 获取加密统计信息
   */
  getEncryptionStats(): {
    cachedKeys: number;
    algorithm: string;
    keyLength: number;
  } {
    return {
      cachedKeys: this.keyCache.size,
      algorithm: this.config.algorithm,
      keyLength: this.config.keyLength
    };
  }

  /**
   * 清理密钥缓存
   */
  clearKeyCache(): void {
    this.keyCache.clear();
    this.logger.debug('Encryption key cache cleared');
  }

  /**
   * 轮换主密钥（需要重新加密所有数据）
   */
  async rotateMasterKey(newMasterKey: string): Promise<void> {
    if (!newMasterKey || newMasterKey.length < 32) {
      throw new Error('New master key must be at least 32 characters long');
    }

    const oldMasterKey = this.config.masterKey;
    this.config.masterKey = newMasterKey;
    
    // 清理密钥缓存
    this.clearKeyCache();

    this.logger.warn('Master key rotated', {
      timestamp: new Date().toISOString()
    });

    // 注意：实际应用中需要重新加密所有使用旧密钥加密的数据
  }

  /**
   * 优雅关闭
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down encryption service');
    
    // 清理敏感数据
    this.clearKeyCache();
    this.config.masterKey = '';
    
    this.logger.info('Encryption service shutdown completed');
  }
}