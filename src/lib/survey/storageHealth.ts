/**
 * Storage Health Tracking Module
 * 
 * Tracks pending writes and last successful write time to detect storage issues.
 * Provides ACK-based tracking of measurement writes to prevent silent data loss.
 * 
 * CRITICAL: This module is the source of truth for storage health status.
 * UI components subscribe to this to show warnings when storage is backlogged.
 */

import { logger } from '../utils/logger';

export interface StorageHealth {
  pendingWrites: number;
  lastSuccessfulWriteAt: number | null;
  lastCheckpointAt: number | null;
  lastCheckpointMeasurementCount: number | null;
  degradedMode: boolean;
  degradedModeReason: string | null;
}

export type StorageHealthStatus = 'healthy' | 'warning' | 'critical';

type StorageHealthSubscriber = (health: StorageHealth, status: StorageHealthStatus) => void;

const PENDING_WRITES_WARNING_THRESHOLD = 200;
const PENDING_WRITES_CRITICAL_THRESHOLD = 500;
const STALE_WRITE_WARNING_MS = 2 * 60 * 1000; // 2 minutes (early warning)
const STALE_WRITE_CRITICAL_MS = 3 * 60 * 1000; // 3 minutes (banner turns critical/red per spec)

class StorageHealthTracker {
  private health: StorageHealth = {
    pendingWrites: 0,
    lastSuccessfulWriteAt: null,
    lastCheckpointAt: null,
    lastCheckpointMeasurementCount: null,
    degradedMode: false,
    degradedModeReason: null,
  };

  private subscribers: Set<StorageHealthSubscriber> = new Set();
  private statusCheckInterval: number | null = null;

  constructor() {
    // Start periodic status check (every 30 seconds)
    this.startStatusCheck();
  }

  /**
   * Increment pending writes counter
   * Called when measurements are sent to worker for saving
   */
  incrementPending(count: number = 1): void {
    this.health.pendingWrites += count;
    this.notifySubscribers();
    logger.debug(`📤 Storage: +${count} pending writes (total: ${this.health.pendingWrites})`);
  }

  /**
   * Apply ACK from worker - decrement pending and update last successful write
   * Called when worker confirms measurements were saved to IndexedDB
   */
  applyAck(savedCount: number, committedAt: number): void {
    this.health.pendingWrites = Math.max(0, this.health.pendingWrites - savedCount);
    this.health.lastSuccessfulWriteAt = committedAt;
    this.notifySubscribers();
    logger.debug(`✅ Storage: -${savedCount} pending writes (total: ${this.health.pendingWrites}), last write at ${new Date(committedAt).toLocaleTimeString()}`);
  }

  /**
   * Update checkpoint information
   * Called when a checkpoint is created
   */
  updateCheckpoint(checkpointAt: number, measurementCount: number): void {
    this.health.lastCheckpointAt = checkpointAt;
    this.health.lastCheckpointMeasurementCount = measurementCount;
    this.notifySubscribers();
    logger.log(`📸 Checkpoint recorded: ${measurementCount} measurements at ${new Date(checkpointAt).toLocaleTimeString()}`);
  }

  /**
   * Set degraded mode status
   * Called when worker enters degraded mode due to structural failure
   */
  setDegradedMode(degraded: boolean, reason: string | null = null): void {
    this.health.degradedMode = degraded;
    this.health.degradedModeReason = reason;
    this.notifySubscribers();
    
    if (degraded) {
      logger.error(`🚨 Storage entered DEGRADED MODE: ${reason}`);
    } else {
      logger.log(`✅ Storage exited degraded mode`);
    }
  }

  /**
   * Get current storage health
   */
  getHealth(): StorageHealth {
    return { ...this.health };
  }

  /**
   * Calculate current health status
   */
  getStatus(): StorageHealthStatus {
    const { pendingWrites, lastSuccessfulWriteAt, degradedMode } = this.health;

    // Degraded mode is always critical
    if (degradedMode) {
      return 'critical';
    }

    // Check pending writes threshold
    if (pendingWrites >= PENDING_WRITES_CRITICAL_THRESHOLD) {
      return 'critical';
    }

    // Check for stale writes (no successful write in threshold time)
    if (lastSuccessfulWriteAt !== null) {
      const timeSinceLastWrite = Date.now() - lastSuccessfulWriteAt;
      
      if (timeSinceLastWrite >= STALE_WRITE_CRITICAL_MS && pendingWrites > 0) {
        return 'critical';
      }
      
      if (timeSinceLastWrite >= STALE_WRITE_WARNING_MS && pendingWrites > 0) {
        return 'warning';
      }
    }

    // Check pending writes warning threshold
    if (pendingWrites >= PENDING_WRITES_WARNING_THRESHOLD) {
      return 'warning';
    }

    return 'healthy';
  }

