/**
 * NMEA Sentence Parser
 * Parses NMEA 0183 sentences from Swift Duro and other GPS receivers
 * Supports: GGA, RMC, GST, GSA, GSV, VTG, PASHR (attitude)
 * 
 * PASHR sentence format (proprietary attitude):
 * $PASHR,hhmmss.ss,heading,T,roll,pitch,heave,roll_accuracy,pitch_accuracy,heading_accuracy,GPS_quality,INS_status*hh
 */

import { NmeaParseResult, FixQuality, InsMode } from './types.js';

/**
 * Convert NMEA coordinate format (ddmm.mmmm) to decimal degrees
 */
function nmeaToDecimal(coord: string, direction: string): number {
  if (!coord || !direction) return 0;
  
  const degrees = parseFloat(coord.substring(0, coord.indexOf('.') - 2));
  const minutes = parseFloat(coord.substring(coord.indexOf('.') - 2));
  let decimal = degrees + (minutes / 60);
  
  if (direction === 'S' || direction === 'W') {
    decimal *= -1;
  }
  
  return decimal;
}

/**
 * Convert NMEA time (hhmmss.sss) to Date object
 * Combines with current date (assumes same-day fix)
 */
function nmeaTimeToDate(timeStr: string, dateStr?: string): Date | undefined {
  if (!timeStr || timeStr.length < 6) return undefined;
  
  const hours = parseInt(timeStr.substring(0, 2), 10);
  const minutes = parseInt(timeStr.substring(2, 4), 10);
  const seconds = parseFloat(timeStr.substring(4));
  
  const now = new Date();
  
  // If date provided (DDMMYY from RMC), use it
  if (dateStr && dateStr.length === 6) {
    const day = parseInt(dateStr.substring(0, 2), 10);
    const month = parseInt(dateStr.substring(2, 4), 10) - 1; // JS months are 0-indexed
    const year = 2000 + parseInt(dateStr.substring(4, 6), 10);
    
    const date = new Date(Date.UTC(year, month, day, hours, minutes, Math.floor(seconds)));
    return date;
  }
  
  // Otherwise use current date
  const date = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    hours,
    minutes,
    Math.floor(seconds)
  ));
  
  return date;
}

/**
 * Map NMEA quality indicator to FixQuality
 */
function mapQualityIndicator(q: string): FixQuality {
  switch (q) {
    case '0': return 'none';
    case '1': return 'gps';
    case '2': return 'dgps';
    case '3': return 'pps';
    case '4': return 'rtk_fixed';
    case '5': return 'rtk_float';
    case '6': return 'estimated';
    case '7': return 'manual';
    default: return 'none';
  }
}

/**
 * Parse NMEA GGA sentence (Global Positioning System Fix Data)
 * $GPGGA,hhmmss.ss,llll.ll,a,yyyyy.yy,a,x,xx,x.x,x.x,M,x.x,M,x.x,xxxx*hh
 */
function parseGGA(sentence: string): NmeaParseResult {
  const parts = sentence.split(',');
  
  if (parts[0] !== '$GPGGA' && parts[0] !== '$GNGGA') {
    return { type: 'unknown', raw: sentence, data: {}, valid: false, error: 'Not a GGA sentence' };
  }
  
  try {
    const time = parts[1];
    const lat = nmeaToDecimal(parts[2], parts[3]);
    const lon = nmeaToDecimal(parts[4], parts[5]);
    const quality = mapQualityIndicator(parts[6]);
    const numSats = parts[7] ? parseInt(parts[7], 10) : undefined;
    const hdop = parts[8] ? parseFloat(parts[8]) : undefined;
    const alt = parts[9] ? parseFloat(parts[9]) : undefined;
    const geoidHeight = parts[11] ? parseFloat(parts[11]) : undefined;
    const correctionAge = parts[13] ? parseFloat(parts[13]) : undefined;
    
    return {
      type: 'GGA',
      raw: sentence,
      data: {
        timestamp: nmeaTimeToDate(time),
        latitude: lat,
        longitude: lon,
        altitude: alt,
        quality,
        numSats,
        hdop,
        geoidHeight,
        correctionAge,
      },
      // Accept GGA even with 0,0 coords - quality indicator tells us if it's a valid fix
      // quality 'none' (0) means no fix, but sentence is still valid NMEA
      valid: true,
    };
  } catch (error: any) {
    return { type: 'GGA', raw: sentence, data: {}, valid: false, error: error.message };
  }
}

