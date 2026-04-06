/**
 * GNSS Configuration Service
 * Handles persistent configuration storage with JSON file
 * Supports Direct Mode (port 55556) and NMEA Mode (port 2101)
 */

import fs from 'fs';
import path from 'path';

export interface GnssConfigData {
  enabled: boolean;
  host: string;
  dataPort: number;
  controlPort: number;
  mode: 'direct' | 'nmea';
  nmeaPort: number;
  serverMode: 'local' | 'cloud';
  imu: {
    enabled: boolean;
    rateHz: 10 | 25 | 50 | 100 | 200;
    fields: {
      attitude: boolean;
      angularRates: boolean;
      accel: boolean;
      parsePASHR: boolean;
    };
  };
  ntrip: {
    enabled: boolean;
    host?: string;
    port?: number;
    mountpoint?: string;
    username?: string;
  };
}

const CONFIG_FILE_PATH = path.join(process.cwd(), 'gnss-config.json');

const DEFAULT_CONFIG: GnssConfigData = {
  enabled: false,
  host: '192.168.0.222',
  dataPort: 55556,
  controlPort: 55555,
  mode: 'direct',
  nmeaPort: 2101,
  serverMode: 'local',
  imu: {
    enabled: false,
    rateHz: 50,
    fields: {
      attitude: true,
      angularRates: false,
      accel: false,
      parsePASHR: true,
    },
  },
  ntrip: {
    enabled: false,
  },
};

class GnssConfigService {
  private config: GnssConfigData;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.config = this.loadFromFile();
  }

  private loadFromFile(): GnssConfigData {
    try {
      if (fs.existsSync(CONFIG_FILE_PATH)) {
        const data = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
        const parsed = JSON.parse(data);
        console.log('[GnssConfig] Loaded configuration from file');
        return { ...DEFAULT_CONFIG, ...parsed };
      }
    } catch (error) {
      console.error('[GnssConfig] Failed to load config file:', error);
    }
    console.log('[GnssConfig] Using default configuration');
    return { ...DEFAULT_CONFIG };
  }

  private saveToFile(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      try {
        const data = JSON.stringify(this.config, null, 2);
        fs.writeFileSync(CONFIG_FILE_PATH, data, 'utf-8');
        console.log('[GnssConfig] Configuration saved to file');
      } catch (error) {
        console.error('[GnssConfig] Failed to save config file:', error);
      }
    }, 100);
  }

  getConfig(): GnssConfigData {
    return { ...this.config };
  }

  updateConfig(updates: Partial<GnssConfigData>): GnssConfigData {
    if (updates.imu) {
      this.config.imu = { ...this.config.imu, ...updates.imu };
      if (updates.imu.fields) {
        this.config.imu.fields = { ...this.config.imu.fields, ...updates.imu.fields };
      }
    }
    if (updates.ntrip) {
      this.config.ntrip = { ...this.config.ntrip, ...updates.ntrip };
    }
    const { imu, ntrip, ...rest } = updates;
    Object.assign(this.config, rest);
    this.saveToFile();
    return this.getConfig();
  }

  getActivePort(): number {
    if (this.config.mode === 'direct') {
      return this.config.dataPort;
    }
    return this.config.nmeaPort;
  }

  isCloudMode(): boolean {
    return this.config.serverMode === 'cloud';
  }

  isPrivateNetwork(host: string): boolean {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[01])\./,
      /^192\.168\./,
      /^127\./,
      /^localhost$/i,
    ];
    return privateRanges.some(regex => regex.test(host));
  }
}

export const gnssConfigService = new GnssConfigService();
