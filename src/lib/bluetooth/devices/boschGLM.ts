import {
  BluetoothLaserDevice,
  BluetoothLaserDriver,
  BluetoothMeasurement,
  BluetoothConnectionStatus,
  BOSCH_GLM_SERVICE_UUID,
  BOSCH_GLM_CHARACTERISTIC_UUID,
  BOSCH_GLM_NOTIFY_UUID,
  isBluetoothSupported
} from '../types';

const BOSCH_COMPANY_ID = 0x0089;

const MT_PROTOCOL = {
  SYNC_BYTE: 0xC0,
  ESCAPE_BYTE: 0xDB,
  ESCAPE_SYNC: 0xDC,
  ESCAPE_ESC: 0xDD,
  
  CMD_MEASURE: 0x40,
  CMD_LASER_ON: 0x41,
  CMD_LASER_OFF: 0x42,
  CMD_GET_DISTANCE: 0x43,
  CMD_AUTO_SYNC_ON: 0x44,
  CMD_AUTO_SYNC_OFF: 0x45,
  CMD_GET_DEVICE_INFO: 0x46,
  
  RESP_MEASUREMENT: 0x50,
  RESP_STATUS: 0x51,
  RESP_ERROR: 0x52,
  RESP_DEVICE_INFO: 0x53,
};

export class BoschGLMDriver implements BluetoothLaserDriver {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private service: BluetoothRemoteGATTService | null = null;
  private writeCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private notifyCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  
  private status: BluetoothConnectionStatus = 'disconnected';
  private deviceInfo: BluetoothLaserDevice;
  
  private measurementCallbacks: Set<(measurement: BluetoothMeasurement) => void> = new Set();
  private dataCallbacks: Set<(data: any) => void> = new Set();
  private errorCallbacks: Set<(error: Error) => void> = new Set();
  private disconnectCallbacks: Set<() => void> = new Set();
  
  private autoSyncEnabled: boolean = false;
  private lastMeasurement: BluetoothMeasurement | null = null;
  
  private rxBuffer: number[] = [];
  private isProcessingMessage: boolean = false;

  constructor() {
    this.deviceInfo = {
      id: '',
      name: 'Bosch GLM165',
      type: 'laser',
      manufacturer: 'Bosch',
      model: 'GLM165-27C',
      status: 'disconnected',
      supportedFeatures: {
        singleMeasure: true,
        continuousMeasure: true,
        remoteTrigger: true,
        inclinometer: true,
        autoSync: true
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
        { namePrefix: 'GLM' },
        { namePrefix: 'Bosch' },
        { namePrefix: 'PLR' },
      ];

      const optionalServices = [
        BOSCH_GLM_SERVICE_UUID,
        'battery_service',
        'device_information',
      ];

      this.device = await navigator.bluetooth.requestDevice({
        filters,
        optionalServices
      });

      if (!this.device) {
        throw new Error('No device selected');
      }

      this.deviceInfo.id = this.device.id;
      this.deviceInfo.name = this.device.name || 'Bosch GLM Device';

      this.device.addEventListener('gattserverdisconnected', () => {
        this.handleDisconnect();
      });

      this.server = await this.device.gatt!.connect();
      if (!this.server) {
        throw new Error('Failed to connect to GATT server');
      }

      try {
        this.service = await this.server.getPrimaryService(BOSCH_GLM_SERVICE_UUID);
      } catch (e) {
        const services = await this.server.getPrimaryServices();
        console.log('Available services:', services.map(s => s.uuid));
        
        if (services.length > 0) {
          for (const svc of services) {
            try {
              const chars = await svc.getCharacteristics();
              console.log(`Service ${svc.uuid} characteristics:`, chars.map(c => c.uuid));
              
              for (const char of chars) {
                if (char.properties.write || char.properties.writeWithoutResponse) {
                  this.writeCharacteristic = char;
                }
                if (char.properties.notify) {
                  this.notifyCharacteristic = char;
                }
              }
              
              if (this.writeCharacteristic && this.notifyCharacteristic) {
                this.service = svc;
                break;
              }
            } catch (charError) {
              console.log(`Failed to get characteristics for service ${svc.uuid}`);
            }
          }
        }
        
        if (!this.service) {
          throw new Error('Bosch GLM service not found. Ensure the device is in pairing mode.');
        }
      }

      if (!this.writeCharacteristic) {
        try {
          this.writeCharacteristic = await this.service.getCharacteristic(BOSCH_GLM_CHARACTERISTIC_UUID);
        } catch (e) {
          console.log('Could not find write characteristic by UUID, using discovered one');
        }
      }

      if (!this.notifyCharacteristic) {
        try {
          this.notifyCharacteristic = await this.service.getCharacteristic(BOSCH_GLM_NOTIFY_UUID);
        } catch (e) {
          console.log('Could not find notify characteristic by UUID, using discovered one');
        }
      }

      if (this.notifyCharacteristic) {
        await this.notifyCharacteristic.startNotifications();
        this.notifyCharacteristic.addEventListener('characteristicvaluechanged', 
          this.handleNotification.bind(this));
      }

      try {
        const batteryService = await this.server.getPrimaryService('battery_service');
        const batteryLevel = await batteryService.getCharacteristic('battery_level');
        const value = await batteryLevel.readValue();
        this.deviceInfo.batteryLevel = value.getUint8(0);
      } catch (e) {
      }

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
      if (this.notifyCharacteristic) {
        try {
          await this.notifyCharacteristic.stopNotifications();
        } catch (e) {}
      }

      if (this.server && this.server.connected) {
        this.server.disconnect();
      }

      this.device = null;
      this.server = null;
      this.service = null;
      this.writeCharacteristic = null;
      this.notifyCharacteristic = null;
      
      this.status = 'disconnected';
      this.deviceInfo.status = 'disconnected';
      
      this.rxBuffer = [];
    } catch (error) {
      console.error('Error during disconnect:', error);
    }
  }

