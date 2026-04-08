// Stub — original deleted during orphan cleanup
interface LidarServiceConfig { host: string; port: number; }
interface LidarStatus { connected: boolean; scanning: boolean; }
interface CaptureRequest { duration?: number; }
interface CaptureInfo { id: string; status: string; }
interface GnssHeartbeat { latitude: number; longitude: number; altitude: number; }
export function setLidarServiceConfig(_newConfig: Partial<LidarServiceConfig>) {}
export function getLidarServiceConfig(): LidarServiceConfig { return { host: 'localhost', port: 8080 }; }
export async function getLidarStatus(): Promise<LidarStatus> { return { connected: false, scanning: false }; }
export async function startStaticCapture(_request?: CaptureRequest): Promise<CaptureInfo> { return { id: '', status: 'error' }; }
export async function startSegmentCapture(_request?: CaptureRequest): Promise<CaptureInfo> { return { id: '', status: 'error' }; }
export async function stopCapture(): Promise<CaptureInfo> { return { id: '', status: 'stopped' }; }
export async function getCapture(_captureId: string): Promise<CaptureInfo> { return { id: '', status: 'unknown' }; }
export async function listCaptures(): Promise<CaptureInfo[]> { return []; }
export async function exportCapture(_captureId: string, _format?: 'laz' | 'las'): Promise<{ path: string }> { return { path: '' }; }
export async function sendGnssHeartbeat(_heartbeat: GnssHeartbeat): Promise<void> {}
export async function checkServiceAvailable(): Promise<boolean> { return false; }
