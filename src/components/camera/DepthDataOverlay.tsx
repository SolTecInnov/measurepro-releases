import React, { useRef, useEffect, useState } from 'react';
import { useCameraStore } from '../../lib/camera';
import { useLicenseCheck } from '../../hooks/useLicenseEnforcement';
import { Eye, EyeOff, Lock } from 'lucide-react';
import type { DepthData } from '../../lib/camera/CameraInterface';

interface DepthDataOverlayProps {
  videoWidth: number;
  videoHeight: number;
  enabled: boolean;
}

const DepthDataOverlay: React.FC<DepthDataOverlayProps> = ({
  videoWidth,
  videoHeight,
  enabled,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [depthData, setDepthData] = useState<DepthData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const { cameraType, activeCamera } = useCameraStore();
  const { hasAccess, isLoading: licenseLoading } = useLicenseCheck('zed2i_support');

  // Only render if camera type is ZED 2i and has license
  const shouldRender = cameraType === 'zed2i' && hasAccess;

  // Fetch depth data from ZED 2i camera
  useEffect(() => {
    // Early return if no license - prevents ANY SDK calls
    if (!hasAccess) {
      return;
    }

    if (!enabled || !shouldRender) {
      return;
    }

    // Early return if no shared camera instance
    if (!activeCamera) {
      return;
    }

    let isMounted = true;

    const captureDepthFrame = async () => {
      if (!isMounted || !activeCamera) return;

      try {
        setIsLoading(true);
        setError(null);

        // Use shared camera instance from store
        if (!activeCamera.captureDepthFrame) {
          throw new Error('Camera does not support depth capture');
        }

        const depth = await activeCamera.captureDepthFrame();
        
        if (isMounted) {
          setDepthData(depth);
          setIsLoading(false);
        }

        // Continue capturing frames for live view
        animationFrameRef.current = requestAnimationFrame(captureDepthFrame);
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to capture depth data');
          setIsLoading(false);
        }
        // Retry after 2 seconds
        setTimeout(() => {
          if (isMounted) {
            animationFrameRef.current = requestAnimationFrame(captureDepthFrame);
          }
        }, 2000);
      }
    };

    captureDepthFrame();

    return () => {
      isMounted = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [enabled, shouldRender, hasAccess, activeCamera]);

  // Render depth data to canvas
  useEffect(() => {
    if (!depthData || !canvasRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match depth data
    canvas.width = depthData.width;
    canvas.height = depthData.height;

    const imageData = ctx.createImageData(depthData.width, depthData.height);
    const data = imageData.data;

    // Convert depth values to color-coded visualization
    // Red = close objects, Blue = far objects
    const { minRange, maxRange } = depthData;
    const depthRange = maxRange - minRange;

    for (let i = 0; i < depthData.data.length; i++) {
      let depth = depthData.data[i];
      
      // Convert to meters if needed
      if (depthData.unit === 'millimeters') {
        depth = depth / 1000;
      }

      // Normalize depth to 0-1 range
      const normalizedDepth = Math.max(0, Math.min(1, (depth - minRange) / depthRange));

      // Create color gradient: Red (close) → Yellow → Green → Blue (far)
      const pixelIndex = i * 4;

      if (depth === 0 || depth < minRange || depth > maxRange) {
        // Invalid depth - show as black
        data[pixelIndex] = 0;
        data[pixelIndex + 1] = 0;
        data[pixelIndex + 2] = 0;
        data[pixelIndex + 3] = 255;
      } else {
        // Color gradient based on depth
        if (normalizedDepth < 0.25) {
          // Red to Yellow (0-25%)
          const t = normalizedDepth * 4;
          data[pixelIndex] = 255;
          data[pixelIndex + 1] = Math.floor(255 * t);
          data[pixelIndex + 2] = 0;
        } else if (normalizedDepth < 0.5) {
          // Yellow to Green (25-50%)
          const t = (normalizedDepth - 0.25) * 4;
          data[pixelIndex] = Math.floor(255 * (1 - t));
          data[pixelIndex + 1] = 255;
          data[pixelIndex + 2] = 0;
        } else if (normalizedDepth < 0.75) {
          // Green to Cyan (50-75%)
          const t = (normalizedDepth - 0.5) * 4;
          data[pixelIndex] = 0;
          data[pixelIndex + 1] = 255;
          data[pixelIndex + 2] = Math.floor(255 * t);
        } else {
          // Cyan to Blue (75-100%)
          const t = (normalizedDepth - 0.75) * 4;
          data[pixelIndex] = 0;
          data[pixelIndex + 1] = Math.floor(255 * (1 - t));
          data[pixelIndex + 2] = 255;
        }
        data[pixelIndex + 3] = 255; // Alpha
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }, [depthData]);

  // Don't render if not ZED 2i
  if (!shouldRender) {
    return null;
  }

  // Show license gate if no access
  if (!hasAccess && !licenseLoading) {
    return (
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{ width: videoWidth, height: videoHeight }}
        data-testid="depth-overlay-license-gate"
      >
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto">
          <div className="bg-black/80 border-2 border-yellow-500 rounded-lg p-6 max-w-sm">
            <div className="flex items-center gap-3 mb-3">
              <Lock className="w-8 h-8 text-yellow-500" />
              <h3 className="text-xl font-bold text-white">Premium Feature</h3>
            </div>
            <p className="text-gray-300 mb-4">
              ZED 2i Depth Visualization requires a Premium License
            </p>
            <p className="text-sm text-gray-400">
              Upgrade to unlock depth sensing, stereo vision, and advanced clearance measurement.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Don't render if disabled
  if (!enabled) {
    return null;
  }

  return (
    <div 
      className="absolute inset-0 pointer-events-none"
      style={{ width: videoWidth, height: videoHeight }}
      data-testid="depth-overlay-container"
    >
      {/* Depth visualization canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ 
          opacity: 0.7,
          mixBlendMode: 'screen',
        }}
        data-testid="depth-canvas"
      />

      {/* Range indicators */}
      {depthData && (
        <div 
          className="absolute top-4 left-4 bg-black/70 rounded-lg px-3 py-2 text-xs font-mono text-white border border-cyan-500"
          data-testid="depth-range-info"
        >
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full" />
              <span>Min: {depthData.minRange.toFixed(1)}m</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full" />
              <span>Max: {depthData.maxRange.toFixed(1)}m</span>
            </div>
            <div className="text-gray-400 text-[10px] mt-1">
              {depthData.width}x{depthData.height}
            </div>
          </div>
        </div>
      )}

      {/* Status badge */}
      <div 
        className="absolute top-4 right-4 bg-cyan-500/20 border border-cyan-500 rounded-lg px-3 py-1.5 text-xs font-semibold text-cyan-300 flex items-center gap-2"
        data-testid="depth-status-badge"
      >
        <Eye className="w-4 h-4" />
        <span>ZED 2i Depth View</span>
      </div>

      {/* Loading indicator */}
      {isLoading && !depthData && (
        <div 
          className="absolute bottom-4 left-4 bg-black/70 rounded-lg px-3 py-2 text-xs text-gray-300"
          data-testid="depth-loading"
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" />
            <span>Initializing depth sensor...</span>
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div 
          className="absolute bottom-4 left-4 bg-red-500/20 border border-red-500 rounded-lg px-3 py-2 text-xs text-red-300"
          data-testid="depth-error"
        >
          <div className="flex items-center gap-2">
            <EyeOff className="w-4 h-4" />
            <span>Depth unavailable: {error}</span>
          </div>
        </div>
      )}

      {/* Color legend */}
      <div 
        className="absolute bottom-4 right-4 bg-black/70 rounded-lg px-3 py-2 text-[10px] font-mono text-white border border-cyan-500"
        data-testid="depth-legend"
      >
        <div className="font-semibold mb-1">Depth Map</div>
        <div className="flex items-center gap-1">
          <span className="text-red-400">Close</span>
          <div className="w-16 h-2 bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-cyan-500 to-blue-500 rounded" />
          <span className="text-blue-400">Far</span>
        </div>
      </div>
    </div>
  );
};

export default DepthDataOverlay;
