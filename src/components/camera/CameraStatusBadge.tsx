import { Wifi, WifiOff, Camera, Video, Layers } from 'lucide-react';
import { useCameraStore } from '../../lib/camera';
import { useLicenseCheck } from '../../hooks/useLicenseEnforcement';

/**
 * Camera Status Badge Component
 * 
 * Displays current camera status information:
 * - Camera type (Standard/ZED 2i)
 * - Connection status
 * - Available features (depth, stereo, clearance) - only in non-compact mode
 * 
 * @param compact - When true, renders inline horizontally with smaller size (default: false)
 */
export default function CameraStatusBadge({ compact = false }: { compact?: boolean }) {
  const { cameraType, isCameraConnected } = useCameraStore();
  const { hasAccess: hasZED2iLicense } = useLicenseCheck('zed2i_support');

  if (!cameraType) return null;

  const isZED2i = cameraType === 'zed2i';
  const isConnected = isCameraConnected;

  // Compact mode: horizontal layout, smaller, no absolute positioning, no features
  if (compact) {
    return (
      <div 
        className="flex items-center gap-1.5"
        data-testid="container-camera-status-badge"
      >
        {/* Camera Type Badge - Compact */}
        <div 
          className={`flex items-center gap-1 px-2 py-0.5 rounded shadow-lg backdrop-blur-sm border ${
            isZED2i
              ? 'bg-purple-900/80 border-purple-500/50 text-purple-100'
              : 'bg-blue-900/80 border-blue-500/50 text-blue-100'
          }`}
          data-testid="badge-camera-type"
        >
          {isZED2i ? (
            <Video className="w-3 h-3" />
          ) : (
            <Camera className="w-3 h-3" />
          )}
          <span className="font-semibold text-xs">
            {isZED2i ? 'ZED 2i' : 'Standard'}
          </span>
        </div>

        {/* Connection Status Badge - Compact */}
        <div 
          className={`flex items-center gap-1 px-2 py-0.5 rounded shadow-lg backdrop-blur-sm border ${
            isConnected
              ? 'bg-green-900/80 border-green-500/50 text-green-100'
              : 'bg-red-900/80 border-red-500/50 text-red-100'
          }`}
          data-testid="badge-connection-status"
        >
          {isConnected ? (
            <>
              <Wifi className="w-3 h-3" />
              <span className="text-xs font-medium">Connected</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3" />
              <span className="text-xs font-medium">Disconnected</span>
            </>
          )}
        </div>
      </div>
    );
  }

  // Default mode: vertical layout with features
  return (
    <div 
      className="absolute top-4 left-4 z-20 space-y-2"
      data-testid="container-camera-status-badge"
    >
      {/* Camera Type Badge */}
      <div 
        className={`flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg backdrop-blur-sm border ${
          isZED2i
            ? 'bg-purple-900/80 border-purple-500/50 text-purple-100'
            : 'bg-blue-900/80 border-blue-500/50 text-blue-100'
        }`}
        data-testid="badge-camera-type"
      >
        {isZED2i ? (
          <Video className="w-4 h-4" />
        ) : (
          <Camera className="w-4 h-4" />
        )}
        <span className="font-semibold text-sm">
          {isZED2i ? 'ZED 2i Stereo' : 'Standard Camera'}
        </span>
      </div>

      {/* Connection Status Badge */}
      <div 
        className={`flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg backdrop-blur-sm border ${
          isConnected
            ? 'bg-green-900/80 border-green-500/50 text-green-100'
            : 'bg-red-900/80 border-red-500/50 text-red-100'
        }`}
        data-testid="badge-connection-status"
      >
        {isConnected ? (
          <>
            <Wifi className="w-4 h-4" />
            <span className="text-sm font-medium">Connected</span>
          </>
        ) : (
          <>
            <WifiOff className="w-4 h-4" />
            <span className="text-sm font-medium">Disconnected</span>
          </>
        )}
      </div>

      {/* Feature Availability Indicators - Only show for ZED 2i */}
      {isZED2i && isConnected && (
        <div 
          className="flex flex-col gap-1.5 px-3 py-2 rounded-lg shadow-lg backdrop-blur-sm bg-gray-900/80 border border-gray-600/50"
          data-testid="container-feature-indicators"
        >
          <div className="text-xs font-semibold text-gray-300 mb-1">Features:</div>
          
          {/* Depth Sensing */}
          <div 
            className={`flex items-center gap-1.5 ${
              hasZED2iLicense ? 'text-green-400' : 'text-gray-500'
            }`}
            data-testid="indicator-depth-sensing"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="text-xs">
              Depth Sensing {!hasZED2iLicense && '(License Required)'}
            </span>
          </div>

          {/* Stereo Vision */}
          <div 
            className={`flex items-center gap-1.5 ${
              hasZED2iLicense ? 'text-green-400' : 'text-gray-500'
            }`}
            data-testid="indicator-stereo-vision"
          >
            <Video className="w-3.5 h-3.5" />
            <span className="text-xs">
              Stereo Vision {!hasZED2iLicense && '(License Required)'}
            </span>
          </div>

          {/* Clearance Measurement */}
          <div 
            className={`flex items-center gap-1.5 ${
              hasZED2iLicense ? 'text-green-400' : 'text-gray-500'
            }`}
            data-testid="indicator-clearance"
          >
            <Camera className="w-3.5 h-3.5" />
            <span className="text-xs">
              Clearance Measurement {!hasZED2iLicense && '(License Required)'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
