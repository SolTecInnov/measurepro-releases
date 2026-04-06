import { useState, useEffect } from 'react';
import { useSettingsStore } from '../../lib/settings';
import { useMultiLaserStore } from '../../lib/stores/multiLaserStore';
import { ArrowLeftRight, AlertTriangle, Ruler, Car, Usb, Settings } from 'lucide-react';
import { toast } from 'sonner';

const LateralRearLaserSettings: React.FC = () => {
  const { 
    lateralLaserSettings, 
    setLateralLaserSettings,
    rearOverhangSettings,
    setRearOverhangSettings
  } = useSettingsStore();
  
  const {
    leftLateral,
    rightLateral,
    rear,
    requestPort,
    connectLaser,
    disconnectLaser
  } = useMultiLaserStore();

  const [localLateralSettings, setLocalLateralSettings] = useState(lateralLaserSettings);
  const [localRearSettings, setLocalRearSettings] = useState(rearOverhangSettings);

  useEffect(() => {
    setLocalLateralSettings(lateralLaserSettings);
  }, [lateralLaserSettings]);

  useEffect(() => {
    setLocalRearSettings(rearOverhangSettings);
  }, [rearOverhangSettings]);

  const handleLateralSettingChange = async (key: string, value: any) => {
    const newSettings = { ...localLateralSettings, [key]: value };
    setLocalLateralSettings(newSettings);
    await setLateralLaserSettings(newSettings);
  };

  const handleRearSettingChange = async (key: string, value: any) => {
    if (key === 'clearanceThresholdMeters' && value > 40) {
      toast.warning('Threshold over 40m requires laser reconfiguration', {
        description: 'Standard lasers are set to max 40m range. Please reconfigure laser settings to extend range up to 80m.'
      });
    }
    const newSettings = { ...localRearSettings, [key]: value };
    setLocalRearSettings(newSettings);
    await setRearOverhangSettings(newSettings);
  };

  const handleConnectLateralLaser = async (side: 'left' | 'right') => {
    try {
      const port = await requestPort();
      if (port) {
        const position = side === 'left' ? 'leftLateral' : 'rightLateral';
        await connectLaser(position, port);
        toast.success(`${side.charAt(0).toUpperCase() + side.slice(1)} lateral laser connected`);
      }
    } catch (error) {
      toast.error(`Failed to connect ${side} laser: ${(error as Error).message}`);
    }
  };

  const handleConnectRearLaser = async () => {
    try {
      const port = await requestPort();
      if (port) {
        await connectLaser('rear', port);
        toast.success('Rear overhang laser connected');
      }
    } catch (error) {
      toast.error(`Failed to connect rear laser: ${(error as Error).message}`);
    }
  };

  const commonInputClasses = "w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <ArrowLeftRight className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-medium text-gray-200">Lateral Width Measurement</h3>
        </div>
        
        <p className="text-xs text-gray-400 mb-4">
          Measure lateral clearance using one or two side-mounted lasers. Configure vehicle offsets for accurate total width calculations.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Mode</label>
            <select
              value={localLateralSettings.mode}
              onChange={(e) => handleLateralSettingChange('mode', e.target.value)}
              className={commonInputClasses}
              data-testid="select-lateral-mode"
            >
              <option value="off">Off</option>
              <option value="single">Single Laser</option>
              <option value="dual">Dual Laser</option>
            </select>
          </div>

          {localLateralSettings.mode === 'single' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Laser Mounted On</label>
              <select
                value={localLateralSettings.singleLaserSide}
                onChange={(e) => handleLateralSettingChange('singleLaserSide', e.target.value)}
                className={commonInputClasses}
                data-testid="select-single-laser-side"
              >
                <option value="left">Left Side</option>
                <option value="right">Right Side</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Select which side of the vehicle the laser is mounted
              </p>
            </div>
          )}

          {localLateralSettings.mode !== 'off' && (
            <>
              <div className="bg-gray-700/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Car className="w-4 h-4 text-yellow-400" />
                  <h4 className="text-sm font-medium text-gray-300">Vehicle Offset Configuration</h4>
                </div>
                <p className="text-xs text-gray-400 mb-3">
                  {localLateralSettings.mode === 'single' 
                    ? `Measure from the far ${localLateralSettings.singleLaserSide === 'left' ? 'right' : 'left'} side of the truck to the laser reference mark.`
                    : 'Enter distance from each laser reference mark to the center of the vehicle.'}
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  {(localLateralSettings.mode === 'dual' || localLateralSettings.singleLaserSide === 'left') && (
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">
                        {localLateralSettings.mode === 'single' ? 'Vehicle Width to Right Edge (m)' : 'Left Offset to Center (m)'}
                      </label>
                      <input
                        type="number"
                        value={localLateralSettings.leftOffsetMeters}
                        onChange={(e) => handleLateralSettingChange('leftOffsetMeters', parseFloat(e.target.value) || 0)}
                        className={commonInputClasses}
                        step="0.01"
                        min="0"
                        data-testid="input-left-offset"
                      />
                    </div>
                  )}
                  {(localLateralSettings.mode === 'dual' || localLateralSettings.singleLaserSide === 'right') && (
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">
                        {localLateralSettings.mode === 'single' ? 'Vehicle Width to Left Edge (m)' : 'Right Offset to Center (m)'}
                      </label>
                      <input
                        type="number"
                        value={localLateralSettings.rightOffsetMeters}
                        onChange={(e) => handleLateralSettingChange('rightOffsetMeters', parseFloat(e.target.value) || 0)}
                        className={commonInputClasses}
                        step="0.01"
                        min="0"
                        data-testid="input-right-offset"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-700/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-orange-400" />
                  <h4 className="text-sm font-medium text-gray-300">Alert Thresholds (meters)</h4>
                </div>
                
                <div className="flex items-center mb-3">
                  <input
                    type="checkbox"
                    id="lateral-alert-enabled"
                    checked={localLateralSettings.alertEnabled}
                    onChange={(e) => handleLateralSettingChange('alertEnabled', e.target.checked)}
                    className="mr-2"
                  />
                  <label htmlFor="lateral-alert-enabled" className="text-sm text-gray-300">
                    Enable lateral clearance alerts
                  </label>
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Left Side</label>
                    <input
                      type="number"
                      value={localLateralSettings.alertThresholdLeft}
                      onChange={(e) => handleLateralSettingChange('alertThresholdLeft', parseFloat(e.target.value) || 0)}
                      className={commonInputClasses}
                      step="0.1"
                      min="0"
                      disabled={!localLateralSettings.alertEnabled}
                      data-testid="input-alert-left"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Right Side</label>
                    <input
                      type="number"
                      value={localLateralSettings.alertThresholdRight}
                      onChange={(e) => handleLateralSettingChange('alertThresholdRight', parseFloat(e.target.value) || 0)}
                      className={commonInputClasses}
                      step="0.1"
                      min="0"
                      disabled={!localLateralSettings.alertEnabled}
                      data-testid="input-alert-right"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Total Width</label>
                    <input
                      type="number"
                      value={localLateralSettings.alertThresholdTotal}
                      onChange={(e) => handleLateralSettingChange('alertThresholdTotal', parseFloat(e.target.value) || 0)}
                      className={commonInputClasses}
                      step="0.1"
                      min="0"
                      disabled={!localLateralSettings.alertEnabled}
                      data-testid="input-alert-total"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Alert triggers when clearance falls below threshold. Total width alert triggers when combined width exceeds threshold.
                </p>
              </div>

              <div className="bg-gray-700/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Usb className="w-4 h-4 text-green-400" />
                  <h4 className="text-sm font-medium text-gray-300">Laser Connections</h4>
                </div>
                
                <div className="space-y-2">
                  {(localLateralSettings.mode === 'dual' || localLateralSettings.singleLaserSide === 'left') && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">Left Lateral Laser</span>
                      <div className="flex items-center gap-2">
                        <div className={`h-2.5 w-2.5 rounded-full ${leftLateral.connected ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-xs text-gray-400">{leftLateral.connected ? 'Connected' : 'Disconnected'}</span>
                        {!leftLateral.connected ? (
                          <button
                            onClick={() => handleConnectLateralLaser('left')}
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                            data-testid="btn-connect-left-lateral"
                          >
                            Connect
                          </button>
                        ) : (
                          <button
                            onClick={() => disconnectLaser('leftLateral')}
                            className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                            data-testid="btn-disconnect-left-lateral"
                          >
                            Disconnect
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  {(localLateralSettings.mode === 'dual' || localLateralSettings.singleLaserSide === 'right') && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">Right Lateral Laser</span>
                      <div className="flex items-center gap-2">
                        <div className={`h-2.5 w-2.5 rounded-full ${rightLateral.connected ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-xs text-gray-400">{rightLateral.connected ? 'Connected' : 'Disconnected'}</span>
                        {!rightLateral.connected ? (
                          <button
                            onClick={() => handleConnectLateralLaser('right')}
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                            data-testid="btn-connect-right-lateral"
                          >
                            Connect
                          </button>
                        ) : (
                          <button
                            onClick={() => disconnectLaser('rightLateral')}
                            className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                            data-testid="btn-disconnect-right-lateral"
                          >
                            Disconnect
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                
                {leftLateral.connected && (
                  <div className="mt-2 text-sm text-green-400">
                    Left: {leftLateral.lastMeasurement}
                  </div>
                )}
                {rightLateral.connected && (
                  <div className="mt-1 text-sm text-green-400">
                    Right: {rightLateral.lastMeasurement}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Ruler className="w-5 h-5 text-orange-400" />
          <h3 className="text-lg font-medium text-gray-200">Rear Overhang Measurement</h3>
        </div>
        
        <p className="text-xs text-gray-400 mb-4">
          Monitor rear clearance for oversized loads like wind blades. Alerts trigger when clearance drops below threshold.
        </p>

        <div className="space-y-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="rear-overhang-enabled"
              checked={localRearSettings.enabled}
              onChange={(e) => handleRearSettingChange('enabled', e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="rear-overhang-enabled" className="text-sm text-gray-300">
              Enable rear overhang monitoring
            </label>
          </div>

          {localRearSettings.enabled && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Laser Height from Ground (m)</label>
                  <input
                    type="number"
                    value={localRearSettings.heightFromGroundMeters}
                    onChange={(e) => handleRearSettingChange('heightFromGroundMeters', parseFloat(e.target.value) || 0)}
                    className={commonInputClasses}
                    step="0.1"
                    min="0"
                    data-testid="input-rear-height"
                  />
                  <p className="text-xs text-gray-500 mt-1">Height where rear laser is mounted</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Clearance Threshold (m)</label>
                  <input
                    type="number"
                    value={localRearSettings.clearanceThresholdMeters}
                    onChange={(e) => handleRearSettingChange('clearanceThresholdMeters', parseFloat(e.target.value) || 0)}
                    className={commonInputClasses}
                    step="1"
                    min="0"
                    max="80"
                    data-testid="input-rear-threshold"
                  />
                  <p className="text-xs text-gray-500 mt-1">Alert when distance falls below this value</p>
                </div>
              </div>

              {localRearSettings.clearanceThresholdMeters > 40 && (
                <div className="bg-yellow-900/30 border border-yellow-600/50 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm text-yellow-400">Laser reconfiguration required</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Standard lasers are configured for max 40m. For thresholds up to 80m, the laser must be reconfigured to extended range mode.
                  </p>
                </div>
              )}

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="rear-alert-enabled"
                  checked={localRearSettings.alertEnabled}
                  onChange={(e) => handleRearSettingChange('alertEnabled', e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="rear-alert-enabled" className="text-sm text-gray-300">
                  Enable rear overhang alerts
                </label>
              </div>

              <div className="bg-gray-700/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Settings className="w-4 h-4 text-purple-400" />
                  <h4 className="text-sm font-medium text-gray-300">Rear Camera</h4>
                </div>
                
                <div className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    id="use-rear-camera"
                    checked={localRearSettings.useRearCamera}
                    onChange={(e) => handleRearSettingChange('useRearCamera', e.target.checked)}
                    className="mr-2"
                  />
                  <label htmlFor="use-rear-camera" className="text-sm text-gray-300">
                    Use rear-facing camera for overhang POIs
                  </label>
                </div>
                <p className="text-xs text-gray-500">
                  When enabled, rear overhang POIs will capture from a separate rear-facing webcam.
                </p>
              </div>

              <div className="bg-gray-700/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Usb className="w-4 h-4 text-green-400" />
                  <h4 className="text-sm font-medium text-gray-300">Rear Laser Connection</h4>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">Rear Overhang Laser</span>
                  <div className="flex items-center gap-2">
                    <div className={`h-2.5 w-2.5 rounded-full ${rear.connected ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-xs text-gray-400">{rear.connected ? 'Connected' : 'Disconnected'}</span>
                    {!rear.connected ? (
                      <button
                        onClick={handleConnectRearLaser}
                        className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                        data-testid="btn-connect-rear"
                      >
                        Connect
                      </button>
                    ) : (
                      <button
                        onClick={() => disconnectLaser('rear')}
                        className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                        data-testid="btn-disconnect-rear"
                      >
                        Disconnect
                      </button>
                    )}
                  </div>
                </div>
                
                {rear.connected && (
                  <div className="mt-2 text-sm text-green-400">
                    Current: {rear.lastMeasurement}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LateralRearLaserSettings;
