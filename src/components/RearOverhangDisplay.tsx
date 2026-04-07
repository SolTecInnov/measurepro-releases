import { useEffect, useState, useMemo } from 'react';
import { useMultiLaserStore } from '../lib/stores/multiLaserStore';
import { useSettingsStore } from '../lib/settings';
import { lateralRearMonitor, RearAlertState } from '../lib/services/lateralRearMonitor';
import { Ruler, AlertTriangle, Camera } from 'lucide-react';

interface RearOverhangDisplayProps {
  compact?: boolean;
}

const RearOverhangDisplay: React.FC<RearOverhangDisplayProps> = ({ compact = false }) => {
  const rearOverhangSettings = useSettingsStore(state => state.rearOverhangSettings);
  const rear = useMultiLaserStore(state => state.rear);
  const [alertState, setAlertState] = useState<RearAlertState | null>(null);

  // PERF FIX: Subscribe to store changes instead of polling every 100ms
  const rearMeasurement = useMemo(() => useMultiLaserStore.getState().getRearOverhang(), [rear]);

  useEffect(() => {
    setAlertState(lateralRearMonitor.getRearAlertState());
  }, [rear]);

  if (!rearOverhangSettings.enabled) {
    return (
      <div className="p-4 text-center">
        <Ruler className="w-8 h-8 text-gray-500 mx-auto mb-3" />
        <p className="text-gray-400 text-sm mb-2">Rear overhang monitoring is not configured</p>
        <p className="text-xs text-gray-500">
          Go to Settings → Hardware → Lateral/Rear to enable and configure rear laser
        </p>
      </div>
    );
  }

  const getAlertColor = (level: 'none' | 'warning' | 'critical') => {
    switch (level) {
      case 'critical': return 'text-red-500 bg-red-500/20 border-red-500/50';
      case 'warning': return 'text-yellow-500 bg-yellow-500/20 border-yellow-500/50';
      default: return 'text-green-400 bg-green-500/10 border-green-500/30';
    }
  };

  const formatDistance = (meters: number | null): string => {
    if (meters === null) return '--';
    return `${meters.toFixed(1)}m`;
  };

  const getProgress = (): number => {
    if (rearMeasurement === null || rearMeasurement.distanceMeters === null) return 0;
    const threshold = rearOverhangSettings.clearanceThresholdMeters;
    return Math.min(100, (rearMeasurement.distanceMeters / threshold) * 100);
  };

  if (compact) {
    return (
      <div className={`bg-gray-800 rounded-lg p-3 border ${getAlertColor(alertState?.alert || 'none')}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ruler className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-medium">Rear Overhang</span>
          </div>
          <div className="flex items-center gap-2">
            {alertState?.alert !== 'none' && <AlertTriangle className="w-4 h-4" />}
            <span className="text-xl font-mono font-bold">{formatDistance(rearMeasurement?.distanceMeters ?? null)}</span>
          </div>
        </div>
        {rearMeasurement && (
          <div className="mt-2">
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all ${
                  alertState?.alert === 'critical' ? 'bg-red-500' :
                  alertState?.alert === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${getProgress()}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0m</span>
              <span>Threshold: {rearOverhangSettings.clearanceThresholdMeters}m</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-gray-800 rounded-lg p-4 border ${getAlertColor(alertState?.alert || 'none')}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Ruler className="w-5 h-5 text-orange-400" />
          <h3 className="text-sm font-medium text-gray-200">Rear Overhang Monitoring</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${rear.connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-xs text-gray-400">{rear.connected ? 'Connected' : 'Disconnected'}</span>
          {rearOverhangSettings.useRearCamera && (
            <span title="Rear camera active"><Camera className="w-4 h-4 text-purple-400" /></span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="text-xs text-gray-400">Current Distance</div>
          <div className="flex items-center gap-2">
            {alertState?.alert !== 'none' && <AlertTriangle className="w-5 h-5" />}
            <span className="text-3xl font-mono font-bold">{formatDistance(rearMeasurement?.distanceMeters ?? null)}</span>
          </div>
          {rearMeasurement?.belowThreshold && (
            <div className="text-sm text-red-400 font-medium">
              Below threshold! Obstruction detected.
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="text-xs text-gray-400">Configuration</div>
          <div className="text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Threshold:</span>
              <span className="font-medium">{rearOverhangSettings.clearanceThresholdMeters}m</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Laser height:</span>
              <span>{rearOverhangSettings.heightFromGroundMeters}m</span>
            </div>
          </div>
        </div>
      </div>

      {rearMeasurement && (
        <div className="mt-4">
          <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-200 ${
                alertState?.alert === 'critical' ? 'bg-red-500' :
                alertState?.alert === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${getProgress()}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Alert Zone</span>
            <span>Clear</span>
          </div>
        </div>
      )}

      {rearOverhangSettings.clearanceThresholdMeters > 40 && (
        <div className="mt-3 p-2 bg-yellow-900/30 rounded text-xs text-yellow-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Extended range mode (laser reconfiguration required)
        </div>
      )}
    </div>
  );
};

export default RearOverhangDisplay;
