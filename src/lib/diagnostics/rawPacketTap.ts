/**
 * Raw Packet Tap for GNSS Diagnostics
 * Provides ring buffer storage for raw GNSS packets and export functionality
 */

export interface RawGnssPacket {
  timestamp: string;
  receivedAt: string;
  raw: Record<string, unknown>;
  source: 'duro' | 'usb' | 'browser' | 'unknown';
  nmea?: string[];
}

export interface AltitudeCandidate {
  field: string;
  value: number | null;
  type: 'msl' | 'ellipsoid' | 'geoid_separation' | 'ambiguous';
}

export interface AltitudeSummary {
  mslExplicit: number | null;
  ellipsoidHeight: number | null;
  geoidSeparation: number | null;
  mslDerived: number | null;
  selectedAltitude: number | null;
  status: 'msl_explicit' | 'msl_derived' | 'ambiguous';
  candidates: AltitudeCandidate[];
}

const ALTITUDE_KEYWORDS = [
  'alt', 'altitude', 'height', 'msl', 'ellipsoid', 'geoid',
  'undulation', 'geoidsep', 'separation', 'egm', 'ortho'
];

class RawPacketTap {
  private buffer: RawGnssPacket[] = [];
  private maxSize: number = 100;
  private enabled: boolean = true;
  private subscribers: Set<(packets: RawGnssPacket[]) => void> = new Set();

  setMaxSize(size: number) {
    this.maxSize = Math.max(10, Math.min(500, size));
    this.trim();
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.buffer = [];
      this.notifySubscribers();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  addPacket(packet: Omit<RawGnssPacket, 'receivedAt'>) {
    if (!this.enabled) return;

    const fullPacket: RawGnssPacket = {
      ...packet,
      receivedAt: new Date().toISOString(),
    };

    this.buffer.push(fullPacket);
    this.trim();
    this.notifySubscribers();
  }

  private trim() {
    while (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }

  getPackets(count?: number): RawGnssPacket[] {
    const n = count || this.buffer.length;
    return this.buffer.slice(-n);
  }

  getLatest(): RawGnssPacket | null {
    return this.buffer[this.buffer.length - 1] || null;
  }

  subscribe(callback: (packets: RawGnssPacket[]) => void): () => void {
    this.subscribers.add(callback);
    callback(this.buffer);
    return () => this.subscribers.delete(callback);
  }

  private notifySubscribers() {
    this.subscribers.forEach(cb => cb([...this.buffer]));
  }

  clear() {
    this.buffer = [];
    this.notifySubscribers();
  }

  analyzeAltitudeFields(packet: RawGnssPacket): AltitudeSummary {
    const candidates: AltitudeCandidate[] = [];
    let mslExplicit: number | null = null;
    let ellipsoidHeight: number | null = null;
    let geoidSeparation: number | null = null;

    const findAltitudeFields = (obj: Record<string, unknown>, prefix = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        const keyLower = key.toLowerCase();

        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          findAltitudeFields(value as Record<string, unknown>, fullKey);
          continue;
        }

        const isAltitudeField = ALTITUDE_KEYWORDS.some(kw => keyLower.includes(kw));
        if (!isAltitudeField) continue;

        const numValue = typeof value === 'number' ? value : null;

        if (keyLower.includes('msl') || keyLower.includes('ortho')) {
          candidates.push({ field: fullKey, value: numValue, type: 'msl' });
          if (numValue !== null) mslExplicit = numValue;
        } else if (keyLower.includes('ellipsoid') || keyLower.includes('height_ellipsoid')) {
          candidates.push({ field: fullKey, value: numValue, type: 'ellipsoid' });
          if (numValue !== null) ellipsoidHeight = numValue;
        } else if (keyLower.includes('geoid') || keyLower.includes('undulation') || keyLower.includes('separation')) {
          candidates.push({ field: fullKey, value: numValue, type: 'geoid_separation' });
          if (numValue !== null) geoidSeparation = numValue;
        } else {
          candidates.push({ field: fullKey, value: numValue, type: 'ambiguous' });
        }
      }
    };

    findAltitudeFields(packet.raw);

    let mslDerived: number | null = null;
    if (ellipsoidHeight !== null && geoidSeparation !== null) {
      mslDerived = ellipsoidHeight - geoidSeparation;
    }

    let status: AltitudeSummary['status'] = 'ambiguous';
    let selectedAltitude: number | null = null;

    if (mslExplicit !== null) {
      status = 'msl_explicit';
      selectedAltitude = mslExplicit;
    } else if (mslDerived !== null) {
      status = 'msl_derived';
      selectedAltitude = mslDerived;
    } else if (candidates.length > 0) {
      const ambiguous = candidates.find(c => c.type === 'ambiguous' && c.value !== null);
      if (ambiguous) selectedAltitude = ambiguous.value;
    }

    return {
      mslExplicit,
      ellipsoidHeight,
      geoidSeparation,
      mslDerived,
      selectedAltitude,
      status,
      candidates,
    };
  }

  exportDiagnostics(metadata: Record<string, unknown> = {}): string {
    const exportData = {
      exportedAt: new Date().toISOString(),
      appVersion: '1.0.0',
      metadata,
      packetCount: this.buffer.length,
      packets: this.buffer,
    };
    return JSON.stringify(exportData, null, 2);
  }

  generateSummary(): string {
    const latest = this.getLatest();
    if (!latest) return 'No GNSS data available';

    const altitude = this.analyzeAltitudeFields(latest);
    const lines = [
      `GNSS Diagnostics Summary`,
      `========================`,
      `Time: ${new Date().toISOString()}`,
      `Source: ${latest.source}`,
      `Packets in buffer: ${this.buffer.length}`,
      ``,
      `Altitude Status: ${altitude.status}`,
      `Selected Altitude: ${altitude.selectedAltitude?.toFixed(2) ?? 'N/A'} m`,
      `MSL Explicit: ${altitude.mslExplicit?.toFixed(2) ?? 'N/A'} m`,
      `MSL Derived: ${altitude.mslDerived?.toFixed(2) ?? 'N/A'} m`,
      `Ellipsoid Height: ${altitude.ellipsoidHeight?.toFixed(2) ?? 'N/A'} m`,
      `Geoid Separation: ${altitude.geoidSeparation?.toFixed(2) ?? 'N/A'} m`,
    ];

    return lines.join('\n');
  }
}

export const rawPacketTap = new RawPacketTap();
