import { useState, useEffect } from 'react';
import { Search, X, Smartphone, Trash2 } from 'lucide-react';
import { getAllUserLicenses, getAllDevices, deactivateDevice, deleteDevice } from '../../lib/licensing';
import type { UserDevice, UserLicense } from '../../../shared/schema';
import { toast } from 'sonner';

const DeviceManager = () => {
  const [devices, setDevices] = useState<UserDevice[]>([]);
  const [licenses, setLicenses] = useState<UserLicense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      // Get all licenses and devices (admin)
      const [licensesData, devicesData] = await Promise.all([
        getAllUserLicenses(),
        getAllDevices(),
      ]);
      setLicenses(licensesData);
      setDevices(devicesData);
    } catch (error) {
      toast.error('Failed to load devices');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeactivate = async (deviceId: string) => {
    try {
      await deactivateDevice(deviceId);
      toast.success('Device deactivated');
      loadData();
    } catch (error) {
      toast.error('Failed to deactivate device');
    }
  };

  const handleDelete = async (deviceId: string) => {
    try {
      await deleteDevice(deviceId);
      toast.success('Device deleted');
      setDeleteConfirmId(null);
      loadData();
    } catch (error) {
      toast.error('Failed to delete device');
    }
  };

  const getDaysSinceActive = (lastActiveAt: string) => {
    const days = Math.floor((new Date().getTime() - new Date(lastActiveAt).getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const filteredDevices = devices.filter((device) => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        device.userEmail.toLowerCase().includes(search) ||
        device.deviceName?.toLowerCase().includes(search) ||
        device.deviceFingerprint.toLowerCase().includes(search)
      );
    }
    return true;
  });

  const groupedByUser = filteredDevices.reduce((acc, device) => {
    if (!acc[device.userId]) {
      acc[device.userId] = [];
    }
    acc[device.userId].push(device);
    return acc;
  }, {} as Record<string, UserDevice[]>);

  if (isLoading) {
    return <div className="text-gray-400">Loading devices...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white">Device Management</h2>
        <p className="text-sm text-gray-400 mt-1">View and manage user devices</p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by email, device name, or fingerprint..."
          className="w-full pl-10 pr-10 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
          data-testid="input-search"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Smartphone className="w-8 h-8 text-blue-400" />
            <div>
              <div className="text-2xl font-bold text-white">{filteredDevices.length}</div>
              <div className="text-sm text-gray-400">Total Devices</div>
            </div>
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Smartphone className="w-8 h-8 text-green-400" />
            <div>
              <div className="text-2xl font-bold text-white">
                {filteredDevices.filter(d => d.isActive).length}
              </div>
              <div className="text-sm text-gray-400">Active Devices</div>
            </div>
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Smartphone className="w-8 h-8 text-gray-400" />
            <div>
              <div className="text-2xl font-bold text-white">
                {filteredDevices.filter(d => !d.isActive).length}
              </div>
              <div className="text-sm text-gray-400">Inactive Devices</div>
            </div>
          </div>
        </div>
      </div>

      {/* Devices List */}
      <div className="space-y-4">
        {!groupedByUser || Object.keys(groupedByUser).length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            No devices found.
          </div>
        ) : (
          Object.entries(groupedByUser || {}).map(([userId, userDevices]) => {
            const userEmail = userDevices[0]?.userEmail || 'Unknown';
            const userLicenses = licenses.filter(l => l.userId === userId && l.isActive);
            const maxDevices = Math.max(...userLicenses.map(l => l.maxDevices), 0);

            return (
              <div key={userId} className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{userEmail}</h3>
                    <p className="text-xs text-gray-500">
                      {userDevices.filter(d => d.isActive).length} / {maxDevices} devices active
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {userDevices.map((device) => {
                    const daysSinceActive = getDaysSinceActive(device.lastActiveAt);
                    const isRecent = daysSinceActive === 0;

                    return (
                      <div
                        key={device.id}
                        className={`p-3 rounded border ${
                          !device.isActive
                            ? 'bg-gray-800/50 border-gray-600'
                            : 'bg-gray-800 border-gray-600'
                        }`}
                        data-testid={`device-${device.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <Smartphone className={`w-4 h-4 ${device.isActive ? 'text-green-400' : 'text-gray-500'}`} />
                              <span className="font-medium text-white">
                                {device.deviceName || 'Unknown Device'}
                              </span>
                              {!device.isActive && (
                                <span className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded">
                                  Inactive
                                </span>
                              )}
                              {isRecent && device.isActive && (
                                <span className="px-2 py-0.5 bg-green-900 text-green-200 text-xs rounded">
                                  Active Now
                                </span>
                              )}
                            </div>

                            <div className="space-y-1 text-xs text-gray-400">
                              <div>
                                Fingerprint: <code className="text-purple-400">{device.deviceFingerprint}</code>
                              </div>
                              {device.deviceInfo && (
                                <div className="text-gray-500">
                                  {device.deviceInfo.userAgent}
                                </div>
                              )}
                              <div className="flex flex-wrap gap-3">
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

                          <div className="flex gap-2">
                            {device.isActive && (
                              <button
                                onClick={() => handleDeactivate(device.id)}
                                className="px-3 py-1 bg-yellow-900/50 hover:bg-yellow-900/70 text-yellow-300 text-xs rounded transition-colors"
                                data-testid={`button-deactivate-${device.id}`}
                              >
                                Deactivate
                              </button>
                            )}
                            <button
                              onClick={() => setDeleteConfirmId(device.id)}
                              className="p-1.5 text-red-400 hover:bg-red-900/30 rounded transition-colors"
                              data-testid={`button-delete-${device.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Delete Confirmation */}
                        {deleteConfirmId === device.id && (
                          <div className="mt-3 p-3 bg-red-900/20 border border-red-700 rounded flex items-center justify-between">
                            <p className="text-sm text-red-300">Delete this device?</p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleDelete(device.id)}
                                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
                                data-testid="button-confirm-delete"
                              >
                                Delete
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default DeviceManager;
