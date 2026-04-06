/**
 * ClearanceHUD Component
 * Full-screen overlay showing real-time height and width clearance data during mobile survey.
 * Embeds the LivePointCloudMinimap via the `minimap` slot prop.
 * When not connected, shows a "LiDAR not connected" placeholder instead of crashing.
 */

import { useMemo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Scan, Wifi, WifiOff, X } from 'lucide-react';
import type { LidarMetrics, LidarAlert, LidarStatus } from '@/lib/lidar/types';

interface ClearanceHUDProps {
  metrics: LidarMetrics | null;
  alerts: LidarAlert[];
  status: LidarStatus | null;
  isConnected: boolean;
  startStaticScan: () => unknown;
  minimap?: ReactNode;
  onClose?: () => void;
}

type ClearanceColor = 'green' | 'yellow' | 'red';

const HEIGHT_ALERT_THRESHOLD = 5.0;
const WIDTH_ALERT_THRESHOLD = 3.5;
const VEHICLE_WIDTH_M = 2.5;

function getColorState(value: number, threshold: number): ClearanceColor {
  if (value <= threshold) return 'red';
  const margin = (value - threshold) / threshold;
  if (margin <= 0.2) return 'yellow';
  return 'green';
}

const colorConfig: Record<
  ClearanceColor,
  { bg: string; border: string; text: string; badge: string; pulse: boolean }
> = {
  green: {
    bg: 'bg-black',
    border: 'border-green-500',
    text: 'text-green-400',
    badge: 'bg-green-500/20 text-green-400 border-green-500',
    pulse: false,
  },
  yellow: {
    bg: 'bg-black',
    border: 'border-yellow-400',
    text: 'text-yellow-300',
    badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-400',
    pulse: false,
  },
  red: {
    bg: 'bg-red-950',
    border: 'border-red-500',
    text: 'text-red-400',
    badge: 'bg-red-500/20 text-red-400 border-red-500',
    pulse: true,
  },
};

