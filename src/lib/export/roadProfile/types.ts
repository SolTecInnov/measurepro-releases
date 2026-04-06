/**
 * Survey + Engineering Export Types
 * Types for professional road profile export to CAD/GIS formats
 */

export type ExportFormat = 'csv' | 'geojson' | 'shapefile' | 'dxf' | 'landxml' | 'kml' | 'kmz' | 'gpx' | 'zip';

export type CRSCode = 'EPSG:4326' | 'EPSG:3857' | string;

export interface CRSDefinition {
  code: CRSCode;
  name: string;
  proj4: string;
}

export interface ExportOptions {
  formats: ExportFormat[];
  crs: CRSCode;
  customProj4?: string;
  altitudeMode: 'raw' | 'selected' | 'corrected' | 'all';
  samplingMode: 'full' | 'resample';
  resampleInterval_m?: number;
  includeRollPitchYaw?: boolean;
  includePOIs?: boolean;
  includeDiagnostics?: boolean;
  includeGradeColor?: boolean;
}

export interface ExportSample {
  station_m: number;
  station_km: number;
  lat_deg: number;
  lon_deg: number;
  x_projected?: number;
  y_projected?: number;
  altitude_raw_m: number | null;
  altitude_selected_m: number | null;
  altitude_corrected_m: number | null;
  grade_pct: number | null;
  roll_deg: number | null;
  pitch_deg: number | null;
  yaw_deg: number | null;
  speed_mps: number | null;
  heading_deg: number | null;
  timestamp_utc: string;
  fix_quality: string | null;
  sats: number | null;
  hdop: number | null;
  alignment_id: string;
  profile_id: string;
  project_id: string;
  // Heavy haul safety fields
  crossSlope_deg: number | null;
  bankingAlert: string | null;
  curveRadius_m: number | null;
  radiusAlert: string | null;
  // Grade classification (computed on demand)
  grade_class?: string;
  grade_color?: string;
}

export interface ExportMetadata {
  appVersion: string;
  buildVersion: string;
  exportedAt: string;
  deviceId: string | null;
  mountName: string | null;
  project: {
    id: string;
    name?: string;
  };
  alignment: {
    id: string;
    name: string;
    length_m: number;
    vertexCount: number;
    createdAt: string;
    createdBy: string;
  };
  profile: {
    id: string;
    name: string;
    sampleCount: number;
    timestampRange: {
      start: string;
      end: string;
    };
  };
  calibration: {
    altitudeStrategy: string;
    altitudeOffsetM: number;
    axisMapping: object | null;
    confidence?: string;
  };
  crs: {
    code: string;
    name: string;
  };
  processing: {
    samplingMode: string;
    resampleInterval_m?: number;
    altitudeMode: string;
    smoothingApplied: boolean;
  };
  warnings: string[];
}

export interface ExportResult {
  format: ExportFormat;
  filename: string;
  blob: Blob;
  mimeType: string;
}

export const SUPPORTED_CRS: CRSDefinition[] = [
  {
    code: 'EPSG:4326',
    name: 'WGS 84 (Geographic)',
    proj4: '+proj=longlat +datum=WGS84 +no_defs',
  },
  {
    code: 'EPSG:3857',
    name: 'Web Mercator',
    proj4: '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs',
  },
  {
    code: 'EPSG:28354',
    name: 'GDA94 / MGA zone 54 (Australia)',
    proj4: '+proj=utm +zone=54 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
  },
  {
    code: 'EPSG:28355',
    name: 'GDA94 / MGA zone 55 (Australia)',
    proj4: '+proj=utm +zone=55 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
  },
  {
    code: 'EPSG:28356',
    name: 'GDA94 / MGA zone 56 (Australia)',
    proj4: '+proj=utm +zone=56 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
  },
];

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  formats: ['csv', 'geojson'],
  crs: 'EPSG:4326',
  altitudeMode: 'corrected',
  samplingMode: 'full',
  includeRollPitchYaw: true,
  includePOIs: false,
  includeDiagnostics: false,
};
