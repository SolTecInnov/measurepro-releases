// Stub — original deleted during orphan cleanup
export interface MeasurementRecord { id: string; [key: string]: any; }
export async function saveMeasurement(_record: MeasurementRecord): Promise<boolean> { return false; }
export async function getAllMeasurements(): Promise<MeasurementRecord[]> { return []; }
export async function deleteMeasurement(_id: string): Promise<boolean> { return false; }
export async function clearAllMeasurements(): Promise<boolean> { return false; }
