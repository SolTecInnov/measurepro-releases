/**
 * MeasurementFeed Service
 * PERFORMANCE: In-memory cache to prevent IndexedDB queries during active logging
 * 
 * Architecture:
 * - Single subscriber to worker messages
 * - Maintains recent ~5000 measurements in memory
 * - Components read from cache (no IndexedDB queries)
 * - IndexedDB for persistence only (background async writes)
 * - Memoized selectors for stats, filters, map clusters
 * 
 * This solves the root cause performance issue: components treating IndexedDB
 * as reactive source of truth, causing full reloads on every measurement
 */

import { getMeasurementLogger, type BatchCompleteData } from '../workers/MeasurementLoggerClient';
import type { Measurement } from './types';
import { openSurveyDB } from './db';
import { logger } from '../utils/logger';

const CACHE_SIZE = 5000; // Keep last 5000 measurements in memory
const INITIAL_LOAD_LIMIT = 1000; // Load last 1000 on startup

interface MeasurementStats {
  total: number;
  autoCapture: number;
  modal: number;
  measurementFree: number;
  lastUpdateTime: number;
}

interface MapCluster {
  id: string;
  latitude: number;
  longitude: number;
  count: number;
  measurements: Measurement[];
}

type Subscriber = () => void;

class MeasurementFeed {
  private cache: Map<string, Measurement> = new Map();
  // PERF: Stored ASC (oldest → newest) so addMeasurement can push() in O(1).
  // Reads iterate in reverse to surface newest-first. unshift() was O(n) and
  // caused per-add cost to grow linearly with the number of POIs (~850+ noticeable).
  private sortedIds: string[] = [];
  private currentSurveyId: string | null = null;
  private subscribers: Set<Subscriber> = new Set();
  private statsCache: MeasurementStats | null = null;
  private mapClustersCache: MapCluster[] | null = null;
  // PERF (v16.1.27): cache the full DESC (newest-first) measurement array.
  // Without this, every subscriber's re-render call to getMeasurements()
  // rebuilt the array from scratch (O(n)) — at 10 subscribers × 800 POIs that
  // meant ~8000 ops per add on the read side alone, negating the v16.1.23
  // O(1) addMeasurement fix. Cache is invalidated in invalidateCaches() which
  // fires on every add/update/delete, so staleness is never a concern.
  private measurementsArrayCache: Measurement[] | null = null;
  // Same strategy for the POI type count map.
  private poiTypeCountsCache: Record<string, number> | null = null;
  private lastCacheInvalidation = 0;
  private initialized = false;
  private workerUnsubscribe: (() => void) | null = null;
  private isLoadingInitialData = false;
  private pendingDuringLoad: Map<string, Measurement> = new Map();
  private initialLoadPromise: Promise<void> | null = null;

  /**
   * Initialize the feed with a survey
   * CRITICAL: Returns immediately after synchronous prime, reconcile runs in background
   * This allows zero-lag logging while historical data loads asynchronously
   */
  async init(surveyId: string): Promise<void> {
    // IDEMPOTENT: If already initialized for this survey, return immediately
    // Don't await reconcile - let it run in background
    if (this.initialized && this.currentSurveyId === surveyId) {
      return;
    }

    logger.log(`🔄 Initializing MeasurementFeed for survey ${surveyId}`);

    // SYNCHRONOUS PRIME: Set survey ID immediately so addMeasurement accepts measurements
    this.prime(surveyId);

    // CRITICAL FIX: Subscribe to worker IMMEDIATELY before reconcile runs
    // This ensures we capture measurements that come in while reconcile loads historical data
    await this.ensureWorkerSubscription();

    // ASYNC RECONCILE: Load historical data in background (don't await!)
    // This allows logMeasurement to proceed immediately with zero lag
    this.initialLoadPromise = this.reconcileWithDatabase();
    // Don't await! Let it run in background while logging proceeds

    logger.log(`✅ MeasurementFeed primed (historical data loading in background)`);
  }

