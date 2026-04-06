import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Eye, Camera, CheckCircle2, Wifi, WifiOff } from 'lucide-react';
import { useCameraStore } from '../lib/camera';
import { useSurveyStore } from '../lib/survey/store';
import { safelyStopStream, checkCameraPermission } from '../lib/camera/CameraUtils';
import { createCamera } from '../lib/camera/CameraInterface';
import { useLicenseCheck, useEnabledFeatures } from '../hooks/useLicenseEnforcement';
import { isBetaUser } from '../lib/auth/masterAdmin';
import { getAuth } from 'firebase/auth';

interface CameraOption {
  deviceId: string;
  label: string;
}

interface CameraSettingsProps {
  onCameraSelect?: (deviceId: string) => void;
  onImageSizeSelect?: (width: number, height: number) => void;
  onImageFormatSelect?: (format: 'image/jpeg' | 'image/png') => void;
  onCaptureTypeSelect?: (type: 'manual' | 'auto') => void;
  onOverlayOptionsChange?: (options: {
    showPOI: boolean;
    showGPS: boolean;
    showHeight: boolean;
    showDateTime: boolean;
    showHeading: boolean;
    showLogo: boolean;
    showText: boolean;
  }) => void;
  onVideoModeToggle?: (enabled: boolean) => void;
  onVideoBufferDurationChange?: (duration: number) => void;
}

