/**
 * RoadProfileView — Full-width split panel GNSS road profile visualization
 * Left: Route map (canvas GPS trace) | Right: Elevation profile (canvas)
 * Toolbar: Grade colors, K-factor, Banking, Alerts, Record section, Export
 * Synchronized cursor: hover profile → dot moves on map simultaneously
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Download, Circle, TrendingUp, Activity, Map, BarChart3, Square } from 'lucide-react';
import { exportProfile, type ExportFormat } from './ProfileExport';
import { useSettingsStore } from '@/lib/settings';
import type { ProfilePoint, RoadProfile, ProfileSummary } from '../../../../server/gnss/types';

// ── Grade color thresholds (exact — do not change) ────────────────────────────
export const GRADE_COLORS = {
  normal:  '#378ADD',  // |grade| < 6% (also 8–10%)
  mild:    '#639922',  // 6–8%
  warning: '#BA7517',  // 10–12%
  danger:  '#E24B4A',  // 12–16%
  extreme: '#444441',  // >16%
} as const;

export function gradeColor(grade: number): string {
  const abs = Math.abs(grade);
  if (abs > 16) return GRADE_COLORS.extreme;
  if (abs > 12) return GRADE_COLORS.danger;
  if (abs > 10) return GRADE_COLORS.warning;
  if (abs > 8)  return GRADE_COLORS.normal;   // intentionally reuse blue 8–10%
  if (abs > 6)  return GRADE_COLORS.mild;
  return GRADE_COLORS.normal;
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface RoadProfileViewProps {
  profile: RoadProfile | null;
  isRecording?: boolean;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  onExport?: (format: 'gpx' | 'kml' | 'json') => void;
  /** POI alert positions as distance_m values */
  alertDistances?: number[];
  className?: string;
}

// ── Cursor state ──────────────────────────────────────────────────────────────
interface CursorInfo {
  distKm: number;
  elevM: number;
  grade: number;
  x: number;  // pixel on profile canvas
  lat?: number;
  lng?: number;
}

