import { useEffect, useRef } from 'react';

declare const __BUILD_TIME__: number;

const CLIENT_BUILD_TIME: number =
  typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 0;

const POLL_INTERVAL_MS = 2 * 60 * 1000;
const VERSION_RELOAD_KEY = 'version_reload_attempted';

export function useVersionPoller() {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // PERF: Version polling is for PWA hot-reload detection only.
    // In Electron, auto-updater handles version management — skip.
    if ((window as any).electronAPI?.isElectron) return;

    if (CLIENT_BUILD_TIME === 0) {
      return;
    }

    if (import.meta.env.DEV) {
      return;
    }

    const check = async () => {
      try {
        const resp = await fetch('/api/version', {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (!resp.ok) return;
        const data = (await resp.json()) as { version: string };
        const serverBuildTime = parseInt(data.version, 10);
        if (!isNaN(serverBuildTime) && serverBuildTime !== 0 && serverBuildTime !== CLIENT_BUILD_TIME) {
          if (sessionStorage.getItem(VERSION_RELOAD_KEY)) {
            console.warn(
              `[VERSION] Build mismatch persists after reload (server=${serverBuildTime}, client=${CLIENT_BUILD_TIME}) — skipping to avoid loop`
            );
            return;
          }
          console.log(
            `[VERSION] Server build ${serverBuildTime} !== client build ${CLIENT_BUILD_TIME} — reloading`
          );
          sessionStorage.setItem(VERSION_RELOAD_KEY, '1');
          window.location.reload();
        } else {
          sessionStorage.removeItem(VERSION_RELOAD_KEY);
        }
      } catch {
      }
    };

    timerRef.current = setInterval(check, POLL_INTERVAL_MS);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);
}
