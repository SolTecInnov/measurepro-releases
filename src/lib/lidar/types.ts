/**
 * LiDAR Service Types
 * Data models for the MeasurePRO LiDAR companion service
 */

export interface LidarStatus {
  connected: boolean;
  packetsPerSec: number;
  timeSyncOk: boolean;
  droppedPackets: number;
  cpuPercent: number;
  diskWriteMBps: number;
  actualPort: number;
}

export interface UsableWidthAtHeight {
  heightM: number;
  widthM: number;
}

export interface LateralClearance {
  leftM: number;
  rightM: number;
}

export interface LidarMetrics {
  roadWidthNow: number;
  minRoadWidthLast100m: number;
  usableWidthAtHeights: UsableWidthAtHeight[];
  lateral: LateralClearance;
  confidence: number;
}

export interface LidarAlert {
  type: string;
  severity: 'warning' | 'critical';
  message: string;
  distanceAheadM: number | null;
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
  intensity?: number;
}

export interface RoadBoundary {
  left: { x: number; y: number }[];
  right: { x: number; y: number }[];
  centerline: { x: number; y: number }[];
}

export interface CrossSectionData {
  points: { y: number; z: number }[];
  roadSurfaceY: number;
  leftEdgeY: number;
  rightEdgeY: number;
  clearanceHeights: { height: number; leftY: number; rightY: number }[];
}

export interface VisualizationData {
  pointCloud: Point3D[];
  crossSection: CrossSectionData | null;
  roadBoundary: RoadBoundary | null;
}

export interface LidarWebSocketMessage {
  ts: string;
  status: LidarStatus;
  metrics: LidarMetrics | null;
  alerts: LidarAlert[];
  activeCapture: CaptureInfo | null;
  visualization?: VisualizationData;
}

export interface CaptureInfo {
  id: string;
  type: 'static' | 'segment';
  status: 'recording' | 'completed' | 'exporting' | 'exported';
  startedAt: string;
  endedAt: string | null;
  poiId: string | null;
  rawSizeBytes: number;
  exportPath: string | null;
  pointCount: number;
}

export interface CaptureRequest {
  durationSec?: number;
  poiId?: string;
}

export interface GnssHeartbeat {
  lat: number;
  lon: number;
  altitudeM: number | null;
  speedMps: number | null;
  headingDeg: number | null;
  fixType: string | null;
  sats: number | null;
  hdop: number | null;
  roll: number | null;
  pitch: number | null;
  yaw: number | null;
  timestamp: string;
}

export interface LidarServiceConfig {
  baseUrl: string;
  wsUrl: string;
}

export const DEFAULT_LIDAR_CONFIG: LidarServiceConfig = {
  baseUrl: 'http://127.0.0.1:17777',
  wsUrl: 'ws://127.0.0.1:17777/ws',
};
