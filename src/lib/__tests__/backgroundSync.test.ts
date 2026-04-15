import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.stubGlobal('navigator', { onLine: true });
vi.stubGlobal('window', {
  setInterval: vi.fn(() => 99),
  clearInterval: vi.fn(),
});

// Mock all Firebase/auth/sync dependencies
vi.mock('../firebase', () => ({
  getCurrentUser: vi.fn(() => null),
}));

vi.mock('firebase/firestore', () => ({
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
  doc: vi.fn(),
  getFirestore: vi.fn(),
}));

vi.mock('../auth/offlineAuth', () => ({
  updateLastOnline: vi.fn().mockResolvedValue(undefined),
  getAuthCache: vi.fn().mockResolvedValue(null),
  updateAuthCacheTokens: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../sync', () => ({
  syncManager: {
    checkPendingChanges: vi.fn().mockResolvedValue(0),
    startSync: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../auditLog', () => ({
  flushAuditQueue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../licensing', () => ({
  getUserEnabledFeatures: vi.fn().mockResolvedValue([]),
}));

import { BackgroundSyncService } from '../backgroundSync';
import { getCurrentUser } from '../firebase';

describe('BackgroundSyncService', () => {
  let service: BackgroundSyncService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BackgroundSyncService();
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  afterEach(() => {
    service.stop();
  });

  describe('start', () => {
    it('sets up an interval', () => {
      service.start();
      expect(window.setInterval).toHaveBeenCalled();
    });

    it('does not start twice', () => {
      service.start();
      service.start();
      expect(window.setInterval).toHaveBeenCalledTimes(1);
    });
  });

  describe('stop', () => {
    it('clears the interval', () => {
      service.start();
      service.stop();
      expect(window.clearInterval).toHaveBeenCalledWith(99);
    });

    it('allows restart after stop', () => {
      service.start();
      service.stop();
      vi.clearAllMocks();

      service.start();
      expect(window.setInterval).toHaveBeenCalledTimes(1);
    });
  });

  describe('performSync', () => {
    it('returns false when offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      const result = await service.performSync();
      expect(result).toBe(false);
    });

    it('returns false when no user logged in', async () => {
      vi.mocked(getCurrentUser).mockReturnValue(null);
      const result = await service.performSync();
      expect(result).toBe(false);
    });

    it('returns true when sync succeeds with a user', async () => {
      vi.mocked(getCurrentUser).mockReturnValue({ uid: 'user-1', email: 'test@test.com' } as any);
      const { getAuthCache } = await import('../auth/offlineAuth');
      vi.mocked(getAuthCache).mockResolvedValue({
        email: 'test@test.com',
        accessToken: 'tok',
        refreshToken: 'ref',
        tokenExpiry: Date.now() + 3600000,
        userProfile: {},
        licenseData: null,
      } as any);

      const result = await service.performSync();
      expect(result).toBe(true);
    });

    it('returns false when sync throws', async () => {
      vi.mocked(getCurrentUser).mockReturnValue({ uid: 'user-1' } as any);
      const { updateLastOnline } = await import('../auth/offlineAuth');
      vi.mocked(updateLastOnline).mockRejectedValueOnce(new Error('fail'));

      const result = await service.performSync();
      expect(result).toBe(false);
    });
  });
});
