// Stub — original deleted during orphan cleanup
import type { ICamera } from './CameraInterface';
export class ZED2iCamera implements ICamera {
  async initialize() { return false; }
  async capture() { return null; }
  async startPreview() {}
  async stopPreview() {}
  async shutdown() {}
  isAvailable() { return false; }
  getStatus() { return { connected: false, streaming: false }; }
}
export async function isZED2iAvailable(): Promise<boolean> { return false; }