/**
 * Parse NMEA RMC sentence (Recommended Minimum Navigation Information)
 * $GPRMC,hhmmss.ss,A,llll.ll,a,yyyyy.yy,a,x.x,x.x,ddmmyy,x.x,a*hh
 */
function parseRMC(sentence: string): NmeaParseResult {
  const parts = sentence.split(',');
  
  if (parts[0] !== '$GPRMC' && parts[0] !== '$GNRMC') {
    return { type: 'unknown', raw: sentence, data: {}, valid: false, error: 'Not an RMC sentence' };
  }
  
  try {
    const time = parts[1];
    const status = parts[2]; // A = valid, V = invalid
    const lat = nmeaToDecimal(parts[3], parts[4]);
    const lon = nmeaToDecimal(parts[5], parts[6]);
    const speedKnots = parts[7] ? parseFloat(parts[7]) : undefined;
    const heading = parts[8] ? parseFloat(parts[8]) : undefined;
    const date = parts[9];
    
    // Convert knots to m/s (1 knot = 0.514444 m/s)
    const speedMps = speedKnots !== undefined ? speedKnots * 0.514444 : undefined;
    
    return {
      type: 'RMC',
      raw: sentence,
      data: {
        timestamp: nmeaTimeToDate(time, date),
        latitude: lat,
        longitude: lon,
        speed: speedMps,
        heading,
      },
      // Accept RMC even if no fix - status 'V' means void/invalid but sentence is still valid NMEA
      // Only mark as valid if we have actual position data (status === 'A' means active/valid)
      valid: status === 'A',
    };
  } catch (error: any) {
    return { type: 'RMC', raw: sentence, data: {}, valid: false, error: error.message };
  }
}

/**
 * Parse NMEA GST sentence (GNSS Pseudorange Error Statistics)
 * $GPGST,hhmmss.ss,x.x,x.x,x.x,x.x,x.x,x.x,x.x*hh
 * Provides position error estimates (standard deviation)
 */
function parseGST(sentence: string): NmeaParseResult {
  const parts = sentence.split(',');
  
  if (parts[0] !== '$GPGST' && parts[0] !== '$GNGST') {
    return { type: 'unknown', raw: sentence, data: {}, valid: false, error: 'Not a GST sentence' };
  }
  
  try {
    const time = parts[1];
    const rmsStdDev = parts[2] ? parseFloat(parts[2]) : undefined;
    const stdDevLat = parts[6] ? parseFloat(parts[6]) : undefined;
    const stdDevLon = parts[7] ? parseFloat(parts[7]) : undefined;
    const stdDevAlt = parts[8] ? parseFloat(parts[8].split('*')[0]) : undefined;
    
    return {
      type: 'GST',
      raw: sentence,
      data: {
        timestamp: nmeaTimeToDate(time),
        stdDevLat,
        stdDevLon,
        stdDevAlt,
      },
      valid: true,
    };
  } catch (error: any) {
    return { type: 'GST', raw: sentence, data: {}, valid: false, error: error.message };
  }
}

/**
 * Map INS status code to InsMode
 */
function mapInsStatus(status: string): InsMode {
  switch (status) {
    case '0': return 'inactive';
    case '1': return 'aligning';
    case '2': return 'degraded';
    case '3': return 'ready';
    case '4': return 'rtk_aided';
    case '5': return 'standalone';
    default: return 'inactive';
  }
}

/**
 * Safely parse a float, returning undefined for invalid/NaN values
 */
function safeParseFloat(value: string | undefined | null): number | undefined {
  if (!value || value.trim() === '') return undefined;
  const cleaned = value.split('*')[0].trim(); // Remove checksum if present
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : undefined;
}

/**
 * Parse PASHR sentence (Proprietary Attitude Heading Roll)
 * Common format used by many INS/GNSS receivers
 * $PASHR,hhmmss.ss,heading,T,roll,pitch,heave,roll_acc,pitch_acc,head_acc,quality,INS_status*hh
 * 
 * Some variants:
 * $PASHR,ATT,heading,roll,pitch,heave_rate*hh (simpler format)
 */
