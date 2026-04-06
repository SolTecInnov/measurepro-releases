/**
 * Detection Zone Visualization Component
 * Renders 2D birds-eye view of detection zones around the vehicle
 */

import { useDryRunStore } from '@/lib/dryRun';
import type { DetectionZone, BoundingBox3D } from '@/lib/dryRun/types';
import { AlertTriangle } from 'lucide-react';

interface DetectionZoneVisualProps {
  width?: number;
  height?: number;
  scale?: number;  // meters per pixel
}

const DetectionZoneVisual = ({
  width = 400,
  height = 300,
  scale = 0.5,
}: DetectionZoneVisualProps) => {
  const config = useDryRunStore(state => state.config);
  const detectionStates = useDryRunStore(state => state.detectionStates);

  const centerX = width / 2;
  const centerY = height * 0.7;  // Vehicle near bottom

  const toScreenCoords = (x: number, y: number): { sx: number; sy: number } => ({
    sx: centerX + (y / scale),  // Y is lateral (left/right)
    sy: centerY - (x / scale),  // X is longitudinal (forward/back)
  });

  const boxToPath = (box: BoundingBox3D): string => {
    const { sx: x1, sy: y1 } = toScreenCoords(box.xMin, box.yMin);
    const { sx: x2, sy: y2 } = toScreenCoords(box.xMax, box.yMin);
    const { sx: x3, sy: y3 } = toScreenCoords(box.xMax, box.yMax);
    const { sx: x4, sy: y4 } = toScreenCoords(box.xMin, box.yMax);
    return `M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3} L ${x4} ${y4} Z`;
  };

  const getZoneColor = (zone: DetectionZone): string => {
    const state = detectionStates.get(zone.id);
    if (state?.isTriggered) {
      return zone.side === 'rear' ? '#ef4444' : zone.side === 'left' ? '#f59e0b' : '#3b82f6';
    }
    switch (zone.side) {
      case 'left': return '#fbbf24';
      case 'right': return '#60a5fa';
      case 'rear': return '#f87171';
      default: return '#9ca3af';
    }
  };

  const getZoneOpacity = (zone: DetectionZone): number => {
    const state = detectionStates.get(zone.id);
    return state?.isTriggered ? 0.6 : 0.3;
  };

  const vehicleWidth = 2.5 / scale;
  const vehicleLength = 20 / scale;

  return (
    <div className="relative rounded-lg border border-gray-700 bg-gray-900/50 overflow-hidden">
      <svg width={width} height={height} className="block">
        <defs>
          <pattern id="grid" width={10 / scale} height={10 / scale} patternUnits="userSpaceOnUse">
            <path d={`M ${10/scale} 0 L 0 0 0 ${10/scale}`} fill="none" stroke="#374151" strokeWidth="0.5"/>
          </pattern>
        </defs>
        
        <rect width={width} height={height} fill="url(#grid)" />
        
        <g>
          {config.zones.filter(z => z.enabled).map(zone => (
            <g key={zone.id}>
              <path
                d={boxToPath(zone.box)}
                fill={getZoneColor(zone)}
                fillOpacity={getZoneOpacity(zone)}
                stroke={getZoneColor(zone)}
                strokeWidth={2}
                strokeDasharray={detectionStates.get(zone.id)?.isTriggered ? "0" : "5,5"}
              />
              {detectionStates.get(zone.id)?.isTriggered && (
                <g transform={`translate(${toScreenCoords((zone.box.xMin + zone.box.xMax) / 2, (zone.box.yMin + zone.box.yMax) / 2).sx}, ${toScreenCoords((zone.box.xMin + zone.box.xMax) / 2, (zone.box.yMin + zone.box.yMax) / 2).sy})`}>
                  <AlertTriangle className="w-6 h-6 text-red-500 animate-pulse" style={{ transform: 'translate(-12px, -12px)' }} />
                </g>
              )}
            </g>
          ))}
        </g>
        
        <g transform={`translate(${centerX}, ${centerY})`}>
          <rect
            x={-vehicleWidth / 2}
            y={-vehicleLength * 0.3}
            width={vehicleWidth}
            height={vehicleLength}
            fill="#1f2937"
            stroke="#4b5563"
            strokeWidth={2}
            rx={2}
          />
          <circle cx={0} cy={-vehicleLength * 0.15} r={3} fill="#10b981" />
          <line x1={0} y1={-vehicleLength * 0.3} x2={0} y2={-vehicleLength * 0.3 - 10} stroke="#10b981" strokeWidth={2} />
        </g>
        
        <g fill="#9ca3af" fontSize={10}>
          <text x={centerX} y={15} textAnchor="middle">FRONT</text>
          <text x={centerX} y={height - 5} textAnchor="middle">REAR</text>
          <text x={10} y={height / 2} textAnchor="start">LEFT</text>
          <text x={width - 10} y={height / 2} textAnchor="end">RIGHT</text>
        </g>
        
        <g fill="#6b7280" fontSize={9}>
          {[10, 20, 40, 80].map(dist => {
            const { sy } = toScreenCoords(-dist, 0);
            if (sy > 0 && sy < height) {
              return (
                <text key={dist} x={5} y={sy} alignmentBaseline="middle">
                  {dist}m
                </text>
              );
            }
            return null;
          })}
        </g>
      </svg>
      
      {!config.enabled && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <span className="text-gray-400 text-sm">Dry Run Detection Disabled</span>
        </div>
      )}
    </div>
  );
};

export default DetectionZoneVisual;
