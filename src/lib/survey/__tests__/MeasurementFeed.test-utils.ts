/**
 * Test utilities for MeasurementFeed
 * Provides injectable dependencies for deterministic testing
 */

import type { Measurement } from '../types';

export interface StorageAdapter {
  loadRecentMeasurements(surveyId: string, limit: number): Promise<Measurement[]>;
}

export interface LoggerAdapter {
  onBatchComplete(callback: (data: any) => void): () => void;
}

/**
 * In-memory storage adapter for testing
 * Supports controllable delays to simulate slow IndexedDB loads
 */
export class InMemoryStorageAdapter implements StorageAdapter {
  private measurements: Map<string, Measurement[]> = new Map();
  private loadDelay = 0;

  constructor(private data: Record<string, Measurement[]> = {}, delay = 0) {
    Object.entries(data).forEach(([surveyId, items]) => {
      this.measurements.set(surveyId, items);
    });
    this.loadDelay = delay;
  }

  async loadRecentMeasurements(surveyId: string, limit: number): Promise<Measurement[]> {
    // Simulate async delay
    if (this.loadDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.loadDelay));
    }

    const data = this.measurements.get(surveyId) || [];
    return data.slice(0, limit);
  }

  addMeasurement(surveyId: string, measurement: Measurement): void {
    if (!this.measurements.has(surveyId)) {
      this.measurements.set(surveyId, []);
    }
    this.measurements.get(surveyId)!.push(measurement);
  }
}

/**
 * Mock logger adapter for testing
 */
export class MockLoggerAdapter implements LoggerAdapter {
  private callbacks: Set<(data: any) => void> = new Set();

  onBatchComplete(callback: (data: any) => void): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  triggerBatchComplete(data: any): void {
    this.callbacks.forEach(cb => cb(data));
  }

  getCallbackCount(): number {
    return this.callbacks.size;
  }
}

/**
 * Helper to create mock measurement
 */
export function createMockMeasurement(overrides: Partial<Measurement> = {}): Measurement {
  return {
    id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    user_id: 'test-survey',
    value: 100,
    unit: 'cm',
    type: 'distance',
    latitude: 45.5,
    longitude: -73.5,
    altitude: 50,
    accuracy: 10,
    notes: '',
    photo_url: null,
    device_id: 'test-device',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

/**
 * Delay helper for simulating slow operations
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
