// Stub — original deleted during orphan cleanup
export interface BridgeClearanceMeasurement { minClearance: number; maxClearance: number; confidence: number; }
export interface LaneWidthMeasurement { width: number; confidence: number; }
export interface TrafficSignalMeasurement { height: number; spacing: number; }
export interface ValidationResult { valid: boolean; errors: string[]; }
export interface MeasurementResult { value: number; unit: string; confidence: number; }
export interface ComplianceCheck { passed: boolean; details: string; }
export async function measureBridgeMinimumClearance(_frame: any): Promise<BridgeClearanceMeasurement | null> { return null; }
export async function measureLaneWidth(_frame: any): Promise<LaneWidthMeasurement | null> { return null; }
export async function measureTrafficSignalSpacing(_frame: any): Promise<TrafficSignalMeasurement | null> { return null; }
export async function getLaserMeasurement(_lastMeasurement: string): Promise<MeasurementResult | null> { return null; }
export function validateCameraMeasurement(_result: any): ValidationResult { return { valid: false, errors: ['stub'] }; }
