/**
 * TrialLockout
 * Shown when a user's 7-day trial has expired and no active licence exists.
 * Prompts them to contact support to activate a paid licence.
 */
import { useEffect, useState } from 'react';
import { Lock, Mail, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import { isMasterAdmin } from '@/lib/auth/masterAdmin';
import { syncTrialFromFirebase, getBetaTrialStatus } from '@/lib/auth/betaTrial';
import { checkAndSendTrialNotifications } from '@/lib/auth/trialNotifications';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getApps } from 'firebase/app';

export function TrialLockout() {
  const { user, isMasterAdmin: cachedIsMasterAdmin } = useAuth();
  const [locked, setLocked]     = useState(false);
  const [checking, setChecking] = useState(true);
  const [daysExpired, setDaysExpired] = useState(0);

  useEffect(() => {
    if (!user?.email) { setChecking(false); return; }
    if (cachedIsMasterAdmin || isMasterAdmin(user.email)) { setChecking(false); return; }

    const check = async () => {
      try {
        // 1. Check if user has an active paid licence in user_licences collection
        const apps = getApps();
        if (apps.length > 0) {
          const db = getFirestore();
          const email = user.email!.toLowerCase();

          // Check user_licences collection for active licence
          const licenceDoc = await getDoc(doc(db, 'user_licences_by_email', email));
          if (licenceDoc.exists()) {
            const data = licenceDoc.data();
            if (data.isActive && data.expiresAt) {
              const expiry = new Date(data.expiresAt);
              if (expiry > new Date()) {
                setLocked(false);
                setChecking(false);
                return; // Has valid paid licence
              }
            }
          }

          // Also check beta_trials for hasActiveLicence flag
          const trialDoc = await getDoc(doc(db, 'beta_trials', email));
          if (trialDoc.exists() && trialDoc.data().hasActiveLicence) {
            setLocked(false);
            setChecking(false);
            return;
          }
        }

        // 2. Check trial status
        await syncTrialFromFirebase(user.email!);
        const status = getBetaTrialStatus(user.email);

        // Send notifications regardless of locked state
        await checkAndSendTrialNotifications(
          user.email!,
          status.daysRemaining,
          status.isExpired,
          status.isInGracePeriod,
        );

        if (status.isExpired) {
          const msPerDay = 1000 * 60 * 60 * 24;
          const expired = Math.round((new Date().getTime() - (status.graceEndDate?.getTime() ?? 0)) / msPerDay);
          setDaysExpired(Math.max(0, expired));
          setLocked(true);
        }
      } catch (e) {
        // If we can't check, don't lock — fail open
        console.warn('[TrialLockout] Check failed, allowing access:', e);
      } finally {
        setChecking(false);
      }
    };

    check();
  }, [user?.email, cachedIsMasterAdmin]);

  if (checking || !locked) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-900 rounded-2xl border border-red-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-red-700 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <Lock className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">Trial Expired</h2>
              <p className="text-red-200 text-sm">Your 7-day free trial has ended</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-4">
          <p className="text-gray-300 text-sm leading-relaxed">
            Your MeasurePRO trial period has expired
            {daysExpired > 0 && <span className="text-red-400 font-medium"> {daysExpired} day{daysExpired !== 1 ? 's' : ''} ago</span>}.
            To continue using MeasurePRO, contact us to activate a paid licence.
          </p>

          <div className="bg-gray-800 rounded-xl p-4 space-y-3">
            <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">Available Plans</p>
            <div className="space-y-2">
              {[
                { label: 'Monthly', desc: 'Flexible month-to-month', color: 'text-blue-400' },
                { label: 'Annual', desc: 'Best value — save 20%', color: 'text-green-400' },
                { label: 'Custom', desc: 'Enterprise or project-based', color: 'text-purple-400' },
              ].map(plan => (
                <div key={plan.label} className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full bg-current ${plan.color}`} />
                  <div>
                    <span className={`text-sm font-medium ${plan.color}`}>{plan.label}</span>
                    <span className="text-gray-500 text-sm ml-2">— {plan.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Contact CTA */}
          <a
            href="mailto:support@soltecinnovation.com?subject=MeasurePRO%20Licence%20Request&body=Hello%2C%0A%0AI%20would%20like%20to%20activate%20a%20MeasurePRO%20licence%20for%20my%20account%3A%20"
            className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl transition-colors"
          >
            <Mail className="w-4 h-4" />
            Contact support@soltecinnovation.com
          </a>

          <button
            onClick={() => window.location.reload()}
            className="flex items-center justify-center gap-2 w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium py-2.5 rounded-xl transition-colors text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            I have a licence — refresh
          </button>
        </div>
      </div>
    </div>
  );
}
