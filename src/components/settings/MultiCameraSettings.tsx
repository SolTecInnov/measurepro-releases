import { useState, useEffect } from 'react';
import { Camera, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { useCameraStore } from '@/lib/camera';
import type { CameraPosition } from '@/lib/camera';

interface CameraOption {
  deviceId: string;
  label: string;
}

const POSITIONS: { id: CameraPosition; label: string; icon: React.ReactNode; description: string }[] = [
  { id: 'front', label: 'Front Camera', icon: <ArrowUp className="w-4 h-4" />, description: 'Main forward-facing camera (default)' },
  { id: 'left', label: 'Left Camera', icon: <ArrowLeft className="w-4 h-4" />, description: 'Left side for lateral width detection' },
  { id: 'right', label: 'Right Camera', icon: <ArrowRight className="w-4 h-4" />, description: 'Right side for lateral width detection' },
  { id: 'rear', label: 'Rear Camera', icon: <ArrowDown className="w-4 h-4" />, description: 'Rear facing for overhang monitoring' },
];

const MultiCameraSettings: React.FC = () => {
  const [cameras, setCameras] = useState<CameraOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { multiCameraSettings, setMultiCameraSettings, selectedCamera } = useCameraStore();

  const loadCameras = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices
        .filter(device => device.kind === 'videoinput')
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${index + 1}`
        }));
      
      setCameras(videoDevices);
    } catch (err) {
      setError('Failed to enumerate cameras. Please check permissions.');
      console.error('[MultiCameraSettings] Error loading cameras:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCameras();
    
    navigator.mediaDevices.addEventListener('devicechange', loadCameras);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', loadCameras);
    };
  }, []);

  const handleCameraSelect = (position: CameraPosition, deviceId: string) => {
    setMultiCameraSettings({ [position]: deviceId });
  };

  const getCameraLabel = (deviceId: string): string => {
    if (!deviceId) return 'Not configured';
    const camera = cameras.find(c => c.deviceId === deviceId);
    return camera?.label || 'Unknown Camera';
  };

  const isConfigured = (position: CameraPosition): boolean => {
    if (position === 'front') {
      return !!(multiCameraSettings.front || selectedCamera);
    }
    return !!multiCameraSettings[position];
  };

  return (
    <div className="space-y-6" data-testid="multi-camera-settings">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Camera className="w-5 h-5 text-cyan-400" />
            Multi-Camera Configuration
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            Assign cameras to different positions for detection-specific image capture
          </p>
        </div>
        <button
          onClick={loadCameras}
          disabled={isLoading}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          title="Refresh camera list"
          data-testid="button-refresh-cameras"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {cameras.length === 0 && !isLoading && !error && (
        <div className="text-center py-8 text-gray-500">
          <Camera className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No cameras detected</p>
          <p className="text-xs mt-1">Connect cameras and click refresh</p>
        </div>
      )}

      <div className="grid gap-4">
        {POSITIONS.map(position => (
          <div
            key={position.id}
            className="bg-gray-800 rounded-lg p-4 border border-gray-700"
            data-testid={`camera-position-${position.id}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isConfigured(position.id) ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                  {position.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{position.label}</span>
                    {isConfigured(position.id) && (
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500">{position.description}</p>
                </div>
              </div>
            </div>
            
            <div className="mt-3">
              <select
                value={position.id === 'front' ? (multiCameraSettings.front || selectedCamera) : multiCameraSettings[position.id]}
                onChange={(e) => handleCameraSelect(position.id, e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                disabled={isLoading || cameras.length === 0}
                data-testid={`select-camera-${position.id}`}
              >
                <option value="">
                  {position.id === 'front' ? 'Use default camera' : 'Not configured'}
                </option>
                {cameras.map(camera => (
                  <option key={camera.deviceId} value={camera.deviceId}>
                    {camera.label}
                  </option>
                ))}
              </select>
              
              {position.id !== 'front' && multiCameraSettings[position.id] && (
                <p className="text-xs text-gray-500 mt-1">
                  Selected: {getCameraLabel(multiCameraSettings[position.id])}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-400 mb-2">How it works</h4>
        <ul className="text-xs text-gray-400 space-y-1">
          <li>• When lateral left detection creates a POI, the left camera captures the image</li>
          <li>• When lateral right detection creates a POI, the right camera captures the image</li>
          <li>• When rear overhang detection creates a POI, the rear camera captures the image</li>
          <li>• If a position camera is not configured, the front camera is used as fallback</li>
        </ul>
      </div>
    </div>
  );
};

export default MultiCameraSettings;
