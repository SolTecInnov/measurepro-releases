/**
 * DriveModeBadge — persistent floating exit badge shown when Drive Mode is on.
 *
 * Triple-tap (3 taps within 800ms) to exit. The exit gesture is intentionally
 * deliberate — a single button press is too easy to trigger accidentally in
 * a moving vehicle, but triple-tapping the same target is hard to do by accident.
 *
 * The badge sits in the top-right corner with high z-index so it's always
 * visible regardless of what's underneath.
 */

import { useRef, useState } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { useDriveModeStore } from '../lib/stores/driveModeStore';

const TRIPLE_TAP_WINDOW_MS = 800;
const REQUIRED_TAPS = 3;

export function DriveModeBadge() {
  const enabled = useDriveModeStore((s) => s.enabled);
  const setEnabled = useDriveModeStore((s) => s.setEnabled);

  const tapTimestamps = useRef<number[]>([]);
  const [tapsRemaining, setTapsRemaining] = useState<number | null>(null);
  const tapsResetTimer = useRef<number | null>(null);

  if (!enabled) return null;

  const handleTap = () => {
    const now = Date.now();
    // Drop any taps that fell outside the window
    tapTimestamps.current = tapTimestamps.current.filter((t) => now - t < TRIPLE_TAP_WINDOW_MS);
    tapTimestamps.current.push(now);

    if (tapTimestamps.current.length >= REQUIRED_TAPS) {
      // Triple-tap completed → unlock
      tapTimestamps.current = [];
      setTapsRemaining(null);
      if (tapsResetTimer.current) {
        window.clearTimeout(tapsResetTimer.current);
        tapsResetTimer.current = null;
      }
      setEnabled(false);
      return;
    }

    // Show progress hint and auto-reset after the window expires
    setTapsRemaining(REQUIRED_TAPS - tapTimestamps.current.length);
    if (tapsResetTimer.current) window.clearTimeout(tapsResetTimer.current);
    tapsResetTimer.current = window.setTimeout(() => {
      tapTimestamps.current = [];
      setTapsRemaining(null);
      tapsResetTimer.current = null;
    }, TRIPLE_TAP_WINDOW_MS);
  };

  return (
    <button
      onClick={handleTap}
      data-testid="drive-mode-badge"
      className="fixed top-3 right-3 z-[9999] flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-600/95 hover:bg-amber-500 text-white text-xs font-semibold shadow-lg border border-amber-400/40 select-none"
      title="Triple-tap to exit Drive Mode"
    >
      {tapsRemaining !== null && tapsRemaining > 0 ? (
        <>
          <Unlock className="w-4 h-4 animate-pulse" />
          <span>{tapsRemaining} more tap{tapsRemaining > 1 ? 's' : ''}…</span>
        </>
      ) : (
        <>
          <Lock className="w-4 h-4" />
          <span>DRIVE MODE • triple-tap to exit</span>
        </>
      )}
    </button>
  );
}

export default DriveModeBadge;
