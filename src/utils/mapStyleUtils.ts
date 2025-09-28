// 地图样式工具函数

interface MapStyleConfig {
  width: number;
  height: number;
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
}

// 默认样式配置
export const DEFAULT_MAP_STYLE: MapStyleConfig = {
  width: 560,
  height: 340,
  backgroundColor: '#f8fafc',
  borderColor: '#e2e8f0',
  borderWidth: 2,
  borderRadius: 8
};

// 样式验证函数
export const validateMapStyle = (style: Partial<MapStyleConfig>): MapStyleConfig => {
  return {
    width: Math.max(style.width || DEFAULT_MAP_STYLE.width, 200), // 最小宽度200px
    height: Math.max(style.height || DEFAULT_MAP_STYLE.height, 150), // 最小高度150px
    backgroundColor: style.backgroundColor || DEFAULT_MAP_STYLE.backgroundColor,
    borderColor: style.borderColor || DEFAULT_MAP_STYLE.borderColor,
    borderWidth: Math.max(style.borderWidth || DEFAULT_MAP_STYLE.borderWidth, 0), // 边框宽度不能为负
    borderRadius: Math.max(style.borderRadius || DEFAULT_MAP_STYLE.borderRadius, 0) // 圆角不能为负
  };
};

// 计算自适应尺寸
export const calculateAutoSize = (
  desks: Array<{ x: number; y: number; width: number; height: number }>,
  padding: number = 100
): { width: number; height: number } => {
  if (desks.length === 0) {
    return {
      width: DEFAULT_MAP_STYLE.width,
      height: DEFAULT_MAP_STYLE.height
    };
  }

  const minX = Math.min(...desks.map(d => d.x));
  const maxX = Math.max(...desks.map(d => d.x + d.width));
  const minY = Math.min(...desks.map(d => d.y));
  const maxY = Math.max(...desks.map(d => d.y + d.height));

  return {
    width: Math.max(maxX - minX + padding * 2, DEFAULT_MAP_STYLE.width),
    height: Math.max(maxY - minY + padding * 2, DEFAULT_MAP_STYLE.height)
  };
};

// 样式属性保持器 - 确保关键样式在尺寸调整时不变
export const preserveStyleProperties = (
  currentStyle: MapStyleConfig,
  newDimensions: { width?: number; height?: number }
): MapStyleConfig => {
  return {
    ...currentStyle,
    width: newDimensions.width || currentStyle.width,
    height: newDimensions.height || currentStyle.height,
    // 确保这些样式属性保持不变
    borderRadius: currentStyle.borderRadius, // 圆角保持不变
    borderWidth: currentStyle.borderWidth,   // 边框宽度保持不变
    backgroundColor: currentStyle.backgroundColor, // 背景色保持不变
    borderColor: currentStyle.borderColor    // 边框色保持不变
  };
};

// 生成SVG样式字符串
export const generateSVGStyle = (style: MapStyleConfig): string => {
  return `
    fill: ${style.backgroundColor};
    stroke: ${style.borderColor};
    stroke-width: ${style.borderWidth};
    rx: ${style.borderRadius};
  `.trim();
};

// 响应式尺寸计算 - 根据容器大小调整地图尺寸
export const calculateResponsiveSize = (
  containerWidth: number,
  containerHeight: number,
  originalWidth: number,
  originalHeight: number,
  maxScale: number = 1
): { width: number; height: number; scale: number } => {
  const scaleX = containerWidth / originalWidth;
  const scaleY = containerHeight / originalHeight;
  const scale = Math.min(scaleX, scaleY, maxScale);

  return {
    width: originalWidth * scale,
    height: originalHeight * scale,
    scale
  };
};

// 样式动画过渡配置
export const STYLE_TRANSITION_CONFIG = {
  duration: 750, // 动画持续时间(ms)
  easing: 'ease-in-out', // 缓动函数
  properties: ['width', 'height', 'fill', 'stroke', 'stroke-width', 'rx'] // 需要过渡的属性
};

// 创建样式更新函数
export const createStyleUpdater = (element: any) => {
  return (newStyle: Partial<MapStyleConfig>, animated: boolean = true) => {
    const validatedStyle = validateMapStyle(newStyle);
    
    if (animated) {
      element
        .transition()
        .duration(STYLE_TRANSITION_CONFIG.duration)
        .attr('width', validatedStyle.width)
        .attr('height', validatedStyle.height)
        .attr('fill', validatedStyle.backgroundColor)
        .attr('stroke', validatedStyle.borderColor)
        .attr('stroke-width', validatedStyle.borderWidth)
        .attr('rx', validatedStyle.borderRadius);
    } else {
      element
        .attr('width', validatedStyle.width)
        .attr('height', validatedStyle.height)
        .attr('fill', validatedStyle.backgroundColor)
        .attr('stroke', validatedStyle.borderColor)
        .attr('stroke-width', validatedStyle.borderWidth)
        .attr('rx', validatedStyle.borderRadius);
    }
    
    return validatedStyle;
  };
};

// 样式比较函数 - 检查样式是否发生变化
export const hasStyleChanged = (
  oldStyle: MapStyleConfig,
  newStyle: Partial<MapStyleConfig>
): boolean => {
  const keys = Object.keys(newStyle) as Array<keyof MapStyleConfig>;
  return keys.some(key => oldStyle[key] !== newStyle[key]);
};

// 样式合并函数 - 安全地合并样式配置
export const mergeMapStyles = (
  baseStyle: MapStyleConfig,
  overrides: Partial<MapStyleConfig>
): MapStyleConfig => {
  const merged = { ...baseStyle, ...overrides };
  return validateMapStyle(merged);
};