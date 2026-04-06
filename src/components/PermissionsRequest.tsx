import { useState, useEffect } from 'react';
import { MapPin, Camera, Bell, Check, X, AlertTriangle, Loader2 } from 'lucide-react';
import { checkCameraPermission, forceRequestCameraPermission } from '@/lib/camera/CameraUtils';
import { useGPSStore } from '@/lib/stores/gpsStore';

interface PermissionStatus {
  gps: 'unknown' | 'granted' | 'denied' | 'pending' | 'prompt';
  camera: 'unknown' | 'granted' | 'denied' | 'pending' | 'prompt';
  notifications: 'unknown' | 'granted' | 'denied' | 'pending' | 'prompt';
}

interface PermissionsRequestProps {
  onComplete: () => void;
  onSkip?: () => void;
}

export default function PermissionsRequest({ onComplete, onSkip }: PermissionsRequestProps) {
  const [permissions, setPermissions] = useState<PermissionStatus>({
    gps: 'unknown',
    camera: 'unknown',
    notifications: 'unknown'
  });
  const [isChecking, setIsChecking] = useState(true);
  const [hadGPSTimeout, setHadGPSTimeout] = useState(false);

  useEffect(() => {
    checkExistingPermissions();
  }, []);

  const checkExistingPermissions = async () => {
    setIsChecking(true);
    
    // Check GPS permission
    try {
      const gpsResult = await navigator.permissions.query({ name: 'geolocation' });
      setPermissions(prev => ({ ...prev, gps: gpsResult.state as any }));
    } catch {
      setPermissions(prev => ({ ...prev, gps: 'unknown' }));
    }

    // Check camera permission
    try {
      const cameraStatus = await checkCameraPermission();
      setPermissions(prev => ({ ...prev, camera: cameraStatus }));
    } catch {
      setPermissions(prev => ({ ...prev, camera: 'unknown' }));
    }

    // Check notification permission
    if ('Notification' in window) {
      const notifStatus = Notification.permission;
      setPermissions(prev => ({ 
        ...prev, 
        notifications: notifStatus === 'default' ? 'unknown' : notifStatus as any
      }));
    }

    setIsChecking(false);
  };

  const requestGPSPermission = async () => {
    
    // Check if geolocation is available
    if (!navigator.geolocation) {
      setPermissions(prev => ({ ...prev, gps: 'denied' }));
      return;
    }
    
    setPermissions(prev => ({ ...prev, gps: 'pending' }));
    setHadGPSTimeout(false); // Clear timeout flag when starting new request
    
    // Track if this is a timeout or actual denial
    let timeoutId: NodeJS.Timeout | null = null;
    let isTimeout = false;
    
    try {
      // Request GPS permission by calling getCurrentPosition
      // This triggers the browser's permission prompt
      await Promise.race([
        new Promise<void>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            () => {
              if (timeoutId) clearTimeout(timeoutId);
              setHadGPSTimeout(false); // Clear timeout flag on success
              setPermissions(prev => ({ ...prev, gps: 'granted' }));
              // Update GPS store to enable failsafe
              useGPSStore.getState().setHasGPSPermission(true);
              resolve();
            },
            (error) => {
              if (timeoutId) clearTimeout(timeoutId);
              
              // Check if it's an actual permission denial (error.code === 1)
              // vs timeout (error.code === 3) or unavailable (error.code === 2)
              if ((error as GeolocationPositionError).code === 1) {
                // PERMISSION_DENIED - user actually denied
                setHadGPSTimeout(false); // Clear timeout flag on denial
                setPermissions(prev => ({ ...prev, gps: 'denied' }));
                useGPSStore.getState().setHasGPSPermission(false);
              } else {
                // Timeout or position unavailable - allow retry
                setHadGPSTimeout(true); // Mark that timeout occurred
                setPermissions(prev => ({ ...prev, gps: 'prompt' }));
              }
              reject(error);
            },
            {
              enableHighAccuracy: true,
              timeout: 30000, // 30 seconds - enough time for GPS fix
              maximumAge: 0
            }
          );
        }),
        // Manual timeout - fail after 35 seconds if no response  
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            isTimeout = true;
            reject(new Error('GPS permission request timed out'));
          }, 35000);
        })
      ]);
    } catch (error: any) {
      
      // If it was our manual timeout, reset to prompt state (allow retry)
      if (isTimeout || error?.message?.includes('timed out')) {
        setHadGPSTimeout(true); // Mark that timeout occurred
        setPermissions(prev => ({ ...prev, gps: 'prompt' }));
      }
      // Otherwise the error handler in getCurrentPosition already set the state
    }
  };

  const requestCameraPermission = async () => {
    setPermissions(prev => ({ ...prev, camera: 'pending' }));
    
    try {
      const granted = await forceRequestCameraPermission();
      setPermissions(prev => ({ ...prev, camera: granted ? 'granted' : 'denied' }));
    } catch (error) {
      setPermissions(prev => ({ ...prev, camera: 'denied' }));
    }
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      setPermissions(prev => ({ ...prev, notifications: 'denied' }));
      return;
    }

    setPermissions(prev => ({ ...prev, notifications: 'pending' }));
    
    try {
      const permission = await Notification.requestPermission();
      setPermissions(prev => ({ 
        ...prev, 
        notifications: permission === 'default' ? 'unknown' : permission as any
      }));
    } catch (error) {
      setPermissions(prev => ({ ...prev, notifications: 'denied' }));
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'granted':
        return <Check className="w-5 h-5 text-green-400" />;
      case 'denied':
        return <X className="w-5 h-5 text-red-400" />;
      case 'pending':
        return <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
    }
  };

  const allGranted = permissions.gps === 'granted' && 
                     permissions.camera === 'granted' && 
                     permissions.notifications === 'granted';

  const handleContinue = () => {
    // Store that permissions have been requested
    localStorage.setItem('permissions_requested', 'true');
    onComplete();
  };

  const handleSkip = () => {
    // Store that user skipped permissions
    localStorage.setItem('permissions_requested', 'skipped');
    if (onSkip) {
      onSkip();
    } else {
      onComplete();
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-300">Checking permissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-gray-800 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-center">
          <h1 className="text-2xl font-bold text-white mb-2">
            📍 MeasurePRO Permissions
          </h1>
          <p className="text-blue-100">
            Grant permissions for the best experience
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-gray-300 text-sm mb-6">
            MeasurePRO needs these permissions to provide full functionality. 
            Tap each button below to grant access.
          </p>

          {/* GPS Permission */}
          <div className="bg-gray-700/50 rounded-lg p-4 border-2 border-gray-600">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-900/30 rounded-lg">
                <MapPin className="w-6 h-6 text-blue-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-white">Location (GPS)</h3>
                  {getStatusIcon(permissions.gps)}
                </div>
                <p className="text-sm text-gray-400 mb-3">
                  Required for route tracking, positioning, and navigation features
                </p>
                {permissions.gps !== 'granted' && permissions.gps !== 'denied' && (
                  <>
                    <button
                      onClick={requestGPSPermission}
                      disabled={permissions.gps === 'pending'}
                      className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium"
                      data-testid="button-request-gps"
                    >
                      {permissions.gps === 'pending' ? 'Requesting...' : hadGPSTimeout ? 'Try Again' : 'Allow Location'}
                    </button>
                    {hadGPSTimeout && (
                      <p className="text-xs text-yellow-400 mt-2">
                        ⏱️ Request timed out or GPS unavailable. Please try again.
                      </p>
                    )}
                  </>
                )}
                {permissions.gps === 'denied' && (
                  <div className="bg-red-900/20 border border-red-800/30 rounded-lg p-3">
                    <p className="text-sm text-red-400">
                      ⚠️ Permission denied. Please enable Location in your browser settings, then refresh this page.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Camera Permission */}
          <div className="bg-gray-700/50 rounded-lg p-4 border-2 border-gray-600">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-purple-900/30 rounded-lg">
                <Camera className="w-6 h-6 text-purple-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-white">Camera</h3>
                  {getStatusIcon(permissions.camera)}
                </div>
                <p className="text-sm text-gray-400 mb-3">
                  Required for photo/video capture and AI object detection
                </p>
                {permissions.camera !== 'granted' && permissions.camera !== 'denied' && (
                  <button
                    onClick={requestCameraPermission}
                    disabled={permissions.camera === 'pending'}
                    className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium"
                    data-testid="button-request-camera"
                  >
                    {permissions.camera === 'pending' ? 'Requesting...' : 'Allow Camera'}
                  </button>
                )}
                {permissions.camera === 'denied' && (
                  <div className="bg-red-900/20 border border-red-800/30 rounded-lg p-3">
                    <p className="text-sm text-red-400">
                      ⚠️ Permission denied. Please enable Camera in your browser settings, then refresh this page.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Notification Permission */}
          <div className="bg-gray-700/50 rounded-lg p-4 border-2 border-gray-600">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-orange-900/30 rounded-lg">
                <Bell className="w-6 h-6 text-orange-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-white">Notifications</h3>
                  {getStatusIcon(permissions.notifications)}
                </div>
                <p className="text-sm text-gray-400 mb-3">
                  For clearance alerts, off-route warnings, and convoy updates
                </p>
                {permissions.notifications !== 'granted' && permissions.notifications !== 'denied' && (
                  <button
                    onClick={requestNotificationPermission}
                    disabled={permissions.notifications === 'pending'}
                    className="w-full px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium"
                    data-testid="button-request-notifications"
                  >
                    {permissions.notifications === 'pending' ? 'Requesting...' : 'Allow Notifications'}
                  </button>
                )}
                {permissions.notifications === 'denied' && (
                  <div className="bg-red-900/20 border border-red-800/30 rounded-lg p-3">
                    <p className="text-sm text-red-400">
                      ⚠️ Permission denied. Please enable Notifications in your browser settings, then refresh this page.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Status Message */}
          {allGranted && (
            <div className="bg-green-900/20 border border-green-800/30 rounded-lg p-4 mt-4">
              <div className="flex items-center gap-3">
                <Check className="w-6 h-6 text-green-400" />
                <p className="text-green-400 font-medium">
                  All permissions granted! You're ready to go.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-700/30 p-6 space-y-3">
          <button
            onClick={handleContinue}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
            data-testid="button-continue"
          >
            {allGranted ? '✓ Continue to App' : 'Continue Anyway'}
          </button>
          
          {!allGranted && (
            <button
              onClick={handleSkip}
              className="w-full px-6 py-2 text-gray-400 hover:text-gray-300 transition-colors text-sm"
              data-testid="button-skip"
            >
              Skip for now (limited functionality)
            </button>
          )}

          <p className="text-xs text-gray-500 text-center">
            You can change these permissions anytime in Settings → Help
          </p>
        </div>
      </div>
    </div>
  );
}
