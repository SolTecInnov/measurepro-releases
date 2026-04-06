export interface Measurement {
  rel: number;
  altGPS: number;
  latitude: number;
  longitude: number;
  utcDate: string;
  utcTime: string;
  speed: number;
  heading: number;
  roadNumber?: number;
  poiNumber?: number;
  note?: string | null;
}

export interface LaserMeasurement {
  value: number;
}

export type LogMode = 'Manual' | 'All Data' | 'Object Detection';
export type AlertStatus = 'OK' | 'WARNING' | 'DANGER';