// Stub — original deleted during orphan cleanup
class WakeLockManager {
  async acquire() {}
  async release() {}
  get isActive() { return false; }
}
export const wakeLockManager = new WakeLockManager();
export function useWakeLock() { return { isActive: false, acquire: async () => {}, release: async () => {} }; }
