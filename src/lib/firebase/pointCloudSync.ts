import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, Timestamp, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getBytes, deleteObject, getDownloadURL } from 'firebase/storage';
import { getCurrentUser, isOnline } from '../firebase';
import type { PointCloudScan } from '../pointCloud/types';

let db: any;
let storage: any;

const initFirebaseServices = () => {
  if (!db || !storage) {
    try {
      const app = (window as any).__firebaseApp__;
      if (app) {
        db = getFirestore(app);
        storage = getStorage(app);
      }
    } catch (error) {
    }
  }
};

export const syncPointCloudScanToFirebase = async (
  scan: PointCloudScan
): Promise<boolean> => {
  try {
    if (!isOnline()) {
      return false;
    }

    initFirebaseServices();
    const user = getCurrentUser();
    
    if (!user || !db) {
      return false;
    }

    const scanMetadata = {
      ...scan,
      userId: user.uid,
      lastSyncedAt: Timestamp.now(),
    };

    await setDoc(doc(db, 'pointCloudScans', scan.id), scanMetadata);
    return true;
  } catch (error) {
    return false;
  }
};

export const syncPointCloudBinaryToStorage = async (
  scanId: string,
  binaryData: ArrayBuffer,
  format: 'ply' | 'las'
): Promise<string | null> => {
  try {
    if (!isOnline()) {
      return null;
    }

    initFirebaseServices();
    const user = getCurrentUser();
    
    if (!user || !storage) {
      return null;
    }

    const fileName = `${scanId}.${format}`;
    const storageRef = ref(storage, `pointClouds/${user.uid}/${fileName}`);

    const blob = new Blob([binaryData], { 
      type: format === 'ply' ? 'application/octet-stream' : 'application/octet-stream' 
    });

    await uploadBytes(storageRef, blob);
    const downloadUrl = await getDownloadURL(storageRef);
    
    return downloadUrl;
  } catch (error) {
    return null;
  }
};

export const getPointCloudBinaryFromStorage = async (
  scanId: string,
  format: 'ply' | 'las'
): Promise<ArrayBuffer | null> => {
  try {
    if (!isOnline()) {
      return null;
    }

    initFirebaseServices();
    const user = getCurrentUser();
    
    if (!user || !storage) {
      return null;
    }

    const fileName = `${scanId}.${format}`;
    const storageRef = ref(storage, `pointClouds/${user.uid}/${fileName}`);

    const arrayBuffer = await getBytes(storageRef);
    return arrayBuffer;
  } catch (error) {
    return null;
  }
};

export const deletePointCloudFromFirebase = async (scanId: string): Promise<boolean> => {
  try {
    if (!isOnline()) {
      return false;
    }

    initFirebaseServices();
    const user = getCurrentUser();
    
    if (!user || !db || !storage) {
      return false;
    }

    await deleteDoc(doc(db, 'pointCloudScans', scanId));

    const formats = ['ply', 'las'] as const;
    for (const format of formats) {
      try {
        const fileName = `${scanId}.${format}`;
        const storageRef = ref(storage, `pointClouds/${user.uid}/${fileName}`);
        await deleteObject(storageRef);
      } catch (error) {
      }
    }

    return true;
  } catch (error) {
    return false;
  }
};

export const getPointCloudScansFromFirebase = async (): Promise<any[]> => {
  try {
    if (!isOnline()) {
      return [];
    }

    initFirebaseServices();
    const user = getCurrentUser();
    
    if (!user || !db) {
      return [];
    }

    const q = query(
      collection(db, 'pointCloudScans'),
      where('userId', '==', user.uid)
    );
    const scansSnapshot = await getDocs(q);
    const scans: any[] = [];

    scansSnapshot.forEach((doc) => {
      scans.push(doc.data());
    });

    return scans;
  } catch (error) {
    return [];
  }
};

export const checkPointCloudExistsInFirebase = async (scanId: string): Promise<boolean> => {
  try {
    if (!isOnline()) {
      return false;
    }

    initFirebaseServices();
    const user = getCurrentUser();
    
    if (!user || !db) {
      return false;
    }

    const docRef = doc(db, 'pointCloudScans', scanId);
    const docSnap = await getDoc(docRef);

    return docSnap.exists();
  } catch (error) {
    return false;
  }
};
