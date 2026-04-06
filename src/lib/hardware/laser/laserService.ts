/**
 * Laser Service
 * Manages serial port connection and data streaming for laser devices
 * Uses Web Serial API for browser-based serial communication
 */

import {
  LaserProfileConfig,
  NormalizedLaserMeasurement,
  MeasurementListener,
  LaserServiceState,
  LaserDriver
} from './types';
import { createLaserDriver } from './driverFactory';

export class LaserService {
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private driver: LaserDriver;
  private listeners = new Set<MeasurementListener>();
  private running = false;
  private readLoopPromise: Promise<void> | null = null;

  constructor(private profile: LaserProfileConfig) {
    this.driver = createLaserDriver(profile);
  }

  getProfile(): LaserProfileConfig {
    return this.profile;
  }

  getState(): LaserServiceState {
    return {
      isConnected: this.port !== null && this.port.readable !== null,
      isStreaming: this.running,
      lastMeasurement: this.driver.getStats().lastMeasurement,
      error: null,
      stats: this.driver.getStats()
    };
  }

  addListener(fn: MeasurementListener): void {
    this.listeners.add(fn);
  }

  removeListener(fn: MeasurementListener): void {
    this.listeners.delete(fn);
  }

  private emit(measurement: NormalizedLaserMeasurement): void {
    for (const fn of this.listeners) {
      try {
        fn(measurement);
      } catch (err) {
        console.error('[LaserService] Listener error:', err);
      }
    }
  }

  async requestPort(): Promise<SerialPort | null> {
    if (!('serial' in navigator)) {
      throw new Error('Web Serial API not available in this browser. Use Chrome or Edge.');
    }

    try {
      const port = await (navigator as any).serial.requestPort({
        filters: [
          { usbVendorId: 0x1546 },
          { usbVendorId: 0x067B },
          { usbVendorId: 0x0403 },
          { usbVendorId: 0x10C4 },
        ]
      });
      return port;
    } catch (err: any) {
      if (err.name === 'NotFoundError') {
        return null;
      }
      throw err;
    }
  }

  async connect(port?: SerialPort): Promise<boolean> {
    if (!('serial' in navigator)) {
      throw new Error('Web Serial API not available in this browser.');
    }

    try {
      if (!port) {
        port = await this.requestPort() ?? undefined;
        if (!port) {
          return false;
        }
      }

      this.port = port;

      await this.port.open({
        baudRate: this.profile.baudRate,
        dataBits: this.profile.dataBits,
        stopBits: this.profile.stopBits,
        parity: this.profile.parity,
        flowControl: this.profile.flowControl === 'hardware' ? 'hardware' : 'none'
      });

      await this.driver.onOpen?.(this.port);
      
      console.log(`[LaserService] Connected to ${this.profile.name} at ${this.profile.baudRate} baud`);
      return true;
    } catch (err) {
      console.error('[LaserService] Connection error:', err);
      this.port = null;
      throw err;
    }
  }

  async startStreaming(): Promise<void> {
    if (!this.port || !this.port.readable) {
      throw new Error('Port not connected');
    }

    if (this.running) {
      console.warn('[LaserService] Already streaming');
      return;
    }

    await this.driver.startStreaming(this.port);
    this.running = true;
    this.reader = this.port.readable.getReader();

    this.readLoopPromise = this.readLoop();
    console.log('[LaserService] Streaming started');
  }

  private async readLoop(): Promise<void> {
    try {
      while (this.running && this.reader) {
        const { value, done } = await this.reader.read();
        if (done || !value) break;

        const measurements = this.driver.feedBytes(value);
        for (const m of measurements) {
          this.emit(m);
        }
      }
    } catch (err: any) {
      if (err.name !== 'NetworkError' && this.running) {
        console.error('[LaserService] Read loop error:', err);
      }
    } finally {
      if (this.reader) {
        try {
          this.reader.releaseLock();
        } catch {}
        this.reader = null;
      }
    }
  }

  async stopStreaming(): Promise<void> {
    this.running = false;

    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch {}
      try {
        this.reader.releaseLock();
      } catch {}
      this.reader = null;
    }

    if (this.port) {
      try {
        await this.driver.stopStreaming(this.port);
      } catch (err) {
        console.warn('[LaserService] Error stopping stream:', err);
      }
    }

    if (this.readLoopPromise) {
      try {
        await this.readLoopPromise;
      } catch {}
      this.readLoopPromise = null;
    }

    console.log('[LaserService] Streaming stopped');
  }

  async disconnect(): Promise<void> {
    await this.stopStreaming();

    if (this.port) {
      try {
        await this.port.close();
      } catch (err) {
        console.warn('[LaserService] Error closing port:', err);
      }
      this.port = null;
    }

    this.driver.reset();
    console.log('[LaserService] Disconnected');
  }

  getStats() {
    return this.driver.getStats();
  }
}

let globalLaserService: LaserService | null = null;

export function getGlobalLaserService(): LaserService | null {
  return globalLaserService;
}

export function setGlobalLaserService(service: LaserService | null): void {
  globalLaserService = service;
}
