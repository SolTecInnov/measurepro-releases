import { LaserReader } from './readers/serialLaserReader';
import { GPSReader } from './readers/serialGPSReader';

export type MeasuringMode = 'normal' | 'fast' | 'precise' | 'natural';

interface MeasuringModeInfo {
  rate: string;
  accuracy: {
    fls10: string;
    fls30: string;
  };
  characteristics: string;
  applications: string;
}

export const MEASURING_MODES: Record<MeasuringMode, MeasuringModeInfo> = {
  normal: {
    rate: 'max. 10 Hz',
    accuracy: {
      fls10: '±1 mm',
      fls30: '±3 mm'
    },
    characteristics: 'Measuring range on natural surface: typical 65 m',
    applications: 'Various'
  },
  fast: {
    rate: 'max. 20 Hz',
    accuracy: {
      fls10: '±2 mm',
      fls30: '±6 mm'
    },
    characteristics: 'Increased measuring rate up to 20 Hz',
    applications: 'Positioning applications: Warehouse, Crane, etc'
  },
  precise: {
    rate: 'max. 6 Hz',
    accuracy: {
      fls10: '±0.8 mm',
      fls30: '±2.4 mm'
    },
    characteristics: 'Increased accuracy of ±0.8 mm',
    applications: 'Surveying applications, short range applications etc'
  },
  natural: {
    rate: '~0.3 Hz',
    accuracy: {
      fls10: '±5 mm',
      fls30: '±15 mm'
    },
    characteristics: 'Increased measuring range on natural surfaces: typical 80 meters',
    applications: 'Measuring against far away natural surfaces or bad reflective surfaces such as black synthetic granules, etc'
  }
};

export type LaserType = 'soltec-standard' | 'soltec-legacy';

export function migrateLaserType(stored: string): LaserType {
  const standardTypes = ['rsa-laser', 'soltec-new', 'ldm71-lidar2d-v2', 'high-pole', 'soltec-standard'];
  const legacyTypes = ['soltec-old', 'soltec-legacy'];
  if (standardTypes.includes(stored)) return 'soltec-standard';
  if (legacyTypes.includes(stored)) return 'soltec-legacy';
  console.warn(`[LaserType] Unknown value "${stored}", falling back to soltec-standard`);
  return 'soltec-standard';
}

export interface SerialConfig {
  baudRate: number;
  dataBits: number;
  stopBits: number;
  parity: ParityType;
  flowControl: "none" | "hardware";
}

export interface LaserPreset {
  config: SerialConfig;
  commands: {
    singleMeasure: string;
    continuousMeasure: string;
    stop: string;
    laserOn: string;
    laserOff: string;
    temperature: string;
    setMode: (mode: MeasuringMode) => string;
    startBuffer: (samplingTime: number) => string;
    readBuffer: string;
  };
}

// Hardware mapping:
//   soltec-standard → 115200 baud, 8N1, LDM71 ASCII driver — covers SolTec 30m, 70m, AR2700, High Pole
//   soltec-legacy   → 19200 baud, 7E1 — covers SolTec 10m (old unit)
// All lasers stream autonomously on 12V power-on — no start command required.
export const LASER_PRESETS: Record<LaserType, LaserPreset> = {
  'soltec-standard': {
    config: {
      baudRate: 115200,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      flowControl: 'none'
    },
    commands: {
      singleMeasure: 'DM\r',
      continuousMeasure: 'DT\r',
      stop: '\x1B',
      laserOn: 'LE\r',
      laserOff: 'LD\r',
      temperature: 'TP\r',
      setMode: () => '',
      startBuffer: () => 'DT\r',
      readBuffer: 'DM\r'
    }
  },
  'soltec-legacy': {
    config: {
      baudRate: 19200,
      dataBits: 7,
      stopBits: 1,
      parity: 'even',
      flowControl: 'none'
    },
    commands: {
      singleMeasure: 's0g',
      continuousMeasure: 's0h',
      stop: 's0c',
      laserOn: 's0o',
      laserOff: 's0C',
      temperature: 's0t',
      setMode: (mode) => {
        const modeMap = { normal: '0', fast: '1', precise: '2', natural: '3' };
        return `s0uc+0+${modeMap[mode]}`;
      },
      startBuffer: (time) => `s0f+${time}`,
      readBuffer: 's0q'
    }
  }
};