function parsePASHR(sentence: string): NmeaParseResult {
  const parts = sentence.split(',');
  
  if (!parts[0].includes('PASHR')) {
    return { type: 'unknown', raw: sentence, data: {}, valid: false, error: 'Not a PASHR sentence' };
  }
  
  // Minimum field count validation
  if (parts.length < 5) {
    return { type: 'PASHR', raw: sentence, data: {}, valid: false, error: 'Insufficient PASHR fields' };
  }
  
  try {
    // Check for ATT variant
    if (parts[1] === 'ATT') {
      // $PASHR,ATT,heading,roll,pitch,heave_rate*hh
      const heading = safeParseFloat(parts[2]);
      const roll = safeParseFloat(parts[3]);
      const pitch = safeParseFloat(parts[4]);
      const heaveRate = safeParseFloat(parts[5]);
      
      // Validate we have at least roll and pitch
      const isValid = roll !== undefined && pitch !== undefined && 
                      Math.abs(roll) <= 180 && Math.abs(pitch) <= 90;
      
      return {
        type: 'PASHR',
        raw: sentence,
        data: {
          yaw: heading !== undefined && heading >= 0 && heading < 360 ? heading : undefined,
          roll,
          pitch,
          heaveRate,
        },
        valid: isValid,
      };
    }
    
    // Standard PASHR format - validate field count
    if (parts.length < 10) {
      return { type: 'PASHR', raw: sentence, data: {}, valid: false, error: 'Insufficient standard PASHR fields' };
    }
    
    const time = parts[1];
    const heading = safeParseFloat(parts[2]);
    // parts[3] is 'T' for true heading
    const roll = safeParseFloat(parts[4]);
    const pitch = safeParseFloat(parts[5]);
    const heaveRate = safeParseFloat(parts[6]);
    const rollAccuracy = safeParseFloat(parts[7]);
    const pitchAccuracy = safeParseFloat(parts[8]);
    const headingAccuracy = safeParseFloat(parts[9]);
    // parts[10] is GPS quality
    const insStatusRaw = parts[11] ? parts[11].split('*')[0].trim() : undefined;
    const insMode = insStatusRaw && insStatusRaw !== '' ? mapInsStatus(insStatusRaw) : undefined;
    
    // Validate attitude values are in valid ranges
    const rollValid = roll !== undefined && Math.abs(roll) <= 180;
    const pitchValid = pitch !== undefined && Math.abs(pitch) <= 90;
    
    return {
      type: 'PASHR',
      raw: sentence,
      data: {
        timestamp: time ? nmeaTimeToDate(time) : undefined,
        yaw: heading !== undefined && heading >= 0 && heading < 360 ? heading : undefined,
        roll: rollValid ? roll : undefined,
        pitch: pitchValid ? pitch : undefined,
        heaveRate,
        rollAccuracy,
        pitchAccuracy,
        headingAccuracy,
        insMode,
      },
      valid: rollValid && pitchValid,
    };
  } catch (error: any) {
    return { type: 'PASHR', raw: sentence, data: {}, valid: false, error: error.message };
  }
}

/**
 * Parse NMEA GSA sentence (GNSS DOP and Active Satellites)
 * $GPGSA,A,3,04,05,09,12,24,25,28,,,,,,1.8,1.0,1.5*33
 * Fields: talkerID, mode1(A/M), mode2(1=nofix/2=2D/3=3D), prn1..prn12, pdop, hdop, vdop, checksum
 */
function parseGSA(sentence: string): NmeaParseResult {
  const parts = sentence.split(',');
  
  // Support standard talkers GP/GN/GL/GA/GB plus legacy BD (BeiDou)
  const talkerMatch = parts[0].match(/^\$(GP|GN|GL|GA|GB|BD)GSA$/);
  if (!talkerMatch) {
    return { type: 'unknown', raw: sentence, data: {}, valid: false, error: 'Not a GSA sentence' };
  }
  // Normalise BD -> GB so downstream code uses a single BeiDou key
  const talkerId = talkerMatch[1] === 'BD' ? 'GB' : talkerMatch[1];
  
  try {
    // parts[1] = mode1: M=manual, A=automatic
    // parts[2] = mode2: 1=no fix, 2=2D, 3=3D
    const mode1 = parts[1] ? parts[1].trim().toUpperCase() : '';
    const mode2 = parts[2] ? parseInt(parts[2], 10) : 1;
    
    // parts[3..14] = active satellite PRNs (up to 12 slots, may be empty)
    const activePrns: number[] = [];
    for (let i = 3; i <= 14; i++) {
      const prn = parts[i] ? parseInt(parts[i], 10) : 0;
      if (prn > 0) activePrns.push(prn);
    }
    
    // parts[15] = PDOP, parts[16] = HDOP, parts[17] = VDOP (may have checksum)
    const pdop = safeParseFloat(parts[15]);
    const hdop = safeParseFloat(parts[16]);
    const vdop = safeParseFloat(parts[17]);
    
    // Only valid if we have a fix (mode2 >= 2)
    const hasFix = mode2 >= 2;
    
    return {
      type: 'GSA',
      raw: sentence,
      data: {
        pdop,
        hdop,
        vdop,
        activeSatellitePrns: activePrns,
        gsaMode: mode2,
        gsaMode1: mode1 || undefined,
        gsaTalkerId: talkerId,
      },
      valid: hasFix,
    };
  } catch (error: any) {
    return { type: 'GSA', raw: sentence, data: {}, valid: false, error: error.message };
  }
}

