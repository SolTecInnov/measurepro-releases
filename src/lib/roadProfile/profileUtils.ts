/**
 * Shared utilities for GNSS profile display and orphan detection.
 * Centralised here to avoid divergence between RoadProfile.tsx and SurveyProfiles.tsx.
 */

/**
 * Returns true when a raw IndexedDB profile record is a phantom / orphan that
 * should not be shown in the library and can be safely deleted.
 *
 * Phantom criteria (any one is sufficient):
 *  - end is null / falsy
 *  - end date parses to before year 2000 (epoch-zero guard)
 *  - both distance and sample count are zero (across all known field shapes)
 */
export function isPhantomProfile(p: any): boolean {
  if (!p.end) return true;
  const endDate = new Date(p.end);
  if (endDate.getFullYear() < 2000) return true;
  const totalDistance =
    p.summary?.totalDistance_m ?? p.totalDistance_m ?? 0;
  const totalSamples =
    (p.points?.length ?? 0) +
    (p.summary?.totalSamples ?? 0) +
    (p.totalSamples ?? 0);
  if (totalDistance === 0 && totalSamples === 0) return true;
  return false;
}

/**
 * Returns a human-readable display label for a profile record.
 * Avoids the "Profile profile-" anti-pattern by using a date-based fallback.
 */
export function getProfileDisplayLabel(p: any): string {
  if (p.label) return p.label;
  const startDate = new Date(
    p.start || p.startTime || p.created_at || p.start_timestamp
  );
  if (startDate.getFullYear() > 2000) {
    return `Session ${startDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}`;
  }
  const id: string = p.id || '';
  const idFrag = id.startsWith('profile-')
    ? id.substring('profile-'.length, 'profile-'.length + 8)
    : id.substring(0, 8);
  return `Session ${idFrag}`;
}
