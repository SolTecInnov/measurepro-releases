/**
 * Calibration Sync Service
 * Offline-first sync with optional Firebase replication
 * 
 * Principles:
 * - IndexedDB is the local source of truth
 * - App works fully offline
 * - Firebase sync is background/non-blocking
 * - Conflicts resolved by updatedAt timestamp
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  query, 
  where, 
  Firestore,
  Timestamp
} from 'firebase/firestore';
import { calibrationStorage } from './storage';
import type { AltitudeCalibration } from './altitude';
import type { OrientationCalibration } from './orientation';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'offline';

export interface SyncState {
  status: SyncStatus;
  lastSync: string | null;
  pendingCount: number;
  conflictCount: number;
  errorMessage: string | null;
}

export interface ConflictItem {
  type: 'altitude' | 'orientation';
  local: AltitudeCalibration | OrientationCalibration;
  remote: AltitudeCalibration | OrientationCalibration;
}

type SyncSubscriber = (state: SyncState) => void;

class CalibrationSyncService {
  private firebaseApp: FirebaseApp | null = null;
  private db: Firestore | null = null;
  private userId: string | null = null;
  private syncState: SyncState = {
    status: 'idle',
    lastSync: null,
    pendingCount: 0,
    conflictCount: 0,
    errorMessage: null
  };
  private subscribers: Set<SyncSubscriber> = new Set();
  private syncQueue: Array<{ type: 'altitude' | 'orientation'; id: string }> = [];
  private isSyncing = false;
  private autoSyncInterval: NodeJS.Timeout | null = null;

  async initialize(userId: string): Promise<void> {
    this.userId = userId;

    try {
      const firebaseConfig = {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID
      };

      if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
        console.warn('[CalibrationSync] Firebase not configured, sync disabled');
        return;
      }

      const apps = getApps();
      this.firebaseApp = apps.length > 0 ? apps[0] : initializeApp(firebaseConfig);
      this.db = getFirestore(this.firebaseApp);
      
      await this.countPending();
      this.startAutoSync();
      
      console.log('[CalibrationSync] Initialized for user:', userId);
    } catch (e) {
      console.warn('[CalibrationSync] Firebase init failed, continuing offline:', e);
      this.updateState({ status: 'offline', errorMessage: 'Firebase not available' });
    }
  }

  private updateState(partial: Partial<SyncState>): void {
    this.syncState = { ...this.syncState, ...partial };
    this.notifySubscribers();
  }

  private notifySubscribers(): void {
    this.subscribers.forEach(cb => cb(this.syncState));
  }

  subscribe(callback: SyncSubscriber): () => void {
    this.subscribers.add(callback);
    callback(this.syncState);
    return () => this.subscribers.delete(callback);
  }

  getState(): SyncState {
    return { ...this.syncState };
  }

  isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  private startAutoSync(): void {
    if (this.autoSyncInterval) return;
    
    this.autoSyncInterval = setInterval(() => {
      if (this.isOnline() && !this.isSyncing && this.syncState.pendingCount > 0) {
        this.syncNow().catch(console.warn);
      }
    }, 30000);

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.updateState({ status: 'idle' });
        this.syncNow().catch(console.warn);
      });
      
      window.addEventListener('offline', () => {
        this.updateState({ status: 'offline', errorMessage: null });
      });
    }
  }

  stopAutoSync(): void {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
    }
  }

  async countPending(): Promise<number> {
    const altCals = await calibrationStorage.getAllAltitudeCalibrations();
    const orientCals = await calibrationStorage.getAllOrientationCalibrations();
    
    const pending = [
      ...altCals.filter(c => c.syncStatus === 'pending' || !c.syncStatus),
      ...orientCals.filter(c => c.syncStatus === 'pending' || !c.syncStatus)
    ].length;
    
    const conflicts = [
      ...altCals.filter(c => c.syncStatus === 'conflict'),
      ...orientCals.filter(c => c.syncStatus === 'conflict')
    ].length;
    
    this.updateState({ pendingCount: pending, conflictCount: conflicts });
    return pending;
  }

  async queueForSync(type: 'altitude' | 'orientation', id: string): Promise<void> {
    this.syncQueue.push({ type, id });
    await this.countPending();
    
    if (this.isOnline() && !this.isSyncing) {
      setTimeout(() => this.syncNow().catch(console.warn), 1000);
    }
  }

  async syncNow(): Promise<{ success: boolean; synced: number; conflicts: ConflictItem[] }> {
    if (!this.db || !this.userId) {
      this.updateState({ status: 'offline', errorMessage: 'Not initialized or offline' });
      return { success: false, synced: 0, conflicts: [] };
    }

    if (!this.isOnline()) {
      this.updateState({ status: 'offline', errorMessage: 'No internet connection' });
      return { success: false, synced: 0, conflicts: [] };
    }

    if (this.isSyncing) {
      return { success: false, synced: 0, conflicts: [] };
    }

    this.isSyncing = true;
    this.updateState({ status: 'syncing', errorMessage: null });

    const conflicts: ConflictItem[] = [];
    let synced = 0;

    try {
      synced += await this.syncAltitudeCalibrations(conflicts);
      synced += await this.syncOrientationCalibrations(conflicts);
      
      await this.countPending();
      
      this.updateState({ 
        status: conflicts.length > 0 ? 'error' : 'success',
        lastSync: new Date().toISOString(),
        conflictCount: conflicts.length,
        errorMessage: conflicts.length > 0 ? `${conflicts.length} conflict(s) detected` : null
      });

      return { success: true, synced, conflicts };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Sync failed';
      console.warn('[CalibrationSync] Sync error:', e);
      this.updateState({ status: 'error', errorMessage: message });
      return { success: false, synced, conflicts };
    } finally {
      this.isSyncing = false;
    }
  }

  private async syncAltitudeCalibrations(conflicts: ConflictItem[]): Promise<number> {
    if (!this.db || !this.userId) return 0;

    const localCals = await calibrationStorage.getAllAltitudeCalibrations();
    const pendingCals = localCals.filter(c => c.syncStatus === 'pending' || !c.syncStatus);
    
    let synced = 0;

    for (const local of pendingCals) {
      try {
        const docRef = doc(this.db, 'users', this.userId, 'altitudeCalibrations', local.id);
        
        const remoteSnap = await getDocs(
          query(
            collection(this.db, 'users', this.userId, 'altitudeCalibrations'),
            where('deviceId', '==', local.deviceId)
          )
        );

        let hasConflict = false;
        
        if (!remoteSnap.empty) {
          const remoteDoc = remoteSnap.docs[0];
          const remote = remoteDoc.data() as AltitudeCalibration;
          
          if (remote.updatedAt && local.updatedAt) {
            const remoteTime = new Date(remote.updatedAt).getTime();
            const localTime = new Date(local.updatedAt).getTime();
            
            if (remoteTime > localTime) {
              conflicts.push({ type: 'altitude', local, remote });
              local.syncStatus = 'conflict';
              await calibrationStorage.saveAltitudeCalibration(local);
              hasConflict = true;
            }
          }
        }

        if (!hasConflict) {
          await setDoc(docRef, {
            ...local,
            syncStatus: 'synced',
            syncedAt: Timestamp.now()
          });
          
          local.syncStatus = 'synced';
          local.firebaseId = docRef.id;
          await calibrationStorage.saveAltitudeCalibration(local);
          synced++;
        }
      } catch (e) {
        console.warn('[CalibrationSync] Failed to sync altitude calibration:', local.id, e);
      }
    }

    return synced;
  }

  private async syncOrientationCalibrations(conflicts: ConflictItem[]): Promise<number> {
    if (!this.db || !this.userId) return 0;

    const localCals = await calibrationStorage.getAllOrientationCalibrations();
    const pendingCals = localCals.filter(c => c.syncStatus === 'pending' || !c.syncStatus);
    
    let synced = 0;

    for (const local of pendingCals) {
      try {
        const docRef = doc(this.db, 'users', this.userId, 'orientationCalibrations', local.id);
        
        const remoteSnap = await getDocs(
          query(
            collection(this.db, 'users', this.userId, 'orientationCalibrations'),
            where('deviceId', '==', local.deviceId)
          )
        );

        let hasConflict = false;
        
        if (!remoteSnap.empty) {
          const remoteDoc = remoteSnap.docs[0];
          const remote = remoteDoc.data() as OrientationCalibration;
          
          if (remote.updatedAt && local.updatedAt) {
            const remoteTime = new Date(remote.updatedAt).getTime();
            const localTime = new Date(local.updatedAt).getTime();
            
            if (remoteTime > localTime) {
              conflicts.push({ type: 'orientation', local, remote });
              local.syncStatus = 'conflict';
              await calibrationStorage.saveOrientationCalibration(local);
              hasConflict = true;
            }
          }
        }

        if (!hasConflict) {
          await setDoc(docRef, {
            ...local,
            syncStatus: 'synced',
            syncedAt: Timestamp.now()
          });
          
          local.syncStatus = 'synced';
          local.firebaseId = docRef.id;
          await calibrationStorage.saveOrientationCalibration(local);
          synced++;
        }
      } catch (e) {
        console.warn('[CalibrationSync] Failed to sync orientation calibration:', local.id, e);
      }
    }

    return synced;
  }

  async resolveConflict(
    type: 'altitude' | 'orientation',
    id: string,
    resolution: 'keep_local' | 'keep_remote'
  ): Promise<void> {
    if (!this.db || !this.userId) return;

    if (type === 'altitude') {
      const local = await calibrationStorage.loadAltitudeCalibration(id);
      if (!local) return;

      if (resolution === 'keep_local') {
        local.updatedAt = new Date().toISOString();
        local.syncStatus = 'pending';
        await calibrationStorage.saveAltitudeCalibration(local);
        await this.syncNow();
      } else {
        const remoteSnap = await getDocs(
          query(
            collection(this.db, 'users', this.userId, 'altitudeCalibrations'),
            where('deviceId', '==', local.deviceId)
          )
        );
        
        if (!remoteSnap.empty) {
          const remote = remoteSnap.docs[0].data() as AltitudeCalibration;
          remote.syncStatus = 'synced';
          await calibrationStorage.saveAltitudeCalibration(remote);
        }
      }
    } else {
      const local = await calibrationStorage.loadOrientationCalibration(id);
      if (!local) return;

      if (resolution === 'keep_local') {
        local.updatedAt = new Date().toISOString();
        local.syncStatus = 'pending';
        await calibrationStorage.saveOrientationCalibration(local);
        await this.syncNow();
      } else {
        const remoteSnap = await getDocs(
          query(
            collection(this.db, 'users', this.userId, 'orientationCalibrations'),
            where('deviceId', '==', local.deviceId)
          )
        );
        
        if (!remoteSnap.empty) {
          const remote = remoteSnap.docs[0].data() as OrientationCalibration;
          remote.syncStatus = 'synced';
          await calibrationStorage.saveOrientationCalibration(remote);
        }
      }
    }

    await this.countPending();
  }

  async pullFromFirebase(): Promise<{ altitude: number; orientation: number }> {
    if (!this.db || !this.userId || !this.isOnline()) {
      return { altitude: 0, orientation: 0 };
    }

    let altCount = 0;
    let orientCount = 0;

    try {
      const altSnap = await getDocs(
        collection(this.db, 'users', this.userId, 'altitudeCalibrations')
      );
      
      for (const doc of altSnap.docs) {
        const remote = doc.data() as AltitudeCalibration;
        const local = await calibrationStorage.loadAltitudeCalibration(remote.deviceId, remote.projectId);
        
        if (!local || new Date(remote.updatedAt) > new Date(local.updatedAt || '')) {
          remote.syncStatus = 'synced';
          await calibrationStorage.saveAltitudeCalibration(remote);
          altCount++;
        }
      }

      const orientSnap = await getDocs(
        collection(this.db, 'users', this.userId, 'orientationCalibrations')
      );
      
      for (const doc of orientSnap.docs) {
        const remote = doc.data() as OrientationCalibration;
        const local = await calibrationStorage.loadOrientationCalibration(remote.deviceId, remote.projectId);
        
        if (!local || new Date(remote.updatedAt) > new Date(local.updatedAt || '')) {
          remote.syncStatus = 'synced';
          await calibrationStorage.saveOrientationCalibration(remote);
          orientCount++;
        }
      }
    } catch (e) {
      console.warn('[CalibrationSync] Pull failed:', e);
    }

    return { altitude: altCount, orientation: orientCount };
  }

  exportAllCalibrations(): string {
    return new Promise<string>(async (resolve) => {
      const altCals = await calibrationStorage.getAllAltitudeCalibrations();
      const orientCals = await calibrationStorage.getAllOrientationCalibrations();
      
      const exportData = {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        altitudeCalibrations: altCals,
        orientationCalibrations: orientCals
      };
      
      resolve(JSON.stringify(exportData, null, 2));
    }) as unknown as string;
  }

  async exportAllCalibrationsAsync(): Promise<string> {
    const altCals = await calibrationStorage.getAllAltitudeCalibrations();
    const orientCals = await calibrationStorage.getAllOrientationCalibrations();
    
    const exportData = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      altitudeCalibrations: altCals,
      orientationCalibrations: orientCals
    };
    
    return JSON.stringify(exportData, null, 2);
  }

  async importCalibrations(jsonString: string): Promise<{ altitude: number; orientation: number; errors: string[] }> {
    const errors: string[] = [];
    let altCount = 0;
    let orientCount = 0;

    try {
      const data = JSON.parse(jsonString);
      
      if (data.altitudeCalibrations && Array.isArray(data.altitudeCalibrations)) {
        for (const cal of data.altitudeCalibrations) {
          try {
            if (cal.id && cal.deviceId && cal.sourceStrategy) {
              cal.syncStatus = 'pending';
              cal.updatedAt = new Date().toISOString();
              await calibrationStorage.saveAltitudeCalibration(cal);
              altCount++;
            }
          } catch (e) {
            errors.push(`Failed to import altitude calibration: ${cal.id}`);
          }
        }
      }

      if (data.orientationCalibrations && Array.isArray(data.orientationCalibrations)) {
        for (const cal of data.orientationCalibrations) {
          try {
            if (cal.id && cal.deviceId && cal.mapping) {
              cal.syncStatus = 'pending';
              cal.updatedAt = new Date().toISOString();
              await calibrationStorage.saveOrientationCalibration(cal);
              orientCount++;
            }
          } catch (e) {
            errors.push(`Failed to import orientation calibration: ${cal.id}`);
          }
        }
      }

      await this.countPending();
    } catch (e) {
      errors.push('Invalid JSON format');
    }

    return { altitude: altCount, orientation: orientCount, errors };
  }

  async getConflicts(): Promise<ConflictItem[]> {
    const conflicts: ConflictItem[] = [];
    
    if (!this.db || !this.userId || !this.isOnline()) return conflicts;

    const altCals = await calibrationStorage.getAllAltitudeCalibrations();
    const conflictAlt = altCals.filter(c => c.syncStatus === 'conflict');
    
    for (const local of conflictAlt) {
      try {
        const remoteSnap = await getDocs(
          query(
            collection(this.db, 'users', this.userId, 'altitudeCalibrations'),
            where('deviceId', '==', local.deviceId)
          )
        );
        
        if (!remoteSnap.empty) {
          const remote = remoteSnap.docs[0].data() as AltitudeCalibration;
          conflicts.push({ type: 'altitude', local, remote });
        }
      } catch (e) {
        console.warn('[CalibrationSync] Failed to get conflict:', e);
      }
    }

    const orientCals = await calibrationStorage.getAllOrientationCalibrations();
    const conflictOrient = orientCals.filter(c => c.syncStatus === 'conflict');
    
    for (const local of conflictOrient) {
      try {
        const remoteSnap = await getDocs(
          query(
            collection(this.db, 'users', this.userId, 'orientationCalibrations'),
            where('deviceId', '==', local.deviceId)
          )
        );
        
        if (!remoteSnap.empty) {
          const remote = remoteSnap.docs[0].data() as OrientationCalibration;
          conflicts.push({ type: 'orientation', local, remote });
        }
      } catch (e) {
        console.warn('[CalibrationSync] Failed to get conflict:', e);
      }
    }

    return conflicts;
  }
}

export const calibrationSync = new CalibrationSyncService();
