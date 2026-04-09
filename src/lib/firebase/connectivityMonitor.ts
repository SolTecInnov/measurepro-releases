/**
 * Firebase Connectivity Monitor
 * 
 * Detects online/offline status and Firebase connectivity.
 * Triggers sync queue processing when connection is restored.
 */

import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getApps } from 'firebase/app';

export interface ConnectivityState {
  isOnline: boolean;
  isFirebaseConnected: boolean;
  isAuthenticated: boolean;
  lastOnlineAt: number | null;
  lastOfflineAt: number | null;
}

type ConnectivityListener = (state: ConnectivityState) => void;

class ConnectivityMonitor {
  private state: ConnectivityState = {
    isOnline: navigator.onLine,
    isFirebaseConnected: false,
    isAuthenticated: false,
    lastOnlineAt: navigator.onLine ? Date.now() : null,
    lastOfflineAt: navigator.onLine ? null : Date.now()
  };
  
  private listeners: Set<ConnectivityListener> = new Set();
  private authUnsubscribe: (() => void) | null = null;
  private pingInterval: number | null = null;
  private initialized = false;

  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);

    this.setupAuthListener();
    
    if (navigator.onLine) {
      this.checkFirebaseConnectivity();
    }

    // Initialized silently
  }

  private handleOnline = (): void => {
    console.log('[ConnectivityMonitor] Browser went online');
    this.state.isOnline = true;
    this.state.lastOnlineAt = Date.now();
    this.notifyListeners();
    
    this.checkFirebaseConnectivity();
    
    window.dispatchEvent(new CustomEvent('connectivity-restored'));
  };

  private handleOffline = (): void => {
    console.log('[ConnectivityMonitor] Browser went offline');
    this.state.isOnline = false;
    this.state.isFirebaseConnected = false;
    this.state.lastOfflineAt = Date.now();
    this.notifyListeners();
    
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  };

  private authRetryCount = 0;

  private setupAuthListener(): void {
    const apps = getApps();
    if (apps.length === 0) {
      this.authRetryCount++;
      if (this.authRetryCount <= 5) {
        setTimeout(() => this.setupAuthListener(), 3000);
      }
      return;
    }

    try {
      const auth = getAuth(apps[0]);
      this.authUnsubscribe = onAuthStateChanged(auth, (user) => {
        const wasAuthenticated = this.state.isAuthenticated;
        this.state.isAuthenticated = !!user;
        
        if (!wasAuthenticated && user) {
          console.log('[ConnectivityMonitor] User authenticated');
          this.checkFirebaseConnectivity();
        }
        
        this.notifyListeners();
      });
    } catch (error) {
      console.error('[ConnectivityMonitor] Failed to setup auth listener:', error);
    }
  }

  private async checkFirebaseConnectivity(): Promise<void> {
    if (!navigator.onLine) {
      this.state.isFirebaseConnected = false;
      return;
    }

    try {
      await fetch('https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js', {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-store'
      });
      
      this.state.isFirebaseConnected = true;
      // Firebase connectivity confirmed silently
      
      if (this.state.isAuthenticated) {
        window.dispatchEvent(new CustomEvent('firebase-ready-for-sync'));
      }
    } catch (error) {
      console.warn('[ConnectivityMonitor] Firebase connectivity check failed:', error);
      this.state.isFirebaseConnected = false;
    }
    
    this.notifyListeners();
  }

  getState(): ConnectivityState {
    return { ...this.state };
  }

  isReadyForSync(): boolean {
    return this.state.isOnline && this.state.isFirebaseConnected && this.state.isAuthenticated;
  }

  subscribe(listener: ConnectivityListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        console.error('[ConnectivityMonitor] Listener error:', error);
      }
    });
  }

  async forceCheck(): Promise<ConnectivityState> {
    this.state.isOnline = navigator.onLine;
    
    if (this.state.isOnline) {
      await this.checkFirebaseConnectivity();
    }
    
    return this.getState();
  }

  destroy(): void {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    
    if (this.authUnsubscribe) {
      this.authUnsubscribe();
    }
    
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    
    this.listeners.clear();
    this.initialized = false;
  }
}

export const connectivityMonitor = new ConnectivityMonitor();

export function initConnectivityMonitor(): void {
  connectivityMonitor.initialize();
}

export function isReadyForFirebaseSync(): boolean {
  return connectivityMonitor.isReadyForSync();
}

export function getConnectivityState(): ConnectivityState {
  return connectivityMonitor.getState();
}
