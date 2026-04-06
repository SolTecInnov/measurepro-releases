import { ReactNode, useState, useEffect, lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import { getCurrentUser, getAccountForUid, signOutUser } from '../firebase';
import { isMasterAdmin } from './masterAdmin';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

const PermissionsRequest = lazy(() => import('../../components/PermissionsRequest'));
const PwaInstallPrompt = lazy(() => import('../../components/PwaInstallPrompt'));

function checkShouldShowPwa(): boolean {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
  if (standalone) return false;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (isMobile) return false;
  const dismissed = localStorage.getItem('pwa_install_dismissed');
  return dismissed !== 'permanent';
}

interface ProtectedRouteProps {
  children: ReactNode;
}

const LoadingComponent = () => (
  <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
    <div className="text-center">
      <h2 className="text-2xl mb-4">Loading...</h2>
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
    </div>
  </div>
);

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user: authContextUser, isMasterAdmin: cachedIsMasterAdmin } = useAuth();
  const [needsPermissions, setNeedsPermissions] = useState<boolean | null>(null);
  const [accountStatus, setAccountStatus] = useState<string | null>(null);
  const [checkingAccount, setCheckingAccount] = useState(true);
  const [showPwaPrompt, setShowPwaPrompt] = useState(false);

  // Check if user is master admin (works offline via cached data or Firebase user)
  const currentUser = getCurrentUser();
  const isMasterAdminUser = cachedIsMasterAdmin || 
                           isMasterAdmin(currentUser?.email) || 
                           isMasterAdmin(authContextUser?.email);

  // Master admin bypasses app_access check
  if (isMasterAdminUser) {
    localStorage.setItem('app_access', 'true');
  }

  // Check for app access in localStorage (after master admin check)
  const hasAccess = localStorage.getItem('app_access') === 'true';

  // ALL hooks must be called unconditionally before any conditional returns.
  // Internal guards replicate the conditional logic.

  // Check account status when user has app access
  useEffect(() => {
    if (!hasAccess && !isMasterAdminUser) return;

    const checkAccountStatus = async () => {
      try {
        const user = getCurrentUser();

        if (!user) {
          setCheckingAccount(false);
          return;
        }

        const account = await getAccountForUid(user.uid);

        if (!account) {
          setCheckingAccount(false);
          return;
        }

        setAccountStatus(account.status);

        if (account.status === 'rejected') {
          toast.error('Account Rejected', {
            description: 'Your account registration was not approved. Please contact support if you believe this is an error.',
          });
          localStorage.removeItem('app_access');
          await signOutUser();
          setAccountStatus('rejected');
        }

        setCheckingAccount(false);
      } catch (error) {
        toast.error('Error', {
          description: 'Failed to verify account status. Please try again later.',
        });
        setCheckingAccount(false);
      }
    };

    checkAccountStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAccess, isMasterAdminUser]);

  // Check permissions for mobile devices (runs only when user has access)
  useEffect(() => {
    if (!hasAccess && !isMasterAdminUser) return;

    const checkPermissions = async () => {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      if (!isMobile) {
        setNeedsPermissions(false);
        return;
      }

      const permissionsRequested = localStorage.getItem('permissions_requested');

      if (!permissionsRequested) {
        setNeedsPermissions(true);
        return;
      }

      let gpsGranted = false;
      try {
        const gpsPermission = await navigator.permissions.query({ name: 'geolocation' });
        gpsGranted = gpsPermission.state === 'granted';
      } catch (error) {
        gpsGranted = localStorage.getItem('gps_permission_granted') === 'true';
      }

      setNeedsPermissions(!gpsGranted);
    };

    checkPermissions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAccess, isMasterAdminUser]);

  // Show PWA install prompt once per session on desktop browsers
  useEffect(() => {
    if (!checkingAccount && needsPermissions === false && checkShouldShowPwa()) {
      const lastShown = localStorage.getItem('pwa_install_last_shown');
      const now = Date.now();
      if (!lastShown || now - Number(lastShown) > 86400000) {
        localStorage.setItem('pwa_install_last_shown', String(now));
        setShowPwaPrompt(true);
      }
    }
  }, [checkingAccount, needsPermissions]);

  // --- Conditional renders (all hooks have been called above) ---

  // If no access and not master admin, redirect to welcome page
  if (!hasAccess && !isMasterAdminUser) {
    return <Navigate to="/" replace />;
  }

  // Show loading state while checking account or permissions
  if (checkingAccount || needsPermissions === null) {
    return <LoadingComponent />;
  }

  // Redirect to awaiting approval if account is pending
  if (accountStatus === 'pending' || accountStatus === 'email_pending') {
    return <Navigate to="/awaiting-approval" replace />;
  }

  // Redirect to login if account is rejected
  if (accountStatus === 'rejected') {
    return <Navigate to="/" replace />;
  }

  // Show permissions request screen if needed (mobile only, after authentication)
  if (needsPermissions) {
    return (
      <Suspense fallback={<LoadingComponent />}>
        <PermissionsRequest 
          onComplete={() => setNeedsPermissions(false)}
          onSkip={() => setNeedsPermissions(false)}
        />
      </Suspense>
    );
  }

  // User has access, account approved (or no account), and permissions granted
  return (
    <>
      {children}
      {showPwaPrompt && (
        <Suspense fallback={null}>
          <PwaInstallPrompt onDismiss={() => setShowPwaPrompt(false)} />
        </Suspense>
      )}
    </>
  );
};
