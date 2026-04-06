/**
 * Swift Duro TCP Client
 * Connects to Swift Navigation Duro GNSS receiver via TCP/IP (Ethernet)
 * Auto-reconnects with exponential backoff
 * Parses NMEA sentences and broadcasts GNSS samples
 */

import { Socket } from 'net';
import { EventEmitter } from 'events';
import { gnssConfig } from './config.js';
import { gnssConfigService } from './configService.js';
import { parseNmeaSentence, mergeNmeaData, validateNmeaChecksum } from './nmeaParser.js';
import { RawGnssSample, NmeaParseResult, CorrectionType } from './types.js';

export interface DuroClientEvents {
  'sample': (sample: RawGnssSample) => void;
  'connected': () => void;
  'disconnected': (error?: Error) => void;
  'error': (error: Error) => void;
  'rawData': (data: string) => void;
}

// Live data cache for /api/gnss/live endpoint
export interface LiveGnssData {
  success: boolean;
  connection: {
    connected: boolean;
    host: string;
    port: number;
    uptimeSec: number;
    totalSamples: number;
  };
  position: {
    timestamp: number;
    lat: number;
    lon: number;
    altitude: number;
    fixQuality: number;
    satellites: number;
    hdop?: number;
    raw: string;
  } | null;
  dop: {
    pdop: number | null;
    hdop: number | null;
    vdop: number | null;
    activePrns: number[];
    gsaMode: number | null;
    constellations: Record<string, { name: string; activePrns: number[] }>;
  } | null;
  satellitesInView: {
    count: number;
    satellites: Array<{
      prn: number;
      elevation: number | undefined;
      azimuth: number | undefined;
      snr: number | undefined;
    }>;
  } | null;
  imu: {
    timestamp: number;
    heading: number | null;
    roll: number | null;
    pitch: number | null;
    heaveRate: number | null;
    rollAccuracy?: number | null;
    pitchAccuracy?: number | null;
    headingAccuracy?: number | null;
    variant?: string;
  } | null;
  velocity: {
    timestamp: number;
    speedKnots: number | null;
    speedMps: number | null;
    speedKph: number | null;
    heading: number | null;
  } | null;
  sentences: {
    bufferSize: number;
    counts: Record<string, number>;
    recent: Array<{ timestamp: number; raw: string; type: string }>;
  };
}

export class DuroClient extends EventEmitter {
  private socket: Socket | null = null;
  private connected = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectDelay = gnssConfig.duroReconnectDelay_ms;
  private reconnectAttempts = 0;
  private buffer = '';
  private nmeaCache: NmeaParseResult[] = [];
  private cacheTimeout: NodeJS.Timeout | null = null;
  private startTime: number | null = null;
  private samplesReceived = 0;
  
  // Live data cache for real-time access
  private latestPosition: LiveGnssData['position'] = null;
  private latestDop: LiveGnssData['dop'] = null;
  private latestSatellitesInView: LiveGnssData['satellitesInView'] = null;
  private latestImu: LiveGnssData['imu'] = null;
  private latestVelocity: LiveGnssData['velocity'] = null;
  private sentenceCounts: Record<string, number> = {};
  private recentSentences: Array<{ timestamp: number; raw: string; type: string }> = [];

  private static readonly BUFFER_MAX_BYTES = 64 * 1024; // 64 KB

  constructor() {
    super();
  }

  /**
   * Connect to Duro via TCP
   * Uses configService for host/port when available, falls back to gnssConfig
   */
  connect(): void {
    if (this.connected || this.socket) {
      console.log('[Duro] Already connected or connecting');
      return;
    }

    // Try to use new config service, fall back to legacy config
    let host: string;
    let port: number;
    
    try {
      const newConfig = gnssConfigService.getConfig();
      if (newConfig.enabled) {
        host = newConfig.host;
        port = gnssConfigService.getActivePort();
      } else {
        host = gnssConfig.duroTcpHost;
        port = gnssConfig.duroTcpPort;
      }
    } catch {
      host = gnssConfig.duroTcpHost;
      port = gnssConfig.duroTcpPort;
    }

    console.log(`[Duro] Connecting to ${host}:${port}...`);

    this.socket = new Socket();

    this.socket.on('connect', () => {
      this.connected = true;
      this.reconnectDelay = gnssConfig.duroReconnectDelay_ms;
      this.reconnectAttempts = 0;
      this.startTime = Date.now();
      console.log(`[Duro] ✅ Connected to ${host}:${port}`);
      this.emit('connected');
    });

    this.socket.on('data', (data) => {
      this.handleData(data.toString());
    });

    this.socket.on('error', (error) => {
      console.error('[Duro] Socket error:', error.message);
      this.emit('error', error);
    });

    this.socket.on('close', () => {
      this.connected = false;
      const wasConnected = this.socket !== null;
      this.socket = null;
      console.log('[Duro] Connection closed');
      this.emit('disconnected');

      if (wasConnected) {
        this.scheduleReconnect();
      }
    });

    this.socket.connect(port, host);
  }

