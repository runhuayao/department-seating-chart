import React, { useState, useEffect } from 'react';
import { Search, Users, MapPin, Clock, Wifi } from 'lucide-react';
import templateMappingService from '../services/templateMappingService';
import '../styles/vacant-select-theme.css';

interface TeamData {
  id: string;
  name: string;
  color: string;
  occupiedSeats: number;
  totalSeats: number;
}

interface SeatStatus {
  vacant: number;
  occupied: number;
  total: number;
  lastUpdated: string;
}

interface VacantSelectTemplateProps {
  department: string;
  floorName?: string;
  onSeatSearch?: (seatNumber: string) => void;
  onTeamSelect?: (teamId: string) => void;
}

// 基于VACANT-SELECT模板的座位图组件
const VacantSelectTemplate: React.FC<VacantSelectTemplateProps> = ({
  department,
  floorName = "4階 - テクノプロジェクト",
  onSeatSearch,
  onTeamSelect
}) => {
  const [seatStatus, setSeatStatus] = useState<SeatStatus>({
    vacant: 98,
    occupied: 2,
    total: 100,
    lastUpdated: new Date().toLocaleString()
  });

  const [teams, setTeams] = useState<TeamData[]>([
    { id: 'team-a', name: 'Team A', color: '#FE4242', occupiedSeats: 1, totalSeats: 20 },
    { id: 'team-b', name: 'Team B', color: '#FFFF00', occupiedSeats: 0, totalSeats: 15 },
    { id: 'team-c', name: 'Team C', color: '#4DC900', occupiedSeats: 0, totalSeats: 18 },
    { id: 'team-d', name: 'Team D', color: '#008CFF', occupiedSeats: 1, totalSeats: 22 },
    { id: 'team-e', name: 'Team E', color: '#EE84F3', occupiedSeats: 0, totalSeats: 25 },
    { id: 'team-f', name: 'Team F', color: '#FFCC00', occupiedSeats: 0, totalSeats: 20 }
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);

  // 加载部门座位数据
  useEffect(() => {
    loadDepartmentSeatingData();
  }, [department]);

  const loadDepartmentSeatingData = async () => {
    try {
      // 获取部门映射配置
      const mapping = templateMappingService.getDepartmentMapping(department);
      if (mapping) {
        // 使用映射配置更新团队数据
        setTeams(mapping.teams.map(team => ({
          id: team.id,
          name: team.name,
          color: team.color,
          occupiedSeats: 0, // 将从API数据计算
          totalSeats: team.maxSeats
        })));
      }

      // 尝试从API加载实际工位数据
      const response = await fetch(`/api/workstations?department=${department}`);
      if (response.ok) {
        const text = await response.text();
        if (text.trim()) {
          const workstations = JSON.parse(text);
          updateSeatingDataFromAPI(workstations, mapping);
        } else {
          console.warn('API返回空数据，使用默认配置');
        }
      } else {
        console.warn('API响应错误，使用默认配置');
      }
    } catch (error) {
      console.warn('加载座位数据失败，使用默认数据:', error.message);
    }
  };

  const updateSeatingDataFromAPI = (workstations: any[], mapping: any) => {
    if (!mapping) return;

    // 使用模板映射服务处理数据
    const templateData = templateMappingService.mapWorkstationsToTemplate(workstations, department);
    
    // 更新座位状态
    setSeatStatus(templateData.seatStatus);
    
    // 更新团队数据
    setTeams(templateData.teams);

    console.log(`📊 座位数据更新完成 - 部门: ${department}, 工位: ${workstations.length}`);
  };

  const handleSeatSearch = () => {
    if (searchQuery.trim()) {
      onSeatSearch?.(searchQuery);
      console.log(`🔍 搜索座位: ${searchQuery}`);
    }
  };

  const handleTeamClick = (team: TeamData) => {
    onTeamSelect?.(team.id);
    console.log(`👥 选择团队: ${team.name}`);
  };

  return (
    <div className="vacant-select-template bg-[#EFEEEE] w-full h-full min-h-[832px] flex flex-col">
      {/* 顶部导航栏 - 基于VACANT-SELECT设计 */}
      <div className="bg-[#002E3F] px-8 py-5 flex items-center justify-between min-h-[88px]">
        <h1 className="text-white text-4xl font-semibold">
          Online Seating Chart
        </h1>
        <div className="bg-white/95 rounded-lg px-4 py-3 flex items-center justify-between min-w-[449px]">
          <span className="text-[#002E3F] text-2xl font-semibold">
            {floorName}
          </span>
          <div className="w-5 h-3 bg-gray-400"></div>
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="flex-1 flex items-start justify-between px-0 py-6">
        {/* 左侧 - 座位图区域 */}
        <div className="flex-1 flex justify-center">
          <div 
            className="relative border-4 border-[#002E3F] bg-cover bg-no-repeat rounded-lg"
            style={{
              width: '815px',
              height: '500px',
              backgroundImage: 'url(/maps/department-layout.png)',
              backgroundPosition: 'center',
              backgroundSize: 'cover'
            }}
          >
            {/* 座位状态指示器 */}
            <div className="absolute top-16 left-16">
              <div className="w-6 h-6 bg-[#FE4242] border border-black rounded"></div>
            </div>
            <div className="absolute bottom-16 right-16">
              <div className="w-6 h-6 bg-[#008CFF] border border-black rounded"></div>
            </div>
            
            {/* 座位图占位 - 实际实现中这里会渲染具体的座位 */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-black/20 text-white px-4 py-2 rounded">
                {department} 座位图
              </div>
            </div>
          </div>
        </div>

        {/* 右侧 - 状态面板 */}
        <div className="w-80 mr-16">
          <div className="bg-white rounded-xl shadow-lg p-6">
            {/* 状态标题 */}
            <h2 className="text-[#002E3F] text-2xl font-semibold mb-6">Status</h2>

            {/* 空闲座位统计 */}
            <div className="flex items-center justify-between mb-4">
              <div className="bg-[#EDEDED] rounded-md px-3 py-2 flex-1 mr-3">
                <span className="text-[#002E3F]/60 text-lg font-light">Vacant Seats</span>
              </div>
              <div className="bg-[#EDEDED] rounded-md px-6 py-2 min-w-[78px] text-center">
                <span className="text-[#002E3F]/60 text-lg font-light">{seatStatus.vacant}</span>
              </div>
            </div>

            {/* 占用座位统计 */}
            <div className="flex items-center justify-between mb-4">
              <div className="bg-[#EDEDED] rounded-md px-3 py-2 flex-1 mr-3">
                <span className="text-[#002E3F]/60 text-lg font-light">Occupied Seats</span>
              </div>
              <div className="bg-[#EDEDED] rounded-md px-6 py-2 min-w-[78px] text-center">
                <span className="text-[#002E3F]/60 text-lg font-light">{seatStatus.occupied}</span>
              </div>
            </div>

            {/* 团队数量统计 */}
            <div className="flex items-center justify-between mb-6">
              <div className="bg-[#EDEDED] rounded-md px-3 py-2 flex-1 mr-3">
                <span className="text-[#002E3F]/60 text-lg font-light">Teams</span>
              </div>
              <div className="bg-[#EDEDED] rounded-md px-6 py-2 min-w-[78px] text-center">
                <span className="text-[#002E3F]/60 text-lg font-light">{teams.length}</span>
              </div>
            </div>

            {/* 最后更新时间 */}
            <p className="text-black text-lg mb-12">
              <Clock size={16} className="inline mr-2" />
              Last updated {seatStatus.lastUpdated}
            </p>

            {/* 座位搜索功能 */}
            <div className="space-y-4">
              <h3 className="text-[#002E3F] text-2xl font-semibold">Search by seat</h3>
              
              <div className="bg-[#EDEDED] rounded-md px-3 py-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter seat number"
                  className="w-full bg-transparent text-[#002E3F]/60 text-lg font-light outline-none"
                />
              </div>
              
              <button
                onClick={handleSeatSearch}
                className="w-full bg-[#002E3F] text-white text-lg font-medium py-2 rounded-md hover:bg-[#002E3F]/90 transition-colors"
              >
                <Search size={16} className="inline mr-2" />
                Search
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 底部 - 团队列表 */}
      <div className="relative px-8 pb-8">
        <div className="bg-white rounded-t-xl shadow-lg p-6 min-h-[176px]">
          <h3 className="text-black text-2xl font-medium mb-4">Teams</h3>
          
          <div className="grid grid-cols-6 gap-4">
            {teams.map((team, index) => (
              <div key={team.id} className="flex flex-col space-y-4">
                {/* 团队颜色指示器 */}
                <div className="bg-[#EFEEEE] rounded-lg p-2">
                  <div 
                    className="w-5 h-5 rounded-lg border border-black"
                    style={{ backgroundColor: team.color }}
                  ></div>
                </div>
                
                {/* 团队名称和统计 */}
                <div className="flex items-center justify-between">
                  <span className="text-black text-lg">{team.name}</span>
                  <div className="bg-white rounded-lg px-2 py-1 flex items-center space-x-2 shadow-sm">
                    <span className="text-black text-sm">{team.occupiedSeats}</span>
                    <Wifi size={12} className="text-gray-600" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 成功提示横幅 */}
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
          <div className="bg-[#002E3F]/50 text-white px-8 py-2 rounded-xl">
            <span className="text-lg">New member has been added successfully!</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VacantSelectTemplate;