/**
 * Cloud Functions API Wrapper
 * Secure backend API for licensing system
 * 
 * This replaces direct Firestore SDK calls with secure Cloud Function calls
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import firebase from '@/lib/firebase';
import type {
  InsertLicenseFeature,
  InsertLicensePackage,
  InsertActivationCode,
  LicenseFeature,
  LicensePackage,
  ActivationCode,
  UserLicense,
  UserDevice,
  ActivationRequest,
} from '../../../shared/schema';

// Lazy initialize functions only when needed to avoid "No Firebase App" errors
let functionsInstance: any = null;
const getFunctionsInstance = () => {
  if (!functionsInstance) {
    try {
      functionsInstance = getFunctions();
    } catch (error) {
      // Silent fail - Firebase Functions not available yet
      return null;
    }
  }
  return functionsInstance;
};

// Feature Functions
const createFeatureFunc = (data: any) => {
  const funcs = getFunctionsInstance();
  if (!funcs) throw new Error('Firebase not initialized');
  return httpsCallable(funcs, 'createFeature')(data);
};
const updateFeatureFunc = (data: any) => {
  const funcs = getFunctionsInstance();
  if (!funcs) throw new Error('Firebase not initialized');
  return httpsCallable(funcs, 'updateFeature')(data);
};
const deleteFeatureFunc = (data: any) => {
  const funcs = getFunctionsInstance();
  if (!funcs) throw new Error('Firebase not initialized');
  return httpsCallable(funcs, 'deleteFeature')(data);
};
const getAllFeaturesFunc = (data: any) => {
  const funcs = getFunctionsInstance();
  if (!funcs) throw new Error('Firebase not initialized');
  return httpsCallable(funcs, 'getAllFeatures')(data);
};

// Package Functions
const createPackageFunc = (data: any) => {
  const funcs = getFunctionsInstance();
  if (!funcs) throw new Error('Firebase not initialized');
  return httpsCallable(funcs, 'createPackage')(data);
};
const updatePackageFunc = (data: any) => {
  const funcs = getFunctionsInstance();
  if (!funcs) throw new Error('Firebase not initialized');
  return httpsCallable(funcs, 'updatePackage')(data);
};
const deletePackageFunc = (data: any) => {
  const funcs = getFunctionsInstance();
  if (!funcs) throw new Error('Firebase not initialized');
  return httpsCallable(funcs, 'deletePackage')(data);
};
const getAllPackagesFunc = (data: any) => {
  const funcs = getFunctionsInstance();
  if (!funcs) throw new Error('Firebase not initialized');
  return httpsCallable(funcs, 'getAllPackages')(data);
};

// Activation Code Functions
const generateActivationCodeFunc = (data: any) => {
  const funcs = getFunctionsInstance();
  if (!funcs) throw new Error('Firebase not initialized');
  return httpsCallable(funcs, 'generateActivationCode')(data);
};
const deactivateActivationCodeFunc = (data: any) => {
  const funcs = getFunctionsInstance();
  if (!funcs) throw new Error('Firebase not initialized');
  return httpsCallable(funcs, 'deactivateActivationCode')(data);
};
const deleteActivationCodeFunc = (data: any) => {
  const funcs = getFunctionsInstance();
  if (!funcs) throw new Error('Firebase not initialized');
  return httpsCallable(funcs, 'deleteActivationCode')(data);
};
const getAllActivationCodesFunc = (data: any) => {
  const funcs = getFunctionsInstance();
  if (!funcs) throw new Error('Firebase not initialized');
  return httpsCallable(funcs, 'getAllActivationCodes')(data);
};

// License Functions
const activateLicenseFunc = (data: any) => {
  const funcs = getFunctionsInstance();
  if (!funcs) throw new Error('Firebase not initialized');
  return httpsCallable(funcs, 'activateLicense')(data);
};
const getUserLicensesFunc = (data: any) => {
  const funcs = getFunctionsInstance();
  if (!funcs) throw new Error('Firebase not initialized');
  return httpsCallable(funcs, 'getUserLicenses')(data);
};
const getAllUserLicensesFunc = (data: any) => {
  const funcs = getFunctionsInstance();
  if (!funcs) throw new Error('Firebase not initialized');
  return httpsCallable(funcs, 'getAllUserLicenses')(data);
};
const deactivateUserLicenseFunc = (data: any) => {
  const funcs = getFunctionsInstance();
  if (!funcs) throw new Error('Firebase not initialized');
  return httpsCallable(funcs, 'deactivateUserLicense')(data);
};

// Device Functions
const getUserDevicesFunc = (data: any) => {
  const funcs = getFunctionsInstance();
  if (!funcs) throw new Error('Firebase not initialized');
  return httpsCallable(funcs, 'getUserDevices')(data);
};
const deactivateDeviceFunc = (data: any) => {
  const funcs = getFunctionsInstance();
  if (!funcs) throw new Error('Firebase not initialized');
  return httpsCallable(funcs, 'deactivateDevice')(data);
};
const deleteDeviceFunc = (data: any) => {
  const funcs = getFunctionsInstance();
  if (!funcs) throw new Error('Firebase not initialized');
  return httpsCallable(funcs, 'deleteDevice')(data);
};
const getAllDevicesFunc = (data: any) => {
  const funcs = getFunctionsInstance();
  if (!funcs) throw new Error('Firebase not initialized');
  return httpsCallable(funcs, 'getAllDevices')(data);
};

// Admin Claim Function
const setAdminClaimFunc = (data: any) => {
  const funcs = getFunctionsInstance();
  if (!funcs) throw new Error('Firebase not initialized');
  return httpsCallable(funcs, 'setAdminClaim')(data);
};

/**
 * Feature API
 */
