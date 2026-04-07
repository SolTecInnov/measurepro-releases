import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Satellite, 
  Play, 
  Square, 
  RefreshCw, 
  Wifi, 
  WifiOff,
  MapPin,
  Clock,
  Activity,
  ChevronDown,
  ChevronUp,
  Navigation
} from 'lucide-react';
import { duroGpsService } from '@/lib/gnss/duroGpsService';
import { useGPSStore } from '@/lib/stores/gpsStore';
import { toast } from 'sonner';

interface NmeaSentence {
  timestamp: number;
  raw: string;
  type: string;
}

interface Position {
  timestamp: number;
  lat: number;
  lon: number;
  altitude: number;
  fixQuality: number;
  satellites: number;
  raw: string;
}

interface ImuData {
  timestamp: number;
  heading: number | null;
  roll: number | null;
  pitch: number | null;
  heaveRate: number | null;
  rollAccuracy?: number | null;
  pitchAccuracy?: number | null;
  headingAccuracy?: number | null;
}

interface VelocityData {
  timestamp: number;
  speedKnots: number | null;
  speedMps: number | null;
  speedKph: number | null;
  heading: number | null;
}

interface LiveData {
  success: boolean;
  connection: {
    connected: boolean;
    host: string;
    port: number;
    uptimeSec: number;
    totalSamples: number;
  };
  position: Position | null;
  imu: ImuData | null;
  velocity: VelocityData | null;
  sentences: {
    bufferSize: number;
    counts: Record<string, number>;
    recent: NmeaSentence[];
  };
}

const BACKEND_URL_KEY = 'measurepro_gnss_backend_url';

