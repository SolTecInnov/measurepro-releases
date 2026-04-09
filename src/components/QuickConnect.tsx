import React from 'react';
import { Zap, Navigation } from 'lucide-react';
import { useSerialStore } from '../lib/stores/serialStore';

const QuickConnect: React.FC = () => {
  const {
    requestPort,
    availablePorts,
    laserPort,
    gpsPort,
    electronLaserConnected,
    connectToLaser,
    connectToGPS,
    disconnectLaser,
    disconnectGPS
  } = useSerialStore();

  const isLaserConnected = laserPort !== null || electronLaserConnected;

  const handleLaserConnect = async () => {
    try {
      if (laserPort) {
        // Ensure proper cleanup before disconnecting
        if (laserPort.readable) {
          try {
            // Get a new reader
            const reader = laserPort.readable.getReader();
            // Cancel and release in sequence
            await reader.cancel();
            reader.releaseLock();
          } catch (err) {
          }
        }
        await disconnectLaser();
        return;
      }

      // Request port if none available
      if (availablePorts.length === 0) {
        await requestPort();
        // Check if we got any ports
        const updatedPorts = useSerialStore.getState().availablePorts;
        if (updatedPorts.length === 0) {
          // Don't show error if user simply cancelled the dialog
          return;
        }
      }

      // Try to connect to first available port
      const currentPorts = useSerialStore.getState().availablePorts;
      if (currentPorts.length > 0) {
        const port = currentPorts[0];
        await connectToLaser(port);
      }
    } catch (error: any) {
      // Only show alert for actual connection errors, not user cancellation
      if (error.name !== 'NotFoundError') {
        alert('Failed to connect to laser device. Please check your connection and try again.');
      }
    }
  };

  const handleGPSConnect = async () => {
    try {
      if (gpsPort) {
        await disconnectGPS();
        return;
      }

      // Request port if none available  
      if (availablePorts.length === 0) {
        await requestPort();
        // Check again if we have ports after request
        const updatedPorts = useSerialStore.getState().availablePorts;
        if (updatedPorts.length === 0) {
          // Don't show error if user simply cancelled the dialog
          return;
        }
      }

      // Try to connect to first available port
      const currentPorts = useSerialStore.getState().availablePorts;
      if (currentPorts.length > 0) {
        const port = currentPorts[0];
        await connectToGPS(port);
      }
    } catch (error: any) {
      // Only show alert for actual connection errors, not user cancellation
      if (error.name !== 'NotFoundError') {
        alert('Failed to connect to GPS device. Please check your connection and try again.');
      }
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleLaserConnect}
        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
          isLaserConnected
            ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
            : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
        }`}
      >
        <Zap className="w-3 h-3" />
        <span>Laser {isLaserConnected ? 'Connected' : 'Disconnected'}</span>
      </button>

      <button
        onClick={handleGPSConnect}
        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
          gpsPort 
            ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' 
            : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
        }`}
      >
        <Navigation className="w-3 h-3" />
        <span>GPS {gpsPort ? 'Connected' : 'Disconnected'}</span>
      </button>
    </div>
  );
}

export default QuickConnect;