/**
 * Satellite info from a single GSV record
 */
export interface GsvSatellite {
  prn: number;
  elevation: number | undefined;
  azimuth: number | undefined;
  snr: number | undefined; // Signal-to-noise ratio (dB-Hz), undefined = no signal
}

/** Max age (ms) for a completed GSV talker entry to be included in merged output. */
const GSV_STALENESS_MS = 5000;

/**
 * Per-talker GSV accumulators to handle interleaved multi-constellation streams.
 * Key: talker ID (e.g. 'GP', 'GL', 'GA', 'GB', 'GN')
 * completedAt: timestamp when this talker last finished a full sequence (for expiry).
 */
const gsvAccumulators: Record<string, {
  totalSentences: number;
  totalSatellites: number;
  satellites: GsvSatellite[];
  completedAt?: number;
}> = {};

/**
 * Parse NMEA GSV sentence (GNSS Satellites in View)
 * $GPGSV,3,1,11,03,03,111,00,04,15,270,00,06,01,010,00,13,06,292,00*74
 * Fields: talkerID, totalSentences, sentenceNumber, totalSVs, [sv1PRN, sv1El, sv1Az, sv1SNR]...*checksum
 * 
 * Uses per-talker accumulators (keyed by talker ID) to correctly handle interleaved
 * GP/GL/GA/GB sequences. Completed talkers are timestamped and expire after
 * GSV_STALENESS_MS so that constellations that drop out are not reported indefinitely.
 */
function parseGSV(sentence: string): NmeaParseResult {
  const parts = sentence.split(',');
  
  // Support standard talkers GP/GN/GL/GA/GB plus legacy BD (BeiDou)
  const talkerMatch = parts[0].match(/^\$(GP|GN|GL|GA|GB|BD)GSV$/);
  if (!talkerMatch) {
    return { type: 'unknown', raw: sentence, data: {}, valid: false, error: 'Not a GSV sentence' };
  }
  // Normalise BD -> GB so per-talker accumulator uses a single BeiDou key
  const talkerId = talkerMatch[1] === 'BD' ? 'GB' : talkerMatch[1];
  
  try {
    const totalSentences = parseInt(parts[1], 10);
    const sentenceNum = parseInt(parts[2], 10);
    const totalSats = parts[3] ? parseInt(parts[3], 10) : 0;
    
    if (isNaN(totalSentences) || isNaN(sentenceNum)) {
      return { type: 'GSV', raw: sentence, data: {}, valid: false, error: 'Invalid GSV sentence numbers' };
    }
    
    // Initialize or reset per-talker accumulator on the first sentence in a new sequence
    if (sentenceNum === 1) {
      gsvAccumulators[talkerId] = {
        totalSentences,
        totalSatellites: totalSats,
        satellites: [],
      };
    } else if (!gsvAccumulators[talkerId]) {
      // Received a non-first sentence without prior first sentence — skip
      return { type: 'GSV', raw: sentence, data: {}, valid: false };
    }
    
    const acc = gsvAccumulators[talkerId];
    
    // Parse up to 4 satellite records per sentence (fields 4.. in groups of 4)
    for (let i = 4; i + 3 <= parts.length; i += 4) {
      const prnRaw = parts[i];
      if (!prnRaw || prnRaw === '') break;
      
      const prn = parseInt(prnRaw, 10);
      if (isNaN(prn) || prn <= 0) continue;
      
      const elevation = safeParseFloat(parts[i + 1]);
      const azimuth = safeParseFloat(parts[i + 2]);
      // SNR field may contain checksum suffix
      const snr = safeParseFloat(parts[i + 3]);
      
      acc.satellites.push({ prn, elevation, azimuth, snr });
    }
    
    // Emit combined satellite list when this talker's sequence is complete
    if (sentenceNum === totalSentences) {
      const now = Date.now();
      // Mark this talker as completed
      acc.completedAt = now;

      // Merge satellites only from talkers that have completed recently (not stale)
      const allSatellites: GsvSatellite[] = [];
      let totalInView = 0;
      for (const accEntry of Object.values(gsvAccumulators)) {
        if (accEntry.completedAt != null && (now - accEntry.completedAt) <= GSV_STALENESS_MS) {
          allSatellites.push(...accEntry.satellites);
          totalInView += accEntry.totalSatellites;
        }
      }

      return {
        type: 'GSV',
        raw: sentence,
        data: {
          satellitesInView: totalInView,
          satellites: allSatellites,
        },
        valid: true,
      };
    }
    
    // Intermediate sentence - valid parse but not yet complete
    return { type: 'GSV', raw: sentence, data: {}, valid: false };
  } catch (error: any) {
    return { type: 'GSV', raw: sentence, data: {}, valid: false, error: error.message };
  }
}

