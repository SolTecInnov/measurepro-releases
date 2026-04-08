import React, { useState, useEffect } from 'react';
import { MemoryRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import { HelmetProvider } from 'react-helmet-async';
import { ProtectedRoute } from './lib/auth/ProtectedRoute';
import { FeatureProtectedRoute } from './lib/auth/FeatureProtectedRoute';
import { CompanyAdminRoute } from './lib/auth/CompanyAdminRoute';
import { AutoUpdater } from './components/AutoUpdater';
import { DisclaimerModal, useDisclaimerAccepted } from './components/DisclaimerModal';
import { ThemeProvider } from './components/ThemeProvider';
import { LazyLoadErrorBoundary } from './components/LazyLoadErrorBoundary';
import AdminNavBar from './components/admin/AdminNavBar';

// Import stores directly but handle errors
import { useSurveyStore } from './lib/survey/store';
import { usePOIStore } from './lib/poi';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useSyncSurveyToCamera } from './lib/hooks/useSyncSurveyToCamera';
import { useCameraAutoDetect } from './hooks/useCameraAutoDetect';
import { useVersionPoller } from './hooks/useVersionPoller';
import { usePointCloudStore } from './stores/pointCloudStore';
import { getEffectiveStorageQuota, refreshStorageEstimate } from './lib/utils/storageManager';
import OfflineBanner from './components/OfflineBanner';
import PwaUpdatePrompt from './components/PwaUpdatePrompt';
import UpdateNotification from './components/UpdateNotification';
import { DroneImportToast } from './components/drone/DroneImportToast';
import { DroneImportPanel } from './components/drone/DroneImportPanel';
import OnlineBanner from './components/OnlineBanner';
import { GracePeriodBanner } from './components/GracePeriodBanner';
import { GracePeriodLockout } from './components/GracePeriodLockout';
import { TrialLockout } from './components/TrialLockout';
import { SessionEvictionBanner } from './components/auth/SessionEvictionBanner';
import StorageHealthBanner from './components/StorageHealthBanner';
import { LicenseStartupCheckProvider } from './hooks/useLicenseStartupCheck';
import { useAuth } from './lib/auth/AuthContext';

// Lazy load components to prevent blocking errors
const Settings = React.lazy(() => import('./pages/Settings'));
const SlaveAppPage = React.lazy(() => import('./pages/SlaveAppPage'));
const LiveMonitor = React.lazy(() => import('./pages/LiveMonitor'));
const WelcomePage = React.lazy(() => import('./pages/WelcomePage'));
const FeaturesPage = React.lazy(() => import('./pages/FeaturesPage'));
const PricingPage = React.lazy(() => import('./pages/PricingPage'));
const CheckoutSuccessPage = React.lazy(() => import('./pages/CheckoutSuccessPage'));
const HelpPage = React.lazy(() => import('./pages/HelpPage'));
const BlogPage = React.lazy(() => import('./pages/BlogPage'));
const PrivacyPolicyPage = React.lazy(() => import('./pages/PrivacyPolicyPage'));
const PoliciesPage = React.lazy(() => import('./pages/PoliciesPage'));
const TermsPage = React.lazy(() => import('./pages/TermsPage'));
const ContactPage = React.lazy(() => import('./pages/ContactPage'));
const DocumentationPage = React.lazy(() => import('./pages/DocumentationPage'));
const DocsIndexPage = React.lazy(() => import('./pages/docs/DocsIndexPage'));
const LaserQuickStartPage = React.lazy(() => import('./pages/docs/LaserQuickStartPage'));
const GnssQuickStartPage = React.lazy(() => import('./pages/docs/GnssQuickStartPage'));
const FieldReferencePage = React.lazy(() => import('./pages/docs/FieldReferencePage'));
const EnvironmentalGuidePage = React.lazy(() => import('./pages/docs/EnvironmentalGuidePage'));
const AutoPartGuidePage = React.lazy(() => import('./pages/docs/AutoPartGuidePage'));
const PandarGuide40PPage = React.lazy(() => import('./pages/docs/PandarGuide40PPage'));
const VoiceCommandsPage = React.lazy(() => import('./pages/docs/VoiceCommandsPage'));
const CameraBridgePage = React.lazy(() => import('./pages/docs/CameraBridgePage'));
const ConvoyLeader = React.lazy(() => import('./components/convoy/ConvoyLeader'));
const ConvoyFollower = React.lazy(() => import('./components/convoy/ConvoyFollower'));
const MobileAppSelector = React.lazy(() => import('./components/MobileAppSelector'));
const DispatchConsole = React.lazy(() => import('./components/route-enforcement/DispatchConsole'));
const DispatchLiveView = React.lazy(() => import('./components/route-enforcement/DispatchLiveView'));
const DriverInterface = React.lazy(() => import('./components/route-enforcement/DriverInterface'));
const MarketingPage = React.lazy(() => import('./pages/MarketingPage'));
const DemoShowcasePage = React.lazy(() => import('./pages/DemoShowcasePage'));

// Registration and Account Management Pages
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const ForgotPasswordPage = React.lazy(() => import('./pages/ForgotPasswordPage'));
const RegisterPage = React.lazy(() => import('./pages/RegisterPage'));
const SignupPage = React.lazy(() => import('./pages/SignupPage'));
const VerifyPage = React.lazy(() => import('./pages/VerifyPage'));
const VerifySmsPage = React.lazy(() => import('./pages/VerifySmsPage'));
const SetPasswordPage = React.lazy(() => import('./pages/SetPasswordPage'));
const AwaitingApprovalPage = React.lazy(() => import('./pages/AwaitingApprovalPage'));
const AdminPage = React.lazy(() => import('./pages/AdminPage'));
const AdminCompaniesPage = React.lazy(() => import('./pages/AdminCompaniesPage'));
const CompanyAdminPage = React.lazy(() => import('./pages/CompanyAdminPage'));
const AdminAccountsPage = React.lazy(() => import('./pages/AdminAccountsPage'));
const AdminLicensingPanel = React.lazy(() => import('./pages/AdminLicensingPanel'));
const AdminAnalyticsPage = React.lazy(() => import('./pages/AdminAnalyticsPage'));
const PricingManagementPage = React.lazy(() => import('./pages/PricingManagementPage'));
const LicenseManagementPage = React.lazy(() => import('./pages/LicenseManagementPage'));
const SubscriptionPage = React.lazy(() => import('./pages/SubscriptionPage'));
const TermsManagementPage = React.lazy(() => import('./pages/TermsManagementPage'));
const TestingPage = React.lazy(() => import('./pages/TestingPage'));
const PointCloudScannerPage = React.lazy(() => import('./pages/PointCloudScannerPage'));
const RoadProfilePage = React.lazy(() => import('./pages/RoadProfile'));
const LidarPage = React.lazy(() => import('./pages/LidarPage'));
const LidarSourcePage = React.lazy(() => import('./pages/LidarSourcePage'));
const DebugIndexedDB = React.lazy(() => import('./pages/DebugIndexedDB'));
const DebugStress = React.lazy(() => import('./pages/DebugStress'));
const ExportSurvey = React.lazy(() => import('./pages/ExportSurvey'));
const ChangelogPage = React.lazy(() => import('./pages/Changelog'));
const UserManualPage = React.lazy(() => import('./pages/UserManualPage'));
const ScribeTutorialPage = React.lazy(() => import('./pages/ScribeTutorialPage'));

