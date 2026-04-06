import { useEffect, useRef } from 'react';
import { ScannerControls } from '../components/pointCloud/ScannerControls';
import { ScanSessionPanel } from '../components/pointCloud/ScanSessionPanel';
import { ScanListPanel } from '../components/pointCloud/ScanListPanel';
import LiveCamera from '../components/LiveCamera';
import { getCurrentUser } from '../lib/firebase';
import { auditLog } from '../lib/auditLog';

export default function PointCloudScannerPage() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    document.title = '3D Point Cloud Scanner - MeasurePRO';
    // Audit: feature access
    try {
      const user = getCurrentUser();
      if (user) auditLog.featureAccess(user.uid, user.email || '', 'Point Cloud Scanner');
    } catch (_e) {}
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold">3D Point Cloud Scanner</h1>
            <p className="text-sm text-gray-400 mt-1">
              Professional infrastructure scanning with ZED 2i camera
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto p-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left Column - Camera Preview */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-gray-800 rounded-lg overflow-hidden">
                <LiveCamera 
                  captureImage={() => {}}
                  videoRef={videoRef}
                  measurements={[]}
                />
              </div>
            </div>

            {/* Right Column - Controls & Stats */}
            <div className="space-y-4">
              {/* Scanner Controls */}
              <ScannerControls />

              {/* Current Session Stats */}
              <ScanSessionPanel />

              {/* Saved Scans List */}
              <ScanListPanel />
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-6 bg-gray-800 p-4 rounded-lg">
            <h3 className="text-sm font-semibold mb-2">Quick Start Guide:</h3>
            <ol className="text-sm text-gray-400 space-y-1 list-decimal list-inside">
              <li>Ensure ZED 2i camera is connected and depth mode is enabled</li>
              <li>Enable GPS for geo-referenced scans (optional)</li>
              <li>Enter a scan name and click "Start Scan"</li>
              <li>Move camera to capture different viewpoints (1 fps capture rate)</li>
              <li>Click "Stop" when finished</li>
              <li>Export to PLY or LAS format for use in other software</li>
            </ol>
          </div>
        </div>
      </div>
  );
}