  /**
   * Get human-readable status message
   */
  getStatusMessage(): string | null {
    const status = this.getStatus();
    const { pendingWrites, lastSuccessfulWriteAt, degradedMode, degradedModeReason } = this.health;

    if (status === 'healthy') {
      return null;
    }

    if (degradedMode) {
      return `Storage failure: ${degradedModeReason || 'Unknown error'}. Stop survey and export data immediately.`;
    }

    if (pendingWrites >= PENDING_WRITES_CRITICAL_THRESHOLD) {
      return `Storage backlog critical: ${pendingWrites} measurements pending. Stop survey and export data immediately.`;
    }

    if (lastSuccessfulWriteAt !== null) {
      const timeSinceLastWrite = Date.now() - lastSuccessfulWriteAt;
      const minutesSinceLastWrite = Math.floor(timeSinceLastWrite / 60000);
      
      if (timeSinceLastWrite >= STALE_WRITE_CRITICAL_MS && pendingWrites > 0) {
        return `No data saved for ${minutesSinceLastWrite} minutes! ${pendingWrites} measurements pending. Check storage.`;
      }
      
      if (timeSinceLastWrite >= STALE_WRITE_WARNING_MS && pendingWrites > 0) {
        return `Data not committed for ${minutesSinceLastWrite} minutes. ${pendingWrites} measurements pending.`;
      }
    }

    if (pendingWrites >= PENDING_WRITES_WARNING_THRESHOLD) {
      return `Storage backlog building: ${pendingWrites} measurements pending.`;
    }

    return null;
  }

  /**
   * Subscribe to health changes
   */
  subscribe(callback: StorageHealthSubscriber): () => void {
    this.subscribers.add(callback);
    
    // Immediately notify with current state
    callback(this.getHealth(), this.getStatus());
    
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Notify all subscribers of health change
   */
  private notifySubscribers(): void {
    const health = this.getHealth();
    const status = this.getStatus();
    
    this.subscribers.forEach(callback => {
      try {
        callback(health, status);
      } catch (error) {
        logger.error('Storage health subscriber error:', error);
      }
    });
  }

  /**
   * Start periodic status check to catch stale writes
   */
  private startStatusCheck(): void {
    if (this.statusCheckInterval !== null) {
      return;
    }

    this.statusCheckInterval = window.setInterval(() => {
      // Re-evaluate status and notify if changed
      const status = this.getStatus();
      
      if (status !== 'healthy') {
        this.notifySubscribers();
        
        // Log warning for critical status
        if (status === 'critical') {
          const message = this.getStatusMessage();
          logger.error(`🚨 STORAGE HEALTH CRITICAL: ${message}`);
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Stop periodic status check
   */
  stopStatusCheck(): void {
    if (this.statusCheckInterval !== null) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = null;
    }
  }

  /**
   * Reset health tracker (for testing or survey reset)
   */
  reset(): void {
    this.health = {
      pendingWrites: 0,
      lastSuccessfulWriteAt: null,
      lastCheckpointAt: null,
      lastCheckpointMeasurementCount: null,
      degradedMode: false,
      degradedModeReason: null,
    };
    this.notifySubscribers();
  }
}

// Singleton instance
let instance: StorageHealthTracker | null = null;

/**
 * Get the singleton storage health tracker
 */
export function getStorageHealthTracker(): StorageHealthTracker {
  if (!instance) {
    instance = new StorageHealthTracker();
  }
  return instance;
}

/**
 * Convenience function to get current health
 */
export function getStorageHealth(): StorageHealth {
  return getStorageHealthTracker().getHealth();
}

/**
 * Convenience function to get current status
 */
export function getStorageHealthStatus(): StorageHealthStatus {
  return getStorageHealthTracker().getStatus();
}

export { StorageHealthTracker };
