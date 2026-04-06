/**
 * Beta Trial Badge Component
 * 
 * Displays remaining days for beta users with visual alerts
 * for expiration warnings and grace period.
 */

import { Clock, AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import { getBetaTrialStatus, getBetaTrialDisplayText, getBetaTrialColorClass, syncTrialFromFirebase, type BetaTrialStatus } from '../lib/auth/betaTrial';
import { useEffect, useState } from 'react';

interface BetaTrialBadgeProps {
  email: string | null | undefined;
}

export function BetaTrialBadge({ email }: BetaTrialBadgeProps) {
  const [status, setStatus] = useState<BetaTrialStatus | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [hasSynced, setHasSynced] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (email) {
      // Get initial status from local cache
      const trialStatus = getBetaTrialStatus(email);
      setStatus(trialStatus);
      
      // Sync with Firebase in background (only once per session)
      if (!hasSynced) {
        setIsSyncing(true);
        syncTrialFromFirebase(email).then(() => {
          // After sync, get updated status
          const updatedStatus = getBetaTrialStatus(email);
          setStatus(updatedStatus);
          setHasSynced(true);
        }).catch(err => {
          console.error('[BetaTrialBadge] Firebase sync failed:', err);
        }).finally(() => {
          setIsSyncing(false);
        });
      }
    }
  }, [email, hasSynced]);

  // If awaiting server sync and still syncing, show a minimal spinner badge
  if (status?.awaitingServerSync && isSyncing) {
    return (
      <div
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium bg-gray-100 border-gray-300 text-gray-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400"
        data-testid="badge-beta-syncing"
        title="Connecting to server to verify trial status..."
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span>Beta: connecting...</span>
      </div>
    );
  }

  if (!status || (!status.isInTrial && !status.isInGracePeriod && !status.isExpired && !status.awaitingServerSync)) {
    return null;
  }

  const displayText = getBetaTrialDisplayText(status);
  const colorClass = getBetaTrialColorClass(status);

  const getIcon = () => {
    if (status.isExpired) {
      return <XCircle className="w-3.5 h-3.5" />;
    }
    if (status.isInGracePeriod || status.showReminder) {
      return <AlertTriangle className="w-3.5 h-3.5" />;
    }
    return <Clock className="w-3.5 h-3.5" />;
  };

  return (
    <div 
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div 
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium ${colorClass} ${
          status.isInGracePeriod || status.showReminder ? 'animate-pulse' : ''
        }`}
        data-testid="badge-beta-trial"
      >
        {getIcon()}
        <span>Beta: {displayText}</span>
      </div>

      {showTooltip && (
        <div 
          className="absolute top-full mt-2 left-0 z-50 p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-xl min-w-[280px]"
          data-testid="tooltip-beta-trial"
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              {getIcon()}
              <span>Beta Trial Status</span>
            </div>
            
            <div className="text-sm text-gray-300">
              {status.reminderMessage}
            </div>

            <div className="border-t border-gray-700 pt-2 mt-2 space-y-1 text-xs text-gray-400">
              {status.startDate && (
                <div className="flex justify-between">
                  <span>Started:</span>
                  <span>{status.startDate.toLocaleDateString()}</span>
                </div>
              )}
              {status.expirationDate && (
                <div className="flex justify-between">
                  <span>Expires:</span>
                  <span>{status.expirationDate.toLocaleDateString()}</span>
                </div>
              )}
              {status.isInGracePeriod && status.graceEndDate && (
                <div className="flex justify-between text-orange-400">
                  <span>Grace ends:</span>
                  <span>{status.graceEndDate.toLocaleDateString()}</span>
                </div>
              )}
            </div>

            {(status.showReminder || status.isInGracePeriod || status.isExpired) && (
              <div className="border-t border-gray-700 pt-2 mt-2">
                <a 
                  href="mailto:sales@soltec.ca?subject=MeasurePRO%20Beta%20Upgrade"
                  className="block w-full text-center px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
                  data-testid="link-contact-sales"
                >
                  Contact Sales to Upgrade
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
