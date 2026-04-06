/**
 * Road Profile Recording Buffer
 * In-memory buffer for real-time profile recording with fast UI updates
 * 
 * Architecture:
 * - Samples arrive → stored in memory buffer (fast)
 * - Profile points computed incrementally (fast UI updates)
 * - Periodically flushed to IndexedDB (durable persistence)
 * - On survey end, final flush + full recomputation with smoothing
 */

import type {
  ProfileGpsSample,
  RoadProfilePoint,
  RoadProfileSession,
  ProfileRecordingBuffer,
  SectionMarker,
  ProfileRecordingStats,
  ProfileThresholds,
  ProfileGpsSource,
  ProfileRecordingState,
  CrossSlopeMode,
  BankingThresholds,
  WindBladeConfig,
  WindBladeAlertSegment
} from './types';
import { appendSampleToProfile, recomputeProfileMetrics } from './processor';
import { computeRoadProfileAlertSegments } from './alertSegments';
import { openSurveyDB } from '../survey/db';
import { detectSustainedKFactorAlerts, loadWindBladeConfig } from './windBladeUtils';
import {
  RollFilter,
  CurveRadiusCalculator,
  classifyBankingAlert,
  getCrossSlopeForMode,
  DEFAULT_BANKING_THRESHOLDS
} from './bankingUtils';
import { useGPSStore } from '@/lib/stores/gpsStore';

const FLUSH_INTERVAL_MS = 30000; // Flush to IndexedDB every 30 seconds
const MIN_SAMPLES_BEFORE_FLUSH = 10; // Wait for at least 10 samples before first flush

// Event types for subscribers
type BufferEventType = 'sample' | 'point' | 'section' | 'state' | 'stats';
type BufferEventHandler = (event: { type: BufferEventType; data: any }) => void;

class ProfileRecordingBufferService {
  private buffer: ProfileRecordingBuffer | null = null;
  private session: RoadProfileSession | null = null;
  private subscribers: Set<BufferEventHandler> = new Set();
  private flushIntervalId: number | null = null;
  private statsUpdateInterval: number | null = null;
  private startTime: number | null = null;
  private lastFlushIndex: number = 0; // Track which samples have been persisted
  private isPersisting: boolean = false;
  
  // Banking/Cross-slope utilities
  private rollFilter: RollFilter = new RollFilter(0.1);
  private curveRadiusCalculator: CurveRadiusCalculator = new CurveRadiusCalculator();
  private crossSlopeMode: CrossSlopeMode = 'raw';
  private bankingThresholds: BankingThresholds = DEFAULT_BANKING_THRESHOLDS;
  
  // Global GPS subscription for persistent recording
  private gpsUnsubscribe: (() => void) | null = null;
  private lastGpsUpdateTime: number = 0;
  private minSampleIntervalMs: number = 1000; // 1 sample per second

  // Last accepted GPS position for jump detection
  private lastAcceptedLat: number | null = null;
  private lastAcceptedLon: number | null = null;
  private lastAcceptedTime: number | null = null;
  
  // Track whether the first real sample has been persisted
  private hasPersistedFirstSample: boolean = false;

