/**
 * Storage Health Banner
 * 
 * Shows a warning banner when storage health is critical:
 * - pendingWrites > 500
 * - No successful write in > 3 minutes while pending writes exist
 * - Worker in degraded mode
 * 
 * CRITICAL: This banner is highly visible to field users so they know
 * to stop the survey and export data immediately when storage fails.
 */

import { useState, useEffect } from 'react';
import { AlertTriangle, Database, X } from 'lucide-react';
import { 
  getStorageHealthTracker, 
  type StorageHealth, 
  type StorageHealthStatus 
} from '../lib/survey/storageHealth';

interface StorageHealthBannerProps {
  onExportClick?: () => void;
}

const StorageHealthBanner: React.FC<StorageHealthBannerProps> = ({ onExportClick }) => {
  const [health, setHealth] = useState<StorageHealth | null>(null);
  const [status, setStatus] = useState<StorageHealthStatus>('healthy');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const tracker = getStorageHealthTracker();
    
    const unsubscribe = tracker.subscribe((newHealth, newStatus) => {
      setHealth(newHealth);
      setStatus(newStatus);
      
      // Reset dismissed state when status changes to critical
      if (newStatus === 'critical') {
        setDismissed(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Only show banner for critical or warning status
  if (status === 'healthy' || dismissed) {
    return null;
  }

  const tracker = getStorageHealthTracker();
  const message = tracker.getStatusMessage();

  if (!message) {
    return null;
  }

  const isCritical = status === 'critical';

  return (
    <div 
      className={`fixed top-0 left-0 right-0 z-[100] ${
        isCritical 
          ? 'bg-red-600 text-white' 
          : 'bg-yellow-600 text-white'
      } py-2 px-4 shadow-lg`}
      data-testid="banner-storage-health"
    >
      <div className="container mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          {isCritical ? (
            <AlertTriangle className="w-5 h-5 flex-shrink-0 animate-pulse" />
          ) : (
            <Database className="w-5 h-5 flex-shrink-0" />
          )}
          <span className="font-medium text-sm md:text-base">
            {message}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Export button for critical state */}
          {isCritical && onExportClick && (
            <button
              onClick={onExportClick}
              className="px-3 py-1 bg-white text-red-600 rounded-md text-sm font-medium hover:bg-red-100 transition-colors"
              data-testid="button-export-emergency"
            >
              Export Now
            </button>
          )}

          {/* Stats display */}
          {health && (
            <div className="hidden md:flex items-center gap-2 text-xs opacity-80">
              <span>Pending: {health.pendingWrites}</span>
              {health.lastSuccessfulWriteAt && (
                <span>
                  Last save: {Math.round((Date.now() - health.lastSuccessfulWriteAt) / 1000)}s ago
                </span>
              )}
            </div>
          )}

          {/* Dismiss button (only for warning, not critical) */}
          {!isCritical && (
            <button
              onClick={() => setDismissed(true)}
              className="p-1 hover:bg-black/10 rounded transition-colors"
              title="Dismiss (banner will reappear if issue persists)"
              data-testid="button-dismiss-storage-warning"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default StorageHealthBanner;
