import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  (globalThis as any).localStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  (globalThis as any).sessionStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
});

// In-memory store for testing
const stores: Record<string, Map<string, any>> = {};

function getStore(name: string) {
  if (!stores[name]) stores[name] = new Map();
  return stores[name];
}

vi.mock('idb', () => ({
  openDB: vi.fn(() => {
    const db = {
      put: vi.fn((storeName: string, value: any) => {
        getStore(storeName).set(value.id, value);
      }),
      get: vi.fn((storeName: string, key: string) => {
        return getStore(storeName).get(key) || undefined;
      }),
      getAll: vi.fn((storeName: string) => {
        return Array.from(getStore(storeName).values());
      }),
      delete: vi.fn((storeName: string, key: string) => {
        getStore(storeName).delete(key);
      }),
      transaction: vi.fn((storeName: string, _mode: string) => ({
        store: {
          put: vi.fn((value: any) => {
            getStore(storeName).set(value.id, value);
          }),
        },
        done: Promise.resolve(),
      })),
      objectStoreNames: { contains: vi.fn(() => true) },
    };
    return Promise.resolve(db);
  }),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({
    currentUser: { uid: 'test-uid-123' },
  })),
}));

import {
  cacheCompany,
  getCachedCompany,
  cacheCompanyMembers,
  getCachedMembers,
  getUserCompanyMembership,
  enqueuePendingAction,
  getPendingActions,
  getPendingActionsForUser,
  removePendingAction,
  clearPendingActionsForUser,
  updatePendingAction,
  storeSessionCredential,
  getSessionCredential,
  clearSessionCredential,
  actionNeedsCredentialAtReplay,
  type PendingCompanyAction,
} from '../companyOfflineStore';

describe('companyOfflineStore', () => {
  beforeEach(() => {
    // Clear all stores
    for (const key of Object.keys(stores)) {
      stores[key].clear();
    }
    vi.clearAllMocks();
  });

  describe('cacheCompany / getCachedCompany', () => {
    it('caches and retrieves a company', async () => {
      const company = { id: 'c1', name: 'Test Corp' } as any;
      await cacheCompany(company);
      const result = await getCachedCompany('c1');
      expect(result).toMatchObject({ id: 'c1', name: 'Test Corp' });
    });

    it('returns null for missing company', async () => {
      const result = await getCachedCompany('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('cacheCompanyMembers / getCachedMembers', () => {
    it('caches and retrieves members by company', async () => {
      const members = [
        { id: 'm1', companyId: 'c1', name: 'Alice' },
        { id: 'm2', companyId: 'c1', name: 'Bob' },
        { id: 'm3', companyId: 'c2', name: 'Charlie' },
      ] as any[];
      await cacheCompanyMembers(members);
      const result = await getCachedMembers('c1');
      expect(result).toHaveLength(2);
    });
  });

  describe('getUserCompanyMembership', () => {
    it('finds membership by firebaseUid', async () => {
      const members = [
        { id: 'm1', companyId: 'c1', firebaseUid: 'uid-a' },
        { id: 'm2', companyId: 'c1', firebaseUid: 'uid-b' },
      ] as any[];
      await cacheCompanyMembers(members);
      const result = await getUserCompanyMembership('uid-b');
      expect(result).toMatchObject({ id: 'm2', firebaseUid: 'uid-b' });
    });

    it('returns null for unknown uid', async () => {
      const result = await getUserCompanyMembership('unknown');
      expect(result).toBeNull();
    });
  });

  describe('enqueuePendingAction / getPendingActions', () => {
    it('enqueues an action with auto-generated id and timestamp', async () => {
      const id = await enqueuePendingAction({
        type: 'create_company',
        companyId: 'c1',
        payload: { name: 'New Corp' },
      });
      expect(id).toBeDefined();

      const actions = await getPendingActions();
      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe('create_company');
      expect(actions[0].status).toBe('pending');
      expect(actions[0].userUid).toBe('test-uid-123');
    });

    it('supports custom initial status', async () => {
      await enqueuePendingAction(
        { type: 'reset_password', companyId: 'c1', payload: {} },
        'needs_input'
      );
      const actions = await getPendingActions();
      expect(actions[0].status).toBe('needs_input');
    });
  });

  describe('getPendingActionsForUser', () => {
    it('filters by user uid', async () => {
      // Enqueue with current user
      await enqueuePendingAction({ type: 'create_company', companyId: 'c1', payload: {} });

      // Manually add one with different uid
      getStore('pendingCompanyActions').set('other', {
        id: 'other',
        type: 'delete_company',
        companyId: 'c2',
        payload: {},
        timestamp: new Date().toISOString(),
        status: 'pending',
        userUid: 'different-uid',
      });

      const myActions = await getPendingActionsForUser('test-uid-123');
      expect(myActions).toHaveLength(1);
      expect(myActions[0].type).toBe('create_company');
    });

    it('returns empty array when no uid provided', async () => {
      await enqueuePendingAction({ type: 'create_company', companyId: 'c1', payload: {} });
      const result = await getPendingActionsForUser(null);
      expect(result).toEqual([]);
    });
  });

  describe('clearPendingActionsForUser', () => {
    it('removes only actions for the specified user', async () => {
      await enqueuePendingAction({ type: 'create_company', companyId: 'c1', payload: {} });

      getStore('pendingCompanyActions').set('other', {
        id: 'other',
        type: 'delete_company',
        companyId: 'c2',
        payload: {},
        timestamp: new Date().toISOString(),
        status: 'pending',
        userUid: 'other-uid',
      });

      await clearPendingActionsForUser('test-uid-123');

      const remaining = await getPendingActions();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].userUid).toBe('other-uid');
    });
  });

  describe('updatePendingAction', () => {
    it('updates an existing action', async () => {
      const id = await enqueuePendingAction({ type: 'create_company', companyId: 'c1', payload: {} });
      await updatePendingAction(id, { status: 'failed' });
      const actions = await getPendingActions();
      expect(actions.find(a => a.id === id)?.status).toBe('failed');
    });
  });

  describe('removePendingAction', () => {
    it('removes an action by id', async () => {
      const id = await enqueuePendingAction({ type: 'create_company', companyId: 'c1', payload: {} });
      await removePendingAction(id);
      const actions = await getPendingActions();
      expect(actions).toHaveLength(0);
    });
  });

  describe('session credential helpers', () => {
    it('storeSessionCredential writes to sessionStorage', () => {
      storeSessionCredential('action-1', 'secret123');
      expect(sessionStorage.setItem).toHaveBeenCalledWith('offline_cred_action-1', 'secret123');
    });

    it('getSessionCredential reads from sessionStorage', () => {
      (sessionStorage.getItem as any).mockReturnValue('secret123');
      const result = getSessionCredential('action-1');
      expect(result).toBe('secret123');
    });

    it('clearSessionCredential removes from sessionStorage', () => {
      clearSessionCredential('action-1');
      expect(sessionStorage.removeItem).toHaveBeenCalledWith('offline_cred_action-1');
    });
  });

  describe('actionNeedsCredentialAtReplay', () => {
    it('returns true for needs_input status', () => {
      const action = { status: 'needs_input' } as PendingCompanyAction;
      expect(actionNeedsCredentialAtReplay(action)).toBe(true);
    });

    it('returns false for pending status', () => {
      const action = { status: 'pending' } as PendingCompanyAction;
      expect(actionNeedsCredentialAtReplay(action)).toBe(false);
    });

    it('returns false for failed status', () => {
      const action = { status: 'failed' } as PendingCompanyAction;
      expect(actionNeedsCredentialAtReplay(action)).toBe(false);
    });
  });
});
