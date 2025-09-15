import React from 'react';

interface CategorySunburstProps {
  height?: string;
}

const CategorySunburst: React.FC<CategorySunburstProps> = ({ height = '400px' }) => {
  return (
    <div className="w-full flex items-center justify-center" style={{ height }}>
      <div>Category Sunburst Chart - Coming Soon</div>
    </div>
  );
};

export default CategorySunburst;
