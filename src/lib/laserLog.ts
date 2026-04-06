// Module-level laser log — not Zustand state so it doesn't cause React re-renders.
// Fix 3: Move laserOutput out of Zustand to eliminate per-byte re-renders.
// Throttle: listener notifications fire at most 4 times per second (250 ms interval).

let laserLogBuffer = "";
const laserLogListeners = new Set<() => void>();

let notifyPending = false;

function scheduleNotify() {
  if (notifyPending) return;
  notifyPending = true;
  setTimeout(() => {
    notifyPending = false;
    laserLogListeners.forEach(fn => fn());
  }, 250);
}

export function appendToLaserOutput(line: string) {
  laserLogBuffer += line + "\n";
  const lines = laserLogBuffer.split("\n");
  if (lines.length > 500) {
    laserLogBuffer = lines.slice(lines.length - 500).join("\n");
  }
  scheduleNotify();
}

export function clearLaserOutput() {
  laserLogBuffer = "";
  laserLogListeners.forEach(fn => fn());
}

export function getLaserLog() { return laserLogBuffer; }

export function subscribeLaserLog(fn: () => void) {
  laserLogListeners.add(fn);
  return () => laserLogListeners.delete(fn);
}
