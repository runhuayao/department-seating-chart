/**
 * 时间服务 - 提供时间相关功能
 * 集成 Time MCP 服务器功能
 */

export interface TimeInfo {
  timezone: string;
  datetime: string;
  is_dst: boolean;
}

export interface TimeConversion {
  source: TimeInfo;
  target: TimeInfo;
  time_difference: string;
}

export class TimeService {
  /**
   * 获取当前时间（指定时区）
   */
  static getCurrentTime(timezone: string = 'Asia/Shanghai'): TimeInfo {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const parts = formatter.formatToParts(now);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    const hour = parts.find(p => p.type === 'hour')?.value;
    const minute = parts.find(p => p.type === 'minute')?.value;
    const second = parts.find(p => p.type === 'second')?.value;

    const datetime = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
    
    // 获取时区偏移
    const offset = this.getTimezoneOffset(timezone);
    const isDst = this.isDaylightSavingTime(now, timezone);

    return {
      timezone,
      datetime: `${datetime}${offset}`,
      is_dst: isDst
    };
  }

  /**
   * 时区转换
   */
  static convertTime(sourceTimezone: string, time: string, targetTimezone: string): TimeConversion {
    // 解析时间字符串 (HH:MM 格式)
    const [hours, minutes] = time.split(':').map(Number);
    
    // 创建今天的日期对象
    const today = new Date();
    const sourceDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes);
    
    // 获取源时区的时间信息
    const sourceInfo = this.getTimeInTimezone(sourceDate, sourceTimezone);
    
    // 转换到目标时区
    const targetInfo = this.getTimeInTimezone(sourceDate, targetTimezone);
    
    // 计算时差
    const timeDifference = this.calculateTimeDifference(sourceTimezone, targetTimezone);

    return {
      source: sourceInfo,
      target: targetInfo,
      time_difference: timeDifference
    };
  }

  /**
   * 获取指定时区的时间信息
   */
  private static getTimeInTimezone(date: Date, timezone: string): TimeInfo {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const parts = formatter.formatToParts(date);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    const hour = parts.find(p => p.type === 'hour')?.value;
    const minute = parts.find(p => p.type === 'minute')?.value;
    const second = parts.find(p => p.type === 'second')?.value;

    const datetime = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
    const offset = this.getTimezoneOffset(timezone);
    const isDst = this.isDaylightSavingTime(date, timezone);

    return {
      timezone,
      datetime: `${datetime}${offset}`,
      is_dst: isDst
    };
  }

  /**
   * 获取时区偏移量
   */
  private static getTimezoneOffset(timezone: string): string {
    const now = new Date();
    const utc = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
    const targetTime = new Date(utc.toLocaleString('en-US', { timeZone: timezone }));
    const offset = (targetTime.getTime() - utc.getTime()) / (1000 * 60 * 60);
    
    const sign = offset >= 0 ? '+' : '-';
    const absOffset = Math.abs(offset);
    const hours = Math.floor(absOffset);
    const minutes = Math.round((absOffset - hours) * 60);
    
    return `${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  /**
   * 检查是否为夏令时
   */
  private static isDaylightSavingTime(date: Date, timezone: string): boolean {
    const january = new Date(date.getFullYear(), 0, 1);
    const july = new Date(date.getFullYear(), 6, 1);
    
    const janOffset = this.getTimezoneOffsetMinutes(january, timezone);
    const julOffset = this.getTimezoneOffsetMinutes(july, timezone);
    const currentOffset = this.getTimezoneOffsetMinutes(date, timezone);
    
    return currentOffset !== Math.max(janOffset, julOffset);
  }

  /**
   * 获取时区偏移分钟数
   */
  private static getTimezoneOffsetMinutes(date: Date, timezone: string): number {
    const utc = new Date(date.getTime() + (date.getTimezoneOffset() * 60000));
    const targetTime = new Date(utc.toLocaleString('en-US', { timeZone: timezone }));
    return (targetTime.getTime() - utc.getTime()) / (1000 * 60);
  }

  /**
   * 计算两个时区之间的时差
   */
  private static calculateTimeDifference(sourceTimezone: string, targetTimezone: string): string {
    const now = new Date();
    const sourceOffset = this.getTimezoneOffsetMinutes(now, sourceTimezone);
    const targetOffset = this.getTimezoneOffsetMinutes(now, targetTimezone);
    
    const diffMinutes = targetOffset - sourceOffset;
    const diffHours = diffMinutes / 60;
    
    const sign = diffHours >= 0 ? '+' : '';
    return `${sign}${diffHours.toFixed(1)}h`;
  }

  /**
   * 更新数据的时间戳
   */
  static updateTimestamp(data: any): any {
    const currentTime = this.getCurrentTime();
    return {
      ...data,
      lastUpdated: currentTime.datetime,
      timezone: currentTime.timezone,
      updateTime: new Date().toISOString()
    };
  }

  /**
   * 格式化时间显示
   */
  static formatTime(datetime: string, format: 'full' | 'date' | 'time' = 'full'): string {
    const date = new Date(datetime);
    
    switch (format) {
      case 'date':
        return date.toLocaleDateString('zh-CN');
      case 'time':
        return date.toLocaleTimeString('zh-CN');
      case 'full':
      default:
        return date.toLocaleString('zh-CN');
    }
  }

  /**
   * 获取相对时间描述
   */
  static getRelativeTime(datetime: string): string {
    const now = new Date();
    const target = new Date(datetime);
    const diffMs = now.getTime() - target.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return '刚刚';
    if (diffMinutes < 60) return `${diffMinutes}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    
    return this.formatTime(datetime, 'date');
  }
}