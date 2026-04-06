/**
 * GNSSStatusCard - Real-time GNSS/IMU status display card
 * Shows comprehensive Duro GNSS data including:
 * - Position (lat, lon, alt)
 * - Motion (speed, heading)
 * - Quality metrics (satellites, HDOP, accuracy, fix quality)
 * - IMU/INS attitude (roll, pitch, yaw)
 * - Angular rates (optional, when available)
 * - Correction status (RTK age, correction type)
 */

import { useState, useEffect } from 'react';
import { 
  Satellite, Navigation, Compass, Activity, Signal, AlertTriangle, Check,
  Gauge, Clock, ArrowUp, RotateCcw, Zap, ChevronDown, ChevronUp, Terminal
} from 'lucide-react';
import { useGPSStore } from '@/lib/stores/gpsStore';

const BACKEND_URL_KEY = 'measurepro_gnss_backend_url';

interface AttitudeData {
  roll: number;
  pitch: number;
  yaw: number;
}

interface AngularRateData {
  roll: number;
  pitch: number;
  yaw: number;
}

interface GNSSStatus {
  connected?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  altitude?: number | null;
  speed?: number | null;
  heading?: number | null;
  satellites?: number | null;
  hdop?: number | null;
  vdop?: number | null;
  fixQuality?: 'none' | 'gps' | 'dgps' | 'pps' | 'rtk_float' | 'rtk_fixed' | 'estimated' | string;
  accuracy?: number | null;
  lastUpdate?: string | null;
  attitude?: AttitudeData | null;
  angularRate?: AngularRateData | null;
  insMode?: string | null;
  correctionAge_s?: number | null;
  correctionType?: string | null;
  geoidHeight_m?: number | null;
  source?: string | null;
}

