import { useEffect, useState, useMemo } from 'react';
import { useMultiLaserStore } from '../lib/stores/multiLaserStore';
import { useSettingsStore } from '../lib/settings';
import { lateralRearMonitor, LateralAlertState } from '../lib/services/lateralRearMonitor';
import { ArrowLeftRight, AlertTriangle, Car } from 'lucide-react';

interface LateralWidthDisplayProps {
  compact?: boolean;
}

const LateralWidthDisplay: React.FC<LateralWidthDisplayProps> = ({ compact = false }) => {
  const lateralLaserSettings = useSettingsStore(state => state.lateralLaserSettings);
  const leftLateral = useMultiLaserStore(state => state.leftLateral);
  const rightLateral = useMultiLaserStore(state => state.rightLateral);
  const [alertState, setAlertState] = useState<LateralAlertState | null>(null);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => forceUpdate(n => n + 1), 100);
    return () => clearInterval(interval);
  }, []);

  const leftClearance = useMemo(() => useMultiLaserStore.getState().getLeftClearance(), [leftLateral]);
  const rightClearance = useMemo(() => useMultiLaserStore.getState().getRightClearance(), [rightLateral]);
  const totalWidth = useMemo(() => useMultiLaserStore.getState().getTotalWidth(), [leftLateral, rightLateral]);

  useEffect(() => {
    const updateInterval = setInterval(() => {
      setAlertState(lateralRearMonitor.getLateralAlertState());
    }, 100);
    return () => clearInterval(updateInterval);
  }, []);

  if (lateralLaserSettings.mode === 'off') {
    return (
      <div className="p-4 text-center">
        <ArrowLeftRight className="w-8 h-8 text-gray-500 mx-auto mb-3" />
        <p className="text-gray-400 text-sm mb-2">Lateral width measurement is not configured</p>
        <p className="text-xs text-gray-500">
          Go to Settings → Hardware → Lateral/Rear to configure left and right lateral lasers
        </p>
      </div>
    );
  }

  const getAlertColor = (level: 'none' | 'warning' | 'critical') => {
    switch (level) {
      case 'critical': return 'text-red-500 bg-red-500/20';
      case 'warning': return 'text-yellow-500 bg-yellow-500/20';
      default: return 'text-green-400 bg-green-500/10';
    }
  };

  const formatDistance = (meters: number | null): string => {
    if (meters === null) return '--';
    return `${meters.toFixed(2)}m`;
  };

  if (compact) {
    return (
      <div className="bg-gray-800 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-medium text-gray-200">Lateral Width</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          {(lateralLaserSettings.mode === 'dual' || lateralLaserSettings.singleLaserSide === 'left') && (
            <div className={`p-2 rounded ${getAlertColor(alertState?.leftAlert || 'none')}`}>
              <div className="text-gray-400">Left</div>
              <div className="font-mono font-bold">{formatDistance(leftClearance?.clearanceWithVehicle ?? null)}</div>
            </div>
          )}
          {(lateralLaserSettings.mode === 'dual' || lateralLaserSettings.singleLaserSide === 'right') && (
            <div className={`p-2 rounded ${getAlertColor(alertState?.rightAlert || 'none')}`}>
              <div className="text-gray-400">Right</div>
              <div className="font-mono font-bold">{formatDistance(rightClearance?.clearanceWithVehicle ?? null)}</div>
            </div>
          )}
          <div className={`p-2 rounded ${getAlertColor(alertState?.totalAlert || 'none')}`}>
            <div className="text-gray-400">Total</div>
            <div className="font-mono font-bold">{formatDistance(totalWidth)}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="w-5 h-5 text-cyan-400" />
          <h3 className="text-sm font-medium text-gray-200">Lateral Width Measurement</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${leftLateral.connected || rightLateral.connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-xs text-gray-400">
            {lateralLaserSettings.mode === 'dual' ? 'Dual Laser' : `Single (${lateralLaserSettings.singleLaserSide})`}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {(lateralLaserSettings.mode === 'dual' || lateralLaserSettings.singleLaserSide === 'left') && (
          <div className={`p-3 rounded-lg ${getAlertColor(alertState?.leftAlert || 'none')}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400">Left Clearance</span>
              {alertState?.leftAlert !== 'none' && (
                <AlertTriangle className="w-4 h-4" />
              )}
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">With vehicle:</span>
                <span className="text-lg font-mono font-bold">{formatDistance(leftClearance?.clearanceWithVehicle ?? null)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">Raw laser:</span>
                <span className="text-sm font-mono">{formatDistance(leftClearance?.clearanceWithoutVehicle ?? null)}</span>
              </div>
            </div>
          </div>
        )}

        {(lateralLaserSettings.mode === 'dual' || lateralLaserSettings.singleLaserSide === 'right') && (
          <div className={`p-3 rounded-lg ${getAlertColor(alertState?.rightAlert || 'none')}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400">Right Clearance</span>
              {alertState?.rightAlert !== 'none' && (
                <AlertTriangle className="w-4 h-4" />
              )}
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">With vehicle:</span>
                <span className="text-lg font-mono font-bold">{formatDistance(rightClearance?.clearanceWithVehicle ?? null)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">Raw laser:</span>
                <span className="text-sm font-mono">{formatDistance(rightClearance?.clearanceWithoutVehicle ?? null)}</span>
              </div>
            </div>
          </div>
        )}

        <div className={`p-3 rounded-lg ${getAlertColor(alertState?.totalAlert || 'none')}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400">Total Width</span>
            <Car className="w-4 h-4 text-gray-400" />
          </div>
          <div className="flex items-center justify-center h-full">
            <span className="text-2xl font-mono font-bold">{formatDistance(totalWidth)}</span>
          </div>
          {lateralLaserSettings.alertEnabled && (
            <div className="text-xs text-gray-500 text-center mt-1">
              Threshold: {lateralLaserSettings.alertThresholdTotal}m
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LateralWidthDisplay;
