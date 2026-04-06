/**
 * Alignment + Profile Linked Viewer Types
 * Data models for road alignments with linked elevation profiles
 */

export interface LatLon {
  lat: number;
  lon: number;
}

export interface Alignment {
  id: string;
  projectId: string;
  name: string;
  polyline: LatLon[];
  cumDistM: number[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  cloudSynced?: boolean;
}

export interface LinkedProfileSample {
  s_m: number;
  lat: number;
  lon: number;
  time: string;
  altitude_raw_m: number | null;
  altitude_selected_m: number | null;
  altitude_corrected_m: number | null;
  grade_pct?: number;
  k_factor?: number | null;
  curvature_type?: 'convex' | 'concave' | 'linear' | null;
  lateralOffset_m?: number;
  hdop?: number | null;
  num_sats?: number | null;
  speed_mps?: number | null;
  heading_deg?: number | null;
  // Heavy haul safety fields (from GNSS profile recording)
  crossSlope_deg?: number | null;
  bankingAlert?: string | null;
  curveRadius_m?: number | null;
  radiusAlert?: string | null;
}

export type AltitudeStrategy = 'prefer_msl' | 'derive_msl' | 'raw_ambiguous';

export interface LinkedProfileMetadata {
  altitudeStrategy: AltitudeStrategy;
  altitudeOffsetM: number;
  axisMapping: {
    forward: 'x' | 'y' | 'z' | '-x' | '-y' | '-z';
    right: 'x' | 'y' | 'z' | '-x' | '-y' | '-z';
    down: 'x' | 'y' | 'z' | '-x' | '-y' | '-z';
  } | null;
  buildVersion: string;
  createdAt: string;
  deviceId?: string;
  mountName?: string;
}

export interface LinkedProfile {
  id: string;
  projectId: string;
  name: string;
  alignmentId: string;
  samples: LinkedProfileSample[];
  metadata: LinkedProfileMetadata;
  cloudSynced?: boolean;
}

export interface ProjectedPoint {
  s_m: number;
  offset_m: number;
  closestLatLon: LatLon;
  segIndex: number;
  t: number;
}

export interface PointAtStation {
  lat: number;
  lon: number;
  bearingDeg: number;
}

export interface AlignmentProfileLinkedSet {
  alignment: Alignment;
  profiles: LinkedProfile[];
}

export interface ViewState {
  station_m: number;
  zoom: number;
  panX: number;
  panY: number;
  linkCursors: boolean;
}

export interface SplitViewConfig {
  mapHeight: number;
  profileHeight: number;
  showLegend: boolean;
  showReadout: boolean;
}