  /**
   * Ensure we're subscribed to the worker's batch complete events
   * CRITICAL: Must be called early in init() to avoid missing measurements
   */
  private async ensureWorkerSubscription(): Promise<void> {
    if (this.workerUnsubscribe) {
      // Already subscribed
      return;
    }

    try {
      const measurementLogger = getMeasurementLogger();
      await measurementLogger.init();
      
      this.workerUnsubscribe = measurementLogger.onBatchComplete((data: BatchCompleteData) => {
        if (data.surveyId === this.currentSurveyId) {
          this.handleBatchComplete(data);
        }
      });
      
      logger.log(`✅ Worker subscription established`);
    } catch (error) {
      logger.error(`❌ Failed to subscribe to worker:`, error);
    }
  }

  /**
   * Synchronous prime: Set survey ID and prepare for measurements
   * CRITICAL: This runs before any async work, allowing addMeasurement to accept immediately
   */
  private prime(surveyId: string): void {
    // Clean up previous subscription if changing surveys
    const changingSurveys = this.currentSurveyId && this.currentSurveyId !== surveyId;
    if (changingSurveys && this.workerUnsubscribe) {
      this.workerUnsubscribe();
      this.workerUnsubscribe = null;
    }

    // Set survey ID synchronously
    this.currentSurveyId = surveyId;

    // Clear cache ONLY if changing surveys (keep optimistic inserts for same survey)
    if (changingSurveys || !this.initialized) {
      this.cache.clear();
      this.sortedIds = [];
      this.pendingDuringLoad.clear();
      this.invalidateCaches();
    }

    this.initialized = true;
  }

  /**
   * Async reconcile: Load historical data and merge with optimistic inserts
   * MEMORY FIX: Enforces CACHE_SIZE limit after merge
   */
  private async reconcileWithDatabase(): Promise<void> {
    if (!this.currentSurveyId) return;

    try {
      // Mark as loading so addMeasurement queues to pendingDuringLoad
      this.isLoadingInitialData = true;

      // Load historical data from IndexedDB
      const historicalData = await this.loadInitialData();

      // Merge: existing cache + pending queue + historical data
      // NOTE: mergeFetchedMeasurements now enforces CACHE_SIZE limit
      const mergedMeasurements = this.mergeFetchedMeasurements(historicalData);

      // Replace cache with merged, deduplicated, sorted, and TRIMMED data
      this.cache = mergedMeasurements.byId;
      this.sortedIds = mergedMeasurements.ids;

      // Clear pending queue (all optimistic inserts now in main cache)
      this.pendingDuringLoad.clear();
      this.isLoadingInitialData = false;

      // NOTE: Worker subscription is now handled earlier in init() via ensureWorkerSubscription()
      // This ensures we don't miss any measurements that come in while reconcile loads

      // Notify subscribers that initial data is ready
      this.invalidateCaches();
      this.notifySubscribers();
      
      // MEMORY FIX: Log cache size after reconciliation to verify trimming
      logger.log(`✅ MeasurementFeed reconciled: ${this.cache.size} measurements in cache (limit: ${CACHE_SIZE})`);
    } catch (error) {
      logger.error('❌ Failed to reconcile with database:', error);
      this.isLoadingInitialData = false;
    }
  }

  /**
   * Load initial data from IndexedDB
   * RETURNS: Map of measurements and array of IDs for merging
   */
  private async loadInitialData(): Promise<{ byId: Map<string, Measurement>; ids: string[] }> {
    if (!this.currentSurveyId) {
      return { byId: new Map(), ids: [] };
    }

    try {
      const startTime = performance.now();
      const db = await openSurveyDB();
      
      // PERFORMANCE: Use cursor to load only recent N measurements
      const tx = db.transaction('measurements', 'readonly');
      const index = tx.objectStore('measurements').index('by-survey');
      
      // Open cursor in reverse (newest first)
      let cursor = await index.openCursor(this.currentSurveyId, 'prev');
      const measurements: Measurement[] = [];
      
      // Load only INITIAL_LOAD_LIMIT measurements
      while (cursor && measurements.length < INITIAL_LOAD_LIMIT) {
        measurements.push(cursor.value);
        cursor = await cursor.continue();
      }

      // Return as Map for efficient merging
      const byId = new Map(measurements.map(m => [m.id, m]));
      const ids = measurements.map(m => m.id);
      
      const duration = performance.now() - startTime;
      logger.log(`📦 Loaded ${measurements.length} measurements from IndexedDB in ${duration.toFixed(1)}ms`);
      
      return { byId, ids };
    } catch (error) {
      logger.error('❌ Failed to load initial data:', error);
      return { byId: new Map(), ids: [] };
    }
  }

