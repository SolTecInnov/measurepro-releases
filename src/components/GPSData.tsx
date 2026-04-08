import React from 'react';
import { Navigation, Clock, Compass, Gauge, Satellite, Signal, Terminal, Ruler, MapPin, Crosshair, AlertTriangle, Settings, WifiOff } from 'lucide-react';
import { useGPSStore } from '../lib/stores/gpsStore';
import { useSerialStore } from '../lib/stores/serialStore';
import { duroGpsService } from '../lib/gnss/duroGpsService';
import { getAuth } from 'firebase/auth';
import { isBetaUser } from '../lib/auth/masterAdmin';
import { useEnabledFeatures } from '../hooks/useLicenseEnforcement';

const GPS_SIGNAL_TIMEOUT_MS = 10_000; // 10 seconds

const GPSData: React.FC = () => {
  const { data, connected, failsafeEnabled, setFailsafeEnabled } = useGPSStore();
  const { gpsPort, gpsConfig, setGPSConfig } = useSerialStore();
  
  // Beta user detection for UI simplification
  const { features } = useEnabledFeatures();
  const auth = getAuth();
  const isBeta = isBetaUser(auth.currentUser, features);
  const [showRawData, setShowRawData] = React.useState(false);
  const [showSettings, setShowSettings] = React.useState(true); // Show settings by default to make failsafe visible
  const [displayUnits, setDisplayUnits] = React.useState<'metric' | 'imperial'>('metric');
  const [now, setNow] = React.useState(() => Date.now());
  const [bridgeUnreachable, setBridgeUnreachable] = React.useState(() => duroGpsService.bridgeUnreachable);

  // Tick every second so the stale data warning updates in real-time
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Subscribe to Duro bridge reachability changes
  React.useEffect(() => {
    return duroGpsService.onBridgeUnreachableChange(setBridgeUnreachable);
  }, []);

  // Show "GPS signal lost" warning when data has not updated for > 10s AND source is active (not 'none')
  const dataAge = now - data.lastUpdate;
  const isSignalLost = data.source !== 'none' && data.lastUpdate > 0 && dataAge > GPS_SIGNAL_TIMEOUT_MS;

  // Check if GPS hardware is connected (serial or browser)
  const isHardwareConnected = (gpsPort !== null && connected) || data.source === 'browser';
  
  // Check if we have valid position data (from serial GPS with fix OR from device GPS)
  const hasValidPosition = (data.latitude !== 0 && data.longitude !== 0);
  
  // Check if we have a full GPS fix (only for serial GPS)
  const hasGPSFix = hasValidPosition && data.fixQuality !== 'No Fix';
  
  // Helper function to format coordinate display
  const formatCoordinate = (value: number, isLat: boolean): string => {
    if (!hasValidPosition || value === 0) return '--°';
    return `${Math.abs(value).toFixed(6)}°${isLat ? (value >= 0 ? 'N' : 'S') : (value >= 0 ? 'E' : 'W')}`;
  };

  // Helper function to format numeric values
  const formatValue = (value: number, decimals: number, unit: string = ''): string => {
    if (!hasValidPosition || value === 0) return '--' + (unit ? unit : '');
    return value.toFixed(decimals) + unit;
  };

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Navigation className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-semibold">GPS Data</h2>
          <button
            onClick={() => setDisplayUnits(prev => prev === 'metric' ? 'imperial' : 'metric')}
            className="ml-2 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded"
          >
            {displayUnits === 'metric' ? 'km/h' : 'knots'}
          </button>
          <button
            onClick={() => setShowRawData(!showRawData)}
            className={`ml-2 p-1 rounded ${showRawData ? 'bg-blue-500' : 'bg-gray-700'}`}
            title="Show Raw NMEA Data"
          >
            <Terminal className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`ml-2 p-1 rounded ${showSettings ? 'bg-blue-500' : 'bg-gray-700'}`}
            title="GPS Configuration"
            data-testid="button-gps-settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className={`h-2.5 w-2.5 rounded-full ${
            hasGPSFix ? 'bg-green-500' : 
            hasValidPosition ? 'bg-blue-500' : 
            isHardwareConnected ? 'bg-yellow-500 animate-pulse' : 
            'bg-red-500'
          }`} />
          <span className="text-sm">
            {hasGPSFix ? 'GPS Fix' : 
             hasValidPosition ? `Failsafe (${data.source})` :
             isHardwareConnected ? 'Waiting for satellites...' : 
             'Disconnected'}
          </span>
        </div>
      </div>

      {/* ── Duro Bridge Unreachable Warning ── */}
      {bridgeUnreachable && (
        <div className="flex items-center justify-between gap-2 bg-orange-500/20 border border-orange-500/50 rounded-lg px-3 py-2 mb-3" data-testid="status-bridge-unreachable">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-orange-400 flex-shrink-0" />
            <span className="text-sm text-orange-300 font-medium">Bridge unreachable — check Duro bridge is running</span>
          </div>
          <button
            onClick={() => { duroGpsService.fetchAndUpdate(); }}
            className="text-xs text-orange-300 hover:text-orange-100 underline flex-shrink-0"
            data-testid="button-bridge-retry"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── GPS Signal Lost Warning ── */}
      {isSignalLost && (
        <div className="flex items-center gap-2 bg-yellow-500/20 border border-yellow-500/50 rounded-lg px-3 py-2 mb-3" data-testid="status-gps-signal-lost">
          <WifiOff className="w-4 h-4 text-yellow-400 flex-shrink-0" />
          <span className="text-sm text-yellow-300 font-medium">GPS signal lost — no data for {Math.floor(dataAge / 1000)}s</span>
        </div>
      )}

      {showSettings && (
        <div className="mt-4 bg-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">GPS Configuration</h3>
          
          {/* GPS Failsafe Setting */}
          <div className="mb-4 p-3 bg-blue-900/20 border border-blue-800/30 rounded-lg">
            <label className="flex items-center gap-2" data-testid="checkbox-gps-failsafe">
              <input
                type="checkbox"
                checked={failsafeEnabled}
                onChange={(e) => setFailsafeEnabled(e.target.checked)}
                className="rounded border-gray-600"
                data-testid="input-gps-failsafe"
              />
              <span className="text-sm text-gray-300">Enable Device GPS Failsafe</span>
            </label>
            <p className="text-xs text-gray-400 mt-1 ml-6">
              Automatically use device GPS when serial GPS is unavailable
            </p>
          </div>
          
          {/* Serial Settings - hidden for beta users */}
          {!isBeta && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Baud Rate</label>
                  <select
                    value={gpsConfig.baudRate}
                    onChange={(e) => setGPSConfig({ ...gpsConfig, baudRate: parseInt(e.target.value) })}
                    className="w-full px-2 py-1 bg-gray-800 border border-gray-600 text-gray-200 rounded text-xs"
                  >
                    <option value={4800}>4800 (Most Common)</option>
                    <option value={9600}>9600 (Standard)</option>
                    <option value={19200}>19200</option>
                    <option value={38400}>38400</option>
                    <option value={57600}>57600</option>
                    <option value={115200}>115200</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Data Bits</label>
                  <select
                    value={gpsConfig.dataBits}
                    onChange={(e) => setGPSConfig({ ...gpsConfig, dataBits: parseInt(e.target.value) })}
                    className="w-full px-2 py-1 bg-gray-800 border border-gray-600 text-gray-200 rounded text-xs"
                  >
                    <option value={7}>7 bits</option>
                    <option value={8}>8 bits (Standard)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Parity</label>
                  <select
                    value={gpsConfig.parity}
                    onChange={(e) => setGPSConfig({ ...gpsConfig, parity: e.target.value as 'none' | 'even' | 'odd' })}
                    className="w-full px-2 py-1 bg-gray-800 border border-gray-600 text-gray-200 rounded text-xs"
                  >
                    <option value="none">None (Standard)</option>
                    <option value="even">Even</option>
                    <option value="odd">Odd</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Stop Bits</label>
                  <select
                    value={gpsConfig.stopBits}
                    onChange={(e) => setGPSConfig({ ...gpsConfig, stopBits: parseInt(e.target.value) })}
                    className="w-full px-2 py-1 bg-gray-800 border border-gray-600 text-gray-200 rounded text-xs"
                  >
                    <option value={1}>1 bit (Standard)</option>
                    <option value={2}>2 bits</option>
                  </select>
                </div>
              </div>
              <div className="mt-3 text-xs text-gray-500">
                <p>Note: Changes require reconnecting the GPS device to take effect.</p>
              </div>
            </>
          )}
        </div>
      )}
      
      {showRawData ? (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Raw NMEA Data</h3>
          <pre className="bg-gray-900 p-2 rounded text-xs font-mono h-[200px] overflow-auto whitespace-pre-wrap">
            {data.rawNMEA.length > 0 ? data.rawNMEA.join('\n') : 'No NMEA data received yet.\nConnect a GPS device to see live NMEA sentences.'}
          </pre>
        </div>
      ) : (
        <>
        {!gpsPort && (
          <div className="bg-yellow-500/20 border-l-4 border-yellow-500 p-4 rounded-lg mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              <p className="text-yellow-500">No GPS device connected. Please connect a GPS device first.</p>
            </div>
          </div>
        )}
        
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-1 flex items-center gap-1">
            <Clock className="w-4 h-4" />
            UTC Time
          </h3>
          <div className="text-xl font-mono font-bold text-white">
            {isHardwareConnected ? data.time : '--:--:--'}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-1 flex items-center gap-1">
            <Satellite className="w-4 h-4" />
            Satellites
          </h3>
          <div className="text-xl font-mono font-bold text-white">
            {isHardwareConnected ? data.satellites : '--'}
          </div>
        </div>
        
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-1 flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            Latitude
          </h3>
          <div className="text-xl font-mono font-bold text-white">
            {formatCoordinate(data.latitude, true)}
          </div>
        </div>
        
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-1 flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            Longitude
          </h3>
          <div className="text-xl font-mono font-bold text-white">
            {formatCoordinate(data.longitude, false)}
          </div>
        </div>
        
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-1 flex items-center gap-1">
            <Ruler className="w-4 h-4" />
            Altitude (MSL)
          </h3>
          <div className="text-xl font-mono font-bold text-white">
            {formatValue(data.altitude, 1, 'm')}
          </div>
        </div>
        
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-1 flex items-center gap-1">
            <Gauge className="w-4 h-4" />
            Speed
          </h3>
          <div className="text-xl font-mono font-bold text-white">
            {hasValidPosition && data.speed ? (
              displayUnits === 'metric' 
                ? formatValue(data.speed, 1, ' km/h')
                : formatValue(data.speed / 1.852, 1, ' knots')
            ) : (
              displayUnits === 'metric' ? '--km/h' : '--knots'
            )}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-1 flex items-center gap-1">
            <Compass className="w-4 h-4" />
            Course
          </h3>
          <div className="text-xl font-mono font-bold text-white">
            {formatValue(data.course, 1, '°')}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-1 flex items-center gap-1 justify-between">
            <div className="flex items-center gap-1">
              <Signal className="w-4 h-4" />
              Fix Quality
            </div>
            <div className={`h-2 w-2 rounded-full ${
              data.fixQuality === 'No Fix' ? 'bg-red-500' :
              data.fixQuality === 'GPS Fix' ? 'bg-green-500' :
              'bg-blue-500'
            }`} />
          </h3>
          <div className="text-xl font-mono font-bold text-white">
            {data.fixQuality}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-1 flex items-center gap-1">
            <Crosshair className="w-4 h-4" />
            HDOP
          </h3>
          <div className="text-xl font-mono font-bold text-white">
            {formatValue(data.hdop, 1)}
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Last Update</span>
          <span className="text-sm font-mono text-white">
            {isHardwareConnected ? new Date(data.lastUpdate).toLocaleTimeString() : '--:--:--'}
          </span>
        </div>
        <div className="mt-2 text-xs text-gray-500">
          {!gpsPort ? 'No GPS device connected' :
           !connected ? 'GPS device not responding' :
           data.source === 'none' ? 'No GPS data available' :
           data.source === 'browser' ? 'Using device geolocation' :
           data.fixQuality === 'No Fix' ? 'Waiting for GPS fix...' :
           data.fixQuality === 'GPS Fix' ? `Standard GPS positioning (${data.source})` : 
           `Differential GPS (${data.source})`}
        </div>
      </div>
      </>
      )}
    </div>
  );
};

export default GPSData;