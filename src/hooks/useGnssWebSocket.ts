/**
 * React Hook for GNSS WebSocket
 * Provides real-time GNSS data updates to components
 */

import { useState, useEffect, useCallback } from 'react';
import { gnssWebSocket } from '@/lib/gnssWebSocket';
import type { GnssSample } from '../../server/gnss/types';
import type { GnssWebSocketEvent } from '@/lib/gnssWebSocket';

export interface UseGnssWebSocketReturn {
  latestSample: GnssSample | null;
  isConnected: boolean;
  error: string | null;
  reconnect: () => void;
}

export function useGnssWebSocket(): UseGnssWebSocketReturn {
  const [latestSample, setLatestSample] = useState<GnssSample | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEvent = useCallback((event: GnssWebSocketEvent) => {
    switch (event.type) {
      case 'gnss_sample':
        if (event.data) {
          setLatestSample(event.data);
          setError(null);
        }
        break;
      case 'connected':
        setIsConnected(true);
        setError(null);
        break;
      case 'disconnected':
        setIsConnected(false);
        break;
      case 'error':
        setError(event.error || 'Unknown WebSocket error');
        break;
    }
  }, []);

  const reconnect = useCallback(() => {
    gnssWebSocket.disconnect();
    setTimeout(() => {
      gnssWebSocket.connect();
    }, 100);
  }, []);

  useEffect(() => {
    gnssWebSocket.addListener(handleEvent);
    gnssWebSocket.connect();

    return () => {
      gnssWebSocket.removeListener(handleEvent);
    };
  }, [handleEvent]);

  return {
    latestSample,
    isConnected,
    error,
    reconnect,
  };
}