  /**
   * Merge fetched measurements with existing cache and pending queue
   * DEDUPES by ID, SORTS by createdAt DESC, and TRIMS to CACHE_SIZE
   * MEMORY FIX: Enforces CACHE_SIZE limit to prevent unbounded memory growth
   */
  private mergeFetchedMeasurements(
    historicalData: { byId: Map<string, Measurement>; ids: string[] }
  ): { byId: Map<string, Measurement>; ids: string[] } {
    // Collect all unique measurements: existing cache + pending queue + historical data
    const allMeasurements: Measurement[] = [];
    
    // Add existing cache (optimistic inserts from before reconcile started)
    this.cache.forEach(m => allMeasurements.push(m));
    
    // Add pending queue (optimistic inserts during async load)
    this.pendingDuringLoad.forEach(m => allMeasurements.push(m));
    
    // Add historical data from IndexedDB
    historicalData.byId.forEach(m => allMeasurements.push(m));

    // DEDUPE by ID (keep newest version based on first occurrence)
    const dedupedMap = new Map<string, Measurement>();
    allMeasurements.forEach(m => {
      if (!dedupedMap.has(m.id)) {
        dedupedMap.set(m.id, m);
      }
    });

    // SORT by createdAt ASC (oldest first) — matches internal storage convention.
    // Reads will iterate this in reverse to surface newest first.
    const sortedMeasurements = Array.from(dedupedMap.values()).sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateA - dateB; // ASC
    });

    // MEMORY FIX: Trim to CACHE_SIZE to prevent unbounded memory growth.
    // Keep only the most recent CACHE_SIZE measurements (tail of ASC array).
    const trimmedMeasurements = sortedMeasurements.length > CACHE_SIZE
      ? sortedMeasurements.slice(sortedMeasurements.length - CACHE_SIZE)
      : sortedMeasurements;
    const trimmedCount = sortedMeasurements.length - trimmedMeasurements.length;
    
    // Build final result from trimmed list
    const byId = new Map<string, Measurement>();
    trimmedMeasurements.forEach(m => byId.set(m.id, m));
    const ids = trimmedMeasurements.map(m => m.id);

    if (trimmedCount > 0) {
      logger.log(`🧹 Cache trimmed: ${sortedMeasurements.length} → ${trimmedMeasurements.length} (removed ${trimmedCount} old entries)`);
    }
    logger.debug(`🔀 Merged measurements: ${this.cache.size} existing + ${this.pendingDuringLoad.size} pending + ${historicalData.byId.size} historical = ${byId.size} total (capped at ${CACHE_SIZE})`);

    return { byId, ids };
  }

  /**
   * Handle batch complete from worker
   * PERFORMANCE FIX: Don't reload from IndexedDB - cache already updated via addMeasurement()
   */
  private handleBatchComplete(data: BatchCompleteData): void {
    if (!this.currentSurveyId) return;

    // Cache was already updated when measurements were logged via addMeasurement()
    // This event just confirms the worker successfully wrote to IndexedDB
    // No need to query IndexedDB - that would recreate the original bottleneck!
    
    // Just invalidate memoized caches so stats refresh
    this.invalidateCaches();
    
    // Notify subscribers for UI update
    this.notifySubscribers();

    logger.debug(`✅ Batch complete: ${data.count} measurements written to IndexedDB`);
  }

  /**
   * Add measurement to cache (called immediately when logged, before worker batch)
   * CRITICAL: During initial load, queues to pendingDuringLoad for later merge
   */
  addMeasurement(measurement: Measurement): void {
    if (!this.currentSurveyId) return;
    if (measurement.user_id !== this.currentSurveyId) return;

    // CRITICAL: If loading initial data, queue to pending for merge
    // This ensures optimistic inserts survive the async DB load and reconciliation
    if (this.isLoadingInitialData) {
      this.pendingDuringLoad.set(measurement.id, measurement);

      // Also add to cache for immediate zero-lag UI
      // The reconcile will merge this properly later
      const isDup = this.cache.has(measurement.id);
      this.cache.set(measurement.id, measurement);
      if (!isDup) this.sortedIds.push(measurement.id); // O(1) — ASC order

      // Invalidate and notify for immediate UI update
      this.invalidateCaches();
      this.notifySubscribers();

      logger.debug(`➕ Queued measurement ${measurement.id} to pending (loading in progress)`);
      return;
    }

    // NORMAL PATH: Dedupe via Map (O(1)) and append to ASC array (O(1)).
    // Duplicates are rare during live logging (every laser hit is a fresh UUID),
    // so we skip the indexOf/splice rebalance and just refresh the cache value.
    // The displayed value comes from `cache`, so the correct payload still wins.
    const isDuplicate = this.cache.has(measurement.id);
    this.cache.set(measurement.id, measurement);
    if (!isDuplicate) {
      this.sortedIds.push(measurement.id);
    }

    // Trim cache if over size limit. Only fires past CACHE_SIZE (5000), so this
    // is not on the hot path for typical surveys.
    if (this.cache.size > CACHE_SIZE) {
      // Drop the oldest entry (front of ASC array). One shift per overflow.
      const oldestId = this.sortedIds.shift();
      if (oldestId) this.cache.delete(oldestId);
    }

    this.invalidateCaches();
    this.notifySubscribers();

    logger.debug(`➕ Added measurement ${measurement.id} to cache (size: ${this.cache.size})`);
  }

  /**
   * Remove measurement from cache (called when deleting)
   */
  removeMeasurement(id: string): boolean {
    if (!this.cache.has(id)) {
      return false;
    }

    this.cache.delete(id);
    const index = this.sortedIds.indexOf(id);
    if (index !== -1) {
      this.sortedIds.splice(index, 1);
    }

    // Also remove from pending if loading
    if (this.isLoadingInitialData) {
      this.pendingDuringLoad.delete(id);
    }

    this.invalidateCaches();
    this.notifySubscribers();

    logger.debug(`➖ Removed measurement ${id} from cache (size: ${this.cache.size})`);
    return true;
  }

  /**
   * Update measurement in cache (called when editing)
   */
  updateMeasurement(id: string, updatedMeasurement: Measurement): boolean {
    if (!this.cache.has(id)) {
      return false;
    }

    this.cache.set(id, updatedMeasurement);

    // Also update pending if loading
    if (this.isLoadingInitialData && this.pendingDuringLoad.has(id)) {
      this.pendingDuringLoad.set(id, updatedMeasurement);
    }

    this.invalidateCaches();
    this.notifySubscribers();

    logger.debug(`✏️ Updated measurement ${id} in cache`);
    return true;
  }

  /**
   * Get all measurements from cache (sorted by createdAt DESC, newest first).
   * Internal storage is ASC, so we iterate in reverse here.
   *
   * PERF: cached. First call after an add/update/delete rebuilds the array;
   * all subsequent calls return the same reference until the next mutation.
   * Safe because invalidateCaches() clears this on every mutating op.
   */
  getMeasurements(): Measurement[] {
    if (this.measurementsArrayCache) {
      return this.measurementsArrayCache;
    }
    const out: Measurement[] = [];
    for (let i = this.sortedIds.length - 1; i >= 0; i--) {
      const m = this.cache.get(this.sortedIds[i]);
      if (m) out.push(m);
    }
    this.measurementsArrayCache = out;
    return out;
  }

  /**
   * Get the most recent N measurements (newest first).
   *
   * PERF: piggyback on the getMeasurements() cache when possible so both
   * methods share the same rebuild cost. A simple slice of the cached full
   * array is the fastest path; we only take the manual reverse-iteration
   * route when no cache is available and the limit is smaller than the
   * total (to save building the whole array just for a partial read).
   */
  getMeasurementsWithLimit(limit: number): Measurement[] {
    // Fast path: cached full array already exists — just slice.
    if (this.measurementsArrayCache) {
      return this.measurementsArrayCache.slice(0, limit);
    }
    // If the cache hasn't been built and limit >= total, building the full
    // array populates the cache for everyone. That's a good trade.
    if (limit >= this.sortedIds.length) {
      return this.getMeasurements();
    }
    // Otherwise read only what's needed without populating the full cache.
    const out: Measurement[] = [];
    const start = this.sortedIds.length - 1;
    const end = Math.max(-1, start - limit);
    for (let i = start; i > end; i--) {
      const m = this.cache.get(this.sortedIds[i]);
      if (m) out.push(m);
    }
    return out;
  }

  /**
   * Get measurement by ID
   */
  getMeasurement(id: string): Measurement | undefined {
    return this.cache.get(id);
  }

  /**
   * Get measurements for map (limited to last N, newest first).
   */
  getMapMeasurements(limit = 100): Measurement[] {
    const out: Measurement[] = [];
    for (let i = this.sortedIds.length - 1; i >= 0 && out.length < limit; i--) {
      const m = this.cache.get(this.sortedIds[i]);
      if (m && m.latitude !== 0 && m.longitude !== 0) out.push(m);
    }
    return out;
  }

  /**
   * Get memoized statistics
   */
  getStats(): MeasurementStats {
    if (this.statsCache) {
      return this.statsCache;
    }

    const measurements = this.getMeasurements();
    
    this.statsCache = {
      total: measurements.length,
      autoCapture: measurements.filter(m => m.poi_type?.startsWith('auto_')).length,
      modal: measurements.filter(m => !m.poi_type?.startsWith('auto_') && !m.poi_type?.startsWith('measurement_free_')).length,
      measurementFree: measurements.filter(m => m.poi_type?.startsWith('measurement_free_')).length,
      lastUpdateTime: Date.now()
    };

    return this.statsCache;
  }

  /**
   * Get POI type counts.
   *
   * PERF: cached. Cleared by invalidateCaches() on every mutation. Shares the
   * cached getMeasurements() array so subscribers that need both only pay the
   * O(n) once, across both calls.
   */
  getPOITypeCounts(): Record<string, number> {
    if (this.poiTypeCountsCache) {
      return this.poiTypeCountsCache;
    }
    const measurements = this.getMeasurements();
    const counts: Record<string, number> = {};

    measurements.forEach(m => {
      if (m.poi_type) {
        counts[m.poi_type] = (counts[m.poi_type] || 0) + 1;
      }
    });

    this.poiTypeCountsCache = counts;
    return counts;
  }

  /**
   * Filter measurements by POI type
   */
  filterByPOIType(poiType: string): Measurement[] {
    return this.getMeasurements().filter(m => m.poi_type === poiType);
  }

  /**
   * Filter measurements by search query
   */
  filterBySearch(query: string): Measurement[] {
    const lowerQuery = query.toLowerCase();
    return this.getMeasurements().filter(m => {
      return (
        m.note?.toLowerCase().includes(lowerQuery) ||
        m.poi_type?.toLowerCase().includes(lowerQuery) ||
        m.roadNumber?.toString().includes(lowerQuery) ||
        m.poiNumber?.toString().includes(lowerQuery)
      );
    });
  }

  /**
   * Get map clusters (memoized)
   * Groups nearby measurements for better map performance
   */
  getMapClusters(zoomLevel = 12): MapCluster[] {
    if (this.mapClustersCache) {
      return this.mapClustersCache;
    }

    const measurements = this.getMapMeasurements(100);
    const clusters: Map<string, MapCluster> = new Map();

    // Simple grid-based clustering
    const gridSize = 0.001 * Math.pow(2, 12 - zoomLevel); // Adjust grid based on zoom

    measurements.forEach(m => {
      if (m.latitude === 0 && m.longitude === 0) return;

      // Round to grid
      const gridLat = Math.round(m.latitude / gridSize) * gridSize;
      const gridLng = Math.round(m.longitude / gridSize) * gridSize;
      const gridKey = `${gridLat},${gridLng}`;

      if (!clusters.has(gridKey)) {
        clusters.set(gridKey, {
          id: gridKey,
          latitude: gridLat,
          longitude: gridLng,
          count: 0,
          measurements: []
        });
      }

      const cluster = clusters.get(gridKey)!;
      cluster.count++;
      cluster.measurements.push(m);
    });

    this.mapClustersCache = Array.from(clusters.values());
    return this.mapClustersCache;
  }

  /**
   * Subscribe to cache updates
   */
  subscribe(callback: Subscriber): () => void {
    this.subscribers.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Notify all subscribers
   */
  private notifySubscribers(): void {
    this.subscribers.forEach(callback => {
      try {
        callback();
      } catch (error) {
        logger.error('❌ Subscriber callback error:', error);
      }
    });
  }

  /**
   * Invalidate memoized caches
   */
  private invalidateCaches(): void {
    this.statsCache = null;
    this.mapClustersCache = null;
    this.measurementsArrayCache = null;
    this.poiTypeCountsCache = null;
    this.lastCacheInvalidation = Date.now();
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Clear cache and reset (full reset - clears subscribers too)
   * Use resetCache() instead if you want to preserve subscribers
   */
  clear(): void {
    this.cache.clear();
    this.sortedIds = [];
    this.currentSurveyId = null;
    this.invalidateCaches();
    this.subscribers.clear();
    
    if (this.workerUnsubscribe) {
      this.workerUnsubscribe();
      this.workerUnsubscribe = null;
    }
    
    this.initialized = false;
    logger.log('🗑️ MeasurementFeed cleared');
  }

  /**
   * Reset cache data while preserving subscribers
   * MEMORY FIX: Use this for survey close/switch to release memory
   * but keep React component subscriptions active
   */
  resetCache(): void {
    const subscriberCount = this.subscribers.size;
    
    // Clear measurement data
    this.cache.clear();
    this.sortedIds = [];
    this.pendingDuringLoad.clear();
    this.currentSurveyId = null;
    this.invalidateCaches();
    
    // Unsubscribe from worker (will be re-established on next init)
    if (this.workerUnsubscribe) {
      this.workerUnsubscribe();
      this.workerUnsubscribe = null;
    }
    
    this.initialized = false;
    this.isLoadingInitialData = false;
    
    // NOTE: Subscribers are preserved! Components stay subscribed.
    // They will receive updates when a new survey is loaded.
    
    // Notify subscribers that cache is now empty
    this.notifySubscribers();
    
    logger.log(`🗑️ MeasurementFeed cache reset (${subscriberCount} subscribers preserved)`);
  }

  /**
   * Force refresh from IndexedDB (for manual refresh button)
   */
  async refresh(): Promise<void> {
    if (!this.currentSurveyId) return;
    
    logger.log('🔄 Manual refresh triggered');
    await this.loadInitialData();
    this.invalidateCaches();
    this.notifySubscribers();
  }
}

// Singleton instance
let instance: MeasurementFeed | null = null;

/**
 * Get the singleton measurement feed
 */
export function getMeasurementFeed(): MeasurementFeed {
  if (!instance) {
    instance = new MeasurementFeed();
  }
  return instance;
}

/**
 * Create a new MeasurementFeed instance for testing
 * @internal For testing purposes only
 */
export function createMeasurementFeedForTest(): MeasurementFeed {
  return new MeasurementFeed();
}

export type { MeasurementStats, MapCluster };
