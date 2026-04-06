import type { Sample, POI, MinimaPoint, Phase, Diagnostics } from './types';
import type { TAppCfg, TEventCfg } from './config.schema';
import { DefaultConfig, AppCfg } from './config.schema';
import { haversine, clusterByHeight, partitionCorridors } from './utils';

export class OverheadAggregator {
  private cfg: TAppCfg;
  
  private phase: Phase = 'IDLE';
  private baseline: number | null = null;
  private lastDistM: number | null = null;
  private lastSample: Sample | null = null;
  
  private skyStartT: number = 0;
  private solidStartT: number = 0;
  
  private eventStartT: number = 0;
  private eventStartLat: number = 0;
  private eventStartLon: number = 0;
  private sTraveled: number = 0;
  private dMin: number = Infinity;
  private minPoint: { s: number; d: number; t: number; lat: number; lon: number } | null = null;
  private minimaPoints: MinimaPoint[] = [];
  
  private holdStartT: number = 0;
  
  private currentTag: POI['kind'] | null = null;
  private pendingTag: POI['kind'] | null = null;
  
  private eventsEmittedTotal: number = 0;
  
  private utilPOIHistory: Array<{ lat: number; lon: number; s: number }> = [];
  private totalSCumulative: number = 0;
  
  // Watchdog tracking
  private lastLaserTs: number = 0;
  private winStart: number = 0;
  private laserPkCount: number = 0;
  private watchdogAborted: boolean = false;
  
