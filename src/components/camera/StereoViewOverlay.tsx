import React, { useRef, useEffect, useState } from 'react';
import { useCameraStore } from '../../lib/camera';
import { useLicenseCheck } from '../../hooks/useLicenseEnforcement';
import { Maximize2, Lock } from 'lucide-react';
import type { StereoFrame } from '../../lib/camera/CameraInterface';

interface StereoViewOverlayProps {
  videoWidth: number;
  videoHeight: number;
  enabled: boolean;
}

const StereoViewOverlay: React.FC<StereoViewOverlayProps> = ({
  videoWidth,
  videoHeight,
  enabled,
}) => {
  const leftCanvasRef = useRef<HTMLCanvasElement>(null);
  const rightCanvasRef = useRef<HTMLCanvasElement>(null);
  const [stereoFrame, setStereoFrame] = useState<StereoFrame | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const { cameraType, activeCamera } = useCameraStore();
  const { hasAccess, isLoading: licenseLoading } = useLicenseCheck('zed2i_support');

  // Only render if camera type is ZED 2i and has license
  const shouldRender = cameraType === 'zed2i' && hasAccess;

  // Fetch stereo frames from ZED 2i camera
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

    const captureStereoFrame = async () => {
      if (!isMounted || !activeCamera) return;

      try {
        setIsLoading(true);
        setError(null);

        // Use shared camera instance from store
        if (!activeCamera.captureStereoFrame) {
          throw new Error('Camera does not support stereo capture');
        }

        const frame = await activeCamera.captureStereoFrame();
        
        if (isMounted) {
          setStereoFrame(frame);
          setIsLoading(false);
        }

        // Continue capturing frames for live view
        animationFrameRef.current = requestAnimationFrame(captureStereoFrame);
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to capture stereo frames');
          setIsLoading(false);
        }
        // Retry after 2 seconds
        setTimeout(() => {
          if (isMounted) {
            animationFrameRef.current = requestAnimationFrame(captureStereoFrame);
          }
        }, 2000);
      }
    };

    captureStereoFrame();

    return () => {
      isMounted = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [enabled, shouldRender, hasAccess, activeCamera]);

  // Render stereo frames to canvases
  useEffect(() => {
    if (!stereoFrame || !leftCanvasRef.current || !rightCanvasRef.current) {
      return;
    }

    const renderFrame = async (
      canvas: HTMLCanvasElement,
      frame: typeof stereoFrame.left | typeof stereoFrame.right
    ) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = frame.width;
      canvas.height = frame.height;

      // Handle different frame formats
      if (frame.imageData instanceof ImageData) {
        ctx.putImageData(frame.imageData, 0, 0);
      } else if (frame.imageData instanceof Blob) {
        // Create image from blob
        const url = URL.createObjectURL(frame.imageData);
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, frame.width, frame.height);
          URL.revokeObjectURL(url);
        };
        img.src = url;
      }
    };

    renderFrame(leftCanvasRef.current, stereoFrame.left);
    renderFrame(rightCanvasRef.current, stereoFrame.right);
  }, [stereoFrame]);

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
        data-testid="stereo-overlay-license-gate"
      >
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto">
          <div className="bg-black/80 border-2 border-yellow-500 rounded-lg p-6 max-w-sm">
            <div className="flex items-center gap-3 mb-3">
              <Lock className="w-8 h-8 text-yellow-500" />
              <h3 className="text-xl font-bold text-white">Premium Feature</h3>
            </div>
            <p className="text-gray-300 mb-4">
              ZED 2i Stereo Vision requires a Premium License
            </p>
            <p className="text-sm text-gray-400">
              Upgrade to unlock stereo imaging and 3D depth perception.
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
      data-testid="stereo-overlay-container"
    >
      {/* Stereo view container - side by side */}
      <div className="absolute inset-0 flex gap-1">
        {/* Left camera view */}
        <div className="flex-1 relative">
          <canvas
            ref={leftCanvasRef}
            className="w-full h-full object-cover"
            data-testid="stereo-left-canvas"
          />
          <div 
            className="absolute top-2 left-2 bg-black/70 rounded px-2 py-1 text-[10px] font-mono text-cyan-300 border border-cyan-500"
            data-testid="stereo-left-label"
          >
            LEFT
          </div>
        </div>

        {/* Center divider */}
        <div className="w-0.5 bg-cyan-500/50" />

        {/* Right camera view */}
        <div className="flex-1 relative">
          <canvas
            ref={rightCanvasRef}
            className="w-full h-full object-cover"
            data-testid="stereo-right-canvas"
          />
          <div 
            className="absolute top-2 right-2 bg-black/70 rounded px-2 py-1 text-[10px] font-mono text-cyan-300 border border-cyan-500"
            data-testid="stereo-right-label"
          >
            RIGHT
          </div>
        </div>
      </div>

      {/* Status badge */}
      <div 
        className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-cyan-500/20 border border-cyan-500 rounded-lg px-3 py-1.5 text-xs font-semibold text-cyan-300 flex items-center gap-2"
        data-testid="stereo-status-badge"
      >
        <Maximize2 className="w-4 h-4" />
        <span>Stereo Vision Available</span>
      </div>

      {/* Baseline info */}
      {stereoFrame && (
        <div 
          className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/70 rounded-lg px-3 py-2 text-xs font-mono text-white border border-cyan-500"
          data-testid="stereo-baseline-info"
        >
          <div className="flex items-center gap-4">
            <div>
              <span className="text-gray-400">Baseline:</span>{' '}
              <span className="text-cyan-300">{stereoFrame.baseline}mm</span>
            </div>
            <div>
              <span className="text-gray-400">Resolution:</span>{' '}
              <span className="text-cyan-300">{stereoFrame.left.width}x{stereoFrame.left.height}</span>
            </div>
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && !stereoFrame && (
        <div 
          className="absolute bottom-4 left-4 bg-black/70 rounded-lg px-3 py-2 text-xs text-gray-300"
          data-testid="stereo-loading"
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" />
            <span>Initializing stereo cameras...</span>
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div 
          className="absolute bottom-4 left-4 bg-red-500/20 border border-red-500 rounded-lg px-3 py-2 text-xs text-red-300"
          data-testid="stereo-error"
        >
          <div className="flex items-center gap-2">
            <Maximize2 className="w-4 h-4" />
            <span>Stereo unavailable: {error}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default StereoViewOverlay;
