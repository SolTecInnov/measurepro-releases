import { useEffect, useState } from 'react';
import { Camera, MapPin, HardDrive, Clock } from 'lucide-react';
import { usePointCloudScanner } from '../../hooks/usePointCloudScanner';
import { formatBytes, formatDuration } from '../../lib/utils';

export function ScanSessionPanel() {
  const { currentScan, recordingStatus, gpsStatus, storageQuota, storageUsed } = usePointCloudScanner();
  const [elapsedTime, setElapsedTime] = useState(0);

  // Update elapsed time
  useEffect(() => {
    if (recordingStatus === 'recording' && currentScan.startTime) {
      const interval = setInterval(() => {
        setElapsedTime(Date.now() - currentScan.startTime);
      }, 1000);
      return () => clearInterval(interval);
    } else if (recordingStatus === 'idle') {
      setElapsedTime(0);
    }
  }, [recordingStatus, currentScan.startTime]);

  const isActive = recordingStatus !== 'idle';

  return (
    <div className="space-y-4 p-4 bg-gray-800 rounded-lg">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Current Session</h3>
        {isActive && (
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            recordingStatus === 'recording' 
              ? 'bg-green-600 text-white animate-pulse' 
              : 'bg-yellow-600 text-white'
          }`} data-testid="status-recording">
            {recordingStatus === 'recording' ? 'RECORDING' : 'PAUSED'}
          </span>
        )}
      </div>

      {!isActive ? (
        <div className="text-gray-400 text-sm py-8 text-center">
          No active scan session
        </div>
      ) : (
        <div className="space-y-3">
          {/* Scan Name */}
          <div className="bg-gray-700 p-3 rounded">
            <div className="text-xs text-gray-400 mb-1">Scan Name</div>
            <div className="text-white font-medium" data-testid="text-scan-name">
              {currentScan.scanName}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Frames */}
            <div className="bg-gray-700 p-3 rounded">
              <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                <Camera className="h-3 w-3" />
                Frames
              </div>
              <div className="text-white text-lg font-semibold" data-testid="text-frame-count">
                {currentScan.frameCount}
              </div>
            </div>

            {/* Points */}
            <div className="bg-gray-700 p-3 rounded">
              <div className="text-gray-400 text-xs mb-1">Points</div>
              <div className="text-white text-lg font-semibold" data-testid="text-point-count">
                {currentScan.pointCount.toLocaleString()}
              </div>
            </div>

            {/* Duration */}
            <div className="bg-gray-700 p-3 rounded">
              <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                <Clock className="h-3 w-3" />
                Duration
              </div>
              <div className="text-white text-lg font-semibold" data-testid="text-duration">
                {formatDuration(elapsedTime)}
              </div>
            </div>

            {/* GPS Status */}
            <div className="bg-gray-700 p-3 rounded">
              <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                <MapPin className="h-3 w-3" />
                GPS
              </div>
              <div className={`text-sm font-medium ${gpsStatus.available ? 'text-green-400' : 'text-red-400'}`} data-testid="status-gps">
                {gpsStatus.available ? 'Active' : 'No Signal'}
              </div>
            </div>
          </div>

          {/* Storage */}
          <div className="bg-gray-700 p-3 rounded">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-gray-400 text-xs">
                <HardDrive className="h-3 w-3" />
                Storage Used
              </div>
              <span className="text-xs text-gray-400" data-testid="text-storage-usage">
                {formatBytes(storageUsed)} / {formatBytes(storageQuota)}
              </span>
            </div>
            <div className="w-full bg-gray-600 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  (storageUsed / storageQuota) > 0.9 
                    ? 'bg-red-500' 
                    : (storageUsed / storageQuota) > 0.7 
                    ? 'bg-yellow-500' 
                    : 'bg-green-500'
                }`}
                style={{ width: `${Math.min((storageUsed / storageQuota) * 100, 100)}%` }}
                data-testid="progress-storage"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
