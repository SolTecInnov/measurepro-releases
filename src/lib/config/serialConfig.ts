import { LASER_PRESETS, type LaserType } from '../serial';

// Serial port configurations for GPS and Laser devices
export const GPS_CONFIG = {
  baudRate: 4800,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  flowControl: 'none'
};

export const GPS_BAUD_RATES = [
  { value: 4800, label: '4800 (Most Common)' },
  { value: 9600, label: '9600 (Standard)' },
  { value: 19200, label: '19200' },
  { value: 38400, label: '38400' },
  { value: 57600, label: '57600' },
  { value: 115200, label: '115200' }
];

export const GPS_DATA_BITS = [
  { value: 7, label: '7 bits' },
  { value: 8, label: '8 bits (Standard)' }
];

export const GPS_STOP_BITS = [
  { value: 1, label: '1 bit (Standard)' },
  { value: 2, label: '2 bits' }
];

export const GPS_PARITY = [
  { value: 'none', label: 'None (Standard)' },
  { value: 'even', label: 'Even' },
  { value: 'odd', label: 'Odd' }
];

export const GPS_FLOW_CONTROL = [
  { value: 'none', label: 'None (Standard)' },
  { value: 'hardware', label: 'Hardware (RTS/CTS)' }
];

type FlatLaserConfig = {
  baudRate: number;
  dataBits: number;
  stopBits: number;
  parity: string;
  flowControl: string;
  commands: (typeof LASER_PRESETS)[LaserType]['commands'];
};

export const LASER_CONFIGS: Record<LaserType, FlatLaserConfig> = Object.fromEntries(
  (Object.entries(LASER_PRESETS) as [LaserType, (typeof LASER_PRESETS)[LaserType]][]).map(
    ([type, preset]) => [type, { ...preset.config, commands: preset.commands }]
  )
) as Record<LaserType, FlatLaserConfig>;
