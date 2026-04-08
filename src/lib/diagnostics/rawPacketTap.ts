// Stub — original deleted during orphan cleanup
export interface RawGnssPacket { timestamp: number; sentence: string; type: string; parsed: any; }
export interface AltitudeCandidate { source: string; value: number; confidence: number; }
export interface AltitudeSummary { candidates: AltitudeCandidate[]; bestSource: string | null; }
class RawPacketTap {
  start() {}
  stop() {}
  getPackets(): RawGnssPacket[] { return []; }
  getAltitudeSummary(): AltitudeSummary { return { candidates: [], bestSource: null }; }
  clear() {}
  subscribe(_fn: (p: RawGnssPacket) => void) { return () => {}; }
}
export const rawPacketTap = new RawPacketTap();
