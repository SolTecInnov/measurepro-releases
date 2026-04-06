import {
  BluetoothGPSDevice,
  BluetoothGPSDriver,
  BluetoothConnectionStatus,
  GPSPosition,
  GPS_SERVICE_UUID,
  GPS_LOCATION_UUID,
  BLUETOOTH_SERIAL_UUID,
  isBluetoothSupported
} from '../types';

export class BluetoothGPSDriver implements BluetoothGPSDriver {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private service: BluetoothRemoteGATTService | null = null;
  private locationCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private serialCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  
  private status: BluetoothConnectionStatus = 'disconnected';
  private deviceInfo: BluetoothGPSDevice;
  
  private positionCallbacks: Set<(position: GPSPosition) => void> = new Set();
  private dataCallbacks: Set<(data: any) => void> = new Set();
  private errorCallbacks: Set<(error: Error) => void> = new Set();
  private disconnectCallbacks: Set<() => void> = new Set();
  
  private nmeaBuffer: string = '';
  private lastPosition: GPSPosition | null = null;

  constructor() {
    this.deviceInfo = {
      id: '',
      name: 'Bluetooth GPS',
      type: 'gps',
      manufacturer: 'Unknown',
      model: 'BT GPS Receiver',
      status: 'disconnected',
      supportedFeatures: {
        nmea: true,
        rtcm: false,
        multiConstellation: true
      }
    };
  }