export class SerialConnection {
  private port: SerialPort | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private readLoopPromise: Promise<void> | null = null;
  private isDisconnecting: boolean = false;
  private availablePorts: SerialPort[] = [];
  private portInfo: Map<SerialPort, string> = new Map();
  private laserType: LaserType = 'soltec-legacy';
  private measuringMode: MeasuringMode = 'normal';
  private bufferSamplingTime: number = 0;
  private isTracking: boolean = false;
  private isBufferTracking: boolean = false;
  private bufferInterval: number | null = null;
  private connectionAttempts: number = 0;
  private lastConfig: SerialConfig | null = null;
  private laserReader: LaserReader | null = null;
  private gpsReader: GPSReader | null = null;
  private readonly MAX_ATTEMPTS: number = 3;
  private readonly ATTEMPT_DELAY: number = 1000;
  private readonly RESET_DELAY: number = 500;
  private readonly CLEANUP_DELAY: number = 100;
  private readonly MAX_BUFFER_SIZE = 8192;
  private dataCallbacks: Set<(data: string) => void> = new Set();
  private connectionStartTime: number | null = null;
  private lastMeasurementTime: number | null = null;
  private measurementCount: number = 0;
  private measurementFrequency: number = 0;
  private connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
  private lastError: string | null = null;
  private isGPS: boolean = false;
  private readonly GPS_CHUNK_SIZE = 256;
  private readonly GPS_PROCESS_DELAY = 50;
  private onDataCallback: ((data: string) => void) | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  constructor() {
    this.laserReader = new LaserReader();
    this.laserType = 'soltec-standard';
    // LaserReader constructor already calls setLaserType('soltec-standard') internally
    // — do NOT call it again here, it would create a second LDM71AsciiDriver instance
  }

  setAsGPS() {
    this.isGPS = true;
    this.gpsReader = new GPSReader();
    this.laserReader = null;
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.port || !this.writer) return false;
      const testCommand = this.laserType === 'soltec-legacy' ? 's0t' : 'T';