const FixQualityBadge: React.FC<{ quality: GNSSStatus['fixQuality'] }> = ({ quality }) => {
  const configs: Record<string, { bg: string; text: string; label: string }> = {
    none: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'No Fix' },
    gps: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'GPS' },
    dgps: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'DGPS' },
    pps: { bg: 'bg-blue-600/20', text: 'text-blue-300', label: 'PPS' },
    rtk_float: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', label: 'RTK Float' },
    rtk_fixed: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'RTK Fixed' },
    estimated: { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'Estimated' },
  };

  const config = configs[quality ?? 'none'] ?? configs.none;

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`} data-testid="badge-fix-quality">
      {config.label}
    </span>
  );
};

const InsModeIndicator: React.FC<{ mode: string | null | undefined }> = ({ mode }) => {
  if (!mode) return null;
  
  const configs: Record<string, { bg: string; text: string }> = {
    inactive: { bg: 'bg-gray-500/20', text: 'text-gray-400' },
    aligning: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
    degraded: { bg: 'bg-orange-500/20', text: 'text-orange-400' },
    ready: { bg: 'bg-green-500/20', text: 'text-green-400' },
    rtk_aided: { bg: 'bg-cyan-500/20', text: 'text-cyan-400' },
    standalone: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  };
  
  const config = configs[mode.toLowerCase()] ?? configs.inactive;
  
  return (
    <span className={`px-2 py-0.5 ${config.bg} ${config.text} rounded text-xs`} data-testid="badge-ins-mode">
      INS: {mode}
    </span>
  );
};

const AttitudeIndicator: React.FC<{ 
  attitude: AttitudeData | null | undefined;
  angularRate?: AngularRateData | null;
}> = ({ attitude, angularRate }) => {
  if (!attitude) {
    return (
      <div className="text-center text-gray-500 text-sm py-2" data-testid="attitude-no-data">
        No IMU data
      </div>
    );
  }

  const formatAngle = (angle: number | null | undefined): string => {
    if (angle === null || angle === undefined) return '--';
    return `${angle >= 0 ? '+' : ''}${angle.toFixed(1)}°`;
  };

  const formatRate = (rate: number | null | undefined): string => {
    if (rate === null || rate === undefined) return '';
    return `${rate >= 0 ? '+' : ''}${rate.toFixed(1)}°/s`;
  };

  const getWarningClass = (angle: number, threshold: number): string => {
    const absAngle = Math.abs(angle);
    if (absAngle > threshold) return 'text-red-400';
    if (absAngle > threshold * 0.7) return 'text-yellow-400';
    return 'text-green-400';
  };

  return (
    <div className="grid grid-cols-3 gap-2 text-center" data-testid="attitude-display">
      <div className="bg-gray-800 rounded-lg p-2">
        <div className="text-xs text-gray-400 mb-1">Roll</div>
        <div className={`text-lg font-mono font-bold ${getWarningClass(attitude.roll, 15)}`} data-testid="value-roll">
          {formatAngle(attitude.roll)}
        </div>
        {angularRate && (
          <div className="text-xs text-gray-500 font-mono" data-testid="value-roll-rate">
            {formatRate(angularRate.roll)}
          </div>
        )}
      </div>
      <div className="bg-gray-800 rounded-lg p-2">
        <div className="text-xs text-gray-400 mb-1">Pitch</div>
        <div className={`text-lg font-mono font-bold ${getWarningClass(attitude.pitch, 20)}`} data-testid="value-pitch">
          {formatAngle(attitude.pitch)}
        </div>
        {angularRate && (
          <div className="text-xs text-gray-500 font-mono" data-testid="value-pitch-rate">
            {formatRate(angularRate.pitch)}
          </div>
        )}
      </div>
      <div className="bg-gray-800 rounded-lg p-2">
        <div className="text-xs text-gray-400 mb-1">Yaw</div>
        <div className="text-lg font-mono font-bold text-cyan-400" data-testid="value-yaw">
          {attitude.yaw !== null && attitude.yaw !== undefined ? `${attitude.yaw.toFixed(1)}°` : '--'}
        </div>
        {angularRate && (
          <div className="text-xs text-gray-500 font-mono" data-testid="value-yaw-rate">
            {formatRate(angularRate.yaw)}
          </div>
        )}
      </div>
    </div>
  );
};

const GNSSStatusCard: React.FC = () => {
  const { connected, data: gpsData } = useGPSStore();
  const [expanded, setExpanded] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [hasDuroUrl, setHasDuroUrl] = useState(false);
  const [duroUrl, setDuroUrl] = useState('');
  const [diagData, setDiagData] = useState<{
    counts: Record<string, number>;
    recent: Array<{ raw: string; type: string; timestamp: number }>;
  } | null>(null);

  useEffect(() => {
    try {
      const url = localStorage.getItem(BACKEND_URL_KEY) || '';
      setDuroUrl(url);
      setHasDuroUrl(!!url);
    } catch {
      setHasDuroUrl(false);
    }
  }, []);

  useEffect(() => {
    if (!showDiagnostics || !duroUrl) return;
    let cancelled = false;

    const fetchDiag = async () => {
      try {
        const base = duroUrl.replace(/\/$/, '');
        const res = await fetch(`${base}/api/gnss/live`, { signal: AbortSignal.timeout(2000) });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled && data?.sentences) {
          setDiagData({
            counts: data.sentences.counts ?? {},
            recent: (data.sentences.recent ?? []).slice(-3),
          });
        }
      } catch {
      }
    };

    fetchDiag();
    const id = setInterval(fetchDiag, 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [showDiagnostics, duroUrl]);

  const mapFixQuality = (fixQuality: string | undefined): GNSSStatus['fixQuality'] => {
    if (!fixQuality) return 'none';
    const normalized = fixQuality.toLowerCase().replace(/[_\s-]/g, '');
    switch (normalized) {
      case 'nofix':
      case 'none':
      case '':
      case '0':
        return 'none';
      case 'gpsfix':
      case 'gpsfix(2d)':
      case 'gps':
      case 'single':
      case '1':
        return 'gps';
      case 'dgpsfix':
      case 'dgps':
      case 'sbas':
      case '2':
        return 'dgps';
      case 'rtkfloat':
      case 'float':
      case '5':
        return 'rtk_float';
      case 'rtkfixed':
      case 'rtk':
      case 'fixed':
      case 'fixedrtk':
      case '4':
        return 'rtk_fixed';
      case 'estimated':
      case 'dead':
      case 'deadreckoning':
      case '6':
        return 'estimated';
      case 'pps':
      case '3':
        return 'pps';
      default:
        // Log unknown values for debugging, return none for safety
        console.warn('[GNSS] Unknown fix quality:', fixQuality);
        return 'none';
    }
  };

  // Guard against missing/undefined gpsData
  const status: GNSSStatus = {
    connected,
    latitude: gpsData?.latitude && gpsData.latitude !== 0 ? gpsData.latitude : null,
    longitude: gpsData?.longitude && gpsData.longitude !== 0 ? gpsData.longitude : null,
    altitude: gpsData?.altitude && gpsData.altitude !== 0 ? gpsData.altitude : null,
    speed: gpsData?.speed && gpsData.speed !== 0 ? gpsData.speed : null,
    heading: gpsData?.course && gpsData.course !== 0 ? gpsData.course : (gpsData?.heading ?? null),
    satellites: gpsData?.satellites ?? 0,
    hdop: gpsData?.hdop && gpsData.hdop !== 0 ? gpsData.hdop : null,
    fixQuality: mapFixQuality(gpsData?.fixQuality),
    lastUpdate: gpsData?.lastUpdate ? new Date(gpsData.lastUpdate).toISOString() : null,
    source: gpsData?.source && gpsData.source !== 'none' ? gpsData.source : null,
    attitude: gpsData?.imu ? {
      roll: gpsData.imu.roll ?? 0,
      pitch: gpsData.imu.pitch ?? 0,
      yaw: gpsData.imu.heading ?? 0
    } : null
  };

  const formatCoordinate = (value: number | null | undefined, type: 'lat' | 'lon'): string => {
    if (value === null || value === undefined) return '--';
    const direction = type === 'lat' 
      ? (value >= 0 ? 'N' : 'S')
      : (value >= 0 ? 'E' : 'W');
    return `${Math.abs(value).toFixed(6)}° ${direction}`;
  };

  const formatValue = (value: number | null | undefined, unit: string, decimals = 1): string => {
    if (value === null || value === undefined) return '--';
    return `${value.toFixed(decimals)} ${unit}`;
  };

  const formatSpeed = (speedMs: number | null | undefined): string => {
    if (speedMs === null || speedMs === undefined) return '--';
    const speedKmh = speedMs * 3.6;
    return `${speedKmh.toFixed(1)} km/h`;
  };

  const getTimeSinceUpdate = (): string => {
    if (!status.lastUpdate) return 'Never';
    const diff = Date.now() - new Date(status.lastUpdate).getTime();
    if (diff < 1000) return 'Just now';
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    return `${Math.floor(diff / 60000)}m ago`;
  };

  const getCorrectionAgeColor = (age: number | null | undefined): string => {
    if (age === null || age === undefined) return 'text-gray-400';
    if (age < 5) return 'text-green-400';
    if (age < 30) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-4" data-testid="gnss-status-card">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Satellite className={`w-5 h-5 ${status.connected ? 'text-green-400' : 'text-red-400'}`} />
          GNSS Status
          {status.source && (
            <span className="text-xs text-gray-400 font-normal">({status.source})</span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          <FixQualityBadge quality={status.fixQuality} />
          <InsModeIndicator mode={status.insMode} />
          {status.connected ? (
            <Check className="w-4 h-4 text-green-400" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-400" />
          )}
        </div>
      </div>

      {/* Position */}
      <div className="bg-gray-900 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
          <Navigation className="w-4 h-4" />
          Position
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-400">Lat:</span>
            <span className="ml-2 text-white font-mono" data-testid="value-latitude">
              {formatCoordinate(status.latitude, 'lat')}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Lon:</span>
            <span className="ml-2 text-white font-mono" data-testid="value-longitude">
              {formatCoordinate(status.longitude, 'lon')}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Alt:</span>
            <span className="ml-2 text-white font-mono" data-testid="value-altitude">
              {formatValue(status.altitude, 'm')}
            </span>
          </div>
          <div className="flex items-center">
            <Gauge className="w-3 h-3 text-gray-400 mr-1" />
            <span className="text-gray-400">Speed:</span>
            <span className="ml-2 text-white font-mono" data-testid="value-speed">
              {formatSpeed(status.speed)}
            </span>
          </div>
        </div>
      </div>

      {/* Quality Metrics */}
      <div className="grid grid-cols-4 gap-2 text-center text-sm">
        <div className="bg-gray-900 rounded-lg p-2">
          <div className="text-xs text-gray-400">Sats</div>
          <div className="text-lg font-bold flex items-center justify-center gap-1" data-testid="value-satellites">
            <Signal className="w-3 h-3 text-blue-400" />
            <span className={(status.satellites ?? 0) >= 8 ? 'text-green-400' : (status.satellites ?? 0) >= 4 ? 'text-yellow-400' : 'text-red-400'}>
              {status.satellites ?? 0}
            </span>
          </div>
        </div>
        <div className="bg-gray-900 rounded-lg p-2">
          <div className="text-xs text-gray-400">HDOP</div>
          <div className={`text-lg font-bold font-mono ${
            status.hdop != null && status.hdop <= 1 ? 'text-green-400' : 
            status.hdop != null && status.hdop <= 2 ? 'text-yellow-400' : 'text-red-400'
          }`} data-testid="value-hdop">
            {status.hdop != null ? status.hdop.toFixed(1) : '--'}
          </div>
        </div>
        <div className="bg-gray-900 rounded-lg p-2">
          <div className="text-xs text-gray-400">Accuracy</div>
          <div className="text-lg font-bold font-mono text-white" data-testid="value-accuracy">
            {status.accuracy != null ? `${status.accuracy.toFixed(1)}m` : '--'}
          </div>
        </div>
        <div className="bg-gray-900 rounded-lg p-2">
          <div className="text-xs text-gray-400">Heading</div>
          <div className="text-lg font-bold font-mono text-white flex items-center justify-center gap-1" data-testid="value-heading">
            <Compass className="w-3 h-3 text-cyan-400" />
            {status.heading != null ? `${status.heading.toFixed(0)}°` : '--'}
          </div>
        </div>
      </div>

      {/* Correction Status (when available) */}
      {(status.correctionAge_s != null || status.correctionType) && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          {status.correctionType && (
            <div className="bg-gray-900 rounded-lg p-2 flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              <div>
                <div className="text-xs text-gray-400">Correction</div>
                <div className="font-mono text-white">{status.correctionType.toUpperCase()}</div>
              </div>
            </div>
          )}
          {status.correctionAge_s != null && (
            <div className="bg-gray-900 rounded-lg p-2 flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <div>
                <div className="text-xs text-gray-400">Correction Age</div>
                <div className={`font-mono ${getCorrectionAgeColor(status.correctionAge_s)}`}>
                  {status.correctionAge_s.toFixed(1)}s
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Attitude (IMU) */}
      <div className="bg-gray-900 rounded-lg p-3">
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          Attitude (IMU)
          {status.angularRate && (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <RotateCcw className="w-3 h-3" /> with rates
            </span>
          )}
        </div>
        <AttitudeIndicator attitude={status.attitude} angularRate={status.angularRate} />
      </div>

      {/* Expanded: Additional Data */}
      {expanded && (
        <div className="bg-gray-900 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
            <ArrowUp className="w-4 h-4" />
            Extended Data
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {gpsData?.pdop != null && (
              <div>
                <span className="text-gray-400">PDOP:</span>
                <span className="ml-2 text-white font-mono" data-testid="value-pdop">{gpsData.pdop.toFixed(1)}</span>
              </div>
            )}
            {gpsData?.vdop != null && (
              <div>
                <span className="text-gray-400">VDOP:</span>
                <span className="ml-2 text-white font-mono" data-testid="value-vdop">{gpsData.vdop.toFixed(1)}</span>
              </div>
            )}
            {gpsData?.satellitesInView != null && (
              <div>
                <span className="text-gray-400">Sats in View:</span>
                <span className="ml-2 text-white font-mono" data-testid="value-sats-in-view">{gpsData.satellitesInView}</span>
              </div>
            )}
            {status.geoidHeight_m !== null && status.geoidHeight_m !== undefined && (
              <div>
                <span className="text-gray-400">Geoid:</span>
                <span className="ml-2 text-white font-mono">{status.geoidHeight_m.toFixed(1)}m</span>
              </div>
            )}
          </div>
          {gpsData?.constellations && Object.keys(gpsData.constellations).length > 0 && (
            <div className="text-sm space-y-1">
              <span className="text-gray-400 text-xs">Active by constellation (GSA):</span>
              <div className="grid grid-cols-2 gap-1">
                {Object.entries(gpsData.constellations).map(([id, c]) => (
                  <div key={id} className="flex justify-between text-xs" data-testid={`value-constellation-${id}`}>
                    <span className="text-gray-500">{c.name}:</span>
                    <span className="font-mono text-gray-300">{c.activePrns.length} sats</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {gpsData?.activeSatellitePrns && gpsData.activeSatellitePrns.length > 0 && (!gpsData.constellations || Object.keys(gpsData.constellations).length === 0) && (
            <div className="text-sm">
              <span className="text-gray-400">Active PRNs (GSA): </span>
              <span className="font-mono text-xs text-gray-300" data-testid="value-active-prns">
                {gpsData.activeSatellitePrns.join(', ')}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Raw NMEA Diagnostics — only when connected with a Duro bridge URL configured */}
      {hasDuroUrl && connected && (
        <div className="bg-gray-900 rounded-lg overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            data-testid="button-toggle-diagnostics"
          >
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-purple-400" />
              <span>Diagnostics</span>
              {diagData && Object.keys(diagData.counts).length > 0 && (
                <span className="text-xs px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                  {Object.keys(diagData.counts).length} types
                </span>
              )}
            </div>
            {showDiagnostics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showDiagnostics && (
            <div className="px-3 pb-3 space-y-2">
              {!diagData || Object.keys(diagData.counts).length === 0 ? (
                <div className="text-xs text-gray-500 italic py-1" data-testid="text-no-nmea">
                  No NMEA sentences received yet
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-1.5" data-testid="nmea-sentence-counts">
                    {Object.entries(diagData.counts).map(([type, count]) => (
                      <span key={type} className="bg-gray-800 px-2 py-0.5 rounded text-xs">
                        <span className="text-blue-400 font-mono">{type}</span>
                        <span className="text-gray-500 ml-1">×{count}</span>
                      </span>
                    ))}
                  </div>
                  {diagData.recent.length > 0 && (
                    <div className="bg-black rounded p-2 font-mono text-xs space-y-0.5" data-testid="nmea-recent-sentences">
                      {diagData.recent.map((sentence, i) => (
                        <div key={i} className="text-green-400 truncate" data-testid={`nmea-line-${i}`}>
                          {sentence.raw}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Last Update & Toggle */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <button 
          onClick={() => setExpanded(!expanded)}
          className="hover:text-gray-300 transition-colors"
          data-testid="button-toggle-details"
        >
          {expanded ? 'Less details' : 'More details'}
        </button>
        <div className="flex items-center gap-2">
          <span>Last: {getTimeSinceUpdate()}</span>
          {status.lastUpdate && (
            <span className="font-mono">{new Date(status.lastUpdate).toLocaleTimeString()}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default GNSSStatusCard;
