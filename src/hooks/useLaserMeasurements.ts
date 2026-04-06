/**
 * React Hook for Laser Measurements
 * Provides real-time laser measurement data to React components
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LaserProfileConfig,
  NormalizedLaserMeasurement,
  LaserServiceState
} from '@/lib/hardware/laser/types';
import { LaserService } from '@/lib/hardware/laser/laserService';

export interface UseLaserMeasurementsOptions {
  autoConnect?: boolean;
  autoStream?: boolean;
  onMeasurement?: (measurement: NormalizedLaserMeasurement) => void;
  onError?: (error: Error) => void;
}

export interface UseLaserMeasurementsResult {
  measurement: NormalizedLaserMeasurement | null;
  distanceM: number | null;
  intensity: number | undefined;
  quality: 'good' | 'weak' | 'invalid' | undefined;
  isConnected: boolean;
  isStreaming: boolean;
  error: string | null;
  stats: LaserServiceState['stats'] | null;
  connect: (port?: SerialPort) => Promise<boolean>;
  disconnect: () => Promise<void>;
  startStreaming: () => Promise<void>;
  stopStreaming: () => Promise<void>;
  requestPort: () => Promise<SerialPort | null>;
}

export function useLaserMeasurements(
  profile: LaserProfileConfig | null,
  options: UseLaserMeasurementsOptions = {}
): UseLaserMeasurementsResult {
  const { autoConnect = false, autoStream = false, onMeasurement, onError } = options;

  const [measurement, setMeasurement] = useState<NormalizedLaserMeasurement | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<LaserServiceState['stats'] | null>(null);

  const serviceRef = useRef<LaserService | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!profile) {
      if (serviceRef.current) {
        serviceRef.current.disconnect();
        serviceRef.current = null;
      }
      return;
    }

    serviceRef.current = new LaserService(profile);

    const handleMeasurement = (m: NormalizedLaserMeasurement) => {
      if (!mountedRef.current) return;
      setMeasurement(m);
      setStats(serviceRef.current?.getStats() ?? null);
      onMeasurement?.(m);
    };

    serviceRef.current.addListener(handleMeasurement);

    if (autoConnect) {
      serviceRef.current.connect()
        .then(connected => {
          if (!mountedRef.current) return;
          setIsConnected(connected);
          if (connected && autoStream) {
            return serviceRef.current?.startStreaming();
          }
        })
        .then(() => {
          if (mountedRef.current && autoStream) {
            setIsStreaming(true);
          }
        })
        .catch(err => {
          if (!mountedRef.current) return;
          setError(err.message);
          onError?.(err);
        });
    }

    return () => {
      if (serviceRef.current) {
        serviceRef.current.removeListener(handleMeasurement);
        serviceRef.current.disconnect();
        serviceRef.current = null;
      }
    };
  }, [profile, autoConnect, autoStream, onMeasurement, onError]);

  const connect = useCallback(async (port?: SerialPort): Promise<boolean> => {
    if (!serviceRef.current) {
      setError('No laser profile configured');
      return false;
    }

    try {
      setError(null);
      const connected = await serviceRef.current.connect(port);
      setIsConnected(connected);
      return connected;
    } catch (err: any) {
      setError(err.message);
      onError?.(err);
      return false;
    }
  }, [onError]);

  const disconnect = useCallback(async (): Promise<void> => {
    if (!serviceRef.current) return;

    try {
      await serviceRef.current.disconnect();
      setIsConnected(false);
      setIsStreaming(false);
      setMeasurement(null);
    } catch (err: any) {
      setError(err.message);
      onError?.(err);
    }
  }, [onError]);

  const startStreaming = useCallback(async (): Promise<void> => {
    if (!serviceRef.current) {
      setError('Not connected');
      return;
    }

    try {
      setError(null);
      await serviceRef.current.startStreaming();
      setIsStreaming(true);
    } catch (err: any) {
      setError(err.message);
      onError?.(err);
    }
  }, [onError]);

  const stopStreaming = useCallback(async (): Promise<void> => {
    if (!serviceRef.current) return;

    try {
      await serviceRef.current.stopStreaming();
      setIsStreaming(false);
    } catch (err: any) {
      setError(err.message);
      onError?.(err);
    }
  }, [onError]);

  const requestPort = useCallback(async (): Promise<SerialPort | null> => {
    if (!serviceRef.current) {
      setError('No laser profile configured');
      return null;
    }

    try {
      return await serviceRef.current.requestPort();
    } catch (err: any) {
      setError(err.message);
      onError?.(err);
      return null;
    }
  }, [onError]);

  return {
    measurement,
    distanceM: measurement?.distanceM ?? null,
    intensity: measurement?.intensity,
    quality: measurement?.quality,
    isConnected,
    isStreaming,
    error,
    stats,
    connect,
    disconnect,
    startStreaming,
    stopStreaming,
    requestPort
  };
}
