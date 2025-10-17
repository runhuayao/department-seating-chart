/**
 * 时间工具函数
 * 用于获取和格式化中国标准时间（CST）
 */

/**
 * 获取当前中国标准时间
 * @returns 格式化的时间字符串 YYYY-MM-DD HH:MM:SS
 */
export const getCurrentCSTTime = (): string => {
  const now = new Date();
  
  // 转换为中国标准时间（UTC+8）
  const cstTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  
  const year = cstTime.getUTCFullYear();
  const month = String(cstTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(cstTime.getUTCDate()).padStart(2, '0');
  const hours = String(cstTime.getUTCHours()).padStart(2, '0');
  const minutes = String(cstTime.getUTCMinutes()).padStart(2, '0');
  const seconds = String(cstTime.getUTCSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

/**
 * 获取随机的过去时间（用于模拟不同的时间戳）
 * @param minutesAgo 多少分钟前的时间
 * @returns 格式化的时间字符串
 */
export const getRandomPastTime = (minutesAgo: number = 0): string => {
  const now = new Date();
  const pastTime = new Date(now.getTime() - (minutesAgo * 60 * 1000));
  
  // 转换为中国标准时间（UTC+8）
  const cstTime = new Date(pastTime.getTime() + (8 * 60 * 60 * 1000));
  
  const year = cstTime.getUTCFullYear();
  const month = String(cstTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(cstTime.getUTCDate()).padStart(2, '0');
  const hours = String(cstTime.getUTCHours()).padStart(2, '0');
  const minutes = String(cstTime.getUTCMinutes()).padStart(2, '0');
  const seconds = String(cstTime.getUTCSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

/**
 * 获取未来时间（用于下次同步时间等）
 * @param minutesLater 多少分钟后的时间
 * @returns 格式化的时间字符串
 */
export const getFutureTime = (minutesLater: number = 5): string => {
  const now = new Date();
  const futureTime = new Date(now.getTime() + (minutesLater * 60 * 1000));
  
  // 转换为中国标准时间（UTC+8）
  const cstTime = new Date(futureTime.getTime() + (8 * 60 * 60 * 1000));
  
  const year = cstTime.getUTCFullYear();
  const month = String(cstTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(cstTime.getUTCDate()).padStart(2, '0');
  const hours = String(cstTime.getUTCHours()).padStart(2, '0');
  const minutes = String(cstTime.getUTCMinutes()).padStart(2, '0');
  const seconds = String(cstTime.getUTCSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

/**
 * 格式化时间戳为CST时间
 * @param timestamp 时间戳或Date对象
 * @returns 格式化的时间字符串
 */
export const formatToCSTTime = (timestamp: number | Date): string => {
  const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
  
  // 转换为中国标准时间（UTC+8）
  const cstTime = new Date(date.getTime() + (8 * 60 * 60 * 1000));
  
  const year = cstTime.getUTCFullYear();
  const month = String(cstTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(cstTime.getUTCDate()).padStart(2, '0');
  const hours = String(cstTime.getUTCHours()).padStart(2, '0');
  const minutes = String(cstTime.getUTCMinutes()).padStart(2, '0');
  const seconds = String(cstTime.getUTCSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};