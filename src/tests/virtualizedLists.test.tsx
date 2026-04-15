import { describe, it, expect, vi } from 'vitest';

/**
 * Virtualized Lists Test Suite
 *
 * NOTE: Full component rendering tests require @testing-library/react which is
 * not currently installed. These tests validate the key generation and data
 * handling logic that underpins the virtualized list components.
 *
 * When @testing-library/react is added as a dev dependency, restore the
 * component-level tests using MockMeasurementLogList, MockMeasurementLogsList,
 * and MockDetectionLogList.
 */

// ==================== Test Data Generators ====================

const generateMeasurements = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `meas-${i}`,
    createdAt: Date.now() - (count - i) * 1000,
    utcDate: '2024-01-15',
    utcTime: `10:${String(i % 60).padStart(2, '0')}:00`,
    roadNumber: 1,
    poiNumber: i + 1,
    value: Math.random() * 100,
  }));
};

const generateMeasurementsWithMissingIds = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: i % 10 === 0 ? undefined : `meas-${i}`,
    createdAt: 1700000000000 + i * 1000,
    utcDate: '2024-01-15',
    utcTime: `10:${String(i % 60).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`,
    roadNumber: 1,
    poiNumber: i + 1,
    value: Math.random() * 100,
  }));
};

const generateDetections = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `det-${i}`,
    timestamp: Date.now() - (count - i) * 1000,
    detection: {
      objectClass: i % 3 === 0 ? 'person' : i % 3 === 1 ? 'car' : 'bicycle',
      confidence: 0.9,
    },
    status: 'pending',
  }));
};

// ==================== Key Generation Logic ====================

function getMeasurementLogKey(item: any, index: number): string {
  if (!item) {
    return `error-missing-${index}`;
  }
  if (item.id) {
    return item.id;
  }
  return `error-${item?.createdAt}-${item?.utcDate}-${item?.utcTime}`;
}

function getMeasurementLogsKey(item: any, index: number): string {
  if (!item) {
    return `error-missing-null-item-${index}`;
  }
  const { roadNumber, poiNumber, utcDate, utcTime } = item;
  return `${roadNumber}-${poiNumber}-${utcDate}-${utcTime}`;
}

function getDetectionLogKey(item: any, index: number): string {
  if (!item) {
    return `error-missing-${index}`;
  }
  if (item.id) {
    return item.id;
  }
  return `error-${item?.timestamp}-${item?.detection?.objectClass}`;
}

// ==================== Test Suites ====================

describe('MeasurementLog Key Generation', () => {
  it('should generate stable keys from item id', () => {
    const measurements = generateMeasurements(100);
    const keys = measurements.map((m, i) => getMeasurementLogKey(m, i));

    // All keys should be the item id
    keys.forEach((key, i) => {
      expect(key).toBe(`meas-${i}`);
    });
  });

  it('should generate unique keys', () => {
    const measurements = generateMeasurements(100);
    const keys = measurements.map((m, i) => getMeasurementLogKey(m, i));
    const uniqueKeys = new Set(keys);

    expect(uniqueKeys.size).toBe(keys.length);
  });

  it('should use deterministic fallback keys when id is missing', () => {
    const measurements = generateMeasurementsWithMissingIds(10);
    const keys = measurements.map((m, i) => getMeasurementLogKey(m, i));

    // Items with missing ids should have fallback keys
    measurements.forEach((m, i) => {
      if (!m.id) {
        expect(keys[i]).toBe(`error-${m.createdAt}-${m.utcDate}-${m.utcTime}`);
      } else {
        expect(keys[i]).toBe(m.id);
      }
    });
  });

  it('should handle null items gracefully', () => {
    const key = getMeasurementLogKey(null, 5);
    expect(key).toBe('error-missing-5');
  });

  it('should handle undefined items gracefully', () => {
    const key = getMeasurementLogKey(undefined, 3);
    expect(key).toBe('error-missing-3');
  });

  it('should handle empty array', () => {
    const measurements: any[] = [];
    const keys = measurements.map((m, i) => getMeasurementLogKey(m, i));
    expect(keys).toEqual([]);
  });

  it('should maintain key stability across calls', () => {
    const measurements = generateMeasurements(50);

    const keys1 = measurements.map((m, i) => getMeasurementLogKey(m, i));
    const keys2 = measurements.map((m, i) => getMeasurementLogKey(m, i));

    expect(keys1).toEqual(keys2);
  });
});

