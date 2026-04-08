export const isElectron =
  typeof window !== 'undefined' &&
  window.navigator.userAgent.includes('Electron');

export const isOffline = () => !navigator.onLine;

export const API_BASE_URL = isElectron
  ? 'https://measure-pro.app'
  : import.meta.env.VITE_API_URL || '';

/** Build a WebSocket URL that works under both https:// and file:// (Electron). */
export function getWsUrl(path = ''): string {
  if (isElectron) {
    return `wss://measure-pro.app${path}`;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}${path}`;
}
