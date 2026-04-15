import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import { queryClient } from './lib/queryClient';
import { AuthProvider } from './lib/auth/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';
import { activateSerialPolyfill } from './lib/electron-serial-polyfill';
import { toast } from 'sonner';

// Activate Electron serial bridge before any component mounts
activateSerialPolyfill();
import { checkLibraryHealth, showLibraryErrorModal } from './lib/libraryHealthCheck';
import { initFirebaseAutoSync } from './lib/firebase/autoSync';
import { installFirebaseSyncDiagnostic } from './lib/diagnostics/firebaseSyncDiagnostic';
import { initRoadScopeAutoSync } from './lib/roadscope/autoSync';
import { initDriveModeBridge } from './lib/stores/driveModeStore';
import { initAutoPartManager } from './lib/survey/AutoPartManager';

// BUILD VERSION — injected at build time by vite.config.ts, unique per deployment
declare const __BUILD_TIMESTAMP__: string;
const BUILD_VERSION: string = (typeof __BUILD_TIMESTAMP__ !== 'undefined')
  ? __BUILD_TIMESTAMP__
  : 'dev';
console.log(`%c MeasurePRO Desktop Build: ${BUILD_VERSION}`, 'color: #00ff00; font-size: 16px; font-weight: bold');

// ── Auto-flush stale caches on version upgrade ──────────────────────────────
// Old versions stored Firestore Timestamps as raw objects in React Query cache
// and IndexedDB, causing "Minified React error #31" on render. Clear everything
// on first run of a new version so the app starts clean.
const CACHE_VERSION_KEY = '_measurepro_cache_version';
const CURRENT_CACHE_VERSION = '16.1.57';
if (localStorage.getItem(CACHE_VERSION_KEY) !== CURRENT_CACHE_VERSION) {
  console.log('[CacheFlush] New version detected — FULL flush of all stale data');
  // Nuke ALL IndexedDB databases to remove corrupted Firestore objects
  try { indexedDB.deleteDatabase('keyval-store'); } catch {}
  try { indexedDB.deleteDatabase('firebaseLocalStorageDb'); } catch {}
  try { indexedDB.deleteDatabase('firebase-heartbeat-database'); } catch {}
  try { indexedDB.deleteDatabase('firebase-installations-database'); } catch {}
  // Keep measurements-db (user survey data) but clear everything else
  // Clear ALL localStorage except the cache version key itself
  const keysToKeep = [CACHE_VERSION_KEY];
  const allKeys = Object.keys(localStorage);
  allKeys.forEach(k => { if (!keysToKeep.includes(k)) try { localStorage.removeItem(k); } catch {} });
  // Clear sessionStorage
  try { sessionStorage.clear(); } catch {}
  // Mark as flushed
  localStorage.setItem(CACHE_VERSION_KEY, CURRENT_CACHE_VERSION);
  console.log('[CacheFlush] Done — all stale data cleared');
}

// Always start in manual logging mode
localStorage.setItem('loggingMode', 'manual');
if (typeof window !== 'undefined') {
  (window as any).MEASUREPRO_VERSION = BUILD_VERSION;
}

// StreamDeck compatibility: forward native keyboard events as DOM keydown events
// StreamDeck uses Windows SendInput which bypasses Chromium's DOM event dispatch in Electron
const api = (window as any).electronAPI;
if (api?.onNativeKeydown) {
  api.onNativeKeydown((data: { key: string; code: string; alt: boolean; ctrl: boolean; shift: boolean; meta: boolean }) => {
    const event = new KeyboardEvent('keydown', {
      key: data.key,
      code: data.code,
      altKey: data.alt,
      ctrlKey: data.ctrl,
      shiftKey: data.shift,
      metaKey: data.meta,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);
  });
}

// CRITICAL: Clean up localStorage on app startup to prevent quota issues
const cleanupLocalStorage = () => {
  try {
    const preservePatterns = [
      'firebase:',
      'app_zoom_level',
      'theme',
      'mapType',
      'mapLayer',
      'voiceCommandsEnabled',
      'selectedLanguage',
      'lastSyncTime',
      'syncEmailState',
      'gps_permission_granted',
      'activeGnssSessionId',
      'activeGnssSurveyId',
      'onboarding_completed',
      'terms_accepted',
      'welcome_completed',
      'registration_',
      '_access'
    ];

    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const shouldPreserve = preservePatterns.some(pattern => key.includes(pattern));

        if (!shouldPreserve) {
          if (key.startsWith('emergency_') ||
              key.startsWith('temp_route_') ||
              key.startsWith('backup_') ||
              key.startsWith('gnss_emergency_') ||
              key.startsWith('checkpoint_')) {
            keysToRemove.push(key);
          }
        }
      }
    }

    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (_e) {
        // Ignore individual removal errors
      }
    });

  } catch (error) {
    console.error('localStorage cleanup failed:', error);
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('emergency_') || key.startsWith('checkpoint_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (_e) {
      // Last resort failed
    }
  }
};

