export interface MeasurementRecord {
  id: string;
  timestamp: number;
  location: {
    lat: number | null;
    lon: number | null;
  };
  structureType: 'bridge' | 'traffic_signal' | 'railroad' | 'lane_marking' | 'envelope_clearance_violation';
  verticalClearance: {
    camera: {
      value: number;
      confidence: number;
    } | null;
    laser: {
      value: number;
    } | null;
    validated: {
      value: number;
      status: string;
      confidence: number;
    } | null;
  };
  horizontalMeasurements: {
    widths: number[];
    spacings: number[];
  };
  tensorflowDetections: any[];
  calibrationUsed: {
    focalLength: { x: number; y: number } | null;
    reprojectionError: number | null;
    calibrationDate: number | null;
  };
  originalImage: string;
  annotatedImage: string;
  notes: string;
  complianceLevel?: 'COMPLIANT' | 'RESTRICTED';
}
