export { type ProfilePoint, type GradeEvent } from './types';
export { exportProfileToCSV } from './exportHelper';

/**
 * Stub — profile recording buffer for GNSS recording store.
 * Returns a no-op buffer when the full road profile system isn't active.
 */
export function getProfileRecordingBuffer() {
  return {
    subscribe: (_cb: () => void) => () => {},
    getSamples: () => [],
    getEvents: () => [],
    clear: () => {},
  };
}
