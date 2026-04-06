/**
 * Linked Profile Viewer
 * Split view with map (alignment) and profile graph with bidirectional cursor sync
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Link2, Link2Off, Download, ZoomIn, ZoomOut, 
  MapPin, FileDown, Layers
} from 'lucide-react';
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import type { Alignment, LinkedProfile, LatLon } from '@/lib/alignment/types';
import { pointAtStation, projectPointToPolyline } from '@/lib/alignment/geometry';
import { exportAlignmentAsGeoJSON, exportProfileAsCSV, exportLinkedSetAsZip } from '@/lib/alignment/exports';
import { SurveyExportDialog } from './SurveyExportDialog';
import 'leaflet/dist/leaflet.css';

interface LinkedProfileViewerProps {
  alignment: Alignment;
  profile: LinkedProfile;
  onClose?: () => void;
}

function DraggableStationMarker({
  alignment,
  station,
  onStationChange,
  linkCursors
}: {
  alignment: Alignment;
  station: number;
  onStationChange: (s_m: number) => void;
  linkCursors: boolean;
}) {
  useMap();
  const markerRef = useRef<L.CircleMarker | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const position = pointAtStation(alignment.polyline, alignment.cumDistM, station);
  
  useMapEvents({
    mousemove(e) {
      if (isDragging && linkCursors) {
        const projected = projectPointToPolyline(
          { lat: e.latlng.lat, lon: e.latlng.lng },
          alignment.polyline,
          alignment.cumDistM
        );
        onStationChange(projected.s_m);
      }
    },
    mouseup() {
      setIsDragging(false);
    }
  });

  return (
    <CircleMarker
      ref={markerRef}
      center={[position.lat, position.lon]}
      radius={10}
      pathOptions={{
        color: '#ef4444',
        fillColor: '#ef4444',
        fillOpacity: 0.8,
        weight: 2
      }}
      eventHandlers={{
        mousedown: () => linkCursors && setIsDragging(true)
      }}
    >
    </CircleMarker>
  );
}

function FitBoundsOnLoad({ polyline }: { polyline: LatLon[] }) {
  const map = useMap();
  
  useEffect(() => {
    if (polyline.length > 0) {
      const bounds = L.latLngBounds(polyline.map(p => [p.lat, p.lon] as [number, number]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, polyline]);

  return null;
}

export function LinkedProfileViewer({
  alignment,
  profile,
}: LinkedProfileViewerProps) {
  const [station, setStation] = useState(0);
  const [linkCursors, setLinkCursors] = useState(true);
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDraggingProfile, setIsDraggingProfile] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  
  const totalLength = alignment.cumDistM[alignment.cumDistM.length - 1] || 0;

  const currentPosition = pointAtStation(alignment.polyline, alignment.cumDistM, station);

  // Interpolate altitude value at current station (linear interpolation between samples)
  const sortedSamples = [...profile.samples].sort((a, b) => a.s_m - b.s_m);
  
  const interpolatedAltitude = (() => {
    if (sortedSamples.length === 0) return null;
    if (sortedSamples.length === 1) return sortedSamples[0].altitude_corrected_m;
    
    // Find bracketing samples
    let before = sortedSamples[0];
    let after = sortedSamples[sortedSamples.length - 1];
    
    for (let i = 0; i < sortedSamples.length - 1; i++) {
      if (sortedSamples[i].s_m <= station && sortedSamples[i + 1].s_m >= station) {
        before = sortedSamples[i];
        after = sortedSamples[i + 1];
        break;
      }
    }
    
    // Edge cases
    if (station <= before.s_m) return before.altitude_corrected_m;
    if (station >= after.s_m) return after.altitude_corrected_m;
    
    // Linear interpolation
    const t = (station - before.s_m) / (after.s_m - before.s_m);
    const altBefore = before.altitude_corrected_m ?? 0;
    const altAfter = after.altitude_corrected_m ?? 0;
    return altBefore + t * (altAfter - altBefore);
  })();

  // Find nearest sample for grade/k-factor (these don't interpolate well)
  const currentSample = sortedSamples.reduce((closest, sample) => {
    const diff = Math.abs(sample.s_m - station);
    const closestDiff = Math.abs(closest.s_m - station);
    return diff < closestDiff ? sample : closest;
  }, sortedSamples[0]);
  
  // Calculate sample spacing statistics
  const sampleSpacingStats = (() => {
    if (sortedSamples.length < 2) return { avg: 0, min: 0, max: 0 };
    let sumSpacing = 0;
    let minSpacing = Infinity;
    let maxSpacing = 0;
    for (let i = 1; i < sortedSamples.length; i++) {
      const spacing = sortedSamples[i].s_m - sortedSamples[i - 1].s_m;
      sumSpacing += spacing;
      minSpacing = Math.min(minSpacing, spacing);
      maxSpacing = Math.max(maxSpacing, spacing);
    }
    return {
      avg: sumSpacing / (sortedSamples.length - 1),
      min: minSpacing === Infinity ? 0 : minSpacing,
      max: maxSpacing
    };
  })();

  // Calculate heading delta (difference between alignment bearing and GNSS heading)
  const headingDelta = (() => {
    const alignmentBearing = currentPosition.bearingDeg;
    const gnssHeading = currentSample?.heading_deg;
    if (gnssHeading == null) return null;
    let delta = gnssHeading - alignmentBearing;
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;
    return delta;
  })();

  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 300;
  const PADDING = { top: 30, right: 50, bottom: 50, left: 70 };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || profile.samples.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const samples = profile.samples.sort((a, b) => a.s_m - b.s_m);
    
    const maxS = totalLength;
    const altitudes = samples.map(s => s.altitude_corrected_m ?? 0).filter(a => a !== null);
    const minAlt = Math.min(...altitudes);
    const maxAlt = Math.max(...altitudes);
    const altRange = maxAlt - minAlt || 10;
    const altPadding = altRange * 0.1;

    const plotWidth = CANVAS_WIDTH - PADDING.left - PADDING.right;
    const plotHeight = CANVAS_HEIGHT - PADDING.top - PADDING.bottom;

    const scaleX = (s: number) => PADDING.left + (s / maxS) * plotWidth * zoom;
    const scaleY = (alt: number) => CANVAS_HEIGHT - PADDING.bottom - ((alt - (minAlt - altPadding)) / (altRange + 2 * altPadding)) * plotHeight;

    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    
    const gridSpacing = maxS > 5000 ? 1000 : maxS > 1000 ? 500 : 100;
    for (let s = 0; s <= maxS; s += gridSpacing) {
      const x = scaleX(s);
      if (x >= PADDING.left && x <= CANVAS_WIDTH - PADDING.right) {
        ctx.beginPath();
        ctx.moveTo(x, PADDING.top);
        ctx.lineTo(x, CANVAS_HEIGHT - PADDING.bottom);
        ctx.stroke();
      }
    }

    const elevGridSpacing = altRange > 50 ? 10 : altRange > 20 ? 5 : 1;
    for (let e = Math.floor(minAlt / elevGridSpacing) * elevGridSpacing; e <= maxAlt + elevGridSpacing; e += elevGridSpacing) {
      const y = scaleY(e);
      if (y >= PADDING.top && y <= CANVAS_HEIGHT - PADDING.bottom) {
        ctx.beginPath();
        ctx.moveTo(PADDING.left, y);
        ctx.lineTo(CANVAS_WIDTH - PADDING.right, y);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);

    // Grade color function: 0-8% green, 8-10% blue, 10-12% amber, 12-14% red, 14-16% purple, >16% black
    const getGradeColor = (grade: number | null | undefined): string => {
      if (grade === null || grade === undefined) return '#10b981'; // default green
      const absGrade = Math.abs(grade);
      if (absGrade > 16) return '#111827'; // black (>16%)
      if (absGrade > 14) return '#a855f7'; // purple (14-16%)
      if (absGrade > 12) return '#ef4444'; // red (12-14%)
      if (absGrade > 10) return '#f59e0b'; // amber (10-12%)
      if (absGrade > 8) return '#3b82f6';  // blue (8-10%)
      return '#10b981'; // green (0-8%)
    };

    const getGradeFillColor = (grade: number | null | undefined): string => {
      if (grade === null || grade === undefined) return 'rgba(16, 185, 129, 0.3)'; // green fill
      const absGrade = Math.abs(grade);
      if (absGrade > 16) return 'rgba(17, 24, 39, 0.3)'; // black (>16%)
      if (absGrade > 14) return 'rgba(168, 85, 247, 0.3)'; // purple (14-16%)
      if (absGrade > 12) return 'rgba(239, 68, 68, 0.3)'; // red (12-14%)
      if (absGrade > 10) return 'rgba(245, 158, 11, 0.3)'; // amber (10-12%)
      if (absGrade > 8) return 'rgba(59, 130, 246, 0.3)';  // blue (8-10%)
      return 'rgba(16, 185, 129, 0.3)'; // green (0-8%)
    };

    // Draw profile with grade-colored segments
    for (let i = 0; i < samples.length - 1; i++) {
      const s1 = samples[i];
      const s2 = samples[i + 1];
      if (s1.altitude_corrected_m === null || s2.altitude_corrected_m === null) continue;
      
      const x1 = scaleX(s1.s_m);
      const x2 = scaleX(s2.s_m);
      const y1 = scaleY(s1.altitude_corrected_m);
      const y2 = scaleY(s2.altitude_corrected_m);
      const baseY = CANVAS_HEIGHT - PADDING.bottom;
      
      // Draw filled area for this segment
      ctx.fillStyle = getGradeFillColor(s1.grade_pct);
      ctx.beginPath();
      ctx.moveTo(x1, baseY);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x2, baseY);
      ctx.closePath();
      ctx.fill();
      
      // Draw line segment
      ctx.strokeStyle = getGradeColor(s1.grade_pct);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    const cursorX = scaleX(station);
    if (cursorX >= PADDING.left && cursorX <= CANVAS_WIDTH - PADDING.right) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(cursorX, PADDING.top);
      ctx.lineTo(cursorX, CANVAS_HEIGHT - PADDING.bottom);
      ctx.stroke();
      ctx.setLineDash([]);

      if (currentSample?.altitude_corrected_m !== null) {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(cursorX, scaleY(currentSample.altitude_corrected_m ?? 0), 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.fillStyle = '#9ca3af';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    
    for (let s = 0; s <= maxS; s += gridSpacing) {
      const x = scaleX(s);
      if (x >= PADDING.left && x <= CANVAS_WIDTH - PADDING.right) {
        const label = maxS > 2000 ? `${(s / 1000).toFixed(1)}km` : `${s}m`;
        ctx.fillText(label, x, CANVAS_HEIGHT - PADDING.bottom + 20);
      }
    }

    ctx.textAlign = 'right';
    for (let e = Math.floor(minAlt / elevGridSpacing) * elevGridSpacing; e <= maxAlt + elevGridSpacing; e += elevGridSpacing) {
      const y = scaleY(e);
      if (y >= PADDING.top && y <= CANVAS_HEIGHT - PADDING.bottom) {
        ctx.fillText(`${e.toFixed(0)}m`, PADDING.left - 10, y + 4);
      }
    }

    ctx.fillStyle = '#d1d5db';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Station (m)', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 10);
    
    ctx.save();
    ctx.translate(15, CANVAS_HEIGHT / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Altitude (m MSL)', 0, 0);
    ctx.restore();

  }, [profile.samples, station, zoom, totalLength, currentSample, sortedSamples]);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!linkCursors) return;
    setIsDraggingProfile(true);
    handleCanvasMouseMove(e);
  }, [linkCursors]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingProfile && e.buttons !== 1) return;
    if (!linkCursors) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    const plotWidth = CANVAS_WIDTH - PADDING.left - PADDING.right;
    const relX = (x - PADDING.left) / plotWidth;
    // Use continuous station - map position is always correct via pointAtStation
    // Profile value is interpolated, not snapped
    const newStation = Math.max(0, Math.min(totalLength, relX * totalLength));
    setStation(newStation);
  }, [isDraggingProfile, linkCursors, totalLength]);

  const handleCanvasMouseUp = useCallback(() => {
    setIsDraggingProfile(false);
  }, []);

  const handleExportGeoJSON = () => exportAlignmentAsGeoJSON(alignment);
  const handleExportCSV = () => exportProfileAsCSV(profile);
  const handleExportZip = async () => {
    await exportLinkedSetAsZip({ alignment, profiles: [profile] }, 0);
  };

  return (
    <Card className="bg-gray-900 border-gray-700" data-testid="card-linked-profile-viewer">
      <CardHeader className="py-3 flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="h-5 w-5 text-blue-400" />
            Alignment + Profile Viewer
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {alignment.name}
          </Badge>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="link-cursors"
              checked={linkCursors}
              onCheckedChange={setLinkCursors}
              data-testid="switch-link-cursors"
            />
            <Label htmlFor="link-cursors" className="text-sm flex items-center gap-1">
              {linkCursors ? <Link2 className="h-4 w-4" /> : <Link2Off className="h-4 w-4" />}
              Link Cursors
            </Label>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.min(4, z * 1.2))} data-testid="button-zoom-in">
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.max(0.5, z / 1.2))} data-testid="button-zoom-out">
              <ZoomOut className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Button 
              variant="default" 
              size="sm" 
              onClick={() => setShowExportDialog(true)} 
              data-testid="button-export-advanced"
            >
              <Download className="h-4 w-4 mr-1" />
              Export...
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportGeoJSON} data-testid="button-export-geojson">
              <Download className="h-4 w-4 mr-1" />
              GeoJSON
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV} data-testid="button-export-csv">
              <FileDown className="h-4 w-4 mr-1" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportZip} data-testid="button-export-zip">
              <FileDown className="h-4 w-4 mr-1" />
              ZIP
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="grid grid-cols-2 gap-0 border-t border-gray-700">
          <div className="h-[400px] border-r border-gray-700 relative">
            <div className="absolute top-2 left-2 z-[1000] bg-gray-800/90 rounded px-2 py-1 text-xs">
              <div className="flex items-center gap-2">
                <MapPin className="h-3 w-3 text-red-400" />
                <span>Drag marker on alignment</span>
              </div>
            </div>
            <MapContainer
              center={[alignment.polyline[0]?.lat || -27.5, alignment.polyline[0]?.lon || 153]}
              zoom={14}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; Google Maps'
                url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
              />
              <FitBoundsOnLoad polyline={alignment.polyline} />
              <Polyline
                positions={alignment.polyline.map(p => [p.lat, p.lon] as [number, number])}
                pathOptions={{ color: '#3b82f6', weight: 4 }}
              />
              <DraggableStationMarker
                alignment={alignment}
                station={station}
                onStationChange={setStation}
                linkCursors={linkCursors}
              />
            </MapContainer>
          </div>

          <div className="h-[400px] flex flex-col">
            <div className="flex-1 p-2">
              <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                className="w-full h-full cursor-crosshair"
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
                data-testid="canvas-profile"
              />
            </div>
          </div>
        </div>

        <div className="p-3 bg-gray-800/50 border-t border-gray-700">
          <div className="grid grid-cols-8 gap-3 text-sm">
            <div className="flex flex-col">
              <span className="text-gray-400 text-xs">Station</span>
              <span className="font-mono text-white">
                {station >= 1000 ? `${(station / 1000).toFixed(3)} km` : `${station.toFixed(1)} m`}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-gray-400 text-xs">Total Length</span>
              <span className="font-mono text-white">
                {totalLength >= 1000 ? `${(totalLength / 1000).toFixed(2)} km` : `${totalLength.toFixed(0)} m`}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-gray-400 text-xs">Altitude (MSL)</span>
              <span className="font-mono text-white">
                {interpolatedAltitude?.toFixed(2) ?? '--'} m
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-gray-400 text-xs">Grade</span>
              <span className="font-mono text-white">
                {currentSample?.grade_pct?.toFixed(2) ?? '--'}%
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-gray-400 text-xs">Lateral Offset</span>
              <span className="font-mono text-white">
                {currentSample?.lateralOffset_m?.toFixed(2) ?? '--'} m
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-gray-400 text-xs">Heading Δ</span>
              <span className="font-mono text-white">
                {headingDelta !== null ? `${headingDelta > 0 ? '+' : ''}${headingDelta.toFixed(1)}°` : '--'}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-gray-400 text-xs">Sample Spacing</span>
              <span className="font-mono text-white text-xs">
                avg {sampleSpacingStats.avg.toFixed(1)}m
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-gray-400 text-xs">Position</span>
              <span className="font-mono text-white text-xs">
                {currentPosition.lat.toFixed(6)}, {currentPosition.lon.toFixed(6)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>

      <SurveyExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        alignment={alignment}
        profile={profile}
      />
    </Card>
  );
}