  constructor(cfg?: Partial<TAppCfg>) {
    const STORAGE_KEY = 'overhead_detection_config';
    
    let loadedCfg = DefaultConfig;
    
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        loadedCfg = AppCfg.parse(parsed);
      }
    } catch (err) {
    }
    
    this.cfg = cfg ? this.mergeConfig(cfg) : loadedCfg;
  }
  
  private mergeConfig(patch: Partial<TAppCfg>): TAppCfg {
    const merged = { ...DefaultConfig, ...patch };
    if (patch.events) {
      merged.events = { ...DefaultConfig.events, ...patch.events };
    }
    if (patch.global) {
      merged.global = { ...DefaultConfig.global, ...patch.global };
    }
    return AppCfg.parse(merged);
  }
  
  /**
   * Call this on every raw laser packet arrival to track feed rate
   */
  onLaserPacket(tsMs: number): void {
    this.lastLaserTs = tsMs;
    this.laserPkCount++;
  }
  
  /**
   * Calculate laser feed rate over sliding 2s window
   */
  private laserHz(now: number): number | null {
    const WIN_MS = 2000;
    if (!this.winStart) this.winStart = now;
    const dt = now - this.winStart;
    if (dt >= WIN_MS) {
      const hz = this.laserPkCount / (dt / 1000);
      this.winStart = now;
      this.laserPkCount = 0;
      return hz;
    }
    return null; // not enough window yet
  }
  
  /**
   * Check if watchdog should abort/degrade current event
   */
  private checkWatchdog(now: number): { abort: boolean; degraded: boolean; reason?: string } {
    const { watchdog } = this.cfg.global;
    const hz = this.laserHz(now);
    const noLaser = (now - this.lastLaserTs) > watchdog.laserTimeoutMs;
    const lowHz = hz !== null && hz < watchdog.laserMinHz;
    
    if (this.phase === 'TRACKING' || this.phase === 'HOLD') {
      if (noLaser || lowHz) {
        const reason = noLaser 
          ? `Laser timeout (>${watchdog.laserTimeoutMs}ms)`
          : `Low feed rate (${hz?.toFixed(1)}Hz < ${watchdog.laserMinHz}Hz)`;
        
        if (watchdog.abortOnTimeout) {
          return { abort: true, degraded: false, reason };
        } else {
          return { abort: false, degraded: true, reason };
        }
      }
    }
    
    return { abort: false, degraded: false };
  }
  
  feed(sample: Sample): POI[] {
    const distM = this.normalizeDistance(sample);
    const isSky = distM === null;
    const now = sample.t;
    
    // Check watchdog
    const watchdogStatus = this.checkWatchdog(now);
    if (watchdogStatus.abort) {
      this.resetToIdle();
      this.watchdogAborted = true;
      this.lastDistM = distM;
      this.lastSample = sample;
      return [];
    }
    
    const currentEventCfg = this.getCurrentEventCfg(sample.speedKph);
    
    if (this.lastSample) {
      const deltaS = haversine(
        this.lastSample.lat, this.lastSample.lon,
        sample.lat, sample.lon
      );
      this.sTraveled += deltaS;
      this.totalSCumulative += deltaS;
    }
    
    this.updateBaseline(distM, isSky);
    
    const delta = this.baseline !== null && distM !== null
      ? this.baseline - distM
      : 0;
    
    let pois: POI[] = [];
    
    switch (this.phase) {
      case 'IDLE':
        pois = this.handleIdle(sample, distM, isSky, delta, now, currentEventCfg);
        break;
      case 'TRACKING':
        pois = this.handleTracking(sample, distM, isSky, delta, now, currentEventCfg);
        break;
      case 'HOLD':
        pois = this.handleHold(sample, distM, isSky, delta, now, currentEventCfg);
        break;
    }
    
    this.lastDistM = distM;
    this.lastSample = sample;
    
    return pois;
  }
  
  // Sky reading threshold - measurements at or below this are considered sky (noise/ground reflection)
  private static readonly SKY_READING_THRESHOLD_M = 0.1;

  private normalizeDistance(sample: Sample): number | null {
    const { rawDistM, status } = sample;
    const { maxRangeM, skyNearMaxFrac } = this.cfg.global;
    
    if (status?.noTarget || status?.overRange) return null;
    if (rawDistM === null || rawDistM === undefined) return null;
    if (rawDistM >= maxRangeM * skyNearMaxFrac) return null;
    
    // CRITICAL: Treat measurements <= 0.1m as sky for ALL laser types
    // This catches noise, ground reflections, or invalid readings
    if (rawDistM <= OverheadAggregator.SKY_READING_THRESHOLD_M) return null;
    
    return rawDistM;
  }
  
  private updateBaseline(distM: number | null, isSky: boolean): void {
    // For sky readings (null), use the configured sky distance value
    // This allows baseline to "relax upward" toward sky level between objects
    const effectiveDistM = distM !== null 
      ? distM 
      : this.cfg.global.skyDistanceM;
    
    if (this.baseline === null) {
      this.baseline = effectiveDistM;
      return;
    }
    
    const alpha = isSky || this.phase === 'IDLE'
      ? this.cfg.global.baselineAlphaSky
      : this.cfg.global.baselineAlphaObject;
    
    this.baseline = (1 - alpha) * this.baseline + alpha * effectiveDistM;
  }
  
  private getSpeedAdjustedCfg(baseCfg: TEventCfg, speedKph?: number): TEventCfg {
    if (!speedKph) return baseCfg;
    
    const { lowSpeedKph, highwayKph } = this.cfg.global;
    const adjusted = { ...baseCfg };
    
    if (speedKph > highwayKph) {
      // Scale event window dramatically for high speeds
      // At 120 km/h (33.3 m/s), need larger window to capture complete event
      const speedMultiplier = Math.min(speedKph / highwayKph, 3.0);
      adjusted.winEventMaxM = Math.floor(baseCfg.winEventMaxM * speedMultiplier);
      
      // Reduce hold time slightly for faster response
      adjusted.tEndMs = Math.max(100, baseCfg.tEndMs - 50);
    } else if (speedKph < lowSpeedKph) {
      // For slow speeds, tighten detection thresholds
      adjusted.dStart = Math.max(0.05, baseCfg.dStart - 0.05);
      adjusted.tEndMs = Math.min(1500, baseCfg.tEndMs + 100);
    }
    
    return adjusted;
  }
  
  private getCurrentEventCfg(speedKph?: number): TEventCfg {
    const tag = this.currentTag || 'overhead';
    const baseCfg = this.cfg.events[tag];
    return this.getSpeedAdjustedCfg(baseCfg, speedKph);
  }
  
  private handleIdle(
    sample: Sample,
    distM: number | null,
    isSky: boolean,
    delta: number,
    now: number,
    cfg: TEventCfg
  ): POI[] {
    if (isSky) {
      if (this.skyStartT === 0) {
        this.skyStartT = now;
      }
      this.solidStartT = 0;
    } else {
      const skyDuration = this.skyStartT > 0 ? now - this.skyStartT : 0;
      
      if (skyDuration >= this.cfg.global.skyMinBeforeStartMs) {
        if (this.solidStartT === 0) {
          this.solidStartT = now;
        }
        
        const solidDuration = now - this.solidStartT;
        
        if (solidDuration >= this.cfg.global.solidMinToStartMs && delta >= cfg.dStart) {
          this.startTracking(sample, distM!, now);
        }
      } else {
        this.skyStartT = 0;
        this.solidStartT = 0;
      }
    }
    
    return [];
  }
  
  private startTracking(sample: Sample, distM: number, now: number): void {
    this.phase = 'TRACKING';
    this.eventStartT = now;
    this.eventStartLat = sample.lat;
    this.eventStartLon = sample.lon;
    this.sTraveled = 0;
    this.dMin = distM;
    this.minPoint = { s: 0, d: distM, t: now, lat: sample.lat, lon: sample.lon };
    this.minimaPoints = [this.minPoint];
    this.skyStartT = 0;
    this.solidStartT = 0;
    
    if (this.pendingTag) {
      this.currentTag = this.pendingTag;
      this.pendingTag = null;
    }
  }
  
  private handleTracking(
    sample: Sample,
    distM: number | null,
    isSky: boolean,
    delta: number,
    now: number,
    cfg: TEventCfg
  ): POI[] {
    const tag = this.currentTag || 'overhead';
    const isWireTag = tag === 'wires_util' || tag === 'wires_hv';
    
    if (distM !== null && !isSky) {
      if (distM < this.dMin) {
        this.dMin = distM;
        this.minPoint = { s: this.sTraveled, d: distM, t: now, lat: sample.lat, lon: sample.lon };
      }
      
      if (isWireTag) {
        this.detectLocalMinima(sample, distM, now, cfg);
      }
    }
    
    const shouldEnd = isSky || delta <= cfg.dEnd || this.sTraveled >= cfg.winEventMaxM;
    
    if (shouldEnd) {
      this.phase = 'HOLD';
      this.holdStartT = now;
    }
    
    return [];
  }
  
  private detectLocalMinima(sample: Sample, distM: number, now: number, cfg: TEventCfg): void {
    const minDropForLocal = cfg.minDropForLocal || 0.12;
    
    if (distM < this.dMin - 0.01) {
      this.minimaPoints.push({ s: this.sTraveled, d: distM, t: now, lat: sample.lat, lon: sample.lon });
    } else if (this.minimaPoints.length > 0) {
      const lastMin = this.minimaPoints[this.minimaPoints.length - 1];
      const drop = lastMin.d - distM;
      
      if (drop >= minDropForLocal) {
        this.minimaPoints.push({ s: this.sTraveled, d: distM, t: now, lat: sample.lat, lon: sample.lon });
      }
    }
  }
  
  private handleHold(
    sample: Sample,
    distM: number | null,
    isSky: boolean,
    delta: number,
    now: number,
    cfg: TEventCfg
  ): POI[] {
    const holdDuration = now - this.holdStartT;
    
    if (!isSky && distM !== null && delta >= cfg.dStart) {
      this.phase = 'TRACKING';
      this.holdStartT = 0;
      return [];
    }
    
    if (holdDuration >= cfg.tEndMs) {
      const pois = this.commitEvent();
      this.reset();
      return pois;
    }
    
    return [];
  }
  
  private commitEvent(): POI[] {
    if (!this.minPoint) return [];
    
    const tag = this.currentTag || 'overhead';
    const pois: POI[] = [];
    
    if (tag === 'wires_util' || tag === 'wires_hv') {
      pois.push(...this.commitWires(tag));
    } else {
      pois.push(this.createPOI(this.minPoint, tag));
    }
    
    this.eventsEmittedTotal += pois.length;
    return pois;
  }
  
  private commitWires(tag: 'wires_util' | 'wires_hv'): POI[] {
    const cfg = this.cfg.events[tag];
    const { cityMode } = this.cfg.global;
    
    let winCouloir = cfg.winCouloirM || 10;
    let minDropForLocal = cfg.minDropForLocal || 0.12;
    
    if (cityMode && tag === 'wires_util') {
      winCouloir = Math.max(winCouloir, this.cfg.global.winCouloirM_city);
      minDropForLocal = Math.max(minDropForLocal, this.cfg.global.minDropForLocal_city);
    }
    
    const corridors = partitionCorridors(this.minimaPoints, winCouloir);
    const pois: POI[] = [];
    
    for (const corridor of corridors) {
      if (corridor.length === 0) continue;
      
      if (tag === 'wires_hv') {
        const hvPOIs = this.commitHVCorridor(corridor, cfg);
        pois.push(...hvPOIs);
      } else {
        const lowest = corridor.reduce((min, p) => p.d < min.d ? p : min, corridor[0]);
        
        if (this.shouldEmitUtilPOI(lowest, tag)) {
          pois.push(this.createPOI(lowest, tag));
        }
      }
    }
    
    return pois;
  }
  
  private commitHVCorridor(corridor: MinimaPoint[], cfg: TEventCfg): POI[] {
    const minSepWire = cfg.minSepWireM || 0.25;
    const maxWires = cfg.maxWiresHV || 3;
    const { cityMode, hvIgnoreIfAboveM } = this.cfg.global;
    
    const lowest = corridor.reduce((min, p) => p.d < min.d ? p : min, corridor[0]);
    
    if (cityMode && lowest.d > hvIgnoreIfAboveM) {
      return [];
    }
    
    const clusters = clusterByHeight(corridor, minSepWire);
    const topClusters = clusters.slice(0, maxWires);
    
    const pois: POI[] = [];
    for (const cluster of topClusters) {
      const lowestInCluster = cluster.points.reduce((min, p) => p.d < min.d ? p : min, cluster.points[0]);
      pois.push(this.createPOI(lowestInCluster, 'wires_hv'));
    }
    
    return pois;
  }
  
  private shouldEmitUtilPOI(point: MinimaPoint, tag: 'wires_util'): boolean {
    const { cityMode, maxUtilLogsPer100m, minPOIDistM_city } = this.cfg.global;
    
    if (!cityMode) return true;
    
    const recentWindow = this.utilPOIHistory.filter(
      h => this.totalSCumulative - h.s <= 100
    );
    
    if (recentWindow.length >= maxUtilLogsPer100m) {
      return false;
    }
    
    if (this.utilPOIHistory.length > 0) {
      const last = this.utilPOIHistory[this.utilPOIHistory.length - 1];
      const dist = haversine(last.lat, last.lon, point.lat, point.lon);
      if (dist < minPOIDistM_city) {
        return false;
      }
    }
    
    this.utilPOIHistory.push({ lat: point.lat, lon: point.lon, s: this.totalSCumulative });
    
    this.utilPOIHistory = this.utilPOIHistory.filter(
      h => this.totalSCumulative - h.s <= 100
    );
    
    return true;
  }
  
  private createPOI(point: MinimaPoint, kind: POI['kind']): POI {
    const tags: string[] = [];
    if (this.cfg.global.cityMode) {
      tags.push('city_mode');
    }
    
    // CRITICAL FIX: Use crypto.randomUUID() for truly globally unique IDs
    // This survives component remounts and browser refreshes
    const id = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      id,
      kind,
      distance_m: Math.round(point.d * 100) / 100,
      lat: point.lat,
      lon: point.lon,
      s_from_start_m: point.s,
      t: point.t,
      source: 'laser',
      tags: tags.length > 0 ? tags : undefined
    };
  }
  
  setPendingTag(tag: POI['kind'] | null): void {
    this.pendingTag = tag;
  }
  
  setCurrentTag(tag: POI['kind'] | null): void {
    this.currentTag = tag;
  }
  
  clearCurrentTag(): void {
    this.currentTag = null;
  }
  
  setConfig(patch: Partial<TAppCfg>): void {
    this.cfg = this.mergeConfig(patch);
  }
  
  getConfig(): TAppCfg {
    return { ...this.cfg };
  }
  
  setCityMode(enabled: boolean): void {
    this.cfg.global.cityMode = enabled;
  }
  
  getCityMode(): boolean {
    return this.cfg.global.cityMode;
  }
  
  reset(): void {
    this.phase = 'IDLE';
    this.skyStartT = 0;
    this.solidStartT = 0;
    this.eventStartT = 0;
    this.sTraveled = 0;
    this.dMin = Infinity;
    this.minPoint = null;
    this.minimaPoints = [];
    this.holdStartT = 0;
    this.currentTag = null;
  }
  
  getDiagnostics(): Diagnostics {
    const now = this.lastSample?.t || 0;
    
    return {
      phase: this.phase,
      baseline: this.baseline,
      lastDistM: this.lastDistM,
      skySinceMs: this.skyStartT > 0 ? now - this.skyStartT : 0,
      solidSinceMs: this.solidStartT > 0 ? now - this.solidStartT : 0,
      dMinCurrent: this.phase === 'TRACKING' || this.phase === 'HOLD' ? this.dMin : null,
      sTraveledCurrent: this.phase === 'TRACKING' || this.phase === 'HOLD' ? this.sTraveled : 0,
      eventsEmittedTotal: this.eventsEmittedTotal
    };
  }
}