  /**
   * Start a new recording session
   * IMPORTANT: This clears any existing buffer data to ensure a fresh start
   */
  startRecording(params: {
    surveyId: string;
    sessionId?: string;
    gpsSource: ProfileGpsSource;
    thresholds?: ProfileThresholds;
    crossSlopeMode?: CrossSlopeMode;
    bankingThresholds?: BankingThresholds;
    minimumCurveRadius_m?: number;
    curveDetectionThreshold_m?: number;
  }): string {
    // CRITICAL: Stop any existing recording and clear old data first
    if (this.session?.state !== 'idle') {
      this.stopFlushInterval();
      this.stopStatsUpdates();
      this.stopGpsSubscription();
    }
    
    // Clear old buffer data completely
    this.buffer = null;
    this.session = null;
    this.lastFlushIndex = 0;
    this.startTime = null;
    this.rollFilter = new RollFilter(0.1);
    this.curveRadiusCalculator = new CurveRadiusCalculator();
    this.lastGpsUpdateTime = 0;
    this.hasPersistedFirstSample = false;
    
    const sessionId = params.sessionId || `profile-${Date.now()}`;
    const now = new Date().toISOString();

    this.session = {
      id: sessionId,
      surveyId: params.surveyId,
      gpsSource: params.gpsSource,
      state: 'recording',
      created_at: now,
      updated_at: now,
      start_timestamp: now,
      total_distance_m: 0,
      total_samples: 0,
      sections: [],
      thresholds: params.thresholds || {
        grade_up_alert_pct: 10,
        grade_down_alert_pct: -10,
        k_factor_alert: 10
      }
    };

    this.buffer = {
      sessionId,
      surveyId: params.surveyId,
      samples: [],
      computedPoints: [],
      lastChainage: 0,
      lastUpdateTime: Date.now(),
      sectionMarkers: []
    };

    // Initialize banking/cross-slope utilities
    this.crossSlopeMode = params.crossSlopeMode || 'raw';
    this.bankingThresholds = params.bankingThresholds || DEFAULT_BANKING_THRESHOLDS;
    this.rollFilter = new RollFilter(0.1);
    this.curveRadiusCalculator = new CurveRadiusCalculator(
      5, // Keep 5 samples for trajectory analysis
      params.minimumCurveRadius_m || 15,
      params.curveDetectionThreshold_m || 500
    );

    this.startTime = Date.now();
    this.lastFlushIndex = 0;
    this.lastAcceptedLat = null;
    this.lastAcceptedLon = null;
    this.lastAcceptedTime = null;
    this.startStatsUpdates();
    this.startFlushInterval();
    this.startGpsSubscription(); // Start global GPS subscription for persistent recording
    this.emitEvent('state', { state: 'recording' });
    
    return sessionId;
  }

  /**
   * Start periodic flush to IndexedDB
   */
  private startFlushInterval(): void {
    this.flushIntervalId = window.setInterval(() => {
      this.flushToIndexedDB().catch(console.error);
    }, FLUSH_INTERVAL_MS);
  }

  /**
   * Stop periodic flush
   */
  private stopFlushInterval(): void {
    if (this.flushIntervalId !== null) {
      clearInterval(this.flushIntervalId);
      this.flushIntervalId = null;
    }
  }

