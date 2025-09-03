import React, { useEffect, useRef, useState } from 'react';
import { zoom, zoomIdentity, ZoomBehavior } from 'd3-zoom';
import { select } from 'd3-selection';

// 类型定义
interface Desk {
  desk_id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  employee: string;
  employee_id: number;
  status: 'online' | 'offline';
}

interface MapData {
  map_id: string;
  type: string;
  url: string;
  dept_name: string;
}

interface DeptMapProps {
  department: string;
}

// 模拟数据
const mockMapData: MapData = {
  map_id: 'eng_floor_2',
  type: 'svg',
  url: '/maps/engineering_floor2.svg',
  dept_name: 'Engineering'
};

const mockDesks: Desk[] = [
  {
    desk_id: 'ENG-001',
    x: 100,
    y: 100,
    w: 60,
    h: 40,
    label: 'E01',
    employee: '张三',
    employee_id: 1,
    status: 'online'
  },
  {
    desk_id: 'ENG-002',
    x: 200,
    y: 100,
    w: 60,
    h: 40,
    label: 'E02',
    employee: '李四',
    employee_id: 2,
    status: 'offline'
  },
  {
    desk_id: 'ENG-003',
    x: 300,
    y: 100,
    w: 60,
    h: 40,
    label: 'E03',
    employee: '王五',
    employee_id: 3,
    status: 'online'
  },
  {
    desk_id: 'ENG-004',
    x: 400,
    y: 100,
    w: 60,
    h: 40,
    label: 'E04',
    employee: '',
    employee_id: 0,
    status: 'offline'
  },
  {
    desk_id: 'ENG-005',
    x: 500,
    y: 100,
    w: 60,
    h: 40,
    label: 'E05',
    employee: '赵六',
    employee_id: 4,
    status: 'online'
  }
];

const DeptMap: React.FC<DeptMapProps> = ({ department }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedDesk, setSelectedDesk] = useState<Desk | null>(null);
  const [mapData] = useState<MapData>(mockMapData);
  const [desks] = useState<Desk[]>(mockDesks);

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

    // 创建缩放行为
    const zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on('zoom', (event) => {
        const { transform } = event;
        g.attr('transform', transform.toString());
      });

    // 应用缩放行为到SVG
    svg.call(zoomBehavior);

    // 创建主要的g元素用于缩放和平移
    const g = svg.append('g');

    // 绘制地图背景
    g.append('rect')
      .attr('width', 800)
      .attr('height', 600)
      .attr('fill', '#f8fafc')
      .attr('stroke', '#e2e8f0')
      .attr('stroke-width', 2)
      .attr('rx', 8);

    // 添加地图标题
    g.append('text')
      .attr('x', 400)
      .attr('y', 30)
      .attr('text-anchor', 'middle')
      .attr('font-size', '18px')
      .attr('font-weight', 'bold')
      .attr('fill', '#1e293b')
      .text(`${mapData.dept_name} 部门地图`);

    // 绘制工位
    const deskGroups = g.selectAll('.desk')
      .data(desks)
      .enter()
      .append('g')
      .attr('class', 'desk')
      .attr('transform', d => `translate(${d.x}, ${d.y})`)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        setSelectedDesk(d);
      });

    // 绘制工位矩形
    deskGroups.append('rect')
      .attr('width', d => d.w)
      .attr('height', d => d.h)
      .attr('fill', d => {
        if (!d.employee) return '#f1f5f9'; // 空工位
        return d.status === 'online' ? '#10b981' : '#ef4444'; // 在线/离线
      })
      .attr('stroke', '#64748b')
      .attr('stroke-width', 1)
      .attr('rx', 4);

    // 添加工位标签
    deskGroups.append('text')
      .attr('x', d => d.w / 2)
      .attr('y', d => d.h / 2 - 5)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .attr('fill', '#1e293b')
      .text(d => d.label);

    // 添加员工姓名
    deskGroups.append('text')
      .attr('x', d => d.w / 2)
      .attr('y', d => d.h / 2 + 8)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('fill', '#475569')
      .text(d => d.employee || '空闲');

    // 添加状态指示器
    deskGroups.filter(d => d.employee)
      .append('circle')
      .attr('cx', d => d.w - 8)
      .attr('cy', 8)
      .attr('r', 4)
      .attr('fill', d => d.status === 'online' ? '#22c55e' : '#ef4444');

    // 添加图例
    const legend = g.append('g')
      .attr('class', 'legend')
      .attr('transform', 'translate(650, 50)');

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
      .attr('transform', (d, i) => `translate(0, ${i * 25})`);

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

    // 重置缩放到初始状态
    const resetZoom = () => {
      svg.transition()
        .duration(750)
        .call(zoomBehavior.transform, zoomIdentity);
    };

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
  }, [department, mapData, desks]);

  return (
    <div className="relative w-full h-full bg-gray-50" ref={containerRef}>
      {/* 地图SVG */}
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ minHeight: '600px' }}
      />
      
      {/* 控制面板 */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4 min-w-48">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">
          {mapData.dept_name} 部门
        </h3>
        <div className="space-y-2 text-sm text-gray-600">
          <div>总工位: {desks.length}</div>
          <div>已占用: {desks.filter(d => d.employee).length}</div>
          <div>在线: {desks.filter(d => d.status === 'online').length}</div>
        </div>
        <button 
          className="reset-zoom mt-3 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
        >
          重置视图
        </button>
      </div>

      {/* 工位详情面板 */}
      {selectedDesk && (
        <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 min-w-64">
          <div className="flex justify-between items-start mb-3">
            <h4 className="text-lg font-semibold text-gray-800">
              工位 {selectedDesk.label}
            </h4>
            <button 
              onClick={() => setSelectedDesk(null)}
              className="text-gray-400 hover:text-gray-600"
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
                {selectedDesk.employee || '无'}
              </span>
            </div>
            {selectedDesk.employee && (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-600">员工ID:</span>
                  <span className="font-medium">{selectedDesk.employee_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">状态:</span>
                  <span className={`font-medium ${
                    selectedDesk.status === 'online' 
                      ? 'text-green-600' 
                      : 'text-red-600'
                  }`}>
                    {selectedDesk.status === 'online' ? '在线' : '离线'}
                  </span>
                </div>
              </>
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