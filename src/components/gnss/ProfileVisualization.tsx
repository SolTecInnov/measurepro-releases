/**
 * Profile Visualization Component
 * 2D Canvas rendering of road profile with grade and K-factor overlays
 */

import { useRef, useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Download, ZoomIn, ZoomOut, Maximize2, TrendingUp, 
  TriangleAlert, Triangle, ChevronDown, ChevronUp
} from 'lucide-react';
import type { RoadProfile, ProfilePoint } from '../../../server/gnss/types';

type ViewMode = 'full' | 'last1km' | 'last5km' | 'last10km';

interface LiveTelemetry {
  lat: number;
  lon: number;
  altitude: number;
  heading: number;
  roll?: number;
  pitch?: number;
  yaw?: number;
  speed?: number;
  hdop?: number;
  numSats?: number;
  fixQuality?: string;
}

interface ProfileVisualizationProps {
  profile: RoadProfile | null;
  highlightedPoint?: number;
  onPointClick?: (point: ProfilePoint) => void;
  showLiveOverlay?: boolean;
  liveAltitude?: number | null;
  liveDistance?: number | null;
  liveTelemetry?: LiveTelemetry | null;
}

export function ProfileVisualization({ 
  profile, 
  highlightedPoint, 
  onPointClick,
  showLiveOverlay = false,
  liveAltitude = null,
  liveDistance = null,
  liveTelemetry = null
}: ProfileVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoveredPoint, setHoveredPoint] = useState<ProfilePoint | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [showConvexKFactor, setShowConvexKFactor] = useState(true);
  const [showConcaveKFactor, setShowConcaveKFactor] = useState(true);
  const [showGradeOverlay, setShowGradeOverlay] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('full');
  const [showTelemetryPanel, setShowTelemetryPanel] = useState(true);

  // Canvas dimensions
  const CANVAS_WIDTH = 1200;
  const CANVAS_HEIGHT = 400;
  const PADDING = { top: 40, right: 60, bottom: 60, left: 80 };

  // Centralized filtering and bounds calculation - shared by rendering and mouse handlers
  const filteredData = useMemo(() => {
    if (!profile?.points || profile.points.length === 0) {
      return { points: [], minDistance: 0, maxDistance: 0, minElevation: 0, maxElevation: 0 };
    }
    
    const allPoints = profile.points;
    const totalMaxDistance = Math.max(...allPoints.map(p => p.distance_m));
    
    let points = allPoints;
    if (viewMode !== 'full' && allPoints.length > 0) {
      let distanceThreshold = 0;
      switch (viewMode) {
        case 'last1km':
          distanceThreshold = totalMaxDistance - 1000;
          break;
        case 'last5km':
          distanceThreshold = totalMaxDistance - 5000;
          break;
        case 'last10km':
          distanceThreshold = totalMaxDistance - 10000;
          break;
      }
      // Filter to only show points after the threshold
      points = allPoints.filter(p => p.distance_m >= distanceThreshold);
      // Ensure we have at least some points
      if (points.length < 2) {
        points = allPoints;
      }
    }
    
    const minDistance = points.length > 0 ? Math.min(...points.map(p => p.distance_m)) : 0;
    const maxDistance = points.length > 0 ? Math.max(...points.map(p => p.distance_m)) : 0;
    const minElevation = points.length > 0 ? Math.min(...points.map(p => p.altitude)) : 0;
    const maxElevation = points.length > 0 ? Math.max(...points.map(p => p.altitude)) : 0;
    
    return { points, minDistance, maxDistance, minElevation, maxElevation };
  }, [profile, viewMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || filteredData.points.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Fill background
    ctx.fillStyle = '#1f2937'; // gray-800
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const { points, minDistance, maxDistance } = filteredData;
    const minElevation = Math.min(...points.map(p => p.altitude));
    const maxElevation = Math.max(...points.map(p => p.altitude));
    
    const elevationRange = maxElevation - minElevation;
    const distanceRange = maxDistance - minDistance;
    
    // Guard against degenerate datasets where range is 0
    if (distanceRange === 0 || elevationRange === 0) {
      ctx.fillStyle = '#9ca3af';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Insufficient data to display profile', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      return;
    }
    const elevationPadding = elevationRange * 0.1;

    // Scale functions with zoom and pan
    const plotWidth = CANVAS_WIDTH - PADDING.left - PADDING.right;
    const plotHeight = CANVAS_HEIGHT - PADDING.top - PADDING.bottom;

    const scaleX = (distance: number) => {
      return PADDING.left + ((distance - minDistance) / (maxDistance - minDistance)) * plotWidth * zoom + pan.x;
    };

    const scaleY = (elevation: number) => {
      return CANVAS_HEIGHT - PADDING.bottom - ((elevation - (minElevation - elevationPadding)) / (elevationRange + 2 * elevationPadding)) * plotHeight * zoom - pan.y;
    };

    // Draw grid
    ctx.strokeStyle = '#374151'; // gray-700
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    
    // Adaptive grid spacing based on distance range
    const getGridSpacing = (maxDist: number): { spacing: number; useKm: boolean } => {
      if (maxDist <= 500) return { spacing: 50, useKm: false };
      if (maxDist <= 1000) return { spacing: 100, useKm: false };
      if (maxDist <= 5000) return { spacing: 500, useKm: false };
      if (maxDist <= 20000) return { spacing: 1000, useKm: true };
      if (maxDist <= 100000) return { spacing: 5000, useKm: true };
      return { spacing: 10000, useKm: true };
    };
    
    const { spacing: gridSpacing, useKm } = getGridSpacing(distanceRange);

    // Vertical grid lines (adaptive spacing)
    // Start from first grid line at or after minDistance
    const startGridD = Math.ceil(minDistance / gridSpacing) * gridSpacing;
    for (let d = startGridD; d <= maxDistance; d += gridSpacing) {
      const x = scaleX(d);
      if (x >= PADDING.left && x <= CANVAS_WIDTH - PADDING.right) {
        ctx.beginPath();
        ctx.moveTo(x, PADDING.top);
        ctx.lineTo(x, CANVAS_HEIGHT - PADDING.bottom);
        ctx.stroke();
      }
    }

    // Horizontal grid lines (every 10m elevation)
    const elevStep = 10;
    for (let e = Math.floor(minElevation / elevStep) * elevStep; e <= Math.ceil(maxElevation / elevStep) * elevStep; e += elevStep) {
      const y = scaleY(e);
      if (y >= PADDING.top && y <= CANVAS_HEIGHT - PADDING.bottom) {
        ctx.beginPath();
        ctx.moveTo(PADDING.left, y);
        ctx.lineTo(CANVAS_WIDTH - PADDING.right, y);
        ctx.stroke();
      }
    }

    ctx.setLineDash([]);

    // Helper function: Get grade-based color
    // Grade color scheme: 0-8% green, 8-10% blue, 10-12% amber, 12-14% red, 14-16% purple, >16% black
    const getGradeColor = (gradeAbs: number): string => {
      if (gradeAbs > 16) return '#111827'; // gray-900 / black (>16%)
      if (gradeAbs > 14) return '#a855f7'; // purple-500 (14-16%)
      if (gradeAbs > 12) return '#ef4444'; // red-500 (12-14%)
      if (gradeAbs > 10) return '#f59e0b'; // amber-500 (10-12%)
      if (gradeAbs > 8) return '#3b82f6';  // blue-500 (8-10%)
      return '#10b981'; // green-500 (0-8%)
    };

    // Draw elevation profile line with grade-based colors for each segment
    ctx.lineWidth = 2;
    
    points.forEach((point, i) => {
      if (i === 0) return;
      
      const prevPoint = points[i - 1];
      const x1 = scaleX(prevPoint.distance_m);
      const y1 = scaleY(prevPoint.altitude);
      const x2 = scaleX(point.distance_m);
      const y2 = scaleY(point.altitude);
      const gradeAbs = Math.abs(point.grade_pct);
      
      ctx.beginPath();
      ctx.strokeStyle = getGradeColor(gradeAbs);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    });

    // Draw grade color overlay dots (conditionally)
    if (showGradeOverlay) {
      points.forEach((point, i) => {
        if (i === 0) return;
        
        const x = scaleX(point.distance_m);
        const y = scaleY(point.altitude);
        const gradeAbs = Math.abs(point.grade_pct);
        
        ctx.fillStyle = getGradeColor(gradeAbs);
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
        ctx.fill();
      });
    }

    // Draw K-factor events (separate toggles for convex/concave)
    points.forEach(point => {
      if (!point.k_factor || !point.curvature_type) return;
      
      const x = scaleX(point.distance_m);
      const y = scaleY(point.altitude);
      
      ctx.save();
      ctx.translate(x, y);
      
      if (point.curvature_type === 'convex' && showConvexKFactor) {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(-6, 0);
        ctx.lineTo(6, 0);
        ctx.closePath();
        ctx.fill();
      } else if (point.curvature_type === 'concave' && showConcaveKFactor) {
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.moveTo(0, 10);
        ctx.lineTo(-6, 0);
        ctx.lineTo(6, 0);
        ctx.closePath();
        ctx.fill();
      }
      
      ctx.restore();
    });

    // Draw live position overlay
    if (showLiveOverlay && liveDistance !== null && liveAltitude !== null) {
      const x = scaleX(liveDistance);
      const y = scaleY(liveAltitude);
      
      if (x >= PADDING.left && x <= CANVAS_WIDTH - PADDING.right) {
        // Vertical line at current position
        ctx.strokeStyle = '#22c55e'; // green-500
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(x, PADDING.top);
        ctx.lineTo(x, CANVAS_HEIGHT - PADDING.bottom);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Current position marker
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, 2 * Math.PI);
        ctx.fill();
        
        // Pulse effect
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, 2 * Math.PI);
        ctx.stroke();
      }
    }

    // Draw highlighted point
    if (highlightedPoint !== undefined) {
      const point = points.find(p => Math.abs(p.distance_m - highlightedPoint) < 5);
      if (point) {
        const x = scaleX(point.distance_m);
        const y = scaleY(point.altitude);
        
        ctx.strokeStyle = '#fbbf24'; // yellow-400
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, 2 * Math.PI);
        ctx.stroke();
      }
    }

    // Draw axes
    ctx.strokeStyle = '#9ca3af'; // gray-400
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PADDING.left, CANVAS_HEIGHT - PADDING.bottom);
    ctx.lineTo(CANVAS_WIDTH - PADDING.right, CANVAS_HEIGHT - PADDING.bottom);
    ctx.moveTo(PADDING.left, PADDING.top);
    ctx.lineTo(PADDING.left, CANVAS_HEIGHT - PADDING.bottom);
    ctx.stroke();

    // Draw axis labels
    ctx.fillStyle = '#d1d5db'; // gray-300
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';

    // X-axis labels (distance) - adaptive labels with km for long distances
    const labelSpacing = Math.max(gridSpacing, 200);
    const startLabelD = Math.ceil(minDistance / labelSpacing) * labelSpacing;
    for (let d = startLabelD; d <= maxDistance; d += labelSpacing) {
      const x = scaleX(d);
      if (x >= PADDING.left && x <= CANVAS_WIDTH - PADDING.right) {
        const label = useKm ? `${(d / 1000).toFixed(1)}km` : `${d}m`;
        ctx.fillText(label, x, CANVAS_HEIGHT - PADDING.bottom + 20);
      }
    }

    // Y-axis labels (elevation)
    ctx.textAlign = 'right';
    for (let e = Math.floor(minElevation / elevStep) * elevStep; e <= Math.ceil(maxElevation / elevStep) * elevStep; e += elevStep) {
      const y = scaleY(e);
      if (y >= PADDING.top && y <= CANVAS_HEIGHT - PADDING.bottom) {
        ctx.fillText(`${e}m`, PADDING.left - 10, y + 4);
      }
    }

    // Axis titles
    ctx.textAlign = 'center';
    ctx.font = '14px sans-serif';
    const distanceAxisLabel = useKm ? 'Distance (km)' : 'Distance (m)';
    ctx.fillText(distanceAxisLabel, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 10);
    
    ctx.save();
    ctx.translate(15, CANVAS_HEIGHT / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Altitude MSL (m)', 0, 0);
    ctx.restore();

  }, [filteredData, zoom, pan, highlightedPoint, showConvexKFactor, showConcaveKFactor, showGradeOverlay, showLiveOverlay, liveAltitude, liveDistance]);

  // Handle mouse move for hover
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (filteredData.points.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleXRatio = CANVAS_WIDTH / rect.width;
    const scaleYRatio = CANVAS_HEIGHT / rect.height;
    const x = (e.clientX - rect.left) * scaleXRatio;
    const y = (e.clientY - rect.top) * scaleYRatio;

    setMousePos({ x: e.clientX, y: e.clientY });

    if (isPanning) {
      const dx = x - panStart.x;
      const dy = y - panStart.y;
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setPanStart({ x, y });
      return;
    }

    // Find closest point using filtered data
    const { points, minDistance, maxDistance } = filteredData;
    const distanceRange = maxDistance - minDistance;
    const plotWidth = CANVAS_WIDTH - PADDING.left - PADDING.right;
    const distanceAtX = minDistance + ((x - PADDING.left - pan.x) / (plotWidth * zoom)) * distanceRange;
    
    const closest = points.reduce((prev, curr) => {
      const prevDiff = Math.abs(prev.distance_m - distanceAtX);
      const currDiff = Math.abs(curr.distance_m - distanceAtX);
      return currDiff < prevDiff ? curr : prev;
    });

    // Scale threshold based on view mode
    const hoverThreshold = Math.max(50, distanceRange * 0.02);
    if (Math.abs(closest.distance_m - distanceAtX) < hoverThreshold) {
      setHoveredPoint(closest);
    } else {
      setHoveredPoint(null);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    setIsPanning(true);
    setPanStart({ x, y });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleClick = () => {
    if (hoveredPoint && onPointClick) {
      onPointClick(hoveredPoint);
    }
  };

  const exportAsPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `road-profile-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <Card className="w-full" data-testid="card-profile-visualization">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <span>Road Profile</span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setZoom(prev => Math.min(prev + 0.2, 3))}
              data-testid="button-zoom-in"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setZoom(prev => Math.max(prev - 0.2, 0.5))}
              data-testid="button-zoom-out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
              data-testid="button-reset-view"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={exportAsPNG}
              data-testid="button-export-png"
            >
              <Download className="h-4 w-4" />
            </Button>
            <span className="mx-2 border-l border-gray-600 h-6" />
            <Button
              size="sm"
              variant={showGradeOverlay ? 'default' : 'outline'}
              onClick={() => setShowGradeOverlay(!showGradeOverlay)}
              title={showGradeOverlay ? 'Hide grade overlay' : 'Show grade overlay'}
              data-testid="button-toggle-grade"
            >
              <TrendingUp className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant={showConvexKFactor ? 'default' : 'outline'}
              onClick={() => setShowConvexKFactor(!showConvexKFactor)}
              title={showConvexKFactor ? 'Hide convex (crest) markers' : 'Show convex (crest) markers'}
              data-testid="button-toggle-convex-kfactor"
            >
              <TriangleAlert className="h-4 w-4 text-red-500" />
            </Button>
            <Button
              size="sm"
              variant={showConcaveKFactor ? 'default' : 'outline'}
              onClick={() => setShowConcaveKFactor(!showConcaveKFactor)}
              title={showConcaveKFactor ? 'Hide concave (sag) markers' : 'Show concave (sag) markers'}
              data-testid="button-toggle-concave-kfactor"
            >
              <Triangle className="h-4 w-4 text-blue-500" />
            </Button>
            <span className="mx-2 border-l border-gray-600 h-6" />
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as ViewMode)}
              className="h-8 px-2 text-sm bg-gray-800 border border-gray-600 rounded"
              data-testid="select-view-mode"
            >
              <option value="full">Full</option>
              <option value="last1km">Last 1 km</option>
              <option value="last5km">Last 5 km</option>
              <option value="last10km">Last 10 km</option>
            </select>
            <Button
              size="sm"
              variant={showTelemetryPanel ? 'default' : 'outline'}
              onClick={() => setShowTelemetryPanel(!showTelemetryPanel)}
              title={showTelemetryPanel ? 'Hide telemetry panel' : 'Show telemetry panel'}
              data-testid="button-toggle-telemetry"
            >
              {showTelemetryPanel ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent ref={containerRef} className="relative">
        {profile && profile.points && profile.points.length > 0 ? (
          <>
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="w-full h-auto border border-gray-700 rounded cursor-move"
              onMouseMove={handleMouseMove}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseLeave={() => { setHoveredPoint(null); setIsPanning(false); }}
              onClick={handleClick}
              data-testid="canvas-profile"
            />
            
            {/* Live telemetry panel */}
            {showTelemetryPanel && liveTelemetry && (
              <div className="absolute top-2 right-2 bg-gray-900/90 border border-gray-700 rounded p-3 text-xs font-mono z-20" data-testid="panel-live-telemetry">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <div className="text-gray-400">Heading:</div>
                  <div>{liveTelemetry.heading?.toFixed(1) ?? '-'}°</div>
                  <div className="text-gray-400">Lat:</div>
                  <div>{liveTelemetry.lat?.toFixed(6) ?? '-'}°</div>
                  <div className="text-gray-400">Lon:</div>
                  <div>{liveTelemetry.lon?.toFixed(6) ?? '-'}°</div>
                  <div className="text-gray-400">Alt (MSL):</div>
                  <div>{liveTelemetry.altitude?.toFixed(2) ?? '-'} m</div>
                  {liveTelemetry.roll !== undefined && (
                    <>
                      <div className="text-gray-400">Roll:</div>
                      <div>{liveTelemetry.roll.toFixed(1)}°</div>
                    </>
                  )}
                  {liveTelemetry.pitch !== undefined && (
                    <>
                      <div className="text-gray-400">Pitch:</div>
                      <div>{liveTelemetry.pitch.toFixed(1)}°</div>
                    </>
                  )}
                  {liveTelemetry.yaw !== undefined && (
                    <>
                      <div className="text-gray-400">Yaw:</div>
                      <div>{liveTelemetry.yaw.toFixed(1)}°</div>
                    </>
                  )}
                  {liveTelemetry.speed !== undefined && (
                    <>
                      <div className="text-gray-400">Speed:</div>
                      <div>{(liveTelemetry.speed * 3.6).toFixed(1)} km/h</div>
                    </>
                  )}
                  {liveTelemetry.hdop !== undefined && (
                    <>
                      <div className="text-gray-400">HDOP:</div>
                      <div>{liveTelemetry.hdop.toFixed(1)}</div>
                    </>
                  )}
                  {liveTelemetry.numSats !== undefined && (
                    <>
                      <div className="text-gray-400">Sats:</div>
                      <div>{liveTelemetry.numSats}</div>
                    </>
                  )}
                  {liveTelemetry.fixQuality && (
                    <>
                      <div className="text-gray-400">Fix:</div>
                      <div>{liveTelemetry.fixQuality}</div>
                    </>
                  )}
                </div>
              </div>
            )}
            
            {/* Hover tooltip */}
            {hoveredPoint && (
              <div
                className="absolute bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm pointer-events-none shadow-lg z-10"
                style={{
                  left: mousePos.x + 10,
                  top: mousePos.y + 10,
                }}
                data-testid="tooltip-hover-point"
              >
                <div className="font-semibold mb-1">Distance: {hoveredPoint.distance_m.toFixed(1)}m</div>
                <div>Altitude (MSL): {hoveredPoint.altitude.toFixed(2)}m</div>
                <div>Grade: {hoveredPoint.grade_pct.toFixed(2)}%</div>
                {hoveredPoint.k_factor && (
                  <div>K-Factor: {hoveredPoint.k_factor.toFixed(0)}m ({hoveredPoint.curvature_type})</div>
                )}
              </div>
            )}

            {/* Legend - Grade color scheme: 0-8% green, 8-10% blue, 10-12% amber, 12-14% red, 14-16% purple, >16% black */}
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-green-500" />
                <span>0-8%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-blue-500" />
                <span>8-10%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-amber-500" />
                <span>10-12%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-red-500" />
                <span>12-14%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-purple-500" />
                <span>14-16%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-gray-900 dark:bg-gray-100" />
                <span>{'>'}16%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-b-[12px] border-l-transparent border-r-transparent border-b-red-500" />
                <span>Convex K</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-t-[12px] border-l-transparent border-r-transparent border-t-blue-500" />
                <span>Concave K</span>
              </div>
            </div>
          </>
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-500">
            No profile data available. Start recording to see road profile.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
