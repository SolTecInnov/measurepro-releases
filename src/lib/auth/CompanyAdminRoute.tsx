import { ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from './AuthContext';
import { getCompanyMembershipFromCache } from './offlineAuth';
import { getUserCompanyMembership } from '../companyOfflineStore';
import { authedFetch } from '../authedFetch';

interface CompanyAdminRouteProps {
  children: ReactNode;
}

type GuardState = 'loading' | 'allowed' | 'no_company' | 'no_role';

/**
 * Route guard for the Company Admin portal.
 * Checks that the authenticated user has a company_admin role.
 *
 * Priority:
 * 1. API response (when online) — most authoritative
 * 2. offlineAuth cache (companyRole persisted at login) — fast offline fallback
 * 3. Company members IndexedDB store — secondary offline fallback
 */
export function CompanyAdminRoute({ children }: CompanyAdminRouteProps) {
  const { user } = useAuth();
  const [state, setGuardState] = useState<GuardState>('loading');

  useEffect(() => {
    if (!user) {
      setGuardState('no_company');
      return;
    }

    // App admins (password-unlocked) always get through
    if (sessionStorage.getItem('admin_unlocked') === 'true') {
      setGuardState('allowed');
      return;
    }

    const check = async () => {
      try {
        // 1. Try the API (allowOfflineAuth verifies bearer token when present)
        const res = await authedFetch('/api/my-company');
        if (res.ok) {
          const data = await res.json();
          if (data?.membership?.role === 'company_admin') {
            setGuardState('allowed');
          } else if (data?.company) {
            setGuardState('no_role');
          } else {
            setGuardState('no_company');
          }
          return;
        }
      } catch {
        // Network error — fall through to cached sources
      }

      // 2. Auth cache (companyRole persisted at login via seedCompanyDataOffline)
      try {
        const cached = await getCompanyMembershipFromCache();
        if (cached?.companyRole === 'company_admin') {
          setGuardState('allowed');
          return;
        } else if (cached?.companyId) {
          setGuardState('no_role');
          return;
        }
      } catch {
        // Ignore
      }

      // 3. Members IndexedDB store (secondary fallback)
      try {
        const membership = await getUserCompanyMembership(user.uid);
        if (membership?.role === 'company_admin') {
          setGuardState('allowed');
        } else if (membership) {
          setGuardState('no_role');
        } else {
          setGuardState('no_company');
        }
      } catch {
        setGuardState('no_company');
      }
    };

    check();
  }, [user]);

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (state === 'no_company' || state === 'no_role') {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}
