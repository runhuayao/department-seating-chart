import React from 'react';
import DeptMap from '../components/DeptMap';

const MapTest: React.FC = () => {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">地图组件测试</h1>
      
      {/* 测试Engineering部门地图 */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Engineering部门 - 详情模式</h2>
        <div className="border border-gray-300 rounded-lg" style={{ height: '400px' }}>
          <DeptMap 
            department="Engineering" 
            searchQuery="" 
            isHomepage={false}
          />
        </div>
      </div>
      
      {/* 测试首页模式 */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Engineering部门 - 首页模式</h2>
        <div className="border border-gray-300 rounded-lg" style={{ height: '300px' }}>
          <DeptMap 
            department="Engineering" 
            searchQuery="" 
            isHomepage={true}
          />
        </div>
      </div>
      
      {/* 测试Marketing部门 */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Marketing部门 - 详情模式</h2>
        <div className="border border-gray-300 rounded-lg" style={{ height: '400px' }}>
          <DeptMap 
            department="Marketing" 
            searchQuery="" 
            isHomepage={false}
          />
        </div>
      </div>
    </div>
  );
};

export default MapTest;