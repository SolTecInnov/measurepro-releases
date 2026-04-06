export const isElectron =
  typeof window !== 'undefined' &&
  window.navigator.userAgent.includes('Electron');

export const isOffline = () => !navigator.onLine;

export const API_BASE_URL = isElectron
  ? 'https://measure-pro.app'
  : import.meta.env.VITE_API_URL || '';