import TermsReacceptanceModal from './components/TermsReacceptanceModal';
import AIWelcomeDialog from './components/AIWelcomeDialog';
import { useAITrial } from './hooks/useAITrial';
import { ReauthModal } from './components/ReauthModal';
import { ForcePasswordChange } from './components/ForcePasswordChange';
import { TermsVersion } from '../shared/schema';
import { DemoOverlay } from './components/demo/DemoOverlay';
import { DemoModeProvider } from './components/demo/DemoModeProvider';
import { apiRequest } from './lib/queryClient';
import { useHardwareAutoReconnect } from './hooks/useHardwareAutoReconnect';
import { useHardwareProfileSaver } from './hooks/useHardwareProfileSaver';
import HardwareAutoReconnectModal from './components/hardware/HardwareAutoReconnectModal';
import { initializeWorkerArchitecture } from './lib/survey/workerAdapter';
import { getMeasurementLogger, initializeAutoFlush } from './lib/workers/MeasurementLoggerClient';
import { backgroundSyncService } from './lib/backgroundSync';
import { initFlushOnClose } from './lib/survey/flushOnClose';
import { runStage1Migration } from './lib/gnss/migration';
import { MigrationProgressDialog } from './components/gnss/MigrationProgressDialog';
import CrashRecoveryDialog from './components/survey/CrashRecoveryDialog';
import { IndexedDBBlockedWarning } from './components/IndexedDBBlockedWarning';
import { dbBlockedEvent } from './lib/survey/db';
import { exportOrphanedMeasurements, deleteOrphanedMeasurements, findOrphanedMeasurements } from './lib/survey/orphanedMeasurements';
import { PerformanceMonitor } from './components/PerformanceMonitor';
import { usePerformanceWarnings } from './hooks/usePerformanceWarnings';
import { usePerformanceMonitor } from './hooks/usePerformanceMonitor';
import { useSettingsStore } from './lib/settings';
import { checkIndexedDBHealth } from './lib/storage/indexedDBHealth';

// Lazy load optional components
const NetworkStatusBanner = React.lazy(() => import('./components/NetworkStatusBanner').catch(() => ({ default: () => null })));
const DeviceRedirector = React.lazy(() => import('./components/DeviceRedirector').catch(() => ({ default: () => null })));

// Create a loading component
const LoadingComponent = () => (
  <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
    <div className="text-center">
      <h2 className="text-2xl mb-4">Loading...</h2>
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
    </div>
  </div>
);

// Clears all SW caches and navigates to a cache-busting URL.
// Used by both ErrorFallback and LazyLoadErrorBoundary so recovery is consistent.
async function clearCachesAndReload() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map(n => caches.delete(n)));
    }
  } catch {
    // Ignore — best effort
  }
  try { sessionStorage.clear(); } catch {}
  const url = new URL(window.location.href);
  url.searchParams.set('_cb', Date.now().toString());
  window.location.replace(url.toString());
}

// Error fallback component — shown when a non-chunk React error is caught.
const ErrorFallback = ({ error }: { error: any }) => (
  <div className="min-h-screen bg-gray-900 text-white p-8">
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-4 text-red-500">Component Load Error</h1>
      <div className="bg-gray-800 p-4 rounded-lg mb-4">
        <p className="text-red-400 mb-2">Failed to load component:</p>
        <pre className="text-sm whitespace-pre-wrap">{String(error)}</pre>
      </div>
      <div className="space-y-3">
        <button
          onClick={clearCachesAndReload}
          className="w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 rounded font-medium"
        >
          Clear Cache &amp; Reload
        </button>
        <button
          onClick={() => window.location.reload()}
          className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
        >
          Try Normal Reload
        </button>
      </div>
      <p className="text-gray-500 text-xs mt-4">
        If this persists, try: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
      </p>
    </div>
  </div>
);

// Helper to track reload attempts and prevent infinite loops.
// Uses a counter so that after MAX_RELOAD_ATTEMPTS we stop auto-reloading
// regardless of time elapsed — prevents the "Update Required" infinite loop.
const RELOAD_KEY = 'chunk_reload_attempt';
const RELOAD_COUNT_KEY = 'chunk_reload_count';
const RELOAD_COOLDOWN_MS = 30000; // 30 seconds cooldown between reload attempts
const MAX_RELOAD_ATTEMPTS = 2; // stop auto-reloading after 2 attempts

function canAttemptReload(): boolean {
  try {
    const count = parseInt(sessionStorage.getItem(RELOAD_COUNT_KEY) || '0', 10);
    if (count >= MAX_RELOAD_ATTEMPTS) return false;
    const lastAttempt = sessionStorage.getItem(RELOAD_KEY);
    if (!lastAttempt) return true;
    const elapsed = Date.now() - parseInt(lastAttempt, 10);
    return elapsed > RELOAD_COOLDOWN_MS;
  } catch {
    return true;
  }
}

function markReloadAttempt(): void {
  try {
    const count = parseInt(sessionStorage.getItem(RELOAD_COUNT_KEY) || '0', 10);
    sessionStorage.setItem(RELOAD_COUNT_KEY, String(count + 1));
    sessionStorage.setItem(RELOAD_KEY, Date.now().toString());
  } catch {
    // Ignore storage errors
  }
}

function clearReloadAttempt(): void {
  try {
    sessionStorage.removeItem(RELOAD_KEY);
    sessionStorage.removeItem(RELOAD_COUNT_KEY);
  } catch {
    // Ignore storage errors
  }
}

// Clear reload tracking on successful app load
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    // If we get here without errors, the reload worked - clear the flag
    setTimeout(clearReloadAttempt, 2000);
  });
}

// Error boundary for each route
class RouteErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: any; isReloading: boolean; reloadBlocked: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null, isReloading: false, reloadBlocked: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo?: React.ErrorInfo) {
    console.error('🔍 ComponentStack:', errorInfo?.componentStack);
    // Only treat genuine module/chunk fetch failures as stale-deploy errors.
    // Do NOT include "Minified React error" — that pattern also matches real app
    // bugs (bad hook order, missing context, etc.) and causes an infinite reload loop.
    const isChunkError =
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('Importing a module script failed') ||
      error.message.includes('error loading dynamically imported module') ||
      error.message.includes('ChunkLoadError') ||
      error.message.includes('Loading chunk');