      return new Promise(async (resolve) => {
        const timeout = setTimeout(() => {
          this.onDataCallback = null;
          resolve(false);
        }, 2000);
        const testCallback = (data: string) => {
          if (data.trim().length > 0) {
            clearTimeout(timeout);
            this.onDataCallback = null;
            resolve(true);
          }
        };
        // Set callback BEFORE writing so we never miss a fast response
        this.onDataCallback = testCallback;
        try {
          await this.write(testCommand);
        } catch (_e) {
          clearTimeout(timeout);
          this.onDataCallback = null;
          resolve(false);
        }
      });
    } catch (error) {
      return false;
    }
  }

  private async ensurePortSelected(): Promise<boolean> {
    if (!this.port) {
      try {
        const ports = await navigator.serial.getPorts();
        if (ports.length > 0) {
          this.port = ports[0];
          return true;
        }
        
        const port = await this.requestNewPort();
        if (port) {
          this.port = port;
          return true;
        }
        
        return false;
      } catch (error) {
        return false;
      }
    }
    return true;
  }

  async resetPort(): Promise<void> {
    this.connectionAttempts = 0;
    
    try {
      if (this.isTracking || this.isBufferTracking) {
        await this.stopTracking();
      }
      await new Promise(resolve => setTimeout(resolve, this.CLEANUP_DELAY));

      await this.forceDisconnect();

      await new Promise(resolve => setTimeout(resolve, this.RESET_DELAY));
      
      this.reader = null;
      this.writer = null;
      this.port = null;
      this.isDisconnecting = false;
      this.isTracking = false;
      this.isBufferTracking = false;
      this.connectionAttempts = 0;
      this.lastConfig = null;
      
      if (this.bufferInterval) {
        clearInterval(this.bufferInterval);
        this.bufferInterval = null;
      }
      
      const ports = await navigator.serial.getPorts();
      for (const port of ports) {
        try {
          if (port.readable || port.writable) {
            await port.close();
          }
          if ('forget' in port) {
            await (port as any).forget();
          }
        } catch (error) {
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, this.RESET_DELAY));
      
      this.availablePorts = [];
      this.portInfo.clear();
      
    } catch (error) {
      throw error;
    }
  }

  setLaserType(type: LaserType) {
    this.laserType = type;
    return LASER_PRESETS[type].config;
  }

  getLaserType(): LaserType {
    return this.laserType;
  }

  async setMeasuringMode(mode: MeasuringMode): Promise<boolean> {
    const command = LASER_PRESETS[this.laserType].commands.setMode(mode);
    if (!command) return false;
    
    const success = await this.write(command);
    if (success) {
      this.measuringMode = mode;
    }
    return success;
  }

  getMeasuringMode(): MeasuringMode {
    return this.measuringMode;
  }

  async startSingleSensorTracking(): Promise<boolean> {
    if (this.isTracking || this.isBufferTracking) return false;
    
    const MIN_INTERVAL = 1000;
    let lastMeasurementTime = 0;
    
    const success = await this.write(LASER_PRESETS[this.laserType].commands.singleMeasure);
    if (success) {
      this.isTracking = true;
      const interval = setInterval(async () => {
        if (!this.isTracking) {
          clearInterval(interval);
          return;
        }
        
        const now = Date.now();
        if (now - lastMeasurementTime >= MIN_INTERVAL) {
          await this.write(LASER_PRESETS[this.laserType].commands.singleMeasure);
          lastMeasurementTime = now;
        }
      }, MIN_INTERVAL);
    }
    return success;
  }

  async startBufferTracking(samplingTime: number): Promise<boolean> {
    if (this.isTracking || this.isBufferTracking) return false;
    
    if (this.laserType !== 'soltec-legacy') {
      const success = await this.write(LASER_PRESETS[this.laserType].commands.continuousMeasure);
      if (success) {
        this.isBufferTracking = true;
        this.bufferSamplingTime = samplingTime;
      }
      return success;
    }
    
    const command = LASER_PRESETS[this.laserType].commands.startBuffer(samplingTime);
    const success = await this.write(command);
    if (success) {
      this.isBufferTracking = true;
      this.bufferSamplingTime = samplingTime;
    }
    return success;
  }

  async readBuffer(): Promise<boolean> {
    if (!this.isBufferTracking) return false;
    return this.write(LASER_PRESETS[this.laserType].commands.readBuffer);
  }

  async stopTracking(): Promise<boolean> {
    const success = await this.write(LASER_PRESETS[this.laserType].commands.stop);
    if (success) {
      this.isTracking = false;
      this.isBufferTracking = false;
      if (this.bufferInterval) {
        clearInterval(this.bufferInterval);
        this.bufferInterval = null;
      }
    }
    return success;
  }

  isTrackingActive(): boolean {
    return this.isTracking || this.isBufferTracking;
  }

  getBufferSamplingTime(): number {
    return this.bufferSamplingTime;
  }

  async listPorts(): Promise<SerialPort[]> {
    this.availablePorts = await navigator.serial.getPorts();
    for (const port of this.availablePorts) {
      const info = port.getInfo();
      if (info.usbVendorId) {
        this.portInfo.set(port, `COM Port (VID: ${info.usbVendorId}, PID: ${info.usbProductId})`);
      }
    }
    return this.availablePorts;
  }

  async requestNewPort(): Promise<SerialPort | null> {
    try {
      const filters = [
        { usbVendorId: 0x1546 },
        { usbVendorId: 0x067B },
        { usbVendorId: 0x0403 },
        { usbVendorId: 0x10C4 },
      ];
      
      const port = await navigator.serial.requestPort({ 
        filters: filters 
      });
      
      const info = port.getInfo();
      
      if (info.usbVendorId) {
        this.portInfo.set(port, `COM Port (VID: 0x${info.usbVendorId.toString(16)}, PID: 0x${info.usbProductId.toString(16)})`);
      } else {
        this.portInfo.set(port, `Serial Port (no VID/PID information)`);
      }
      
      if (!this.availablePorts.includes(port)) {
        this.availablePorts.push(port);
      }
      return port;
    } catch (error) {
      if (error.name === 'NotFoundError') {
        alert('No compatible serial devices found. Please make sure your device is connected and drivers are installed.');
      } else if (error.name === 'SecurityError' || error.name === 'NotAllowedError') {
        alert(`Serial port access was denied. Please ensure:\n\n1. MeasurePRO is running normally\n2. The serial device is properly connected via USB\n3. Try clicking the port selection again\n4. Check for a permission dialog that might be hidden`);
      } else if (error.name === 'SecurityError') {
        alert('Permission to access serial ports was denied. Please try again.');
      } else {
        alert(`Serial port error: ${error.message || 'Unknown error'}`);
      }
      return null;
    }
  }

  async connect(config: SerialConfig): Promise<boolean> {
    try {
      this.connectionStatus = 'connecting';

      // Always disconnect first to ensure clean state
      try {
        await this.disconnect();
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
      }

      if (!this.port) {
        return false;
      }

      this.connectionStartTime = Date.now();
      this.lastConfig = config;

      if (!await this.ensurePortSelected()) {
        return false;
      }

      try {
        await this.port.open({
          baudRate: config.baudRate,
          dataBits: config.dataBits,
          stopBits: config.stopBits,
          parity: config.parity,
          flowControl: config.flowControl
        });
      } catch (openError: any) {
        let errorMessage = 'Failed to open serial port';
        if (openError.message) {
          if (openError.message.includes('already open')) {
            errorMessage = 'Port is already open. Please close any other applications using the port.';
          } else if (openError.message.includes('Access denied')) {
            errorMessage = 'Access denied to the serial port. Check permissions.';
          } else {
            errorMessage = `Failed to open serial port: ${openError.message}`;
          }
        }
        return false;
      }
      
      const textDecoder = new TextDecoder();
      const textEncoder = new TextEncoder();
      
      const writer = this.port.writable.getWriter();
      if (!writer) throw new Error("Could not get writer");
      this.writer = writer;

      const readData = async () => {
        try {
          this.reader = this.port!.readable!.getReader();
          const textDecoder = new TextDecoder();
          while (true) {
            const { value, done } = await this.reader.read();
            if (done) break;

            if (this.isGPS && this.gpsReader) {
              this.gpsReader.processData(value);
            } else if (!this.isGPS && this.laserReader) {
              this.laserReader.processData(value);
            }

            if (this.onDataCallback && value && value.length > 0) {
              this.onDataCallback(textDecoder.decode(value));
            }
          }
        } catch (error) {
          this.connectionStatus = 'error';
        } finally {
          if (this.reader) {
            try { this.reader.releaseLock(); } catch (_e) {}
            this.reader = null;
          }
        }
      };

      this.readLoopPromise = readData();

      if (!this.isGPS) {
        const isConnected = await this.testConnection();
        if (!isConnected) {
          await this.disconnect();
          return false;
        }
      }
      
      this.connectionStatus = 'connected';
      return true;
    } catch (error) {
      return false;
    }
  }

  private async forceDisconnect(): Promise<void> {
    try {
      // Handle reader cleanup using the tracked reader reference
      if (this.reader) {
        try {
          await this.reader.cancel();
        } catch (_cancelError) {}
        try {
          this.reader.releaseLock();
        } catch (_releaseError) {}
        this.reader = null;
        await new Promise(resolve => setTimeout(resolve, this.CLEANUP_DELAY));
      } else if (this.port && this.port.readable && this.port.readable.locked) {
        // Stream is locked but we lost the reader reference.
        // Attempt to close the port directly; the browser will force-cancel any
        // pending reads, which unblocks the locked stream without a physical replug.
        try {
          await this.port.close();
        } catch (_closeError) {}
      }

      // Handle writer cleanup
      if (this.writer) {
        try {
          await this.writer.close();
          await new Promise(resolve => setTimeout(resolve, this.CLEANUP_DELAY));
          this.writer.releaseLock();
        } catch (error) {
        }
        this.writer = null;
      }

      // Handle port cleanup
      if (this.port) {
        try {
          if (this.port.readable || this.port.writable) {
            await this.port.close();
            await new Promise(resolve => setTimeout(resolve, this.CLEANUP_DELAY));
          }
        } catch (error) {
        }
      }
      
      // Reset readers
      if (this.laserReader) {
        this.laserReader.reset();
      }
      if (this.gpsReader) {
        this.gpsReader.reset();
      }
    } catch (error) {
    }
  }

  async disconnect(): Promise<void> {
    try {
      this.isDisconnecting = true;
      this.connectionStatus = 'disconnected';
      this.onDataCallback = null;
      
      if (this.isTracking || this.isBufferTracking) {
        await this.stopTracking();
      }
      await new Promise(resolve => setTimeout(resolve, this.CLEANUP_DELAY));

      await this.forceDisconnect();
      
      if (this.readLoopPromise) {
        try {
          await this.readLoopPromise;
          await new Promise(resolve => setTimeout(resolve, this.CLEANUP_DELAY));
        } catch (error) {
        }
      }

      this.isDisconnecting = false;
    } catch (error) {
      this.isDisconnecting = false;
      // Always try force disconnect as a fallback
      try {
        await this.forceDisconnect();
      } catch (forceError) {
      }
    }
  }

  private processNMEA(sentence: string) {
    try {
      const parts = sentence.split(',');
      const type = parts[0];
      
      this.dataCallbacks?.forEach(cb => {
        try {
          cb(sentence);
        } catch (err) {
        }
      });

      switch (type) {
        case '$GPGGA':
          const time = parts[1] ? `${parts[1].slice(0, 2)}:${parts[1].slice(2, 4)}:${parts[1].slice(4, 6)}` : '--:--:--';
          const latitude = parts[2] ? this.convertNMEACoord(parts[2], parts[3]) : 0;
          const longitude = parts[4] ? this.convertNMEACoord(parts[4], parts[5]) : 0;
          const fixQuality = this.getFixQuality(parts[6]);
          const satellites = parseInt(parts[7]) || 0;
          const hdop = parseFloat(parts[8]) || 0;
          const altitude = parseFloat(parts[9]) || 0;

          this.dataCallbacks?.forEach(cb => {
            try {
              cb(JSON.stringify({
                type: 'GPS',
                data: {
                  time,
                  latitude,
                  longitude,
                  fixQuality,
                  satellites,
                  hdop,
                  altitude
                }
              }));
            } catch (err) {
            }
          });
          break;

        case '$GPRMC':
          const speed = parts[7] ? parseFloat(parts[7]) * 1.852 : 0;
          const course = parseFloat(parts[8]) || 0;

          this.dataCallbacks?.forEach(cb => {
            try {
              cb(JSON.stringify({
                type: 'GPS',
                data: {
                  speed,
                  course
                }
              }));
            } catch (err) {
            }
          });
          break;

        case '$GPGSV':
          const totalSatellites = parseInt(parts[3]) || 0;
          this.dataCallbacks?.forEach(cb => {
            try {
              cb(JSON.stringify({
                type: 'GPS',
                data: {
                  satellites: totalSatellites
                }
              }));
            } catch (err) {
            }
          });
          break;
      }
    } catch (error) {
    }
  }

  private convertNMEACoord(coord: string, dir: string): number {
    if (!coord || !dir) return 0;
    const degrees = parseInt(coord.slice(0, 2));
    const minutes = parseFloat(coord.slice(2)) / 60;
    let decimal = degrees + minutes;
    if (dir === 'S' || dir === 'W') decimal = -decimal;
    return decimal;
  }

  private getFixQuality(quality: string): 'No Fix' | 'GPS Fix' | 'DGPS Fix' {
    switch (quality) {
      case '1': return 'GPS Fix';
      case '2': return 'DGPS Fix';
      default: return 'No Fix';
    }
  }

  getDiagnostics() {
    return {
      connectionStatus: this.connectionStatus,
      connectionStartTime: this.connectionStartTime ? new Date(this.connectionStartTime).toISOString() : null,
      uptime: this.connectionStartTime ? Date.now() - this.connectionStartTime : 0,
      measurementCount: this.measurementCount,
      measurementFrequency: this.measurementFrequency,
      lastMeasurementTime: this.lastMeasurementTime ? new Date(this.lastMeasurementTime).toISOString() : null,
      lastError: this.lastError,
      config: this.lastConfig
    };
  }
  
  write = async (data: string): Promise<boolean> => {
    if (!this.writer) return false;
    
    try {
      const encoder = new TextEncoder();
      const timestamp = new Date().toISOString();
      
      let commandWithTerminator = data;
      if (this.laserType === 'soltec-standard' && !data.endsWith('\r')) {
        commandWithTerminator = data + '\r';
      } else if (!data.endsWith('\r\n')) {
        commandWithTerminator = data + '\r\n';
      }
      
      const encoded = encoder.encode(commandWithTerminator);
      await this.writer.write(encoded);
      return true;
    } catch (error) {
      this.lastError = error.message;
      return false;
    }
  }

  onData(callback: (data: string) => void) {
    if (callback) {
      this.dataCallbacks.add(callback);
      
      if (this.isGPS && this.gpsReader) {
        this.gpsReader.registerCallback(callback);
      } else if (!this.isGPS && this.laserReader) {
        this.laserReader.registerCallback(callback);
      }
    } else if (callback === null) {
      this.dataCallbacks.clear();
      
      if (this.isGPS && this.gpsReader) {
        this.gpsReader.clearCallbacks();
      } else if (!this.isGPS && this.laserReader) {
        this.laserReader.clearCallbacks();
      }
    }
  }

  isConnected(): boolean {
    return this.port !== null;
  }
  
  setPort(port: SerialPort | null) {
    this.port = port;
  }
  
  getPort(): SerialPort | null {
    return this.port;
  }
  
  getPortInfo(port: SerialPort): string {
    return this.portInfo.get(port) || 'Unknown Port';
  }

  static async getPorts(): Promise<SerialPort[]> {
    return navigator.serial.getPorts();
  }
}

export const laserConnection = new SerialConnection();
export const gpsConnection = new SerialConnection();
gpsConnection.setAsGPS();

// Release port locks when Vite HMR replaces this module so the next
// module instance can reopen the port without a "stream is locked" error
// and without requiring a physical USB replug.
if (import.meta.hot) {
  import.meta.hot.dispose(async () => {
    try { await laserConnection.disconnect(); } catch (_e) {}
    try { await gpsConnection.disconnect(); } catch (_e) {}
  });
}

