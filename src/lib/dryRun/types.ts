/**
 * Dry Run Detection Types
 * Configurable detection zones around the vehicle for obstacle monitoring
 */

export type DetectionSide = 'left' | 'right' | 'rear';

export interface BoundingBox3D {
  xMin: number;  // Longitudinal: negative = behind vehicle, positive = ahead
  xMax: number;
  yMin: number;  // Lateral: negative = left, positive = right
  yMax: number;
  zMin: number;  // Vertical: ground level = 0
  zMax: number;
}

export interface DetectionZone {
  id: string;
  name: string;
  side: DetectionSide;
  enabled: boolean;
  box: BoundingBox3D;
  alertThreshold: number;  // Minimum points in zone to trigger alert
  cooldownMs: number;      // Minimum time between alerts
  ignoreAboveHeight?: number;  // Ignore obstacles above this height (for guardrails)
  ignoreBelowHeight?: number;  // Ignore obstacles below this height
}

export interface SimpleThreshold {
  side: DetectionSide;
  enabled: boolean;
  distanceMeters: number;    // Simple distance threshold
  minHeight?: number;
  maxHeight?: number;
}

export interface DryRunConfig {
  enabled: boolean;
  zones: DetectionZone[];
  simpleThresholds: SimpleThreshold[];
  autoCreatePOI: boolean;      // Automatically create POI on detection
  requireConfirmation: boolean; // Require user confirmation before POI
  captureSnapshot: boolean;     // Capture image with POI
}

export interface DetectionEvent {
  id: string;
  timestamp: number;
  zone: DetectionZone | SimpleThreshold;
  side: DetectionSide;
  pointCount: number;
  closestPointDistance: number;
  averageHeight: number;
  poiCreated: boolean;
  poiId?: string;
}

export interface ZoneDetectionState {
  zoneId: string;
  side: DetectionSide;
  isTriggered: boolean;
  pointCount: number;
  lastTriggeredAt: number | null;
  closestPoint: { x: number; y: number; z: number } | null;
}

export const DEFAULT_REAR_ZONE: DetectionZone = {
  id: 'default-rear',
  name: 'Rear Blade Zone',
  side: 'rear',
  enabled: true,
  box: {
    xMin: -80,  // 80m behind vehicle
    xMax: -5,   // 5m behind vehicle
    yMin: -0.5, // 0.5m left of center
    yMax: 0.5,  // 0.5m right of center
    zMin: 1.5,  // 1.5m off ground
    zMax: 2.5,  // 2.5m off ground
  },
  alertThreshold: 10,
  cooldownMs: 2000,
};

export const DEFAULT_LEFT_ZONE: DetectionZone = {
  id: 'default-left',
  name: 'Left Clearance',
  side: 'left',
  enabled: true,
  box: {
    xMin: -5,
    xMax: 5,
    yMin: -10,  // Up to 10m left
    yMax: -2,   // 2m from vehicle center
    zMin: 0.5,
    zMax: 5,
  },
  alertThreshold: 20,
  cooldownMs: 3000,
  ignoreAboveHeight: 4.5, // Ignore things above 4.5m
};

export const DEFAULT_RIGHT_ZONE: DetectionZone = {
  id: 'default-right',
  name: 'Right Clearance',
  side: 'right',
  enabled: true,
  box: {
    xMin: -5,
    xMax: 5,
    yMin: 2,    // 2m from vehicle center
    yMax: 10,   // Up to 10m right
    zMin: 0.5,
    zMax: 5,
  },
  alertThreshold: 20,
  cooldownMs: 3000,
  ignoreAboveHeight: 4.5,
};

export const DEFAULT_DRY_RUN_CONFIG: DryRunConfig = {
  enabled: false,
  zones: [DEFAULT_REAR_ZONE, DEFAULT_LEFT_ZONE, DEFAULT_RIGHT_ZONE],
  simpleThresholds: [],
  autoCreatePOI: true,
  requireConfirmation: false,
  captureSnapshot: true,
};
