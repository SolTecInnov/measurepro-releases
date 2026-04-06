/**
 * Wake Lock Manager for Convoy Guardian
 * Prevents device screen from sleeping during active convoy operations
 */

class WakeLockManager {
  private wakeLock: WakeLockSentinel | null = null;
  private isSupported: boolean = false;
  private listeners: Set<(active: boolean) => void> = new Set();

  constructor() {
    // Check if Wake Lock API is supported
    this.isSupported = 'wakeLock' in navigator;
    
    if (this.isSupported) {
      // Re-acquire wake lock when page becomes visible again
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  /**
   * Request wake lock to prevent screen sleep
   */
  async request(): Promise<boolean> {
    if (!this.isSupported) {
      return false;
    }

    // Already have active lock
    if (this.wakeLock !== null) {
      return true;
    }

    try {
      this.wakeLock = await navigator.wakeLock.request('screen');

      // Listen for automatic release (battery saver, etc.)
      this.wakeLock.addEventListener('release', () => {
        this.wakeLock = null;
        this.notifyListeners(false);
      });

      this.notifyListeners(true);
      return true;
    } catch (err: any) {
      return false;
    }
  }

  /**
   * Release wake lock manually
   */
  async release(): Promise<void> {
    if (this.wakeLock !== null) {
      try {
        await this.wakeLock.release();
        this.wakeLock = null;
        this.notifyListeners(false);
      } catch (err) {
      }
    }
  }

  /**
   * Check if wake lock is currently active
   */
  isActive(): boolean {
    return this.wakeLock !== null;
  }

  /**
   * Check if Wake Lock API is supported
   */
  isWakeLockSupported(): boolean {
    return this.isSupported;
  }

  /**
   * Subscribe to wake lock state changes
   */
  subscribe(callback: (active: boolean) => void): () => void {
    this.listeners.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(active: boolean): void {
    this.listeners.forEach(callback => callback(active));
  }

  /**
   * Handle visibility changes - re-acquire lock when page becomes visible
   */
  private handleVisibilityChange = async () => {
    if (!document.hidden) {
      // If we had a lock before, try to re-acquire it
      // (Wake locks are automatically released when page becomes hidden)
      if (this.isSupported && this.listeners.size > 0) {
        await this.request();
      }
    }
  };

  /**
   * Cleanup - remove event listeners
   */
  cleanup(): void {
    if (this.wakeLock !== null) {
      this.wakeLock.release();
      this.wakeLock = null;
    }
    
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.listeners.clear();
  }
}

// Singleton instance
export const wakeLockManager = new WakeLockManager();

/**
 * React hook for wake lock management
 */
export function useWakeLock() {
  const [isActive, setIsActive] = React.useState(false);
  const [isSupported, setIsSupported] = React.useState(false);

  React.useEffect(() => {
    setIsSupported(wakeLockManager.isWakeLockSupported());
    setIsActive(wakeLockManager.isActive());

    // Subscribe to state changes
    const unsubscribe = wakeLockManager.subscribe((active) => {
      setIsActive(active);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const request = React.useCallback(async () => {
    return await wakeLockManager.request();
  }, []);

  const release = React.useCallback(async () => {
    await wakeLockManager.release();
  }, []);

  return {
    isActive,
    isSupported,
    request,
    release,
  };
}

// Re-export React for the hook
import React from 'react';