export function ClearanceHUD({
  metrics,
  alerts,
  status,
  isConnected,
  startStaticScan,
  minimap,
  onClose,
}: ClearanceHUDProps) {
  const hasAlert = alerts.some(a => a.severity === 'critical');
  const hasWarning = alerts.some(a => a.severity === 'warning');

  const lowestWidthAtHeight = useMemo(() => {
    if (!metrics?.usableWidthAtHeights?.length) return null;
    return [...metrics.usableWidthAtHeights].sort((a, b) => a.heightM - b.heightM)[0];
  }, [metrics]);

  const heightValue = lowestWidthAtHeight?.heightM ?? null;
  const widthClearance = metrics?.lateral ?? null;
  const totalWidth = widthClearance ? widthClearance.leftM + widthClearance.rightM : null;

  const colorState: ClearanceColor = useMemo(() => {
    if (hasAlert) return 'red';
    if (hasWarning) return 'yellow';
    if (heightValue !== null) {
      const c = getColorState(heightValue, HEIGHT_ALERT_THRESHOLD);
      if (c !== 'green') return c;
    }
    if (totalWidth !== null) {
      const c = getColorState(totalWidth, WIDTH_ALERT_THRESHOLD);
      if (c !== 'green') return c;
    }
    return 'green';
  }, [hasAlert, hasWarning, heightValue, totalWidth]);

  const cfg = colorConfig[colorState];
  const packetsPerSec = status?.packetsPerSec ?? 0;

  const widthAtHeightsEntries = metrics?.usableWidthAtHeights ?? [];

  const barEntries = useMemo(() => {
    if (!widthAtHeightsEntries.length) return [];
    return [...widthAtHeightsEntries].sort((a, b) => a.heightM - b.heightM);
  }, [widthAtHeightsEntries]);

  const primaryWidthEntry = barEntries[0] ?? null;
  const roadWidthFromHeights = primaryWidthEntry?.widthM ?? null;
  const barScale = Math.max(roadWidthFromHeights ?? VEHICLE_WIDTH_M * 2, 1);

  const leftBarPct = widthClearance
    ? Math.min(100, (widthClearance.leftM / barScale) * 100)
    : roadWidthFromHeights !== null
    ? 50
    : 0;
  const rightBarPct = widthClearance
    ? Math.min(100, (widthClearance.rightM / barScale) * 100)
    : roadWidthFromHeights !== null
    ? 50
    : 0;
  const vehiclePct = Math.min(100, (VEHICLE_WIDTH_M / barScale) * 100);

  return (
    <div
      data-testid="clearance-hud"
      className={`relative w-full min-h-screen flex flex-col ${cfg.bg} ${cfg.pulse ? 'animate-pulse' : ''} transition-colors duration-500`}
    >
      {/* Header bar */}
      <div className={`flex items-center justify-between px-6 py-3 border-b ${cfg.border} border-opacity-50`}>
        <div className="flex items-center gap-3">
          <div
            data-testid="lidar-status-dot"
            className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-500'}`}
          />
          <span className="text-gray-300 text-sm font-mono uppercase tracking-widest">
            {isConnected ? 'LiDAR Live' : 'Disconnected'}
          </span>
          {isConnected && (
            <span data-testid="packets-per-sec" className="text-gray-500 text-xs font-mono">
              {packetsPerSec.toFixed(1)} pkt/s
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isConnected ? (
            <Wifi className="h-4 w-4 text-green-400" />
          ) : (
            <WifiOff className="h-4 w-4 text-gray-500" />
          )}
          {onClose && (
            <button
              data-testid="button-exit-hud"
              onClick={onClose}
              className="ml-2 flex items-center gap-1 px-3 py-1 rounded-lg bg-gray-800 border border-gray-600 text-gray-200 text-xs font-mono hover:bg-gray-700 hover:border-gray-400 transition-colors pointer-events-auto"
              title="Exit HUD"
            >
              <X className="h-3.5 w-3.5" />
              Exit HUD
            </button>
          )}
        </div>
      </div>

      {/* Not connected placeholder — shown instead of clearance data */}
      {!isConnected && (
        <div
          className="flex-1 flex flex-col items-center justify-center gap-4"
          data-testid="lidar-not-connected-placeholder"
        >
          <div
            className="flex items-center gap-2 px-4 py-3 rounded-lg bg-gray-950/90 border-2 border-red-500 shadow-lg"
            data-testid="lidar-not-connected-badge"
          >
            <span className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
            <span className="text-sm text-red-400 font-mono">LiDAR not connected</span>
          </div>
          <p className="text-gray-600 text-xs font-mono">
            Connect from the LiDAR page to start receiving data
          </p>
        </div>
      )}

      {/* Main clearance display — only when connected */}
      {isConnected && (
        <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6 py-10">
          {/* Primary: height clearance */}
          <div className="text-center" data-testid="height-clearance-section">
            <p className="text-gray-400 text-sm uppercase tracking-widest mb-1">Height Clearance</p>
            <p
              data-testid="height-clearance-value"
              className={`text-9xl font-black tabular-nums leading-none ${cfg.text}`}
              style={{
                textShadow:
                  colorState === 'red'
                    ? '0 0 40px rgba(239,68,68,0.5)'
                    : colorState === 'yellow'
                    ? '0 0 30px rgba(234,179,8,0.4)'
                    : '0 0 30px rgba(74,222,128,0.3)',
              }}
            >
              {heightValue !== null ? `${heightValue.toFixed(2)}m` : '--'}
            </p>
            <div className={`mt-3 inline-block px-4 py-1 rounded-full border text-sm font-semibold ${cfg.badge}`}>
              {colorState === 'green' && 'SAFE'}
              {colorState === 'yellow' && 'CAUTION'}
              {colorState === 'red' && 'ALERT'}
            </div>
          </div>

          {/* Secondary: width clearance */}
          <div className="text-center" data-testid="width-clearance-section">
            <p className="text-gray-400 text-sm uppercase tracking-widest mb-1">Width Clearance</p>
            <p
              data-testid="width-clearance-value"
              className={`text-5xl font-bold tabular-nums ${cfg.text} opacity-90`}
            >
              {totalWidth !== null ? `${totalWidth.toFixed(2)}m` : '--'}
            </p>
            {widthClearance && (
              <p className="text-gray-500 text-xs mt-1 font-mono">
                L: {widthClearance.leftM.toFixed(2)}m &nbsp;|&nbsp; R: {widthClearance.rightM.toFixed(2)}m
              </p>
            )}
          </div>

          {/* Width bar visualizer — driven from usableWidthAtHeights */}
          <div className="w-full max-w-xl" data-testid="width-bar-visualizer">
            <p className="text-gray-500 text-xs uppercase tracking-widest mb-2 text-center">
              Vehicle Width vs Available Road Width
              {primaryWidthEntry && (
                <span className="ml-1 opacity-60">@ {primaryWidthEntry.heightM.toFixed(1)}m height</span>
              )}
            </p>
            <div className="relative h-10 bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
              {/* Left clearance bar */}
              <div
                data-testid="width-bar-left"
                className="absolute left-0 top-0 bottom-0 bg-blue-500/40 border-r border-blue-400/60"
                style={{ width: `${leftBarPct}%` }}
              />
              {/* Right clearance bar */}
              <div
                data-testid="width-bar-right"
                className="absolute right-0 top-0 bottom-0 bg-blue-500/40 border-l border-blue-400/60"
                style={{ width: `${rightBarPct}%` }}
              />
              {/* Vehicle width marker centered */}
              <div
                data-testid="width-bar-vehicle"
                className={`absolute top-1 bottom-1 rounded ${colorState === 'red' ? 'bg-red-500/80' : 'bg-gray-400/80'}`}
                style={{
                  left: `calc(50% - ${vehiclePct / 2}%)`,
                  width: `${vehiclePct}%`,
                }}
              />
              {/* Center line */}
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-600" />
            </div>
            <div className="flex justify-between text-xs text-gray-600 mt-1 font-mono">
              <span>Left edge</span>
              <span>
                Vehicle ({VEHICLE_WIDTH_M}m){roadWidthFromHeights !== null && ` / Road (${roadWidthFromHeights.toFixed(1)}m)`}
              </span>
              <span>Right edge</span>
            </div>

            {barEntries.length > 1 && (
              <div className="mt-3 space-y-1" data-testid="width-at-heights-list">
                {barEntries.map((entry, i) => {
                  const pct = Math.min(100, (entry.widthM / Math.max(barScale, 1)) * 100);
                  const vPct = Math.min(100, (VEHICLE_WIDTH_M / Math.max(entry.widthM, 0.1)) * 100);
                  const tight = vPct > 80;
                  return (
                    <div key={i} className="flex items-center gap-2" data-testid={`width-at-height-${i}`}>
                      <span className="text-xs text-gray-500 font-mono w-14 shrink-0">
                        {entry.heightM.toFixed(1)}m
                      </span>
                      <div className="flex-1 h-3 bg-gray-800 rounded overflow-hidden">
                        <div
                          className={`h-full rounded ${tight ? 'bg-red-500/70' : 'bg-blue-400/60'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className={`text-xs font-mono w-12 text-right ${tight ? 'text-red-400' : 'text-gray-400'}`}>
                        {entry.widthM.toFixed(2)}m
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Alert messages */}
          {alerts.length > 0 && (
            <div className="w-full max-w-xl space-y-2" data-testid="alerts-section">
              {alerts.map((alert, i) => (
                <div
                  key={i}
                  data-testid={`alert-item-${i}`}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium ${
                    alert.severity === 'critical'
                      ? 'bg-red-900/50 border-red-500 text-red-300'
                      : 'bg-yellow-900/40 border-yellow-500 text-yellow-300'
                  }`}
                >
                  <span className="uppercase text-xs font-bold mr-2 opacity-70">{alert.severity}</span>
                  {alert.message}
                  {alert.distanceAheadM !== null && (
                    <span className="ml-2 text-xs opacity-60">@ {alert.distanceAheadM.toFixed(0)}m ahead</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Static Scan button */}
          <Button
            data-testid="button-static-scan"
            onClick={() => void startStaticScan()}
            disabled={!isConnected}
            className={`mt-2 px-8 py-3 text-base font-semibold gap-2 ${
              isConnected
                ? 'bg-white text-black hover:bg-gray-100'
                : 'bg-gray-800 text-gray-600 cursor-not-allowed'
            }`}
          >
            <Scan className="h-5 w-5" />
            Static Scan
          </Button>
        </div>
      )}

      {/* Bottom-right minimap */}
      {minimap && (
        <div
          data-testid="clearance-hud-minimap"
          className="absolute bottom-6 right-6 w-56 h-40 rounded-xl overflow-hidden border border-gray-700 shadow-2xl bg-gray-900"
        >
          {minimap}
        </div>
      )}
    </div>
  );
}
