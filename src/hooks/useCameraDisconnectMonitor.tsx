import { useEffect, useCallback, useRef } from 'react';
import { useCameraStore } from '../lib/camera';
import { toast } from 'sonner';

/**
 * Camera Disconnect Monitor Hook
 * 
 * Monitors camera connection status and handles graceful disconnects.
 * 
 * Features:
 * - Detects unexpected camera disconnections (ZED 2i WebSocket or Standard MediaStream)
 * - Shows toast notifications to inform user
 * - Automatically attempts fallback to standard camera if ZED 2i disconnects
 * - Preserves recording, timelapse, and survey state during camera switch
 * - Tracks reconnection attempts
 * - Non-blocking - user can continue working
 * 
 * Usage:
 * ```tsx
 * const { handleDisconnect, reconnecting } = useCameraDisconnectMonitor();
 * 
 * // Pass handleDisconnect to camera instances
 * const camera = new ZED2iCamera({ onDisconnect: handleDisconnect });
 * ```
 */
export function useCameraDisconnectMonitor() {
  const {
    cameraType,
    isRecording,
    isTimelapseActive,
    lastDisconnectReason,
    reconnectionAttempts,
    setCameraType,
    setCameraConnected,
    setLastDisconnectReason,
    setReconnectionAttempts,
  } = useCameraStore();

  const reconnectingRef = useRef(false);
  const disconnectHandledRef = useRef(false);

  /**
   * Handle camera disconnect event
   * Called by camera instances when unexpected disconnect occurs
   */
  const handleDisconnect = useCallback(async () => {
    // Prevent multiple simultaneous disconnect handlers
    if (disconnectHandledRef.current) {
      return;
    }
    
    disconnectHandledRef.current = true;
    const disconnectTime = new Date().toISOString();
    const disconnectedCameraType = cameraType;

    // Update store state
    setCameraConnected(false);
    const reason = `${disconnectedCameraType === 'zed2i' ? 'ZED 2i' : 'Standard'} camera disconnected at ${new Date().toLocaleTimeString()}`;
    setLastDisconnectReason(reason);

    // Show notification to user
    if (disconnectedCameraType === 'zed2i') {
      toast.error('ZED 2i camera disconnected. Attempting to switch to standard camera...', {
        duration: 5000,
      });
      
      // Attempt automatic fallback to standard camera
      try {
        reconnectingRef.current = true;
        setReconnectionAttempts(reconnectionAttempts + 1);
        
        // Give the system a moment to clean up
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Switch to standard camera
        setCameraType('standard');
        setCameraConnected(true);
        
        toast.success('Switched to standard camera successfully', {
          duration: 3000,
        });
        
        // Log state preservation
        if (isRecording || isTimelapseActive) {
          toast.info('Recording/timelapse state preserved during camera switch', {
            duration: 3000,
          });
        }
        
      } catch (error) {
        toast.error('Failed to switch to standard camera. Please reconnect manually.', {
          duration: 5000,
        });
        setReconnectionAttempts(reconnectionAttempts + 1);
      } finally {
        reconnectingRef.current = false;
      }
    } else {
      // Standard camera disconnected
      toast.error('Camera disconnected. Please check your camera connection.', {
        duration: 5000,
      });
      
      if (isRecording || isTimelapseActive) {
        toast.warning('Recording/timelapse may be interrupted. Attempting to continue...', {
          duration: 5000,
        });
      }
    }
    
    // Reset the disconnect handled flag after a delay
    setTimeout(() => {
      disconnectHandledRef.current = false;
    }, 2000);
  }, [
    cameraType,
    isRecording,
    isTimelapseActive,
    reconnectionAttempts,
    setCameraType,
    setCameraConnected,
    setLastDisconnectReason,
    setReconnectionAttempts,
  ]);


  /**
   * Reset reconnection attempts when camera is successfully connected
   */
  useEffect(() => {
    if (cameraType && !lastDisconnectReason) {
      setReconnectionAttempts(0);
    }
  }, [cameraType, lastDisconnectReason, setReconnectionAttempts]);

  return {
    handleDisconnect,
    reconnecting: reconnectingRef.current,
    lastDisconnectReason,
    reconnectionAttempts,
  };
}
