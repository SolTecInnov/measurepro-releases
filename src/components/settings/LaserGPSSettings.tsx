import React from 'react';
import { Zap, Navigation, Bluetooth, Usb } from 'lucide-react';
import { useSerialStore } from '../../lib/stores/serialStore';
import HardwareStatusPanel from '../hardware/HardwareStatusPanel';
import { getLaserLog, clearLaserOutput } from '../../lib/laserLog';
import { useGPSStore } from '../../lib/stores/gpsStore';
import { useLaserStore } from '../../lib/laser';
import { useBluetoothStore } from '../../lib/bluetooth/bluetoothStore';
import GPSData from '../GPSData';
import { isBetaUser } from '../../lib/auth/masterAdmin';
import { useEnabledFeatures } from '../../hooks/useLicenseEnforcement';
import { getAuth } from 'firebase/auth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MeasurementFilterControl from './MeasurementFilterControl';
import AmplitudeFilterControl from './AmplitudeFilterControl';
import { useAmplitudeFilterStore } from '../../lib/stores/amplitudeFilterStore';
import { useSettingsStore } from '../../lib/settings';
import { CloudRain } from 'lucide-react';

// Weather Quality Filter Control Component for RSA Laser
const WeatherFilterControl: React.FC = () => {
  const { laserSettings, setLaserSettings } = useSettingsStore();
  const weatherFilter = laserSettings.weatherFilter || {
    enabled: false,
    minIntensityGood: 100,
    minIntensityAcceptable: 40
  };

  const handleToggle = () => {
    setLaserSettings({
      ...laserSettings,
      weatherFilter: {
        ...weatherFilter,
        enabled: !weatherFilter.enabled
      }
    });
  };

  const handleThresholdChange = (field: 'minIntensityGood' | 'minIntensityAcceptable', value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 510) {
      setLaserSettings({
        ...laserSettings,
        weatherFilter: {
          ...weatherFilter,
          [field]: numValue
        }
      });
    }
  };

  return (
    <div className="mb-6 bg-gray-700/50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CloudRain className="w-5 h-5 text-blue-400" />
          <h4 className="text-sm font-medium text-gray-200">Weather Quality Filter</h4>
        </div>
        <button
          onClick={handleToggle}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            weatherFilter.enabled
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-gray-600 hover:bg-gray-500 text-gray-300'
          }`}
          data-testid="btn-toggle-weather-filter"
        >
          {weatherFilter.enabled ? 'Enabled' : 'Disabled'}
        </button>
      </div>
      
      <p className="text-xs text-gray-400 mb-3">
        Filter measurements based on signal intensity to reduce errors from rain, snow, or fog.
        Low intensity readings indicate weak signal returns that may be unreliable.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-1">
            Good Quality (min intensity)
          </label>
          <input
            type="number"
            value={weatherFilter.minIntensityGood}
            onChange={(e) => handleThresholdChange('minIntensityGood', e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg text-sm"
            min="0"
            max="510"
            disabled={!weatherFilter.enabled}
            data-testid="input-intensity-good"
          />
          <p className="text-xs text-gray-500 mt-1">Clear conditions (default: 100)</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-1">
            Acceptable Quality (min intensity)
          </label>
          <input
            type="number"
            value={weatherFilter.minIntensityAcceptable}
            onChange={(e) => handleThresholdChange('minIntensityAcceptable', e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg text-sm"
            min="0"
            max="510"
            disabled={!weatherFilter.enabled}
            data-testid="input-intensity-acceptable"
          />
          <p className="text-xs text-gray-500 mt-1">Light rain/snow (default: 40)</p>
        </div>
      </div>

      {weatherFilter.enabled && (
        <div className="mt-3 p-2 bg-gray-800 rounded text-xs text-gray-400">
          <div className="font-medium text-gray-300 mb-1">Quality Classification:</div>
          <div className="grid grid-cols-3 gap-2">
            <div><span className="text-green-400">Good:</span> ≥{weatherFilter.minIntensityGood}</div>
            <div><span className="text-yellow-400">Acceptable:</span> {weatherFilter.minIntensityAcceptable}-{weatherFilter.minIntensityGood - 1}</div>
            <div><span className="text-red-400">Poor:</span> &lt;{weatherFilter.minIntensityAcceptable}</div>
          </div>
        </div>
      )}
    </div>
  );
};

const LaserGPSSettings: React.FC = () => {
  const {
    requestPort,
    availablePorts,
    laserPort,
    gpsPort,
    laserType,
    amplitudeFilterEnabled,
    lastMeasurement: storeLastMeasurement,
    connectToLaser,
    connectToGPS,
    disconnectLaser,
    disconnectGPS,
    setLaserType,
    setAmplitudeFilterEnabled,
    resetSerialConnection,
    resetStatus,
    sendLaserCommand
  } = useSerialStore();

  const { groundReferenceHeight, setGroundReferenceHeight } = useLaserStore();
  useGPSStore();
  
  const {
    settings: amplitudeSettings,
    stats: amplitudeStats,
    updateSettings: updateAmplitudeSettings,
    applySuggestedThreshold,
    reset: resetAmplitudeFilter,
    getFilter: initAmplitudeFilter
  } = useAmplitudeFilterStore();
  
  React.useEffect(() => {
    if (laserType === 'soltec-standard') {
      initAmplitudeFilter();
    }
  }, [laserType, initAmplitudeFilter]);
  
  const {
    isBluetoothSupported: btSupported,
    bluetoothError,
    laserStatus: btLaserStatus,
    gpsStatus: btGpsStatus,
    connectedLaserDevice,
    connectedGPSDevice,
    lastBluetoothMeasurement,
    bluetoothLaserType,
    autoSyncEnabled,
    setBluetoothLaserType,
    connectBluetoothLaser,
    disconnectBluetoothLaser,
    requestBluetoothMeasurement,
    toggleBluetoothAutoSync,
    toggleBluetoothLaser,
    connectBluetoothGPS,
    disconnectBluetoothGPS,
    checkBluetoothSupport
  } = useBluetoothStore();
  
  const auth = getAuth();
  const { features } = useEnabledFeatures();
  const isBeta = isBetaUser(auth.currentUser, features);

  const [displayMeasurement, setDisplayMeasurement] = React.useState('--');
  const [showResetConfirm, setShowResetConfirm] = React.useState(false);
  const [btLaserConnecting, setBtLaserConnecting] = React.useState(false);
  const [btGpsConnecting, setBtGpsConnecting] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('wired-laser');
  const [customCommand, setCustomCommand] = React.useState('');
  const rawOutputRef = React.useRef<HTMLPreElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  
  const handleSendCustomCommand = () => {
    if (customCommand.trim() && laserPort) {
      sendLaserCommand(customCommand.trim());
      setCustomCommand('');
    }
  };
  
  React.useEffect(() => {
    checkBluetoothSupport();
  }, [checkBluetoothSupport]);

  React.useEffect(() => {
    if (storeLastMeasurement !== undefined && storeLastMeasurement !== null) {
      setDisplayMeasurement(storeLastMeasurement);
    }
    if (lastBluetoothMeasurement) {
      setDisplayMeasurement(lastBluetoothMeasurement.value.toFixed(3));
    }
  }, [storeLastMeasurement, lastBluetoothMeasurement]);

  // Fix 3: Poll the module-level laser log at 200ms instead of re-rendering on every byte
  React.useEffect(() => {
    const interval = setInterval(() => {
      if (textareaRef.current) {
        textareaRef.current.value = getLaserLog();
        textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
      }
    }, 200);
    return () => clearInterval(interval);
  }, []);

  const commonInputClasses = "w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500";

  const handleResetConfirm = () => {
    resetSerialConnection();
    setShowResetConfirm(false);
  };

  const handleGroundReferenceChange = (value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      setGroundReferenceHeight(numValue);
    }
  };

  const isWiredLaserConnected = laserPort !== null;
  const isWiredGpsConnected = gpsPort !== null;
  const isBluetoothLaserConnected = btLaserStatus === 'connected';
  const isBluetoothGpsConnected = btGpsStatus === 'connected';

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
        <Zap className="w-6 h-6 text-blue-400" />
        Device Settings
      </h2>

      {/* Hardware Status Panel */}
      <div className="mb-6">
        <HardwareStatusPanel />
      </div>

      {/* Shared Live Measurement Display */}
      <div className="mb-6 bg-gray-900 p-4 rounded-lg">
        <h4 className="text-sm font-medium text-gray-300 mb-3">Live Measurement Data</h4>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-gray-400">Last Measurement</div>
            <div className="text-xl font-bold font-mono">{displayMeasurement || '--'}</div>
            <div className="text-xs text-gray-500">Raw value</div>
          </div>
          <div>
            <div className="text-xs text-gray-400">Meters</div>
            <div className="text-lg">
              {displayMeasurement && displayMeasurement !== '--' && !isNaN(parseFloat(displayMeasurement))
                ? `${(parseFloat(displayMeasurement) + groundReferenceHeight).toFixed(3)} m`
                : '--'}
            </div>
            <div className="text-xs text-gray-500">With ground reference</div>
          </div>
          <div>
            <div className="text-xs text-gray-400">Feet</div>
            <div className="text-lg">
              {displayMeasurement && displayMeasurement !== '--' && !isNaN(parseFloat(displayMeasurement))
                ? `${((parseFloat(displayMeasurement) + groundReferenceHeight) * 3.28084).toFixed(3)} ft`
                : '--'}
            </div>
            <div className="text-xs text-gray-500">Imperial units</div>
          </div>
        </div>
        
        {/* Connection Status Summary */}
        <div className="mt-3 pt-3 border-t border-gray-700 flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className={`h-2 w-2 rounded-full ${isWiredLaserConnected ? 'bg-green-500' : 'bg-gray-500'}`} />
            <span className="text-gray-400">Wired Laser</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`h-2 w-2 rounded-full ${isWiredGpsConnected ? 'bg-green-500' : 'bg-gray-500'}`} />
            <span className="text-gray-400">Wired GPS</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`h-2 w-2 rounded-full ${isBluetoothLaserConnected ? 'bg-green-500' : 'bg-gray-500'}`} />
            <span className="text-gray-400">BT Laser</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`h-2 w-2 rounded-full ${isBluetoothGpsConnected ? 'bg-green-500' : 'bg-gray-500'}`} />
            <span className="text-gray-400">BT GPS</span>
          </div>
        </div>
      </div>

      {/* Ground Reference Height - Shared */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Ground Reference Height (m)
        </label>
        <input
          type="number"
          value={groundReferenceHeight}
          onChange={(e) => handleGroundReferenceChange(e.target.value)}
          className={commonInputClasses}
          step="0.001"
          placeholder="0.000"
        />
        <p className="text-xs text-gray-400 mt-1">
          Height to add to all measurements (e.g., sensor height above ground)
        </p>
      </div>

      {/* Measurement Noise Filter */}
      <div className="mb-6">
        <MeasurementFilterControl />
      </div>

      {/* Amplitude Filter — visible for soltec-standard */}
      {laserType === 'soltec-standard' && (
        <div className="mb-6 bg-gray-700/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-200">Amplitude Filter</h4>
            <button
              onClick={() => setAmplitudeFilterEnabled(!amplitudeFilterEnabled)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                amplitudeFilterEnabled
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-500 hover:bg-gray-400 text-white'
              }`}
              data-testid="btn-toggle-amplitude-filter"
            >
              {amplitudeFilterEnabled ? 'Amplitude Filter: ON' : 'Amplitude Filter: OFF'}
            </button>
          </div>
          <p className="text-xs text-gray-400">
            Filter weak-signal measurements based on signal amplitude (dB). Useful in adverse weather.
          </p>
        </div>
      )}

      {/* Device Connection Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="wired-laser" className="flex items-center gap-2" data-testid="tab-wired-laser">
            <Usb className="w-4 h-4" />
            Wired Laser
          </TabsTrigger>
          <TabsTrigger value="wired-gps" className="flex items-center gap-2" data-testid="tab-wired-gps">
            <Navigation className="w-4 h-4" />
            Wired GPS
          </TabsTrigger>
          <TabsTrigger value="bluetooth" className="flex items-center gap-2" data-testid="tab-bluetooth">
            <Bluetooth className="w-4 h-4" />
            Bluetooth
          </TabsTrigger>
        </TabsList>

        {/* ===== WIRED LASER TAB ===== */}
        <TabsContent value="wired-laser" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-400" />
              <h3 className="text-lg font-medium">Wired Laser (USB)</h3>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${laserPort ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm">{laserPort ? 'Connected' : 'Disconnected'}</span>
              </div>
              <button
                onClick={() => setShowResetConfirm(true)}
                className="px-2 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-xs"
                title="Reset connection"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Laser Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Laser Type</label>
            <select
              value={laserType}
              onChange={(e) => setLaserType(e.target.value as any)}
              className={commonInputClasses}
              data-testid="select-laser-type"
            >
              <option value="soltec-standard">Standard 115200 (SolTec / RSA High Pole)</option>
              <option value="soltec-legacy">Legacy 19200 (SolTec 10m old unit)</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">
              All modern SolTec models (30m, 70m, AR2700) and RSA High Pole use the standard setting.
            </p>
          </div>

          {/* Port Management */}
          <div className="flex gap-2">
            <button
              onClick={requestPort}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
              data-testid="btn-add-laser-port"
            >
              Add Port
            </button>
            {laserPort && (
              <button
                onClick={disconnectLaser}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm"
                data-testid="btn-disconnect-laser"
              >
                Disconnect
              </button>
            )}
          </div>

          {/* Available Ports */}
          {availablePorts.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Available Ports:</h4>
              <div className="space-y-2">
                {availablePorts.map((port, index) => {
                  const info = port.getInfo();
                  const isLaser = laserPort === port;
                  const isGPS = gpsPort === port;

                  return (
                    <div key={index} className="flex items-center gap-2">
                      <button
                        onClick={() => connectToLaser(port)}
                        disabled={isLaser || isGPS}
                        className={`px-2 py-1 text-xs rounded ${
                          isLaser
                            ? 'bg-purple-900/50 text-purple-400'
                            : 'bg-purple-600 hover:bg-purple-700 text-white'
                        }`}
                      >
                        {isLaser ? 'Laser' : 'Set as Laser'}
                      </button>
                      <span className="text-xs text-gray-400">
                        VID: 0x{info.usbVendorId?.toString(16)}, PID: 0x{info.usbProductId?.toString(16)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Raw Laser Output — always visible */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-300">Raw Laser Output</h4>
              <button
                onClick={clearLaserOutput}
                className="px-2 py-1 bg-gray-600 hover:bg-gray-700 rounded text-xs"
              >
                Clear
              </button>
            </div>

            <textarea
              ref={textareaRef}
              readOnly
              defaultValue="Waiting for laser data…&#10;Connect the laser port to see the live stream."
              className="bg-gray-900 text-green-400 p-3 rounded-lg h-[200px] overflow-y-auto text-xs font-mono whitespace-pre-wrap w-full resize-none border-0 outline-none"
            />

            {/* Configuration command input — for advanced use only */}
            <div className="flex gap-2">
              <input
                type="text"
                value={customCommand}
                onChange={(e) => setCustomCommand(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && laserPort) {
                    handleSendCustomCommand();
                  }
                }}
                disabled={!laserPort}
                placeholder={laserPort ? "Configuration command (e.g. *IDN?, BAUD, SAVE)" : "Connect laser to send configuration commands"}
                className="flex-1 px-3 py-1.5 bg-gray-700 border border-gray-600 text-gray-200 rounded text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="input-custom-serial-command"
              />
              <button
                onClick={handleSendCustomCommand}
                disabled={!laserPort || !customCommand.trim()}
                className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm font-medium"
                data-testid="btn-send-serial-command"
              >
                Send
              </button>
            </div>
          </div>
        </TabsContent>

        {/* ===== WIRED GPS TAB ===== */}
        <TabsContent value="wired-gps" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Navigation className="w-5 h-5 text-blue-400" />
              <h3 className="text-lg font-medium">Wired GPS (USB)</h3>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${gpsPort ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm">{gpsPort ? 'Connected' : 'Disconnected'}</span>
              </div>
              <button
                onClick={() => setShowResetConfirm(true)}
                className="px-2 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-xs"
                title="Reset Web Serial connection"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Port Management */}
          <div className="flex gap-2">
            <button
              onClick={requestPort}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
              data-testid="btn-add-gps-port"
            >
              Add Port
            </button>
            {gpsPort && (
              <button
                onClick={disconnectGPS}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm"
                data-testid="btn-disconnect-gps"
              >
                Disconnect
              </button>
            )}
          </div>

          {/* Available Ports for GPS */}
          {availablePorts.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Available Ports:</h4>
              <div className="space-y-2">
                {availablePorts.map((port, index) => {
                  const info = port.getInfo();
                  const isLaser = laserPort === port;
                  const isGPS = gpsPort === port;

                  return (
                    <div key={index} className="flex items-center gap-2">
                      <button
                        onClick={() => connectToGPS(port)}
                        disabled={isLaser || isGPS}
                        className={`px-2 py-1 text-xs rounded ${
                          isGPS
                            ? 'bg-blue-900/50 text-blue-400'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                      >
                        {isGPS ? 'GPS' : 'Set as GPS'}
                      </button>
                      <span className="text-xs text-gray-400">
                        VID: 0x{info.usbVendorId?.toString(16)}, PID: 0x{info.usbProductId?.toString(16)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* GPS Data Display */}
          <GPSData />
        </TabsContent>

        {/* ===== BLUETOOTH DEVICES TAB ===== */}
        <TabsContent value="bluetooth" className="space-y-6">
          {!btSupported && (
            <div className="bg-yellow-900/20 text-yellow-400 p-3 rounded-lg text-sm">
              <strong>Bluetooth not supported</strong>
              <p className="mt-1">Web Bluetooth requires Chrome, Edge, Brave, or Opera on Windows, Mac, or Android.</p>
              <p className="text-xs mt-1">Not available on iOS/Safari or Firefox.</p>
            </div>
          )}

          {btSupported && (
            <>
              {/* Bluetooth Laser Section */}
              <div className="bg-gray-900/50 rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-purple-400" />
                    <h3 className="text-lg font-medium">Bluetooth Measuring Device</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`h-2.5 w-2.5 rounded-full ${
                      btLaserStatus === 'connected' ? 'bg-green-500' : 
                      btLaserStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
                    }`} />
                    <span className="text-sm">
                      {btLaserStatus === 'connected' ? 'Connected' : 
                       btLaserStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
                    </span>
                  </div>
                </div>

                {/* Device Type Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Device Type</label>
                  <select
                    value={bluetoothLaserType}
                    onChange={(e) => setBluetoothLaserType(e.target.value as any)}
                    className={commonInputClasses}
                    disabled={btLaserStatus === 'connected'}
                  >
                    <option value="bosch-glm165">Bosch Blaze GLM165</option>
                    <option value="generic-ble">Generic BLE Distance Meter</option>
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    Bosch Blaze GLM165 uses MTProtocol over Bluetooth Low Energy
                  </p>
                </div>

                {/* Connect/Disconnect Button */}
                <div className="flex gap-2">
                  {btLaserStatus !== 'connected' ? (
                    <button
                      onClick={async () => {
                        setBtLaserConnecting(true);
                        await connectBluetoothLaser();
                        setBtLaserConnecting(false);
                      }}
                      disabled={btLaserConnecting || btLaserStatus === 'connecting'}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
                      data-testid="btn-connect-bluetooth-laser"
                    >
                      <Bluetooth className="w-4 h-4" />
                      {btLaserStatus === 'connecting' ? 'Scanning...' : 'Scan & Connect'}
                    </button>
                  ) : (
                    <button
                      onClick={disconnectBluetoothLaser}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm"
                      data-testid="btn-disconnect-bluetooth-laser"
                    >
                      Disconnect
                    </button>
                  )}
                </div>

                {/* Connected Device Info */}
                {btLaserStatus === 'connected' && connectedLaserDevice && (
                  <div className="bg-gray-800 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">Device:</span>
                      <span className="text-sm font-medium">{connectedLaserDevice.name}</span>
                    </div>
                    {connectedLaserDevice.batteryLevel !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-300">Battery:</span>
                        <span className="text-sm">{connectedLaserDevice.batteryLevel}%</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">Auto-Sync:</span>
                      <button
                        onClick={toggleBluetoothAutoSync}
                        className={`px-2 py-1 text-xs rounded ${autoSyncEnabled ? 'bg-green-600' : 'bg-gray-600'}`}
                      >
                        {autoSyncEnabled ? 'ON' : 'OFF'}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Auto-sync: Measurements are sent automatically when you take them on the device.
                    </p>
                  </div>
                )}

                {/* Bluetooth Laser Controls */}
                {!isBeta && btLaserStatus === 'connected' && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Device Controls</h4>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={requestBluetoothMeasurement}
                        className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs font-medium"
                        data-testid="btn-bluetooth-measure"
                      >
                        Measure
                      </button>
                      <button
                        onClick={() => toggleBluetoothLaser(true)}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded text-xs font-medium"
                      >
                        Laser On
                      </button>
                      <button
                        onClick={() => toggleBluetoothLaser(false)}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded text-xs font-medium"
                      >
                        Laser Off
                      </button>
                    </div>
                  </div>
                )}

                {/* Last Bluetooth Measurement */}
                {lastBluetoothMeasurement && (
                  <div className="bg-gray-800 rounded p-2 text-sm">
                    <span className="text-gray-400">Last measurement: </span>
                    <span className="font-mono font-bold">{lastBluetoothMeasurement.value.toFixed(3)} m</span>
                    <span className="text-gray-500 text-xs ml-2">
                      ({new Date(lastBluetoothMeasurement.timestamp).toLocaleTimeString()})
                    </span>
                  </div>
                )}
              </div>

              {/* Bluetooth GPS Section */}
              <div className="bg-gray-900/50 rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Navigation className="w-5 h-5 text-blue-400" />
                    <h3 className="text-lg font-medium">Bluetooth GPS Receiver</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`h-2.5 w-2.5 rounded-full ${
                      btGpsStatus === 'connected' ? 'bg-green-500' : 
                      btGpsStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
                    }`} />
                    <span className="text-sm">
                      {btGpsStatus === 'connected' ? 'Connected' : 
                       btGpsStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
                    </span>
                  </div>
                </div>

                {/* Connect/Disconnect Button */}
                <div className="flex gap-2">
                  {btGpsStatus !== 'connected' ? (
                    <button
                      onClick={async () => {
                        setBtGpsConnecting(true);
                        await connectBluetoothGPS();
                        setBtGpsConnecting(false);
                      }}
                      disabled={btGpsConnecting || btGpsStatus === 'connecting'}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
                      data-testid="btn-connect-bluetooth-gps"
                    >
                      <Bluetooth className="w-4 h-4" />
                      {btGpsStatus === 'connecting' ? 'Scanning...' : 'Scan & Connect'}
                    </button>
                  ) : (
                    <button
                      onClick={disconnectBluetoothGPS}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm"
                      data-testid="btn-disconnect-bluetooth-gps"
                    >
                      Disconnect
                    </button>
                  )}
                </div>

                {/* Connected GPS Device Info */}
                {btGpsStatus === 'connected' && connectedGPSDevice && (
                  <div className="bg-gray-800 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">Device:</span>
                      <span className="text-sm font-medium">{connectedGPSDevice.name}</span>
                    </div>
                    {connectedGPSDevice.batteryLevel !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-300">Battery:</span>
                        <span className="text-sm">{connectedGPSDevice.batteryLevel}%</span>
                      </div>
                    )}
                  </div>
                )}

                <p className="text-xs text-gray-400">
                  Supports BLE GPS receivers with standard Location and Navigation profiles or NMEA output.
                </p>
              </div>

              {/* Bluetooth Error Display */}
              {bluetoothError && (
                <div className="bg-red-900/20 text-red-400 text-sm p-3 rounded-lg">
                  <strong>Bluetooth Error:</strong> {bluetoothError}
                </div>
              )}

              {/* How to Use Section */}
              <div className="bg-gray-900/30 rounded-lg p-4 text-sm text-gray-400">
                <h4 className="font-medium text-gray-300 mb-2">How to Use Bluetooth Devices</h4>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Turn on your Bluetooth device (Bosch GLM165, GPS receiver)</li>
                  <li>Click "Scan & Connect" - a browser popup will show available devices</li>
                  <li>Select your device from the list</li>
                  <li>Once connected, measurements sync automatically to MeasurePRO</li>
                  <li>Use the "Measure" button or take a measurement on the device itself</li>
                </ol>
                <p className="mt-3 text-xs">
                  <strong>Tip:</strong> Bluetooth measurements work exactly like wired measurements - 
                  they appear in the log and can be exported with GPS coordinates.
                </p>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Reset Connection Confirmation Dialog */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4">Reset Serial Connection</h3>
            <p className="text-gray-300 mb-6">
              This will disconnect all serial devices and reset the Web Serial API connection. 
              You'll need to reconnect your devices afterward.
            </p>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleResetConfirm}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm"
              >
                Reset Connection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Status Message */}
      {resetStatus !== 'idle' && (
        <div className={`mt-2 p-2 rounded text-sm ${
          resetStatus === 'resetting' ? 'bg-yellow-500/20 text-yellow-400' : 
          resetStatus === 'success' ? 'bg-green-500/20 text-green-400' : 
          'bg-red-500/20 text-red-400'
        }`}>
          {resetStatus === 'resetting' ? 'Resetting serial connections...' : 
           resetStatus === 'success' ? 'Reset successful. Please reconnect your devices.' : 
           'Reset failed. Please try again or refresh the page.'}
        </div>
      )}
    </div>
  );
};

export default LaserGPSSettings;
