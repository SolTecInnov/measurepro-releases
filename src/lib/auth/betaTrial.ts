/**
 * Trial Management System
 * 
 * Tracks all user trial periods with:
 * - 7-day standard trial period for ALL new users
 * - Reminder at 2 days before expiration
 * - 1-day grace period after expiration
 * - Server-side validation via Firebase Firestore (server is ALWAYS source of truth)
 * - Admin creates full licence after trial (monthly/annual/custom)
 */

import { isBetaTestAccount } from './masterAdmin';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { getApps } from 'firebase/app';

const TRIAL_DURATION_DAYS = 7;  // 7-day trial for all new users
const REMINDER_DAYS_BEFORE = 2;
const GRACE_PERIOD_DAYS = 1;    // 1 day grace then locked
const BETA_TRIAL_KEY = 'beta_trial_start';
const BETA_TRIALS_COLLECTION = 'beta_trials';

// Permanent beta users - get beta UI without trial limits
const PERMANENT_BETA_USERS: string[] = [
  'chris@novapermits.com',
];

/**
 * Check if email is a permanent beta user (no trial limits)
 */
export function isPermanentBetaUser(email: string | null | undefined): boolean {
  if (!email) return false;
  return PERMANENT_BETA_USERS.some(e => e.toLowerCase() === email.toLowerCase());
}

export interface BetaTrialStatus {
  isInTrial: boolean;
  isInGracePeriod: boolean;
  isExpired: boolean;
  daysRemaining: number;
  totalDays: number;
  startDate: Date | null;
  expirationDate: Date | null;
  graceEndDate: Date | null;
  showReminder: boolean;
  reminderMessage: string;
  awaitingServerSync?: boolean;
}

// Cache for Firebase trial dates to avoid repeated calls
const trialDateCache: Map<string, { date: Date; fetchedAt: number }> = new Map();
const CACHE_TTL_MS = 60000; // 1 minute cache

/**
 * Get the stored trial start date for a beta user from localStorage (cache only)
 */
function getLocalTrialStartDate(email: string): Date | null {
  if (!email) return null;
  
  const key = `${BETA_TRIAL_KEY}_${email.toLowerCase()}`;
  const stored = localStorage.getItem(key);
  
  if (stored) {
    const date = new Date(stored);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  
  return null;
}

/**
 * Save trial start date to localStorage (cache only — not authoritative)
 */
function saveLocalTrialStartDate(email: string, date: Date): void {
  const key = `${BETA_TRIAL_KEY}_${email.toLowerCase()}`;
  localStorage.setItem(key, date.toISOString());
}

/**
 * Get trial start date from Firebase Firestore
 */
async function getFirebaseTrialStartDate(email: string): Promise<Date | null> {
  try {
    const apps = getApps();
    if (apps.length === 0) {
      console.warn('[BetaTrial] Firebase not initialized');
      return null;
    }
    
    const db = getFirestore();
    const docRef = doc(db, BETA_TRIALS_COLLECTION, email.toLowerCase());
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.startDate) {
        const date = data.startDate.toDate ? data.startDate.toDate() : new Date(data.startDate);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('[BetaTrial] Error fetching from Firebase:', error);
    return null;
  }
}

/**
 * Save trial start date to Firebase Firestore
 */
async function saveFirebaseTrialStartDate(email: string, date: Date): Promise<boolean> {
  try {
    const apps = getApps();
    if (apps.length === 0) {
      console.warn('[BetaTrial] Firebase not initialized');
      return false;
    }
    
    const db = getFirestore();
    const docRef = doc(db, BETA_TRIALS_COLLECTION, email.toLowerCase());
    
    await setDoc(docRef, {
      email: email.toLowerCase(),
      startDate: date,
      createdAt: new Date(),
      trialDays: TRIAL_DURATION_DAYS,
      graceDays: GRACE_PERIOD_DAYS
    });
    
    console.log('[BetaTrial] Saved trial start date to Firebase for:', email);
    return true;
  } catch (error) {
    console.error('[BetaTrial] Error saving to Firebase:', error);
    return false;
  }
}

/**
 * Get the stored trial start date for a beta user
 * Priority: Memory cache -> localStorage (local cache from last sync)
 * NOTE: Local cache is only populated after Firebase sync
 */
export function getTrialStartDate(email: string): Date | null {
  if (!email) return null;
  
  const emailLower = email.toLowerCase();
  
  // Check memory cache first
  const cached = trialDateCache.get(emailLower);
  if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL_MS) {
    return cached.date;
  }
  
  // Fall back to localStorage (which is only populated after Firebase sync)
  return getLocalTrialStartDate(email);
}