export async function createLicenseFeatureAPI(data: InsertLicenseFeature): Promise<{ success: boolean; id: string }> {
  const result = await createFeatureFunc(data);
  return result.data as { success: boolean; id: string };
}

export async function updateLicenseFeatureAPI(id: string, data: InsertLicenseFeature): Promise<{ success: boolean }> {
  const result = await updateFeatureFunc({ id, ...data });
  return result.data as { success: boolean };
}

export async function deleteLicenseFeatureAPI(id: string): Promise<{ success: boolean }> {
  const result = await deleteFeatureFunc({ id });
  return result.data as { success: boolean };
}

export async function getAllLicenseFeaturesAPI(): Promise<LicenseFeature[]> {
  const result = await getAllFeaturesFunc({});
  const data = result.data as { success: boolean; features: any[] };
  return data.features as LicenseFeature[];
}

/**
 * Package API
 */
export async function createLicensePackageAPI(data: InsertLicensePackage): Promise<{ success: boolean; id: string }> {
  const result = await createPackageFunc(data);
  return result.data as { success: boolean; id: string };
}

export async function updateLicensePackageAPI(id: string, data: InsertLicensePackage): Promise<{ success: boolean }> {
  const result = await updatePackageFunc({ id, ...data });
  return result.data as { success: boolean };
}

export async function deleteLicensePackageAPI(id: string): Promise<{ success: boolean }> {
  const result = await deletePackageFunc({ id });
  return result.data as { success: boolean };
}

export async function getAllLicensePackagesAPI(): Promise<LicensePackage[]> {
  // Use the Express backend proxy instead of calling the Firebase Cloud Function directly.
  const { getAuth } = await import('firebase/auth');
  const currentUser = getAuth().currentUser;
  if (!currentUser) return [];
  const idToken = await currentUser.getIdToken();
  const resp = await fetch('/api/licenses/packages', {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!resp.ok) return [];
  const data = await resp.json() as { success: boolean; packages: any[] };
  return (data.packages ?? []) as LicensePackage[];
}

/**
 * Activation Code API
 */
export async function generateActivationCodeAPI(data: InsertActivationCode): Promise<{ success: boolean; id: string; code: string }> {
  const result = await generateActivationCodeFunc(data);
  return result.data as { success: boolean; id: string; code: string };
}

export async function deactivateActivationCodeAPI(id: string): Promise<{ success: boolean }> {
  const result = await deactivateActivationCodeFunc({ id });
  return result.data as { success: boolean };
}

export async function deleteActivationCodeAPI(id: string): Promise<{ success: boolean }> {
  const result = await deleteActivationCodeFunc({ id });
  return result.data as { success: boolean };
}

export async function getAllActivationCodesAPI(): Promise<ActivationCode[]> {
  const result = await getAllActivationCodesFunc({});
  const data = result.data as { success: boolean; codes: any[] };
  return data.codes as ActivationCode[];
}

/**
 * License Activation API (User-facing)
 */
export async function activateLicenseCodeAPI(request: ActivationRequest): Promise<{
  success: boolean;
  error?: string;
  license?: UserLicense;
}> {
  try {
    const result = await activateLicenseFunc(request);
    const data = result.data as any;
    return {
      success: data.success,
      license: data.license,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Activation failed',
    };
  }
}

export async function getUserLicensesAPI(): Promise<UserLicense[]> {
  // Use the Express backend proxy instead of calling the Firebase Cloud Function directly.
  // The proxy uses the Admin SDK server-side which has no CORS restrictions.
  const { getAuth } = await import('firebase/auth');
  const currentUser = getAuth().currentUser;
  if (!currentUser) throw new Error('Not authenticated');
  const idToken = await currentUser.getIdToken();
  const resp = await fetch('/api/licenses/user-licenses', {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!resp.ok) throw new Error(`user-licenses returned ${resp.status}`);
  const data = await resp.json() as { success: boolean; licenses: any[] };
  return data.licenses as UserLicense[];
}

export async function getAllUserLicensesAPI(): Promise<UserLicense[]> {
  const result = await getAllUserLicensesFunc({});
  const data = result.data as { success: boolean; licenses: any[] };
  return data.licenses as UserLicense[];
}

export async function deactivateUserLicenseAPI(id: string): Promise<{ success: boolean }> {
  const result = await deactivateUserLicenseFunc({ id });
  return result.data as { success: boolean };
}

/**
 * Device API
 */
export async function getUserDevicesAPI(): Promise<UserDevice[]> {
  const result = await getUserDevicesFunc({});
  const data = result.data as { success: boolean; devices: any[] };
  return data.devices as UserDevice[];
}

export async function deactivateDeviceAPI(id: string): Promise<{ success: boolean }> {
  const result = await deactivateDeviceFunc({ id });
  return result.data as { success: boolean };
}

export async function deleteDeviceAPI(id: string): Promise<{ success: boolean }> {
  const result = await deleteDeviceFunc({ id });
  return result.data as { success: boolean };
}

export async function getAllDevicesAPI(): Promise<UserDevice[]> {
  const result = await getAllDevicesFunc({});
  const data = result.data as { success: boolean; devices: any[] };
  return data.devices as UserDevice[];
}

/**
 * Admin Claim API
 */
export async function setAdminClaimAPI(targetEmail: string): Promise<{ success: boolean; message: string }> {
  const result = await setAdminClaimFunc({ targetEmail });
  return result.data as { success: boolean; message: string };
}

/**
 * Check if Cloud Functions are enabled
 */
export function isCloudFunctionsEnabled(): boolean {
  return import.meta.env.VITE_USE_CLOUD_FUNCTIONS === 'true';
}
