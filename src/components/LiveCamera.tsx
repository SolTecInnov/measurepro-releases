import React, { useState, useEffect } from 'react';
import { Brain, Zap, Database, Clock, Truck, Route } from 'lucide-react';
import { Measurement } from '../types';
import { useCameraStore } from '../lib/camera';
import { useSerialStore } from '../lib/stores/serialStore';
import { useSettingsStore } from '../lib/settings';
import { useEnvelopeStore } from '../stores/envelopeStore';
import { useSurveyStore } from '../lib/survey/store';
import { useAlertsStore } from '../lib/stores/alertsStore';
import { safelyStopStream, getWebcamErrorMessage } from '../lib/camera/CameraUtils';
import { frameBuffer } from '@/lib/camera/frameBuffer';
import AlertBanner from './AlertBanner';
import CameraOverlay from './camera/CameraOverlay';
import CameraControls from './camera/CameraControls';
import VideoRecordingControls from './VideoRecordingControls';
import GeoVideoRecordingControls from './camera/GeoVideoRecordingControls';
import DetectionOverlay from './camera/DetectionOverlay';
import DetectionZoneOverlay from './camera/DetectionZoneOverlay';
import DetectionCorrectionDialog from './ai/DetectionCorrectionDialog';
import EnvelopeClearanceOverlay from './camera/EnvelopeClearanceOverlay';
import DepthDataOverlay from './camera/DepthDataOverlay';
import StereoViewOverlay from './camera/StereoViewOverlay';
import CameraStatusBadge from './camera/CameraStatusBadge';
import MeasurementOverlay from './measurement/MeasurementOverlay';
import { useDetectionManager } from '../hooks/useDetectionManager';
import { useTrainingSession } from '../hooks/useTrainingSession';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { getTrainingDataSize } from '../lib/training';
import { toast } from 'sonner';
import { videoRecorder } from '../lib/video/VideoRecorder';
import { useCalibrationStore } from '../stores/calibrationStore';
import { useSweptPathStore } from '../stores/sweptPathStore';
import AnalyzeTurnButton from './sweptPath/AnalyzeTurnButton';
import SweptPathOverlay from './sweptPath/SweptPathOverlay';
import RoadDetectionDebugOverlay from './sweptPath/RoadDetectionDebugOverlay';
import { useCameraDisconnectMonitor } from '../hooks/useCameraDisconnectMonitor';
import { isBetaUser } from '../lib/auth/masterAdmin';
import { useEnabledFeatures } from '../hooks/useLicenseEnforcement';
import { getAuth } from 'firebase/auth';

interface LiveCameraProps {
  captureImage: () => void;
  videoRef: React.RefObject<HTMLVideoElement>;
  measurements: Measurement[];
}

