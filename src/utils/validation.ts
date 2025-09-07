/**
 * 数据验证工具函数
 * 用于验证工位管理相关数据的格式和完整性
 */

// IP地址验证
export const validateIPAddress = (ip: string): boolean => {
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipRegex.test(ip);
};

// 端口号验证
export const validatePort = (port: number): boolean => {
  return port >= 1 && port <= 65535;
};

// 工位名称验证
export const validateWorkstationName = (name: string): boolean => {
  if (!name || name.trim().length === 0) return false;
  if (name.length > 50) return false;
  // 允许中文、英文、数字、下划线、连字符
  const nameRegex = /^[\u4e00-\u9fa5a-zA-Z0-9_-]+$/;
  return nameRegex.test(name.trim());
};

// 用户名验证
export const validateUsername = (username: string): boolean => {
  if (!username || username.trim().length === 0) return false;
  if (username.length > 30) return false;
  // 允许英文、数字、下划线
  const usernameRegex = /^[a-zA-Z0-9_]+$/;
  return usernameRegex.test(username.trim());
};

// 部门验证
export const validateDepartment = (department: string): boolean => {
  if (!department || department.trim().length === 0) return false;
  if (department.length > 100) return false;
  return true;
};

// MAC地址验证
export const validateMACAddress = (mac: string): boolean => {
  const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
  return macRegex.test(mac);
};

// 操作系统验证
export const validateOS = (os: string): boolean => {
  const validOS = ['Windows', 'Linux', 'macOS', 'Ubuntu', 'CentOS', 'Other'];
  return validOS.includes(os);
};

// CPU架构验证
export const validateCPUArch = (arch: string): boolean => {
  const validArch = ['x64', 'x86', 'ARM64', 'ARM32'];
  return validArch.includes(arch);
};

// 网络类型验证
export const validateNetworkType = (type: string): boolean => {
  const validTypes = ['Ethernet', 'WiFi', 'Cellular', 'Other'];
  return validTypes.includes(type);
};

// 工位状态验证
export const validateWorkstationStatus = (status: string): boolean => {
  const validStatuses = ['active', 'inactive', 'maintenance', 'offline'];
  return validStatuses.includes(status);
};

// 工位完整性验证
export interface WorkstationValidationResult {
  isValid: boolean;
  errors: string[];
}

export const validateWorkstation = (workstation: any): WorkstationValidationResult => {
  const errors: string[] = [];

  // 必填字段验证
  if (!validateWorkstationName(workstation.name)) {
    errors.push('工位名称格式不正确');
  }

  if (!validateIPAddress(workstation.ipAddress)) {
    errors.push('IP地址格式不正确');
  }

  if (!validateUsername(workstation.username)) {
    errors.push('用户名格式不正确');
  }

  if (!validateDepartment(workstation.department)) {
    errors.push('部门信息不能为空');
  }

  // 可选字段验证
  if (workstation.metadata) {
    const { metadata } = workstation;
    
    if (metadata.macAddress && !validateMACAddress(metadata.macAddress)) {
      errors.push('MAC地址格式不正确');
    }

    if (metadata.operatingSystem && !validateOS(metadata.operatingSystem)) {
      errors.push('操作系统类型不正确');
    }

    if (metadata.cpuArchitecture && !validateCPUArch(metadata.cpuArchitecture)) {
      errors.push('CPU架构类型不正确');
    }

    if (metadata.networkType && !validateNetworkType(metadata.networkType)) {
      errors.push('网络类型不正确');
    }

    if (metadata.port && !validatePort(metadata.port)) {
      errors.push('端口号范围应在1-65535之间');
    }
  }

  if (workstation.status && !validateWorkstationStatus(workstation.status)) {
    errors.push('工位状态不正确');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// 批量验证工位数据
export const validateWorkstationBatch = (workstations: any[]): {
  validWorkstations: any[];
  invalidWorkstations: { index: number; workstation: any; errors: string[] }[];
} => {
  const validWorkstations: any[] = [];
  const invalidWorkstations: { index: number; workstation: any; errors: string[] }[] = [];

  workstations.forEach((workstation, index) => {
    const validation = validateWorkstation(workstation);
    if (validation.isValid) {
      validWorkstations.push(workstation);
    } else {
      invalidWorkstations.push({
        index,
        workstation,
        errors: validation.errors
      });
    }
  });

  return { validWorkstations, invalidWorkstations };
};

// 数据清理函数
export const sanitizeWorkstationData = (workstation: any): any => {
  return {
    ...workstation,
    name: workstation.name?.trim(),
    ipAddress: workstation.ipAddress?.trim(),
    username: workstation.username?.trim(),
    department: workstation.department?.trim(),
    description: workstation.description?.trim() || '',
    metadata: workstation.metadata ? {
      ...workstation.metadata,
      macAddress: workstation.metadata.macAddress?.trim().toUpperCase(),
      operatingSystem: workstation.metadata.operatingSystem?.trim(),
      cpuArchitecture: workstation.metadata.cpuArchitecture?.trim(),
      networkType: workstation.metadata.networkType?.trim()
    } : undefined
  };
};

// 敏感数据脱敏
export const sanitizeForDisplay = (workstation: any): any => {
  const sanitized = { ...workstation };
  
  // 脱敏IP地址（显示前三段）
  if (sanitized.ipAddress) {
    const ipParts = sanitized.ipAddress.split('.');
    if (ipParts.length === 4) {
      sanitized.displayIP = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.***`;
    }
  }

  // 脱敏MAC地址（显示前三段）
  if (sanitized.metadata?.macAddress) {
    const macParts = sanitized.metadata.macAddress.split(':');
    if (macParts.length === 6) {
      sanitized.metadata.displayMAC = `${macParts[0]}:${macParts[1]}:${macParts[2]}:***:***:***`;
    }
  }

  return sanitized;
};