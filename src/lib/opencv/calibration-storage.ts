// Stub — original deleted during orphan cleanup
export interface CalibrationData { matrix: number[][]; distortion: number[]; timestamp: string; }
export async function saveCalibrationToStorage(_calibration: CalibrationData): Promise<boolean> { return false; }
export async function loadCalibrationFromStorage(): Promise<CalibrationData | null> { return null; }
