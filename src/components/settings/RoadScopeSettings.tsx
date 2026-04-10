/**
 * RoadScope Integration Settings
 * Configure API key and sync settings for RoadScope
 */

import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '@/lib/config/environment';
import { useAuth } from '../../lib/auth/AuthContext';
import { getRoadScopeClient } from '../../lib/roadscope/client';
import { startRoadScopeAutoSyncTimer, stopRoadScopeAutoSyncTimer } from '../../lib/roadscope/autoSync';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Cloud,
  Key,
  Check,
  X,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Shield,
  Loader2,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';

interface RoadScopeSettingsData {
  hasApiKey: boolean;
  apiKey: string | null;
  apiKeyValidated: boolean;
  apiKeyScopes: string[] | null;
  apiKeyExpiresAt: string | null;
  autoSyncEnabled: boolean;
  syncInterval: number; // MINUTES (was seconds in pre-v16.1.19 builds)
  lastSyncAt: string | null;
}

// Auto-sync interval choices in MINUTES
const INTERVAL_OPTIONS = [
  { value: 30, label: 'Every 30 minutes' },
  { value: 60, label: 'Every hour' },
  { value: 120, label: 'Every 2 hours' },
  { value: 240, label: 'Every 4 hours' },
];
const DEFAULT_INTERVAL_MIN = 60;

