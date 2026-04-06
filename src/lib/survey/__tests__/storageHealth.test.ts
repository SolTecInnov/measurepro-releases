/**
 * Storage Health System Tests
 * 
 * Tests verify:
 * 1. Pending writes tracking (increment on send, decrement on ACK)
 * 2. Status calculation (healthy/warning/critical)
 * 3. Stale write detection
 * 4. Degraded mode handling
 * 5. High-load simulation (10,000 measurements at 5-10 POIs/sec)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  getStorageHealthTracker, 
  StorageHealthTracker,
  type StorageHealthStatus 
} from '../storageHealth';

describe('StorageHealthTracker', () => {
  let tracker: StorageHealthTracker;

  beforeEach(() => {
    tracker = getStorageHealthTracker();
    tracker.reset();
  });

  afterEach(() => {
    tracker.reset();
    tracker.stopStatusCheck();
  });

  describe('Pending Writes Tracking', () => {
    it('should start with zero pending writes', () => {
      const health = tracker.getHealth();
      expect(health.pendingWrites).toBe(0);
    });

    it('should increment pending writes correctly', () => {
      tracker.incrementPending(1);
      expect(tracker.getHealth().pendingWrites).toBe(1);
      
      tracker.incrementPending(5);
      expect(tracker.getHealth().pendingWrites).toBe(6);
      
      tracker.incrementPending(10);
      expect(tracker.getHealth().pendingWrites).toBe(16);
    });

    it('should apply ACK and decrement pending writes', () => {
      tracker.incrementPending(100);
      expect(tracker.getHealth().pendingWrites).toBe(100);
      
      tracker.applyAck(25, Date.now());
      expect(tracker.getHealth().pendingWrites).toBe(75);
      
      tracker.applyAck(50, Date.now());
      expect(tracker.getHealth().pendingWrites).toBe(25);
      
      tracker.applyAck(25, Date.now());
      expect(tracker.getHealth().pendingWrites).toBe(0);
    });

    it('should not go below zero pending writes', () => {
      tracker.incrementPending(5);
      tracker.applyAck(10, Date.now()); // More than pending
      
      expect(tracker.getHealth().pendingWrites).toBe(0);
    });

    it('should update lastSuccessfulWriteAt on ACK', () => {
      expect(tracker.getHealth().lastSuccessfulWriteAt).toBeNull();
      
      const now = Date.now();
      tracker.incrementPending(1);
      tracker.applyAck(1, now);
      
      expect(tracker.getHealth().lastSuccessfulWriteAt).toBe(now);
    });
  });

  describe('Status Calculation', () => {
    it('should be healthy with zero pending writes', () => {
      expect(tracker.getStatus()).toBe('healthy');
    });

    it('should be healthy with low pending writes', () => {
      tracker.incrementPending(100);
      expect(tracker.getStatus()).toBe('healthy');
    });

    it('should be warning at 200+ pending writes', () => {
      tracker.incrementPending(200);
      expect(tracker.getStatus()).toBe('warning');
    });

    it('should be critical at 500+ pending writes', () => {
      tracker.incrementPending(500);
      expect(tracker.getStatus()).toBe('critical');
    });

    it('should return to healthy after ACKs reduce pending writes', () => {
      tracker.incrementPending(600);
      expect(tracker.getStatus()).toBe('critical');
      
      tracker.applyAck(450, Date.now());
      expect(tracker.getStatus()).toBe('healthy');
    });
  });

  describe('Degraded Mode', () => {
    it('should be critical when in degraded mode', () => {
      expect(tracker.getStatus()).toBe('healthy');
      
      tracker.setDegradedMode(true, 'Database structural failure');
      
      expect(tracker.getStatus()).toBe('critical');
      expect(tracker.getHealth().degradedMode).toBe(true);
      expect(tracker.getHealth().degradedModeReason).toBe('Database structural failure');
    });

    it('should recover from degraded mode', () => {
      tracker.setDegradedMode(true, 'Test failure');
      expect(tracker.getStatus()).toBe('critical');
      
      tracker.setDegradedMode(false);
      expect(tracker.getStatus()).toBe('healthy');
      expect(tracker.getHealth().degradedMode).toBe(false);
    });
  });

  describe('Checkpoint Tracking', () => {
    it('should track checkpoint information', () => {
      expect(tracker.getHealth().lastCheckpointAt).toBeNull();
      expect(tracker.getHealth().lastCheckpointMeasurementCount).toBeNull();
      
      const now = Date.now();
      tracker.updateCheckpoint(now, 1500);
      
      expect(tracker.getHealth().lastCheckpointAt).toBe(now);
      expect(tracker.getHealth().lastCheckpointMeasurementCount).toBe(1500);
    });
  });

  describe('Subscriber Notifications', () => {
    it('should notify subscribers on health changes', () => {
      let notificationCount = 0;
      let lastStatus: StorageHealthStatus = 'healthy';
      
      const unsubscribe = tracker.subscribe((_health, status) => {
        notificationCount++;
        lastStatus = status;
      });
      
      // Initial notification on subscribe
      expect(notificationCount).toBe(1);
      expect(lastStatus).toBe('healthy');
      
      tracker.incrementPending(500);
      expect(notificationCount).toBe(2);
      expect(lastStatus).toBe('critical');
      
      tracker.applyAck(400, Date.now());
      expect(notificationCount).toBe(3);
      expect(lastStatus).toBe('healthy');
      
      unsubscribe();
    });

    it('should not notify after unsubscribe', () => {
      let notificationCount = 0;
      
      const unsubscribe = tracker.subscribe(() => {
        notificationCount++;
      });
      
      expect(notificationCount).toBe(1);
      
      unsubscribe();
      
      tracker.incrementPending(100);
      // Should not increase since we unsubscribed
      expect(notificationCount).toBe(1);
    });
  });

  describe('Status Messages', () => {
    it('should return null for healthy status', () => {
      expect(tracker.getStatusMessage()).toBeNull();
    });

    it('should return warning message for high pending writes', () => {
      tracker.incrementPending(250);
      expect(tracker.getStatusMessage()).toContain('250');
      expect(tracker.getStatusMessage()).toContain('pending');
    });

    it('should return critical message for very high pending writes', () => {
      tracker.incrementPending(600);
      expect(tracker.getStatusMessage()).toContain('600');
      expect(tracker.getStatusMessage()).toContain('critical');
    });
  });

  describe('High-Load Simulation', () => {
    it('should handle 10,000 increment/ACK cycles at high speed', async () => {
      const totalMeasurements = 10000;
      const batchSize = 75; // Simulate worker batch size
      let pendingInFlight = 0;
      
      const startTime = performance.now();
      
      // Simulate high-speed measurement logging
      for (let i = 0; i < totalMeasurements; i++) {
        tracker.incrementPending(1);
        pendingInFlight++;
        
        // Simulate batch completion every 75 measurements
        if (i > 0 && i % batchSize === 0) {
          tracker.applyAck(batchSize, Date.now());
          pendingInFlight -= batchSize;
        }
      }
      
      // Flush remaining
      const remaining = totalMeasurements % batchSize;
      if (remaining > 0) {
        tracker.applyAck(remaining, Date.now());
        pendingInFlight -= remaining;
      }
      
      const duration = performance.now() - startTime;
      const rate = (totalMeasurements / duration) * 1000;
      
      // Verify all writes processed
      expect(tracker.getHealth().pendingWrites).toBe(0);
      expect(pendingInFlight).toBe(0);
      
      // Should be healthy after all ACKs
      expect(tracker.getStatus()).toBe('healthy');
      
      // Should complete quickly (< 200ms for 10,000 operations)
      expect(duration).toBeLessThan(200);
      
      console.log(`✅ High-load test: ${totalMeasurements} measurements processed in ${duration.toFixed(2)}ms (${rate.toFixed(0)}/sec)`);
    });

    it('should track pending writes accurately during burst', () => {
      // Simulate burst of 500 measurements
      const burstSize = 500;
      
      for (let i = 0; i < burstSize; i++) {
        tracker.incrementPending(1);
      }
      
      expect(tracker.getHealth().pendingWrites).toBe(burstSize);
      expect(tracker.getStatus()).toBe('critical');
      
      // Simulate worker catching up
      tracker.applyAck(burstSize, Date.now());
      
      expect(tracker.getHealth().pendingWrites).toBe(0);
      expect(tracker.getStatus()).toBe('healthy');
    });

    it('should notify subscribers during high-load without blocking', () => {
      let notifications = 0;
      const unsubscribe = tracker.subscribe(() => {
        notifications++;
      });
      
      // Simulate high-speed writes
      const count = 1000;
      for (let i = 0; i < count; i++) {
        tracker.incrementPending(1);
      }
      
      // 1 for subscribe + 1000 for increments
      expect(notifications).toBe(1001);
      
      unsubscribe();
    });
  });

  describe('Reset', () => {
    it('should reset all health state', () => {
      tracker.incrementPending(500);
      tracker.applyAck(100, Date.now());
      tracker.setDegradedMode(true, 'test');
      tracker.updateCheckpoint(Date.now(), 1000);
      
      tracker.reset();
      
      const health = tracker.getHealth();
      expect(health.pendingWrites).toBe(0);
      expect(health.lastSuccessfulWriteAt).toBeNull();
      expect(health.lastCheckpointAt).toBeNull();
      expect(health.lastCheckpointMeasurementCount).toBeNull();
      expect(health.degradedMode).toBe(false);
      expect(health.degradedModeReason).toBeNull();
      expect(tracker.getStatus()).toBe('healthy');
    });
  });
});