    if (isChunkError) {
      if (canAttemptReload()) {
        markReloadAttempt();
        console.warn('🔄 Stale deployment error detected, auto-reloading...', error.message);
        this.setState({ isReloading: true });
        // Clear caches before reloading to ensure fresh chunks are served
        if ('caches' in window) {
          caches.keys().then(names => {
            Promise.all(names.map(name => caches.delete(name))).then(() => {
              setTimeout(() => window.location.reload(), 500);
            });
          }).catch(() => {
            setTimeout(() => window.location.reload(), 500);
          });
        } else {
          setTimeout(() => window.location.reload(), 500);
        }
      } else {
        console.warn('⚠️ Stale deployment error detected but reload recently attempted - showing manual reload option');
        this.setState({ reloadBlocked: true });
      }
    } else {
      console.error('❌ RouteErrorBoundary caught non-chunk error:', error.message);
    }
  }

  handleManualReload = () => {
    clearReloadAttempt();
    window.location.reload();
  };

  handleHardRefresh = async () => {
    clearReloadAttempt();

    try {
      // Unregister all service workers first
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }

      // Clear all SW/fetch caches
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map(name => caches.delete(name)));
      }

      // Clear all sessionStorage (including reload counters)
      try { sessionStorage.clear(); } catch {}

      // Navigate to a cache-busting URL so HTTP cache is bypassed too.
      // Using location.replace so the broken page isn't kept in history.
      const url = new URL(window.location.href);
      url.searchParams.set('_cb', Date.now().toString());
      window.location.replace(url.toString());
    } catch {
      window.location.reload();
    }
  };

  render() {
    if (this.state.isReloading) {
      return (
        <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Updating application...</p>
            <p className="text-gray-500 text-sm mt-2">New version detected</p>
          </div>
        </div>
      );
    }
    if (this.state.reloadBlocked) {
      return (
        <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-bold mb-4 text-amber-500">Update Required</h1>
            <p className="text-gray-400 mb-6">
              A new version is available but automatic update failed. Please clear your cache and reload.
            </p>
            <div className="space-y-3">
              <button
                onClick={this.handleHardRefresh}
                className="w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 rounded font-medium"
              >
                Clear Cache & Reload
              </button>
              <button
                onClick={this.handleManualReload}
                className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                Try Normal Reload
              </button>
            </div>
            <p className="text-gray-500 text-xs mt-4">
              If this persists, try: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
            </p>
          </div>
        </div>
      );
    }
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}

/**
 * After a version-mismatch reload during login, this component detects
 * post_login_redirect in sessionStorage and navigates automatically once
 * the user's Firebase session has been restored (app_access is set).
 */
/**
 * Handles Electron native menu events (Help menu items).
 * Must live inside MemoryRouter to access useNavigate.
 */
function ElectronMenuHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!window.electronAPI) return;

    // Help > Quick Start / Help & FAQ
    window.electronAPI.onMenuNavigate((route: string) => {
      navigate(route);
    });

    // Help > About MeasurePRO
    window.electronAPI.onMenuAbout(() => {
      sessionStorage.setItem('electron-pending-tab', 'about');
      navigate('/app');
      setTimeout(() => window.dispatchEvent(new CustomEvent('electron-open-tab', { detail: { tab: 'about' } })), 150);
    });

    // Settings menu — store tab BEFORE navigating so Settings reads it on mount
    window.electronAPI.onMenuNavigateTab((tab: string) => {
      sessionStorage.setItem('electron-pending-tab', tab);
      navigate('/app');
      setTimeout(() => window.dispatchEvent(new CustomEvent('electron-open-tab', { detail: { tab } })), 150);
    });
  }, [navigate]);

  return null;
}

function PostLoginRedirectHandler() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    const redirect = sessionStorage.getItem('post_login_redirect');
    if (!redirect) return;

    const hasAccess = localStorage.getItem('app_access') === 'true';
    if (!user && !hasAccess) return;

    const safeRedirect = redirect.startsWith('/') ? redirect : '/';
    sessionStorage.removeItem('post_login_redirect');
    navigate(safeRedirect, { replace: true });
  }, [user, isLoading, navigate]);

  return null;
}

