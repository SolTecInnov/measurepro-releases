import { describe, it, expect, beforeEach, vi } from 'vitest';

// Stub localStorage before imports
vi.stubGlobal('localStorage', {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
});

import { wakeLockManager, useWakeLock } from '../wakeLock';

describe('wakeLockManager (stub)', () => {
  it('acquire resolves without error', async () => {
    await expect(wakeLockManager.acquire()).resolves.toBeUndefined();
  });

  it('release resolves without error', async () => {
    await expect(wakeLockManager.release()).resolves.toBeUndefined();
  });

  it('isActive returns false', () => {
    expect(wakeLockManager.isActive).toBe(false);
  });
});

describe('useWakeLock hook', () => {
  it('returns expected shape', () => {
    const result = useWakeLock();
    expect(result).toHaveProperty('isActive');
    expect(result).toHaveProperty('acquire');
    expect(result).toHaveProperty('release');
    expect(result.isActive).toBe(false);
  });

  it('acquire and release resolve', async () => {
    const { acquire, release } = useWakeLock();
    await expect(acquire()).resolves.toBeUndefined();
    await expect(release()).resolves.toBeUndefined();
  });
});
