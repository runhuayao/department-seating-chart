import React, { useRef, useEffect, useState } from 'react';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, ZoomBehavior } from 'd3-zoom';
import { mapCacheService } from '../services/mapCacheService';

interface BuildingOverviewProps {
  onDepartmentClick?: (department: string) => void;
  className?: string;
}

interface DepartmentInfo {
  id: string;
  name: string;
  displayName: string;
  color: string;
  workstationCount: number;
  occupiedCount: number;
}

const BuildingOverview: React.FC<BuildingOverviewProps> = ({ 
  onDepartmentClick, 
  className = "" 
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [departmentStats, setDepartmentStats] = useState<DepartmentInfo[]>([]);

  // 部门配置
  const departments: DepartmentInfo[] = [
    {
      id: 'engineering-dept',
      name: 'Engineering',
      displayName: '工程部',
      color: '#3b82f6',
      workstationCount: 12,
      occupiedCount: 8
    },
    {
      id: 'marketing-dept',
      name: 'Marketing',
      displayName: '市场部',
      color: '#10b981',
      workstationCount: 8,
      occupiedCount: 6
    },
    {
      id: 'sales-dept',
      name: 'Sales',
      displayName: '销售部',
      color: '#f59e0b',
      workstationCount: 6,
      occupiedCount: 4
    },
    {
      id: 'hr-dept',
      name: 'HR',
      displayName: '人事部',
      color: '#ef4444',
      workstationCount: 4,
      occupiedCount: 2
    }
  ];

  // 获取部门统计数据和预加载地图
  useEffect(() => {
    const fetchDepartmentStats = async () => {
      try {
        // 预加载常用地图
        mapCacheService.preloadCommonMaps();
        
        // 这里可以调用API获取实时数据
        setDepartmentStats(departments);
      } catch (error) {
        console.error('获取部门统计数据失败:', error);
        setDepartmentStats(departments);
      }
    };

    fetchDepartmentStats();
  }, []);

  // 初始化SVG和交互
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

    // 创建主要的g元素
    const g = svg.append('g');

    // 加载SVG地图（使用缓存服务）
    mapCacheService.getMapData('/maps/building-layout.svg', 'high')
      .then(mapData => {
        // 解析SVG内容
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(mapData.svgContent, 'image/svg+xml');
        const svgElement = svgDoc.documentElement;

        // 获取原始SVG的viewBox
        const originalWidth = mapData.metadata.width;
        const originalHeight = mapData.metadata.height;

        // 计算缩放比例以适应容器
        const scaleX = width / originalWidth;
        const scaleY = height / originalHeight;
        const scale = Math.min(scaleX, scaleY) * 0.9; // 留一些边距

        // 计算居中偏移
        const offsetX = (width - originalWidth * scale) / 2;
        const offsetY = (height - originalHeight * scale) / 2;

        // 应用变换
        g.attr('transform', `translate(${offsetX}, ${offsetY}) scale(${scale})`);

        // 将SVG内容添加到g元素
        g.node()!.innerHTML = svgElement.innerHTML;

        // 添加部门点击事件
        departments.forEach(dept => {
          const deptElement = g.select(`#${dept.id}`);
          if (!deptElement.empty()) {
            deptElement
              .style('cursor', 'pointer')
              .on('click', function(event) {
                event.stopPropagation();
                setSelectedDepartment(dept.name);
                onDepartmentClick?.(dept.name);
                
                // 添加点击动画效果
                select(this)
                  .transition()
                  .duration(200)
                  .attr('transform', 'scale(1.05)')
                  .transition()
                  .duration(200)
                  .attr('transform', 'scale(1)');
              })
              .on('mouseenter', function() {
                select(this)
                  .select('rect')
                  .transition()
                  .duration(150)
                  .attr('fill', dept.color)
                  .attr('opacity', 0.8);
              })
              .on('mouseleave', function() {
                if (selectedDepartment !== dept.name) {
                  select(this)
                    .select('rect')
                    .transition()
                    .duration(150)
                    .attr('fill', '#dbeafe')
                    .attr('opacity', 1);
                }
              });

            // 如果是选中的部门，高亮显示
            if (selectedDepartment === dept.name) {
              deptElement
                .select('rect')
                .attr('fill', dept.color)
                .attr('opacity', 0.8);
            }
          }
        });

        // 添加缩放功能
        const zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> = zoom<SVGSVGElement, unknown>()
          .scaleExtent([0.5, 3])
          .on('zoom', (event) => {
            g.attr('transform', `translate(${offsetX}, ${offsetY}) scale(${scale}) ${event.transform}`);
          });

        svg.call(zoomBehavior);

        // 添加重置按钮
        const resetButton = container.querySelector('.reset-zoom-btn') as HTMLButtonElement;
        if (resetButton) {
          resetButton.onclick = () => {
            svg.transition()
              .duration(750)
              .call(zoomBehavior.transform, zoomIdentity);
          };
        }
      })
      .catch(error => {
        console.error('加载建筑地图失败:', error);
        
        // 显示错误信息
        g.append('text')
          .attr('x', width / 2)
          .attr('y', height / 2)
          .attr('text-anchor', 'middle')
          .attr('font-size', '16px')
          .attr('fill', '#ef4444')
          .text('地图加载失败，请刷新页面重试');
      });

    // 清理函数
    return () => {
      svg.selectAll('*').remove();
    };
  }, [selectedDepartment, onDepartmentClick, departmentStats]);

  return (
    <div className={`relative w-full h-full ${className}`} ref={containerRef}>
      {/* SVG容器 */}
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ background: '#f8fafc' }}
      />
      
      {/* 控制面板 */}
      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-xs">
        <h3 className="text-lg font-semibold mb-3 text-gray-800">部门概览</h3>
        
        {/* 部门统计 */}
        <div className="space-y-2 mb-4">
          {departmentStats.map(dept => (
            <div 
              key={dept.name}
              className={`p-2 rounded-md cursor-pointer transition-colors ${
                selectedDepartment === dept.name 
                  ? 'bg-blue-100 border-2 border-blue-300' 
                  : 'bg-gray-50 hover:bg-gray-100'
              }`}
              onClick={() => {
                setSelectedDepartment(dept.name);
                onDepartmentClick?.(dept.name);
              }}
            >
              <div className="flex justify-between items-center">
                <span className="font-medium text-sm">{dept.displayName}</span>
                <div className="flex items-center space-x-1">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: dept.color }}
                  />
                  <span className="text-xs text-gray-600">
                    {dept.occupiedCount}/{dept.workstationCount}
                  </span>
                </div>
              </div>
              <div className="mt-1">
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div 
                    className="h-1.5 rounded-full transition-all duration-300"
                    style={{ 
                      backgroundColor: dept.color,
                      width: `${(dept.occupiedCount / dept.workstationCount) * 100}%`
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 控制按钮 */}
        <div className="space-y-2">
          <button
            className="reset-zoom-btn w-full px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium transition-colors"
          >
            重置视图
          </button>
          
          {selectedDepartment && (
            <button
              onClick={() => {
                setSelectedDepartment(null);
                onDepartmentClick?.('');
              }}
              className="w-full px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md text-sm font-medium transition-colors"
            >
              清除选择
            </button>
          )}
        </div>
      </div>

      {/* 加载指示器 */}
      {departmentStats.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <p className="text-gray-600">正在加载建筑地图...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default BuildingOverview;