  /**
   * Persist session metadata to IndexedDB
   * Uses legacy-compatible field names for export compatibility
   */
  private computeSessionLabel(session: RoadProfileSession): string {
    if (session.name) return session.name;
    const startDate = new Date(session.start_timestamp);
    if (startDate.getFullYear() > 2000) {
      return `Session ${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    const idFragment = session.id.startsWith('profile-')
      ? session.id.substring('profile-'.length, 'profile-'.length + 8)
      : session.id.substring(0, 8);
    return `Session ${idFragment}`;
  }

  private async persistSession(isFinal: boolean = false): Promise<void> {
    if (!this.session) return;

    try {
      const db = await openSurveyDB();
      
      // Use legacy-compatible field names for export compatibility
      const profileRecord: any = {
        id: this.session.id,
        surveyId: this.session.surveyId,
        sessionId: this.session.id,
        label: this.computeSessionLabel(this.session),
        gpsSource: this.session.gpsSource,
        startTime: this.session.start_timestamp,
        // Only set endTime on final flush
        endTime: isFinal ? new Date().toISOString() : null,
        // Legacy-compatible threshold fields for exportHelper
        grade_trigger_pct: this.session.thresholds.grade_up_alert_pct,
        k_factor_convex_min: this.session.thresholds.k_factor_alert,
        k_factor_concave_min: this.session.thresholds.k_factor_alert,
        // Points array - populated on final flush
        points: [],
        step_m: 1,
        start: this.session.start_timestamp || new Date().toISOString(),
        end: isFinal ? new Date().toISOString() : null
      };

      await db.put('roadProfiles', profileRecord);
    } catch (error) {
      console.error('[ProfileBuffer] Failed to persist session:', error);
    }
  }

  /**
   * Flush new samples to IndexedDB
   * Only advances lastFlushIndex after successful transaction
   * @param bypassMinimum If true, flush regardless of sample count (for final flush)
   */
  private async flushToIndexedDB(bypassMinimum: boolean = false): Promise<void> {
    if (!this.buffer || !this.session || this.isPersisting) return;
    
    // Check minimum sample count unless bypassing (for final flush)
    if (!bypassMinimum && this.buffer.samples.length < MIN_SAMPLES_BEFORE_FLUSH) return;
    if (this.buffer.samples.length <= this.lastFlushIndex) return;

    this.isPersisting = true;
    
    // Capture the samples to flush BEFORE any new ones arrive
    const startIndex = this.lastFlushIndex;
    const newSamples = this.buffer.samples.slice(startIndex);
    const newSampleCount = newSamples.length;
    
    if (newSampleCount === 0) {
      this.isPersisting = false;
      return;
    }

    try {
      const db = await openSurveyDB();
      const tx = db.transaction('roadProfileSamples', 'readwrite');
      const store = tx.objectStore('roadProfileSamples');

      for (const sample of newSamples) {
        store.add({
          profileId: this.session.id,
          surveyId: this.session.surveyId,
          timestamp: sample.timestamp,
          latitude: sample.latitude,
          longitude: sample.longitude,
          altitude: sample.altitude,
          speed: sample.speed,
          heading: sample.heading,
          accuracy: sample.accuracy,
          source: sample.source,
          quality: sample.quality,
          hdop: sample.hdop,
          numSats: sample.numSats,
          // IMU attitude data
          roll_deg: sample.roll_deg ?? null,
          pitch_deg: sample.pitch_deg ?? null,
          // Banking/Cross-slope data
          crossSlope_deg: sample.crossSlope_deg ?? null,
          bankingAlert: sample.bankingAlert ?? null,
          // Curve radius data
          curveRadius_m: sample.curveRadius_m ?? null,
          radiusAlert: sample.radiusAlert ?? null
        });
      }

      // Wait for transaction to complete before advancing index
      await tx.done;
      
      // Increment by the exact number of samples we persisted
      this.lastFlushIndex = startIndex + newSampleCount;
    } catch (error) {
      // Keep lastFlushIndex unchanged on failure so we retry these samples
      console.error('[ProfileBuffer] Flush failed, will retry:', error);
    } finally {
      this.isPersisting = false;
    }
  }

  /**
   * Perform final flush and persist computed points
   * Writes points in legacy-compatible format for exportHelper
   */
  private async finalFlush(): Promise<void> {
    if (!this.buffer || !this.session) return;

    try {
      // Flush any remaining samples first - bypass minimum to ensure all samples are persisted
      await this.flushToIndexedDB(true);

      // Compute final metrics with smoothing
      const points = recomputeProfileMetrics(this.buffer.computedPoints, this.session.thresholds);
      const alertSegments = computeRoadProfileAlertSegments(points);

      // Update session with final stats and computed points
      const db = await openSurveyDB();
      const endTime = new Date().toISOString();
      
      // Calculate summary stats
      const grades = points.map(p => p.grade_pct);
      const totalDistance = this.buffer.lastChainage;
      const totalClimb = grades.reduce((sum, g) => g > 0 ? sum + g : sum, 0);
      const totalDescent = Math.abs(grades.reduce((sum, g) => g < 0 ? sum + g : sum, 0));
      const maxGradeUp = grades.length > 0 ? Math.max(0, ...grades) : 0;
      const maxGradeDown = grades.length > 0 ? Math.min(0, ...grades) : 0;
      const numGradeEvents = alertSegments.filter(a => a.alert_type.startsWith('GRADE')).length;
      const numKFactorEvents = alertSegments.filter(a => a.alert_type === 'K_OVER_10').length;
      
      // Store computed points in legacy-compatible format for exportHelper
      // Both legacyAdapter.convertLegacyProfileToCanonical and exportHelper read from this
      const profileRecord: any = {
        id: this.session.id,
        surveyId: this.session.surveyId,
        sessionId: this.session.id,
        label: this.computeSessionLabel(this.session),
        gpsSource: this.session.gpsSource,
        startTime: this.session.start_timestamp,
        endTime: endTime,
        // Legacy-compatible threshold fields
        grade_trigger_pct: this.session.thresholds.grade_up_alert_pct,
        k_factor_convex_min: this.session.thresholds.k_factor_alert,
        k_factor_concave_min: this.session.thresholds.k_factor_alert,
        step_m: 1,
        start: this.session.start_timestamp || endTime,
        end: endTime,
        // Legacy-compatible summary OBJECT that convertLegacyProfileToCanonical reads
        summary: {
          totalDistance_m: totalDistance,
          totalClimb_m: totalClimb,
          totalDescent_m: totalDescent,
          maxGradeUp_pct: maxGradeUp,
          maxGradeDown_pct: maxGradeDown,
          numGradeEvents: numGradeEvents,
          numKFactorEvents: numKFactorEvents,
          numRailCrossings: 0
        },
        // Also store as top-level fields for direct access
        totalDistance_m: totalDistance,
        totalSamples: this.buffer.samples.length,
        // Store computed points in legacy-compatible format
        // legacyAdapter reads: distance_m, lat, lon, alt_m (old) or elev_m (new), timestamp_iso, grade_pct, k_factor
        points: points.map(p => ({
          distance_m: p.chainage_m,
          lat: p.lat,
          lon: p.lon,
          elev_m: p.elev_m,
          timestamp_iso: p.timestamp_iso,
          grade_pct: p.grade_pct,
          k_factor: p.k_factor,
          curvature_type: null
        }))
      };

      await db.put('roadProfiles', profileRecord);
    } catch (error) {
      console.error('[ProfileBuffer] Final flush failed:', error);
    }
  }

  /**
   * Pause recording (keeps buffer, stops accepting samples)
   */
  pauseRecording(): void {
    if (this.session) {
      this.session.state = 'paused';
      this.session.updated_at = new Date().toISOString();
      this.emitEvent('state', { state: 'paused' });
    }
  }

  /**
   * Resume recording after pause
   */
  resumeRecording(): void {
    if (this.session && this.session.state === 'paused') {
      this.session.state = 'recording';
      this.session.updated_at = new Date().toISOString();
      this.emitEvent('state', { state: 'recording' });
    }
  }

  /**
   * Stop recording and finalize session
   */
  async stopRecording(): Promise<RoadProfileSession | null> {
    if (!this.session || !this.buffer) return null;

    const now = new Date().toISOString();
    this.session.state = 'idle';
    this.session.end_timestamp = now;
    this.session.updated_at = now;
    this.session.total_distance_m = this.buffer.lastChainage;
    this.session.total_samples = this.buffer.samples.length;

    this.stopStatsUpdates();
    this.stopFlushInterval();
    this.stopGpsSubscription(); // Stop global GPS subscription
    
    // Perform final persistence before cleanup
    await this.finalFlush();
    
    this.emitEvent('state', { state: 'idle' });
    
    return this.session;
  }

  /**
   * Haversine distance between two lat/lon points in metres.
   */
  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /**
   * Add a GPS sample to the buffer
   * Computes cross-slope and curve radius for heavy haul safety analysis
   */
  addSample(sample: ProfileGpsSample): RoadProfilePoint | null {
    if (!this.buffer || !this.session) return null;
    if (this.session.state !== 'recording') return null;

    // Reject implausibly large position jumps (> 30 m in < 1 s) that indicate
    // a GPS source switch rather than real movement.
    const sampleTimeMs = new Date(sample.timestamp).getTime();
    if (
      this.lastAcceptedLat !== null &&
      this.lastAcceptedLon !== null &&
      this.lastAcceptedTime !== null
    ) {
      const elapsedMs = sampleTimeMs - this.lastAcceptedTime;
      const distanceM = this.haversineDistance(
        this.lastAcceptedLat, this.lastAcceptedLon,
        sample.latitude, sample.longitude
      );
      if (elapsedMs < 1000 && distanceM > 30) {
        console.warn(
          `[ProfileBuffer] Rejected GPS jump: ${distanceM.toFixed(1)} m in ${elapsedMs} ms — likely source switch`
        );
        return null;
      }
    }
    this.lastAcceptedLat = sample.latitude;
    this.lastAcceptedLon = sample.longitude;
    this.lastAcceptedTime = sampleTimeMs;

    // Calculate cross-slope from IMU roll data
    const crossSlopeResult = getCrossSlopeForMode(
      sample.roll_deg ?? null,
      sample.speed ?? null,
      this.crossSlopeMode,
      this.rollFilter
    );
    
    // Add cross-slope to sample if we have a value
    if (crossSlopeResult.value !== null) {
      sample.crossSlope_deg = crossSlopeResult.value;
      sample.bankingAlert = classifyBankingAlert(crossSlopeResult.value, this.bankingThresholds);
    }
    
    // Add to curve radius calculator for trajectory analysis
    this.curveRadiusCalculator.addSample(
      sample.latitude,
      sample.longitude,
      sample.timestamp
    );
    
    // Get current curve radius
    const curveRadius = this.curveRadiusCalculator.getCurrentRadius();
    const radiusAlert = this.curveRadiusCalculator.getRadiusAlert();
    
    sample.curveRadius_m = curveRadius;
    sample.radiusAlert = radiusAlert;

    // Add to raw samples
    this.buffer.samples.push(sample);
    this.buffer.lastUpdateTime = Date.now();

    // Persist to IndexedDB on the first real sample (deferred from startRecording)
    if (!this.hasPersistedFirstSample) {
      this.hasPersistedFirstSample = true;
      this.persistSession().catch(console.error);
    }

    // Compute profile point incrementally
    const { point, chainage } = appendSampleToProfile({
      profileId: this.session.id,
      existingPoints: this.buffer.computedPoints,
      newSample: sample,
      lastChainage: this.buffer.lastChainage,
      thresholds: this.session.thresholds
    });

    this.buffer.computedPoints.push(point);
    this.buffer.lastChainage = chainage;

    this.emitEvent('point', point);
    return point;
  }

  /**
   * Mark section start
   */
  markSectionStart(label?: string): SectionMarker | null {
    if (!this.buffer || !this.session) return null;
    
    const lastPoint = this.buffer.computedPoints[this.buffer.computedPoints.length - 1];
    if (!lastPoint) return null;

    const marker: SectionMarker = {
      type: 'start',
      timestamp: new Date().toISOString(),
      chainage_m: lastPoint.chainage_m,
      lat: lastPoint.lat,
      lon: lastPoint.lon,
      label
    };

    this.buffer.sectionMarkers.push(marker);
    this.emitEvent('section', marker);
    return marker;
  }

  /**
   * Mark section end
   */
  markSectionEnd(label?: string): SectionMarker | null {
    if (!this.buffer || !this.session) return null;
    
    const lastPoint = this.buffer.computedPoints[this.buffer.computedPoints.length - 1];
    if (!lastPoint) return null;

    const marker: SectionMarker = {
      type: 'end',
      timestamp: new Date().toISOString(),
      chainage_m: lastPoint.chainage_m,
      lat: lastPoint.lat,
      lon: lastPoint.lon,
      label
    };

    this.buffer.sectionMarkers.push(marker);
    this.emitEvent('section', marker);
    return marker;
  }

  /**
   * Get current recording stats
   */
  getStats(): ProfileRecordingStats | null {
    if (!this.buffer || !this.session || !this.startTime) return null;

    const lastPoint = this.buffer.computedPoints[this.buffer.computedPoints.length - 1];
    const alertSegments = computeRoadProfileAlertSegments(this.buffer.computedPoints);

    return {
      duration_s: Math.floor((Date.now() - this.startTime) / 1000),
      distance_m: this.buffer.lastChainage,
      samples: this.buffer.samples.length,
      currentGrade_pct: lastPoint?.grade_pct ?? 0,
      currentKFactor: lastPoint?.k_factor ?? 0,
      alertCount: alertSegments.length,
      currentElevation_m: lastPoint?.elev_m ?? 0,
      gpsSource: this.session.gpsSource,
      gpsQuality: lastPoint?.quality ?? 'unknown'
    };
  }

  /**
   * Get current buffer state
   */
  getBuffer(): ProfileRecordingBuffer | null {
    return this.buffer;
  }

  /**
   * Get current session
   */
  getSession(): RoadProfileSession | null {
    return this.session;
  }

  /**
   * Get recording state
   */
  getState(): ProfileRecordingState {
    return this.session?.state ?? 'idle';
  }

  /**
   * Get computed points
   */
  getPoints(): RoadProfilePoint[] {
    return this.buffer?.computedPoints ?? [];
  }

  /**
   * Get wind blade transport alerts
   * Analyzes the recorded profile for ground contact risk on vertical curves
   */
  getWindBladeAlerts(config?: WindBladeConfig): WindBladeAlertSegment[] {
    const points = this.getPoints();
    if (points.length < 10) return [];
    
    const effectiveConfig = config ?? loadWindBladeConfig();
    return detectSustainedKFactorAlerts(points, effectiveConfig);
  }

  /**
   * Recompute all points with smoothing (call on stop)
   */
  recomputeWithSmoothing(): RoadProfilePoint[] {
    if (!this.buffer || !this.session) return [];
    
    this.buffer.computedPoints = recomputeProfileMetrics(
      this.buffer.computedPoints,
      this.session.thresholds
    );
    
    return this.buffer.computedPoints;
  }

  /**
   * Clear buffer (reset state)
   */
  clear(): void {
    this.stopStatsUpdates();
    this.stopFlushInterval();
    this.stopGpsSubscription();
    this.buffer = null;
    this.session = null;
    this.startTime = null;
    this.emitEvent('state', { state: 'idle' });
  }

  /**
   * Subscribe to buffer events
   */
  subscribe(handler: BufferEventHandler): () => void {
    this.subscribers.add(handler);
    return () => this.subscribers.delete(handler);
  }

  private emitEvent(type: BufferEventType, data: any): void {
    this.subscribers.forEach(handler => handler({ type, data }));
  }

  private startStatsUpdates(): void {
    this.statsUpdateInterval = window.setInterval(() => {
      const stats = this.getStats();
      if (stats) {
        this.emitEvent('stats', stats);
      }
    }, 1000);
  }

  private stopStatsUpdates(): void {
    if (this.statsUpdateInterval !== null) {
      clearInterval(this.statsUpdateInterval);
      this.statsUpdateInterval = null;
    }
  }

  /**
   * Start global GPS subscription for persistent recording
   * This ensures recording continues even when the UI hook unmounts
   */
  private startGpsSubscription(): void {
    if (this.gpsUnsubscribe) return; // Already subscribed
    
    // Use Zustand's subscribe API directly (not the React hook)
    this.gpsUnsubscribe = useGPSStore.subscribe((state) => {
      // Only add samples while recording
      if (this.session?.state !== 'recording') return;
      
      // Check if we have valid GPS data
      const gpsData = state.data;
      if (!gpsData || gpsData.latitude === 0 || gpsData.longitude === 0) return;
      
      // Rate limit samples
      const now = Date.now();
      if (now - this.lastGpsUpdateTime < this.minSampleIntervalMs) return;
      this.lastGpsUpdateTime = now;
      
      // Create sample from GPS store data
      const sample: ProfileGpsSample = {
        timestamp: new Date().toISOString(),
        latitude: gpsData.latitude,
        longitude: gpsData.longitude,
        altitude: gpsData.altitude ?? null,
        speed: gpsData.speed ?? null,
        heading: gpsData.course ?? gpsData.heading ?? undefined,
        accuracy: gpsData.hdop ? gpsData.hdop * 5 : undefined,
        source: gpsData.source === 'duro' ? 'duro' : 'browser',
        quality: this.mapGpsQuality(gpsData.fixQuality),
        hdop: gpsData.hdop ?? null,
        numSats: gpsData.satellites ?? null,
        // IMU data from Duro
        roll_deg: gpsData.imu?.roll ?? null,
        pitch_deg: gpsData.imu?.pitch ?? null
      };
      
      this.addSample(sample);
    });
    
    console.log('[ProfileBuffer] Started global GPS subscription for persistent recording');
  }

  /**
   * Stop global GPS subscription
   */
  /**
   * Map GPS fix quality to standard quality string
   */
  private mapGpsQuality(fixQuality: string | undefined): 'gps' | 'dgps' | 'rtk_float' | 'rtk_fixed' | 'pps' | 'estimated' | 'none' | 'browser' {
    if (!fixQuality) return 'none';
    const normalized = fixQuality.toLowerCase().replace(/[_\s-]/g, '');
    switch (normalized) {
      case 'nofix':
      case 'none':
      case '':
      case '0':
        return 'none';
      case 'dgpsfix':
      case 'dgps':
      case 'sbas':
      case '2':
        return 'dgps';
      case 'rtkfloat':
      case 'float':
      case '5':
        return 'rtk_float';
      case 'rtkfixed':
      case 'rtk':
      case 'fixed':
      case 'fixedrtk':
      case '4':
        return 'rtk_fixed';
      case 'gpsfix':
      case 'gps':
      case 'single':
      case '1':
        return 'gps';
      case 'pps':
      case '3':
        return 'pps';
      case 'estimated':
      case 'dead':
      case 'deadreckoning':
      case '6':
        return 'estimated';
      default:
        // Log unknown values for diagnostics, return 'none' to preserve GNSS provenance
        console.warn('[ProfileBuffer] Unknown GPS quality:', fixQuality);
        return 'none';
    }
  }

  private stopGpsSubscription(): void {
    if (this.gpsUnsubscribe) {
      this.gpsUnsubscribe();
      this.gpsUnsubscribe = null;
      console.log('[ProfileBuffer] Stopped global GPS subscription');
    }
  }
}

// Singleton instance
let bufferServiceInstance: ProfileRecordingBufferService | null = null;

export function getProfileRecordingBuffer(): ProfileRecordingBufferService {
  if (!bufferServiceInstance) {
    bufferServiceInstance = new ProfileRecordingBufferService();
  }
  return bufferServiceInstance;
}

export { ProfileRecordingBufferService };
