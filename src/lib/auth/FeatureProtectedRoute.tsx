import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { useLicenseCheck } from '../../hooks/useLicenseEnforcement';

interface FeatureProtectedRouteProps {
  children: ReactNode;
  featureKey: string;
  fallbackPath?: string;
}

const LoadingComponent = () => (
  <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
    <div className="text-center">
      <h2 className="text-2xl mb-4">Checking access...</h2>
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
    </div>
  </div>
);

const AccessDenied = ({ featureKey }: { featureKey: string }) => (
  <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-8">
    <div className="max-w-2xl mx-auto text-center">
      <div className="bg-red-900/20 border border-red-500 rounded-lg p-8">
        <h1 className="text-3xl font-bold mb-4 text-red-400">Access Denied</h1>
        <p className="text-gray-300 mb-6">
          You do not have access to this feature: <span className="font-mono text-yellow-400">{featureKey}</span>
        </p>
        <p className="text-gray-400 mb-8">
          This feature requires a premium subscription. Please contact your administrator or upgrade your account.
        </p>
        <a
          href="/"
          className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Return to Home
        </a>
      </div>
    </div>
  </div>
);

/**
 * Route wrapper that checks both authentication AND feature license
 * Combines ProtectedRoute (auth check) with license enforcement
 */
export const FeatureProtectedRoute = ({ 
  children, 
  featureKey,
  fallbackPath 
}: FeatureProtectedRouteProps) => {
  const { hasAccess, isLoading } = useLicenseCheck(featureKey);

  // First wrap in ProtectedRoute for auth check
  return (
    <ProtectedRoute>
      {isLoading ? (
        <LoadingComponent />
      ) : hasAccess ? (
        <>{children}</>
      ) : fallbackPath ? (
        <Navigate to={fallbackPath} replace />
      ) : (
        <AccessDenied featureKey={featureKey} />
      )}
    </ProtectedRoute>
  );
};
