import React, { useRef, useEffect } from 'react';

interface ColumnResizerProps {
  leftWidth: number;
  setLeftColumnWidth: (width: number) => void;
}

const ColumnResizer: React.FC<ColumnResizerProps> = ({
  leftWidth,
  setLeftColumnWidth
}) => {
  const isDragging = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.current) return;
    
    e.preventDefault();
    
    // Get the container element to calculate relative position
    const container = document.querySelector('.flex.gap-6');
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width - 24; // Account for gap
    const mouseX = e.clientX - containerRect.left;
    let newWidth = Math.max(25, Math.min(75, (mouseX / containerWidth) * 100));
    
    setLeftColumnWidth(newWidth);
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

  return (
    <div 
      className="flex-shrink-0 cursor-col-resize hover:bg-blue-500/20 transition-colors"
      onMouseDown={handleMouseDown}
      style={{ 
        width: '6px',
        minHeight: '100px'
      }}
    >
      <div className="w-full h-full bg-gray-600 hover:bg-blue-500 transition-colors rounded-full" />
    </div>
  );
};

export default ColumnResizer;