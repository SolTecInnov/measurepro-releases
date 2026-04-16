/**
 * Electron License Store
 *
 * Holds the offline license payload from LicenseGate so the rest of the app
 * (useLicenseEnforcement, isBetaUser, License Info modal) can access it.
 */
import { create } from 'zustand';

export interface ElectronLicensePayload {
  customer: string;
  email: string;
  expiresAt: string;
  type: string;        // "admin" | "pro" | "beta" | "enterprise"
  addons: string[];    // addon IDs: 'ai_plus', 'envelope', etc.
  product: string;
  machineId: string;
}

interface ElectronLicenseState {
  payload: ElectronLicensePayload | null;
  daysLeft: number | null;
  valid: boolean;
  setLicense: (payload: ElectronLicensePayload | null, daysLeft: number | null) => void;
  clear: () => void;
}

export const useElectronLicenseStore = create<ElectronLicenseState>((set) => ({
  payload: null,
  daysLeft: null,
  valid: false,
  setLicense: (payload, daysLeft) => set({ payload, daysLeft, valid: !!payload }),
  clear: () => set({ payload: null, daysLeft: null, valid: false }),
}));