const LiveCamera: React.FC<LiveCameraProps> = ({
  captureImage,
  videoRef,
  measurements,
}) => {
  const {
    selectedCamera,
    overlayOptions: cameraOverlayOptions,
    videoMode,
    displayMode,
    cameraType,
    activeCamera,
    setActiveStream,
    setActiveCamera,
    setCameraConnected
  } = useCameraStore();
  
  const { aiSettings } = useSettingsStore();
  const { lastMeasurement } = useSerialStore();
  const { isMonitoring: isEnvelopeMonitoring } = useEnvelopeStore();
  const { calibrationData } = useCalibrationStore();
  const { settings: sweptPathSettings, currentAnalysis, debugState } = useSweptPathStore();
  const { activeSurvey } = useSurveyStore();
  const { alertStatus, triggerValue, setAlertStatus } = useAlertsStore();
  
  // Check if beta user (hide video recording and status badges for beta/not-logged-in users)
  const auth = getAuth();
  const { features } = useEnabledFeatures();
  const isBeta = isBetaUser(auth.currentUser, features);

  const [isWebcamLoading, setIsWebcamLoading] = useState(true);
  const [webcamError, setWebcamError] = useState<string | null>(null);
  const [isVideoElementReady, setIsVideoElementReady] = useState(false);
  const [cameraStartAttempts, setCameraStartAttempts] = useState(0);
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);
  const [videoSize, setVideoSize] = useState({ width: 1280, height: 960 });
  
  // ZED 2i premium feature toggles
  const [showDepthView, setShowDepthView] = useState(false);
  const [showStereoView, setShowStereoView] = useState(false);
  
  // Overlay visibility from store (controlled by CardWrapper header)
  const { showLiveOverlay } = useCameraStore();
  
  // ZED 2i USB mode camera selection
  const [zedCameraSelection, setZedCameraSelection] = useState<'left' | 'right' | null>(null);
  const [isZedUSBMode, setIsZedUSBMode] = useState(false);

  // Resizable height state
  const [cardHeight, setCardHeight] = useState<number>(() => {
    const saved = localStorage.getItem('live_camera_height');
    return saved ? parseInt(saved) : 400;
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartHeight, setDragStartHeight] = useState(0);

  const overlayOptions = cameraOverlayOptions || { 
    enabled: true, 
    showPOI: true, 
    showGPS: true, 
    showHeight: true, 
    showDateTime: true, 
    showHeading: true, 
    showLogo: false, 
    showText: false 
  };
  
  // AI Detection and Training hooks
  const {
    isActive: isDetectionActive,
    detectionCount,
    activeDetections,
    showCorrectionDialog,
    currentDetection,
    handleAccept,
    handleReject,
    handleCorrect,
    handleCorrectionSubmit,
    setShowCorrectionDialog,
    triggerTestDetection,
  } = useDetectionManager({ videoRef });

  const {
    isActive: isTrainingActive,
    frameCount,
    sessionStartTime,
  } = useTrainingSession(videoRef);

  // Camera disconnect monitoring
  const {
    handleDisconnect,
    reconnecting,
    lastDisconnectReason,
    reconnectionAttempts,
  } = useCameraDisconnectMonitor();

  // Training data info
  const [trainingDataSize, setTrainingDataSize] = useState<number>(0);

  // Load training data size
  useEffect(() => {
    if (isTrainingActive) {
      const updateDataSize = async () => {
        try {
          const size = await getTrainingDataSize();
          setTrainingDataSize(size.sizeInMB);
        } catch (error) {
        }
      };

      // Update every 5 seconds
      const interval = setInterval(updateDataSize, 5000);
      updateDataSize(); // Initial load

      return () => clearInterval(interval);
    }
  }, [isTrainingActive]);

  // Calculate session duration
  const getSessionDuration = () => {
    if (!sessionStartTime) return '00:00';
    const duration = Math.floor((Date.now() - sessionStartTime) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const [sessionDuration, setSessionDuration] = useState('00:00');

  // Update session duration every second
  useEffect(() => {
    if (isTrainingActive && sessionStartTime) {
      const interval = setInterval(() => {
        setSessionDuration(getSessionDuration());
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isTrainingActive, sessionStartTime]);

  // Video recording controls from camera store
  const { isRecording, setIsRecording } = useCameraStore();

  // Handle video recording toggle
  const handleToggleVideoRecording = async () => {
    if (!videoMode) {
      toast.error('Video mode must be enabled in Camera Settings');
      return;
    }

    if (!videoRef.current || !videoRef.current.srcObject) {
      toast.error('Camera not available');
      return;
    }

    try {
      if (isRecording) {
        const recording = await videoRecorder.stopRecording();
        setIsRecording(false);
        if (recording) {
          toast.success('Video recording stopped');
        }
      } else {
        videoRecorder.initialize(videoRef.current.srcObject as MediaStream, videoRef.current);
        videoRecorder.startRecording();
        setIsRecording(true);
        toast.success('Video recording started');
      }
    } catch (error) {
      toast.error('Failed to toggle video recording');
    }
  };

  // Handle detection shortcuts - wrap with pending detection check
  const handleAcceptWithCheck = () => {
    if (currentDetection) {
      handleAccept(currentDetection);
    } else {
      toast.info('No pending detection to accept');
    }
  };

  const handleRejectWithCheck = () => {
    if (currentDetection) {
      handleReject(currentDetection);
    } else {
      toast.info('No pending detection to reject');
    }
  };

  const handleCorrectWithCheck = () => {
    if (currentDetection) {
      handleCorrect(currentDetection);
    } else {
      toast.info('No pending detection to correct');
    }
  };

  // Integrate keyboard shortcuts
  useKeyboardShortcuts({
    onAcceptDetection: handleAcceptWithCheck,
    onRejectDetection: handleRejectWithCheck,
    onCorrectDetection: handleCorrectWithCheck,
    onTestDetection: triggerTestDetection,
    onToggleVideoRecording: handleToggleVideoRecording,
    enabled: true,
  });

  // ZED 2i feature keyboard shortcuts (D = Depth, S = Stereo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if we're in an input, textarea or contenteditable
      if (
        e.target instanceof HTMLInputElement || 
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }

      // Toggle depth view with 'D' key
      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        setShowDepthView(prev => {
          const newValue = !prev;
          toast.info(newValue ? '🔍 Depth View Enabled' : '🔍 Depth View Disabled');
          return newValue;
        });
      }

      // Toggle stereo view with 'S' key
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        setShowStereoView(prev => {
          const newValue = !prev;
          toast.info(newValue ? '👁️ Stereo View Enabled' : '👁️ Stereo View Disabled');
          return newValue;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Resize handlers for card height
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const deltaY = e.clientY - dragStartY;
      const newHeight = Math.max(300, Math.min(1200, dragStartHeight + deltaY));
      setCardHeight(newHeight);
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        // Save to localStorage
        localStorage.setItem('live_camera_height', cardHeight.toString());
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, dragStartY, dragStartHeight, cardHeight]);

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStartY(e.clientY);
    setDragStartHeight(cardHeight);
  };

  // Detect ZED 2i USB mode and camera selection
  useEffect(() => {
    if (activeCamera && cameraType === 'zed2i') {
      const zedCamera = activeCamera as any;
      if (zedCamera.getMode && zedCamera.getSelectedCamera) {
        const mode = zedCamera.getMode();
        const selection = zedCamera.getSelectedCamera();
        
        setIsZedUSBMode(mode === 'usb');
        setZedCameraSelection(selection);
      }
    } else {
      setIsZedUSBMode(false);
      setZedCameraSelection(null);
    }
  }, [activeCamera, cameraType, selectedCamera]);
  
  // Also update when video loads - catches any runtime mode changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const handleMetadataLoaded = () => {
      if (activeCamera && cameraType === 'zed2i') {
        const zedCamera = activeCamera as any;
        if (zedCamera.getMode && zedCamera.getSelectedCamera) {
          const mode = zedCamera.getMode();
          const selection = zedCamera.getSelectedCamera();
          
          setIsZedUSBMode(mode === 'usb');
          setZedCameraSelection(selection);
        }
      }
    };
    
    video.addEventListener('loadedmetadata', handleMetadataLoaded);
    return () => video.removeEventListener('loadedmetadata', handleMetadataLoaded);
  }, [activeCamera, cameraType, videoRef]);

  // Track video element dimensions - use rendered size, not intrinsic size
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateSize = () => {
      // Use clientWidth/clientHeight to get the actual rendered size in the DOM
      // This accounts for CSS scaling (object-fit, etc.)
      const renderedWidth = video.clientWidth;
      const renderedHeight = video.clientHeight;
      
      if (renderedWidth > 0 && renderedHeight > 0) {
        setVideoSize({
          width: renderedWidth,
          height: renderedHeight,
        });
      }
    };

    video.addEventListener('loadedmetadata', updateSize);
    video.addEventListener('resize', updateSize);
    
    // Also listen for window resize in case the container size changes
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(video);
    
    // Initial size check
    updateSize();

    return () => {
      video.removeEventListener('loadedmetadata', updateSize);
      video.removeEventListener('resize', updateSize);
      resizeObserver.disconnect();
    };
  }, [videoRef]);
  
  // Stable effect for laser updates
  React.useEffect(() => {
    const handleLaserUpdate = () => {
      forceUpdate();
    };
    
    window.addEventListener('laser-measurement-update', handleLaserUpdate as EventListener);
    
    return () => {
      window.removeEventListener('laser-measurement-update', handleLaserUpdate as EventListener);
    };
  }, []);
  
  // Stable effect for measurement changes
  React.useEffect(() => {
    forceUpdate();
  }, [lastMeasurement]);

  // Frame buffer lifecycle management - start when video is active, stop when inactive
  useEffect(() => {
    const video = videoRef.current;
    const { activeStream } = useCameraStore.getState();
    
    if (!video || !activeStream) {
      return;
    }

    const handleVideoReady = () => {
      if (video.readyState >= 2) {
        frameBuffer.start(video);
      }
    };

    if (video.readyState >= 2) {
      frameBuffer.start(video);
    } else {
      video.addEventListener('loadeddata', handleVideoReady);
    }

    return () => {
      video.removeEventListener('loadeddata', handleVideoReady);
      frameBuffer.stop();
    };
  }, [videoRef, activeCamera]);

  // Component cleanup - clear stream and camera on unmount
  useEffect(() => {
    return () => {
      frameBuffer.stop();
      setActiveStream(null);
      
      // Clean up camera instance
      const cleanup = async () => {
        const { activeCamera } = useCameraStore.getState();
        if (activeCamera) {
          try {
            await activeCamera.shutdown();
            setActiveCamera(null);
          } catch (error) {
          }
        }
      };
      cleanup();
    };
  }, []);

  // Create and manage camera instance based on camera type
  useEffect(() => {
    if (!cameraType) {
      return;
    }

    let isMounted = true;
    let isInitializing = false;

    const initializeCamera = async () => {
      // Prevent double initialization
      if (isInitializing) {
        return;
      }
      isInitializing = true;
      try {
        // First, shut down any existing camera instance AND video element stream
        const { activeCamera: existingCamera } = useCameraStore.getState();
        if (existingCamera) {
          try {
            // Stop video element stream first
            if (videoRef.current?.srcObject) {
              const stream = videoRef.current.srcObject as MediaStream;
              stream.getTracks().forEach(track => track.stop());
              videoRef.current.srcObject = null;
            }
            
            await existingCamera.shutdown();
            setActiveCamera(null);
            setActiveStream(null);
            // Give it a moment to fully release resources
            await new Promise(resolve => setTimeout(resolve, 300));
          } catch (err) {
          }
        }

        // Initialize camera with disconnect callback
        let cameraWithCallback;
        if (cameraType === 'zed2i') {
          const { ZED2iCamera } = await import('../lib/camera/ZED2iCamera');
          cameraWithCallback = new ZED2iCamera({ onDisconnect: handleDisconnect });
          await cameraWithCallback.initialize();
        } else {
          const { StandardCamera } = await import('../lib/camera/StandardCamera');
          cameraWithCallback = new StandardCamera({ 
            onDisconnect: handleDisconnect,
            deviceId: selectedCamera // Pass the selected camera deviceId
          });
          await cameraWithCallback.initialize();
        }

        if (isMounted) {
          setActiveCamera(cameraWithCallback);
          // Note: Don't update video element here - let handleStartCamera do it
          // to avoid race conditions
        } else {
          // Component unmounted during initialization, clean up
          await cameraWithCallback.shutdown();
        }
      } catch (error) {
        // Don't block the app if camera creation fails
        // Overlays will handle missing camera gracefully
      } finally {
        isInitializing = false;
      }
    };

    initializeCamera();

    return () => {
      isMounted = false;
    };
  }, [cameraType, selectedCamera, handleDisconnect, setActiveCamera]);

  // Check if video element is available
  useEffect(() => {
    if (videoRef.current) {
      setIsVideoElementReady(true);
    }
  }, [videoRef]);

  // Initialize camera when activeCamera is ready (not when selectedCamera changes)
  // This prevents race condition where handleStartCamera runs before camera instance is created
  useEffect(() => {
    // If activeCamera exists, permission was already granted during initialization
    // No need to check permissionState - that creates a deadlock!
    if (activeCamera && isVideoElementReady) {
      handleStartCamera();
    }
  }, [activeCamera, isVideoElementReady]);

  // Note: Camera switching is now handled by the camera instance recreation effect above
  // When selectedCamera changes, the camera instance is recreated with the new deviceId
  // and the activeCamera effect triggers handleStartCamera to update the video element

  // Handle camera start with retry mechanism
  const handleStartCamera = async () => {
    // DON'T set isWebcamLoading=true here - it removes video element from DOM!
    // Only clear error state
    setWebcamError(null); 
    setCameraStartAttempts(prev => prev + 1);

    let attempts = 0;
    const maxAttempts = 5;
    
    const tryStartCamera = async () => {
      if (!videoRef.current && attempts < maxAttempts) {
        attempts++;
        setTimeout(tryStartCamera, 100);
        return;
      }
      
      if (!videoRef.current) {
        setWebcamError('Failed to initialize camera after multiple attempts');
        return;
      }

      // First, ensure any existing streams are properly closed
      if (videoRef.current.srcObject) {
        safelyStopStream(videoRef.current.srcObject as MediaStream);
        videoRef.current.srcObject = null;
        // Add a small delay to ensure resources are released
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      try {
        // ✅ USE CAMERA ABSTRACTION LAYER - Check if we have an active camera instance
        const { activeCamera } = useCameraStore.getState();
        let stream: MediaStream;
        
        if (activeCamera && cameraType === 'standard') {
          // For StandardCamera: Get the MediaStream from the camera instance
          const cameraStream = (activeCamera as any).getMediaStream?.();
          
          if (!cameraStream) {
            throw new Error('Camera instance has no MediaStream available');
          }
          
          // DEBUG: Check which camera this stream is from
          const tracks = cameraStream.getVideoTracks();
          if (tracks.length > 0) {
            const settings = tracks[0].getSettings();
          }
          
          stream = cameraStream;
        } else if (activeCamera && cameraType === 'zed2i') {
          // For ZED2i: Check if it's in USB mode or premium mode
          const zedMode = (activeCamera as any).getMode?.();
          
          if (zedMode === 'usb') {
            // USB mode: Use MediaStream like standard camera
            const cameraStream = (activeCamera as any).getMediaStream?.();
            
            if (!cameraStream) {
              throw new Error('ZED 2i camera instance has no MediaStream available');
            }
            
            stream = cameraStream;
          } else {
            // Premium mode: Video rendering handled by overlays
            setIsWebcamLoading(false);
            return; // Exit early for ZED premium mode
          }
        } else {
          // Fallback: No active camera instance, use getUserMedia() directly
          
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter(device => device.kind === 'videoinput');
          
          if (videoDevices.length === 0) {
            throw new Error('No cameras found. Please connect a camera and refresh the page.');
          }
          
          // Use flexible constraints that work across browsers
          const constraints = {
            video: { 
              deviceId: selectedCamera ? { ideal: selectedCamera } : undefined,
              width: { ideal: 1280 },
              height: { ideal: 960 },
              aspectRatio: { ideal: 4/3 }
            }
          };
          
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        }

        const videoTracks = stream.getVideoTracks();
        
        if (!videoTracks || videoTracks.length === 0) {
          safelyStopStream(stream);
          // ✅ DON'T call setActiveStream(null) - might retry with different camera
          throw new Error('No video track available from the selected camera.');
        }
        
        // Set new stream
        videoRef.current.srcObject = stream;
        setActiveStream(stream);
        
        // Wait for metadata to load with simple promise
        await new Promise((resolve, reject) => {
          if (!videoRef.current) {
            reject(new Error('Video element not available'));
            return;
          }
          
          videoRef.current.onloadedmetadata = () => {
            resolve(null);
          };
          videoRef.current.onerror = reject;
        });

        // Play the video
        try {
          await videoRef.current.play();
          // ✅ Camera is now running - stop the spinner!
          setIsWebcamLoading(false);
          // ✅ Mark camera as connected in store so badge shows "Connected"
          setCameraConnected(true);
          // ✅ Start frame buffer for buffered image capture
          frameBuffer.start(videoRef.current);
        } catch (playError) {
          safelyStopStream(stream);
          setActiveStream(null);
          const errorMessage = playError instanceof Error ? playError.message : String(playError);
          throw new Error(`Failed to play video: ${errorMessage}`);
        }
        
      } catch (err) {
        setWebcamError(getWebcamErrorMessage(err));
        setIsWebcamLoading(false); // Stop spinner on error too
        if (videoRef.current?.srcObject) {
          safelyStopStream(videoRef.current.srcObject as MediaStream);
          videoRef.current.srcObject = null;
          setActiveStream(null);
        }
      }
    };

    // Start the retry process
    await tryStartCamera();
  };

  // Recreate camera instance (used by both START and RESTART buttons)
  const recreateCameraInstance = async () => {
    setWebcamError(null);
    setIsWebcamLoading(true);
    
    // Shutdown existing camera if any
    const { activeCamera: existingCamera } = useCameraStore.getState();
    if (existingCamera) {
      try {
        if (videoRef.current?.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach(track => track.stop());
          videoRef.current.srcObject = null;
        }
        await existingCamera.shutdown();
        setActiveCamera(null);
        setActiveStream(null);
      } catch (err) {
      }
    }
    
    // Small delay then trigger re-initialization
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Force camera re-initialization by toggling cameraType
    const currentType = cameraType;
    useCameraStore.setState({ cameraType: null });
    await new Promise(resolve => setTimeout(resolve, 100));
    useCameraStore.setState({ cameraType: currentType });
  };
  
  // Manual start from button - recreate camera if it doesn't exist
  const handleManualStartCamera = async () => {
    const { activeCamera: currentCamera } = useCameraStore.getState();
    
    if (!currentCamera) {
      // No camera instance - recreate it
      await recreateCameraInstance();
    } else {
      // Camera exists - just start the stream
      await handleStartCamera();
    }
  };
  
  // Restart camera - recreate camera instance
  const handleRestartCamera = async () => {
    await recreateCameraInstance();
  };
  
  // Stop camera
  const handleStopCamera = async () => {
    // Stop frame buffer
    frameBuffer.stop();
    
    // Stop video element stream
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
    // Shutdown camera instance
    const { activeCamera: existingCamera } = useCameraStore.getState();
    if (existingCamera) {
      try {
        await existingCamera.shutdown();
      } catch (err) {
      }
    }
    
    setActiveCamera(null);
    setActiveStream(null);
    setIsWebcamLoading(false); // ✅ CRITICAL: Clear loading so START button becomes clickable
    setCameraConnected(false); // ✅ Mark camera as disconnected so badge shows "Disconnected"
  };

  // Manual test detection trigger (only in mock mode)
  const handleTestDetection = () => {
    if (!aiSettings?.mockDetectionMode) return;
    triggerTestDetection();
  };

  // Use store value for overlay visibility
  const showOverlay = showLiveOverlay;

  return (
    <div 
      className="bg-gray-800 rounded-xl overflow-hidden flex flex-col relative"
      style={{ maxHeight: `${cardHeight}px` }}
      data-testid="container-live-camera"
    >
      <div className="p-2 border-b border-gray-700">
        {/* Header with status icons */}
        <div className="flex items-center justify-between mb-2">
          {/* Status Icons - Show on larger screens */}
          <div className="hidden md:flex items-center gap-2">
            {/* AI Brain Icon - Pulsing when AI is enabled */}
            {aiSettings?.enabled && (
              <Brain 
                className="w-8 h-8 text-purple-400 animate-pulse" 
                data-testid="icon-ai-brain"
              />
            )}
            
            {/* Envelope Clearance Truck Icon - Pulsing when monitoring is enabled */}
            {isEnvelopeMonitoring && (
              <Truck 
                className="w-8 h-8 text-orange-500 animate-pulse" 
                data-testid="icon-envelope-truck"
              />
            )}
            
            {/* Swept Path Analysis Route Icon - Pulsing when enabled */}
            {sweptPathSettings?.enabled && (
              <Route 
                className="w-8 h-8 text-yellow-400 animate-pulse" 
                data-testid="icon-swept-path-route"
              />
            )}
          </div>
        </div>
        
        {/* Status Indicators - Moved below title on mobile */}
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          {/* Mobile Status Icons - Smaller */}
          <div className="flex md:hidden items-center gap-2">
            {aiSettings?.enabled && (
              <Brain className="w-6 h-6 text-purple-400 animate-pulse" />
            )}
            {isEnvelopeMonitoring && (
              <Truck className="w-6 h-6 text-orange-500 animate-pulse" />
            )}
            {sweptPathSettings?.enabled && (
              <Route className="w-6 h-6 text-yellow-400 animate-pulse" />
            )}
          </div>
          
          {/* AI Status Indicators */}
          {aiSettings?.enabled && (
            <>
              {isDetectionActive && (
                <div 
                  className="flex items-center gap-1.5 px-2 py-1 bg-blue-600/20 text-blue-400 rounded-md text-xs font-medium"
                  data-testid="indicator-ai-detection"
                >
                  <Brain className="w-3.5 h-3.5 animate-pulse" />
                  <span className="hidden sm:inline">AI Detection ({detectionCount})</span>
                  <span className="sm:hidden">AI ({detectionCount})</span>
                </div>
              )}
              
              {isTrainingActive && (
                <div 
                  className="flex flex-col gap-1 px-2 sm:px-3 py-1 sm:py-2 bg-red-600/20 border border-red-500 text-red-400 rounded-lg text-xs font-medium"
                  data-testid="indicator-training-mode"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="font-bold text-xs">🔴 REC</span>
                  </div>
                  <div className="hidden sm:grid grid-cols-3 gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <Database className="w-3 h-3" />
                      <span>{frameCount} frames</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      <span>{aiSettings?.trainingFrameRate || 2} FPS</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{sessionDuration}</span>
                    </div>
                  </div>
                  {trainingDataSize > 0 && (
                    <div className="text-xs text-red-300 hidden sm:block">
                      ~{trainingDataSize.toFixed(1)} MB captured
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Action Buttons - Full width on mobile */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Test Detection Button (only in mock mode) */}
          {aiSettings?.mockDetectionMode && (
            <button
              onClick={handleTestDetection}
              className="px-2 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded-md flex items-center gap-1 text-xs transition-colors"
              data-testid="button-test-detection"
            >
              <Zap className="w-3 h-3" />
              <span className="hidden sm:inline">Test Detection</span>
              <span className="sm:hidden">Test</span>
            </button>
          )}
          
          {/* Analyze Turn Button (only when swept path is enabled) */}
          {sweptPathSettings?.enabled && (
            <AnalyzeTurnButton />
          )}
          
          <CameraControls
            onStartCamera={handleManualStartCamera}
            onCaptureImage={captureImage}
            onRestartCamera={handleRestartCamera}
            onStopCamera={handleStopCamera}
            isLoading={isWebcamLoading}
            hasError={!!webcamError}
            isCameraRunning={!!activeCamera && !!videoRef.current?.srcObject && !webcamError}
          />
          
          {/* Geo-Referenced Video Recording Controls (Hidden for beta users) */}
          {!isBeta && (
            <GeoVideoRecordingControls 
              videoRef={videoRef}
              surveyId={activeSurvey?.id || null}
            />
          )}
          
          {/* Camera Status - compact inline badges (Hidden for beta users) */}
          {!isBeta && <CameraStatusBadge compact={true} />}
        </div>
      </div>
      <div className="relative bg-black w-full">
        {/* Camera Reconnection Banner */}
        {reconnecting && (
          <div 
            className="absolute top-0 left-0 right-0 z-50 bg-yellow-600/90 backdrop-blur-sm text-white px-4 py-3 flex items-center justify-between shadow-lg"
            data-testid="banner-camera-reconnecting"
          >
            <div className="flex items-center gap-3">
              <div className="animate-spin h-5 w-5 border-t-2 border-b-2 border-white rounded-full"></div>
              <div>
                <p className="font-semibold">Camera reconnecting...</p>
                <p className="text-xs text-yellow-100">
                  Attempting to switch to fallback camera. Please wait...
                </p>
              </div>
            </div>
            {reconnectionAttempts > 0 && (
              <span className="text-xs bg-yellow-700/50 px-2 py-1 rounded" data-testid="text-reconnect-attempts">
                Attempt {reconnectionAttempts}
              </span>
            )}
          </div>
        )}
        
        {/* Disconnect Reason Info Banner */}
        {lastDisconnectReason && !reconnecting && (
          <div 
            className="absolute top-0 left-0 right-0 z-40 bg-red-600/90 backdrop-blur-sm text-white px-4 py-2 text-sm"
            data-testid="banner-disconnect-reason"
          >
            <p>{lastDisconnectReason}</p>
          </div>
        )}
        
        {/* Alert Banner - Shows warning/critical alerts for laser measurements */}
        {alertStatus && (
          <div className="absolute top-0 left-0 right-0 z-50 px-4 py-2">
            <AlertBanner 
              alertStatus={alertStatus}
              setAlertStatus={setAlertStatus}
              triggerValue={triggerValue}
            />
          </div>
        )}
        
        {/* Video display with conditional rendering for errors */}
        {webcamError ? (
          <div className="flex items-center justify-center min-h-[240px] bg-gray-900/95">
            <div className="max-w-md p-6">
              <div className="text-center">
                <div className="text-red-400 mb-4">
                  <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Camera Error</h3>
                <p className="text-gray-300 mb-4">{webcamError}</p>
                <button
                  onClick={() => {
                    setWebcamError(null);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  data-testid="button-retry-camera"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative w-full">
            {/* Video wrapper with cropping for ZED 2i USB mode */}
            <div className={isZedUSBMode ? 'overflow-hidden relative' : 'relative'}>
              <video
                ref={videoRef}
                className={`w-full max-h-[480px] ${displayMode === 'fill' ? 'object-cover' : 'object-contain'}`}
                style={
                  isZedUSBMode && zedCameraSelection
                    ? {
                        transform: `scaleX(2) translateX(${zedCameraSelection === 'left' ? '25%' : '-25%'})`,
                        transformOrigin: 'center center',
                      }
                    : undefined
                }
                playsInline
                muted
                autoPlay
                onLoadedMetadata={() => {
                  setIsVideoElementReady(true);
                }}
                onPlaying={() => {
                  setIsVideoElementReady(true);
                }}
                data-testid="video-live-camera"
              />
            </div>
            
            {/* Metadata Overlay - hide survey/GPS data when envelope monitoring is active */}
            <CameraOverlay
              enabled={showOverlay && !!overlayOptions.enabled}
              options={isEnvelopeMonitoring ? {
                ...overlayOptions,
                showPOI: false,
                showGPS: false,
                showSurveyTitle: false,
                showProjectNumber: false,
                showSurveyorName: false,
              } : (overlayOptions || {
                showPOI: true,
                showGPS: true,
                showHeight: true,
                showDateTime: true,
                showHeading: true,
                showLogo: false,
                showText: false
              })}
              measurements={measurements}
              currentMeasure={lastMeasurement}
            />
            
            {/* Detection Zone Overlay - shows where detection happens */}
            {aiSettings?.enabled && aiSettings?.detectionZone?.showOverlay && (
              <DetectionZoneOverlay
                videoWidth={videoSize.width}
                videoHeight={videoSize.height}
              />
            )}
            
            {/* Detection Overlay - appears AFTER zone overlay */}
            {aiSettings?.enabled && aiSettings?.detectionOverlay && (
              <DetectionOverlay
                detections={activeDetections}
                onAccept={handleAccept}
                onReject={handleReject}
                onCorrect={handleCorrect}
                videoWidth={videoSize.width}
                videoHeight={videoSize.height}
              />
            )}
            
            {/* Measurement Overlay - displays measurement visualizations */}
            {aiSettings?.enabled && calibrationData && (
              <MeasurementOverlay
                videoElement={videoRef.current}
                detections={activeDetections}
                width={videoSize.width}
                height={videoSize.height}
              />
            )}
            
            {/* Envelope Clearance Overlay - shows clearance zones */}
            <EnvelopeClearanceOverlay
              videoWidth={videoSize.width}
              videoHeight={videoSize.height}
            />
            
            {/* ZED 2i Depth Data Overlay - premium feature */}
            <DepthDataOverlay
              videoWidth={videoSize.width}
              videoHeight={videoSize.height}
              enabled={showDepthView}
            />
            
            {/* ZED 2i Stereo View Overlay - premium feature */}
            <StereoViewOverlay
              videoWidth={videoSize.width}
              videoHeight={videoSize.height}
              enabled={showStereoView}
            />
            
            {/* Road Detection Debug Overlay - shows detected boundaries */}
            {sweptPathSettings?.enabled && videoRef.current && (
              <RoadDetectionDebugOverlay
                canvasWidth={videoSize.width}
                canvasHeight={videoSize.height}
                videoWidth={videoRef.current.videoWidth || videoSize.width}
                videoHeight={videoRef.current.videoHeight || videoSize.height}
                roadBoundaries={debugState.roadBoundaries}
                confidence={debugState.confidence}
                isAnalyzing={debugState.isAnalyzing}
              />
            )}
            
            {/* Swept Path Analysis Overlay - shows turn simulation */}
            {sweptPathSettings?.enabled && currentAnalysis && (
              <SweptPathOverlay
                canvasWidth={videoSize.width}
                canvasHeight={videoSize.height}
              />
            )}
          </div>
        )}
      </div>
      
      {/* Video Recording Controls (Hidden for beta users) */}
      {videoMode && !isBeta && (
        <VideoRecordingControls videoRef={videoRef} />
      )}
      
      {/* Correction Dialog */}
      <DetectionCorrectionDialog
        isOpen={showCorrectionDialog}
        onClose={() => setShowCorrectionDialog(false)}
        detection={currentDetection}
        onSubmit={handleCorrectionSubmit}
      />
      
      {/* Resize Handle */}
      <div
        className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize bg-gray-700 hover:bg-blue-500 transition-colors z-10 group"
        onMouseDown={handleResizeMouseDown}
        data-testid="resize-handle-live-camera"
      >
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-1 bg-gray-500 group-hover:bg-blue-400 rounded-full transition-colors" />
      </div>
    </div>
  );
};

export default LiveCamera;
