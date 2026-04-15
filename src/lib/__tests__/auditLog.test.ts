import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSessionStorage = new Map<string, string>();

vi.hoisted(() => {
  (globalThis as any).localStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  (globalThis as any).sessionStorage = {
    getItem: (key: string) => mockSessionStorage.get(key) ?? null,
    setItem: (key: string, value: string) => mockSessionStorage.set(key, value),
    removeItem: (key: string) => mockSessionStorage.delete(key),
    clear: () => mockSessionStorage.clear(),
  };

  // Use vi.stubGlobal for navigator since it's read-only
  vi.stubGlobal('navigator', {
    onLine: true,
    language: 'en-US',
    userAgent: 'test',
  });

  vi.stubGlobal('screen', { width: 1920, height: 1080 });

  // window is needed by getDeviceInfo and module-level addEventListener
  if (typeof globalThis.window === 'undefined') {
    (globalThis as any).window = globalThis;
  }
  if (!(globalThis as any).window.addEventListener) {
    (globalThis as any).window.addEventListener = vi.fn();
  }
  if (!(globalThis as any).window.screen) {
    (globalThis as any).window.screen = { width: 1920, height: 1080 };
  }
  if (typeof globalThis.document === 'undefined') {
    (globalThis as any).document = {
      addEventListener: vi.fn(),
      referrer: '',
      createElement: vi.fn(() => ({})),
      body: { appendChild: vi.fn() },
    };
  }

  if (!globalThis.crypto || !globalThis.crypto.randomUUID) {
    (globalThis as any).crypto = {
      randomUUID: () => '00000000-0000-0000-0000-000000000000',
    };
  }
});

vi.mock('idb', () => ({
  openDB: vi.fn(() => {
    const items: any[] = [];
    return Promise.resolve({
      add: vi.fn((_store: string, item: any) => { items.push(item); }),
      getAll: vi.fn(() => items),
      delete: vi.fn(),
    });
  }),
}));

vi.mock('@/lib/config/environment', () => ({
  API_BASE_URL: 'http://localhost:3001',
  isElectron: false,
  isOffline: () => false,
}));

const mockFetch = vi.fn(() => Promise.resolve({ ok: true }));
vi.stubGlobal('fetch', mockFetch);

import {
  hasSessionLoginLogged,
  markSessionLoginLogged,
  logLogin,
  logLogout,
  logActivity,
  auditLog,
} from '../auditLog';

describe('auditLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionStorage.clear();
    mockFetch.mockResolvedValue({ ok: true } as Response);
    // Reset navigator.onLine
    vi.stubGlobal('navigator', {
      onLine: true,
      language: 'en-US',
      userAgent: 'test',
    });
  });

  describe('hasSessionLoginLogged / markSessionLoginLogged', () => {
    it('returns false initially', () => {
      expect(hasSessionLoginLogged()).toBe(false);
    });

    it('returns true after marking', () => {
      markSessionLoginLogged();
      expect(hasSessionLoginLogged()).toBe(true);
    });
  });

  describe('logLogin', () => {
    it('sends login data via fetch', async () => {
      logLogin({
        userId: 'u1',
        userEmail: 'test@example.com',
        loginMethod: 'email',
        success: true,
      });

      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/audit/login');
      expect(options.method).toBe('POST');

      const body = JSON.parse(options.body);
      expect(body.userId).toBe('u1');
      expect(body.userEmail).toBe('test@example.com');
      expect(body.sessionId).toBeDefined();
    });

    it('marks session login as logged', () => {
      logLogin({ userId: 'u1', userEmail: 'test@example.com' });
      expect(hasSessionLoginLogged()).toBe(true);
    });
  });

  describe('logLogout', () => {
    it('sends logout data', async () => {
      markSessionLoginLogged();
      logLogout('u1');

      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/audit/logout');
    });
  });

  describe('logActivity', () => {
    it('sends activity data', async () => {
      logActivity({
        userId: 'u1',
        userEmail: 'test@example.com',
        actionType: 'survey_create',
        actionDetails: 'Created a survey',
      });

      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/audit/activity');
      const body = JSON.parse(options.body);
      expect(body.actionType).toBe('survey_create');
    });
  });

  describe('auditLog helpers', () => {
    it('surveyCreate sends correct action type', async () => {
      auditLog.surveyCreate('u1', 'test@example.com', 's1', 'My Survey');

      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.actionType).toBe('survey_create');
      expect(body.resourceType).toBe('survey');
    });

    it('surveyClose includes poiCount', async () => {
      auditLog.surveyClose('u1', 'test@example.com', 's1', 'My Survey', 42);

      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.metadata.poiCount).toBe(42);
    });

    it('surveyExport includes format', async () => {
      auditLog.surveyExport('u1', 'test@example.com', 's1', 'My Survey', 'csv', 1024);

      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.metadata.format).toBe('csv');
    });

    it('hardwareConnect includes connection details', async () => {
      auditLog.hardwareConnect('u1', 'test@example.com', 'laser', 'Disto X4', true, 'bluetooth');

      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.metadata.deviceType).toBe('laser');
      expect(body.metadata.connected).toBe(true);
      expect(body.metadata.connectionMethod).toBe('bluetooth');
    });

    it('featureAccess sends feature name', async () => {
      auditLog.featureAccess('u1', 'test@example.com', 'LiDAR');

      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.actionType).toBe('feature_access');
      expect(body.resourceName).toBe('LiDAR');
    });
  });

  describe('offline behavior', () => {
    it('queues when navigator is offline', async () => {
      vi.stubGlobal('navigator', {
        onLine: false,
        language: 'en-US',
        userAgent: 'test',
      });

      logActivity({
        userId: 'u1',
        userEmail: 'test@example.com',
        actionType: 'test_action',
      });

      await new Promise(r => setTimeout(r, 50));
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