function App() {
  const { accepted: disclaimerAccepted, accept: acceptDisclaimer } = useDisclaimerAccepted();

  // IndexedDB blocked warning state
  const [showIndexedDBWarning, setShowIndexedDBWarning] = useState(false);
  const [showDroneImport, setShowDroneImport] = useState(false);
  const [droneImportDevice, setDroneImportDevice] = useState<any>(null);

  // Listen for drone import open event from Tools menu
  useEffect(() => {
    const handler = () => { setDroneImportDevice(null); setShowDroneImport(true); };
    window.addEventListener('open-drone-import', handler);
    return () => window.removeEventListener('open-drone-import', handler);
  }, []);
  
  // Crash recovery dialog state
  const [showCrashRecovery, setShowCrashRecovery] = useState(false);
  const [crashRecoveryChecked, setCrashRecoveryChecked] = useState(false);
  
  // Performance monitoring
  const { developerSettings } = useSettingsStore();
  const { warnings } = usePerformanceMonitor(developerSettings.showPerformanceMonitor);
  usePerformanceWarnings(warnings, developerSettings.showPerformanceMonitor);
  
  // Hardware auto-reconnect — runs once per session after auth is confirmed
  const hwReconnect = useHardwareAutoReconnect();

  // Hardware profile saver — saves profile after confirmed streaming
  useHardwareProfileSaver();

  // Auto-sync survey data to camera overlay
  useSyncSurveyToCamera();
  
  // Auto-detect available cameras on startup
  useCameraAutoDetect();

  // Poll /api/version every 2 minutes and reload if a new build has been deployed
  useVersionPoller();
  
  // Get point cloud store for storage quota initialization
  const { setStorageQuota } = usePointCloudStore();
  
  // Listen for IndexedDB blocked events
  useEffect(() => {
    const handleBlocked = () => {
      setShowIndexedDBWarning(true);
    };
    
    const handleShowHelp = () => {
      setShowIndexedDBWarning(true);
    };
    
    dbBlockedEvent.addEventListener('blocked', handleBlocked as EventListener);
    dbBlockedEvent.addEventListener('show-help', handleShowHelp as EventListener);
    
    return () => {
      dbBlockedEvent.removeEventListener('blocked', handleBlocked as EventListener);
      dbBlockedEvent.removeEventListener('show-help', handleShowHelp as EventListener);
    };
  }, []);
  
  // Initialize PRIMARY workers on startup (others are lazy-loaded when features are used)
  useEffect(() => {
    const initCoreWorkers = async () => {
      try {
        // CRITICAL: Check IndexedDB health BEFORE initializing any workers
        const isHealthy = await checkIndexedDBHealth();
        if (!isHealthy) {
          console.warn('⚠️ IndexedDB unavailable — running in online-only mode');
          return;
        }

        // 1. Initialize measurement logger worker (PRIMARY - batched writes)
        const logger = getMeasurementLogger();
        await logger.init();
        
        // 2. Initialize auto-flush triggers (visibility change, memory pressure)
        initializeAutoFlush();
        
        // 3. Initialize orchestrator worker (legacy multi-worker system)
        initializeWorkerArchitecture();
        
        // 4. Initialize flush-on-close handlers for data safety
        initFlushOnClose();
        
        // 5. Check for crash recovery (unsaved measurements from previous session)
        // Isolated try/catch: a slow getStats() on first load must not mark workers as failed
        try {
          const stats = await logger.getStats();
          if (stats.bufferSize > 0 && !crashRecoveryChecked) {
            setShowCrashRecovery(true);
          }
        } catch {
          // getStats timed out on first load — skip crash recovery check
        }
        setCrashRecoveryChecked(true);
      } catch (error) {
        console.error('❌ Failed to initialize core workers:', error);
        // Don't block app loading - just log error and continue
      }
    };
    
    initCoreWorkers();
  }, []);
  
  // Initialize storage quota based on REAL device storage (not artificial limits)
  useEffect(() => {
    const initializeStorageQuota = async () => {
      try {
        const effectiveQuota = await getEffectiveStorageQuota();
        setStorageQuota(effectiveQuota);
      } catch (error) {
        // Fallback to 50GB if initialization fails
        setStorageQuota(50 * 1024 * 1024 * 1024);
      }
    };
    
    initializeStorageQuota();
    
    // Refresh storage estimate when window gains focus (user may have freed space)
    const handleFocus = () => {
      refreshStorageEstimate(); // Clear cache to force fresh reading
      initializeStorageQuota();
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [setStorageQuota]);
  
  // One-time cleanup of old sound configuration
  useEffect(() => {
    const SOUND_CONFIG_VERSION_KEY = 'soundConfigVersion';
    const CURRENT_VERSION = '2.0';
    
    const storedVersion = localStorage.getItem(SOUND_CONFIG_VERSION_KEY);
    if (storedVersion !== CURRENT_VERSION) {
      localStorage.removeItem('soundConfig');
      localStorage.setItem(SOUND_CONFIG_VERSION_KEY, CURRENT_VERSION);
    }
  }, []);
  
  // Expose orphaned measurement utilities to browser console for debugging
  useEffect(() => {
    (window as any).orphanedMeasurements = {
      export: exportOrphanedMeasurements,
      delete: deleteOrphanedMeasurements,
      find: findOrphanedMeasurements
    };
    
    console.log('🔧 Debug utilities available: window.orphanedMeasurements.export(), .delete(), .find()');
  }, []);
  
  // Stage 1 migration state
  const [migrationProgress, setMigrationProgress] = useState<{ stage: string; percent: number; message: string } | null>(null);
  // Must be declared before the migration useEffect so [user] dep array is not in TDZ.
  const { user: authUser } = useAuth();
  
  // Stage 1: Data migration for GNSS records (only runs for authenticated users)
  useEffect(() => {
    async function checkMigration() {
      // Only run migration for authenticated users — prevents the dialog
      // from appearing on the public landing page before login.
      if (!authUser) return;
      const migrationComplete = localStorage.getItem('migration_stage1_v1');
      if (!migrationComplete) {
        try {
          // CRITICAL: Skip migration if IndexedDB is unavailable
          const isHealthy = await checkIndexedDBHealth();
          if (!isHealthy) {
            console.log('⏭️ Skipping GNSS migration - IndexedDB unavailable');
            localStorage.setItem('migration_stage1_v1', 'skipped_no_storage');
            setMigrationProgress(null);
            return;
          }

          const result = await runStage1Migration(setMigrationProgress);
          if (result.success) {
            localStorage.setItem('migration_stage1_v1', 'completed');
            /* toast removed */
          } else if (result.errors.length > 0) {
            localStorage.setItem('migration_stage1_v1', 'completed_with_errors');
            toast.error('Migration completed with errors', {
              description: `${result.errors.length} error(s) occurred during migration`
            });
            console.error('Migration errors:', result.errors);
          }
        } catch (error) {
          console.error('Failed to run Stage 1 migration:', error);
          // Mark as completed even on error to prevent infinite loops
          localStorage.setItem('migration_stage1_v1', 'failed');
          toast.error('Migration failed', {
            description: 'Please check console for details'
          });
        } finally {
          setMigrationProgress(null);
        }
      }
    }
    checkMigration();
  }, [authUser]);
  
  // Online status
  const { isOnline } = useOnlineStatus();
  const [showOnlineBanner, setShowOnlineBanner] = useState(false);
  const [previousOnlineStatus, setPreviousOnlineStatus] = useState(isOnline);
  
  // Grace period state + re-auth/password change state + current user
  const { daysOffline, isOfflineMode, requiresReauth, requiresPasswordChange, user } = useAuth();
  const [forcePasswordChangeDone, setForcePasswordChangeDone] = useState(false);

  // Reset forcePasswordChangeDone whenever requiresPasswordChange becomes true again
  // (e.g. admin re-issues a password reset during the same session)
  useEffect(() => {
    if (requiresPasswordChange) {
      setForcePasswordChangeDone(false);
    }
  }, [requiresPasswordChange]);
  
  // Terms acceptance state
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [latestTermsVersion, setLatestTermsVersion] = useState<TermsVersion | null>(null);

  // AI Trial — fetches trial status after login, initialises shared key in aiAssistant.ts
  const aiTrialStatus = useAITrial();
  const [showAIWelcome, setShowAIWelcome] = useState(false);

  // Show the welcome dialog once per user (tracked via localStorage)
  useEffect(() => {
    if (!user || !aiTrialStatus.loaded) return;
    const key = `ai_welcome_shown_${user.uid}`;
    if (!localStorage.getItem(key)) {
      const t = setTimeout(() => {
        setShowAIWelcome(true);
        localStorage.setItem(key, '1');
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [user, aiTrialStatus.loaded]);
  
  // Check terms acceptance when user logs in
  useEffect(() => {
    const checkTermsAcceptance = async () => {
      if (!user) {
        setShowTermsModal(false);
        return;
      }
      
      try {
        const idToken = await user.getIdToken();
        const response = await apiRequest('/api/terms/check-acceptance', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });
        
        if (!response.hasAccepted && response.latestVersion) {
          setLatestTermsVersion(response.latestVersion);
          setShowTermsModal(true);
        } else {
          setShowTermsModal(false);
        }
      } catch (error) {
        // Silent fail
      }
    };
    
    checkTermsAcceptance();
  }, [user]);
  
  const handleTermsAccepted = () => {
    setShowTermsModal(false);
    setLatestTermsVersion(null);
  };
  
  // Track online/offline transitions for banner and flush queued company actions
  useEffect(() => {
    // Show online banner only when transitioning from offline to online
    if (!previousOnlineStatus && isOnline) {
      setShowOnlineBanner(true);
      // Hide banner after a short delay
      const timer = setTimeout(() => {
        setShowOnlineBanner(false);
      }, 3500);

      // Flush any pending company offline actions (pass Firebase token for secure auth)
      import('./lib/companyOfflineStore').then(async ({ flushPendingActions }) => {
        try {
          const { getCurrentUser } = await import('./lib/firebase');
          const fbUser = getCurrentUser();
          const token = fbUser ? await fbUser.getIdToken() : undefined;
          await flushPendingActions(() => {
            /* toast removed */
          }, token, fbUser?.uid);
        } catch {
          // Best-effort
        }
      }).catch(() => {});

      return () => clearTimeout(timer);
    }
    setPreviousOnlineStatus(isOnline);
  }, [isOnline, previousOnlineStatus]);
  
  // Guard against double execution in React strict mode
  const crashRecoveryExecuted = React.useRef(false);

  // Initialize stores on first render
  React.useEffect(() => {
    try {
      // Initialize settings
      const loadSettings = async () => {
        try {
          const { getSettingsByCategory } = await import('./lib/settings');
          const categories = ['laser', 'gps', 'camera', 'map', 'logging', 'alerts'];
          
          for (const category of categories) {
            await getSettingsByCategory(category);
          }
        } catch (error) {
          // Silent fail
        }
      };
      
      loadSettings();
      
      // Load surveys
      const surveyStore = useSurveyStore.getState();
      surveyStore.loadSurveys();
      
      // Reset POI type
      const poiStore = usePOIStore.getState();
      poiStore.setSelectedType('');
    } catch (error) {
      // Silent fail
    }
    
    // Initialize storage
    const initStorage = async () => {
      try {
        const { initializeStorage } = await import('./lib/survey/db');
        await initializeStorage();
        
        // Clean up old emergency data after IndexedDB is confirmed working
        try {
          const { cleanupEmergencyData } = await import('./lib/utils/storageCleanup');
          await cleanupEmergencyData();
        } catch (cleanupError) {
          // Silent fail
        }
        
        // Monitor storage health and warn if running low
        try {
          const { checkStorageHealth } = await import('./lib/utils/storageManager');
          const health = await checkStorageHealth();
          if (!health.healthy) {
            /* toast removed */
          }
        } catch (healthError) {
          // Silent fail
        }
      } catch (error) {
        // Silent fail
      }
    };
    
    initStorage();
    
    // Check for orphaned timelapse frames - ONCE only (strict mode guard)
    // CRITICAL: Guard check MUST be synchronous (before async call) to prevent strict mode double-run
    if (!crashRecoveryExecuted.current) {
      crashRecoveryExecuted.current = true;
      
      const checkCrashRecovery = async () => {
        try {
          const { checkForOrphanedFrames } = await import('./lib/timelapse/crashRecovery');
          await checkForOrphanedFrames();
        } catch (error) {
          // Silent fail - crash recovery is best-effort
        }
      };
      
      checkCrashRecovery();
    }
    
    // Setup auto sync
    const setupSync = async () => {
      try {
        const { setupAutoSync } = await import('./lib/sync');
        setupAutoSync();
      } catch (error) {
        // Silent fail
      }
    };
    
    setupSync();
    
    // Setup RoadScope auto-sync event listener
    const handleMeasurementBatchComplete = async (event: Event) => {
      try {
        const customEvent = event as CustomEvent;
        const { surveyId } = customEvent.detail || {};
        
        if (!surveyId) return;
        
        // Get current user ID for RoadScope settings lookup
        const userId = localStorage.getItem('current_user_id');
        if (!userId) return;
        
        // Dynamically import to avoid circular dependencies
        const { checkAndTriggerAutoSync } = await import('./lib/roadscope/autoSync');
        await checkAndTriggerAutoSync(surveyId, userId);
      } catch (error) {
        // Silent fail - auto-sync is non-critical
      }
    };
    
    window.addEventListener('measurement-batch-complete', handleMeasurementBatchComplete);
    
    return () => {
      window.removeEventListener('measurement-batch-complete', handleMeasurementBatchComplete);
    };
  }, []);

  // Initialize and manage background sync service
  useEffect(() => {
    // Start background sync (runs every 24 hours)
    backgroundSyncService.start();
    
    // Add event listener to trigger sync when going back online
    // IMPORTANT: Do NOT await — this must be non-blocking to prevent UI freeze
    const handleOnline = () => {
      // Defer to next tick so the online banner renders first
      setTimeout(() => {
        backgroundSyncService.performSync().catch(() => {});
      }, 100);
    };
    
    window.addEventListener('online', handleOnline);
    
    // Cleanup on unmount
    return () => {
      backgroundSyncService.stop();
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // Calculate padding for banners
  const hasOfflineBanner = !isOnline;
  const hasGraceBanner = isOfflineMode && daysOffline >= 0 && daysOffline <= 10;
  const bannerPadding = hasOfflineBanner || hasGraceBanner ? '48px' : '0';

  return (
    <>
      {!disclaimerAccepted && <DisclaimerModal onAccept={acceptDisclaimer} />}
      <AutoUpdater />
      <HelmetProvider>
    <LicenseStartupCheckProvider>
      <ThemeProvider>
        <MemoryRouter initialEntries={['/']} initialIndex={0}>
          <Toaster richColors position="bottom-right" duration={1500} />

      {/* Resume post-login navigation after a version-mismatch page reload */}
      <PostLoginRedirectHandler />
      <ElectronMenuHandler />

      {/* PWA update prompt — shown when a new version is available in production */}
      <PwaUpdatePrompt />
      <UpdateNotification />
      <DroneImportToast onImportRequest={(device) => { setDroneImportDevice(device); setShowDroneImport(true); }} />
      {showDroneImport && (
        <DroneImportPanel
          initialDevice={droneImportDevice}
          onClose={() => { setShowDroneImport(false); setDroneImportDevice(null); }}
        />
      )}
      
      {/* Demo Mode Provider - auto-starts demo data when in demo mode */}
      <DemoModeProvider />
      
      {/* Demo Mode Overlay */}
      <DemoOverlay />
      
      {/* Force Password Change — blocks until user sets new password */}
      {requiresPasswordChange && !forcePasswordChangeDone && (
        <ForcePasswordChange onComplete={() => setForcePasswordChangeDone(true)} />
      )}
      
      {/* Re-authentication Modal — shown when 14-day re-auth window expires */}
      <ReauthModal />
      
      {/* Grace Period Lockout (blocks everything when active) */}
      <GracePeriodLockout />
      <TrialLockout />

      {/* Concurrent session eviction countdown — non-blocking 60s warning before forced logout */}
      <SessionEvictionBanner />
      
      {/* IndexedDB Blocked Warning */}
      {showIndexedDBWarning && (
        <IndexedDBBlockedWarning onRetry={() => setShowIndexedDBWarning(false)} />
      )}
      
      {/* Crash Recovery Dialog */}
      {showCrashRecovery && (
        <CrashRecoveryDialog onClose={() => setShowCrashRecovery(false)} />
      )}

      {/* Hardware Auto-Reconnect Modal */}
      <HardwareAutoReconnectModal state={hwReconnect} />
      
      {/* Offline/Online Status Banners */}
      <OfflineBanner isVisible={!isOnline} />
      <OnlineBanner isVisible={showOnlineBanner} />
      
      {/* Grace Period Banner */}
      <GracePeriodBanner />
      
      {/* Storage Health Banner - shows when storage is backlogged */}
      <StorageHealthBanner />
      
      {/* Terms Re-acceptance Modal */}
      {showTermsModal && latestTermsVersion && (
        <TermsReacceptanceModal
          latestVersion={latestTermsVersion}
          onAccepted={handleTermsAccepted}
        />
      )}

      {/* AI Welcome Dialog — shown once per user after first login */}
      {showAIWelcome && (
        <AIWelcomeDialog
          trialStatus={aiTrialStatus}
          onClose={() => setShowAIWelcome(false)}
        />
      )}
      
      {/* GNSS Migration Progress Dialog */}
      {migrationProgress && (
        <MigrationProgressDialog open={true} progress={migrationProgress} />
      )}
      
      <div className="min-h-screen bg-gray-900" style={{ paddingTop: bannerPadding }}>
        <LazyLoadErrorBoundary>
          <React.Suspense fallback={<LoadingComponent />}>
            <RouteErrorBoundary>
              {/* Lazy load optional components */}
              <React.Suspense fallback={null}>
                <NetworkStatusBanner />
              </React.Suspense>
              <React.Suspense fallback={null}>
                <DeviceRedirector />
              </React.Suspense>

              <AdminNavBar />
              
              <Routes>
              {/* Public landing page at root — visible to Google and unauthenticated visitors */}
              <Route path="/" element={
                <RouteErrorBoundary>
                  <React.Suspense fallback={<LoadingComponent />}>
                    <WelcomePage />
                  </React.Suspense>
                </RouteErrorBoundary>
              } />
              {/* /app is the protected field-tool dashboard (formerly /) */}
              <Route path="/app" element={
                <RouteErrorBoundary>
                  <ProtectedRoute>
                    <React.Suspense fallback={<LoadingComponent />}>
                      <Settings />
                    </React.Suspense>
                  </ProtectedRoute>
                </RouteErrorBoundary>
              } />
              <Route path="/help" element={
                <RouteErrorBoundary>
                  <React.Suspense fallback={<LoadingComponent />}>
                    <HelpPage />
                  </React.Suspense>
                </RouteErrorBoundary>
              } />
              <Route path="/blog" element={
                <RouteErrorBoundary>
                  <React.Suspense fallback={<LoadingComponent />}>
                    <BlogPage />
                  </React.Suspense>
                </RouteErrorBoundary>
              } />
              <Route path="/mobile-select" element={
                <RouteErrorBoundary>
                  <React.Suspense fallback={<LoadingComponent />}>
                    <MobileAppSelector />
                  </React.Suspense>
                </RouteErrorBoundary>
              } />
              <Route path="/slave-app" element={
                <RouteErrorBoundary>
                  <React.Suspense fallback={<LoadingComponent />}>
                    <SlaveAppPage />
                  </React.Suspense>
                </RouteErrorBoundary>
              } />
              <Route path="/LiveMonitor" element={
                <RouteErrorBoundary>
                  <React.Suspense fallback={<LoadingComponent />}>
                    <LiveMonitor />
                  </React.Suspense>
                </RouteErrorBoundary>
              } />
              {/* /welcome → / (backward-compat redirect so existing bookmarks/links still work) */}
              <Route path="/welcome" element={<Navigate to="/" replace />} />
              <Route path="/demo" element={
                <RouteErrorBoundary>
                  <React.Suspense fallback={<LoadingComponent />}>
                    <DemoShowcasePage />
                  </React.Suspense>
                </RouteErrorBoundary>
              } />
              <Route path="/features" element={
                <RouteErrorBoundary>
                  <React.Suspense fallback={<LoadingComponent />}>
                    <FeaturesPage />
                  </React.Suspense>
                </RouteErrorBoundary>
              } />
              <Route path="/pricing" element={
                <RouteErrorBoundary>
                  <React.Suspense fallback={<LoadingComponent />}>
                    <PricingPage />
                  </React.Suspense>
                </RouteErrorBoundary>
              } />
              <Route path="/checkout/success" element={
                <RouteErrorBoundary>
                  <React.Suspense fallback={<LoadingComponent />}>
                    <CheckoutSuccessPage />
                  </React.Suspense>
                </RouteErrorBoundary>
              } />
              <Route path="/privacy" element={
                <RouteErrorBoundary>
                  <React.Suspense fallback={<LoadingComponent />}>
                    <PrivacyPolicyPage />
                  </React.Suspense>
                </RouteErrorBoundary>
              } />
              <Route path="/policies" element={
                <RouteErrorBoundary>
                  <React.Suspense fallback={<LoadingComponent />}>
                    <PoliciesPage />
                  </React.Suspense>
                </RouteErrorBoundary>
              } />
              <Route path="/terms" element={
                <RouteErrorBoundary>
                  <React.Suspense fallback={<LoadingComponent />}>
                    <TermsPage />
                  </React.Suspense>
                </RouteErrorBoundary>
              } />
              <Route path="/contact" element={
                <RouteErrorBoundary>
                  <React.Suspense fallback={<LoadingComponent />}>
                    <ContactPage />
                  </React.Suspense>
                </RouteErrorBoundary>
              } />
              <Route path="/documentation" element={
                <RouteErrorBoundary>
                  <React.Suspense fallback={<LoadingComponent />}>
                    <DocumentationPage />
                  </React.Suspense>
                </RouteErrorBoundary>
              } />
              <Route path="/docs" element={
                <RouteErrorBoundary>
                  <React.Suspense fallback={<LoadingComponent />}>
                    <DocsIndexPage />
                  </React.Suspense>
                </RouteErrorBoundary>
              } />
              <Route path="/docs/laser-quickstart" element={
                <RouteErrorBoundary>
                  <React.Suspense fallback={<LoadingComponent />}>
                    <LaserQuickStartPage />
                  </React.Suspense>
                </RouteErrorBoundary>
              } />
              <Route path="/docs/gnss-quickstart" element={
                <RouteErrorBoundary>
                  <React.Suspense fallback={<LoadingComponent />}>
                    <GnssQuickStartPage />
                  </React.Suspense>
                </RouteErrorBoundary>
              } />
              <Route path="/docs/field-card" element={
                <RouteErrorBoundary>
                  <React.Suspense fallback={<LoadingComponent />}>
                    <FieldReferencePage />
                  </React.Suspense>
                </RouteErrorBoundary>
              } />
              <Route path="/docs/field-reference" element={
                <RouteErrorBoundary>
                  <React.Suspense fallback={<LoadingComponent />}>
                    <FieldReferencePage />
                  </React.Suspense>
                </RouteErrorBoundary>
              } />
              <Route path="/docs/environmental" element={
                <RouteErrorBoundary>
                  <React.Suspense fallback={<LoadingComponent />}>
                    <EnvironmentalGuidePage />
                  </React.Suspense>
                </RouteErrorBoundary>
              } />
              <Route path="/docs/autopart" element={
                <RouteErrorBoundary>
                  <React.Suspense fallback={<LoadingComponent />}>
                    <AutoPartGuidePage />
                  </React.Suspense>
                </RouteErrorBoundary>
              } />
              <Route path="/docs/pandar40p" element={
                <RouteErrorBoundary>
                  <React.Suspense fallback={<LoadingComponent />}>
                    <PandarGuide40PPage />
                  </React.Suspense>
                </RouteErrorBoundary>
              } />
              <Route path="/docs/voice-commands" element={
                <RouteErrorBoundary>
                  <React.Suspense fallback={<LoadingComponent />}>
                    <VoiceCommandsPage />
                  </React.Suspense>
                </RouteErrorBoundary>
              } />
              <Route path="/docs/camera-bridge" element={
                <RouteErrorBoundary>
                  <React.Suspense fallback={<LoadingComponent />}>
                    <CameraBridgePage />
                  </React.Suspense>
                </RouteErrorBoundary>
              } />
              <Route path="/testing" element={
                <RouteErrorBoundary>
                  <React.Suspense fallback={<LoadingComponent />}>
                    <TestingPage />
                  </React.Suspense>
                </RouteErrorBoundary>
              } />
              <Route path="/point-cloud-scanner" element={
                <RouteErrorBoundary>
                  <FeatureProtectedRoute featureKey="point_cloud_scanning">
                    <React.Suspense fallback={<LoadingComponent />}>
                      <PointCloudScannerPage />
                    </React.Suspense>
                  </FeatureProtectedRoute>
                </RouteErrorBoundary>
              } />
              <Route path="/gnss-profiling" element={
                <RouteErrorBoundary>
                  <FeatureProtectedRoute featureKey="gnss_profiling">
                    <React.Suspense fallback={<LoadingComponent />}>
                      <RoadProfilePage />
                    </React.Suspense>
                  </FeatureProtectedRoute>
                </RouteErrorBoundary>
              } />
              <Route path="/road-profile" element={
                <RouteErrorBoundary>
                  <FeatureProtectedRoute featureKey="gnss_profiling">
                    <React.Suspense fallback={<LoadingComponent />}>
                      <RoadProfilePage />
                    </React.Suspense>
                  </FeatureProtectedRoute>
                </RouteErrorBoundary>
              } />
              <Route path="/lidar" element={
                <RouteErrorBoundary>
                  <ProtectedRoute>
                    <React.Suspense fallback={<LoadingComponent />}>
                      <LidarPage />
                    </React.Suspense>
                  </ProtectedRoute>
                </RouteErrorBoundary>
              } />
              <Route path="/lidar/source" element={
                <RouteErrorBoundary>
                  <React.Suspense fallback={<LoadingComponent />}>
                    <LidarSourcePage />
                  </React.Suspense>
                </RouteErrorBoundary>
              } />
              <Route path="/convoy/leader" element={
                <RouteErrorBoundary>
                  <FeatureProtectedRoute featureKey="convoy_guardian">
                    <React.Suspense fallback={<LoadingComponent />}>
                      <ConvoyLeader />
                    </React.Suspense>
                  </FeatureProtectedRoute>
                </RouteErrorBoundary>
              } />
              <Route path="/convoy/join/:token?" element={
                <RouteErrorBoundary>
                  <FeatureProtectedRoute featureKey="convoy_guardian">
                    <React.Suspense fallback={<LoadingComponent />}>
                      <ConvoyFollower />
                    </React.Suspense>
                  </FeatureProtectedRoute>
                </RouteErrorBoundary>
              } />
              <Route path="/route-enforcement/dispatch" element={
                <RouteErrorBoundary>
                  <FeatureProtectedRoute featureKey="route_enforcement">
                    <React.Suspense fallback={<LoadingComponent />}>
                      <DispatchConsole />
                    </React.Suspense>
                  </FeatureProtectedRoute>
                </RouteErrorBoundary>
              } />
              <Route path="/route-enforcement/live/:convoyId" element={
                <RouteErrorBoundary>
                  <FeatureProtectedRoute featureKey="route_enforcement">
                    <React.Suspense fallback={<LoadingComponent />}>
                      <DispatchLiveView />
                    </React.Suspense>
                  </FeatureProtectedRoute>
                </RouteErrorBoundary>
              } />
              <Route path="/route-enforcement/driver" element={
                <RouteErrorBoundary>
                  <FeatureProtectedRoute featureKey="route_enforcement">
                    <React.Suspense fallback={<LoadingComponent />}>
                      <DriverInterface />
                    </React.Suspense>
                  </FeatureProtectedRoute>
                </RouteErrorBoundary>
              } />
              <Route path="/marketing" element={
                <RouteErrorBoundary>
                  <React.Suspense fallback={<LoadingComponent />}>
                    <MarketingPage />
                  </React.Suspense>
                </RouteErrorBoundary>
              } />
              
              <Route path="/manual" element={
                <RouteErrorBoundary>
                  <React.Suspense fallback={<LoadingComponent />}>
                    <UserManualPage />
                  </React.Suspense>
                </RouteErrorBoundary>
              } />
              <Route path="/scribe" element={
                <RouteErrorBoundary>
                  <React.Suspense fallback={<LoadingComponent />}>
                    <ScribeTutorialPage />
                  </React.Suspense>
                </RouteErrorBoundary>
              } />
              
              {/* Registration and Account Management Routes */}
              <Route path="/login" element={
                <RouteErrorBoundary>
                  <React.Suspense fallback={<LoadingComponent />}>
                    <LoginPage />
                  </React.Suspense>
                </RouteErrorBoundary>
              } />
              <Route path="/forgot-password" element={
                <RouteErrorBoundary>
                  <React.Suspense fallback={<LoadingComponent />}>
                    <ForgotPasswordPage />
                  </React.Suspense>
                </RouteErrorBoundary>
              } />
              {/*
                PRIMARY registration flow — email-verify → Firestore account → pending approval.
                All public-facing marketing links should point to /register.
              */}
              <Route path="/register" element={
                <RouteErrorBoundary>
                  <React.Suspense fallback={<LoadingComponent />}>
                    <RegisterPage />
                  </React.Suspense>
                </RouteErrorBoundary>
              } />
              {/*
                SALES-INVITE wizard — 6-step flow for accounts opened via a direct sales link.
                Creates the Firebase account only at Step 6 after all data and payment are collected.
                Do NOT link this route publicly; it is shared by sales reps per prospect.
              */}
              <Route path="/signup" element={
                <RouteErrorBoundary>
                  <React.Suspense fallback={<LoadingComponent />}>
                    <SignupPage />
                  </React.Suspense>
                </RouteErrorBoundary>
              } />
              <Route path="/verify" element={
                <RouteErrorBoundary>
                  <React.Suspense fallback={<LoadingComponent />}>
                    <VerifyPage />
                  </React.Suspense>
                </RouteErrorBoundary>
              } />
              <Route path="/verify-sms" element={
                <RouteErrorBoundary>
                  <React.Suspense fallback={<LoadingComponent />}>
                    <VerifySmsPage />
                  </React.Suspense>
                </RouteErrorBoundary>
              } />
              <Route path="/set-password" element={
                <RouteErrorBoundary>
                  <React.Suspense fallback={<LoadingComponent />}>
                    <SetPasswordPage />
                  </React.Suspense>
                </RouteErrorBoundary>
              } />
              <Route path="/awaiting-approval" element={
                <RouteErrorBoundary>
                  <React.Suspense fallback={<LoadingComponent />}>
                    <AwaitingApprovalPage />
                  </React.Suspense>
                </RouteErrorBoundary>
              } />
              <Route path="/admin" element={
                <RouteErrorBoundary>
                  <FeatureProtectedRoute featureKey="admin">
                    <React.Suspense fallback={<LoadingComponent />}>
                      <AdminPage />
                    </React.Suspense>
                  </FeatureProtectedRoute>
                </RouteErrorBoundary>
              } />
              <Route path="/company-admin" element={
                <RouteErrorBoundary>
                  <ProtectedRoute>
                    <CompanyAdminRoute>
                      <React.Suspense fallback={<LoadingComponent />}>
                        <CompanyAdminPage />
                      </React.Suspense>
                    </CompanyAdminRoute>
                  </ProtectedRoute>
                </RouteErrorBoundary>
              } />
              <Route path="/admin/accounts" element={
                <RouteErrorBoundary>
                  <FeatureProtectedRoute featureKey="admin">
                    <React.Suspense fallback={<LoadingComponent />}>
                      <AdminAccountsPage />
                    </React.Suspense>
                  </FeatureProtectedRoute>
                </RouteErrorBoundary>
              } />
              <Route path="/admin/companies" element={
                <RouteErrorBoundary>
                  <FeatureProtectedRoute featureKey="admin">
                    <React.Suspense fallback={<LoadingComponent />}>
                      <AdminCompaniesPage />
                    </React.Suspense>
                  </FeatureProtectedRoute>
                </RouteErrorBoundary>
              } />
              <Route path="/admin-licensing" element={
                <RouteErrorBoundary>
                  <FeatureProtectedRoute featureKey="admin">
                    <React.Suspense fallback={<LoadingComponent />}>
                      <AdminLicensingPanel />
                    </React.Suspense>
                  </FeatureProtectedRoute>
                </RouteErrorBoundary>
              } />
              <Route path="/admin/pricing" element={
                <RouteErrorBoundary>
                  <FeatureProtectedRoute featureKey="admin">
                    <React.Suspense fallback={<LoadingComponent />}>
                      <PricingManagementPage />
                    </React.Suspense>
                  </FeatureProtectedRoute>
                </RouteErrorBoundary>
              } />
              <Route path="/admin/terms" element={
                <RouteErrorBoundary>
                  <FeatureProtectedRoute featureKey="admin">
                    <React.Suspense fallback={<LoadingComponent />}>
                      <TermsManagementPage />
                    </React.Suspense>
                  </FeatureProtectedRoute>
                </RouteErrorBoundary>
              } />
              <Route path="/admin/analytics" element={
                <RouteErrorBoundary>
                  <FeatureProtectedRoute featureKey="admin">
                    <React.Suspense fallback={<LoadingComponent />}>
                      <AdminAnalyticsPage />
                    </React.Suspense>
                  </FeatureProtectedRoute>
                </RouteErrorBoundary>
              } />
              <Route path="/licenses" element={
                <RouteErrorBoundary>
                  <ProtectedRoute>
                    <React.Suspense fallback={<LoadingComponent />}>
                      <LicenseManagementPage />
                    </React.Suspense>
                  </ProtectedRoute>
                </RouteErrorBoundary>
              } />
              <Route path="/subscription" element={
                <RouteErrorBoundary>
                  <ProtectedRoute>
                    <React.Suspense fallback={<LoadingComponent />}>
                      <SubscriptionPage />
                    </React.Suspense>
                  </ProtectedRoute>
                </RouteErrorBoundary>
              } />
              
              <Route path="/admin/debug/indexeddb" element={
                <RouteErrorBoundary>
                  <FeatureProtectedRoute featureKey="admin">
                    <React.Suspense fallback={<LoadingComponent />}>
                      <DebugIndexedDB />
                    </React.Suspense>
                  </FeatureProtectedRoute>
                </RouteErrorBoundary>
              } />
              
              <Route path="/admin/debug/stress" element={
                <RouteErrorBoundary>
                  <FeatureProtectedRoute featureKey="admin">
                    <React.Suspense fallback={<LoadingComponent />}>
                      <DebugStress />
                    </React.Suspense>
                  </FeatureProtectedRoute>
                </RouteErrorBoundary>
              } />
              
              <Route path="/export" element={
                <RouteErrorBoundary>
                  <ProtectedRoute>
                    <React.Suspense fallback={<LoadingComponent />}>
                      <ExportSurvey />
                    </React.Suspense>
                  </ProtectedRoute>
                </RouteErrorBoundary>
              } />
              
              {/* Public Pages */}
              <Route path="/changelog" element={
                <RouteErrorBoundary>
                  <React.Suspense fallback={<LoadingComponent />}>
                    <ChangelogPage />
                  </React.Suspense>
                </RouteErrorBoundary>
              } />
            </Routes>
          </RouteErrorBoundary>
        </React.Suspense>
        </LazyLoadErrorBoundary>
        
        {/* Performance Monitor (developer mode) */}
        <PerformanceMonitor enabled={developerSettings.showPerformanceMonitor} />
      </div>
        </MemoryRouter>
      </ThemeProvider>
    </LicenseStartupCheckProvider>
    </HelmetProvider>
    </>
  );
}

export default App;