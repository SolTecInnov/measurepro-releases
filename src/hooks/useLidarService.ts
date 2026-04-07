/**
 * LiDAR Service Hook
 * React hook for connecting to the MeasurePRO LiDAR companion service
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { 
  LidarWebSocketMessage, 
  LidarStatus, 
  LidarMetrics, 
  LidarAlert,
  CaptureInfo,
  VisualizationData
} from '@/lib/lidar/types';
import { 
  getLidarServiceConfig, 
  startStaticCapture, 
  startSegmentCapture, 
  stopCapture as apiStopCapture,
  exportCapture as apiExportCapture,
  sendGnssHeartbeat,
  checkServiceAvailable
} from '@/lib/lidar/api';
import { useGPSStore } from '@/lib/stores/gpsStore';

export interface UseLidarServiceResult {
  isConnected: boolean;
  isServiceAvailable: boolean;
  status: LidarStatus | null;
  metrics: LidarMetrics | null;
  alerts: LidarAlert[];
  activeCapture: CaptureInfo | null;
  visualization: VisualizationData | null;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  startStaticScan: (durationSec?: number, poiId?: string) => Promise<CaptureInfo>;
  startSegment: (durationSec?: number, poiId?: string) => Promise<CaptureInfo>;
  stopCapture: () => Promise<CaptureInfo | null>;
  exportCapture: (captureId: string, format?: 'laz' | 'las') => Promise<string | null>;
}

export function useLidarService(): UseLidarServiceResult {
  const [isConnected, setIsConnected] = useState(false);
  const [isServiceAvailable, setIsServiceAvailable] = useState(false);
  const [status, setStatus] = useState<LidarStatus | null>(null);
  const [metrics, setMetrics] = useState<LidarMetrics | null>(null);
  const [alerts, setAlerts] = useState<LidarAlert[]>([]);
  const [activeCapture, setActiveCapture] = useState<CaptureInfo | null>(null);
  const [visualization, setVisualization] = useState<VisualizationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const gnssIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const gpsData = useGPSStore((state) => state.data);

  const latestGpsRef = useRef(gpsData);
  useEffect(() => {
    latestGpsRef.current = gpsData;
  }, [gpsData]);

  const connectRef = useRef<() => void>(() => {});
  
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    const config = getLidarServiceConfig();
    
    try {
      wsRef.current = new WebSocket(config.wsUrl);
      
      wsRef.current.onopen = () => {
        console.log('[LiDAR] WebSocket connected');
        setIsConnected(true);
        setIsServiceAvailable(true);
        setError(null);
        
        gnssIntervalRef.current = setInterval(() => {
          const gps = latestGpsRef.current;
          if (gps && gps.latitude !== 0) {
            sendGnssHeartbeat({
              lat: gps.latitude,
              lon: gps.longitude,
              altitudeM: gps.altitude ?? null,
              speedMps: gps.speed ?? null,
              headingDeg: gps.heading ?? null,
              fixType: gps.fixQuality ?? null,
              sats: gps.satellites ?? null,
              hdop: gps.hdop ?? null,
              roll: gps.imu?.roll ?? null,
              pitch: gps.imu?.pitch ?? null,
              yaw: gps.imu?.heading ?? null,
              timestamp: new Date().toISOString(),
            }).catch(() => {});
          }
        }, 200);
      };
      
      wsRef.current.onmessage = (event) => {
        try {
          const message: LidarWebSocketMessage = JSON.parse(event.data);
          setStatus(message.status);
          setMetrics(message.metrics);
          setAlerts(message.alerts);
          setActiveCapture(message.activeCapture ?? null);
          setVisualization(message.visualization ?? null);
        } catch (e) {
          console.error('[LiDAR] Failed to parse message:', e);
        }
      };
      
      wsRef.current.onclose = () => {
        console.log('[LiDAR] WebSocket disconnected');
        setIsConnected(false);
        
        if (gnssIntervalRef.current) {
          clearInterval(gnssIntervalRef.current);
          gnssIntervalRef.current = null;
        }
        
        reconnectTimeoutRef.current = setTimeout(() => {
          connectRef.current();
        }, 3000);
      };
      
      wsRef.current.onerror = (e) => {
        console.error('[LiDAR] WebSocket error:', e);
        setError('Failed to connect to LiDAR service');
        setIsServiceAvailable(false);
      };
    } catch (e) {
      console.error('[LiDAR] Failed to create WebSocket:', e);
      setError('LiDAR service not available');
      setIsServiceAvailable(false);
    }
  }, []);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);
  
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (gnssIntervalRef.current) {
      clearInterval(gnssIntervalRef.current);
      gnssIntervalRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setVisualization(null);
  }, []);
  
  const startStaticScan = useCallback(async (durationSec?: number, poiId?: string): Promise<CaptureInfo> => {
    const capture = await startStaticCapture({ durationSec, poiId });
    setActiveCapture(capture);
    return capture;
  }, []);
  
  const startSegment = useCallback(async (durationSec?: number, poiId?: string): Promise<CaptureInfo> => {
    const capture = await startSegmentCapture({ durationSec, poiId });
    setActiveCapture(capture);
    return capture;
  }, []);
  
  const stopCaptureHandler = useCallback(async (): Promise<CaptureInfo | null> => {
    try {
      const capture = await apiStopCapture();
      setActiveCapture(null);
      return capture;
    } catch {
      setActiveCapture(null);
      return null;
    }
  }, []);
  
  const exportCaptureHandler = useCallback(async (captureId: string, format: 'laz' | 'las' = 'laz'): Promise<string | null> => {
    try {
      const result = await apiExportCapture(captureId, format);
      return result.path;
    } catch {
      return null;
    }
  }, []);
  
  useEffect(() => {
    // PERF: Only check LiDAR availability if user has navigated to LiDAR page
    // Avoids network call on every Settings mount
    const lidarEnabled = localStorage.getItem('lidar_service_enabled') === 'true';
    if (!lidarEnabled) return;
    checkServiceAvailable().then(setIsServiceAvailable);
  }, []);
  
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);
  
  return {
    isConnected,
    isServiceAvailable,
    status,
    metrics,
    alerts,
    activeCapture,
    visualization,
    error,
    connect,
    disconnect,
    startStaticScan,
    startSegment,
    stopCapture: stopCaptureHandler,
    exportCapture: exportCaptureHandler,
  };
}