// ── Main component ────────────────────────────────────────────────────────────
export function RoadProfileView({
  profile,
  isRecording = false,
  onStartRecording,
  onStopRecording,
  onExport,
  alertDistances = [],
  className = '',
}: RoadProfileViewProps) {
  // ── Toolbar toggles ──────────────────────────────────────────────────────
  const [showGradeColors, setShowGradeColors] = useState(true);
  const [showKFactor,     setShowKFactor]     = useState(false);
  const [showBanking,     setShowBanking]     = useState(false);
  const [showAlerts,      setShowAlerts]      = useState(true);
  const [showExportMenu,  setShowExportMenu]  = useState(false);

  // ── Cursor ───────────────────────────────────────────────────────────────
  const [cursor, setCursor] = useState<CursorInfo | null>(null);

  const profileCanvasRef = useRef<HTMLCanvasElement>(null);
  const mapCanvasRef     = useRef<HTMLCanvasElement>(null);

  const points = useMemo(() => profile?.points ?? [], [profile]);
  const summary = profile?.summary ?? null;

  // ── Derived stats ────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!summary || points.length === 0) return null;
    const grades = points.map(p => Math.abs(p.grade_pct));
    const avgGrade = grades.reduce((a, b) => a + b, 0) / grades.length;
    const elevDelta = points.length > 1
      ? points[points.length - 1].altitude - points[0].altitude
      : 0;
    const minK = summary.minKFactorConvex ?? summary.minKFactorConcave ?? null;
    return {
      maxGrade:  Math.max(summary.maxGradeUp_pct, Math.abs(summary.maxGradeDown_pct)),
      avgGrade,
      minRadius: minK,
      elevDelta,
      distKm:    summary.totalDistance_m / 1000,
    };
  }, [summary, points]);

  // ── Draw elevation profile canvas ────────────────────────────────────────
  const drawProfile = useCallback(() => {
    const canvas = profileCanvasRef.current;
    if (!canvas || points.length < 2) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width, H = canvas.height;
    const PAD = { top: 24, right: 16, bottom: 32, left: 48 };
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    const maxDist = points[points.length - 1].distance_m || 1;
    const alts = points.map(p => p.altitude);
    const minAlt = Math.min(...alts);
    const maxAlt = Math.max(...alts);
    const altRange = (maxAlt - minAlt) || 1;

    const toX = (d: number) => PAD.left + (d / maxDist) * innerW;
    const toY = (a: number) => PAD.top + innerH - ((a - minAlt) / altRange) * innerH;

    // ── Y axis labels ──────────────────────────────────────────────────
    ctx.fillStyle = '#64748b';
    ctx.font = '10px IBM Plex Mono, monospace';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const frac = i / 4;
      const alt = minAlt + frac * altRange;
      const y = PAD.top + innerH - frac * innerH;
      ctx.fillText(`${alt.toFixed(0)}m`, PAD.left - 4, y + 4);
      // Gridline
      ctx.beginPath();
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(PAD.left + innerW, y);
      ctx.stroke();
    }

    // ── X axis km markers ──────────────────────────────────────────────
    ctx.textAlign = 'center';
    ctx.fillStyle = '#64748b';
    for (let i = 0; i <= 4; i++) {
      const frac = i / 4;
      const x = toX(frac * maxDist);
      const km = (frac * maxDist / 1000).toFixed(2);
      ctx.fillText(`${km}km`, x, H - 6);
      ctx.beginPath();
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.moveTo(x, PAD.top);
      ctx.lineTo(x, PAD.top + innerH);
      ctx.stroke();
    }

    // ── Fill area under profile ────────────────────────────────────────
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = toX(p.distance_m);
      const y = toY(p.altitude);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.lineTo(toX(maxDist), PAD.top + innerH);
    ctx.lineTo(toX(0), PAD.top + innerH);
    ctx.closePath();
    ctx.fillStyle = 'rgba(55, 138, 221, 0.07)';
    ctx.fill();

    // ── Profile line (colored by grade or plain blue) ──────────────
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const color = showGradeColors ? gradeColor(curr.grade_pct) : GRADE_COLORS.normal;
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.moveTo(toX(prev.distance_m), toY(prev.altitude));
      ctx.lineTo(toX(curr.distance_m), toY(curr.altitude));
      ctx.stroke();
    }

    // ── POI alert dots ─────────────────────────────────────────────────
    if (showAlerts && alertDistances.length > 0) {
      alertDistances.forEach(d => {
        const pt = points.find(p => Math.abs(p.distance_m - d) < 50);
        if (!pt) return;
        const x = toX(pt.distance_m);
        const y = toY(pt.altitude);
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    }

    // ── K-factor markers ───────────────────────────────────────────────
    if (showKFactor) {
      points.forEach(p => {
        if (p.k_factor === null) return;
        const x = toX(p.distance_m);
        const y = toY(p.altitude);
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = p.curvature_type === 'convex' ? '#f59e0b' : '#8b5cf6';
        ctx.fill();
      });
    }

    // ── Cursor line ────────────────────────────────────────────────────
    if (cursor) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(239,68,68,0.8)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.moveTo(cursor.x, PAD.top);
      ctx.lineTo(cursor.x, PAD.top + innerH);
      ctx.stroke();
      ctx.setLineDash([]);

      // Dot on profile
      const ptIdx = Math.round((cursor.x - PAD.left) / innerW * (points.length - 1));
      const pt = points[Math.max(0, Math.min(ptIdx, points.length - 1))];
      if (pt) {
        const cy = toY(pt.altitude);
        ctx.beginPath();
        ctx.arc(cursor.x, cy, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }, [points, showGradeColors, showAlerts, showKFactor, alertDistances, cursor]);

  // ── Draw route map canvas ────────────────────────────────────────────────
  const drawMap = useCallback((cursorLat?: number, cursorLng?: number) => {
    const canvas = mapCanvasRef.current;
    if (!canvas || points.length < 2) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width, H = canvas.height;
    const PAD = 20;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    const lats = points.map(p => p.latitude);
    const lngs = points.map(p => p.longitude);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const latRange = (maxLat - minLat) || 0.001;
    const lngRange = (maxLng - minLng) || 0.001;

    // Fit to square with equal aspect
    const scale = Math.min((W - PAD * 2) / lngRange, (H - PAD * 2) / latRange);
    const offsetX = (W - lngRange * scale) / 2;
    const offsetY = (H - latRange * scale) / 2;

    const toXY = (lat: number, lng: number) => ({
      x: offsetX + (lng - minLng) * scale,
      y: H - (offsetY + (lat - minLat) * scale), // flip Y
    });

    // ── Grid ──────────────────────────────────────────────────────────
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const x = offsetX + (i / 4) * lngRange * scale;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      const y = offsetY + (i / 4) * latRange * scale;
      ctx.beginPath(); ctx.moveTo(0, H - y); ctx.lineTo(W, H - y); ctx.stroke();
    }

    // ── Route track ────────────────────────────────────────────────────
    ctx.beginPath();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    points.forEach((p, i) => {
      const { x, y } = toXY(p.latitude, p.longitude);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    if (!showGradeColors) {
      ctx.strokeStyle = GRADE_COLORS.normal;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    } else {
      // Segment by segment coloring
      for (let i = 1; i < points.length; i++) {
        const { x: x1, y: y1 } = toXY(points[i-1].latitude, points[i-1].longitude);
        const { x: x2, y: y2 } = toXY(points[i].latitude, points[i].longitude);
        ctx.beginPath();
        ctx.strokeStyle = gradeColor(points[i].grade_pct);
        ctx.lineWidth = 2.5;
        ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
    }

    // ── Start / end markers ────────────────────────────────────────────
    if (points.length > 0) {
      const start = toXY(points[0].latitude, points[0].longitude);
      const end   = toXY(points[points.length - 1].latitude, points[points.length - 1].longitude);
      [[start, '#22c55e'], [end, '#ef4444']].forEach(([pt, color]) => {
        const { x, y } = pt as { x: number; y: number };
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.fillStyle = color as string;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }

    // ── POI alert markers ──────────────────────────────────────────────
    if (showAlerts && alertDistances.length > 0) {
      alertDistances.forEach(d => {
        const pt = points.find(p => Math.abs(p.distance_m - d) < 50);
        if (!pt) return;
        const { x, y } = toXY(pt.latitude, pt.longitude);
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    }

    // ── Cursor dot on map ──────────────────────────────────────────────
    if (cursorLat !== undefined && cursorLng !== undefined) {
      const { x, y } = toXY(cursorLat, cursorLng);
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(239,68,68,0.9)';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // ── Labels ─────────────────────────────────────────────────────────
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px IBM Plex Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('Route map', PAD, PAD - 6);
  }, [points, showGradeColors, showAlerts, alertDistances]);

  // ── Redraw both canvases ─────────────────────────────────────────────────
  useEffect(() => {
    drawProfile();
    drawMap(cursor?.lat, cursor?.lng);
  }, [drawProfile, drawMap, cursor]);

  // ── Canvas resize observer ───────────────────────────────────────────────
  useEffect(() => {
    const resize = () => {
      const pc = profileCanvasRef.current;
      const mc = mapCanvasRef.current;
      if (pc) { pc.width = pc.offsetWidth; pc.height = pc.offsetHeight; }
      if (mc) { mc.width = mc.offsetWidth; mc.height = mc.offsetHeight; }
      drawProfile();
      drawMap();
    };
    resize();
    const ro = new ResizeObserver(resize);
    if (profileCanvasRef.current) ro.observe(profileCanvasRef.current);
    if (mapCanvasRef.current)     ro.observe(mapCanvasRef.current);
    return () => ro.disconnect();
  }, [drawProfile, drawMap]);

  // ── Profile mouse interaction ────────────────────────────────────────────
  const onProfileMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (points.length < 2) return;
    const canvas = profileCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const PAD = { left: 48, top: 24, right: 16, bottom: 32 };
    const innerW = canvas.width - PAD.left - PAD.right;

    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    if (x < PAD.left || x > PAD.left + innerW) { setCursor(null); return; }

    const frac = (x - PAD.left) / innerW;
    const ptIdx = Math.round(frac * (points.length - 1));
    const pt = points[Math.max(0, Math.min(ptIdx, points.length - 1))];
    setCursor({
      distKm: pt.distance_m / 1000,
      elevM: pt.altitude,
      grade: pt.grade_pct,
      x,
      lat: pt.latitude,
      lng: pt.longitude,
    });
  }, [points]);

  const onProfileMouseLeave = useCallback(() => setCursor(null), []);

  // ── Map hover → profile sync ────────────────────────────────────────────────
  const onMapMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (points.length < 2) return;
    const canvas = mapCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const PAD = 20;
    const W = canvas.width, H = canvas.height;

    const lats = points.map(p => p.latitude);
    const lngs = points.map(p => p.longitude);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const latRange = (maxLat - minLat) || 0.001;
    const lngRange = (maxLng - minLng) || 0.001;
    const scale = Math.min((W - PAD * 2) / lngRange, (H - PAD * 2) / latRange);
    const offsetX = (W - lngRange * scale) / 2;
    const offsetY = (H - latRange * scale) / 2;

    const mx = (e.clientX - rect.left) * (W / rect.width);
    const my = (e.clientY - rect.top)  * (H / rect.height);

    // Find nearest point
    let minDist = Infinity, nearest = 0;
    points.forEach((p, i) => {
      const px = offsetX + (p.longitude - minLng) * scale;
      const py = H - (offsetY + (p.latitude - minLat) * scale);
      const d = (mx - px) ** 2 + (my - py) ** 2;
      if (d < minDist) { minDist = d; nearest = i; }
    });

    const pt = points[nearest];
    // Map to profile canvas X
    const profileCanvas = profileCanvasRef.current;
    const profilePadL = 48, profilePadR = 16;
    const innerW = (profileCanvas?.width ?? 400) - profilePadL - profilePadR;
    const maxDist = points[points.length - 1].distance_m || 1;
    const profileX = profilePadL + (pt.distance_m / maxDist) * innerW;

    setCursor({ distKm: pt.distance_m / 1000, elevM: pt.altitude, grade: pt.grade_pct, x: profileX, lat: pt.latitude, lng: pt.longitude });
  }, [points]);

  // ── Toolbar button style ─────────────────────────────────────────────────
  const tbBtn = (active: boolean) =>
    `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
      active
        ? 'bg-blue-700/80 border-blue-500 text-white'
        : 'bg-gray-800 border-gray-600 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
    }`;

  // Alert thresholds from settings
  const { profileSettings } = useSettingsStore();
  const gradeUpThresh   = profileSettings?.gradeUpAlertThreshold   ?? 12;
  const gradeDownThresh = profileSettings?.gradeDownAlertThreshold  ?? -12;
  const minRadius       = profileSettings?.minimumCurveRadius_m     ?? 15;

  const hasData = points.length >= 2;

  // Compute alert distances from grade thresholds
  const computedAlertDistances = useMemo(() => {
    if (!points.length) return [];
    return points
      .filter(p => p.grade_pct > gradeUpThresh || p.grade_pct < gradeDownThresh)
      .map(p => p.distance_m);
  }, [points, gradeUpThresh, gradeDownThresh]);

  const allAlertDistances = [...alertDistances, ...computedAlertDistances];

  return (
    <div className={`flex flex-col bg-gray-900 rounded-xl overflow-hidden ${className}`}>

      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-gray-700/60 bg-gray-900/80">
        {/* Toggles */}
        <button className={tbBtn(showGradeColors)} onClick={() => setShowGradeColors(v => !v)}>
          <BarChart3 className="w-3.5 h-3.5" /> Grade colors
        </button>
        <button className={tbBtn(showKFactor)} onClick={() => setShowKFactor(v => !v)}>
          <TrendingUp className="w-3.5 h-3.5" /> K-factor
        </button>
        <button className={tbBtn(showBanking)} onClick={() => setShowBanking(v => !v)}>
          <Activity className="w-3.5 h-3.5" /> Banking
        </button>
        <button className={tbBtn(showAlerts)} onClick={() => setShowAlerts(v => !v)}>
          <Circle className="w-3.5 h-3.5 text-red-400" /> Alerts
        </button>

        <div className="w-px h-5 bg-gray-700 mx-1" />

        {/* Record section */}
        {isRecording && (
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-red-900/50 border border-red-600 text-red-300 rounded-lg text-xs font-bold animate-pulse">
            <span className="w-2 h-2 bg-red-400 rounded-full" />
            Recording
          </span>
        )}
        <button
          className={tbBtn(isRecording)}
          onClick={isRecording ? onStopRecording : onStartRecording}
          style={isRecording ? { borderColor: '#dc2626', background: '#7f1d1d', color: '#fca5a5' } : {}}
        >
          <Square className="w-3.5 h-3.5" />
          {isRecording ? 'Stop section' : 'Record section'}
        </button>

        <div className="w-px h-5 bg-gray-700 mx-1" />

        {/* Export */}
        <div className="relative">
          <button className={tbBtn(false)} onClick={() => setShowExportMenu(v => !v)}>
            <Download className="w-3.5 h-3.5" /> Export ↗
          </button>
          {showExportMenu && (
            <div className="absolute left-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden z-50 shadow-xl min-w-[120px]">
              {(['gpx','kml','json'] as const).map(fmt => (
                <button key={fmt} onClick={() => { onExport?.(fmt); setShowExportMenu(false); }}
                  className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-gray-700 transition-colors uppercase tracking-wide font-mono">
                  {fmt}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Alert thresholds strip ──────────────────────────────────── */}
      <div className="flex items-center gap-4 px-3 py-1 border-b border-gray-700/40 bg-gray-950/60 text-xs font-mono">
        <span className="text-gray-500">Alerts at:</span>
        <span className={gradeUpThresh > 0 ? 'text-amber-400' : 'text-gray-400'}>↑{gradeUpThresh}%</span>
        <span className={gradeDownThresh < 0 ? 'text-amber-400' : 'text-gray-400'}>↓{Math.abs(gradeDownThresh)}%</span>
        <span className="text-gray-500 ml-2">Min radius:</span>
        <span className="text-amber-400">{minRadius}m</span>
        {allAlertDistances.length > 0 && showAlerts && (
          <span className="ml-auto text-red-400">{allAlertDistances.length} alert{allAlertDistances.length > 1 ? 's' : ''} on track</span>
        )}
      </div>

      {/* ── Main panels ─────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0" style={{ height: '340px' }}>
        {/* Left: Route map */}
        <div className="relative w-2/5 border-r border-gray-700/60 bg-gray-950">
          <div className="absolute top-2 left-3 text-xs text-gray-500 font-mono z-10">Route map</div>
          {hasData ? (
            <canvas ref={mapCanvasRef} className="w-full h-full" style={{ display: 'block' }}
              onMouseMove={onMapMouseMove}
              onMouseLeave={onProfileMouseLeave}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-600 text-sm">
              <Map className="w-6 h-6 mr-2" /> No GPS track yet
            </div>
          )}
        </div>

        {/* Right: Elevation profile */}
        <div className="relative flex-1 bg-gray-950">
          {hasData ? (
            <>
              <canvas
                ref={profileCanvasRef}
                className="w-full h-full cursor-crosshair"
                style={{ display: 'block' }}
                onMouseMove={onProfileMouseMove}
                onMouseLeave={onProfileMouseLeave}
              />
              {/* Tooltip */}
              {cursor && (
                <div style={{
                  position: 'absolute',
                  left: Math.min(cursor.x + 10, profileCanvasRef.current ? profileCanvasRef.current.offsetWidth - 160 : 9999),
                  top: 8, pointerEvents: 'none',
                  background: 'rgba(15,23,42,0.95)',
                  border: '1px solid #334155',
                  borderRadius: 8, padding: '5px 10px',
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: 11, color: '#e2e8f0', lineHeight: 1.7, whiteSpace: 'nowrap',
                }}>
                  <div>{cursor.distKm.toFixed(3)} km</div>
                  <div>{cursor.elevM.toFixed(1)} m</div>
                  <div style={{ color: gradeColor(cursor.grade) }}>{cursor.grade.toFixed(1)}%</div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-600 text-sm">
              <BarChart3 className="w-6 h-6 mr-2" /> No profile data yet
            </div>
          )}
        </div>
      </div>

      {/* ── Legend ──────────────────────────────────────────────────── */}
      {showGradeColors && hasData && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-1.5 border-t border-gray-700/60 bg-gray-900/60">
          <span className="text-gray-500 text-xs font-mono mr-1">Grade:</span>
          {([
            ['< 6%',   GRADE_COLORS.normal],
            ['6–8%',   GRADE_COLORS.mild],
            ['8–10%',  GRADE_COLORS.normal],
            ['10–12%', GRADE_COLORS.warning],
            ['12–16%', GRADE_COLORS.danger],
            ['> 16%',  GRADE_COLORS.extreme],
          ] as [string, string][]).map(([label, color]) => (
            <span key={label} className="flex items-center gap-1 text-xs font-mono">
              <span style={{ width: 24, height: 4, background: color, display: 'inline-block', borderRadius: 2 }} />
              <span style={{ color: '#94a3b8' }}>{label}</span>
            </span>
          ))}
          <span className="flex items-center gap-1 text-xs font-mono ml-2">
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', display: 'inline-block', verticalAlign: 'middle' }} />
            <span style={{ color: '#94a3b8' }}>POI alert</span>
          </span>
        </div>
      )}

      {/* ── Stats bar ───────────────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-5 divide-x divide-gray-700/60 border-t border-gray-700/60 bg-gray-900">
          {[
            {
              label: 'Max grade',
              value: `${stats.maxGrade.toFixed(1)}%`,
              alert: stats.maxGrade > 12,
            },
            {
              label: 'Avg grade',
              value: `${stats.avgGrade.toFixed(1)}%`,
              alert: false,
            },
            {
              label: 'Min radius',
              value: stats.minRadius ? `${stats.minRadius.toFixed(0)} m` : '—',
              alert: stats.minRadius !== null && stats.minRadius < 150,
            },
            {
              label: 'Δ Elevation',
              value: `${stats.elevDelta >= 0 ? '+' : ''}${stats.elevDelta.toFixed(1)} m`,
              alert: false,
            },
            {
              label: 'Distance',
              value: `${stats.distKm.toFixed(3)} km`,
              alert: false,
            },
          ].map(({ label, value, alert }) => (
            <div key={label} className="flex flex-col items-center justify-center py-2 px-1">
              <span className="text-gray-500 text-xs">{label}</span>
              <span className={`text-sm font-mono font-semibold ${alert ? 'text-red-400' : 'text-gray-200'}`}>
                {value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default RoadProfileView;