export function DuroLiveDataViewer() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [liveData, setLiveData] = useState<LiveData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [backendUrl, setBackendUrl] = useState<string>('');
  const [duroGpsEnabled, setDuroGpsEnabled] = useState(false);
  
  const gpsData = useGPSStore((s) => s.data);
  const gpsConnected = useGPSStore((s) => s.connected);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(BACKEND_URL_KEY) || '';
      setBackendUrl(stored);
    } catch {
      setBackendUrl('');
    }
  }, []);

  const buildApiUrl = (path: string): string => {
    if (backendUrl) {
      const base = backendUrl.replace(/\/$/, '');
      return `${base}${path}`;
    }
    return path;
  };

  const fetchLiveData = useCallback(async () => {
    // Don't fetch if no backend URL is configured
    if (!backendUrl) {
      setError(null);
      setLiveData(null);
      return;
    }
    try {
      const url = buildApiUrl('/api/gnss/live');
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setLiveData(data);
        setError(null);
      } else {
        setError('Failed to fetch data');
      }
    } catch (err: any) {
      // Silently fail when backend is not available - expected when bridge isn't running
      setError('Connection failed - ensure local bridge is running');
    }
  }, [backendUrl]);

  useEffect(() => {
    if (isStreaming) {
      fetchLiveData();
      const interval = setInterval(fetchLiveData, 500);
      return () => clearInterval(interval);
    }
  }, [isStreaming, fetchLiveData]);

  const formatTime = (ts: number): string => {
    return new Date(ts).toLocaleTimeString();
  };

  const getFixQualityText = (fix: number): string => {
    switch (fix) {
      case 0: return 'No Fix';
      case 1: return 'GPS Fix';
      case 2: return 'DGPS';
      case 4: return 'RTK Fixed';
      case 5: return 'RTK Float';
      default: return `Fix ${fix}`;
    }
  };

  const getFixQualityColor = (fix: number): string => {
    switch (fix) {
      case 0: return 'text-red-400';
      case 1: return 'text-yellow-400';
      case 2: return 'text-blue-400';
      case 4: return 'text-green-400';
      case 5: return 'text-green-300';
      default: return 'text-gray-400';
    }
  };

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Satellite className="w-5 h-5 text-green-400" />
            Duro Live Data Viewer
          </CardTitle>
          <div className="flex items-center gap-2">
            {liveData?.connection?.connected ? (
              <Wifi className="w-4 h-4 text-green-400" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-400" />
            )}
            <Button
              size="sm"
              variant={isStreaming ? 'destructive' : 'default'}
              onClick={() => setIsStreaming(!isStreaming)}
              data-testid="button-toggle-streaming"
            >
              {isStreaming ? (
                <>
                  <Square className="w-4 h-4 mr-1" /> Stop
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-1" /> Start
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={fetchLiveData}
              data-testid="button-refresh-data"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && backendUrl && (
          <div className="bg-red-500/20 text-red-400 px-3 py-2 rounded text-sm">
            {error}
          </div>
        )}

        {!backendUrl && (
          <div className="bg-blue-500/20 text-blue-300 px-3 py-2 rounded text-sm">
            <strong>No Duro bridge configured.</strong> Set a Backend URL above (e.g., <code className="bg-gray-700 px-1 rounded">http://localhost:8765</code>) when running the local bridge.
          </div>
        )}

        {/* Use Duro as GPS Source Toggle */}
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Navigation className="w-5 h-5 text-green-400" />
              <div>
                <h4 className="font-semibold text-green-200">Use Duro as GPS Source</h4>
                <p className="text-xs text-green-300/70">
                  Feed Duro position data to the app's GPS system for surveys & POI logging
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant={duroGpsEnabled ? 'destructive' : 'default'}
              onClick={() => {
                if (duroGpsEnabled) {
                  duroGpsService.stop();
                  setDuroGpsEnabled(false);
                  // toast suppressed
                } else {
                  if (!backendUrl) {
                    toast.error('Set Backend URL first');
                    return;
                  }
                  // Electron: use direct TCP
                  if ((window as any).electronAPI?.duro) {
                    let host = '192.168.0.222', port = 2101;
                    try {
                      const cfg = JSON.parse(localStorage.getItem('gnss_config') || '{}');
                      if (cfg.host) host = cfg.host;
                      if (cfg.nmeaPort) port = cfg.nmeaPort;
                    } catch(e) {}
                    duroGpsService.start({ host, port });
                  } else {
                    duroGpsService.start();
                  }
                  setDuroGpsEnabled(true);
                  // toast suppressed
                }
              }}
              data-testid="button-toggle-duro-gps"
            >
              {duroGpsEnabled ? 'Disable' : 'Enable'}
            </Button>
          </div>
          
          {duroGpsEnabled && gpsConnected && gpsData.source === 'duro' && (
            <div className="mt-3 pt-3 border-t border-green-500/30 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-green-400">Lat:</span>
                <span className="ml-1 font-mono text-white">{gpsData.latitude.toFixed(6)}</span>
              </div>
              <div>
                <span className="text-green-400">Lon:</span>
                <span className="ml-1 font-mono text-white">{gpsData.longitude.toFixed(6)}</span>
              </div>
              <div>
                <span className="text-green-400">Fix:</span>
                <span className="ml-1 text-white">{gpsData.fixQuality}</span>
              </div>
              <div>
                <span className="text-green-400">Sats:</span>
                <span className="ml-1 text-white">{gpsData.satellites}</span>
              </div>
            </div>
          )}
        </div>

        {liveData && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-gray-900 rounded-lg p-3">
                <div className="text-xs text-gray-400">Status</div>
                <div className={`text-lg font-bold ${liveData.connection.connected ? 'text-green-400' : 'text-red-400'}`}>
                  {liveData.connection.connected ? 'Connected' : 'Disconnected'}
                </div>
              </div>
              <div className="bg-gray-900 rounded-lg p-3">
                <div className="text-xs text-gray-400">Samples</div>
                <div className="text-lg font-bold text-white">
                  {liveData.connection.totalSamples.toLocaleString()}
                </div>
              </div>
              <div className="bg-gray-900 rounded-lg p-3">
                <div className="text-xs text-gray-400">Uptime</div>
                <div className="text-lg font-bold text-white">
                  {Math.floor(liveData.connection.uptimeSec / 60)}m {liveData.connection.uptimeSec % 60}s
                </div>
              </div>
              <div className="bg-gray-900 rounded-lg p-3">
                <div className="text-xs text-gray-400">Buffer</div>
                <div className="text-lg font-bold text-white">
                  {liveData.sentences.bufferSize}
                </div>
              </div>
            </div>

            {liveData.position && (
              <div className="bg-gray-900 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-4 h-4 text-blue-400" />
                  <span className="font-semibold">Current Position</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${getFixQualityColor(liveData.position.fixQuality)}`}>
                    {getFixQualityText(liveData.position.fixQuality)}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-gray-400">Latitude:</span>
                    <span className="ml-2 font-mono text-white">{liveData.position.lat.toFixed(7)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Longitude:</span>
                    <span className="ml-2 font-mono text-white">{liveData.position.lon.toFixed(7)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Altitude:</span>
                    <span className="ml-2 font-mono text-white">{liveData.position.altitude.toFixed(1)}m</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Satellites:</span>
                    <span className="ml-2 font-mono text-white">{liveData.position.satellites}</span>
                  </div>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  <Clock className="w-3 h-3 inline mr-1" />
                  Last update: {formatTime(liveData.position.timestamp)}
                </div>
              </div>
            )}

            {/* IMU/Attitude Data */}
            {liveData.imu && (
              <div className="bg-gray-900 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="w-4 h-4 text-orange-400" />
                  <span className="font-semibold">IMU / Attitude Data</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-orange-500/20 text-orange-400">PASHR</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-gray-400">Heading:</span>
                    <span className="ml-2 font-mono text-white">
                      {liveData.imu.heading !== null ? `${liveData.imu.heading.toFixed(1)}°` : '--'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Roll:</span>
                    <span className="ml-2 font-mono text-white">
                      {liveData.imu.roll !== null ? `${liveData.imu.roll.toFixed(2)}°` : '--'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Pitch:</span>
                    <span className="ml-2 font-mono text-white">
                      {liveData.imu.pitch !== null ? `${liveData.imu.pitch.toFixed(2)}°` : '--'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Heave Rate:</span>
                    <span className="ml-2 font-mono text-white">
                      {liveData.imu.heaveRate !== null ? `${liveData.imu.heaveRate.toFixed(3)} m/s` : '--'}
                    </span>
                  </div>
                </div>
                {liveData.imu.headingAccuracy && (
                  <div className="mt-2 text-xs text-gray-500">
                    Accuracy - Heading: ±{liveData.imu.headingAccuracy?.toFixed(1)}°, 
                    Roll: ±{liveData.imu.rollAccuracy?.toFixed(1)}°, 
                    Pitch: ±{liveData.imu.pitchAccuracy?.toFixed(1)}°
                  </div>
                )}
              </div>
            )}

            {/* Velocity Data */}
            {liveData.velocity && (
              <div className="bg-gray-900 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Navigation className="w-4 h-4 text-cyan-400" />
                  <span className="font-semibold">Velocity Data</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400">RMC</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-gray-400">Speed:</span>
                    <span className="ml-2 font-mono text-white">
                      {liveData.velocity.speedKph !== null ? `${liveData.velocity.speedKph.toFixed(1)} km/h` : '--'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Speed (m/s):</span>
                    <span className="ml-2 font-mono text-white">
                      {liveData.velocity.speedMps !== null ? `${liveData.velocity.speedMps.toFixed(2)} m/s` : '--'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Course:</span>
                    <span className="ml-2 font-mono text-white">
                      {liveData.velocity.heading !== null ? `${liveData.velocity.heading.toFixed(1)}°` : '--'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Speed (knots):</span>
                    <span className="ml-2 font-mono text-white">
                      {liveData.velocity.speedKnots !== null ? `${liveData.velocity.speedKnots.toFixed(1)} kn` : '--'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-gray-900 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-400" />
                  <span className="font-semibold">NMEA Sentences</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowRaw(!showRaw)}
                  className="text-xs"
                  data-testid="button-toggle-raw"
                >
                  {showRaw ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {showRaw ? 'Hide Raw' : 'Show Raw'}
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                {Object.entries(liveData.sentences.counts).map(([type, count]) => (
                  <span key={type} className="bg-gray-800 px-2 py-1 rounded text-xs">
                    <span className="text-blue-400 font-mono">{type}</span>
                    <span className="text-gray-400 ml-1">×{count}</span>
                  </span>
                ))}
              </div>

              {showRaw && (
                <div className="bg-black rounded p-2 max-h-48 overflow-y-auto font-mono text-xs">
                  {liveData.sentences.recent.map((sentence, i) => (
                    <div key={i} className="text-green-400 hover:bg-gray-800 px-1">
                      <span className="text-gray-600 mr-2">{formatTime(sentence.timestamp)}</span>
                      {sentence.raw}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {!liveData && !error && !isStreaming && (
          <div className="text-center py-8 text-gray-400">
            Click <strong>Start</strong> to begin streaming live data from Duro
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default DuroLiveDataViewer;
