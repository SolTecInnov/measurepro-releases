import React, { useEffect } from 'react';
import { useCameraStore } from '../../lib/camera';
import { safelyStopStream, checkCameraPermission } from '../../lib/camera/CameraUtils';

interface CameraSetupProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  onPermissionChange: (state: 'granted' | 'denied' | 'prompt' | 'unknown') => void;
  onCameraReady: () => void;
  onCameraError: (error: string) => void;
  onLoadingChange: (isLoading: boolean) => void;
}

const CameraSetup: React.FC<CameraSetupProps> = ({
  videoRef,
  onPermissionChange,
  onCameraReady,
  onCameraError,
  onLoadingChange
}) => {
  // Check camera permissions and initialize
  useEffect(() => {
    const initializeCamera = async () => {
      try {
        // First check permission status
        const permission = await checkCameraPermission();
        onPermissionChange(permission);
        
        if (permission === 'granted') {
          // If permission is granted, proceed with camera setup
          await setupCamera();
        } else if (permission === 'denied') {
          onCameraError('Camera access denied. Please allow camera permission in your browser settings.');
          onLoadingChange(false);
        } else {
          // For 'prompt' or 'unknown', show message but DON'T auto-request
          // User must manually click to grant permission
          onCameraError('Camera permission required. Click "Start Camera" to grant access.');
          onLoadingChange(false);
        }
      } catch (err: unknown) {
        onCameraError('Failed to initialize camera: ' + ((err as Error).message || 'Unknown error'));
        onLoadingChange(false);
      }
    };
    
    initializeCamera();
  }, []);

  // Function to set up camera after permission is granted
  const setupCamera = async () => {
    try {
      // Reset error state
      onCameraError('');
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      if (videoDevices.length === 0) {
        throw new Error('No cameras found. Please connect a camera and refresh the page.');
      }

      // Always use the first available camera to avoid constraints issues
      const defaultCamera = videoDevices[0].deviceId;
      useCameraStore.getState().setSelectedCamera(defaultCamera);

      onCameraReady();
    } catch (err: unknown) {
      onCameraError((err as Error).message || 'Unknown camera error');
      onLoadingChange(false);
    }
  };

  // Start camera when component mounts
  useEffect(() => {
    return () => {
      // Cleanup function to stop any active streams
      if (videoRef.current?.srcObject) {
        safelyStopStream(videoRef.current.srcObject as MediaStream);
        videoRef.current.srcObject = null;
      }
    };
  }, []);

  return null; // This is a logic-only component
};

export default CameraSetup;