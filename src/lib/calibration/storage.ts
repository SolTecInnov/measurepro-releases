/**
 * Calibration Storage Module
 * Dual-layer persistence using localStorage (sync) and IndexedDB (durable)
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AltitudeCalibration } from './altitude';
import type { OrientationCalibration } from './orientation';

interface CalibrationDBSchema extends DBSchema {
  altitudeCalibrations: {
    key: string;
    value: AltitudeCalibration;
    indexes: { 'by-device': string; 'by-device-project': [string, string] };
  };
  orientationCalibrations: {
    key: string;
    value: OrientationCalibration;
    indexes: { 'by-device': string; 'by-device-project': [string, string] };
  };
}

const DB_NAME = 'calibration-storage';
const DB_VERSION = 1;

class CalibrationStorage {
  private db: IDBPDatabase<CalibrationDBSchema> | null = null;
  private initPromise: Promise<void> | null = null;

  private async init(): Promise<void> {
    if (this.db) return;
    
    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    this.initPromise = (async () => {
      try {
        this.db = await openDB<CalibrationDBSchema>(DB_NAME, DB_VERSION, {
          upgrade(db) {
            if (!db.objectStoreNames.contains('altitudeCalibrations')) {
              const altStore = db.createObjectStore('altitudeCalibrations', { keyPath: 'id' });
              altStore.createIndex('by-device', 'deviceId');
              altStore.createIndex('by-device-project', ['deviceId', 'projectId']);
            }
            if (!db.objectStoreNames.contains('orientationCalibrations')) {
              const orientStore = db.createObjectStore('orientationCalibrations', { keyPath: 'id' });
              orientStore.createIndex('by-device', 'deviceId');
              orientStore.createIndex('by-device-project', ['deviceId', 'projectId']);
            }
          },
        });
      } catch (e) {
        console.warn('[CalibrationStorage] IndexedDB not available:', e);
      }
    })();

    await this.initPromise;
  }

  async saveAltitudeCalibration(calibration: AltitudeCalibration): Promise<void> {
    await this.init();
    
    try {
      const lsKey = 'gnss_altitude_calibration';
      const stored = localStorage.getItem(lsKey);
      let calibrations: AltitudeCalibration[] = stored ? JSON.parse(stored) : [];
      
      const existingIndex = calibrations.findIndex(c => 
        c.deviceId === calibration.deviceId && c.projectId === calibration.projectId
      );
      
      if (existingIndex >= 0) {
        calibrations[existingIndex] = calibration;
      } else {
        calibrations.push(calibration);
      }
      
      localStorage.setItem(lsKey, JSON.stringify(calibrations));
    } catch (e) {
      console.warn('[CalibrationStorage] localStorage save failed:', e);
    }

    if (this.db) {
      try {
        await this.db.put('altitudeCalibrations', calibration);
      } catch (e) {
        console.warn('[CalibrationStorage] IndexedDB save failed:', e);
      }
    }
  }

  async loadAltitudeCalibration(deviceId: string, projectId?: string): Promise<AltitudeCalibration | null> {
    await this.init();
    
    if (this.db) {
      try {
        const all = await this.db.getAll('altitudeCalibrations');
        const match = all.find(c =>
          c.deviceId === deviceId &&
          (projectId ? c.projectId === projectId : !c.projectId)
        ) || all.find(c => c.deviceId === deviceId && !c.projectId);
        
        if (match) return match;
      } catch (e) {
        console.warn('[CalibrationStorage] IndexedDB load failed:', e);
      }
    }

    try {
      const lsKey = 'gnss_altitude_calibration';
      const stored = localStorage.getItem(lsKey);
      if (stored) {
        const calibrations: AltitudeCalibration[] = JSON.parse(stored);
        const match = calibrations.find(c =>
          c.deviceId === deviceId &&
          (projectId ? c.projectId === projectId : !c.projectId)
        ) || calibrations.find(c => c.deviceId === deviceId && !c.projectId);
        
        if (match) {
          if (this.db) {
            await this.db.put('altitudeCalibrations', match);
          }
          return match;
        }
      }
    } catch (e) {
      console.warn('[CalibrationStorage] localStorage load failed:', e);
    }

    return null;
  }

  async saveOrientationCalibration(calibration: OrientationCalibration): Promise<void> {
    await this.init();
    
    try {
      const lsKey = 'gnss_orientation_calibration';
      const stored = localStorage.getItem(lsKey);
      let calibrations: OrientationCalibration[] = stored ? JSON.parse(stored) : [];
      
      const existingIndex = calibrations.findIndex(c =>
        c.deviceId === calibration.deviceId && c.projectId === calibration.projectId
      );
      
      if (existingIndex >= 0) {
        calibrations[existingIndex] = calibration;
      } else {
        calibrations.push(calibration);
      }
      
      localStorage.setItem(lsKey, JSON.stringify(calibrations));
    } catch (e) {
      console.warn('[CalibrationStorage] localStorage save failed:', e);
    }

    if (this.db) {
      try {
        await this.db.put('orientationCalibrations', calibration);
      } catch (e) {
        console.warn('[CalibrationStorage] IndexedDB save failed:', e);
      }
    }
  }

  async loadOrientationCalibration(deviceId: string, projectId?: string): Promise<OrientationCalibration | null> {
    await this.init();
    
    if (this.db) {
      try {
        const all = await this.db.getAll('orientationCalibrations');
        const match = all.find(c =>
          c.deviceId === deviceId &&
          (projectId ? c.projectId === projectId : !c.projectId)
        ) || all.find(c => c.deviceId === deviceId && !c.projectId);
        
        if (match) return match;
      } catch (e) {
        console.warn('[CalibrationStorage] IndexedDB load failed:', e);
      }
    }

    try {
      const lsKey = 'gnss_orientation_calibration';
      const stored = localStorage.getItem(lsKey);
      if (stored) {
        const calibrations: OrientationCalibration[] = JSON.parse(stored);
        const match = calibrations.find(c =>
          c.deviceId === deviceId &&
          (projectId ? c.projectId === projectId : !c.projectId)
        ) || calibrations.find(c => c.deviceId === deviceId && !c.projectId);
        
        if (match) {
          if (this.db) {
            await this.db.put('orientationCalibrations', match);
          }
          return match;
        }
      }
    } catch (e) {
      console.warn('[CalibrationStorage] localStorage load failed:', e);
    }

    return null;
  }

  async getAllAltitudeCalibrations(): Promise<AltitudeCalibration[]> {
    await this.init();
    
    if (this.db) {
      try {
        return await this.db.getAll('altitudeCalibrations');
      } catch (e) {
        console.warn('[CalibrationStorage] IndexedDB getAll failed:', e);
      }
    }
    
    try {
      const lsKey = 'gnss_altitude_calibration';
      const stored = localStorage.getItem(lsKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  async getAllOrientationCalibrations(): Promise<OrientationCalibration[]> {
    await this.init();
    
    if (this.db) {
      try {
        return await this.db.getAll('orientationCalibrations');
      } catch (e) {
        console.warn('[CalibrationStorage] IndexedDB getAll failed:', e);
      }
    }
    
    try {
      const lsKey = 'gnss_orientation_calibration';
      const stored = localStorage.getItem(lsKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  async deleteAltitudeCalibration(id: string): Promise<void> {
    await this.init();
    
    try {
      const lsKey = 'gnss_altitude_calibration';
      const stored = localStorage.getItem(lsKey);
      if (stored) {
        const calibrations: AltitudeCalibration[] = JSON.parse(stored);
        const filtered = calibrations.filter(c => c.id !== id);
        localStorage.setItem(lsKey, JSON.stringify(filtered));
      }
    } catch (e) {
      console.warn('[CalibrationStorage] localStorage delete failed:', e);
    }
    
    if (this.db) {
      try {
        await this.db.delete('altitudeCalibrations', id);
      } catch (e) {
        console.warn('[CalibrationStorage] IndexedDB delete failed:', e);
      }
    }
  }

  async deleteOrientationCalibration(id: string): Promise<void> {
    await this.init();
    
    try {
      const lsKey = 'gnss_orientation_calibration';
      const stored = localStorage.getItem(lsKey);
      if (stored) {
        const calibrations: OrientationCalibration[] = JSON.parse(stored);
        const filtered = calibrations.filter(c => c.id !== id);
        localStorage.setItem(lsKey, JSON.stringify(filtered));
      }
    } catch (e) {
      console.warn('[CalibrationStorage] localStorage delete failed:', e);
    }
    
    if (this.db) {
      try {
        await this.db.delete('orientationCalibrations', id);
      } catch (e) {
        console.warn('[CalibrationStorage] IndexedDB delete failed:', e);
      }
    }
  }

  async migrateFromLocalStorage(): Promise<{ altitude: number; orientation: number }> {
    await this.init();
    
    let altCount = 0;
    let orientCount = 0;
    
    if (!this.db) return { altitude: altCount, orientation: orientCount };

    try {
      const altLsKey = 'gnss_altitude_calibration';
      const altStored = localStorage.getItem(altLsKey);
      if (altStored) {
        const calibrations: AltitudeCalibration[] = JSON.parse(altStored);
        for (const cal of calibrations) {
          await this.db.put('altitudeCalibrations', cal);
          altCount++;
        }
      }
    } catch (e) {
      console.warn('[CalibrationStorage] Altitude migration failed:', e);
    }

    try {
      const orientLsKey = 'gnss_orientation_calibration';
      const orientStored = localStorage.getItem(orientLsKey);
      if (orientStored) {
        const calibrations: OrientationCalibration[] = JSON.parse(orientStored);
        for (const cal of calibrations) {
          await this.db.put('orientationCalibrations', cal);
          orientCount++;
        }
      }
    } catch (e) {
      console.warn('[CalibrationStorage] Orientation migration failed:', e);
    }

    return { altitude: altCount, orientation: orientCount };
  }
}

export const calibrationStorage = new CalibrationStorage();