  async connect(): Promise<boolean> {
    if (!isBluetoothSupported()) {
      this.emitError(new Error('Web Bluetooth is not supported in this browser'));
      return false;
    }

    try {
      this.status = 'connecting';
      this.deviceInfo.status = 'connecting';

      const filters: BluetoothLEScanFilter[] = [
        { namePrefix: 'GPS' },
        { namePrefix: 'GNSS' },
        { namePrefix: 'BT-GPS' },
        { namePrefix: 'Bluetooth GPS' },
        { namePrefix: 'GN' },
        { namePrefix: 'u-blox' },
        { namePrefix: 'Garmin' },
        { namePrefix: 'Bad Elf' },
        { namePrefix: 'Dual' },
      ];

      const optionalServices = [
        GPS_SERVICE_UUID,
        BLUETOOTH_SERIAL_UUID,
        'battery_service',
        'device_information',
      ];

      this.device = await navigator.bluetooth.requestDevice({
        filters,
        optionalServices,
        acceptAllDevices: filters.length === 0
      });

      if (!this.device) {
        throw new Error('No device selected');
      }

      this.deviceInfo.id = this.device.id;
      this.deviceInfo.name = this.device.name || 'Bluetooth GPS';

      this.device.addEventListener('gattserverdisconnected', () => {
        this.handleDisconnect();
      });

      this.server = await this.device.gatt!.connect();
      if (!this.server) {
        throw new Error('Failed to connect to GATT server');
      }

      const services = await this.server.getPrimaryServices();
      
      for (const svc of services) {
        try {
          const chars = await svc.getCharacteristics();
          
          for (const char of chars) {
            if (char.properties.notify || char.properties.read) {
              if (char.uuid.includes('2a67') || char.uuid.includes('location')) {
                this.locationCharacteristic = char;
              } else if (char.properties.notify) {
                this.serialCharacteristic = char;
              }
            }
          }
        } catch (e) {
          console.log('Error getting characteristics:', e);
        }
      }

      if (this.locationCharacteristic) {
        await this.locationCharacteristic.startNotifications();
        this.locationCharacteristic.addEventListener('characteristicvaluechanged',
          this.handleLocationUpdate.bind(this));
      }

      if (this.serialCharacteristic) {
        await this.serialCharacteristic.startNotifications();
        this.serialCharacteristic.addEventListener('characteristicvaluechanged',
          this.handleSerialData.bind(this));
      }

      if (!this.locationCharacteristic && !this.serialCharacteristic) {
        console.warn('No GPS characteristics found - device may use non-standard protocol');
      }

      try {
        const batteryService = await this.server.getPrimaryService('battery_service');
        const batteryLevel = await batteryService.getCharacteristic('battery_level');
        const value = await batteryLevel.readValue();
        this.deviceInfo.batteryLevel = value.getUint8(0);
      } catch (e) {}

      this.status = 'connected';
      this.deviceInfo.status = 'connected';
      this.deviceInfo.lastSeen = Date.now();

      return true;
    } catch (error) {
      this.status = 'error';
      this.deviceInfo.status = 'error';
      
      const err = error instanceof Error ? error : new Error(String(error));
      this.emitError(err);
      
      await this.disconnect();
      return false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.locationCharacteristic) {
        try {
          await this.locationCharacteristic.stopNotifications();
        } catch (e) {}
      }

      if (this.serialCharacteristic) {
        try {
          await this.serialCharacteristic.stopNotifications();
        } catch (e) {}
      }

      if (this.server && this.server.connected) {
        this.server.disconnect();
      }

      this.device = null;
      this.server = null;
      this.service = null;
      this.locationCharacteristic = null;
      this.serialCharacteristic = null;
      
      this.status = 'disconnected';
      this.deviceInfo.status = 'disconnected';
      
      this.nmeaBuffer = '';
    } catch (error) {
      console.error('Error during disconnect:', error);
    }
  }

  isConnected(): boolean {
    return this.status === 'connected' && this.server?.connected === true;
  }

  getDeviceInfo(): BluetoothGPSDevice {
    return { ...this.deviceInfo };
  }

  onPositionUpdate(callback: (position: GPSPosition) => void): void {
    this.positionCallbacks.add(callback);
  }

  removePositionCallback(callback: (position: GPSPosition) => void): void {
    this.positionCallbacks.delete(callback);
  }

  onData(callback: (data: any) => void): void {
    this.dataCallbacks.add(callback);
  }

  onError(callback: (error: Error) => void): void {
    this.errorCallbacks.add(callback);
  }

  onDisconnect(callback: () => void): void {
    this.disconnectCallbacks.add(callback);
  }

  private handleLocationUpdate(event: Event): void {
    const characteristic = event.target as BluetoothRemoteGATTCharacteristic;
    const value = characteristic.value;
    
    if (!value) return;

    try {
      const flags = value.getUint16(0, true);
      let offset = 2;

      const hasSpeed = (flags & 0x0001) !== 0;
      const hasAltitude = (flags & 0x0004) !== 0;
      const hasHeading = (flags & 0x0010) !== 0;

      const latitude = value.getInt32(offset, true) / 10000000;
      offset += 4;
      const longitude = value.getInt32(offset, true) / 10000000;
      offset += 4;

      const position: GPSPosition = {
        latitude,
        longitude,
        timestamp: Date.now()
      };

      if (hasAltitude && offset + 3 <= value.byteLength) {
        position.altitude = value.getInt32(offset, true) / 100;
        offset += 4;
      }

      if (hasHeading && offset + 2 <= value.byteLength) {
        position.heading = value.getUint16(offset, true) / 100;
        offset += 2;
      }

      if (hasSpeed && offset + 2 <= value.byteLength) {
        position.speed = value.getUint16(offset, true) / 100;
      }

      this.lastPosition = position;
      this.emitPosition(position);
    } catch (error) {
      console.error('Error parsing location data:', error);
    }
  }

  private handleSerialData(event: Event): void {
    const characteristic = event.target as BluetoothRemoteGATTCharacteristic;
    const value = characteristic.value;
    
    if (!value) return;

    const decoder = new TextDecoder();
    const text = decoder.decode(value);
    
    this.nmeaBuffer += text;
    this.processNMEABuffer();
  }

  private processNMEABuffer(): void {
    const lines = this.nmeaBuffer.split('\n');
    
    for (let i = 0; i < lines.length - 1; i++) {
      const sentence = lines[i].trim();
      if (sentence.startsWith('$')) {
        this.parseNMEASentence(sentence);
      }
    }

    this.nmeaBuffer = lines[lines.length - 1];
    
    if (this.nmeaBuffer.length > 1024) {
      this.nmeaBuffer = '';
    }
  }

  private parseNMEASentence(sentence: string): void {
    this.dataCallbacks.forEach(cb => {
      try {
        cb({ type: 'nmea', sentence });
      } catch (e) {}
    });

    const parts = sentence.split(',');
    const type = parts[0];

    try {
      if (type === '$GPGGA' || type === '$GNGGA') {
        this.parseGGA(parts);
      } else if (type === '$GPRMC' || type === '$GNRMC') {
        this.parseRMC(parts);
      }
    } catch (error) {
      console.error('Error parsing NMEA:', error);
    }
  }

  private parseGGA(parts: string[]): void {
    if (parts.length < 10) return;

    const latitude = this.parseNMEACoordinate(parts[2], parts[3]);
    const longitude = this.parseNMEACoordinate(parts[4], parts[5]);
    
    if (latitude === 0 && longitude === 0) return;

    const fixQuality = parseInt(parts[6]) || 0;
    const satellites = parseInt(parts[7]) || 0;
    const hdop = parseFloat(parts[8]) || 99;
    const altitude = parseFloat(parts[9]) || 0;

    let fixType: GPSPosition['fixType'] = 'none';
    switch (fixQuality) {
      case 1: fixType = 'gps'; break;
      case 2: fixType = 'dgps'; break;
      case 4: fixType = 'rtk-fixed'; break;
      case 5: fixType = 'rtk-float'; break;
    }

    const position: GPSPosition = {
      latitude,
      longitude,
      altitude,
      timestamp: Date.now(),
      satellites,
      hdop,
      fixType
    };

    if (this.lastPosition) {
      position.speed = this.lastPosition.speed;
      position.heading = this.lastPosition.heading;
    }

    this.lastPosition = position;
    this.emitPosition(position);
  }

  private parseRMC(parts: string[]): void {
    if (parts.length < 8) return;

    const status = parts[2];
    if (status !== 'A') return;

    const latitude = this.parseNMEACoordinate(parts[3], parts[4]);
    const longitude = this.parseNMEACoordinate(parts[5], parts[6]);
    
    if (latitude === 0 && longitude === 0) return;

    const speedKnots = parseFloat(parts[7]) || 0;
    const speed = speedKnots * 1.852;
    const heading = parseFloat(parts[8]) || 0;

    if (this.lastPosition) {
      this.lastPosition.speed = speed;
      this.lastPosition.heading = heading;
    } else {
      const position: GPSPosition = {
        latitude,
        longitude,
        speed,
        heading,
        timestamp: Date.now(),
        fixType: 'gps'
      };
      this.lastPosition = position;
      this.emitPosition(position);
    }
  }

  private parseNMEACoordinate(coord: string, dir: string): number {
    if (!coord || !dir) return 0;

    const isLat = dir === 'N' || dir === 'S';
    const degreeDigits = isLat ? 2 : 3;
    
    const degrees = parseInt(coord.substring(0, degreeDigits));
    const minutes = parseFloat(coord.substring(degreeDigits));
    
    let decimal = degrees + minutes / 60;
    
    if (dir === 'S' || dir === 'W') {
      decimal = -decimal;
    }
    
    return decimal;
  }

  private emitPosition(position: GPSPosition): void {
    this.positionCallbacks.forEach(cb => {
      try {
        cb(position);
      } catch (e) {
        console.error('Error in position callback:', e);
      }
    });
  }

  private emitError(error: Error): void {
    this.errorCallbacks.forEach(cb => {
      try {
        cb(error);
      } catch (e) {
        console.error('Error in error callback:', e);
      }
    });
  }

  private handleDisconnect(): void {
    this.status = 'disconnected';
    this.deviceInfo.status = 'disconnected';
    
    this.disconnectCallbacks.forEach(cb => {
      try {
        cb();
      } catch (e) {
        console.error('Error in disconnect callback:', e);
      }
    });
  }

  getLastPosition(): GPSPosition | null {
    return this.lastPosition;
  }
}

export function createBluetoothGPSDriver(): BluetoothGPSDriver {
  return new BluetoothGPSDriver();
}
