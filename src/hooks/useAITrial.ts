import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '@/lib/config/environment';
import { getCurrentUser } from '../lib/firebase';
import { setTrialState } from '../lib/ai/aiAssistant';

export interface AITrialStatus {
  inTrial: boolean;
  daysRemaining: number;
  daysUsed: number;
  trialDuration: number;
  trialStartedAt: string | null;
  hasTrialKey: boolean;
  loaded: boolean;
}

const DEFAULT: AITrialStatus = {
  inTrial: false,
  daysRemaining: 0,
  daysUsed: 0,
  trialDuration: 45,
  trialStartedAt: null,
  hasTrialKey: false,
  loaded: false,
};

let _cached: AITrialStatus | null = null;

export function useAITrial(): AITrialStatus {
  const [status, setStatus] = useState<AITrialStatus>(_cached ?? DEFAULT);

  const fetchTrialStatus = useCallback(async () => {
    const user = getCurrentUser();
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/ai/trial-status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json() as {
        inTrial: boolean;
        daysRemaining: number;
        daysUsed: number;
        trialDuration: number;
        trialKey: string | null;
        trialStartedAt: string;
      };

      setTrialState(data.trialKey, data.daysRemaining, data.inTrial);

      const result: AITrialStatus = {
        inTrial: data.inTrial,
        daysRemaining: data.daysRemaining,
        daysUsed: data.daysUsed,
        trialDuration: data.trialDuration,
        trialStartedAt: data.trialStartedAt,
        hasTrialKey: !!data.trialKey,
        loaded: true,
      };
      _cached = result;
      setStatus(result);
    } catch {
      setStatus(prev => ({ ...prev, loaded: true }));
    }
  }, []);

  useEffect(() => {
    if (_cached) {
      setStatus(_cached);
      return;
    }

    const user = getCurrentUser();
    if (user) {
      fetchTrialStatus();
    }

    const handleAuth = () => {
      _cached = null;
      fetchTrialStatus();
    };
    window.addEventListener('auth-state-changed', handleAuth);
    return () => window.removeEventListener('auth-state-changed', handleAuth);
  }, [fetchTrialStatus]);

  return status;
}

export function resetTrialCache() {
  _cached = null;
}