cleanupLocalStorage();

// Global handler for unhandled promise rejections (catches Firebase offline errors)
window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason;
  const isOffline = !navigator.onLine;
  const errorMessage = error?.message || String(error);

  const isIndexedDBError =
    error?.name === 'UnknownError' ||
    errorMessage.includes('backing store') ||
    errorMessage.includes('IndexedDB') ||
    errorMessage.includes('indexedDB');

  if (isIndexedDBError) {
    console.warn('IndexedDB error (prevented crash):', errorMessage);
    event.preventDefault();
    return;
  }

  const isNetworkError =
    error?.code === 'auth/network-request-failed' ||
    errorMessage.includes('network') ||
    errorMessage.includes('Network') ||
    errorMessage.includes('Failed to fetch') ||
    errorMessage.includes('fetch') ||
    errorMessage.includes('NETWORK_ERROR');

  if (isOffline || isNetworkError) {
    console.warn('Network error caught (prevented crash):', errorMessage);
    event.preventDefault();
    return;
  }

  console.error('Unhandled promise rejection:', error);
});

// Global error handler for synchronous errors
window.addEventListener('error', (event) => {
  const isOffline = !navigator.onLine;
  const errorMessage = event.message || '';

  const isNetworkError =
    errorMessage.includes('network') ||
    errorMessage.includes('Network') ||
    errorMessage.includes('Failed to fetch') ||
    errorMessage.includes('fetch failed');

  if (isOffline || isNetworkError) {
    console.warn('Network error caught (prevented crash):', errorMessage);
    event.preventDefault();
    return;
  }
});

// Apply saved zoom level on page load
const savedZoom = localStorage.getItem('app_zoom_level');
if (savedZoom) {
  document.body.style.zoom = savedZoom + '%';
}

// CRITICAL: Check library health BEFORE rendering React
const libraryHealth = checkLibraryHealth();

if (!libraryHealth.healthy) {
  console.error('Library health check failed — cannot start app', libraryHealth);
  showLibraryErrorModal(libraryHealth);
} else {
  try {
    initFirebaseAutoSync();
  } catch (error) {
    console.error('Firebase auto-sync initialization failed:', error);
  }

  try {
    installFirebaseSyncDiagnostic();
  } catch (error) {
    console.error('Firebase sync diagnostic install failed:', error);
  }

  // RoadScope auto-sync timer (time-based, hourly by default).
  // Fires only if the user has enabled it in Settings → Sync.
  initRoadScopeAutoSync().catch((error) => {
    console.error('RoadScope auto-sync init failed:', error);
  });

  // Drive Mode bridge — sync state from main process on boot + subscribe to changes
  try {
    initDriveModeBridge();
  } catch (error) {
    console.error('Drive Mode bridge init failed:', error);
  }

  try {
    initAutoPartManager();
  } catch (error) {
    console.error('Auto-Part Manager initialization failed:', error);
  }

  const root = document.getElementById('root');

  if (root) {
    try {
      createRoot(root).render(
        <StrictMode>
          <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
              <AuthProvider>
                <App />
              </AuthProvider>
            </QueryClientProvider>
          </ErrorBoundary>
        </StrictMode>
      );
    } catch (error) {
      console.error('Error rendering React app:', error);
      root.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #0f172a; color: #f1f5f9; font-family: system-ui;">
          <div style="text-align: center; padding: 2rem;">
            <h1 style="font-size: 1.5rem; margin-bottom: 1rem;">Application Failed to Load</h1>
            <p style="margin-bottom: 1.5rem; color: #94a3b8;">Please reload the page or contact support if the problem persists.</p>
            <button onclick="window.location.reload()" style="background: #3b82f6; color: white; padding: 0.75rem 1.5rem; border: none; border-radius: 0.5rem; cursor: pointer; font-size: 1rem;">
              Reload Page
            </button>
          </div>
        </div>
      `;
    }
  } else {
    console.error('Root element not found — cannot mount app');
  }
}
