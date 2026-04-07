import { useEffect, useState } from 'react';
import firebase from '../lib/firebase';
import { getUserEnabledFeatures, getUserLicenses } from '../lib/licensing';
import type { UserLicense } from '../../shared/schema';
import { toast } from 'sonner';
import { isMasterAdmin } from '../lib/auth/masterAdmin';
import { useAuth } from '../lib/auth/AuthContext';
import { hasShownExpiryWarnToday, markExpiryWarnShown } from '../lib/auth/offlineAuth';

/**
 * License startup and periodic validation hook
 * 
 * Features:
 * - Validates licenses on app startup
 * - Periodic revalidation every hour
 * - Warns users about licenses expiring soon (7-day grace period)
 * - Notifies about expired licenses
 * - Master admin bypasses all validation (works offline via cached data)
 */
export function useLicenseStartupCheck() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasAnyLicense, setHasAnyLicense] = useState(false);
  const auth = firebase.auth;
  const { user: authContextUser, isMasterAdmin: cachedIsMasterAdmin } = useAuth();

  useEffect(() => {
    // 1. Check cached master admin flag FIRST (works offline)
    if (cachedIsMasterAdmin) {
      setIsInitializing(false);
      setHasAnyLicense(true);
      return;
    }

    // 2. Check Firebase user (only works online)
    if (!auth || !auth.currentUser) {
      // In offline mode, fall back to cached user data
      if (authContextUser?.email && isMasterAdmin(authContextUser.email)) {
        setIsInitializing(false);
        setHasAnyLicense(true);
        return;
      }
      setIsInitializing(false);
      return;
    }

    // 3. Check Firebase user email - master admin bypasses license validation
    if (auth.currentUser?.email && isMasterAdmin(auth.currentUser.email)) {
      setIsInitializing(false);
      setHasAnyLicense(true);
      return;
    }

    const validateLicenses = async () => {
      try {
        // getUserEnabledFeatures falls back to IndexedDB cache when offline —
        // both calls are wrapped separately so one failure doesn't block the other.
        let licenses: UserLicense[] = [];
        let features: string[] = [];

        try {
          licenses = await getUserLicenses();
        } catch {
          // Offline or Firebase unavailable — skip license list; expiry warnings
          // will resume the next time the user is online.
        }

        try {
          features = await getUserEnabledFeatures();
        } catch {
          // Offline with no cached feature keys yet — non-fatal, continue.
        }

        // Mark user as having a license if we have cached feature keys even
        // when the live license list could not be fetched.
        if (licenses.length > 0 || features.length > 0) {
          setHasAnyLicense(true);
        }

        // Check for expiring licenses (within 7 days) — only possible when online
        const now = new Date();
        const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const expiringLicenses = licenses.filter((license: UserLicense) => {
          if (!license.expiresAt || !license.isActive) return false;
          const expiryDate = new Date(license.expiresAt);
          return expiryDate > now && expiryDate <= sevenDaysFromNow;
        });

        // Check for expired licenses
        const expiredLicenses = licenses.filter((license: UserLicense) => {
          if (!license.expiresAt) return false;
          const expiryDate = new Date(license.expiresAt);
          return expiryDate <= now && license.isActive;
        });

        // Show warnings for expiring licenses — once per day, persisted in IndexedDB
        if (expiringLicenses.length > 0) {
          const alreadyWarned = await hasShownExpiryWarnToday();
          if (!alreadyWarned) {
            const firstExpiry = new Date(expiringLicenses[0].expiresAt!);
            const daysRemaining = Math.ceil(
              (firstExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            );
            const expiryDateStr = firstExpiry.toLocaleDateString(undefined, { dateStyle: 'medium' });
            const userEmail = auth.currentUser?.email ?? '';
            const licenseTypes = expiringLicenses
              .map(l => l.featureKey ?? l.packageId ?? 'license')
              .join(', ');
            const renewSubject = encodeURIComponent('MeasurePRO License Renewal Request');
            const renewBody = encodeURIComponent(
              `Hi SolTec Support,\n\nI would like to renew my MeasurePRO license.\n\nAccount email: ${userEmail}\nLicense(s) expiring: ${licenseTypes}\nExpiry date: ${expiryDateStr}\n\nThank you.`
            );
            const renewUrl = `mailto:support@soltec.ca?subject=${renewSubject}&body=${renewBody}`;
            /* toast removed */
            await markExpiryWarnShown();
          }
        }

        // Show errors for expired licenses
        if (expiredLicenses.length > 0) {
          const firstExpiredAt = new Date(expiredLicenses[0].expiresAt!);
          const expiredDateStr = firstExpiredAt.toLocaleDateString(undefined, { dateStyle: 'medium' });
          const userEmail = auth.currentUser?.email ?? '';
          const licenseTypes = expiredLicenses
            .map(l => l.featureKey ?? l.packageId ?? 'license')
            .join(', ');
          const renewSubject = encodeURIComponent('MeasurePRO License Renewal — Expired');
          const renewBody = encodeURIComponent(
            `Hi SolTec Support,\n\nMy MeasurePRO license has expired and I would like to renew it.\n\nAccount email: ${userEmail}\nExpired license(s): ${licenseTypes}\nExpired on: ${expiredDateStr}\n\nThank you.`
          );
          const renewUrl = `mailto:support@soltec.ca?subject=${renewSubject}&body=${renewBody}`;
          toast.error(
            `${expiredLicenses.length} license${expiredLicenses.length !== 1 ? 's' : ''} expired (${expiredDateStr}). Some features may be disabled.`,
            {
              duration: 15000,
              description: (
                <a
                  href={renewUrl}
                  className="underline text-red-200 hover:text-white"
                >
                  Contact support@soltec.ca to renew →
                </a>
              ),
            }
          );
        }
      } catch (error) {
        // Don't show error toast - fail silently to avoid disrupting user experience
      } finally {
        setIsInitializing(false);
      }
    };

    // Initial validation on startup
    validateLicenses();

    // Periodic revalidation every hour
    const intervalId = setInterval(validateLicenses, 60 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [auth.currentUser, authContextUser, cachedIsMasterAdmin]);

  return { isInitializing, hasAnyLicense };
}

/**
 * Higher-order component to add license startup check to app
 */
interface LicenseStartupCheckProviderProps {
  children: React.ReactNode;
}

export function LicenseStartupCheckProvider({ children }: LicenseStartupCheckProviderProps) {
  useLicenseStartupCheck(); // Run license validation in background

  // Don't block app loading - validation runs asynchronously
  return <>{children}</>;
}