/**
 * Force sync trial date from Firebase (call on login when online)
 * Firebase is ALWAYS the source of truth.
 * - If Firebase has a date, use it (never allow local to override)
 * - If Firebase has no date AND we're online, initialize a new trial in Firebase
 * - If offline and no local cache, return null (show "connect to activate" message)
 * Returns the authoritative trial start date from Firebase
 */
/**
 * Check if a user needs trial management.
 * ALL users get a 7-day trial — master admins and licensed users are exempt.
 */
export function isTrialUser(email: string | null | undefined): boolean {
  if (!email) return false;
  // Master admins never get trial restrictions
  const { isMasterAdmin } = require('./masterAdmin');
  if (isMasterAdmin(email)) return false;
  return true; // All other users go through trial
}

export async function syncTrialFromFirebase(email: string): Promise<Date | null> {
  if (!email) return null;
  
  try {
    const firebaseDate = await getFirebaseTrialStartDate(email);
    
    if (firebaseDate) {
      // Firebase has a date - update local cache (server is authoritative)
      saveLocalTrialStartDate(email, firebaseDate);
      trialDateCache.set(email.toLowerCase(), { date: firebaseDate, fetchedAt: Date.now() });
      console.log('[BetaTrial] Loaded trial date from Firebase:', email, firebaseDate.toISOString());
      return firebaseDate;
    } else {
      // No date in Firebase — new user, create trial in Firebase
      const now = new Date();
      const saved = await saveFirebaseTrialStartDate(email, now);
      if (saved) {
        saveLocalTrialStartDate(email, now);
        trialDateCache.set(email.toLowerCase(), { date: now, fetchedAt: Date.now() });
        return now;
      }
      return null;
    }
  } catch (error) {
    console.error('[BetaTrial] Error syncing from Firebase:', error);
    // DO NOT fall back to local — server is source of truth
    // Return cached value only if we have one from a previous successful sync
    return getLocalTrialStartDate(email);
  }
}

/**
 * Calculate the full beta trial status for a user
 * If no trial start date available and we're potentially offline, show "awaiting sync" state
 */
