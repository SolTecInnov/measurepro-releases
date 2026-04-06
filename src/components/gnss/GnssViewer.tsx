/**
 * GNSS Viewer Component
 * Real-time display of GPS/GNSS data with quality indicators
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Satellite, MapPin, Navigation, Signal, Clock } from 'lucide-react';
import type { GnssSample, FixQuality, CorrectionType } from '../../../server/gnss/types';

interface GnssViewerProps {
  sample: GnssSample | null;
  isConnected: boolean;
  duroConnected?: boolean;
  fixQuality?: 'rtk_fixed' | 'rtk_float' | 'dgps' | 'gps' | 'none';
  dataSource?: 'duro' | 'usb' | 'browser' | null;
  diagnosticSats?: number | null;
  diagnosticHdop?: number | null;
}

const FIX_QUALITY_COLORS: Record<FixQuality, string> = {
  rtk_fixed: 'bg-green-500',
  rtk_float: 'bg-yellow-500',
  dgps: 'bg-blue-500',
  gps: 'bg-orange-500',
  pps: 'bg-purple-500',
  estimated: 'bg-gray-500',
  manual: 'bg-gray-400',
  none: 'bg-red-500',
};

const FIX_QUALITY_LABELS: Record<FixQuality, string> = {
  rtk_fixed: 'RTK Fixed',
  rtk_float: 'RTK Float',
  dgps: 'DGPS',
  gps: 'GPS',
  pps: 'PPS',
  estimated: 'Estimated',
  manual: 'Manual',
  none: 'No Fix',
};

const SOURCE_LABELS = {
  duro: 'Duro',
  usb: 'USB',
  browser: 'Browser',
};

const CORRECTION_TYPE_LABELS: Record<CorrectionType, string> = {
  rtk: 'RTK',
  ppp: 'PPP',
  ppk: 'PPK',
  sbas: 'SBAS',
  none: 'Standalone',
};

export function GnssViewer({ sample, isConnected, duroConnected, fixQuality, dataSource, diagnosticSats, diagnosticHdop }: GnssViewerProps) {
  const formatCoordinate = (value: number, isLat: boolean): string => {
    const abs = Math.abs(value);
    const deg = Math.floor(abs);
    const min = (abs - deg) * 60;
    const dir = isLat ? (value >= 0 ? 'N' : 'S') : (value >= 0 ? 'E' : 'W');
    return `${deg}° ${min.toFixed(6)}' ${dir}`;
  };

  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString();
    } catch {
      return '--:--:--';
    }
  };

  const getTimeSinceUpdate = (): string => {
    if (!sample) return 'Never';
    try {
      const now = Date.now();
      const sampleTime = new Date(sample.timestamp).getTime();
      const diff = Math.floor((now - sampleTime) / 1000);
      if (diff < 5) return 'Just now';
      if (diff < 60) return `${diff}s ago`;
      return `${Math.floor(diff / 60)}m ago`;
    } catch {
      return 'Unknown';
    }
  };

  // Use prop fixQuality if available (works even without valid position), else fall back to sample
  const effectiveFixQuality = fixQuality ?? sample?.quality ?? 'none';
  const fixQualityColor = FIX_QUALITY_COLORS[effectiveFixQuality];
  const fixQualityLabel = FIX_QUALITY_LABELS[effectiveFixQuality];
  
  // Use prop dataSource if available (works even without valid position), else fall back to sample
  const effectiveDataSource = dataSource ?? sample?.source ?? null;

  return (
    <Card className="w-full" data-testid="card-gnss-viewer">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            <Satellite className="h-5 w-5" />
            <span>Live GNSS Data</span>
          </div>
          <div className="flex items-center gap-2 text-sm font-normal">
            <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} data-testid="indicator-ws-connection" />
            <span className="text-gray-400">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Fix Quality & Source */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-400 mb-1">Fix Quality</div>
            <div className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${fixQualityColor}`} data-testid="indicator-fix-quality" />
              <span className="font-medium" data-testid="text-fix-quality">{fixQualityLabel}</span>
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-400 mb-1">Source</div>
            <div className="font-medium" data-testid="text-gnss-source">
              {effectiveDataSource ? SOURCE_LABELS[effectiveDataSource] : '--'}
              {effectiveDataSource === 'duro' && (
                <span className={`ml-2 text-xs ${duroConnected ? 'text-green-500' : 'text-red-500'}`}>
                  ({duroConnected ? 'TCP OK' : 'TCP Down'})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Correction Type */}
        {sample?.correctionType && sample.correctionType !== 'none' && (
          <div>
            <div className="text-sm text-gray-400 mb-1">Correction</div>
            <div className="inline-flex items-center gap-2 px-2 py-1 bg-blue-900/30 rounded text-blue-400 text-sm" data-testid="badge-correction-type">
              {CORRECTION_TYPE_LABELS[sample.correctionType]}
              {sample.correctionAge_s !== undefined && sample.correctionAge_s !== null && (
                <span className="text-xs">({sample.correctionAge_s.toFixed(1)}s)</span>
              )}
            </div>
          </div>
        )}

        {/* Connected but no GPS fix yet */}
        {isConnected && !sample && (
          <div className="border-t border-gray-700 pt-3" data-testid="status-waiting-fix">
            <div className="flex items-center gap-2 text-sm text-yellow-400 animate-pulse">
              <Clock className="h-4 w-4" />
              <span>Connected — waiting for GPS fix…</span>
            </div>
          </div>
        )}

        {/* Position */}
        <div className="space-y-2 border-t border-gray-700 pt-3">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <MapPin className="h-4 w-4" />
            <span>Position</span>
          </div>
          <div className="grid grid-cols-1 gap-1 text-sm ml-6">
            <div data-testid="text-latitude">
              <span className="text-gray-400">Lat:</span> <span className="font-mono">{sample ? formatCoordinate(sample.latitude, true) : '--'}</span>
            </div>
            <div data-testid="text-longitude">
              <span className="text-gray-400">Lon:</span> <span className="font-mono">{sample ? formatCoordinate(sample.longitude, false) : '--'}</span>
            </div>
            <div data-testid="text-altitude">
              <span className="text-gray-400">Alt:</span> <span className="font-mono">{sample && sample.altitude !== null ? `${sample.altitude.toFixed(2)} m` : '--'}</span>
            </div>
          </div>
        </div>

        {/* Motion */}
        <div className="space-y-2 border-t border-gray-700 pt-3">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Navigation className="h-4 w-4" />
            <span>Motion</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm ml-6">
            <div data-testid="text-speed">
              <span className="text-gray-400">Speed:</span> <span className="font-mono">{sample && sample.speed !== null ? `${(sample.speed * 3.6).toFixed(1)} km/h` : '--'}</span>
            </div>
            <div data-testid="text-heading">
              <span className="text-gray-400">Heading:</span> <span className="font-mono">{sample && sample.heading !== null ? `${sample.heading.toFixed(1)}°` : '--'}</span>
            </div>
          </div>
        </div>

        {/* Signal Quality */}
        <div className="space-y-2 border-t border-gray-700 pt-3">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Signal className="h-4 w-4" />
            <span>Signal Quality</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm ml-6">
            <div data-testid="text-satellites">
              <span className="text-gray-400">Sats:</span> <span className="font-mono">{sample?.num_sats ?? diagnosticSats ?? '--'}</span>
            </div>
            <div data-testid="text-hdop">
              <span className="text-gray-400">HDOP:</span> <span className="font-mono">{sample?.hdop != null ? sample.hdop.toFixed(2) : diagnosticHdop != null ? diagnosticHdop.toFixed(2) : '--'}</span>
            </div>
            <div data-testid="text-stddev">
              <span className="text-gray-400">StdDev:</span> <span className="font-mono">{sample?.stdDev_m?.toFixed(3) ?? '--'}m</span>
            </div>
          </div>
        </div>

        {/* Last Update */}
        <div className="flex items-center gap-2 text-xs text-gray-500 border-t border-gray-700 pt-2">
          <Clock className="h-3 w-3" />
          <span>Last update: {sample ? formatTimestamp(sample.timestamp) : '--'}</span>
          <span className="ml-auto" data-testid="text-time-since-update">({getTimeSinceUpdate()})</span>
        </div>
      </CardContent>
    </Card>
  );
}
