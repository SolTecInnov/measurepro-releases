import { useState, useEffect } from 'react';
import { Search, X, Key, Package, Calendar, Users } from 'lucide-react';
import {
  getAllUserLicenses,
  getAllLicenseFeatures,
  getAllLicensePackages,
  deactivateUserLicense,
} from '../../lib/licensing';
import type { UserLicense, LicenseFeature, LicensePackage } from '../../../shared/schema';
import { toast } from 'sonner';

const UserLicenseViewer = () => {
  const [licenses, setLicenses] = useState<UserLicense[]>([]);
  const [features, setFeatures] = useState<LicenseFeature[]>([]);
  const [packages, setPackages] = useState<LicensePackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'feature' | 'package'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expired'>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [licensesData, featuresData, packagesData] = await Promise.all([
        getAllUserLicenses(),
        getAllLicenseFeatures(),
        getAllLicensePackages(),
      ]);
      setLicenses(licensesData);
      setFeatures(featuresData);
      setPackages(packagesData);
    } catch (error) {
      toast.error('Failed to load user licenses');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await deactivateUserLicense(id);
      toast.success('License deactivated');
      loadData();
    } catch (error) {
      toast.error('Failed to deactivate license');
    }
  };

  const isExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const getDaysRemaining = (expiresAt?: string) => {
    if (!expiresAt) return null;
    const days = Math.ceil((new Date(expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const filteredLicenses = licenses.filter((license) => {
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (
        !license.userEmail.toLowerCase().includes(search) &&
        !license.activationCode.toLowerCase().includes(search)
      ) {
        return false;
      }
    }

    // Type filter
    if (filterType !== 'all' && license.licenseType !== filterType) {
      return false;
    }

    // Status filter
    if (filterStatus === 'active' && (!license.isActive || isExpired(license.expiresAt || undefined))) {
      return false;
    }
    if (filterStatus === 'expired' && !isExpired(license.expiresAt || undefined)) {
      return false;
    }

    return true;
  });

  const groupedByUser = filteredLicenses.reduce((acc, license) => {
    if (!acc[license.userId]) {
      acc[license.userId] = [];
    }
    acc[license.userId].push(license);
    return acc;
  }, {} as Record<string, UserLicense[]>);

  if (isLoading) {
    return <div className="text-gray-400">Loading user licenses...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white">User Licenses</h2>
        <p className="text-sm text-gray-400 mt-1">View all active and expired user licenses</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by email or code..."
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
        </div>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as any)}
          className="px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          data-testid="select-type-filter"
        >
          <option value="all">All Types</option>
          <option value="feature">Features Only</option>
          <option value="package">Packages Only</option>
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          data-testid="select-status-filter"
        >
          <option value="all">All Status</option>
          <option value="active">Active Only</option>
          <option value="expired">Expired Only</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-purple-400" />
            <div>
              <div className="text-2xl font-bold text-white">{Object.keys(groupedByUser).length}</div>
              <div className="text-sm text-gray-400">Total Users</div>
            </div>
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Key className="w-8 h-8 text-green-400" />
            <div>
              <div className="text-2xl font-bold text-white">
                {filteredLicenses.filter(l => l.isActive && !isExpired(l.expiresAt || undefined)).length}
              </div>
              <div className="text-sm text-gray-400">Active Licenses</div>
            </div>
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-8 h-8 text-red-400" />
            <div>
              <div className="text-2xl font-bold text-white">
                {filteredLicenses.filter(l => isExpired(l.expiresAt || undefined)).length}
              </div>
              <div className="text-sm text-gray-400">Expired Licenses</div>
            </div>
          </div>
        </div>
      </div>

      {/* Users List */}
      <div className="space-y-4">
        {!groupedByUser || Object.keys(groupedByUser).length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            No user licenses found.
          </div>
        ) : (
          Object.entries(groupedByUser || {}).map(([userId, userLicenses]) => {
            const userEmail = userLicenses[0]?.userEmail || 'Unknown';
            return (
              <div key={userId} className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                <div className="mb-3">
                  <h3 className="text-lg font-semibold text-white">{userEmail}</h3>
                  <p className="text-xs text-gray-500">User ID: {userId}</p>
                </div>

                <div className="space-y-2">
                  {userLicenses.map((license) => {
                    const feature = features.find(f => f.featureKey === license.featureKey);
                    const pkg = packages.find(p => p.id === license.packageId);
                    const expired = isExpired(license.expiresAt || undefined);
                    const daysRemaining = getDaysRemaining(license.expiresAt || undefined);

                    return (
                      <div
                        key={license.id}
                        className={`p-3 rounded border ${
                          !license.isActive || expired
                            ? 'bg-red-900/20 border-red-700'
                            : 'bg-gray-800 border-gray-600'
                        }`}
                        data-testid={`license-${license.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              {license.licenseType === 'feature' ? (
                                <Key className="w-4 h-4 text-purple-400" />
                              ) : (
                                <Package className="w-4 h-4 text-blue-400" />
                              )}
                              <span className="font-medium text-white">
                                {license.licenseType === 'feature' 
                                  ? (feature?.displayName || license.featureKey)
                                  : (pkg?.packageName || license.packageId)
                                }
                              </span>
                              {!license.isActive && (
                                <span className="px-2 py-0.5 bg-red-900 text-red-200 text-xs rounded">
                                  Deactivated
                                </span>
                              )}
                              {expired && (
                                <span className="px-2 py-0.5 bg-orange-900 text-orange-200 text-xs rounded">
                                  Expired
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                              <span>
                                Code: <code className="text-purple-400">{license.activationCode}</code>
                              </span>
                              <span>•</span>
                              <span>
                                Activated: {new Date(license.activatedAt).toLocaleDateString()}
                              </span>
                              <span>•</span>
                              {license.expiresAt ? (
                                <span className={daysRemaining && daysRemaining < 30 ? 'text-orange-400' : ''}>
                                  Expires: {new Date(license.expiresAt).toLocaleDateString()}
                                  {daysRemaining !== null && daysRemaining > 0 && (
                                    <> ({daysRemaining} days)</>
                                  )}
                                </span>
                              ) : (
                                <span className="text-green-400">Lifetime</span>
                              )}
                              <span>•</span>
                              <span>Max Devices: {license.maxDevices}</span>
                            </div>
                          </div>

                          {license.isActive && !expired && (
                            <button
                              onClick={() => handleDeactivate(license.id)}
                              className="px-3 py-1 bg-red-900/50 hover:bg-red-900/70 text-red-300 text-xs rounded transition-colors"
                              data-testid={`button-deactivate-${license.id}`}
                            >
                              Deactivate
                            </button>
                          )}
                        </div>
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

export default UserLicenseViewer;
