// Camera utility functions

/**
 * Safely stops all tracks in a media stream
 * @param stream - The media stream to stop
 */
export const safelyStopStream = (stream: MediaStream | null) => {
  if (stream) {
    try {
      stream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (err) {
        }
      });
    } catch (err) {
    }
  }
};

/**
 * Checks camera permission status
 * @returns Promise resolving to permission state
 */
export const checkCameraPermission = async (): Promise<'granted' | 'denied' | 'prompt' | 'unknown'> => {
  try {
    
    // First try the permissions API
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
        
        // Return the permission state WITHOUT requesting access
        // Only request access when user explicitly clicks a button
        return result.state as 'granted' | 'denied' | 'prompt'; 
      } catch (permErr) {
        // If permissions API fails, return 'unknown' instead of requesting access
        return 'unknown';
      }
    }

    // If permissions API is not available, return 'unknown'
    // Don't automatically request camera access
    return 'unknown';
  } catch (err) {
    return 'unknown';
  }
};

/**
 * Generates a user-friendly error message for camera errors
 * @param err - The error object
 * @returns Formatted error message
 */
export const getWebcamErrorMessage = (err: any): string => {
  
  if (!err) return 'Unknown camera error occurred. Please check browser console for details.';
  
  const message = err.message || err.name || String(err);
  
  switch (true) {
    case message.includes('Could not start video source'):
      return 'Could not access the camera. Please ensure no other applications are using the camera, refresh the page, and try again.';
    case message.includes('Permission denied') || message.includes('Permission dismissed'):
      return 'Camera access was denied or dismissed. Please check your browser settings and allow camera access when prompted.';
    case message.includes('no longer available'):
      return 'The selected camera is no longer available. Please check your camera connection and refresh the list.';
    case message.includes('NotAllowedError') || message.includes('denied'):
      return 'Camera access denied. Please check your browser settings and allow camera access when prompted.';
    case message.includes('NotFoundError'):
      return 'No camera detected. Please connect a camera and click "Refresh List".';
    case message.includes('NotReadableError'):
      return 'Camera is in use by another application. Please close other apps using the camera and try again.';
    case message.includes('OverconstrainedError'):
      return 'Camera does not support the requested resolution. Try selecting a lower resolution in the Camera Settings tab.';
    case message.includes('AbortError'):
      return 'Camera access was aborted. Please try again.';
    case message.includes('SecurityError'):
      return 'Camera access was blocked due to security restrictions. Please check your browser settings.';
    case message.includes('TypeError'):
      return 'Invalid camera configuration. Please try selecting a different camera from the dropdown.';
    default:
      return `Camera error: ${message || 'Unknown error'}. Try refreshing the page or restarting your browser.`;
  }
};

/**
 * Force a camera permission request
 * This is a more aggressive approach to request camera permissions
 * @returns Promise resolving to true if permission granted, false otherwise
 */
export const forceRequestCameraPermission = async (): Promise<boolean> => {
  try {
    
    // Try to get a stream with minimal constraints
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { 
        width: { ideal: 640 },
        height: { ideal: 480 }
      }
    });
    
    // If we got here, permission was granted
    
    // Clean up the stream
    safelyStopStream(stream);
    return true;
  } catch (err) {
    return false;
  }
};