  isConnected(): boolean {
    return this.status === 'connected' && this.server?.connected === true;
  }

  getDeviceInfo(): BluetoothLaserDevice {
    return { ...this.deviceInfo };
  }

  onMeasurement(callback: (measurement: BluetoothMeasurement) => void): void {
    this.measurementCallbacks.add(callback);
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

  removeMeasurementCallback(callback: (measurement: BluetoothMeasurement) => void): void {
    this.measurementCallbacks.delete(callback);
  }

  async requestMeasurement(): Promise<void> {
    if (!this.isConnected() || !this.writeCharacteristic) {
      throw new Error('Not connected to device');
    }

    const command = this.buildCommand(MT_PROTOCOL.CMD_MEASURE);
    await this.sendCommand(command);
  }

  async startContinuousMeasure(): Promise<void> {
    await this.enableAutoSync();
  }

  async stopContinuousMeasure(): Promise<void> {
    await this.disableAutoSync();
  }

  async enableAutoSync(): Promise<void> {
    if (!this.isConnected() || !this.writeCharacteristic) {
      throw new Error('Not connected to device');
    }

    const command = this.buildCommand(MT_PROTOCOL.CMD_AUTO_SYNC_ON);
    await this.sendCommand(command);
    this.autoSyncEnabled = true;
  }

  async disableAutoSync(): Promise<void> {
    if (!this.isConnected() || !this.writeCharacteristic) {
      throw new Error('Not connected to device');
    }

    const command = this.buildCommand(MT_PROTOCOL.CMD_AUTO_SYNC_OFF);
    await this.sendCommand(command);
    this.autoSyncEnabled = false;
  }

  async turnLaserOn(): Promise<void> {
    if (!this.isConnected() || !this.writeCharacteristic) {
      throw new Error('Not connected to device');
    }

    const command = this.buildCommand(MT_PROTOCOL.CMD_LASER_ON);
    await this.sendCommand(command);
  }

  async turnLaserOff(): Promise<void> {
    if (!this.isConnected() || !this.writeCharacteristic) {
      throw new Error('Not connected to device');
    }

    const command = this.buildCommand(MT_PROTOCOL.CMD_LASER_OFF);
    await this.sendCommand(command);
  }

  private buildCommand(commandByte: number, payload: number[] = []): Uint8Array {
    const data = [commandByte, ...payload];
    
    const escaped: number[] = [];
    for (const byte of data) {
      if (byte === MT_PROTOCOL.SYNC_BYTE) {
        escaped.push(MT_PROTOCOL.ESCAPE_BYTE, MT_PROTOCOL.ESCAPE_SYNC);
      } else if (byte === MT_PROTOCOL.ESCAPE_BYTE) {
        escaped.push(MT_PROTOCOL.ESCAPE_BYTE, MT_PROTOCOL.ESCAPE_ESC);
      } else {
        escaped.push(byte);
      }
    }

    return new Uint8Array([MT_PROTOCOL.SYNC_BYTE, ...escaped, MT_PROTOCOL.SYNC_BYTE]);
  }

  private async sendCommand(command: Uint8Array): Promise<void> {
    if (!this.writeCharacteristic) {
      throw new Error('Write characteristic not available');
    }

    try {
      if (this.writeCharacteristic.properties.writeWithoutResponse) {
        await this.writeCharacteristic.writeValueWithoutResponse(command);
      } else {
        await this.writeCharacteristic.writeValue(command);
      }
    } catch (error) {
      this.emitError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  private handleNotification(event: Event): void {
    const characteristic = event.target as BluetoothRemoteGATTCharacteristic;
    const value = characteristic.value;
    
    if (!value) return;

    for (let i = 0; i < value.byteLength; i++) {
      this.rxBuffer.push(value.getUint8(i));
    }

    this.processBuffer();
  }

  private processBuffer(): void {
    if (this.isProcessingMessage) return;
    this.isProcessingMessage = true;

    try {
      while (this.rxBuffer.length > 0) {
        const syncStart = this.rxBuffer.indexOf(MT_PROTOCOL.SYNC_BYTE);
        
        if (syncStart === -1) {
          this.rxBuffer = [];
          break;
        }

        if (syncStart > 0) {
          this.rxBuffer.splice(0, syncStart);
        }

        if (this.rxBuffer.length < 3) break;

        let syncEnd = -1;
        for (let i = 1; i < this.rxBuffer.length; i++) {
          if (this.rxBuffer[i] === MT_PROTOCOL.SYNC_BYTE && 
              this.rxBuffer[i - 1] !== MT_PROTOCOL.ESCAPE_BYTE) {
            syncEnd = i;
            break;
          }
        }

        if (syncEnd === -1) break;

        const messageBytes = this.rxBuffer.splice(0, syncEnd + 1);
        const payload = this.unescapeMessage(messageBytes.slice(1, -1));
        
        if (payload.length > 0) {
          this.parseMessage(payload);
        }
      }
    } finally {
      this.isProcessingMessage = false;
    }
  }

  private unescapeMessage(data: number[]): number[] {
    const result: number[] = [];
    let i = 0;
    
    while (i < data.length) {
      if (data[i] === MT_PROTOCOL.ESCAPE_BYTE && i + 1 < data.length) {
        if (data[i + 1] === MT_PROTOCOL.ESCAPE_SYNC) {
          result.push(MT_PROTOCOL.SYNC_BYTE);
        } else if (data[i + 1] === MT_PROTOCOL.ESCAPE_ESC) {
          result.push(MT_PROTOCOL.ESCAPE_BYTE);
        }
        i += 2;
      } else {
        result.push(data[i]);
        i++;
      }
    }
    
    return result;
  }

  private parseMessage(payload: number[]): void {
    if (payload.length === 0) return;

    const commandByte = payload[0];
    const data = payload.slice(1);

    this.dataCallbacks.forEach(cb => {
      try {
        cb({ command: commandByte, data });
      } catch (e) {}
    });

    switch (commandByte) {
      case MT_PROTOCOL.RESP_MEASUREMENT:
        this.parseMeasurement(data);
        break;
      case MT_PROTOCOL.RESP_STATUS:
        console.log('Device status:', data);
        break;
      case MT_PROTOCOL.RESP_ERROR:
        const errorCode = data[0] || 0;
        this.emitError(new Error(`Device error code: ${errorCode}`));
        break;
      case MT_PROTOCOL.RESP_DEVICE_INFO:
        console.log('Device info:', data);
        break;
      default:
        this.tryParseMeasurementFromRaw(payload);
    }
  }

  private parseMeasurement(data: number[]): void {
    if (data.length < 4) return;

    try {
      const buffer = new ArrayBuffer(4);
      const view = new DataView(buffer);
      for (let i = 0; i < 4 && i < data.length; i++) {
        view.setUint8(i, data[i]);
      }
      
      let distanceMeters = view.getFloat32(0, true);

      if (data.length >= 8) {
        const intDistance = view.getInt32(0, true);
        distanceMeters = intDistance / 10000;
      }

      const measurement: BluetoothMeasurement = {
        value: distanceMeters,
        unit: 'meters',
        timestamp: Date.now(),
        deviceId: this.deviceInfo.id,
        mode: this.autoSyncEnabled ? 'auto-sync' : 'single'
      };

      if (data.length >= 8) {
        const angleBuffer = new ArrayBuffer(4);
        const angleView = new DataView(angleBuffer);
        for (let i = 0; i < 4 && i + 4 < data.length; i++) {
          angleView.setUint8(i, data[i + 4]);
        }
        measurement.inclinometerAngle = angleView.getFloat32(0, true);
      }

      this.lastMeasurement = measurement;
      this.emitMeasurement(measurement);
    } catch (error) {
      console.error('Error parsing measurement:', error);
    }
  }

  private tryParseMeasurementFromRaw(payload: number[]): void {
    const text = String.fromCharCode(...payload);
    
    const distanceMatch = text.match(/[\d.]+/);
    if (distanceMatch) {
      const value = parseFloat(distanceMatch[0]);
      if (!isNaN(value) && value > 0 && value < 1000) {
        const measurement: BluetoothMeasurement = {
          value,
          unit: 'meters',
          timestamp: Date.now(),
          deviceId: this.deviceInfo.id,
          mode: 'raw'
        };
        this.lastMeasurement = measurement;
        this.emitMeasurement(measurement);
      }
    }
  }

  private emitMeasurement(measurement: BluetoothMeasurement): void {
    this.measurementCallbacks.forEach(cb => {
      try {
        cb(measurement);
      } catch (e) {
        console.error('Error in measurement callback:', e);
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

  getLastMeasurement(): BluetoothMeasurement | null {
    return this.lastMeasurement;
  }

  isAutoSyncEnabled(): boolean {
    return this.autoSyncEnabled;
  }
}

export function createBoschGLMDriver(): BoschGLMDriver {
  return new BoschGLMDriver();
}
