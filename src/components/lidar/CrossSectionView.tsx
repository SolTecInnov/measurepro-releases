/**
 * Cross-Section View Component
 * Shows road profile with clearance heights using SVG
 */

import type { CrossSectionData, LidarMetrics } from '@/lib/lidar/types';

interface CrossSectionViewProps {
  data: CrossSectionData | null;
  metrics: LidarMetrics | null;
  width?: number;
  height?: number;
}

export function CrossSectionView({ data, metrics, width = 400, height = 250 }: CrossSectionViewProps) {
  const padding = { top: 30, right: 20, bottom: 40, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const yRange = 15;
  const zRange = 8;

  const toX = (y: number) => padding.left + ((y + yRange / 2) / yRange) * chartWidth;
  const toY = (z: number) => padding.top + chartHeight - (z / zRange) * chartHeight;

  const mockPoints = data?.points || generateMockCrossSection();
  const roadWidth = metrics?.roadWidthNow || 7.5;
  const usableWidths = metrics?.usableWidthAtHeights || [
    { heightM: 3.5, widthM: 6.8 },
    { heightM: 4.5, widthM: 6.2 },
    { heightM: 5.5, widthM: 5.5 },
  ];

  function generateMockCrossSection() {
    const points: { y: number; z: number }[] = [];
    for (let y = -7; y <= 7; y += 0.5) {
      let z = 0;
      if (Math.abs(y) <= 3.5) {
        z = -0.02 * y * y;
      } else if (Math.abs(y) <= 5) {
        z = 0.3 + Math.random() * 0.2;
      } else {
        z = 1 + Math.random() * 2 + Math.abs(y - 5) * 0.5;
      }
      points.push({ y, z });
    }
    return points;
  }

  const pathD = mockPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.y)} ${toY(p.z)}`)
    .join(' ');

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 p-2">
      <svg width={width} height={height} className="font-mono">
        <defs>
          <linearGradient id="groundGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#4a3728" />
            <stop offset="100%" stopColor="#2d1f14" />
          </linearGradient>
        </defs>

        <rect
          x={padding.left}
          y={toY(0)}
          width={chartWidth}
          height={chartHeight - toY(0) + padding.top}
          fill="url(#groundGradient)"
          opacity={0.5}
        />

        {[0, 2, 4, 6, 8].map((z) => (
          <g key={z}>
            <line
              x1={padding.left}
              y1={toY(z)}
              x2={width - padding.right}
              y2={toY(z)}
              stroke="#333"
              strokeDasharray="2,4"
            />
            <text x={padding.left - 5} y={toY(z) + 4} textAnchor="end" fill="#666" fontSize={10}>
              {z}m
            </text>
          </g>
        ))}

        {usableWidths.map((uw, i) => {
          const halfWidth = uw.widthM / 2;
          return (
            <g key={i}>
              <line
                x1={toX(-halfWidth)}
                y1={toY(uw.heightM)}
                x2={toX(halfWidth)}
                y2={toY(uw.heightM)}
                stroke="#f97316"
                strokeWidth={2}
                strokeDasharray="4,2"
              />
              <rect
                x={toX(halfWidth) + 5}
                y={toY(uw.heightM) - 8}
                width={60}
                height={16}
                fill="#1a1a2e"
                rx={3}
              />
              <text
                x={toX(halfWidth) + 8}
                y={toY(uw.heightM) + 4}
                fill="#f97316"
                fontSize={10}
              >
                {uw.widthM.toFixed(1)}m @ {uw.heightM}m
              </text>
            </g>
          );
        })}

        <line
          x1={toX(-roadWidth / 2)}
          y1={toY(0)}
          x2={toX(-roadWidth / 2)}
          y2={toY(6)}
          stroke="#22c55e"
          strokeWidth={2}
        />
        <line
          x1={toX(roadWidth / 2)}
          y1={toY(0)}
          x2={toX(roadWidth / 2)}
          y2={toY(6)}
          stroke="#22c55e"
          strokeWidth={2}
        />

        <path d={pathD} fill="none" stroke="#60a5fa" strokeWidth={2} />

        {mockPoints.map((p, i) => (
          <circle
            key={i}
            cx={toX(p.y)}
            cy={toY(p.z)}
            r={2}
            fill={p.z > 4 ? '#ef4444' : p.z > 2 ? '#f97316' : '#22c55e'}
          />
        ))}

        <text x={width / 2} y={height - 10} textAnchor="middle" fill="#888" fontSize={11}>
          Lateral Position (m)
        </text>
        <text
          x={15}
          y={height / 2}
          textAnchor="middle"
          fill="#888"
          fontSize={11}
          transform={`rotate(-90, 15, ${height / 2})`}
        >
          Height (m)
        </text>

        <text x={width / 2} y={20} textAnchor="middle" fill="#fff" fontSize={12} fontWeight="bold">
          Road Cross-Section
        </text>
      </svg>

      <div className="flex justify-center gap-4 mt-2 text-xs">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-green-500 rounded-full" />
          Road Edge
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-orange-500 rounded-full" />
          Clearance Width
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-blue-400 rounded-full" />
          Profile
        </span>
      </div>
    </div>
  );
}