  /**
   * Disconnect from Duro
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }

    this.connected = false;
    console.log('[Duro] Disconnected');
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    this.reconnectAttempts++;
    console.log(`[Duro] Reconnecting in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts})...`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectDelay);

    // Exponential backoff
    this.reconnectDelay = Math.min(
      this.reconnectDelay * gnssConfig.duroReconnectBackoffMultiplier,
      gnssConfig.duroReconnectMaxDelay_ms
    );
  }

  /**
   * Handle incoming TCP data
   */
  private handleData(data: string): void {
    this.buffer += data;
    this.emit('rawData', data);

    // Process complete lines (NMEA sentences) first
    let newlineIndex;
    while ((newlineIndex = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.substring(0, newlineIndex).trim();
      this.buffer = this.buffer.substring(newlineIndex + 1);

      if (line.startsWith('$')) {
        this.processNmeaSentence(line);
      }
    }

    // Buffer safety: if remaining partial data (no newline) exceeds 64 KB,
    // it's a corrupt stream — reset to prevent unbounded growth
    if (this.buffer.length > DuroClient.BUFFER_MAX_BYTES) {
      console.warn(`[Duro] Buffer tail exceeded ${DuroClient.BUFFER_MAX_BYTES} bytes without a newline — resetting buffer (possible corrupt stream)`);
      this.buffer = '';
    }
  }

  /**
   * Process a single NMEA sentence
   */
  private processNmeaSentence(sentence: string): void {
    // Track all sentences for diagnostics FIRST (before any filtering)
    const sentenceType = sentence.substring(1, 6);
    this.trackSentence(sentence, sentenceType);

    // Validate checksum if present
    if (sentence.includes('*')) {
      if (!validateNmeaChecksum(sentence)) {
        console.warn('[Duro] Invalid checksum:', sentence);
        return;
      }
    }

    const result = parseNmeaSentence(sentence);

    if (result.valid) {
      // Add to cache for merging
      this.nmeaCache.push(result);

      // Clear cache timer
      if (this.cacheTimeout) {
        clearTimeout(this.cacheTimeout);
      }

      // Process cache after 100ms (allows GGA + RMC + GST to accumulate)
      this.cacheTimeout = setTimeout(() => {
        this.processCachedNmea();
      }, 100);
    }
  }

  /**
   * Merge cached NMEA sentences and emit unified GNSS sample
   */
  private processCachedNmea(): void {
    if (this.nmeaCache.length === 0) return;

    const merged = mergeNmeaData(this.nmeaCache);
    const now = Date.now();

    // Check if we have any GGA or RMC data (even without valid fix)
    const hasPositionData = this.nmeaCache.some(c => c.type === 'GGA' || c.type === 'RMC');
    
    const fixQualityMap: Record<string, number> = {
      'none': 0, 'gps': 1, 'dgps': 2, 'pps': 3, 'rtk_fixed': 4, 'rtk_float': 5, 'estimated': 6
    };

    // Always update position cache when we have GGA/RMC data, even if coords are 0
    if (hasPositionData) {
      this.latestPosition = {
        timestamp: now,
        lat: merged.latitude || 0,
        lon: merged.longitude || 0,
        altitude: merged.altitude || 0,
        fixQuality: fixQualityMap[merged.quality || 'none'] || 0,
        satellites: merged.numSats || 0,
        hdop: merged.hdop,
        raw: this.nmeaCache.map(c => c.raw).join('|')
      };

      // Only emit sample if we have valid coordinates (for logging/storage)
      if (merged.latitude && merged.longitude) {
        const sample: RawGnssSample = {
          timestamp: merged.timestamp?.toISOString() || new Date().toISOString(),
          latitude: merged.latitude,
          longitude: merged.longitude,
          altitude: merged.altitude || null,
          speed: merged.speed || null,
          heading: merged.heading || null,
          quality: merged.quality || 'none',
          hdop: merged.hdop || null,
          num_sats: merged.numSats || null,
          source: 'duro',
          correctionType: this.inferCorrectionType(merged.quality),
          correctionAge_s: merged.correctionAge || null,
          geoidHeight_m: merged.geoidHeight || null,
          stdDev_m: merged.stdDev || null,
          // GSA-sourced DOP fields
          pdop: merged.pdop ?? null,
          vdop: merged.vdop ?? null,
          gsaMode: merged.gsaMode ?? null,
        };

        this.samplesReceived++;
        this.emit('sample', sample);
      }
    }

    // Update IMU cache if we have attitude data
    if (merged.roll !== undefined || merged.pitch !== undefined || merged.heading !== undefined) {
      this.latestImu = {
        timestamp: now,
        heading: merged.heading ?? null,
        roll: merged.roll ?? null,
        pitch: merged.pitch ?? null,
        heaveRate: merged.heaveRate ?? null,
        rollAccuracy: merged.rollAccuracy ?? null,
        pitchAccuracy: merged.pitchAccuracy ?? null,
        headingAccuracy: merged.headingAccuracy ?? null,
        variant: 'PASHR'
      };
    }

    // Update DOP cache from GSA data - build per-constellation map from all GSA results
    const gsaResults = this.nmeaCache.filter(c => c.type === 'GSA' && c.valid);
    if (gsaResults.length > 0) {
      const constellationMap: Record<string, { name: string; activePrns: number[] }> = {};
      const talkerConstellationNames: Record<string, string> = {
        GP: 'GPS', GL: 'GLONASS', GA: 'Galileo', GB: 'BeiDou', GN: 'Multi-GNSS'
      };

      for (const gsaResult of gsaResults) {
        const talkerId = gsaResult.data.gsaTalkerId;
        if (talkerId && gsaResult.data.activeSatellitePrns) {
          constellationMap[talkerId] = {
            name: talkerConstellationNames[talkerId] ?? talkerId,
            activePrns: gsaResult.data.activeSatellitePrns,
          };
        }
      }

      // Aggregate all active PRNs across constellations
      const allActivePrns = Object.values(constellationMap).flatMap(c => c.activePrns);

      this.latestDop = {
        pdop: merged.pdop ?? null,
        hdop: merged.hdop ?? null,
        vdop: merged.vdop ?? null,
        activePrns: allActivePrns,
        gsaMode: merged.gsaMode ?? null,
        constellations: constellationMap,
      };
    } else if (merged.pdop !== undefined || merged.hdop !== undefined || merged.vdop !== undefined) {
      // Have DOP data but no talker-attributed GSA results
      this.latestDop = {
        pdop: merged.pdop ?? null,
        hdop: merged.hdop ?? null,
        vdop: merged.vdop ?? null,
        activePrns: merged.activeSatellitePrns ?? [],
        gsaMode: merged.gsaMode ?? null,
        constellations: {},
      };
    }

    // Update satellites-in-view cache from GSV data
    if (merged.satellites !== undefined) {
      this.latestSatellitesInView = {
        count: merged.satellitesInView ?? merged.satellites.length,
        satellites: merged.satellites,
      };
    }

    // Update velocity cache
    if (merged.speed !== undefined) {
      const speedMps = merged.speed || 0;
      this.latestVelocity = {
        timestamp: now,
        speedKnots: speedMps * 1.94384,
        speedMps: speedMps,
        speedKph: speedMps * 3.6,
        heading: merged.heading ?? null
      };
    }

    // Clear cache
    this.nmeaCache = [];
  }

  /**
   * Infer correction type from NMEA quality indicator
   */
  private inferCorrectionType(quality: any): CorrectionType {
    switch (quality) {
      case 'rtk_fixed':
      case 'rtk_float':
        return 'rtk';
      case 'pps':
        return 'ppp';
      case 'dgps':
        return 'sbas';
      default:
        return 'none';
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      connected: this.connected,
      tcp_host: gnssConfig.duroTcpHost,
      tcp_port: gnssConfig.duroTcpPort,
      uptime_s: this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : undefined,
      samples_received: this.samplesReceived,
      reconnect_attempts: this.reconnectAttempts,
    };
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get live GNSS data for /api/gnss/live endpoint
   * Returns the latest cached position, IMU, velocity, and sentence data
   */
  getLiveData(): LiveGnssData {
    const config = gnssConfigService.getConfig();
    const activePort = gnssConfigService.getActivePort();
    
    return {
      success: true,
      connection: {
        connected: this.connected,
        host: config.host || gnssConfig.duroTcpHost,
        port: activePort || gnssConfig.duroTcpPort,
        uptimeSec: this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
        totalSamples: this.samplesReceived
      },
      position: this.latestPosition,
      dop: this.latestDop,
      satellitesInView: this.latestSatellitesInView,
      imu: this.latestImu,
      velocity: this.latestVelocity,
      sentences: {
        bufferSize: this.buffer.length,
        counts: this.sentenceCounts,
        recent: this.recentSentences.slice(-10)
      }
    };
  }

  /**
   * Track sentence for diagnostics
   */
  private trackSentence(raw: string, type: string): void {
    const now = Date.now();
    this.sentenceCounts[type] = (this.sentenceCounts[type] || 0) + 1;
    this.recentSentences.push({ timestamp: now, raw, type });
    // Keep only last 50 sentences
    if (this.recentSentences.length > 50) {
      this.recentSentences = this.recentSentences.slice(-50);
    }
  }
}

// Global singleton instance
export const duroClient = new DuroClient();
