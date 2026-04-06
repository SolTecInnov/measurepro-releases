/**
 * AdminCreateLicense
 * Allows admin to create a licence for a user after trial expiry.
 * Supports Monthly, Annual, and Custom duration licences.
 */
import React, { useState } from 'react';
import { getFirestore, doc, setDoc, collection } from 'firebase/firestore';
import { getApps } from 'firebase/app';
import { Key, Calendar, User, CheckCircle, AlertCircle } from 'lucide-react';

type LicenceType = 'monthly' | 'annual' | 'custom';

interface Props {
  onSuccess?: () => void;
}

const LICENCE_DURATIONS: Record<LicenceType, { label: string; days: number | null; description: string }> = {
  monthly:  { label: 'Monthly',  days: 30,   description: '30 days — auto-renewable' },
  annual:   { label: 'Annual',   days: 365,  description: '365 days — best value' },
  custom:   { label: 'Custom',   days: null, description: 'Set exact start and end dates' },
};

export default function AdminCreateLicense({ onSuccess }: Props) {
  const [email, setEmail]             = useState('');
  const [type, setType]               = useState<LicenceType>('monthly');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd]     = useState('');
  const [notes, setNotes]             = useState('');
  const [status, setStatus]           = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage]         = useState('');

  const handleCreate = async () => {
    if (!email.trim()) { setMessage('Email is required'); setStatus('error'); return; }
    if (type === 'custom' && (!customStart || !customEnd)) {
      setMessage('Start and end dates are required for custom licences');
      setStatus('error'); return;
    }

    setStatus('loading');
    setMessage('');

    try {
      const apps = getApps();
      if (apps.length === 0) throw new Error('Firebase not initialized');

      const db = getFirestore();
      const now = new Date();

      let startDate: Date;
      let endDate: Date;

      if (type === 'custom') {
        startDate = new Date(customStart);
        endDate   = new Date(customEnd);
      } else {
        startDate = now;
        endDate   = new Date(now);
        endDate.setDate(endDate.getDate() + LICENCE_DURATIONS[type].days!);
      }

      const licenceId = `licence_${email.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;

      // Create licence in Firestore
      await setDoc(doc(db, 'user_licences', licenceId), {
        id:           licenceId,
        userEmail:    email.toLowerCase().trim(),
        licenceType:  type,
        startDate:    startDate.toISOString(),
        expiresAt:    endDate.toISOString(),
        isActive:     true,
        createdAt:    now.toISOString(),
        createdBy:    'admin',
        notes:        notes.trim() || null,
        daysTotal:    Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
      });

      // Also reset/clear any trial block in beta_trials so user gets fresh access
      await setDoc(doc(db, 'beta_trials', email.toLowerCase().trim()), {
        email:           email.toLowerCase().trim(),
        hasActiveLicence: true,
        licenceId:       licenceId,
        updatedAt:       now.toISOString(),
      }, { merge: true });

      setStatus('success');
      setMessage(`✅ Licence created for ${email} — expires ${endDate.toLocaleDateString('en-CA')}`);
      setEmail(''); setNotes(''); setCustomStart(''); setCustomEnd('');
      onSuccess?.();

    } catch (e: any) {
      setStatus('error');
      setMessage(`Error: ${e.message}`);
    }
  };

  const selectedDuration = LICENCE_DURATIONS[type];

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-purple-600/20 rounded-lg">
          <Key className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h3 className="text-white font-semibold">Create User Licence</h3>
          <p className="text-gray-400 text-sm">Issue a paid licence after trial expiry</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Email */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">User Email</label>
          <div className="flex items-center gap-2 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 focus-within:border-purple-500 transition-colors">
            <User className="w-4 h-4 text-gray-500 shrink-0" />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="bg-transparent text-white placeholder-gray-500 outline-none flex-1 text-sm"
            />
          </div>
        </div>

        {/* Licence Type */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">Licence Type</label>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(LICENCE_DURATIONS) as LicenceType[]).map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                  type === t
                    ? 'border-purple-500 bg-purple-600/20 text-white'
                    : 'border-gray-600 bg-gray-700/50 text-gray-400 hover:border-gray-500'
                }`}
              >
                <div className="font-semibold">{LICENCE_DURATIONS[t].label}</div>
                <div className="text-xs opacity-70 mt-0.5">{LICENCE_DURATIONS[t].description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Custom date range */}
        {type === 'custom' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Start Date</label>
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">End Date</label>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-purple-500"
              />
            </div>
          </div>
        )}

        {/* Preview */}
        {type !== 'custom' && (
          <div className="bg-gray-700/40 rounded-lg px-4 py-3 flex items-center gap-3">
            <Calendar className="w-4 h-4 text-blue-400 shrink-0" />
            <div className="text-sm text-gray-300">
              Starts today — expires <strong className="text-white">
                {new Date(Date.now() + LICENCE_DURATIONS[type].days! * 86400000).toLocaleDateString('en-CA')}
              </strong>
              <span className="text-gray-500 ml-2">({LICENCE_DURATIONS[type].days} days)</span>
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Notes (optional)</label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Monthly subscription — invoice #1234"
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm outline-none focus:border-purple-500"
          />
        </div>

        {/* Status message */}
        {message && (
          <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
            status === 'success' ? 'bg-green-900/30 border border-green-700 text-green-300' :
            status === 'error'   ? 'bg-red-900/30 border border-red-700 text-red-300' : ''
          }`}>
            {status === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            {message}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleCreate}
          disabled={status === 'loading'}
          className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {status === 'loading' ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating licence...</>
          ) : (
            <><Key className="w-4 h-4" /> Create Licence</>
          )}
        </button>
      </div>
    </div>
  );
}
