import { useState, useEffect } from 'react';
import { Key, Package, Calendar, AlertCircle, CheckCircle, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  getUserLicenses,
  getAllLicenseFeatures,
  getAllLicensePackages,
  getUserEnabledFeatures,
  syncFeatureSnapshot,
} from '../../lib/licensing';
import type { UserLicense, LicenseFeature, LicensePackage } from '../../../shared/schema';
import { getAuth } from 'firebase/auth';
import { toast } from 'sonner';
import { getFeatureSnapshotSyncAt } from '../../lib/auth/offlineAuth';

const MyLicenses = () => {
  const [licenses, setLicenses] = useState<UserLicense[]>([]);
  const [features, setFeatures] = useState<LicenseFeature[]>([]);
  const [packages, setPackages] = useState<LicensePackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [lastVerifiedAt, setLastVerifiedAt] = useState<string | null>(null);

  const auth = getAuth();

  useEffect(() => {
    loadData();
    loadLastVerifiedAt();
  }, []);

  const loadLastVerifiedAt = async () => {
    const syncAt = await getFeatureSnapshotSyncAt();
    setLastVerifiedAt(syncAt);
  };

  const loadData = async () => {
    if (!auth.currentUser) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const [licensesData, featuresData, packagesData] = await Promise.all([
        getUserLicenses(),
        getAllLicenseFeatures(),
        getAllLicensePackages(),
      ]);
      setLicenses(licensesData);
      setFeatures(featuresData);
      setPackages(packagesData);
    } catch (error) {
      toast.error('Failed to load your licenses');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyNow = async () => {
    if (isVerifying || !navigator.onLine) {
      if (!navigator.onLine) {
        toast.error('No internet connection. Connect to verify your licenses online.');
      }
      return;
    }
    setIsVerifying(true);
    try {
      // Reload live license data and resolve feature keys in parallel
      await Promise.all([
        loadData(),
        getUserEnabledFeatures(),
      ]);
      // Explicitly await the snapshot write so "Last verified" timestamp is
      // immediately fresh (avoids the fire-and-forget race in normal syncs).
      const currentUser = auth.currentUser;
      if (currentUser) {
        await syncFeatureSnapshot(currentUser);
      }
      await loadLastVerifiedAt();
      // toast suppressed
    } catch {
      toast.error('Could not verify licenses. Check your connection and try again.');
    } finally {
      setIsVerifying(false);
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

  const formatSyncAt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  };

  const getActiveLicenses = () => licenses.filter(l => l.isActive && !isExpired(l.expiresAt || undefined));
  const getExpiredLicenses = () => licenses.filter(l => isExpired(l.expiresAt || undefined));
  const getInactiveLicenses = () => licenses.filter(l => !l.isActive && !isExpired(l.expiresAt || undefined));

  const activeLicenses = getActiveLicenses();
  const expiredLicenses = getExpiredLicenses();
  const inactiveLicenses = getInactiveLicenses();

  if (isLoading) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-12 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  if (!auth.currentUser) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
        <p className="text-center text-gray-400">Please log in to view your licenses</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Last Verified */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-2">
            <Key className="w-5 h-5 text-purple-400" />
            My Licenses
          </h3>
          <p className="text-sm text-gray-400">
            View and manage your active licenses
          </p>
        </div>

        {/* Last Verified + Verify Button */}
        <div className="flex flex-col items-end gap-2">
          {lastVerifiedAt && (
            <div
              className="flex items-center gap-1.5 text-xs text-gray-500"
              data-testid="text-last-verified"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
              <span>Last verified: {formatSyncAt(lastVerifiedAt)}</span>
            </div>
          )}
          <button
            onClick={handleVerifyNow}
            disabled={isVerifying}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-700 hover:bg-purple-600 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs rounded transition-colors"
            data-testid="button-verify-now"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
            {isVerifying ? 'Verifying…' : 'Verify Now'}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-400">{activeLicenses.length}</div>
          <div className="text-sm text-gray-400">Active</div>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
          <div className="text-2xl font-bold text-orange-400">{expiredLicenses.length}</div>
          <div className="text-sm text-gray-400">Expired</div>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-400">{inactiveLicenses.length}</div>
          <div className="text-sm text-gray-400">Inactive</div>
        </div>
      </div>

      {/* Active Licenses */}
      {activeLicenses.length > 0 && (
        <div>
          <h4 className="text-md font-semibold text-white mb-3">Active Licenses</h4>
          <div className="space-y-3">
            {activeLicenses.map((license) => {
              const feature = features.find(f => f.featureKey === license.featureKey);
              const pkg = packages.find(p => p.id === license.packageId);
              const daysRemaining = getDaysRemaining(license.expiresAt || undefined);
              const isExpiringSoon = daysRemaining !== null && daysRemaining < 30;

              return (
                <div
                  key={license.id}
                  className={`bg-gray-900 border rounded-lg p-4 ${
                    isExpiringSoon ? 'border-orange-700' : 'border-gray-700'
                  }`}
                  data-testid={`license-${license.id}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3">
                      {license.licenseType === 'feature' ? (
                        <Key className="w-5 h-5 text-purple-400 mt-1" />
                      ) : (
                        <Package className="w-5 h-5 text-blue-400 mt-1" />
                      )}
                      <div>
                        <h5 className="font-medium text-white">
                          {license.licenseType === 'feature'
                            ? (feature?.displayName || license.featureKey)
                            : (pkg?.packageName || 'Feature Package')}
                        </h5>
                        {feature?.description && (
                          <p className="text-sm text-gray-400 mt-1">{feature.description}</p>
                        )}
                        {pkg && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {pkg.featureKeys.map((key) => {
                              const f = features.find(f => f.featureKey === key);
                              return (
                                <span
                                  key={key}
                                  className="px-2 py-0.5 bg-purple-900/50 text-purple-300 text-xs rounded"
                                >
                                  {f?.displayName || key}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 border-t border-gray-700 pt-3">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {license.expiresAt ? (
                        <span className={isExpiringSoon ? 'text-orange-400 font-medium' : ''}>
                          Expires: {new Date(license.expiresAt).toLocaleDateString()}
                          {daysRemaining !== null && daysRemaining > 0 && (
                            <> ({daysRemaining} days)</>
                          )}
                        </span>
                      ) : (
                        <span className="text-green-400">Lifetime License</span>
                      )}
                    </div>
                    <span>•</span>
                    <span>Max Devices: {license.maxDevices}</span>
                    <span>•</span>
                    <span>Activated: {new Date(license.activatedAt).toLocaleDateString()}</span>
                  </div>

                  {isExpiringSoon && (
                    <div className="mt-3 p-2 bg-orange-900/20 border border-orange-700 rounded flex items-start gap-2 text-xs text-orange-300">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>
                        This license expires soon.{' '}
                        <a
                          href={`mailto:support@soltec.ca?subject=${encodeURIComponent('License Renewal Request')}&body=${encodeURIComponent('Hi,\n\nI would like to renew my MeasurePRO license.\n\nThank you.')}`}
                          className="underline text-orange-200 hover:text-white"
                          data-testid="link-renew-expiring"
                        >
                          Contact us to renew →
                        </a>
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Expired Licenses */}
      {expiredLicenses.length > 0 && (
        <div>
          <h4 className="text-md font-semibold text-white mb-3">Expired Licenses</h4>
          <div className="space-y-3">
            {expiredLicenses.map((license) => {
              const feature = features.find(f => f.featureKey === license.featureKey);
              const pkg = packages.find(p => p.id === license.packageId);

              return (
                <div
                  key={license.id}
                  className="bg-gray-900 border border-red-700/50 rounded-lg p-4 opacity-75"
                  data-testid={`license-expired-${license.id}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3">
                      {license.licenseType === 'feature' ? (
                        <Key className="w-5 h-5 text-gray-500 mt-1" />
                      ) : (
                        <Package className="w-5 h-5 text-gray-500 mt-1" />
                      )}
                      <div>
                        <h5 className="font-medium text-gray-300">
                          {license.licenseType === 'feature'
                            ? (feature?.displayName || license.featureKey)
                            : (pkg?.packageName || 'Feature Package')}
                        </h5>
                      </div>
                    </div>
                    <span className="px-2 py-1 bg-red-900/50 text-red-300 text-xs rounded">
                      Expired
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Calendar className="w-3.5 h-3.5" />
                    Expired: {license.expiresAt && new Date(license.expiresAt).toLocaleDateString()}
                  </div>

                  <div className="mt-3">
                    <a
                      href={`mailto:support@soltec.ca?subject=${encodeURIComponent('License Renewal Request - Expired')}&body=${encodeURIComponent('Hi,\n\nMy MeasurePRO license has expired and I would like to renew it.\n\nThank you.')}`}
                      className="text-xs underline text-red-400 hover:text-red-200"
                      data-testid="link-renew-expired"
                    >
                      Contact us to renew → support@soltec.ca
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No Licenses */}
      {licenses.length === 0 && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-12">
          <div className="text-center">
            <Key className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-white mb-2">No Licenses Yet</h4>
            <p className="text-sm text-gray-400 mb-4">
              Activate a license code to unlock premium features
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyLicenses;
