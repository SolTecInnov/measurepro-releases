export type Sample = {
  t: number;
  lat: number;
  lon: number;
  headingDeg: number;
  speedKph?: number;
  rawDistM?: number | null;
  status?: {
    noTarget?: boolean;
    overRange?: boolean;
  };
};

export type POI = {
  id: string;
  kind: 'bridge' | 'gantry' | 'tree_canopy' | 'wires_util' | 'wires_hv' | 'overhead';
  distance_m: number;
  lat: number;
  lon: number;
  s_from_start_m: number;
  t: number;
  source: 'laser';
  tags?: string[];
};

export type MinimaPoint = {
  s: number;
  d: number;
  t: number;
  lat: number;
  lon: number;
};

export type Phase = 'IDLE' | 'TRACKING' | 'HOLD';

export type Diagnostics = {
  phase: Phase;
  baseline: number | null;
  lastDistM: number | null;
  skySinceMs: number;
  solidSinceMs: number;
  dMinCurrent: number | null;
  sTraveledCurrent: number;
  eventsEmittedTotal: number;
};
