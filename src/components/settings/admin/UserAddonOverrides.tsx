import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Plus, X, ShieldCheck, Clock, User, Search, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { queryClient } from '../../../lib/queryClient';
import { authedRequest } from '../../../lib/authedFetch';
import type { MemberAddonOverride } from '../../../../shared/schema';
import { ADDON_DISPLAY_NAMES } from '../../../../shared/schema';
import { getSafeAuth } from '../../../lib/firebase';

const ADDON_OPTIONS = Object.entries(ADDON_DISPLAY_NAMES).map(([id, label]) => ({ id, label }));

const EXPIRY_PRESETS = [
  { label: '14 days', days: 14 },
  { label: '30 days', days: 30 },
  { label: '3 months', days: 90 },
  { label: '6 months', days: 180 },
  { label: '12 months', days: 365 },
];

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

function daysUntil(iso: string): number {
  const now = new Date();
  const exp = new Date(iso);
  return Math.max(0, Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

const UserAddonOverrides: React.FC = () => {
  const [showGrantForm, setShowGrantForm] = useState(false);
  const [filterEmail, setFilterEmail] = useState('');

  const [grantEmail, setGrantEmail] = useState('');
  const [grantUid, setGrantUid] = useState('');
  const [grantName, setGrantName] = useState('');
  const [grantAddon, setGrantAddon] = useState('');
  const [grantExpiryPreset, setGrantExpiryPreset] = useState<number | null>(30);
  const [grantCustomDate, setGrantCustomDate] = useState('');
  const [grantReason, setGrantReason] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupResults, setLookupResults] = useState<{ uid: string; email: string; displayName: string }[]>([]);

  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState('');

  const { data, isLoading, refetch } = useQuery<{ success: boolean; overrides: MemberAddonOverride[] }>({
    queryKey: ['/api/addon-overrides'],
    queryFn: () => authedRequest<{ success: boolean; overrides: MemberAddonOverride[] }>('/api/addon-overrides'),
  });

  const overrides = data?.overrides ?? [];

  const filteredOverrides = filterEmail.trim()
    ? overrides.filter(o =>
        o.userEmail.toLowerCase().includes(filterEmail.toLowerCase()) ||
        (o.userName ?? '').toLowerCase().includes(filterEmail.toLowerCase())
      )
    : overrides;

  const handleLookupUser = async () => {
    if (!grantEmail.trim()) {
      setLookupError('Enter an email or name to search');
      return;
    }
    setLookupLoading(true);
    setLookupError(null);
    setGrantUid('');
    setGrantName('');
    setLookupResults([]);
    try {
      // Firestore direct lookup by email
      const { getApp } = await import('firebase/app');
      const { getFirestore, collection, getDocs, query, where } = await import('firebase/firestore');
      const db = getFirestore(getApp());
      const snap = await getDocs(query(collection(db, 'users'), where('email', '==', grantEmail.trim())));
      const users = snap.docs.map(d => {
        const data = d.data();
        return { uid: data.firebaseUid || d.id, email: data.email, displayName: data.fullName || data.firstName || data.email };
      });
      if (users.length === 1) {
        setGrantUid(users[0].uid);
        setGrantName(users[0].displayName || users[0].email);
        setGrantEmail(users[0].email);
      } else if (users.length > 1) {
        setLookupResults(users);
      } else {
        throw new Error('No user found with that email');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'User not found';
      setLookupError(msg);
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSelectLookupResult = (user: { uid: string; email: string; displayName: string }) => {
    setGrantUid(user.uid);
    setGrantName(user.displayName || user.email);
    setGrantEmail(user.email);
    setLookupResults([]);
  };

  const grantMutation = useMutation({
    mutationFn: async () => {
      const auth = getSafeAuth();
      const currentUser = auth?.currentUser;
      const expiresAt = grantExpiryPreset !== null
        ? new Date(Date.now() + grantExpiryPreset * 24 * 60 * 60 * 1000).toISOString()
        : new Date(grantCustomDate + 'T23:59:59').toISOString();

      return authedRequest<{ success: boolean; override: MemberAddonOverride }>('/api/addon-overrides', {
        method: 'POST',
        body: JSON.stringify({
          userId: grantUid,
          userEmail: grantEmail.trim(),
          userName: grantName || null,
          addonKey: grantAddon,
          grantedByName: currentUser?.displayName || currentUser?.email || 'Administrator',
          reason: grantReason.trim(),
          expiresAt,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/addon-overrides'] });
      setShowGrantForm(false);
      setGrantEmail('');
      setGrantUid('');
      setGrantName('');
      setGrantAddon('');
      setGrantExpiryPreset(30);
      setGrantCustomDate('');
      setGrantReason('');
      setLookupError(null);
      setLookupResults([]);
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to grant override'),
  });

  const revokeMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
      authedRequest<{ success: boolean }>(`/api/addon-overrides/${id}/revoke`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/addon-overrides'] });
      setRevokeId(null);
      setRevokeReason('');
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to revoke override'),
  });

  const handleGrant = () => {
    if (!grantUid) { toast.error('Look up a user first'); return; }
    if (!grantAddon) { toast.error('Select an add-on'); return; }
    if (!grantReason.trim()) { toast.error('A reason is required'); return; }
    if (grantExpiryPreset === null) {
      if (!grantCustomDate) { toast.error('Select an expiry date'); return; }
      const d = new Date(grantCustomDate + 'T23:59:59');
      if (d <= new Date()) { toast.error('Expiry date must be in the future'); return; }
    }
    grantMutation.mutate();
  };

  const handleRevoke = () => {
    if (!revokeId) return;
    if (!revokeReason.trim()) { toast.error('A revocation reason is required'); return; }
    revokeMutation.mutate({ id: revokeId, reason: revokeReason.trim() });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-lg font-semibold text-gray-100">User Add-on Overrides</h3>
        <button
          onClick={() => setShowGrantForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-sm"
          data-testid="button-grant-addon-override"
        >
          <Plus className="w-4 h-4" />
          Grant Override
        </button>
      </div>

      <p className="text-sm text-gray-400">
        Grant individual users temporary access to paid add-ons independently of their company's subscriptions.
        Overrides expire automatically and send email notifications to the user and their company admins.
      </p>

      {/* Grant Form */}
      {showGrantForm && (
        <div className="bg-gray-800 border border-gray-600 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-gray-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              Grant New Add-on Override
            </h4>
            <button onClick={() => setShowGrantForm(false)} className="text-gray-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* User lookup */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">User Email or Name</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={grantEmail}
                onChange={e => { setGrantEmail(e.target.value); setGrantUid(''); setGrantName(''); setLookupResults([]); }}
                onKeyDown={e => e.key === 'Enter' && handleLookupUser()}
                placeholder="user@example.com or John Doe"
                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
                data-testid="input-override-user-email"
              />
              <button
                onClick={handleLookupUser}
                disabled={lookupLoading}
                className="flex items-center gap-1.5 px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg text-sm transition-colors disabled:opacity-50"
                data-testid="button-lookup-override-user"
              >
                {lookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Search
              </button>
            </div>
            {lookupError && <p className="text-red-400 text-xs mt-1">{lookupError}</p>}
            {lookupResults.length > 1 && (
              <ul className="mt-2 bg-gray-700 border border-gray-600 rounded-lg overflow-hidden divide-y divide-gray-600" data-testid="list-lookup-results">
                {lookupResults.map(u => (
                  <li key={u.uid}>
                    <button
                      onClick={() => handleSelectLookupResult(u)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-600 transition-colors text-sm"
                      data-testid={`item-lookup-result-${u.uid}`}
                    >
                      <span className="text-white font-medium">{u.displayName || u.email}</span>
                      {u.displayName && <span className="text-gray-400 ml-2 text-xs">{u.email}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {grantUid && (
              <div className="mt-2 flex items-center gap-2 text-xs text-green-400">
                <CheckCircle className="w-3.5 h-3.5" />
                Selected: {grantName || grantEmail} (UID: {grantUid.slice(0, 12)}…)
              </div>
            )}
          </div>

          {/* Add-on selection */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Add-on</label>
            <select
              value={grantAddon}
              onChange={e => setGrantAddon(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              data-testid="select-override-addon"
            >
              <option value="">Select an add-on…</option>
              {ADDON_OPTIONS.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Expiry */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Expiry</label>
            <div className="flex flex-wrap gap-2">
              {EXPIRY_PRESETS.map(preset => (
                <button
                  key={preset.days}
                  onClick={() => { setGrantExpiryPreset(preset.days); setGrantCustomDate(''); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    grantExpiryPreset === preset.days
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                  data-testid={`button-expiry-${preset.days}`}
                >
                  {preset.label}
                </button>
              ))}
              <button
                onClick={() => setGrantExpiryPreset(null)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  grantExpiryPreset === null
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
                data-testid="button-expiry-custom"
              >
                Custom
              </button>
            </div>
            {grantExpiryPreset !== null && (
              <p className="text-xs text-gray-500 mt-1">
                Expires: {formatDate(addDays(grantExpiryPreset))}
              </p>
            )}
            {grantExpiryPreset === null && (
              <input
                type="date"
                value={grantCustomDate}
                onChange={e => setGrantCustomDate(e.target.value)}
                min={addDays(1)}
                className="mt-2 w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                data-testid="input-override-custom-date"
              />
            )}
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Reason / Comment <span className="text-red-400">*</span></label>
            <textarea
              value={grantReason}
              onChange={e => setGrantReason(e.target.value)}
              rows={2}
              placeholder="Why is this override being granted?"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
              data-testid="textarea-override-reason"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowGrantForm(false)}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleGrant}
              disabled={grantMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors disabled:opacity-50"
              data-testid="button-confirm-grant-override"
            >
              {grantMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Grant Override
            </button>
          </div>
        </div>
      )}

      {/* Search filter */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={filterEmail}
          onChange={e => setFilterEmail(e.target.value)}
          placeholder="Filter by user email or name…"
          className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
          data-testid="input-filter-overrides"
        />
      </div>

      {/* Overrides list */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-gray-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading overrides…
          </div>
        ) : filteredOverrides.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            {filterEmail ? 'No overrides match your filter.' : 'No add-on overrides have been granted yet.'}
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {filteredOverrides.map(override => {
              const addonLabel = ADDON_DISPLAY_NAMES[override.addonKey] || override.addonKey;
              const remaining = daysUntil(override.expiresAt);
              const isExpiredOrRevoked = !override.isActive || remaining === 0;

              return (
                <div
                  key={override.id}
                  className={`p-4 flex items-start justify-between gap-4 ${isExpiredOrRevoked ? 'opacity-50' : ''}`}
                  data-testid={`row-override-${override.id}`}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                        override.isActive && remaining > 0
                          ? 'bg-blue-900/40 text-blue-300'
                          : override.revokedAt
                          ? 'bg-red-900/40 text-red-300'
                          : 'bg-gray-700 text-gray-400'
                      }`}>
                        <ShieldCheck className="w-3 h-3" />
                        {addonLabel}
                      </span>
                      {override.isActive && remaining > 0 ? (
                        <span className="text-xs text-green-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {remaining}d remaining (expires {formatDate(override.expiresAt)})
                        </span>
                      ) : override.revokedAt ? (
                        <span className="text-xs text-red-400">Revoked {formatDate(override.revokedAt)}</span>
                      ) : (
                        <span className="text-xs text-gray-500">Expired {formatDate(override.expiresAt)}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-gray-200">
                      <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span data-testid={`text-override-user-${override.id}`}>
                        {override.userName ? `${override.userName} (${override.userEmail})` : override.userEmail}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      Granted by {override.grantedByName || override.grantedByUid} on {formatDate(override.grantedAt)}
                    </p>
                    <p className="text-xs text-gray-500 italic">Reason: {override.reason}</p>
                    {override.revokedReason && (
                      <p className="text-xs text-red-400 italic">Revocation reason: {override.revokedReason}</p>
                    )}
                  </div>

                  {override.isActive && remaining > 0 && (
                    <button
                      onClick={() => { setRevokeId(override.id); setRevokeReason(''); }}
                      className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 bg-red-900/30 hover:bg-red-900/60 text-red-400 hover:text-red-300 rounded-lg text-xs transition-colors"
                      data-testid={`button-revoke-override-${override.id}`}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Revoke
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Revoke modal */}
      {revokeId && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-600 rounded-xl p-6 w-full max-w-md space-y-4">
            <h4 className="font-semibold text-gray-100 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-400" />
              Revoke Add-on Override
            </h4>
            <p className="text-sm text-gray-400">
              This will immediately revoke access to the add-on for this user. An email will be sent notifying them.
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Revocation Reason <span className="text-red-400">*</span></label>
              <textarea
                value={revokeReason}
                onChange={e => setRevokeReason(e.target.value)}
                rows={2}
                placeholder="Why is this override being revoked?"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                data-testid="textarea-revoke-reason"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setRevokeId(null); setRevokeReason(''); }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                data-testid="button-cancel-revoke"
              >
                Cancel
              </button>
              <button
                onClick={handleRevoke}
                disabled={revokeMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm transition-colors disabled:opacity-50"
                data-testid="button-confirm-revoke"
              >
                {revokeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Revoke Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserAddonOverrides;
