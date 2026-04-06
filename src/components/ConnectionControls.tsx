import React from 'react';
import { useSerialStore, SerialResetStatus } from '../lib/stores/serialStore';
import { Zap, Navigation, Gauge } from 'lucide-react';
import { MeasuringMode, MEASURING_MODES } from '../lib/serial';

const ConnectionControls: React.FC = () => {
  const {
    requestPort,
    availablePorts,
    laserPort,
    gpsPort,
    laserType,
    resetSerialConnection,
    resetStatus,
    connectToLaser,
    connectToGPS,
    disconnectLaser,
    disconnectGPS,
    measuringMode,
    setMeasuringMode,
    startTracking,
    stopTracking,
    toggleRedDot,
    getTemperature,
    singleMeasure,
    stopLaser,
    startBufferTracking,
    stopBufferTracking,
    clearBuffer,
    bufferSamplingTime,
    setBufferSamplingTime
  } = useSerialStore();

  const [bufferTime, setBufferTime] = React.useState('0');
  const [showResetConfirm, setShowResetConfirm] = React.useState(false);
  const [lastMeasurement, setLastMeasurement] = React.useState('');

  // Handle buffer sampling time change
  const handleBufferTimeChange = () => {
    const time = parseInt(bufferTime);
    if (!isNaN(time) && time >= 0) {
      setBufferSamplingTime(time);
    }
  };

  // Handle reset confirmation
  const handleResetConfirm = () => {
    resetSerialConnection();
    setShowResetConfirm(false);
  };

  return (
    <div className="bg-gray-800 rounded-xl p-6 mt-6">
      <div className="grid grid-cols-2 gap-6">
        {/* Laser Connection */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-400" />
              <h3 className="text-lg font-medium">Laser Connection</h3>              
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${laserPort ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm">{laserPort ? 'Connected' : 'Disconnected'}</span>
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

          <div className="flex gap-2">
            <button
              onClick={requestPort}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
            >
              Add Port
            </button>
            {laserPort && (
              <button
                onClick={disconnectLaser}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm"
              >
                Disconnect
              </button>
            )}
          </div>

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
          
          {/* Reset Confirmation Dialog */}
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
          {resetStatus !== SerialResetStatus.IDLE && (
            <div className={`mt-2 p-2 rounded text-sm ${
              resetStatus === SerialResetStatus.RESETTING ? 'bg-yellow-500/20 text-yellow-400' : 
              resetStatus === SerialResetStatus.SUCCESS ? 'bg-green-500/20 text-green-400' : 
              'bg-red-500/20 text-red-400'
            }`}>
              {resetStatus === SerialResetStatus.RESETTING ? 'Resetting serial connections...' : 
               resetStatus === SerialResetStatus.SUCCESS ? 'Reset successful. Please reconnect your devices.' : 
               'Reset failed. Please try again or refresh the page.'}
            </div>
          )}
          
          {/* Measuring Mode */}
          <div className="mt-4 border-t border-gray-700 pt-4">
            <h4 className="text-sm font-medium mb-2">Measuring Mode</h4>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(MEASURING_MODES) as MeasuringMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setMeasuringMode(mode)}
                  className={`text-xs rounded px-2 py-1 ${
                    measuringMode === mode
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Measurements Display */}
          <div className="mt-4 bg-gray-900 p-3 rounded">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-gray-400">Last Measurement</div>
                <div className="text-xl font-bold">{lastMeasurement || '--'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Meters</div>
                <div className="text-lg">{lastMeasurement && lastMeasurement !== '--' && !isNaN(parseFloat(lastMeasurement))
                  ? `${parseFloat(lastMeasurement).toFixed(3)} m`
                  : '--'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Feet</div>
                <div className="text-lg">{lastMeasurement && lastMeasurement !== '--' && !isNaN(parseFloat(lastMeasurement))
                  ? `${(parseFloat(lastMeasurement) * 3.28084).toFixed(3)} ft`
                  : '--'}</div>
              </div>
            </div>
          </div>

          {/* Laser Controls */}
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">Laser Controls</h4>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <button
                onClick={singleMeasure}
                className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs font-medium"
              >
                Single Measure {laserType === 'soltec-legacy' ? '(s0g)' : '(DM)'}
              </button>
              <button
                onClick={startTracking}
                className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs font-medium"
              >
                Continuous {laserType === 'soltec-legacy' ? '(s0h)' : '(DT)'}
              </button>
              <button
                onClick={stopLaser}
                className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs font-medium"
              >
                Stop Laser {laserType === 'soltec-legacy' ? '(s0c)' : '(ESC)'}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => toggleRedDot(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded text-xs font-medium"
              >
                Red Dot On {laserType === 'soltec-legacy' ? '(s0o)' : '(LE)'}
              </button>
              <button
                onClick={() => toggleRedDot(false)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded text-xs font-medium"
              >
                Red Dot Off {laserType === 'soltec-legacy' ? '(s0p)' : '(LD)'}
              </button>
              <button
                onClick={getTemperature}
                className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs font-medium"
              >
                Temperature {laserType === 'soltec-legacy' ? '(s0t)' : '(TP)'}
              </button>
            </div>
          </div>

          {/* Buffer Tracking */}
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">Buffer Tracking</h4>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={bufferTime}
                onChange={(e) => setBufferTime(e.target.value)}
                placeholder="Buffer time (ms)"
                className="bg-gray-700 text-white text-xs rounded px-2 py-1 flex-1"
              />
              <button
                onClick={handleBufferTimeChange}
                className="bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded text-xs font-medium"
              >
                Set
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => startBufferTracking()}
                className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs font-medium"
              >
                Start Buffer
              </button>
              <button
                onClick={stopBufferTracking}
                className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs font-medium"
              >
                Stop Buffer
              </button>
              <button
                onClick={clearBuffer}
                className="bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded text-xs font-medium"
              >
                Clear Buffer
              </button>
            </div>
          </div>
        </div>

        {/* GPS Connection */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Navigation className="w-5 h-5 text-blue-400" />
              <h3 className="text-lg font-medium">GPS Connection</h3>              
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

          <div className="flex gap-2">
            <button
              onClick={requestPort}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
            >
              Add Port
            </button>
            {gpsPort && (
              <button
                onClick={disconnectGPS}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm"
              >
                Disconnect
              </button>
            )}
          </div>

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
        </div>
      </div>
      
      {/* Reset Connection Confirmation Dialog */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4">Reset Connection</h3>
            <p className="text-gray-300 mb-6">
              Are you sure you want to reset the serial connection? This will close and reopen the port.
            </p>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowResetConfirm(false);
                  disconnectLaser();
                  setTimeout(() => {
                    requestPort();
                  }, 500);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm"
              >
                Reset Connection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectionControls;