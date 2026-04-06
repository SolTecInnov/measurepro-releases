/**
 * HardwareStatusPanel
 *
 * A collapsible "Hardware Status" section showing:
 * - Laser: green "Receiving data", amber "Connected – no data yet", red "Not connected"
 * - Serial GPS: same three states
 * - Duro Bridge: green "Receiving data", amber "Connected – no data yet", red "Bridge unreachable"
 *
 * Collapses automatically once all connected devices are streaming.
 * Can be re-opened by the user via a toggle button.
 */

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Zap, Navigation, Wifi, WifiOff } from 'lucide-react';
import { useSerialStore } from '@/lib/stores/serialStore';
import { useGPSStore } from '@/lib/stores/gpsStore';
import { duroGpsService } from '@/lib/gnss/duroGpsService';

type DeviceStatus = 'not-connected' | 'connected-no-data' | 'receiving-data' | 'unreachable';

interface StatusRowProps {
  label: string;
  icon: React.ReactNode;
  status: DeviceStatus;
}

const STATUS_CONFIG: Record<DeviceStatus, { color: string; dot: string; text: string }> = {
  'not-connected': { color: 'text-red-400', dot: 'bg-red-500', text: 'Not connected' },
  'connected-no-data': { color: 'text-amber-400', dot: 'bg-amber-400', text: 'Connected – no data yet' },
  'receiving-data': { color: 'text-green-400', dot: 'bg-green-400', text: 'Receiving data' },
  'unreachable': { color: 'text-red-400', dot: 'bg-red-500', text: 'Bridge unreachable' },
};

const StatusRow: React.FC<StatusRowProps> = ({ label, icon, status }) => {
  const cfg = STATUS_CONFIG[status];
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2 text-sm text-gray-300">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className={`h-2.5 w-2.5 rounded-full ${cfg.dot} ${status === 'connected-no-data' ? 'animate-pulse' : ''}`} />
        <span className={`text-xs font-medium ${cfg.color}`}>{cfg.text}</span>
      </div>
    </div>
  );
};

const HardwareStatusPanel: React.FC = () => {
  const laserPort = useSerialStore((s) => s.laserPort);
  const lastMeasurement = useSerialStore((s) => s.lastMeasurement);
  const gpsPort = useSerialStore((s) => s.gpsPort);
  const gpsData = useGPSStore((s) => s.data);
  const gpsConnected = useGPSStore((s) => s.connected);

  const [duroActive, setDuroActive] = useState(false);
  const [duroHasData, setDuroHasData] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [autoCollapsed, setAutoCollapsed] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const active = duroGpsService.isActive();
      setDuroActive(active);
      if (active) {
        const now = Date.now();
        const lastUpdate = gpsData.lastUpdate;
        const isDuroSource = gpsData.source === 'duro';
        setDuroHasData(isDuroSource && lastUpdate > 0 && now - lastUpdate < 5000);
      } else {
        setDuroHasData(false);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [gpsData]);

  const laserStatus: DeviceStatus = !laserPort
    ? 'not-connected'
    : lastMeasurement && lastMeasurement !== '--'
    ? 'receiving-data'
    : 'connected-no-data';

  const gpsSerialStatus: DeviceStatus = !gpsPort
    ? 'not-connected'
    : gpsConnected && gpsData.source === 'serial' && gpsData.lastUpdate > 0 && Date.now() - gpsData.lastUpdate < 5000
    ? 'receiving-data'
    : gpsPort
    ? 'connected-no-data'
    : 'not-connected';

  const duroStatus: DeviceStatus = !duroActive
    ? 'unreachable'
    : duroHasData
    ? 'receiving-data'
    : 'connected-no-data';

  const allStreaming =
    (laserPort ? laserStatus === 'receiving-data' : true) &&
    (gpsPort ? gpsSerialStatus === 'receiving-data' : true) &&
    (duroActive ? duroStatus === 'receiving-data' : true);

  const anyConnected = laserPort !== null || gpsPort !== null || duroActive;

  useEffect(() => {
    if (allStreaming && anyConnected && !autoCollapsed) {
      const timer = setTimeout(() => {
        setIsOpen(false);
        setAutoCollapsed(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [allStreaming, anyConnected, autoCollapsed]);

  if (!anyConnected) return null;

  return (
    <div
      className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden"
      data-testid="hardware-status-panel"
    >
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-200 hover:bg-gray-700/50 transition-colors"
        data-testid="btn-toggle-hardware-status"
      >
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${allStreaming ? 'bg-green-400' : 'bg-amber-400 animate-pulse'}`} />
          <span>Hardware Status</span>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {isOpen && (
        <div className="px-4 pb-4 divide-y divide-gray-700/50">
          <StatusRow
            label="Laser"
            icon={<Zap className="w-4 h-4 text-blue-400" />}
            status={laserStatus}
          />
          <StatusRow
            label="Serial GPS"
            icon={<Navigation className="w-4 h-4 text-blue-400" />}
            status={gpsSerialStatus}
          />
          <StatusRow
            label="Duro Bridge"
            icon={
              duroActive
                ? <Wifi className="w-4 h-4 text-blue-400" />
                : <WifiOff className="w-4 h-4 text-gray-500" />
            }
            status={duroStatus}
          />
        </div>
      )}
    </div>
  );
};

export default HardwareStatusPanel;
