// Stub — original deleted during orphan cleanup
export interface CalibrationResult { success: boolean; error?: string; matrix?: number[][]; distortion?: number[]; }
export async function calculateCameraCalibration(_images: any[]): Promise<CalibrationResult> { return { success: false, error: 'stub' }; }
export async function captureCalibrationImage(_video: HTMLVideoElement): Promise<string | null> { return null; }
