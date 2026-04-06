/**
 * LiDAR Service API Client
 * HTTP endpoints for the MeasurePRO LiDAR companion service
 */

import type { 
  LidarStatus, 
  CaptureInfo, 
  CaptureRequest, 
  GnssHeartbeat,
  LidarServiceConfig
} from './types';

let config: LidarServiceConfig = {
  baseUrl: 'http://127.0.0.1:17777',
  wsUrl: 'ws://127.0.0.1:17777/ws',
};

export function setLidarServiceConfig(newConfig: Partial<LidarServiceConfig>) {
  config = { ...config, ...newConfig };
}

export function getLidarServiceConfig(): LidarServiceConfig {
  return config;
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${config.baseUrl}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  
  return response.json();
}

export async function getLidarStatus(): Promise<LidarStatus> {
  return fetchApi<LidarStatus>('/api/status');
}

export async function startStaticCapture(request?: CaptureRequest): Promise<CaptureInfo> {
  return fetchApi<CaptureInfo>('/api/capture/static/start', {
    method: 'POST',
    body: JSON.stringify(request || {}),
  });
}

export async function startSegmentCapture(request?: CaptureRequest): Promise<CaptureInfo> {
  return fetchApi<CaptureInfo>('/api/capture/segment/start', {
    method: 'POST',
    body: JSON.stringify(request || {}),
  });
}

export async function stopCapture(): Promise<CaptureInfo> {
  return fetchApi<CaptureInfo>('/api/capture/stop', { method: 'POST' });
}

export async function getCapture(captureId: string): Promise<CaptureInfo> {
  return fetchApi<CaptureInfo>(`/api/capture/${captureId}`);
}

export async function listCaptures(): Promise<CaptureInfo[]> {
  return fetchApi<CaptureInfo[]>('/api/captures');
}

export async function exportCapture(captureId: string, format: 'laz' | 'las' = 'laz'): Promise<{ path: string }> {
  return fetchApi<{ path: string }>(`/api/capture/${captureId}/export`, {
    method: 'POST',
    body: JSON.stringify({ format }),
  });
}

export async function sendGnssHeartbeat(heartbeat: GnssHeartbeat): Promise<void> {
  await fetchApi<void>('/api/gnss/heartbeat', {
    method: 'POST',
    body: JSON.stringify(heartbeat),
  });
}

export async function checkServiceAvailable(): Promise<boolean> {
  try {
    await getLidarStatus();
    return true;
  } catch {
    return false;
  }
}
