import { useState, useEffect, useCallback } from 'react';
import { X, Monitor, Chrome, Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PwaInstallPromptProps {
  onDismiss: () => void;
}

type Browser = 'chrome' | 'edge' | 'other';

function detectBrowser(): Browser {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'edge';
  if (/Chrome\//.test(ua) && !/Chromium\//.test(ua)) return 'chrome';
  return 'other';
}

function isAlreadyInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true;
}

function isDesktop(): boolean {
  return !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export default function PwaInstallPrompt({ onDismiss }: PwaInstallPromptProps) {
  // Skip entirely in Electron — this is a PWA-only component
  if (window.electronAPI?.isElectron) {
    onDismiss();
    return null;
  }

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const browser = detectBrowser();

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleNativeInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    setIsInstalling(true);
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setIsInstalling(false);
    if (outcome === 'accepted') {
      handleDismiss(true);
    }
  }, [deferredPrompt]);

  const handleDismiss = (permanent = false) => {
    if (permanent) {
      localStorage.setItem('pwa_install_dismissed', 'permanent');
    } else {
      localStorage.setItem('pwa_install_dismissed', 'later');
    }
    onDismiss();
  };

  const steps: Record<Browser, { icon: string; title: string; steps: string[] }> = {
    chrome: {
      icon: '🌐',
      title: 'Install in Chrome',
      steps: [
        'Look for the install icon (⊕) in the address bar at the top right',
        'Click "Install MeasurePRO" in the pop-up',
        'Click "Install" to confirm — the app opens in its own window',
      ],
    },
    edge: {
      icon: '🔷',
      title: 'Install in Microsoft Edge',
      steps: [
        'Click the "…" menu (top right) or look for the install icon (⊕) in the address bar',
        'Select "Apps" → "Install this site as an app"',
        'Click "Install" — MeasurePRO will open in a standalone window',
      ],
    },
    other: {
      icon: '💻',
      title: 'Install as Desktop App',
      steps: [
        'Open this page in Google Chrome or Microsoft Edge for the best experience',
        'Look for the install icon (⊕) in the address bar',
        'Follow the prompts to install MeasurePRO as a desktop app',
      ],
    },
  };

  const browserInfo = steps[browser];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg">
              <Monitor className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Install MeasurePRO</h2>
              <p className="text-sm text-gray-400">Get the full desktop app experience</p>
            </div>
          </div>
          <button
            onClick={() => handleDismiss(false)}
            className="text-gray-500 hover:text-gray-300 transition-colors p-1"
            data-testid="button-pwa-dismiss"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Benefits */}
        <div className="px-6 pb-4">
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { icon: '⚡', label: 'Faster launch', sub: 'Opens instantly' },
              { icon: '📴', label: 'Offline mode', sub: 'Works without internet' },
              { icon: '🖥️', label: 'Own window', sub: 'No browser bars' },
            ].map((b) => (
              <div key={b.label} className="bg-gray-800 rounded-lg p-3 text-center">
                <div className="text-2xl mb-1">{b.icon}</div>
                <div className="text-xs font-semibold text-white">{b.label}</div>
                <div className="text-xs text-gray-400">{b.sub}</div>
              </div>
            ))}
          </div>

          {/* Install Steps */}
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{browserInfo.icon}</span>
              <h3 className="text-sm font-semibold text-white">{browserInfo.title}</h3>
            </div>
            <ol className="space-y-2">
              {browserInfo.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>

            {/* One-click install button for Chrome/Edge */}
            {deferredPrompt && (
              <Button
                onClick={handleNativeInstall}
                disabled={isInstalling}
                className="w-full mt-4 h-10 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                data-testid="button-pwa-install-now"
              >
                <Download className="mr-2 h-4 w-4" />
                {isInstalling ? 'Installing…' : 'Install Now — One Click'}
              </Button>
            )}
          </div>

          {browser === 'other' && (
            <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
              <Chrome className="h-3 w-3" />
              <span>Best supported in Chrome and Edge on Windows 10/11</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 pb-5">
          <button
            onClick={() => handleDismiss(true)}
            className="text-sm text-gray-500 hover:text-gray-300 underline"
            data-testid="button-pwa-dont-show"
          >
            Don't show this again
          </button>
          <Button
            variant="outline"
            onClick={() => handleDismiss(false)}
            className="text-sm border-gray-600 text-gray-300 hover:text-white"
            data-testid="button-pwa-later"
          >
            Remind me next time
          </Button>
        </div>
      </div>
    </div>
  );
}

// Helper: should we show the prompt?
export function shouldShowPwaPrompt(): boolean {
  if (isAlreadyInstalled()) return false;
  if (!isDesktop()) return false;
  const dismissed = localStorage.getItem('pwa_install_dismissed');
  if (dismissed === 'permanent') return false;
  return true;
}