/**
 * Parse any NMEA sentence
 */
export function parseNmeaSentence(sentence: string): NmeaParseResult {
  const trimmed = sentence.trim();
  
  if (!trimmed.startsWith('$')) {
    return { type: 'unknown', raw: sentence, data: {}, valid: false, error: 'Invalid NMEA format' };
  }
  
  // Determine sentence type
  if (trimmed.includes('GGA')) {
    return parseGGA(trimmed);
  } else if (trimmed.includes('RMC')) {
    return parseRMC(trimmed);
  } else if (trimmed.includes('GST')) {
    return parseGST(trimmed);
  } else if (trimmed.includes('PASHR')) {
    return parsePASHR(trimmed);
  } else if (trimmed.includes('GSA')) {
    return parseGSA(trimmed);
  } else if (trimmed.includes('GSV')) {
    return parseGSV(trimmed);
  }
  
  // Unsupported sentence type (VTG, etc.)
  return { type: 'unknown', raw: sentence, data: {}, valid: false };
}

/**
 * Merge multiple NMEA parse results into a unified dataset
 * Combines GGA (position/quality) + RMC (speed/heading) + GST (accuracy) + PASHR (attitude)
 * + GSA (DOP/active satellites) + GSV (satellites in view with SNR)
 */
export function mergeNmeaData(results: NmeaParseResult[]): {
  timestamp?: Date;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  quality?: FixQuality;
  numSats?: number;
  hdop?: number;
  vdop?: number;
  pdop?: number;
  speed?: number;
  heading?: number;
  geoidHeight?: number;
  correctionAge?: number;
  stdDev?: number;
  // GSA fields
  activeSatellitePrns?: number[];
  gsaMode?: number;   // mode2: 1=no fix, 2=2D, 3=3D
  gsaMode1?: string;  // mode1: 'A'=automatic, 'M'=manual
  // GSV fields
  satellitesInView?: number;
  satellites?: GsvSatellite[];
  // Attitude/IMU data
  roll?: number;
  pitch?: number;
  yaw?: number;
  heaveRate?: number;
  rollAccuracy?: number;
  pitchAccuracy?: number;
  headingAccuracy?: number;
  insMode?: InsMode;
} {
  const merged: any = {};
  
  for (const result of results) {
    if (!result.valid) continue;
    
    // Merge data, prioritizing newer values
    Object.assign(merged, result.data);
    
    // Calculate average standard deviation from lat/lon/alt if available
    if (result.data.stdDevLat && result.data.stdDevLon && result.data.stdDevAlt) {
      const horizontal = Math.sqrt(
        (result.data.stdDevLat ** 2 + result.data.stdDevLon ** 2) / 2
      );
      merged.stdDev = horizontal;
    }
  }
  
  return merged;
}

/**
 * Validate NMEA checksum
 */
export function validateNmeaChecksum(sentence: string): boolean {
  const parts = sentence.split('*');
  if (parts.length !== 2) return false;
  
  const data = parts[0].substring(1); // remove $
  const providedChecksum = parts[1].substring(0, 2);
  
  let calculatedChecksum = 0;
  for (let i = 0; i < data.length; i++) {
    calculatedChecksum ^= data.charCodeAt(i);
  }
  
  const calculatedHex = calculatedChecksum.toString(16).toUpperCase().padStart(2, '0');
  
  return calculatedHex === providedChecksum.toUpperCase();
}
