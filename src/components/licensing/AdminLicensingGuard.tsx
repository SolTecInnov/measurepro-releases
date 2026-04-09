import { useState, useEffect } from 'react';
import { getSafeAuth } from '../../lib/firebase';
import { Lock } from 'lucide-react';
import { toast } from 'sonner';
import { isMasterAdmin } from '../../lib/auth/masterAdmin';
import { useAuth } from '../../lib/auth/AuthContext';

interface AdminLicensingGuardProps {
  children: React.ReactNode;
}

export const AdminLicensingGuard = ({ children }: AdminLicensingGuardProps) => {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const { user: authContextUser, isMasterAdmin: cachedIsMasterAdmin, isLoading, cachedUserData } = useAuth();

  const auth = getSafeAuth();

  useEffect(() => {
    const checkAuth = async () => {
      // WAIT for AuthContext to finish loading cached data
      if (isLoading) {
        return;
      }

      // Check cached master admin flag FIRST (works offline)
      if (cachedIsMasterAdmin) {
        setIsAuthorized(true);
        setIsCheckingAuth(false);
        return;
      }

      const currentUser = auth?.currentUser;
      
      // Check if we have any user data (Firebase or cached)
      const hasUserData = !!(currentUser || authContextUser || cachedUserData);
      
      if (!hasUserData) {
        setIsCheckingAuth(false);
        setIsAuthorized(false);
        return;
      }
      
      // Offline fallback - check cached user
      if (!currentUser) {
        const userEmail = authContextUser?.email || cachedUserData?.email;
        if (userEmail && isMasterAdmin(userEmail)) {
          setIsAuthorized(true);
          setIsCheckingAuth(false);
          return;
        }
        setIsCheckingAuth(false);
        setIsAuthorized(false);
        return;
      }

      try {
        // Online check - Master admin has immediate access
        if (isMasterAdmin(currentUser.email)) {
          setIsAuthorized(true);
          setIsCheckingAuth(false);
          return;
        }
        
        // Check Firebase Custom Claims for admin role
        const tokenResult = await currentUser.getIdTokenResult();
        const isAdmin = tokenResult.claims.admin === true;
        
        if (isAdmin) {
          setIsAuthorized(true);
          setIsCheckingAuth(false);
        } else {
          setIsAuthorized(false);
          setIsCheckingAuth(false);
          toast.error('Access denied: Admin privileges required');
        }
      } catch (error) {
        setIsAuthorized(false);
        setIsCheckingAuth(false);
        toast.error('Error verifying admin access');
      }
    };

    checkAuth();

    // Listen for auth changes
    const unsubscribe = auth.onAuthStateChanged(checkAuth);
    return () => unsubscribe();
  }, [auth, cachedIsMasterAdmin, authContextUser, cachedUserData, isLoading]);


  if (isLoading || isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  // Check both Firebase user and cached user for offline support
  const currentUser = auth?.currentUser || authContextUser;
  
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-red-500 to-pink-500 rounded-full mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Admin Licensing Panel</h1>
          <p className="text-gray-400 mb-4">Please sign in to access this area</p>
          <p className="text-sm text-gray-500 mb-6">Authorized admin accounts only</p>
          
          <div className="flex flex-col gap-3">
            <a
              href="/login"
              className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-lg shadow-lg transition-all duration-200 text-center"
              data-testid="button-sign-in"
            >
              Sign In
            </a>
            <a
              href="/"
              className="text-sm text-gray-400 hover:text-gray-300 transition-colors"
              data-testid="link-back-welcome"
            >
              Back to Welcome
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthorized && !isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-red-500 to-pink-500 rounded-full mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-gray-400 mb-4">You do not have admin privileges for this panel</p>
          <p className="text-sm text-gray-500 mb-4">Email: {currentUser?.email}</p>
          <div className="text-xs text-gray-600 p-4 bg-gray-900 rounded-lg">
            <p className="mb-2">Admin access requires Firebase Custom Claims.</p>
            <p>Contact your system administrator to request admin privileges.</p>
          </div>
        </div>
      </div>
    );
  }

  if (isAuthorized) {
    return <>{children}</>;
  }

  return null;
};
