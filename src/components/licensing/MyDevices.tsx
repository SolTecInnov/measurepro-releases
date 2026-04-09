import { useState, useEffect } from 'react';
import { Smartphone, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { getUserDevices, deactivateDevice } from '../../lib/licensing';
import type { UserDevice } from '../../../shared/schema';
import { getSafeAuth } from '../../lib/firebase';
import { toast } from 'sonner';

const MyDevices = () => {
  const [devices, setDevices] = useState<UserDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeactivating, setIsDeactivating] = useState<string | null>(null);

  const auth = getSafeAuth();

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    if (!auth?.currentUser) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const devicesData = await getUserDevices();
      setDevices(devicesData);
    } catch (error) {
      toast.error('Failed to load your devices');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeactivate = async (deviceId: string) => {
    setIsDeactivating(deviceId);
    try {
      await deactivateDevice(deviceId);
      // toast suppressed
      await loadDevices();
      setDeleteConfirmId(null);
    } catch (error) {
      toast.error('Failed to deactivate device');
    } finally {
      setIsDeactivating(null);
    }
  };

  const getDaysSinceActive = (lastActiveAt: string) => {
    const days = Math.floor((new Date().getTime() - new Date(lastActiveAt).getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const getCurrentDeviceFingerprint = () => {
    // Simple device fingerprinting based on user agent and screen
    const data = {
      userAgent: navigator.userAgent,
      screen: `${window.screen.width}x${window.screen.height}`,
      platform: navigator.platform,
    };
    return btoa(JSON.stringify(data)).substring(0, 32);
  };

  const currentFingerprint = getCurrentDeviceFingerprint();

  if (isLoading) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-12 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  if (!auth?.currentUser) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
        <p className="text-center text-gray-400">Please log in to view your devices</p>
      </div>
    );
  }

  const activeDevices = devices.filter(d => d.isActive);
  const inactiveDevices = devices.filter(d => !d.isActive);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-2">
          <Smartphone className="w-5 h-5 text-blue-400" />
          My Devices
        </h3>
        <p className="text-sm text-gray-400">
          Manage devices that have access to your licenses
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-400">{activeDevices.length}</div>
          <div className="text-sm text-gray-400">Active Devices</div>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-400">{inactiveDevices.length}</div>
          <div className="text-sm text-gray-400">Inactive Devices</div>
        </div>
      </div>

      {/* Active Devices */}
      {activeDevices.length > 0 && (
        <div>
          <h4 className="text-md font-semibold text-white mb-3">Active Devices</h4>
          <div className="space-y-3">
            {activeDevices.map((device) => {
              const daysSinceActive = getDaysSinceActive(device.lastActiveAt);
              const isCurrentDevice = device.deviceFingerprint === currentFingerprint;
              const isRecent = daysSinceActive === 0;

              return (
                <div
                  key={device.id}
                  className={`bg-gray-900 border rounded-lg p-4 ${
                    isCurrentDevice ? 'border-green-600' : 'border-gray-700'
                  }`}
                  data-testid={`device-${device.id}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3 flex-1">
                      <Smartphone className={`w-5 h-5 mt-1 ${isCurrentDevice ? 'text-green-400' : 'text-blue-400'}`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h5 className="font-medium text-white">
                            {device.deviceName || 'Unknown Device'}
                          </h5>
                          {isCurrentDevice && (
                            <span className="px-2 py-0.5 bg-green-900 text-green-300 text-xs rounded">
                              This Device
                            </span>
                          )}
                          {isRecent && !isCurrentDevice && (
                            <span className="px-2 py-0.5 bg-blue-900 text-blue-300 text-xs rounded">
                              Active Now
                            </span>
                          )}
                        </div>

                        {device.deviceInfo && (
                          <p className="text-xs text-gray-500 mb-2">
                            {device.deviceInfo.userAgent}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                          <span>
                            First Seen: {new Date(device.firstSeenAt).toLocaleDateString()}
                          </span>
                          <span>•</span>
                          <span className={daysSinceActive > 30 ? 'text-orange-400' : ''}>
                            Last Active: {new Date(device.lastActiveAt).toLocaleDateString()}
                            {daysSinceActive > 0 && <> ({daysSinceActive} days ago)</>}
                          </span>
                        </div>
                      </div>
                    </div>

                    {!isCurrentDevice && (
                      <button
                        onClick={() => setDeleteConfirmId(device.id)}
                        className="p-2 text-red-400 hover:bg-red-900/30 rounded transition-colors"
                        data-testid={`button-deactivate-${device.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Deactivate Confirmation */}
                  {deleteConfirmId === device.id && (
                    <div className="mt-3 p-3 bg-red-900/20 border border-red-700 rounded space-y-3">
                      <div className="flex items-start gap-2 text-sm text-red-300">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium">Deactivate this device?</p>
                          <p className="text-xs text-gray-400 mt-1">
                            This will free up a device slot. You can reactivate it later by logging in again on that device.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDeactivate(device.id)}
                          disabled={isDeactivating === device.id}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm rounded transition-colors flex items-center gap-2"
                          data-testid="button-confirm-deactivate"
                        >
                          {isDeactivating === device.id ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Deactivating...
                            </>
                          ) : (
                            'Deactivate'
                          )}
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          disabled={isDeactivating === device.id}
                          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm rounded transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {isCurrentDevice && (
                    <div className="mt-3 p-2 bg-gray-800 border border-gray-700 rounded text-xs text-gray-400 flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-blue-400" />
                      You cannot deactivate the device you're currently using
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Inactive Devices */}
      {inactiveDevices.length > 0 && (
        <div>
          <h4 className="text-md font-semibold text-white mb-3">Inactive Devices</h4>
          <div className="space-y-3">
            {inactiveDevices.map((device) => (
              <div
                key={device.id}
                className="bg-gray-900 border border-gray-700/50 rounded-lg p-4 opacity-60"
                data-testid={`device-inactive-${device.id}`}
              >
                <div className="flex items-start gap-3">
                  <Smartphone className="w-5 h-5 text-gray-500 mt-1" />
                  <div className="flex-1">
                    <h5 className="font-medium text-gray-300 mb-1">
                      {device.deviceName || 'Unknown Device'}
                    </h5>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>Last Active: {new Date(device.lastActiveAt).toLocaleDateString()}</span>
                      <span className="px-2 py-0.5 bg-gray-700 text-gray-400 rounded">
                        Deactivated
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Devices */}
      {devices.length === 0 && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-12">
          <div className="text-center">
            <Smartphone className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-white mb-2">No Devices Registered</h4>
            <p className="text-sm text-gray-400">
              Your devices will appear here once you activate a license
            </p>
          </div>
        </div>
      )}

      {/* Info Box */}
      {activeDevices.length > 0 && (
        <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-300 mb-2">Device Management Tips</h4>
          <ul className="text-xs text-gray-400 space-y-1">
            <li>• Each license has a maximum number of devices that can be active simultaneously</li>
            <li>• Deactivate unused devices to free up slots for new devices</li>
            <li>• You'll be automatically logged out when you deactivate the current device</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default MyDevices;
