import { MeasurementRecord } from '@/types/measurements';

const DB_NAME = 'measurepro-measurements';
const DB_VERSION = 1;
const STORE_NAME = 'measurements';

export async function saveMeasurement(record: MeasurementRecord): Promise<boolean> {
  try {
    const db = await openMeasurementsDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    await store.add(record);
    return true;
  } catch (error) {
    return false;
  }
}

export async function getAllMeasurements(): Promise<MeasurementRecord[]> {
  try {
    const db = await openMeasurementsDB();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    const request = store.getAll();
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    return [];
  }
}

export async function deleteMeasurement(id: string): Promise<boolean> {
  try {
    const db = await openMeasurementsDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    await store.delete(id);
    return true;
  } catch (error) {
    return false;
  }
}

export async function clearAllMeasurements(): Promise<boolean> {
  try {
    const db = await openMeasurementsDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    await store.clear();
    return true;
  } catch (error) {
    return false;
  }
}

function openMeasurementsDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        objectStore.createIndex('structureType', 'structureType', { unique: false });
      }
    };
  });
}