const CameraSettings: React.FC<CameraSettingsProps> = ({ 
  onCameraSelect,
  onImageSizeSelect,
  onImageFormatSelect,
  onCaptureTypeSelect,
  onOverlayOptionsChange,
  onVideoModeToggle
}) => {
  const [cameras, setCameras] = useState<CameraOption[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');
  
  // Capture settings
  const { autoCapture } = useCameraStore();
  const [captureType, setCaptureType] = useState<'manual' | 'auto'>(autoCapture ? 'auto' : 'manual'); 
  
  // Image settings
  const { imageSize: storedImageSize, imageFormat: storedImageFormat, displayMode: storedDisplayMode } = useCameraStore();
  const [imageSize, setImageSize] = useState<{ width: number; height: number }>(
    storedImageSize || { width: 1280, height: 720 }
  );
  const [imageFormat, setImageFormat] = useState<'image/jpeg' | 'image/png'>(
    storedImageFormat as 'image/jpeg' | 'image/png' || 'image/jpeg'
  );
  const [displayMode, setDisplayMode] = useState<'fit' | 'fill'>(
    storedDisplayMode || 'fit'
  );
  
  // Overlay settings
  const { overlayOptions: storedOverlayOptions } = useCameraStore();
  const [overlayOptions, setOverlayOptions] = useState(storedOverlayOptions || {
    enabled: true, 
    showPOI: true,
    showGPS: true, 
    showHeight: true,
    showDateTime: true,
    showHeading: true,
    showLogo: true,
    showText: true
  }); 
  
  // Advanced settings
  const { videoMode } = useCameraStore();
  const [videoModeEnabled, setVideoModeEnabled] = useState<boolean>(videoMode);
  const { videoBufferDuration } = useCameraStore();
  const [bufferDuration, setBufferDuration] = useState<number>(videoBufferDuration || 5);

  // Get active survey for showing auto-fill indicators
  const activeSurvey = useSurveyStore((state) => state.activeSurvey);
  
  // Camera type and connection state
  const cameraType = useCameraStore((state) => state.cameraType);
  const isAutoDetected = useCameraStore((state) => state.isAutoDetected);
  const isCameraConnected = useCameraStore((state) => state.isCameraConnected);
  const setCameraType = useCameraStore((state) => state.setCameraType);
  const setCameraConnected = useCameraStore((state) => state.setCameraConnected);
  
  // ZED 2i camera selection (left or right)
  const [zedCameraSelection, setZedCameraSelection] = useState<'left' | 'right'>('left');
  
  // Check ZED 2i license
  const { hasAccess: hasZED2iLicense, isLoading: isCheckingLicense } = useLicenseCheck('zed2i_support');
  
  // Check if beta user (hide preview button, image settings, capture type for beta/not-logged-in users)
  const auth = getAuth();
  const { features } = useEnabledFeatures();
  const isBeta = isBetaUser(auth.currentUser, features);

  const previewRef = useRef<HTMLVideoElement | null>(null);

  const commonInputClasses = "w-full p-2 rounded-lg bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white";
  
  // Get available cameras
  const getCameras = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      // Filter for video devices that have labels (labels = available/accessible)
      // Devices without labels are typically unavailable or permission not granted
      const videoDevices = devices.filter(device => 
        device.kind === 'videoinput' && device.label && device.label.trim() !== ''
      );

      if (videoDevices.length === 0) {
        setError('No cameras found');
        setCameras([]);
      } else {
        const cameraOptions = videoDevices.map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${device.deviceId.slice(0, 5)}...`
        }));
        
        // Sort cameras: USB cameras FIRST (ZED 2i, etc.), then integrated cameras LAST
        cameraOptions.sort((a, b) => {
          const aLabel = a.label.toLowerCase();
          const bLabel = b.label.toLowerCase();
          
          // Check if camera is integrated/built-in (laptop webcams)
          const aIsIntegrated = aLabel.includes('integrated') || 
                                aLabel.includes('built-in') || 
                                aLabel.includes('facetime') ||
                                aLabel.includes('hd webcam') ||
                                aLabel.includes('truevision') ||
                                aLabel.includes('lenovo') ||
                                aLabel.includes('hp webcam') ||
                                aLabel.includes('dell webcam') ||
                                aLabel.includes('asus webcam');
                                
          const bIsIntegrated = bLabel.includes('integrated') || 
                                bLabel.includes('built-in') || 
                                bLabel.includes('facetime') ||
                                bLabel.includes('hd webcam') ||
                                bLabel.includes('truevision') ||
                                bLabel.includes('lenovo') ||
                                bLabel.includes('hp webcam') ||
                                bLabel.includes('dell webcam') ||
                                bLabel.includes('asus webcam');
          
          // USB cameras come first, integrated cameras go last
          if (!aIsIntegrated && bIsIntegrated) return -1;
          if (aIsIntegrated && !bIsIntegrated) return 1;
          
          // Otherwise maintain original order
          return 0;
        });
        
        setCameras(cameraOptions);
        
        // Select first camera (now prioritizing integrated) by default if none selected
        if (!selectedCamera && cameraOptions.length > 0) {
          const defaultCamera = cameraOptions[0].deviceId;
          setSelectedCamera(defaultCamera);
          if (onCameraSelect) {
            onCameraSelect(defaultCamera);
          }
        }
      }
    } catch (err) {
      setError('Failed to get cameras');
    } finally {
      setIsLoading(false);
    }
  };

  // Start video preview for a specific camera
  const startPreview = async (deviceId: string): Promise<MediaStream | null> => {
    try {
      // Ensure video element is available
      if (!previewRef.current) {
        throw new Error('Video element not available');
      }

      // Stop any existing preview
      if (previewRef.current.srcObject) {
        const stream = previewRef.current.srcObject as MediaStream;
        safelyStopStream(stream);
        previewRef.current.srcObject = null;
      }

      // Add a delay to ensure resources are released
      await new Promise(resolve => setTimeout(resolve, 300));

      // Start new preview with more specific constraints
      const constraints = {
        video: {
          deviceId: deviceId ? { ideal: deviceId } : undefined,
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      };

      // First verify the camera is available
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      // Use first available camera if selected one is not available
      if (!videoDevices.some(device => device.deviceId === deviceId) && videoDevices.length > 0) {
        const fallbackCamera = videoDevices[0].deviceId;
        setSelectedCamera(fallbackCamera);
        constraints.video.deviceId = fallbackCamera ? { ideal: fallbackCamera } : undefined;
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const videoTracks = stream?.getVideoTracks();
      
      if (!videoTracks || videoTracks.length === 0) {
        throw new Error('No video track available from the selected camera');
      }

      // Double check video element is still available
      if (!previewRef.current) {
        stream.getTracks().forEach(track => track.stop());
        throw new Error('Video element not available for preview');
      }

      previewRef.current.srcObject = stream;
      
      // Wait for metadata to load before playing
      await new Promise((resolve, reject) => {
        if (!previewRef.current) {
          reject('Video element not available');
          return;
        }
        previewRef.current.onloadedmetadata = resolve;
        previewRef.current.onerror = reject;
      });
      
      await previewRef.current.play().catch(e => {});
      return stream;
    } catch (err) {
      setError('Failed to start camera preview');
      return null;
    }
  };

  // Handle camera refresh
  const handleRefresh = () => {
    getCameras();
  };

  // Handle camera selection
  const handleCameraSelect = (deviceId: string) => {
    setSelectedCamera(deviceId);
    if (onCameraSelect) {
      onCameraSelect(deviceId);
    }
    
    // Update the camera store with the selected camera
    useCameraStore.getState().setSelectedCamera(deviceId);
    
    // Force camera restart
    if (previewRef.current?.srcObject) {
      const stream = previewRef.current?.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      previewRef.current.srcObject = null;
    }
    if (showPreview) {
      startPreview(deviceId);
    }
  };

  // Toggle preview with retry mechanism
  const togglePreview = async () => {
    if (showPreview) {
      // Stop current preview if active
      if (previewRef.current?.srcObject) {
        const stream = previewRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        previewRef.current.srcObject = null;
      }
      setShowPreview(false);
    } else {
      if (selectedCamera) {
        setShowPreview(true);
        // Wait for next render cycle when video element will be in DOM
        requestAnimationFrame(async () => {
          let attempts = 0;
          const maxAttempts = 5;
          
          const tryStartPreview = async () => {
            if (!previewRef.current && attempts < maxAttempts) {
              attempts++;
              setTimeout(tryStartPreview, 100);
              return;
            }
            
            if (!previewRef.current) {
              setError('Failed to initialize video preview after multiple attempts');
              setShowPreview(false);
              return;
            }
            
            await startPreview(selectedCamera);
          };
          
          await tryStartPreview();
        });
      }
    }
  };

  // Handle connect camera
  const handleConnect = async () => {
    if (!cameraType) {
      setError('Please select a camera type');
      return;
    }
    
    try {
      setError(null);
      
      // Pass ZED camera selection if applicable
      await createCamera(cameraType, {
        zedCameraSelection: cameraType === 'zed2i' ? zedCameraSelection : undefined,
      });
      
      setCameraConnected(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect camera';
      setError(errorMessage);
      setCameraConnected(false);
    }
  };
  
  // Handle disconnect camera
  const handleDisconnect = () => {
    
    // Stop any active preview
    if (previewRef.current?.srcObject) {
      const stream = previewRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      previewRef.current.srcObject = null;
    }
    
    // Update connection state
    setCameraConnected(false);
    setShowPreview(false);
  };

  // Initialize cameras when component mounts
  useEffect(() => {
    const initCamera = async () => {
      // First check permission status
      const permission = await checkCameraPermission();
      setPermissionStatus(permission);
      
      getCameras();
    }

    initCamera();

    return () => {
      // Cleanup: stop all active streams
      if (previewRef.current?.srcObject) {
        safelyStopStream(previewRef.current.srcObject as MediaStream);
        previewRef.current.srcObject = null;
      }
    };
  }, []);

  // Apply camera settings to the useCameraStore when they change
  useEffect(() => {
    useCameraStore.getState().setImageSize(imageSize.width, imageSize.height);
  }, [imageSize]);
  
  useEffect(() => {
    useCameraStore.getState().setImageFormat(imageFormat); 
  }, [imageFormat]);
  
  useEffect(() => {
    useCameraStore.getState().setOverlayOptions(overlayOptions); 
  }, [overlayOptions]);
  
  useEffect(() => {
    useCameraStore.getState().setAutoCapture(captureType === 'auto'); 
  }, [captureType]);
  
  useEffect(() => {
    useCameraStore.getState().setDisplayMode(displayMode);
  }, [displayMode]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Camera className="w-5 h-5" />
          Camera Settings
        </h2>
        {/* Show Preview button (Hidden for beta users) */}
        {!isBeta && (
          <button
            onClick={togglePreview}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${showPreview ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'} transition-colors`}
          >
            <Eye className="w-4 h-4" />
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>
        )}
      </div>

      {/* Preview section (Hidden for beta users) */}
      {!isBeta && showPreview && (
        <div className="mt-4">
          <div className="bg-black aspect-video rounded-lg overflow-hidden relative">
          <video
            ref={previewRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
          </div>
        </div>
      )}

      {/* Camera Type Selection */}
      <div className="space-y-4 bg-gray-800/50 p-4 rounded-lg border border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Camera Type</h3>
          <div className="flex items-center gap-2">
            <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${
              isCameraConnected 
                ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                : 'bg-gray-700 text-gray-400 border border-gray-600'
            }`}
            data-testid="status-camera-connection">
              {isCameraConnected ? (
                <>
                  <Wifi className="w-4 h-4" />
                  Connected
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4" />
                  Disconnected
                </>
              )}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {/* Standard Camera Radio Button */}
          <label 
            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
              cameraType === 'standard'
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-gray-600 bg-gray-700/50 hover:border-gray-500'
            } ${isCameraConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
            data-testid="radio-camera-type-standard"
          >
            <input
              type="radio"
              name="cameraType"
              value="standard"
              checked={cameraType === 'standard'}
              onChange={() => !isCameraConnected && setCameraType('standard')}
              disabled={isCameraConnected}
              className="w-4 h-4"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">Standard Camera</span>
                {isAutoDetected && cameraType === 'standard' && (
                  <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30" data-testid="badge-recommended">
                    Recommended
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-400 mt-1">
                Regular webcam or built-in camera
              </p>
            </div>
          </label>

          {/* ZED 2i Camera Radio Button - hidden for beta users */}
          {!isBeta && (
            <>
              <label 
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  hasZED2iLicense && !isCameraConnected
                    ? 'cursor-pointer hover:border-gray-500'
                    : 'cursor-not-allowed opacity-50'
                } ${
                  cameraType === 'zed2i'
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-600 bg-gray-700/50'
                }`}
                data-testid="radio-camera-type-zed2i"
              >
                <input
                  type="radio"
                  name="cameraType"
                  value="zed2i"
                  checked={cameraType === 'zed2i'}
                  onChange={() => !isCameraConnected && hasZED2iLicense && setCameraType('zed2i')}
                  disabled={isCameraConnected || !hasZED2iLicense}
                  className="w-4 h-4"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">ZED 2i Stereo Camera</span>
                    {isAutoDetected && cameraType === 'zed2i' && (
                      <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30" data-testid="badge-recommended">
                        Recommended
                      </span>
                    )}
                    {!hasZED2iLicense && !isCheckingLicense && (
                      <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30" data-testid="badge-premium-required">
                        Requires Premium License
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 mt-1">
                    Stereo camera with depth sensing
                  </p>
                </div>
              </label>

              {/* ZED 2i Camera Selection (Left/Right) */}
              {cameraType === 'zed2i' && !isCameraConnected && (
                <div className="ml-7 mt-2 p-3 bg-gray-700/30 rounded-lg border border-gray-600/50">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Camera Selection
                  </label>
                  <select
                    value={zedCameraSelection}
                    onChange={(e) => setZedCameraSelection(e.target.value as 'left' | 'right')}
                    className={commonInputClasses}
                    data-testid="select-zed-camera"
                  >
                    <option value="left">Left Camera</option>
                    <option value="right">Right Camera</option>
                  </select>
                  <p className="text-xs text-gray-400 mt-2">
                    💡 <strong>USB Mode:</strong> Select left or right camera for standard video (no GPU required)<br />
                    💎 <strong>Premium Mode:</strong> Requires ZED SDK + NVIDIA GPU for depth sensing
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Connect/Disconnect Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleConnect}
            disabled={isCameraConnected || !cameraType}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
            data-testid="button-connect-camera"
          >
            Connect Camera
          </button>
          <button
            onClick={handleDisconnect}
            disabled={!isCameraConnected}
            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
            data-testid="button-disconnect-camera"
          >
            Disconnect Camera
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium">Camera Selection</label>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg"
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {error && (
            <div className="bg-red-500/20 border-l-4 border-red-500 p-4 rounded-lg mb-4">
              <p className="text-red-500">{error}</p>
            </div>
          )}
          
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm">
              <span className="text-gray-400">Camera permission: </span>
              <span className={`font-medium ${
                permissionStatus === 'granted' ? 'text-green-500' :
                permissionStatus === 'denied' ? 'text-red-500' :
                'text-yellow-500'
              }`}>
                {permissionStatus}
              </span>
              {permissionStatus === 'denied' && (
                <div className="mt-2">
                  <p className="text-xs text-red-400 mb-2">Camera access is blocked. Please check your browser settings.</p>
                  <button 
                    onClick={async() => {
                      try {
                        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                        stream.getTracks().forEach(track => track.stop());
                        setPermissionStatus('granted');
                        getCameras();
                      } catch (err) {
                      }
                    }}
                    className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded"
                  >
                    Request Access
                  </button>
                </div>
              )}
            </div>
          </div>

          <select
            className={commonInputClasses}
            value={selectedCamera}
            onChange={(e) => handleCameraSelect(e.target.value)}
            disabled={isLoading}
          >
            <option value="">Select a camera...</option>
            {cameras.map((camera) => (
              <option key={camera.deviceId} value={camera.deviceId}>
                {camera.label}
              </option>
            ))}
          </select>
        </div>

        {/* Image Settings (Hidden for beta users - only show Display Mode) */}
        {!isBeta && (
          <>
            <h3 className="text-lg font-medium mt-6 mb-4">Image Settings</h3>
            <div>
              <label className="block text-sm font-medium mb-1">
                Image Size
                <span className="ml-2 text-xs text-gray-500">
                  (Changes require camera restart)
                </span>
              </label>
              <select
                className={`${commonInputClasses}`}
                value={`${imageSize.width}x${imageSize.height}`}
                onChange={(e) => {
                  const [width, height] = e.target.value.split('x').map(Number);
                  setImageSize({ width, height });
                  onImageSizeSelect?.(width, height);
                }}
              >
                <option value="640x480">640x480</option>
                <option value="1280x720">1280x720 (720p)</option>
                <option value="1920x1080">1920x1080 (1080p)</option>
                <option value="3840x2160">3840x2160 (4K)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Image Format</label>
              <select
                className={commonInputClasses}
                value={imageFormat}
                onChange={(e) => {
                  setImageFormat(e.target.value as 'image/jpeg' | 'image/png');
                  onImageFormatSelect?.(e.target.value as 'image/jpeg' | 'image/png');
                }}
              >
                <option value="image/jpeg">JPEG</option>
                <option value="image/png">PNG</option>
              </select>
            </div>
          </>
        )}

        {/* Display Mode (Always visible) */}
        <div>
          <label className="block text-sm font-medium mb-1">Display Mode</label>
          <select
            className={commonInputClasses}
            value={displayMode}
            onChange={(e) => {
              const mode = e.target.value as 'fit' | 'fill';
              setDisplayMode(mode);
            }}
            data-testid="select-display-mode"
          >
            <option value="fit">Fit (shows full image, may have black bars)</option>
            <option value="fill">Fill (fills container, may crop edges)</option>
          </select>
        </div>

        {/* Capture Settings (Hidden for beta users) */}
        {!isBeta && (
          <div>
            <label className="block text-sm font-medium mb-1">Capture Type</label>
            <select
              className={commonInputClasses}
              value={captureType}
              onChange={(e) => {
                setCaptureType(e.target.value as 'manual' | 'auto');
                onCaptureTypeSelect?.(e.target.value as 'manual' | 'auto');
              }}
            >
              <option value="manual">Manual</option>
              <option value="auto">Auto</option>
            </select>
          </div>
        )}

        {/* Overlay Settings */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium">Information Overlay</label>
            <div className="relative inline-block w-10 align-middle select-none">
              <input
                type="checkbox"
                id="overlay-enabled"
                checked={overlayOptions.enabled}
                onChange={e => {
                  const newOptions = {
                    ...overlayOptions,
                    enabled: e.target.checked
                  };
                  setOverlayOptions(newOptions);
                  if (onOverlayOptionsChange) {
                    onOverlayOptionsChange(newOptions);
                  }
                }}
                className="sr-only"
              />
              <label
                htmlFor="overlay-enabled"
                className={`block h-6 rounded-full cursor-pointer transition-colors ${
                  overlayOptions.enabled ? 'bg-blue-500' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`block h-5 w-5 mt-0.5 ml-0.5 rounded-full transition-transform transform ${
                    overlayOptions.enabled ? 'translate-x-4 bg-white' : 'translate-x-0 bg-gray-300'
                  }`}
                />
              </label>
            </div>
          </div>
          
          {overlayOptions.enabled && (
            <div className="grid grid-cols-2 gap-2 mt-4">
              {Object.entries(overlayOptions || {})
                .filter(([key]) => key !== 'enabled')
                .map(([key, value]) => (
                  <div key={key} className="flex items-center">
                    <input
                      type="checkbox"
                      id={key}
                      checked={!!value}
                      onChange={(e) => {
                        const newOptions = {
                          ...overlayOptions,
                          [key]: e.target.checked,
                        };
                        setOverlayOptions(newOptions);
                        if (onOverlayOptionsChange) {
                          const { enabled, ...rest } = newOptions;
                          onOverlayOptionsChange(rest);
                        }
                      }}
                      className="w-4 h-4 rounded border-gray-600 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-800 mr-2"
                    />
                    <label htmlFor={key} className="text-sm">
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}
                    </label>
                  </div>
                ))}
            </div>
          )}
        </div>
        
        {/* Survey Information */}
        <div className="space-y-4 border-t border-gray-700 pt-4">
          <h3 className="text-lg font-medium">Survey Information</h3>
          <p className="text-sm text-gray-400">Add survey details to overlay and EXIF metadata</p>
          
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <label className="block text-sm font-medium">Survey Title</label>
                  {activeSurvey && (
                    <span className="inline-flex items-center gap-1 bg-green-900/30 border border-green-600/50 rounded-full px-2 py-0.5">
                      <CheckCircle2 className="w-3 h-3 text-green-400" />
                      <span className="text-green-400 text-xs font-medium">Auto-filled</span>
                    </span>
                  )}
                </div>
                <input
                  type="checkbox"
                  checked={overlayOptions.showSurveyTitle || false}
                  onChange={(e) => {
                    const newOptions = {
                      ...overlayOptions,
                      showSurveyTitle: e.target.checked,
                    };
                    setOverlayOptions(newOptions);
                  }}
                  className="w-4 h-4 rounded border-gray-600 text-blue-500"
                  data-testid="checkbox-show-survey-title"
                />
              </div>
              {activeSurvey && (
                <p className="text-xs text-green-400 mb-1">From active survey: {activeSurvey.surveyTitle || activeSurvey.name}</p>
              )}
              <input
                type="text"
                value={useCameraStore.getState().overlayFields.surveyTitle}
                onChange={(e) => {
                  useCameraStore.getState().setOverlayFields({ surveyTitle: e.target.value });
                }}
                placeholder="Enter survey title"
                className={commonInputClasses}
                data-testid="input-survey-title"
              />
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <label className="block text-sm font-medium">Project Number</label>
                  {activeSurvey && (
                    <span className="inline-flex items-center gap-1 bg-green-900/30 border border-green-600/50 rounded-full px-2 py-0.5">
                      <CheckCircle2 className="w-3 h-3 text-green-400" />
                      <span className="text-green-400 text-xs font-medium">Auto-filled</span>
                    </span>
                  )}
                </div>
                <input
                  type="checkbox"
                  checked={overlayOptions.showProjectNumber || false}
                  onChange={(e) => {
                    const newOptions = {
                      ...overlayOptions,
                      showProjectNumber: e.target.checked,
                    };
                    setOverlayOptions(newOptions);
                  }}
                  className="w-4 h-4 rounded border-gray-600 text-blue-500"
                  data-testid="checkbox-show-project-number"
                />
              </div>
              {activeSurvey && (
                <p className="text-xs text-green-400 mb-1">From active survey: {activeSurvey.projectNumber}</p>
              )}
              <input
                type="text"
                value={useCameraStore.getState().overlayFields.projectNumber}
                onChange={(e) => {
                  useCameraStore.getState().setOverlayFields({ projectNumber: e.target.value });
                }}
                placeholder="Enter project number"
                className={commonInputClasses}
                data-testid="input-project-number"
              />
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <label className="block text-sm font-medium">Surveyor Name</label>
                  {activeSurvey && (
                    <span className="inline-flex items-center gap-1 bg-green-900/30 border border-green-600/50 rounded-full px-2 py-0.5">
                      <CheckCircle2 className="w-3 h-3 text-green-400" />
                      <span className="text-green-400 text-xs font-medium">Auto-filled</span>
                    </span>
                  )}
                </div>
                <input
                  type="checkbox"
                  checked={overlayOptions.showSurveyorName || false}
                  onChange={(e) => {
                    const newOptions = {
                      ...overlayOptions,
                      showSurveyorName: e.target.checked,
                    };
                    setOverlayOptions(newOptions);
                  }}
                  className="w-4 h-4 rounded border-gray-600 text-blue-500"
                  data-testid="checkbox-show-surveyor-name"
                />
              </div>
              {activeSurvey && (
                <p className="text-xs text-green-400 mb-1">From active survey: {activeSurvey.surveyorName || activeSurvey.surveyor}</p>
              )}
              <input
                type="text"
                value={useCameraStore.getState().overlayFields.surveyorName}
                onChange={(e) => {
                  useCameraStore.getState().setOverlayFields({ surveyorName: e.target.value });
                }}
                placeholder="Enter surveyor name"
                className={commonInputClasses}
                data-testid="input-surveyor-name"
              />
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium">POI Notes</label>
                <input
                  type="checkbox"
                  checked={overlayOptions.showPOINotes || false}
                  onChange={(e) => {
                    const newOptions = {
                      ...overlayOptions,
                      showPOINotes: e.target.checked,
                    };
                    setOverlayOptions(newOptions);
                  }}
                  className="w-4 h-4 rounded border-gray-600 text-blue-500"
                  data-testid="checkbox-show-poi-notes"
                />
              </div>
              <textarea
                value={useCameraStore.getState().overlayFields.poiNotes}
                onChange={(e) => {
                  useCameraStore.getState().setOverlayFields({ poiNotes: e.target.value });
                }}
                placeholder="Enter POI notes"
                className={commonInputClasses}
                rows={3}
                data-testid="input-poi-notes"
              />
            </div>
          </div>
        </div>
        
        {/* Advanced Settings */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">Video Settings</label>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="videoMode"
              checked={videoModeEnabled}
              onChange={(e) => {
                setVideoModeEnabled(e.target.checked);
                onVideoModeToggle?.(e.target.checked);
                useCameraStore.getState().setVideoMode(e.target.checked);
              }} 
              className="mr-2"
            />
            <label htmlFor="videoMode" className="text-sm">
              Enable Video Mode
            </label>
          </div>
            
            {videoModeEnabled && (
              <div className="mt-4 bg-blue-900/20 border border-blue-800/30 p-3 rounded-lg">
                <h4 className="text-sm font-medium text-blue-400 mb-2">Video Buffer Settings</h4>
                <p className="text-xs text-gray-300 mb-3">
                  When object detection is active, the system will save video footage from before the detection event.
                </p>
                <div className="space-y-2">
                  <label className="block text-sm">
                    Buffer Duration (seconds before detection)
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={bufferDuration}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      setBufferDuration(value);
                      useCameraStore.getState().setVideoBufferDuration(value);
                    }}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>1s</span>
                    <span>{bufferDuration}s</span>
                    <span>10s</span>
                  </div>
                </div>
              </div>
            )}
        </div>

        {isLoading && (
          <div className="flex justify-center">
            <div className="animate-spin h-6 w-6 border-t-2 border-b-2 border-blue-500 rounded-full"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CameraSettings;