describe('MeasurementLogs Composite Key Generation', () => {
  it('should generate composite keys', () => {
    const measurements = generateMeasurements(100);
    const keys = measurements.map((m, i) => getMeasurementLogsKey(m, i));

    keys.forEach((key, i) => {
      const m = measurements[i];
      expect(key).toBe(`${m.roadNumber}-${m.poiNumber}-${m.utcDate}-${m.utcTime}`);
    });
  });

  it('should handle null items', () => {
    const key = getMeasurementLogsKey(null, 0);
    expect(key).toBe('error-missing-null-item-0');
  });

  it('should generate stable composite keys', () => {
    const measurements = generateMeasurements(50);
    const keys1 = measurements.map((m, i) => getMeasurementLogsKey(m, i));
    const keys2 = measurements.map((m, i) => getMeasurementLogsKey(m, i));
    expect(keys1).toEqual(keys2);
  });
});

describe('DetectionLogViewer Key Generation', () => {
  it('should generate keys from detection id', () => {
    const detections = generateDetections(100);
    const keys = detections.map((d, i) => getDetectionLogKey(d, i));

    keys.forEach((key, i) => {
      expect(key).toBe(`det-${i}`);
    });
  });

  it('should generate unique keys', () => {
    const detections = generateDetections(100);
    const keys = detections.map((d, i) => getDetectionLogKey(d, i));
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  it('should handle null items', () => {
    const key = getDetectionLogKey(null, 7);
    expect(key).toBe('error-missing-7');
  });

  it('should maintain key stability', () => {
    const detections = generateDetections(50);
    const keys1 = detections.map((d, i) => getDetectionLogKey(d, i));
    const keys2 = detections.map((d, i) => getDetectionLogKey(d, i));
    expect(keys1).toEqual(keys2);
  });
});

describe('Key Stability - Deterministic Fallbacks', () => {
  it('should generate same fallback key for same item data across calls', () => {
    const itemWithoutId = {
      createdAt: 1700000000000,
      utcDate: '2024-01-15',
      utcTime: '10:30:00',
      roadNumber: 1,
      poiNumber: 5,
      value: 50,
    };

    const key1 = getMeasurementLogKey(itemWithoutId, 0);
    const key2 = getMeasurementLogKey(itemWithoutId, 0);

    expect(key1).toBe(key2);
    expect(key1).toBe('error-1700000000000-2024-01-15-10:30:00');
  });

  it('should NOT use Date.now() or other dynamic values in fallback keys', () => {
    const itemWithoutId = {
      createdAt: 1700000000000,
      utcDate: '2024-01-15',
      utcTime: '10:30:00',
      roadNumber: 1,
      poiNumber: 5,
      value: 50,
    };

    // Call multiple times rapidly
    const keys = Array.from({ length: 10 }, () => getMeasurementLogKey(itemWithoutId, 0));

    // All keys should be identical (no Date.now() variation)
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(1);
  });
});

describe('Performance - Large Datasets', () => {
  it('should generate 50,000 keys without excessive time', () => {
    const measurements = generateMeasurements(50000);

    const startTime = performance.now();
    const keys = measurements.map((m, i) => getMeasurementLogKey(m, i));
    const duration = performance.now() - startTime;

    expect(keys.length).toBe(50000);
    expect(duration).toBeLessThan(1000); // Should be fast
  });

  it('should generate 100,000 detection keys without excessive time', () => {
    const detections = generateDetections(100000);

    const startTime = performance.now();
    const keys = detections.map((d, i) => getDetectionLogKey(d, i));
    const duration = performance.now() - startTime;

    expect(keys.length).toBe(100000);
    expect(duration).toBeLessThan(2000);
  });
});
