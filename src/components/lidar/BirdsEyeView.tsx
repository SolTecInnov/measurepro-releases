/**
 * Bird's Eye View Component
 * Shows 2D top-down view of detected road boundaries
 */

import type { RoadBoundary, LidarMetrics } from '@/lib/lidar/types';

interface BirdsEyeViewProps {
  boundary: RoadBoundary | null;
  metrics: LidarMetrics | null;
  width?: number;
  height?: number;
}

export function BirdsEyeView({ boundary, metrics, width = 400, height = 300 }: BirdsEyeViewProps) {
  const padding = { top: 30, right: 20, bottom: 30, left: 20 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const xRange = 20;
  const yRange = 100;

  const toX = (x: number) => padding.left + ((x + xRange / 2) / xRange) * chartWidth;
  const toY = (y: number) => padding.top + chartHeight - (y / yRange) * chartHeight;

  const mockBoundary = boundary || generateMockBoundary();
  const roadWidth = metrics?.roadWidthNow || 7.5;

  function generateMockBoundary(): RoadBoundary {
    const left: { x: number; y: number }[] = [];
    const right: { x: number; y: number }[] = [];
    const centerline: { x: number; y: number }[] = [];

    for (let y = 0; y <= 100; y += 5) {
      const curveFactor = Math.sin(y * 0.03) * 2;
      const baseWidth = 3.75 + Math.random() * 0.2;
      
      left.push({ x: curveFactor - baseWidth, y });
      right.push({ x: curveFactor + baseWidth, y });
      centerline.push({ x: curveFactor, y });
    }
    return { left, right, centerline };
  }

  const leftPath = mockBoundary.left
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.x)} ${toY(p.y)}`)
    .join(' ');
  const rightPath = mockBoundary.right
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.x)} ${toY(p.y)}`)
    .join(' ');
  const centerPath = mockBoundary.centerline
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.x)} ${toY(p.y)}`)
    .join(' ');

  const roadFillPath = `
    ${mockBoundary.left.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.x)} ${toY(p.y)}`).join(' ')}
    ${mockBoundary.right.slice().reverse().map((p) => `L ${toX(p.x)} ${toY(p.y)}`).join(' ')}
    Z
  `;

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 p-2">
      <svg width={width} height={height} className="font-mono">
        <defs>
          <linearGradient id="roadGradient" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#1e3a5f" stopOpacity={0.8} />
            <stop offset="100%" stopColor="#0f172a" stopOpacity={0.6} />
          </linearGradient>
          <pattern id="roadMarking" patternUnits="userSpaceOnUse" width="4" height="20">
            <rect width="2" height="10" fill="#facc15" />
          </pattern>
        </defs>

        <rect
          x={padding.left}
          y={padding.top}
          width={chartWidth}
          height={chartHeight}
          fill="#0d1117"
        />

        <path d={roadFillPath} fill="url(#roadGradient)" />

        <path d={leftPath} fill="none" stroke="#22c55e" strokeWidth={3} />
        <path d={rightPath} fill="none" stroke="#22c55e" strokeWidth={3} />

        <path
          d={centerPath}
          fill="none"
          stroke="#facc15"
          strokeWidth={2}
          strokeDasharray="10,10"
        />

        <g transform={`translate(${toX(0)}, ${toY(0)})`}>
          <polygon
            points="0,-15 -8,5 -3,5 -3,15 3,15 3,5 8,5"
            fill="#3b82f6"
            stroke="#60a5fa"
            strokeWidth={1}
          />
          <circle r={4} fill="#60a5fa" />
        </g>

        {[0, 25, 50, 75, 100].map((y) => (
          <text
            key={y}
            x={width - 15}
            y={toY(y)}
            textAnchor="end"
            fill="#666"
            fontSize={9}
          >
            {y}m
          </text>
        ))}

        <text x={width / 2} y={20} textAnchor="middle" fill="#fff" fontSize={12} fontWeight="bold">
          Road Boundary Detection
        </text>

        <rect x={padding.left + 5} y={padding.top + 5} width={90} height={50} fill="#000" fillOpacity={0.7} rx={4} />
        <text x={padding.left + 10} y={padding.top + 20} fill="#888" fontSize={10}>Road Width</text>
        <text x={padding.left + 10} y={padding.top + 35} fill="#22c55e" fontSize={14} fontWeight="bold">
          {roadWidth.toFixed(1)}m
        </text>
        <text x={padding.left + 10} y={padding.top + 48} fill="#666" fontSize={9}>current</text>
      </svg>

      <div className="flex justify-center gap-4 mt-2 text-xs">
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-green-500" />
          Road Edge
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-yellow-400" style={{ borderStyle: 'dashed' }} />
          Centerline
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-blue-500 rounded-sm" />
          Vehicle
        </span>
      </div>
    </div>
  );
}
