import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, onSnapshot, Timestamp, writeBatch, updateDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { Survey, Measurement } from './survey/types';
import { toast } from 'sonner';
import { logger } from './utils/logger';

// Inline Account type to avoid shared/schema import which causes browser compatibility issues
type Account = {
  id: string;
  fullName: string;
  email: string;
  company?: string;
  title?: string;
  phone?: string;
  address?: string;
  referredBy?: string;
  status: 'email_pending' | 'pending' | 'approved' | 'rejected';
  emailVerified: boolean;
  verification?: {
    codeHash: string;
    expiresAt: string;
  };
  createdAt: string;
  updatedAt: string;
  authUid?: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  subscriptionTier?: string;
  enabledAddons?: string[];
  requiresPasswordChange?: boolean;
};

// Firebase configuration - aggressively strip ALL quotes and whitespace
const firebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY || '').replace(/["']/g, '').trim(),
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '').replace(/["']/g, '').trim(),
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID || '').replace(/["']/g, '').trim(),
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '').replace(/["']/g, '').trim(),
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '').replace(/["']/g, '').trim(),
  appId: (import.meta.env.VITE_FIREBASE_APP_ID || '').replace(/["']/g, '').trim()
};

// Check if Firebase is configured
const isFirebaseConfigured = firebaseConfig.apiKey && firebaseConfig.apiKey !== 'undefined';

/**
 * Deep sanitize an object for Firestore compatibility
 * - Removes undefined values
 * - Converts NaN and Infinity to null
 * - Handles nested objects and arrays
 */
function sanitizeForFirestore(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }
  
  if (typeof obj === 'number') {
    // Convert NaN and Infinity to null (Firestore doesn't accept these)
    if (Number.isNaN(obj) || !Number.isFinite(obj)) {
      return null;
    }
    return obj;
  }
  
  if (typeof obj === 'string' || typeof obj === 'boolean') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  
  if (obj instanceof Timestamp) {
    return obj; // Firestore Timestamps are fine
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForFirestore(item)).filter(item => item !== undefined);
  }
  
  if (typeof obj === 'object') {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        const sanitizedValue = sanitizeForFirestore(value);
        if (sanitizedValue !== undefined) {
          result[key] = sanitizedValue;
        }
      }
    }
    return result;
  }
  
  return obj;
}

// Lazy initialization - Firebase will only be initialized when explicitly needed
let app: any;
let db: any;
let auth: any;
let isInitialized = false;

// Initialize Firebase on demand (lazy initialization)
const initializeFirebase = () => {
  if (isInitialized) return;
  
  if (isFirebaseConfigured) {
    try {
      const existingApps = getApps();
      if (existingApps.length > 0) {
        app = existingApps[0];
        db = getFirestore(app);
        auth = getAuth(app);
        isInitialized = true;
        // Expose app globally for liveMonitorService and other services
        (window as any).__firebaseApp__ = app;
        return;
      }
      
      app = initializeApp(firebaseConfig);
      db = getFirestore(app);
      auth = getAuth(app);
      isInitialized = true;
      
      // Expose app globally for liveMonitorService and other services
      (window as any).__firebaseApp__ = app;
    } catch (error: any) {
      logger.error('Firebase initialization failed:', error?.message);
    }
  }
};

// AUTO-INITIALIZE Firebase when this module loads
initializeFirebase();

// Auth state listener - with offline error protection
export const initAuthListener = (callback: (user: User | null) => void) => {
  initializeFirebase();
  
  if (!auth) {
    callback(null);
    return () => {};
  }
  
  return onAuthStateChanged(auth, (user) => {
    try {
      const currentUser = user ? user.uid : null;
      
      if (currentUser) {
        localStorage.setItem('current_user_id', currentUser);
      } else {
        localStorage.removeItem('current_user_id');
      }
      
      callback(user);
      
      window.dispatchEvent(new CustomEvent('auth-state-changed', { 
        detail: { user }
      }));
      
      if (!user) {
        localStorage.removeItem('lastSyncTime');
      }
    } catch (error: any) {
      if (error?.code === 'auth/network-request-failed' || !navigator.onLine) {
        return;
      }
      console.error('[AUTH-9] ❌ Auth state change error:', error?.message);
    }
  });
};

// Sign in with email and password
export const signInWithEmail = async (email: string, password: string) => {
  logger.debug('[SIGNIN-1] signInWithEmail() called for email:', email);
  initializeFirebase();
  
  if (!auth) {
    console.error('[SIGNIN-2] ❌ Auth not initialized - cannot sign in');
    throw new Error('⚠️ Cloud sync not configured. Check Firebase settings or use offline mode.');
  }
  
  logger.debug('[SIGNIN-3] Attempting Firebase sign in...');
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    logger.debug('[SIGNIN-4] ✅ Sign in successful:', userCredential.user.uid);
    localStorage.setItem('current_user_id', userCredential.user.uid);
    return userCredential.user;
  } catch (error: any) {
    console.error('[SIGNIN-5] ❌ Sign in FAILED:', {
      errorCode: error.code,
      errorMessage: error.message,
      error
    });
    
    // Provide user-friendly error messages
    if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
      throw new Error('❌ Invalid email or password. Please check your credentials.');
    } else if (error.code === 'auth/too-many-requests') {
      throw new Error('⏱️ Too many failed attempts. Please try again later.');
    } else if (error.code === 'auth/network-request-failed') {
      throw new Error('📡 Network error. Please check your internet connection.');
    } else if (error.code === 'auth/user-disabled') {
      throw new Error('🚫 Your account has been disabled. Contact support.');
    } else {
      throw new Error(`⚠️ Login failed: ${error.message || 'Unknown error'}`);
    }
  }
};

// Create a new user with email and password
export const createUser = async (email: string, password: string) => {
  initializeFirebase();
  
  if (!auth) {
    throw new Error('⚠️ Cloud sync not configured. Check Firebase settings or use offline mode.');
  }
  
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const newUser = userCredential.user;

    // Notify admin of new registration (fire & forget)
    const apiUrl = import.meta.env.VITE_API_URL || '';
    fetch(`${apiUrl}/api/email/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'MeasurePRO System',
        email: 'support@soltecinnovation.com',
        subject: `[MeasurePRO] New user registered — ${email}`,
        message: `A new user just registered on MeasurePRO.\n\nEmail: ${email}\nUID: ${newUser.uid}\nTime: ${new Date().toISOString()}\n\n7-day trial started automatically.\n\nAdmin panel → License Admin → Create Licence when ready.`,
      }),
    }).catch(() => {}); // Silent fail — don't block registration

    return newUser;
  } catch (error: any) {
    // Provide user-friendly error messages
    if (error.code === 'auth/email-already-in-use') {
      throw new Error('📧 Email already in use. Please sign in instead.');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('❌ Invalid email address format.');
    } else if (error.code === 'auth/weak-password') {
      throw new Error('🔒 Password too weak. Use at least 6 characters.');
    } else if (error.code === 'auth/network-request-failed') {
      throw new Error('📡 Network error. Please check your internet connection.');
    } else {
      throw new Error(`⚠️ Registration failed: ${error.message || 'Unknown error'}`);
    }
  }
};

// Sign out
export const signOutUser = async () => {
  initializeFirebase();
  
  if (!auth) {
    return false;
  }
  
  try {
    await signOut(auth);
    return true;
  } catch (error) {
    return false;
  }
};

// Get current user - don't initialize Firebase just to check user status
export const getCurrentUser = () => {
  // Only initialize if Firebase is configured
  if (!isFirebaseConfigured) {
    return null;
  }
  
  // Only initialize if we actually need to check auth state  
  // Don't initialize Firebase during boot just to return null
  if (!isInitialized) {
    return null;
  }
  
  return auth?.currentUser || null;
};

// Sign in anonymously
export const signInAnon = async () => {
  initializeFirebase();
  try {
    const userCredential = await signInAnonymously(auth);
    return userCredential.user;
  } catch (error) {
    return null;
  }
};

// Check if we're online
export const isOnline = () => {
  return navigator.onLine;
};

// Import surveys from Firebase and save to local IndexedDB
export const importSurveysFromFirebase = async (): Promise<Survey[]> => {
  try {
    logger.debug('[Import] Starting import from Firebase...');
    
    if (!isOnline()) {
      toast.error('Cannot import surveys while offline');
      return [];
    }

    if (!auth.currentUser) {
      toast.error('Please sign in to import surveys');
      return [];
    }

    logger.debug('[Import] Fetching surveys from Firebase...');
    const surveys = await getSurveysFromFirebase();
    logger.debug('[Import] Fetched', surveys.length, 'surveys from Firebase');
    
    if (surveys.length === 0) {
      toast.info('No surveys found to import');
      return [];
    }

    // Save surveys to local IndexedDB
    const { openSurveyDB } = await import('./survey/db');
    const localDb = await openSurveyDB();
    
    let savedCount = 0;
    for (const survey of surveys) {
      try {
        // Check if survey already exists locally
        const existing = await localDb.get('surveys', survey.id);
        if (!existing) {
          // Mark as inactive on import and add lastSyncedAt to prevent re-sync
          await localDb.put('surveys', { 
            ...survey, 
            active: false,
            lastSyncedAt: new Date().toISOString() // Prevent auto re-sync
          });
          savedCount++;
        }
      } catch (err) {
        console.error(`[Import] Failed to save survey ${survey.id}:`, err);
      }
    }

    // Also import measurements for each survey
    let measurementCount = 0;
    for (const survey of surveys) {
      try {
        const measurements = await getMeasurementsFromFirebase(survey.id);
        for (const measurement of measurements) {
          try {
            const existingMeasurement = await localDb.get('measurements', measurement.id);
            if (!existingMeasurement) {
              await localDb.put('measurements', measurement);
              measurementCount++;
            }
          } catch (err) {
            // Measurement already exists or error saving
          }
        }
      } catch (err) {
        console.error(`[Import] Failed to import measurements for survey ${survey.id}:`, err);
      }
    }

    toast.success(`Imported ${savedCount} new surveys and ${measurementCount} POIs`);
    return surveys;
  } catch (error) {
    toast.error('Failed to import surveys', {
      description: error instanceof Error ? error.message : 'Unknown error occurred'
    });
    return [];
  }
};

// Sync a survey to Firebase
export const syncSurveyToFirebase = async (survey: Survey): Promise<boolean> => {
  try {
    if (!isOnline()) {
      logger.debug(`[Sync] Cannot sync survey ${survey.id}: offline`);
      return false;
    }

    initializeFirebase();
    
    // Make sure we're signed in
    if (!auth?.currentUser) {
      console.error(`[Sync] Cannot sync survey ${survey.id}: not authenticated`);
      return false;
    }

    // Skip surveys that belong to a different user (imported from someone else)
    const surveyData = survey as Survey & { ownerId?: string };
    if (surveyData.ownerId && surveyData.ownerId !== auth.currentUser.uid) {
      logger.debug(`[Sync] Skipping survey ${survey.id}: owned by different user`);
      return true; // Return true to not mark as failed
    }

    // Add server timestamp and ownerId for security rules
    const surveyWithTimestamp = {
      ...survey,
      ownerId: auth.currentUser.uid, // Required by Firestore security rules
      lastSyncedAt: Timestamp.now()
    };

    // Deep sanitize: removes undefined, NaN, Infinity (Firestore doesn't accept them)
    const cleanedSurvey = sanitizeForFirestore(surveyWithTimestamp);

    // Save to Firestore
    await setDoc(doc(db, 'surveys', survey.id), cleanedSurvey);
    logger.debug(`[Sync] Successfully synced survey ${survey.id} to Firebase`);
    return true;
  } catch (error) {
    // Check for permission error - survey likely belongs to another user
    const errorMessage = error instanceof Error ? error.message : '';
    if (errorMessage.includes('permission') || errorMessage.includes('insufficient permissions')) {
      logger.debug(`[Sync] Skipping survey ${survey.id}: permission denied (likely different owner)`);
      return true; // Return true to not flood with errors
    }
    console.error(`[Sync] Error syncing survey ${survey.id}:`, error);
    return false;
  }
};

// Sync measurements to Firebase
export const syncMeasurementsToFirebase = async (measurements: Measurement[], surveyId: string): Promise<boolean> => {
  try {
    if (!isOnline()) {
      logger.debug(`[Sync] Cannot sync ${measurements.length} measurements: offline`);
      return false;
    }

    // Make sure we're signed in
    if (!auth.currentUser) {
      console.error(`[Sync] Cannot sync ${measurements.length} measurements: not authenticated`);
      return false;
    }

    // Use batched writes for better performance
    let batch = writeBatch(db);
    let count = 0;

    for (const measurement of measurements) {
      // Add server timestamp and ownerId for security rules
      const measurementWithTimestamp = {
        ...measurement,
        ownerId: auth.currentUser.uid, // Required by Firestore security rules
        lastSyncedAt: Timestamp.now()
      };

      // Deep sanitize: removes undefined, NaN, Infinity (Firestore doesn't accept them)
      const cleanedMeasurement = sanitizeForFirestore(measurementWithTimestamp);

      // Add to batch
      const measurementRef = doc(db, 'measurements', measurement.id);
      batch.set(measurementRef, cleanedMeasurement);
      count++;

      // Firestore batches are limited to 500 operations
      if (count >= 450) {
        await batch.commit();
        // Throttle between batches to prevent write stream exhaustion
        await new Promise(resolve => setTimeout(resolve, 500));
        batch = writeBatch(db); // Create new batch after commit
        count = 0;
      }
    }

    // Commit any remaining operations
    if (count > 0) {
      await batch.commit();
    }

    // Small delay before survey status update
    await new Promise(resolve => setTimeout(resolve, 200));

    // Update survey sync status
    await setDoc(doc(db, 'surveys', surveyId), {
      lastSyncedAt: Timestamp.now(),
      measurementsSynced: measurements.length
    }, { merge: true });

    return true;
  } catch (error) {
    console.error(`[Sync] Error syncing measurements for survey ${surveyId}:`, error);
    return false;
  }
};

// Sync vehicle traces to Firebase
export const syncVehicleTracesToFirebase = async (traces: any[], surveyId: string): Promise<boolean> => {
  try {
    if (!isOnline()) {
      return false;
    }

    // Make sure we're signed in
    if (!auth.currentUser) {
      return false;
    }

    // Use batched writes for better performance
    const batch = writeBatch(db);
    let count = 0;

    for (const trace of traces) {
      // Add server timestamp and survey ID
      const traceWithTimestamp = {
        ...trace,
        surveyId,
        lastSyncedAt: Timestamp.now()
      };

      // Deep sanitize: removes undefined, NaN, Infinity (Firestore doesn't accept them)
      const cleanedTrace = sanitizeForFirestore(traceWithTimestamp);

      // Add to batch
      const traceRef = doc(db, 'trackpoints', trace.id);
      batch.set(traceRef, cleanedTrace);
      count++;

      // Firestore batches are limited to 500 operations
      if (count >= 450) {
        await batch.commit();
        // Throttle between batches to prevent write stream exhaustion
        await new Promise(resolve => setTimeout(resolve, 500));
        count = 0;
      }
    }

    // Commit any remaining operations
    if (count > 0) {
      await batch.commit();
    }

    return true;
  } catch (error) {
    return false;
  }
};

// Get all surveys from Firebase (only owned by current user)
export const getSurveysFromFirebase = async (): Promise<Survey[]> => {
  try {
    if (!isOnline()) {
      return [];
    }

    // Make sure we're signed in
    if (!auth.currentUser) {
      return [];
    }

    // Query only surveys owned by current user
    const q = query(collection(db, 'surveys'), where('ownerId', '==', auth.currentUser.uid));
    const surveysSnapshot = await getDocs(q);
    const surveys: Survey[] = [];

    surveysSnapshot.forEach((doc) => {
      surveys.push(doc.data() as Survey);
    });

    logger.debug(`[Firebase] Fetched ${surveys.length} surveys owned by user ${auth.currentUser.uid}`);
    return surveys;
  } catch (error) {
    console.error('[Firebase] Error fetching surveys:', error);
    return [];
  }
};

// Get measurements for a survey from Firebase
export const getMeasurementsFromFirebase = async (surveyId: string): Promise<Measurement[]> => {
  try {
    if (!isOnline()) {
      return [];
    }

    // Make sure we're signed in
    if (!auth.currentUser) {
      return [];
    }

    const q = query(collection(db, 'measurements'), where('user_id', '==', surveyId));
    const measurementsSnapshot = await getDocs(q);
    const measurements: Measurement[] = [];

    measurementsSnapshot.forEach((doc) => {
      measurements.push(doc.data() as Measurement);
    });

    return measurements;
  } catch (error) {
    return [];
  }
};

// Listen for changes to a survey
export const listenToSurvey = (surveyId: string, callback: (survey: Survey) => void) => {
  if (!isOnline()) {
    return () => {};
  }

  const unsubscribe = onSnapshot(doc(db, 'surveys', surveyId), (doc) => {
    if (doc.exists()) {
      callback(doc.data() as Survey);
    }
  }, (_error) => {
    // Silently handle errors (expected when offline)
  });

  return unsubscribe;
};

// Check if a survey exists in Firebase
export const checkSurveyExistsInFirebase = async (surveyId: string): Promise<boolean> => {
  try {
    if (!isOnline()) {
      return false;
    }

    // Make sure we're signed in
    if (!auth.currentUser) {
      return false;
    }

    const docRef = doc(db, 'surveys', surveyId);
    const docSnap = await getDoc(docRef);

    return docSnap.exists();
  } catch (error) {
    return false;
  }
};

// ====================================
// ACCOUNT MANAGEMENT FUNCTIONS
// ====================================

// Save account to Firebase (create new account document)
export const saveAccount = async (accountData: Partial<Account>): Promise<void> => {
  initializeFirebase();
  
  if (!isOnline()) {
    throw new Error('Cannot create account while offline');
  }

  try {
    const accountId = accountData.id || Math.random().toString(36).substring(2, 15);
    const accountRef = doc(db, 'accounts', accountId);
    
    const accountToSave = {
      ...accountData,
      id: accountId,
      createdAt: accountData.createdAt || new Date().toISOString(),
    };

    await setDoc(accountRef, accountToSave);
  } catch (error) {
    throw error;
  }
};

// Get account by ID from Firebase
export const getAccountById = async (accountId: string): Promise<Account | null> => {
  initializeFirebase();
  
  if (!isOnline()) {
    return null;
  }

  try {
    const accountRef = doc(db, 'accounts', accountId);
    const accountSnap = await getDoc(accountRef);

    if (accountSnap.exists()) {
      return accountSnap.data() as Account;
    }
    
    return null;
  } catch (error) {
    return null;
  }
};

// Link Firebase Auth UID to account
export const linkAuthUid = async (accountId: string, authUid: string): Promise<void> => {
  initializeFirebase();
  
  if (!isOnline()) {
    throw new Error('Cannot link account while offline');
  }

  try {
    const accountRef = doc(db, 'accounts', accountId);
    await updateDoc(accountRef, {
      authUid,
    });
  } catch (error) {
    throw error;
  }
};

// Get account by Firebase Auth UID
export const getAccountForUid = async (authUid: string): Promise<Account | null> => {
  initializeFirebase();
  
  if (!isOnline()) {
    return null;
  }

  try {
    const accountsRef = collection(db, 'accounts');
    const q = query(accountsRef, where('authUid', '==', authUid));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    const accountDoc = querySnapshot.docs[0];
    return { ...accountDoc.data(), id: accountDoc.id } as Account;
  } catch (error) {
    return null;
  }
};

// Listen to account status changes (real-time updates)
export const listenToAccountStatus = (
  authUid: string, 
  callback: (account: Account | null) => void
): (() => void) => {
  initializeFirebase();
  
  if (!isOnline()) {
    callback(null);
    return () => {};
  }

  try {
    const accountsRef = collection(db, 'accounts');
    const q = query(accountsRef, where('authUid', '==', authUid));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      if (querySnapshot.empty) {
        callback(null);
        return;
      }

      const accountDoc = querySnapshot.docs[0];
      const account = { ...accountDoc.data(), id: accountDoc.id } as Account;
      callback(account);
    }, (_error) => {
      // Silently handle errors (expected when offline)
      callback(null);
    });

    return unsubscribe;
  } catch (error) {
    callback(null);
    return () => {};
  }
};

// Get account by email (useful for verification)
export const getAccountByEmail = async (email: string): Promise<Account | null> => {
  initializeFirebase();
  
  if (!isOnline()) {
    return null;
  }

  try {
    const accountsRef = collection(db, 'accounts');
    const q = query(accountsRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    const accountDoc = querySnapshot.docs[0];
    return { ...accountDoc.data(), id: accountDoc.id } as Account;
  } catch (error) {
    return null;
  }
};

// Named exports for direct import
export { auth, db };

export default { db, auth, isOnline, getCurrentUser };