export function getBetaTrialStatus(email: string | null | undefined): BetaTrialStatus {
  const defaultStatus: BetaTrialStatus = {
    isInTrial: false,
    isInGracePeriod: false,
    isExpired: false,
    daysRemaining: 0,
    totalDays: TRIAL_DURATION_DAYS,
    startDate: null,
    expirationDate: null,
    graceEndDate: null,
    showReminder: false,
    reminderMessage: ''
  };
  
  if (!email || !isTrialUser(email)) {
    return defaultStatus;
  }
  
  // Permanent beta users get unlimited access with beta UI
  if (isPermanentBetaUser(email)) {
    return {
      isInTrial: true,
      isInGracePeriod: false,
      isExpired: false,
      daysRemaining: 999, // Unlimited
      totalDays: 999,
      startDate: null,
      expirationDate: null,
      graceEndDate: null,
      showReminder: false,
      reminderMessage: ''
    };
  }
  
  // Get start date from cache (populated by syncTrialFromFirebase)
  const startDate = getTrialStartDate(email);
  
  // If no start date available, indicate we need server sync
  if (!startDate) {
    return {
      ...defaultStatus,
      awaitingServerSync: true,
      reminderMessage: navigator.onLine 
        ? 'Activating your beta trial...' 
        : 'Connect to the internet to activate your beta trial.',
    };
  }
  
  // Calculate expiration dates
  const expirationDate = new Date(startDate);
  expirationDate.setDate(expirationDate.getDate() + TRIAL_DURATION_DAYS);
  
  const graceEndDate = new Date(expirationDate);
  graceEndDate.setDate(graceEndDate.getDate() + GRACE_PERIOD_DAYS);
  
  const now = new Date();
  
  // Calculate days remaining (can be negative)
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysUntilExpiration = Math.ceil((expirationDate.getTime() - now.getTime()) / msPerDay);
  const daysUntilGraceEnd = Math.ceil((graceEndDate.getTime() - now.getTime()) / msPerDay);
  
  // Determine status
  const isInTrial = now < expirationDate;
  const isInGracePeriod = !isInTrial && now < graceEndDate;
  const isExpired = now >= graceEndDate;
  
  // Calculate days remaining for display
  let daysRemaining: number;
  if (isInTrial) {
    daysRemaining = Math.max(0, daysUntilExpiration);
  } else if (isInGracePeriod) {
    daysRemaining = 0; // Trial ended, in grace period
  } else {
    daysRemaining = 0; // Fully expired
  }
  
  // Determine if reminder should be shown
  const showReminder = isInTrial && daysRemaining <= REMINDER_DAYS_BEFORE;
  
  // Generate appropriate reminder message
  let reminderMessage = '';
  if (isExpired) {
    reminderMessage = 'Your 7-day trial has expired. Contact support@soltecinnovation.com to activate your licence.';
  } else if (isInGracePeriod) {
    reminderMessage = `Trial ended — grace period: ${daysUntilGraceEnd} day${daysUntilGraceEnd !== 1 ? 's' : ''} remaining. Contact support@soltecinnovation.com.`;
  } else if (showReminder) {
    if (daysRemaining === 0) {
      reminderMessage = 'Your 7-day trial expires today! Contact support@soltecinnovation.com to continue.';
    } else if (daysRemaining === 1) {
      reminderMessage = 'Your trial expires tomorrow! Contact support@soltecinnovation.com to activate your licence.';
    } else {
      reminderMessage = `Your trial expires in ${daysRemaining} days. Contact support@soltecinnovation.com to activate your licence.`;
    }
  } else if (isInTrial) {
    reminderMessage = `Free trial: ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining.`;
  }
  
  return {
    isInTrial,
    isInGracePeriod,
    isExpired,
    daysRemaining,
    totalDays: TRIAL_DURATION_DAYS,
    startDate,
    expirationDate,
    graceEndDate,
    showReminder,
    reminderMessage
  };
}

/**
 * Check if beta user can still access the app (trial or grace period active)
 * If no trial date is available and offline, block access
 */
export function canBetaUserAccess(email: string | null | undefined): boolean {
  if (!email || !isTrialUser(email)) {
    return true; // Master admins and exempt users always have access
  }
  
  const status = getBetaTrialStatus(email);
  
  // If awaiting server sync, deny access until server timestamp resolves.
  // This is fail-closed: no local date can be used as a fallback when online.
  // When offline with no local start date, also deny access.
  if (status.awaitingServerSync) {
    return false;
  }
  
  return status.isInTrial || status.isInGracePeriod;
}

/**
 * Get display text for beta trial countdown
 */
export function getBetaTrialDisplayText(status: BetaTrialStatus): string {
  if (status.awaitingServerSync) {
    return 'Syncing...';
  }
  
  if (status.isExpired) {
    return 'Trial Expired';
  }
  
  if (status.isInGracePeriod) {
    const graceRemaining = Math.ceil((status.graceEndDate!.getTime() - new Date().getTime()) / (24 * 60 * 60 * 1000));
    return `Grace: ${graceRemaining}d`;
  }
  
  if (status.isInTrial) {
    // Permanent beta users (999 days) don't show countdown
    if (status.daysRemaining >= 999) {
      return 'BETA';
    }
    return `${status.daysRemaining}d left`;
  }
  
  return '';
}

/**
 * Get color class based on trial status
 */
export function getBetaTrialColorClass(status: BetaTrialStatus): string {
  if (status.isExpired) {
    return 'text-red-500 bg-red-500/20 border-red-500';
  }
  
  if (status.isInGracePeriod) {
    return 'text-orange-500 bg-orange-500/20 border-orange-500';
  }
  
  if (status.showReminder) {
    return 'text-yellow-500 bg-yellow-500/20 border-yellow-500';
  }
  
  return 'text-blue-400 bg-blue-500/20 border-blue-500';
}
