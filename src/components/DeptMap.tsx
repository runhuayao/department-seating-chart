import React, { useEffect, useRef, useState } from 'react';
import { zoom, zoomIdentity, ZoomBehavior } from 'd3-zoom';
import { select } from 'd3-selection';
import { 
  getDepartmentConfig, 
  getEmployeeById, 
  Desk as DeskType, 
  Employee, 
  MapData 
} from '../data/departmentData';

// 扩展Desk接口以包含员工信息
interface DeskWithEmployee extends DeskType {
  employee?: Employee;
}

interface DeptMapProps {
  department: string;
  searchQuery?: string; // 搜索查询字符串
  isHomepage?: boolean; // 新增：标识是否为首页模式
  highlightDeskId?: string; // 需要高亮的工位ID
  onResetView?: () => void; // 重置视图回调函数
}

const DeptMap: React.FC<DeptMapProps> = ({ department, searchQuery = '', isHomepage = false, highlightDeskId, onResetView }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedDesk, setSelectedDesk] = useState<DeskWithEmployee | null>(null);
  const [highlightedDesk, setHighlightedDesk] = useState<string | null>(null);
  const [apiDesks, setApiDesks] = useState<any[]>([]);
  const [isLoadingDesks, setIsLoadingDesks] = useState(false);
  
  // 获取当前部门的配置数据
  const deptConfig = getDepartmentConfig(department);
  
  // 从API获取实时工位数据
  useEffect(() => {
    const fetchWorkstations = async () => {
      if (!department) return;
      
      setIsLoadingDesks(true);
      try {
        const response = await fetch('http://localhost:8080/api/workstations');
        if (response.ok) {
          const workstations = await response.json();
          // 过滤当前部门的工位
          const departmentDesks = workstations.filter((ws: any) => 
            ws.department === department || 
            (department === 'Engineering' && (ws.department === '工程部' || ws.department === 'Engineering'))
          );
          setApiDesks(departmentDesks);
          console.log(`获取到 ${departmentDesks.length} 个 ${department} 部门的工位`);
        }
      } catch (error) {
        console.error('获取工位数据失败:', error);
      } finally {
        setIsLoadingDesks(false);
      }
    };
    
    fetchWorkstations();
  }, [department]);
  
  // 如果部门配置不存在，显示错误提示
  if (!deptConfig) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">部门不存在</h3>
          <p className="text-gray-600">未找到部门 "{department}" 的配置信息</p>
          <div className="mt-4 text-sm text-gray-500">
            <p>可用的部门：Engineering, Marketing, Sales, HR</p>
            <p>或中文名称：工程部, 市场部, 销售部, 人事部</p>
          </div>
        </div>
      </div>
    );
  }
  
  const { mapData, desks } = deptConfig;
  
  // 合并静态工位数据和API工位数据
  const combinedDesks = [...desks];
  
  // 将API工位数据转换为地图工位格式并添加到列表中
  apiDesks.forEach((apiDesk, index) => {
    const existingDesk = combinedDesks.find(desk => desk.label === apiDesk.name);
    if (!existingDesk) {
      // 优先使用用户设置的坐标，否则使用自动分配
      let x, y;
      if (apiDesk.location?.position?.x && apiDesk.location?.position?.y) {
        // 使用用户设置的坐标
        x = apiDesk.location.position.x;
        y = apiDesk.location.position.y;
      } else {
        // 自动分配位置（网格布局）
        const baseX = 100;
        const baseY = 300; // 在现有工位下方
        const spacing = 120;
        const cols = 6;
        const row = Math.floor(index / cols);
        const col = index % cols;
        x = baseX + col * spacing;
        y = baseY + row * 60;
      }
      
      const newDesk = {
        desk_id: apiDesk.id,
        x: x,
        y: y,
        w: 60,
        h: 40,
        label: apiDesk.name,
        employee_id: undefined,
        department: department
      };
      
      combinedDesks.push(newDesk);
      console.log(`添加新工位: ${apiDesk.name} 位置: (${newDesk.x}, ${newDesk.y})`);
    }
  });
  
  // 为工位数据添加员工信息
  const desksWithEmployees: DeskWithEmployee[] = combinedDesks.map(desk => ({
    ...desk,
    employee: desk.employee_id ? getEmployeeById(desk.employee_id) : undefined
  }));

  // 处理工位高亮
  useEffect(() => {
    if (highlightDeskId && svgRef.current && containerRef.current) {
      setHighlightedDesk(highlightDeskId);
      
      // 找到对应的工位并聚焦
      const targetDesk = desksWithEmployees.find(desk => desk.desk_id === highlightDeskId);
      if (targetDesk) {
        const svg = select(svgRef.current);
        const container = containerRef.current;
        const containerRect = container.getBoundingClientRect();
        const centerX = containerRect.width / 2;
        const centerY = containerRect.height / 2;
        
        // 计算目标工位的中心点
        const deskCenterX = targetDesk.x + targetDesk.w / 2;
        const deskCenterY = targetDesk.y + targetDesk.h / 2;
        
        // 设置缩放级别为1.5倍
        const scale = 1.5;
        const translateX = centerX - deskCenterX * scale;
        const translateY = centerY - deskCenterY * scale;
        
        // 简化zoom操作，避免复杂的引用
        setTimeout(() => {
          try {
            svg.transition()
              .duration(1000)
              .attr('transform', `translate(${translateX}, ${translateY}) scale(${scale})`);
          } catch (error) {
            console.warn('Zoom operation failed:', error);
          }
        }, 200);
      }
      
      // 3秒后取消高亮
      const timer = setTimeout(() => {
        setHighlightedDesk(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [highlightDeskId, desksWithEmployees]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const svg = select(svgRef.current);
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 设置SVG尺寸
    svg.attr('width', width).attr('height', height);

    // 清除之前的内容
    svg.selectAll('*').remove();

    // 计算工位的边界
    const minX = Math.min(...desksWithEmployees.map(d => d.x));
    const maxX = Math.max(...desksWithEmployees.map(d => d.x + d.w));
    const minY = Math.min(...desksWithEmployees.map(d => d.y));
    const maxY = Math.max(...desksWithEmployees.map(d => d.y + d.h));
    
    const contentWidth = maxX - minX + 100; // 添加边距
    const contentHeight = maxY - minY + 150; // 添加边距，为底部图例预留空间
    
    // 计算缩放比例以适应容器
    const scaleX = width / contentWidth;
    const scaleY = height / contentHeight;
    const initialScale = Math.min(scaleX, scaleY, 1); // 不超过1倍缩放
    
    // 计算居中偏移
    const offsetX = (width - contentWidth * initialScale) / 2;
    const offsetY = (height - contentHeight * initialScale) / 2;

    // 创建缩放行为 - 根据是否为首页模式调整缩放范围
    const zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> = zoom<SVGSVGElement, unknown>()
      .scaleExtent(isHomepage ? [1, 1] : [0.3, 3]) // 首页模式禁用缩放，详情页允许缩放
      .on('zoom', (event) => {
        const { transform } = event;
        g.attr('transform', transform.toString());
      });

    // 应用缩放行为到SVG - 首页模式禁用交互
    if (!isHomepage) {
      svg.call(zoomBehavior);
    }
    
    // 直接使用zoomBehavior变量而不是存储在DOM上
    const storedZoomBehavior = zoomBehavior;

    // 创建主要的g元素用于缩放和平移
    const g = svg.append('g');

    // 设置初始变换以适应内容
    const initialTransform = `translate(${offsetX - minX * initialScale}, ${offsetY - minY * initialScale}) scale(${initialScale})`;
    g.attr('transform', initialTransform);

    // 重置缩放到自适应初始状态
    const resetZoom = () => {
      try {
        // 清除工位高亮状态
        setHighlightedDesk(null);
        
        // 调用父组件的重置回调，清除highlightDeskId
        if (onResetView) {
          onResetView();
        }
        
        // 重新计算当前容器尺寸和适配参数
        const currentWidth = container.clientWidth;
        const currentHeight = container.clientHeight;
        
        // 检查是否有工位数据
        if (desksWithEmployees.length === 0) {
          console.warn('No desks data available for reset');
          return;
        }
        
        // 重新计算工位边界
        const currentMinX = Math.min(...desksWithEmployees.map(d => d.x));
        const currentMaxX = Math.max(...desksWithEmployees.map(d => d.x + d.w));
        const currentMinY = Math.min(...desksWithEmployees.map(d => d.y));
        const currentMaxY = Math.max(...desksWithEmployees.map(d => d.y + d.h));
        
        // 使用与初始化相同的边距和计算逻辑
        const currentContentWidth = currentMaxX - currentMinX + 100; // 与初始化保持一致
        const currentContentHeight = currentMaxY - currentMinY + 150; // 与初始化保持一致
        
        // 重新计算适配缩放比例，与初始化逻辑一致
        const currentScaleX = currentWidth / currentContentWidth;
        const currentScaleY = currentHeight / currentContentHeight;
        const currentInitialScale = Math.min(currentScaleX, currentScaleY, 1);
        
        // 重新计算居中偏移，与初始化逻辑一致
        const currentOffsetX = (currentWidth - currentContentWidth * currentInitialScale) / 2;
        const currentOffsetY = (currentHeight - currentContentHeight * currentInitialScale) / 2;
        
        // 使用与初始化完全相同的变换计算
        const resetTranslateX = currentOffsetX - currentMinX * currentInitialScale;
        const resetTranslateY = currentOffsetY - currentMinY * currentInitialScale;
        
        console.log('Reset zoom with initial logic:', {
          containerSize: { width: currentWidth, height: currentHeight },
          contentBounds: { minX: currentMinX, maxX: currentMaxX, minY: currentMinY, maxY: currentMaxY },
          contentSize: { width: currentContentWidth, height: currentContentHeight },
          scale: currentInitialScale,
          offset: { x: currentOffsetX, y: currentOffsetY },
          finalTranslate: { x: resetTranslateX, y: resetTranslateY }
        });
        
        if (storedZoomBehavior && typeof storedZoomBehavior.transform === 'function' && !isHomepage) {
          svg.transition()
            .duration(750)
            .call(storedZoomBehavior.transform, 
              zoomIdentity
                .translate(resetTranslateX, resetTranslateY)
                .scale(currentInitialScale)
            );
        } else {
          // 首页模式或缺少zoomBehavior时直接设置变换
          g.transition()
            .duration(750)
            .attr('transform', `translate(${resetTranslateX}, ${resetTranslateY}) scale(${currentInitialScale})`);
        }
      } catch (error) {
        console.warn('Reset zoom operation failed:', error);
      }
    };

    // 绘制地图背景 - 居中显示
    const backgroundX = (contentWidth - (maxX - minX)) / 2 - 50;
    const backgroundY = (contentHeight - (maxY - minY)) / 2 - 50;
    
    g.append('rect')
      .attr('x', backgroundX)
      .attr('y', backgroundY)
      .attr('width', maxX - minX + 100)
      .attr('height', maxY - minY + 100)
      .attr('fill', '#f8fafc')
      .attr('stroke', '#e2e8f0')
      .attr('stroke-width', 2)
      .attr('rx', 8);

    // 添加地图标题 - 居中显示
    const titleX = contentWidth / 2;
    const titleY = backgroundY + 30;
    
    g.append('text')
      .attr('x', titleX)
      .attr('y', titleY)
      .attr('text-anchor', 'middle')
      .attr('font-size', isHomepage ? '14px' : '18px')
      .attr('font-weight', 'bold')
      .attr('fill', '#1e293b')
      .text(`${mapData.dept_name} 部门地图`);

    // 坐标网格辅助线 (开发模式)
    if (process.env.NODE_ENV === 'development') {
      const gridGroup = g.append('g')
        .attr('class', 'coordinate-grid')
        .attr('opacity', 0.1);
      
      // 垂直网格线
      for (let i = 0; i <= 10; i++) {
        gridGroup.append('line')
          .attr('x1', i * 100)
          .attr('y1', 0)
          .attr('x2', i * 100)
          .attr('y2', 800)
          .attr('stroke', '#666')
          .attr('stroke-width', 1);
      }
      
      // 水平网格线
      for (let i = 0; i <= 8; i++) {
        gridGroup.append('line')
          .attr('x1', 0)
          .attr('y1', i * 100)
          .attr('x2', 1000)
          .attr('y2', i * 100)
          .attr('stroke', '#666')
          .attr('stroke-width', 1);
      }
      
      // 坐标标签
      for (let i = 0; i <= 10; i++) {
        gridGroup.append('text')
          .attr('x', i * 100)
          .attr('y', 15)
          .attr('font-size', '10px')
          .attr('fill', '#666')
          .attr('text-anchor', 'middle')
          .text(i * 100);
      }
      
      for (let i = 0; i <= 8; i++) {
        gridGroup.append('text')
          .attr('x', 15)
          .attr('y', i * 100 + 5)
          .attr('font-size', '10px')
          .attr('fill', '#666')
          .attr('text-anchor', 'middle')
          .text(i * 100);
      }
    }

    // 绘制工位
    const deskGroups = g.selectAll('.desk')
      .data(desksWithEmployees)
      .enter()
      .append('g')
      .attr('class', 'desk')
      .attr('transform', d => `translate(${d.x}, ${d.y})`)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        if (!isHomepage) { // 首页模式下不显示详情
          setSelectedDesk(d);
        }
      });

    // 绘制工位矩形
    deskGroups.append('rect')
      .attr('width', d => d.w)
      .attr('height', d => d.h)
      .attr('fill', d => {
        if (!d.employee) return '#f1f5f9'; // 空工位 - 白色
        return d.employee.status === 'online' ? '#10b981' : '#ef4444'; // 在线绿色/离线红色
      })
      .attr('stroke', d => highlightedDesk === d.desk_id ? '#fbbf24' : '#64748b')
      .attr('stroke-width', d => highlightedDesk === d.desk_id ? 3 : 1)
      .attr('rx', 4)
      .style('filter', d => highlightedDesk === d.desk_id ? 'drop-shadow(0 0 8px #fbbf24)' : 'none');

    // 添加工位标签
    deskGroups.append('text')
      .attr('x', d => d.w / 2)
      .attr('y', d => d.h / 2 - 5)
      .attr('text-anchor', 'middle')
      .attr('font-size', isHomepage ? '10px' : '12px')
      .attr('font-weight', 'bold')
      .attr('fill', '#1e293b')
      .text(d => d.label);

    // 首页模式下不显示员工姓名，只显示工位状态颜色
    if (!isHomepage) {
      // 添加员工姓名
      deskGroups.append('text')
        .attr('x', d => d.w / 2)
        .attr('y', d => d.h / 2 + 8)
        .attr('text-anchor', 'middle')
        .attr('font-size', '10px')
        .attr('fill', '#475569')
        .text(d => d.employee?.name || '空闲');

      // 添加状态指示器
      deskGroups.filter((d: any) => d.employee)
        .append('circle')
        .attr('cx', (d: any) => d.w - 8)
        .attr('cy', 8)
        .attr('r', 4)
        .attr('fill', (d: any) => d.employee!.status === 'online' ? '#22c55e' : '#ef4444');
    }

    // 添加图例 - 调整到底部中央位置，避免与工位重叠
    const legendWidth = 200; // 图例总宽度
    const legendX = (minX + maxX) / 2 - legendWidth / 2; // 水平居中
    const legendY = maxY + 20; // 位于工位区域下方
    
    const legend = g.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${legendX}, ${legendY})`);

    const legendData = [
      { color: '#10b981', text: '在线', status: 'online' },
      { color: '#ef4444', text: '离线', status: 'offline' },
      { color: '#f1f5f9', text: '空闲', status: 'empty' }
    ];

    const legendItems = legend.selectAll('.legend-item')
      .data(legendData)
      .enter()
      .append('g')
      .attr('class', 'legend-item')
      .attr('transform', (d, i) => `translate(${i * 65}, 0)`); // 水平排列图例项

    legendItems.append('rect')
      .attr('width', 16)
      .attr('height', 16)
      .attr('fill', d => d.color)
      .attr('stroke', '#64748b')
      .attr('rx', 2);

    legendItems.append('text')
      .attr('x', 24)
      .attr('y', 12)
      .attr('font-size', '12px')
      .attr('fill', '#374151')
      .text(d => d.text);

    // 添加重置按钮事件监听
    const resetButton = container.querySelector('.reset-zoom');
    if (resetButton) {
      resetButton.addEventListener('click', resetZoom);
    }

    // 清理函数
    return () => {
      if (resetButton) {
        resetButton.removeEventListener('click', resetZoom);
      }
    };
  }, [department, mapData, desksWithEmployees, isHomepage]);

  return (
    <div className="relative w-full h-full bg-gray-50" ref={containerRef}>
      {isLoadingDesks && (
        <div className="absolute top-4 left-4 bg-blue-100 text-blue-800 px-3 py-1 rounded-md text-sm z-20">
          正在加载工位数据...
        </div>
      )}
      
      {/* 地图SVG */}
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ 
          minHeight: isHomepage ? '300px' : '500px',
          pointerEvents: 'auto',
          zIndex: 1
        }}
      />
      
      {/* 控制面板 - 仅在详情页显示 */}
      {!isHomepage && (
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4 min-w-48 z-30">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            {mapData.dept_name} 部门
          </h3>
          <div className="space-y-2 text-sm text-gray-600">
            <div>总工位: {desksWithEmployees.length}</div>
            <div>已占用: {desksWithEmployees.filter(d => d.employee).length}</div>
            <div>在线: {desksWithEmployees.filter(d => d.employee?.status === 'online').length}</div>
          </div>
          <button 
            className="reset-zoom mt-3 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors z-40 relative"
            style={{ pointerEvents: 'auto' }}
          >重置视图</button>
        </div>
      )}

      {/* 工位信息显示 */}
        {!isLoadingDesks && combinedDesks.length > 0 && (
          <div className="absolute top-4 right-4 bg-white rounded-lg shadow-md p-3 text-sm z-30">
            <div className="text-gray-600">
              工位总数: <span className="font-semibold text-blue-600">{combinedDesks.length}</span>
            </div>
            <div className="text-gray-600">
              API工位: <span className="font-semibold text-green-600">{apiDesks.length}</span>
            </div>
          </div>
        )}

      {/* 工位详情面板 */}
        {selectedDesk && (
          <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 min-w-64 z-40">
            <div className="flex justify-between items-start mb-3">
              <h4 className="text-lg font-semibold text-gray-800">
                工位 {selectedDesk.label}
              </h4>
              <button 
                onClick={() => setSelectedDesk(null)}
                className="text-gray-400 hover:text-gray-600 z-50 relative"
                style={{ pointerEvents: 'auto' }}
              >
                ✕
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">工位ID:</span>
                <span className="font-medium">{selectedDesk.desk_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">员工:</span>
                <span className="font-medium">
                  {selectedDesk.employee?.name || 
                   (apiDesks.find(desk => desk.id === selectedDesk.desk_id)?.assignedUser) || 
                   '无'}
                </span>
              </div>
              {selectedDesk.employee && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-600">员工ID:</span>
                    <span className="font-medium">{selectedDesk.employee.employee_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">部门:</span>
                    <span className="font-medium">{selectedDesk.employee.department}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">状态:</span>
                    <span className={`font-medium ${
                      selectedDesk.employee.status === 'online' 
                        ? 'text-green-600' 
                        : 'text-red-600'
                    }`}>
                      {selectedDesk.employee.status === 'online' ? '在线' : '离线'}
                    </span>
                  </div>
                </>
              )}
              {/* 显示API工位的分配用户信息 */}
              {!selectedDesk.employee && apiDesks.find(desk => desk.id === selectedDesk.desk_id)?.assignedUser && (
                <div className="flex justify-between">
                  <span className="text-gray-600">分配用户:</span>
                  <span className="font-medium text-blue-600">
                    {apiDesks.find(desk => desk.id === selectedDesk.desk_id)?.assignedUser}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">位置:</span>
                <span className="font-medium">
                  ({selectedDesk.x}, {selectedDesk.y})
                </span>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

export default DeptMap;