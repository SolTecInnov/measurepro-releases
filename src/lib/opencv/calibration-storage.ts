import { CalibrationData } from '@/types/calibration';

const DB_NAME = 'measurepro-calibration';
const DB_VERSION = 1;
const STORE_NAME = 'calibrations';

export async function saveCalibrationToStorage(calibration: CalibrationData): Promise<boolean> {
  try {
    const db = await openCalibrationDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const record = {
      id: 'current_calibration',
      ...calibration,
      savedAt: Date.now()
    };
    
    return new Promise((resolve, reject) => {
      const request = store.put(record);
      
      request.onsuccess = () => {
        resolve(true);
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    return false;
  }
}

export async function loadCalibrationFromStorage(): Promise<CalibrationData | null> {
  try {
    const db = await openCalibrationDB();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.get('current_calibration');
      
      request.onsuccess = () => {
        const record = request.result;
        if (record) {
          const { id, savedAt, ...calibrationData } = record;
          resolve(calibrationData as CalibrationData);
        } else {
          resolve(null);
        }
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    return null;
  }
}

function openCalibrationDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}
