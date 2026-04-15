/**
 * Web Bluetooth API type declarations.
 * These types are not included in standard TypeScript lib DOM definitions.
 */

interface BluetoothRequestDeviceFilter {
  services?: BluetoothServiceUUID[];
  name?: string;
  namePrefix?: string;
  manufacturerData?: Array<{ companyIdentifier: number; dataPrefix?: BufferSource; mask?: BufferSource }>;
}

interface RequestDeviceOptions {
  filters?: BluetoothRequestDeviceFilter[];
  optionalServices?: BluetoothServiceUUID[];
  acceptAllDevices?: boolean;
}

interface BluetoothRemoteGATTDescriptor {
  readonly characteristic: BluetoothRemoteGATTCharacteristic;
  readonly uuid: string;
  readonly value?: DataView;
  readValue(): Promise<DataView>;
  writeValue(value: BufferSource): Promise<void>;
}

interface BluetoothRemoteGATTCharacteristic extends EventTarget {
  readonly service: BluetoothRemoteGATTService;
  readonly uuid: string;
  readonly properties: BluetoothCharacteristicProperties;
  readonly value?: DataView;
  getDescriptor(descriptor: BluetoothDescriptorUUID): Promise<BluetoothRemoteGATTDescriptor>;
  getDescriptors(descriptor?: BluetoothDescriptorUUID): Promise<BluetoothRemoteGATTDescriptor[]>;
  readValue(): Promise<DataView>;
  writeValue(value: BufferSource): Promise<void>;
  writeValueWithResponse(value: BufferSource): Promise<void>;
  writeValueWithoutResponse(value: BufferSource): Promise<void>;
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  oncharacteristicvaluechanged: ((this: BluetoothRemoteGATTCharacteristic, ev: Event) => any) | null;
  addEventListener(type: 'characteristicvaluechanged', listener: (this: BluetoothRemoteGATTCharacteristic, ev: Event) => any, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
  removeEventListener(type: 'characteristicvaluechanged', listener: (this: BluetoothRemoteGATTCharacteristic, ev: Event) => any, options?: boolean | EventListenerOptions): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

interface BluetoothCharacteristicProperties {
  readonly authenticatedSignedWrites: boolean;
  readonly broadcast: boolean;
  readonly indicate: boolean;
  readonly notify: boolean;
  readonly read: boolean;
  readonly reliableWrite: boolean;
  readonly writableAuxiliaries: boolean;
  readonly write: boolean;
  readonly writeWithoutResponse: boolean;
}

interface BluetoothRemoteGATTService extends EventTarget {
  readonly device: BluetoothDevice;
  readonly uuid: string;
  readonly isPrimary: boolean;
  getCharacteristic(characteristic: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic>;
  getCharacteristics(characteristic?: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic[]>;
  getIncludedService(service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>;
  getIncludedServices(service?: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService[]>;
}

interface BluetoothRemoteGATTServer {
  readonly device: BluetoothDevice;
  readonly connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>;
  getPrimaryServices(service?: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService[]>;
}

interface BluetoothDevice extends EventTarget {
  readonly id: string;
  readonly name?: string;
  readonly gatt?: BluetoothRemoteGATTServer;
  ongattserverdisconnected: ((this: BluetoothDevice, ev: Event) => any) | null;
  addEventListener(type: 'gattserverdisconnected', listener: (this: BluetoothDevice, ev: Event) => any, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
  removeEventListener(type: 'gattserverdisconnected', listener: (this: BluetoothDevice, ev: Event) => any, options?: boolean | EventListenerOptions): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

interface Bluetooth extends EventTarget {
  getAvailability(): Promise<boolean>;
  requestDevice(options?: RequestDeviceOptions): Promise<BluetoothDevice>;
  getDevices(): Promise<BluetoothDevice[]>;
  onavailabilitychanged: ((this: Bluetooth, ev: Event) => any) | null;
}

type BluetoothServiceUUID = number | string;
type BluetoothCharacteristicUUID = number | string;
type BluetoothDescriptorUUID = number | string;

interface BluetoothLEScanFilter {
  services?: BluetoothServiceUUID[];
  name?: string;
  namePrefix?: string;
}

declare global {
  interface Navigator {
    bluetooth: Bluetooth;
  }
}

export {};
