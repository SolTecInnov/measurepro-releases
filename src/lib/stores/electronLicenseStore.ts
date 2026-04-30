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
  isTrial: boolean;
  inGrace: boolean;
  setLicense: (payload: ElectronLicensePayload | null, daysLeft: number | null, isTrial?: boolean, inGrace?: boolean) => void;
  clear: () => void;
}

export const useElectronLicenseStore = create<ElectronLicenseState>((set) => ({
  payload: null,
  daysLeft: null,
  valid: false,
  isTrial: false,
  inGrace: false,
  setLicense: (payload, daysLeft, isTrial = false, inGrace = false) =>
    set({ payload, daysLeft, valid: !!payload, isTrial, inGrace }),
  clear: () => set({ payload: null, daysLeft: null, valid: false, isTrial: false, inGrace: false }),
}));