export function RoadScopeSettings() {
  const { user, cachedUserData } = useAuth();
  const [settings, setSettings] = useState<RoadScopeSettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  
  // Form state
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [autoSync, setAutoSync] = useState(false);
  const [syncInterval, setSyncInterval] = useState(DEFAULT_INTERVAL_MIN); // MINUTES
  
  // Validation state
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    scopes?: string[];
    missingScopes?: string[];
    expiresAt?: string;
    error?: string;
  } | null>(null);

  const userId = user?.uid || localStorage.getItem('current_user_id');
  const userEmail = user?.email || cachedUserData?.email || '';

  // Fetch settings
  const fetchSettings = useCallback(async () => {
    if (!userId) return;
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/roadscope/settings/${userId}`);
      const json = await res.json();
      
      if (json.success && json.data) {
        setSettings(json.data);
        setAutoSync(json.data.autoSyncEnabled ?? false);
        // Migrate legacy values: pre-v16.1.19 stored seconds (30-600). Anything
        // smaller than the smallest minute option (30) is stale, replace with default.
        const stored = json.data.syncInterval;
        const intervalMinutes =
          typeof stored === 'number' && INTERVAL_OPTIONS.some((opt) => opt.value === stored)
            ? stored
            : DEFAULT_INTERVAL_MIN;
        setSyncInterval(intervalMinutes);
      }
    } catch (error) {
      console.error('[RoadScope] Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Validate API key
  const handleValidateKey = async () => {
    const trimmedKey = apiKeyInput.trim();
    
    if (!trimmedKey) {
      toast.error('Please enter an API key');
      return;
    }

    console.log('[RoadScope] Validating key:', { length: trimmedKey.length, startsWithMpro: trimmedKey.startsWith('mpro_') });

    // Basic format validation: mpro_ (5 chars) + 64 hex characters = 69 total
    if (!trimmedKey.startsWith('mpro_') || trimmedKey.length !== 69) {
      setValidationResult({
        valid: false,
        error: `Invalid format. Key length: ${trimmedKey.length}, expected: 69. Must start with mpro_.`
      });
      return;
    }

    setValidating(true);
    setValidationResult(null);

    try {
      // Actually validate against RoadScope API
      const client = getRoadScopeClient();
      const result = await client.validateApiKey(trimmedKey);

      if (result.valid) {
        // Key is valid — save it
        client.setApiKey(trimmedKey);
        await handleSaveKey();
        setValidationResult({
          valid: true,
          scopes: result.scopes,
          missingScopes: result.missingScopes,
          expiresAt: result.expiresAt
        });
        toast.success('API key validated and saved');
      } else {
        // API validation failed — still save key but mark as not validated
        // (might be a proxy/network issue, key could still be valid)
        await handleSaveKey();
        setValidationResult({
          valid: false,
          error: result.error || 'Could not validate API key with RoadScope server. Key saved — will retry on next sync.'
        });
      }
    } catch (error) {
      setValidationResult({
        valid: false,
        error: 'Failed to validate API key. Check your internet connection.'
      });
    } finally {
      setValidating(false);
    }
  };

  // Save API key
  const handleSaveKey = async () => {
    if (!userId || !userEmail) return;

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/roadscope/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          userEmail,
          apiKey: apiKeyInput.trim(),
          autoSyncEnabled: autoSync,
          syncInterval
        })
      });

      const json = await res.json();
      
      if (json.success) {
        // Update validation status
        if (validationResult?.valid) {
          await fetch(`${API_BASE_URL}/api/roadscope/settings/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              valid: true,
              scopes: validationResult.scopes,
              expiresAt: validationResult.expiresAt
            })
          });
        }

        await fetchSettings();
        setApiKeyInput('');
        // toast suppressed
      } else {
        toast.error(json.error || 'Failed to save API key');
      }
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // Save settings (without key change). Accepts overrides so toggle handlers
  // can save the NEW value before React state has flushed.
  const handleSaveSettings = async (overrides?: { autoSyncEnabled?: boolean; syncInterval?: number }) => {
    if (!userId || !userEmail) return;

    const nextAutoSync = overrides?.autoSyncEnabled ?? autoSync;
    const nextInterval = overrides?.syncInterval ?? syncInterval;

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/roadscope/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          userEmail,
          autoSyncEnabled: nextAutoSync,
          syncInterval: nextInterval
        })
      });

      const json = await res.json();

      if (json.success) {
        await fetchSettings();
        // Drive the timer immediately so the user doesn't have to restart the app
        if (nextAutoSync) {
          startRoadScopeAutoSyncTimer(userId).catch((err) => {
            console.error('[RoadScopeSettings] Failed to start auto-sync timer:', err);
          });
        } else {
          stopRoadScopeAutoSyncTimer();
        }
      } else {
        toast.error(json.error || 'Failed to save settings');
      }
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // Delete API key
  const handleDeleteKey = async () => {
    if (!userId) return;
    
    if (!confirm('Are you sure you want to remove your RoadScope API key?')) {
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/roadscope/settings/${userId}/key`, {
        method: 'DELETE'
      });

      const json = await res.json();
      
      if (json.success) {
        setValidationResult(null);
        await fetchSettings();
        // toast suppressed
      } else {
        toast.error(json.error || 'Failed to remove API key');
      }
    } catch (error) {
      toast.error('Failed to remove API key');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Cloud className="w-5 h-5 text-blue-400" />
            RoadScope Integration
          </CardTitle>
          <CardDescription className="text-gray-400">
            Sync your survey data to RoadScope for advanced analysis and reporting
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* API Key Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm font-medium text-white">
                <Key className="w-4 h-4 text-gray-400" />
                API Key
              </label>
              {settings?.hasApiKey && settings?.apiKeyValidated && (
                <span className="flex items-center gap-1 text-xs text-green-400">
                  <Check className="w-3 h-3" />
                  Validated
                </span>
              )}
            </div>

            {settings?.hasApiKey ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 bg-gray-900 rounded border border-gray-700 text-gray-400 font-mono text-sm">
                    {settings.apiKey}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeleteKey}
                    disabled={saving}
                    className="border-red-600/50 text-red-400 hover:bg-red-600/20"
                    data-testid="button-delete-api-key"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                {settings.apiKeyScopes && (
                  <div className="flex flex-wrap gap-1">
                    {settings.apiKeyScopes.map((scope) => (
                      <span
                        key={scope}
                        className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 rounded"
                      >
                        {scope}
                      </span>
                    ))}
                  </div>
                )}

                {settings.apiKeyExpiresAt && (
                  <p className="text-xs text-gray-500">
                    Expires: {new Date(settings.apiKeyExpiresAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder="mpro_..."
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    className="font-mono bg-gray-900 border-gray-700"
                    data-testid="input-roadscope-api-key"
                  />
                  <Button
                    onClick={handleValidateKey}
                    disabled={validating || !apiKeyInput.trim()}
                    className="min-w-[120px]"
                    data-testid="button-validate-api-key"
                  >
                    {validating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Validating
                      </>
                    ) : (
                      <>
                        <Shield className="w-4 h-4 mr-2" />
                        Validate
                      </>
                    )}
                  </Button>
                </div>

                {/* Validation result */}
                {validationResult && (
                  <div className={`p-3 rounded-lg border ${
                    validationResult.valid
                      ? 'bg-green-900/20 border-green-600/30'
                      : 'bg-red-900/20 border-red-600/30'
                  }`}>
                    <div className="flex items-start gap-2">
                      {validationResult.valid ? (
                        <Check className="w-4 h-4 text-green-400 mt-0.5" />
                      ) : (
                        <X className="w-4 h-4 text-red-400 mt-0.5" />
                      )}
                      <div className="flex-1">
                        {validationResult.valid ? (
                          <>
                            <p className="text-sm text-green-400">API key validated successfully!</p>
                            {validationResult.scopes && (
                              <p className="text-xs text-gray-400 mt-1">
                                Scopes: {validationResult.scopes.join(', ')}
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="text-sm text-red-400">{validationResult.error}</p>
                        )}
                        
                        {validationResult.missingScopes && validationResult.missingScopes.length > 0 && (
                          <div className="mt-2 p-2 bg-yellow-900/20 rounded">
                            <p className="text-xs text-yellow-400 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Missing scopes: {validationResult.missingScopes.join(', ')}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <p className="text-xs text-gray-500">
                  Get your API key from{' '}
                  <a
                    href="https://roadscope.app/admin/measurepro-api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline inline-flex items-center gap-1"
                  >
                    RoadScope Admin
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-gray-700" />

          {/* Auto-sync */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-white flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-gray-400" />
                  Auto-sync to RoadScope
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Periodically push new POIs and photos so the office team can start working mid-day.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={autoSync}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const next = e.target.checked;
                    setAutoSync(next);
                    handleSaveSettings({ autoSyncEnabled: next });
                  }}
                  // Only require that a key EXISTS — the apiKeyValidated flag
                  // is informational and may be stale even when the key works.
                  // If the key turns out to be invalid at sync time, the auto-sync
                  // logger silently logs the failure and skips the next interval.
                  disabled={!settings?.hasApiKey}
                  className="sr-only peer"
                  data-testid="checkbox-auto-sync"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50"></div>
              </label>
            </div>

            {autoSync && (
              <>
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-400 flex-shrink-0">Interval:</label>
                  <select
                    value={syncInterval}
                    onChange={(e) => {
                      const next = parseInt(e.target.value, 10);
                      setSyncInterval(next);
                      handleSaveSettings({ syncInterval: next });
                    }}
                    className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    data-testid="select-sync-interval"
                  >
                    {INTERVAL_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-900/20 border border-yellow-700/40 text-xs text-yellow-200">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>
                    Auto-sync uploads photos at every interval. Can use significant cellular data —
                    recommended only on Wi-Fi or unlimited connections (Starlink, in-vehicle Wi-Fi).
                  </span>
                </div>
              </>
            )}

            {settings?.lastSyncAt && (
              <p className="text-xs text-gray-500">
                Last sync: {new Date(settings.lastSyncAt).toLocaleString()}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default RoadScopeSettings;
