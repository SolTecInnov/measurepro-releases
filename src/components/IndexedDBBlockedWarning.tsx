import { AlertTriangle, ExternalLink, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface IndexedDBBlockedWarningProps {
  onRetry?: () => void;
}

export function IndexedDBBlockedWarning({ onRetry }: IndexedDBBlockedWarningProps) {
  const ua = navigator.userAgent.toLowerCase();
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const isFirefox = ua.includes('firefox');
  // Edge includes "Edg/" in UA, detect it BEFORE Chrome (Edge is Chromium-based)
  const isEdge = ua.includes('edg/') || ua.includes('edge/');
  const isChrome = ua.includes('chrome') && !isEdge;
  const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                (window.navigator as any).standalone === true;
  
  // Aggressive cache/storage clear for PWA recovery
  const handleClearAllData = async () => {
    try {
      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      
      // Unregister all service workers
      if ('serviceWorker' in navigator) {
        const registrations = ('serviceWorker' in navigator) ? await navigator.serviceWorker.getRegistrations() : [];
        await Promise.all(registrations.map(r => r.unregister()));
      }
      
      // Clear localStorage and sessionStorage
      localStorage.clear();
      sessionStorage.clear();
      
      // Force reload without cache
      window.location.href = window.location.origin + '?cleared=' + Date.now();
    } catch (e) {
      console.error('Failed to clear data:', e);
      window.location.reload();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-2xl w-full p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Database Storage Blocked
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              MeasurePRO requires IndexedDB to store survey data offline. Your browser's privacy settings are currently blocking database storage.
            </p>
          </div>
        </div>

        {/* Safari-specific instructions */}
        {isSafari && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
              Safari Users - Fix Instructions:
            </h3>
            <ol className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
              <li className="flex gap-2">
                <span className="font-bold">1.</span>
                <span>Open <b>Settings</b> {'→'} <b>Safari</b></span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold">2.</span>
                <span>Scroll down to <b>"Privacy & Security"</b></span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold">3.</span>
                <span>Turn OFF <b>"Prevent Cross-Site Tracking"</b> OR</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold">4.</span>
                <span>Add <b>measure-pro.app</b> to exceptions</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold">5.</span>
                <span>Refresh this page</span>
              </li>
            </ol>
            <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                <strong>Alternative:</strong> Use Safari in <b>Private Browsing Mode</b> OR switch to Chrome/Firefox for full functionality.
              </p>
            </div>
          </div>
        )}

        {/* Firefox-specific instructions */}
        {isFirefox && (
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
            <h3 className="font-semibold text-orange-900 dark:text-orange-100 mb-2">
              Firefox Users - Fix Instructions:
            </h3>
            <ol className="space-y-2 text-sm text-orange-800 dark:text-orange-200">
              <li className="flex gap-2">
                <span className="font-bold">1.</span>
                <span>Click the <b>lock icon</b> in the address bar</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold">2.</span>
                <span>Click <b>"Clear Cookies and Site Data"</b></span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold">3.</span>
                <span>Reload the page</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold">4.</span>
                <span>If still blocked: Settings {'→'} Privacy & Security {'→'} Turn OFF "Enhanced Tracking Protection" for this site</span>
              </li>
            </ol>
          </div>
        )}

        {/* Chrome-specific instructions */}
        {isChrome && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2">
              Chrome Users - Fix Instructions:
            </h3>
            <ol className="space-y-2 text-sm text-green-800 dark:text-green-200">
              <li className="flex gap-2">
                <span className="font-bold">1.</span>
                <span>Click the <b>lock icon</b> in the address bar</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold">2.</span>
                <span>Click <b>"Site settings"</b></span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold">3.</span>
                <span>Ensure <b>"Cookies"</b> and <b>"JavaScript"</b> are allowed</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold">4.</span>
                <span>Clear site data and reload</span>
              </li>
            </ol>
          </div>
        )}

        {/* Edge-specific instructions */}
        {isEdge && (
          <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-lg p-4">
            <h3 className="font-semibold text-cyan-900 dark:text-cyan-100 mb-2">
              Microsoft Edge Users - Fix Instructions:
            </h3>
            <ol className="space-y-2 text-sm text-cyan-800 dark:text-cyan-200">
              <li className="flex gap-2">
                <span className="font-bold">1.</span>
                <span>Click the <b>lock icon</b> (or ⓘ) in the address bar</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold">2.</span>
                <span>Click <b>"Cookies and site permissions"</b></span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold">3.</span>
                <span>Under <b>"Cookies and data stored"</b>, click <b>"Manage and delete"</b></span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold">4.</span>
                <span>Click <b>"Remove all"</b> to clear site data</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold">5.</span>
                <span>Reload the page</span>
              </li>
            </ol>
            {isPWA && (
              <div className="mt-3 pt-3 border-t border-cyan-200 dark:border-cyan-800">
                <p className="text-xs text-cyan-700 dark:text-cyan-300 mb-2">
                  <strong>PWA Users:</strong> If the above doesn't work, try uninstalling and reinstalling the app:
                </p>
                <ol className="text-xs text-cyan-700 dark:text-cyan-300 space-y-1 ml-4">
                  <li>1. Close this PWA window</li>
                  <li>2. Open Edge browser → Settings → Apps → Installed apps</li>
                  <li>3. Find MeasurePRO and click Uninstall</li>
                  <li>4. Visit measure-pro.app and reinstall as PWA</li>
                </ol>
              </div>
            )}
          </div>
        )}

        {/* General instructions */}
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Why is this required?
          </h3>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            MeasurePRO is designed for offline field work. IndexedDB allows the app to store thousands of survey measurements locally on your device, even without internet connection. Your data stays private and secure on your device.
          </p>
        </div>

        <div className="flex gap-3 justify-end flex-wrap">
          <Button
            variant="outline"
            onClick={() => window.open('https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API', '_blank')}
            className="gap-2"
            data-testid="button-learn-more"
          >
            Learn More <ExternalLink className="h-4 w-4" />
          </Button>
          {isPWA && (
            <Button
              variant="outline"
              onClick={handleClearAllData}
              className="gap-2 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
              data-testid="button-clear-all-data"
            >
              <Trash2 className="h-4 w-4" />
              Clear All Data & Reload
            </Button>
          )}
          <Button
            onClick={() => {
              onRetry?.();
              window.location.reload();
            }}
            className="gap-2 bg-blue-600 hover:bg-blue-700"
            data-testid="button-retry"
          >
            <RefreshCw className="h-4 w-4" />
            Retry After Fixing Settings
          </Button>
        </div>

        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Need help? Contact support with error: <code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded">IndexedDB_BLOCKED</code>
          </p>
        </div>
      </div>
    </div>
  );
}
