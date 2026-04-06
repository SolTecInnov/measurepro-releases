/**
 * Alignment + Profile Linked Viewer
 * Split view with map (alignment polyline) and profile graph with bidirectional cursor linking
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Link2, Link2Off, Download, MapPin, TrendingUp, 
  ChevronUp, ChevronDown, Maximize2, Minimize2,
  Save, FolderOpen
} from 'lucide-react';
import type { Alignment, LinkedProfile, PointAtStation } from '@/lib/alignment/types';
import { pointAtStation, projectPointToPolyline } from '@/lib/alignment/geometry';
import { exportLinkedSetAsZip, exportAlignmentAsGeoJSON, exportProfileAsCSV } from '@/lib/alignment/exports';
import type { RoadProfile } from '../../../server/gnss/types';

interface AlignmentProfileViewerProps {
  alignment: Alignment | null;
  profile: RoadProfile | null;
  linkedProfile?: LinkedProfile | null;
  onStationChange?: (station_m: number) => void;
  onSave?: () => void;
  onLoad?: () => void;
}

export default function AlignmentProfileViewer({
  alignment,
  profile,
  linkedProfile,
  onStationChange,
  onSave,
  onLoad,
}: AlignmentProfileViewerProps) {
  const [station_m, setStation_m] = useState(0);
  const [linkCursors, setLinkCursors] = useState(true);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [isExpanded, setIsExpanded] = useState(false);
  const [markerPosition, setMarkerPosition] = useState<PointAtStation | null>(null);
  
  const mapCanvasRef = useRef<HTMLCanvasElement>(null);
  const profileCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const MAP_WIDTH = 600;
  const MAP_HEIGHT = 300;
  const PROFILE_WIDTH = 600;
  const PROFILE_HEIGHT = 300;
  const PADDING = { top: 40, right: 40, bottom: 50, left: 70 };

  const totalDistance = alignment?.cumDistM[alignment.cumDistM.length - 1] || 0;

  useEffect(() => {
    if (alignment && alignment.polyline.length > 0 && alignment.cumDistM.length > 0) {
      const pos = pointAtStation(alignment.polyline, alignment.cumDistM, station_m);
      setMarkerPosition(pos);
      onStationChange?.(station_m);
    }
  }, [station_m, alignment, onStationChange]);

  const handleStationFromProfile = useCallback((newStation: number) => {
    setStation_m(Math.max(0, Math.min(newStation, totalDistance)));
  }, [totalDistance]);

  const handleMapClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!alignment || !linkCursors) return;

    const canvas = mapCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * MAP_WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * MAP_HEIGHT;

    const lats = alignment.polyline.map(p => p.lat);
    const lons = alignment.polyline.map(p => p.lon);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    const latRange = maxLat - minLat || 0.001;
    const lonRange = maxLon - minLon || 0.001;
    const plotWidth = MAP_WIDTH - PADDING.left - PADDING.right;
    const plotHeight = MAP_HEIGHT - PADDING.top - PADDING.bottom;

    const clickLon = minLon + ((x - PADDING.left) / plotWidth) * lonRange;
    const clickLat = maxLat - ((y - PADDING.top) / plotHeight) * latRange;

    const projected = projectPointToPolyline(
      { lat: clickLat, lon: clickLon },
      alignment.polyline,
      alignment.cumDistM
    );

    setStation_m(projected.s_m);
  }, [alignment, linkCursors]);

  const handleProfileClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!profile || !linkCursors) return;

    const canvas = profileCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * PROFILE_WIDTH;

    const plotWidth = PROFILE_WIDTH - PADDING.left - PADDING.right;
    const maxDistance = profile.points.length > 0 
      ? Math.max(...profile.points.map(p => p.distance_m))
      : totalDistance;

    const clickStation = ((x - PADDING.left) / plotWidth) * maxDistance;
    handleStationFromProfile(clickStation);
  }, [profile, linkCursors, totalDistance, handleStationFromProfile]);

  useEffect(() => {
    const canvas = mapCanvasRef.current;
    if (!canvas || !alignment || alignment.polyline.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

    const lats = alignment.polyline.map(p => p.lat);
    const lons = alignment.polyline.map(p => p.lon);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    const latRange = maxLat - minLat || 0.001;
    const lonRange = maxLon - minLon || 0.001;
    const plotWidth = MAP_WIDTH - PADDING.left - PADDING.right;
    const plotHeight = MAP_HEIGHT - PADDING.top - PADDING.bottom;

    const scaleX = (lon: number) => PADDING.left + ((lon - minLon) / lonRange) * plotWidth;
    const scaleY = (lat: number) => PADDING.top + ((maxLat - lat) / latRange) * plotHeight;

    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 3;
    ctx.beginPath();
    alignment.polyline.forEach((p, i) => {
      const x = scaleX(p.lon);
      const y = scaleY(p.lat);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    alignment.polyline.forEach((p, i) => {
      const x = scaleX(p.lon);
      const y = scaleY(p.lat);
      ctx.fillStyle = i === 0 ? '#22c55e' : i === alignment.polyline.length - 1 ? '#ef4444' : '#6b7280';
      ctx.beginPath();
      ctx.arc(x, y, i === 0 || i === alignment.polyline.length - 1 ? 6 : 3, 0, Math.PI * 2);
      ctx.fill();
    });

    if (markerPosition) {
      const markerX = scaleX(markerPosition.lon);
      const markerY = scaleY(markerPosition.lat);

      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(markerX, markerY, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      const arrowLen = 20;
      const bearingRad = (markerPosition.bearingDeg - 90) * (Math.PI / 180);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(markerX, markerY);
      ctx.lineTo(
        markerX + Math.cos(bearingRad) * arrowLen,
        markerY + Math.sin(bearingRad) * arrowLen
      );
      ctx.stroke();
    }

    ctx.fillStyle = '#9ca3af';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Longitude', MAP_WIDTH / 2, MAP_HEIGHT - 10);

    ctx.save();
    ctx.translate(15, MAP_HEIGHT / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Latitude', 0, 0);
    ctx.restore();

    ctx.fillStyle = '#ffffff';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(alignment.name, PADDING.left, 25);

  }, [alignment, markerPosition]);

  useEffect(() => {
    const canvas = profileCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, PROFILE_WIDTH, PROFILE_HEIGHT);

    if (!profile || !profile.points || profile.points.length === 0) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No profile data available', PROFILE_WIDTH / 2, PROFILE_HEIGHT / 2);
      return;
    }

    const points = profile.points;
    const maxDistance = Math.max(...points.map(p => p.distance_m));
    const altitudes = points.map(p => p.altitude);
    const minAlt = Math.min(...altitudes);
    const maxAlt = Math.max(...altitudes);
    const altRange = maxAlt - minAlt || 1;
    const altPadding = altRange * 0.1;

    const plotWidth = PROFILE_WIDTH - PADDING.left - PADDING.right;
    const plotHeight = PROFILE_HEIGHT - PADDING.top - PADDING.bottom;

    const scaleX = (d: number) => PADDING.left + (d / maxDistance) * plotWidth;
    const scaleY = (alt: number) => 
      PADDING.top + plotHeight - ((alt - (minAlt - altPadding)) / (altRange + 2 * altPadding)) * plotHeight;

    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = PADDING.top + (i / 5) * plotHeight;
      ctx.beginPath();
      ctx.moveTo(PADDING.left, y);
      ctx.lineTo(PROFILE_WIDTH - PADDING.right, y);
      ctx.stroke();
    }

    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = scaleX(p.distance_m);
      const y = scaleY(p.altitude);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    const cursorX = scaleX(station_m);
    if (cursorX >= PADDING.left && cursorX <= PROFILE_WIDTH - PADDING.right) {
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(cursorX, PADDING.top);
      ctx.lineTo(cursorX, PROFILE_HEIGHT - PADDING.bottom);
      ctx.stroke();
      ctx.setLineDash([]);

      const closestPoint = points.reduce((prev, curr) =>
        Math.abs(curr.distance_m - station_m) < Math.abs(prev.distance_m - station_m) ? curr : prev
      );

      const cursorY = scaleY(closestPoint.altitude);
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(cursorX, cursorY, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#9ca3af';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Station (m)', PROFILE_WIDTH / 2, PROFILE_HEIGHT - 10);

    ctx.save();
    ctx.translate(15, PROFILE_HEIGHT / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Altitude MSL (m)', 0, 0);
    ctx.restore();

    ctx.textAlign = 'left';
    for (let i = 0; i <= 5; i++) {
      const d = (i / 5) * maxDistance;
      const x = scaleX(d);
      const label = maxDistance > 1000 ? `${(d / 1000).toFixed(1)}km` : `${d.toFixed(0)}m`;
      ctx.fillText(label, x, PROFILE_HEIGHT - PADDING.bottom + 15);
    }

    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
      const alt = minAlt - altPadding + ((5 - i) / 5) * (altRange + 2 * altPadding);
      const y = PADDING.top + (i / 5) * plotHeight;
      ctx.fillText(alt.toFixed(1), PADDING.left - 5, y + 4);
    }

  }, [profile, station_m]);

  const handleExport = async () => {
    if (alignment && linkedProfile) {
      await exportLinkedSetAsZip({ alignment, profiles: [linkedProfile] });
    } else if (alignment) {
      exportAlignmentAsGeoJSON(alignment);
    } else if (linkedProfile) {
      exportProfileAsCSV(linkedProfile);
    }
  };

  const getReadout = () => {
    if (!markerPosition || !profile) return null;

    const closestPoint = profile.points.reduce((prev, curr) =>
      Math.abs(curr.distance_m - station_m) < Math.abs(prev.distance_m - station_m) ? curr : prev
    );

    return {
      station_km: (station_m / 1000).toFixed(3),
      lat: markerPosition.lat.toFixed(6),
      lon: markerPosition.lon.toFixed(6),
      bearing: markerPosition.bearingDeg.toFixed(1),
      altitude: closestPoint.altitude.toFixed(2),
      grade: closestPoint.grade_pct.toFixed(2),
    };
  };

  const readout = getReadout();

  return (
    <Card className={`w-full ${isExpanded ? 'fixed inset-4 z-50' : ''}`} data-testid="card-alignment-profile-viewer">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Alignment + Profile Viewer
          </span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                id="link-cursors"
                checked={linkCursors}
                onCheckedChange={setLinkCursors}
                data-testid="switch-link-cursors"
              />
              <Label htmlFor="link-cursors" className="text-sm flex items-center gap-1">
                {linkCursors ? <Link2 className="h-4 w-4" /> : <Link2Off className="h-4 w-4" />}
                Link
              </Label>
            </div>
            <Button size="sm" variant="outline" onClick={() => setSplitRatio(Math.min(0.7, splitRatio + 0.1))} data-testid="button-increase-map">
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => setSplitRatio(Math.max(0.3, splitRatio - 0.1))} data-testid="button-decrease-map">
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => setIsExpanded(!isExpanded)} data-testid="button-toggle-expand">
              {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            {onSave && (
              <Button size="sm" variant="outline" onClick={onSave} data-testid="button-save">
                <Save className="h-4 w-4" />
              </Button>
            )}
            {onLoad && (
              <Button size="sm" variant="outline" onClick={onLoad} data-testid="button-load">
                <FolderOpen className="h-4 w-4" />
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={handleExport} data-testid="button-export">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent ref={containerRef}>
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1" style={{ flex: splitRatio }}>
            <div className="text-sm text-gray-400 mb-2 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Alignment Map
            </div>
            <canvas
              ref={mapCanvasRef}
              width={MAP_WIDTH}
              height={MAP_HEIGHT}
              className="w-full h-auto border border-gray-700 rounded cursor-crosshair"
              onClick={handleMapClick}
              data-testid="canvas-alignment-map"
            />
          </div>
          
          <div className="flex-1" style={{ flex: 1 - splitRatio }}>
            <div className="text-sm text-gray-400 mb-2 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Profile Graph
            </div>
            <canvas
              ref={profileCanvasRef}
              width={PROFILE_WIDTH}
              height={PROFILE_HEIGHT}
              className="w-full h-auto border border-gray-700 rounded cursor-crosshair"
              onClick={handleProfileClick}
              data-testid="canvas-profile-graph"
            />
          </div>
        </div>

        {readout && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-6 gap-4 p-3 bg-gray-800 rounded" data-testid="readout-panel">
            <div>
              <div className="text-xs text-gray-400">Station</div>
              <div className="text-sm font-mono">{readout.station_km} km</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Latitude</div>
              <div className="text-sm font-mono">{readout.lat}°</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Longitude</div>
              <div className="text-sm font-mono">{readout.lon}°</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Bearing</div>
              <div className="text-sm font-mono">{readout.bearing}°</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Altitude (MSL)</div>
              <div className="text-sm font-mono">{readout.altitude} m</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Grade</div>
              <div className="text-sm font-mono">{readout.grade}%</div>
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center gap-4">
          <Label className="text-sm">Station:</Label>
          <input
            type="range"
            min={0}
            max={totalDistance}
            value={station_m}
            onChange={(e) => setStation_m(parseFloat(e.target.value))}
            className="flex-1"
            data-testid="slider-station"
          />
          <span className="text-sm font-mono w-24">
            {(station_m / 1000).toFixed(3)} km
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
