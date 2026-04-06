/**
 * Dry Run Detection Engine
 * Processes point cloud data in real-time to detect obstacles in defined zones
 */

import type { Point3D } from '@/lib/lidar/types';
import type { 
  DetectionZone, 
  SimpleThreshold, 
  DetectionEvent,
  DetectionSide,
  BoundingBox3D
} from './types';
import { getDryRunStore } from './store';
import { soundManager } from '@/lib/sounds';

interface DetectionResult {
  zoneId: string;
  side: DetectionSide;
  triggered: boolean;
  pointCount: number;
  closestPoint: Point3D | null;
  closestDistance: number;
  averageHeight: number;
}

class DryRunDetector {
  private lastAlertTimes: Map<string, number> = new Map();
  private eventCallbacks: Set<(event: DetectionEvent) => void> = new Set();
  
  isPointInBox(point: Point3D, box: BoundingBox3D, zone?: DetectionZone): boolean {
    if (point.x < box.xMin || point.x > box.xMax) return false;
    if (point.y < box.yMin || point.y > box.yMax) return false;
    if (point.z < box.zMin || point.z > box.zMax) return false;
    
    if (zone?.ignoreAboveHeight && point.z > zone.ignoreAboveHeight) return false;
    if (zone?.ignoreBelowHeight && point.z < zone.ignoreBelowHeight) return false;
    
    return true;
  }
  
  isPointInSimpleThreshold(point: Point3D, threshold: SimpleThreshold): boolean {
    let lateralDistance: number;
    
    switch (threshold.side) {
      case 'left':
        if (point.y >= 0) return false;
        lateralDistance = Math.abs(point.y);
        break;
      case 'right':
        if (point.y <= 0) return false;
        lateralDistance = point.y;
        break;
      case 'rear':
        if (point.x >= 0) return false;
        lateralDistance = Math.abs(point.x);
        break;
      default:
        return false;
    }
    
    if (lateralDistance > threshold.distanceMeters) return false;
    
    if (threshold.minHeight && point.z < threshold.minHeight) return false;
    if (threshold.maxHeight && point.z > threshold.maxHeight) return false;
    
    return true;
  }
  
  processPointCloud(points: Point3D[]): DetectionResult[] {
    const config = getDryRunStore().config;
    if (!config.enabled || points.length === 0) return [];
    
    const results: DetectionResult[] = [];
    
    for (const zone of config.zones) {
      if (!zone.enabled) continue;
      
      const pointsInZone: Point3D[] = [];
      let closestPoint: Point3D | null = null;
      let closestDistance = Infinity;
      let totalHeight = 0;
      
      for (const point of points) {
        if (this.isPointInBox(point, zone.box, zone)) {
          pointsInZone.push(point);
          totalHeight += point.z;
          
          const distance = Math.sqrt(point.x * point.x + point.y * point.y + point.z * point.z);
          if (distance < closestDistance) {
            closestDistance = distance;
            closestPoint = point;
          }
        }
      }
      
      const triggered = pointsInZone.length >= zone.alertThreshold;
      
      results.push({
        zoneId: zone.id,
        side: zone.side,
        triggered,
        pointCount: pointsInZone.length,
        closestPoint,
        closestDistance: closestDistance === Infinity ? 0 : closestDistance,
        averageHeight: pointsInZone.length > 0 ? totalHeight / pointsInZone.length : 0,
      });
    }
    
    for (const threshold of config.simpleThresholds) {
      if (!threshold.enabled) continue;
      
      const thresholdId = `threshold-${threshold.side}`;
      const pointsInThreshold: Point3D[] = [];
      let closestPoint: Point3D | null = null;
      let closestDistance = Infinity;
      let totalHeight = 0;
      
      for (const point of points) {
        if (this.isPointInSimpleThreshold(point, threshold)) {
          pointsInThreshold.push(point);
          totalHeight += point.z;
          
          const distance = Math.sqrt(point.x * point.x + point.y * point.y);
          if (distance < closestDistance) {
            closestDistance = distance;
            closestPoint = point;
          }
        }
      }
      
      const triggered = pointsInThreshold.length > 0;
      
      results.push({
        zoneId: thresholdId,
        side: threshold.side,
        triggered,
        pointCount: pointsInThreshold.length,
        closestPoint,
        closestDistance: closestDistance === Infinity ? 0 : closestDistance,
        averageHeight: pointsInThreshold.length > 0 ? totalHeight / pointsInThreshold.length : 0,
      });
    }
    
    return results;
  }
  
  handleDetectionResults(results: DetectionResult[]): DetectionEvent[] {
    const store = getDryRunStore();
    const config = store.config;
    const events: DetectionEvent[] = [];
    const now = Date.now();
    
    for (const result of results) {
      store.updateDetectionState({
        zoneId: result.zoneId,
        side: result.side,
        isTriggered: result.triggered,
        pointCount: result.pointCount,
        lastTriggeredAt: result.triggered ? now : null,
        closestPoint: result.closestPoint,
      });
      
      if (!result.triggered) continue;
      
      const zone = config.zones.find(z => z.id === result.zoneId);
      const cooldownMs = zone?.cooldownMs ?? 3000;
      
      const lastAlert = this.lastAlertTimes.get(result.zoneId) ?? 0;
      if (now - lastAlert < cooldownMs) continue;
      
      this.lastAlertTimes.set(result.zoneId, now);
      
      this.playAlertSound(result.side);
      
      const event: DetectionEvent = {
        id: crypto.randomUUID(),
        timestamp: now,
        zone: zone || config.simpleThresholds.find(t => `threshold-${t.side}` === result.zoneId)!,
        side: result.side,
        pointCount: result.pointCount,
        closestPointDistance: result.closestDistance,
        averageHeight: result.averageHeight,
        poiCreated: false,
      };
      
      events.push(event);
      store.addDetectionEvent(event);
      
      this.notifyCallbacks(event);
    }
    
    return events;
  }
  
  playAlertSound(side: DetectionSide) {
    switch (side) {
      case 'left':
        soundManager.playWarning();
        console.log('[DryRun] LEFT side detection alert');
        break;
      case 'right':
        soundManager.playCritical();
        console.log('[DryRun] RIGHT side detection alert');
        break;
      case 'rear':
        soundManager.playEmergency();
        console.log('[DryRun] REAR detection alert');
        break;
    }
  }
  
  onDetection(callback: (event: DetectionEvent) => void) {
    this.eventCallbacks.add(callback);
    return () => this.eventCallbacks.delete(callback);
  }
  
  private notifyCallbacks(event: DetectionEvent) {
    for (const callback of this.eventCallbacks) {
      try {
        callback(event);
      } catch (e) {
        console.error('[DryRun] Callback error:', e);
      }
    }
  }
  
  reset() {
    this.lastAlertTimes.clear();
    getDryRunStore().clearRecentEvents();
  }
}

export const dryRunDetector = new DryRunDetector();
