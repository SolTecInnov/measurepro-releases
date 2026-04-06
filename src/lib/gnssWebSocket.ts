/**
 * GNSS WebSocket Client for MeasurePRO RoadScope
 * Real-time GNSS data streaming from backend
 */

import type { GnssSample } from '../../server/gnss/types';

export type GnssWebSocketEventType = 'gnss_sample' | 'connected' | 'disconnected' | 'error';

export interface GnssWebSocketEvent {
  type: GnssWebSocketEventType;
  data?: GnssSample;
  error?: string;
}

type EventListener = (event: GnssWebSocketEvent) => void;

class GnssWebSocketClient {
  private ws: WebSocket | null = null;
  private listeners: Set<EventListener> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000; // Start with 1 second
  private maxReconnectDelay = 30000; // Max 30 seconds
  private reconnectTimer: NodeJS.Timeout | null = null;
  private url: string;
  private isIntentionallyClosed = false;

  constructor() {
    // Use same host but websocket protocol
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    // Try to connect to the WebSocket endpoint (backend should handle this)
    this.url = `${protocol}//${host}/ws/gnss`;
  }

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    this.isIntentionallyClosed = false;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.emit({ type: 'connected' });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'gnss_sample' && data.data) {
            this.emit({ type: 'gnss_sample', data: data.data });
          }
        } catch (error) {
          this.emit({ 
            type: 'error', 
            error: error instanceof Error ? error.message : 'Failed to parse WebSocket message' 
          });
        }
      };

      this.ws.onerror = (error) => {
        this.emit({ type: 'error', error: 'WebSocket connection error' });
      };

      this.ws.onclose = () => {
        this.emit({ type: 'disconnected' });
        
        // Only attempt reconnect if not intentionally closed
        if (!this.isIntentionallyClosed) {
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      this.emit({ 
        type: 'error', 
        error: error instanceof Error ? error.message : 'Failed to create WebSocket connection' 
      });
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.isIntentionallyClosed = true;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.isIntentionallyClosed) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit({ 
        type: 'error', 
        error: `Failed to reconnect after ${this.maxReconnectAttempts} attempts` 
      });
      return;
    }

    this.reconnectAttempts++;
    
    // Exponential backoff
    const delay = Math.min(this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1), this.maxReconnectDelay);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  /**
   * Add event listener
   */
  addListener(listener: EventListener): void {
    this.listeners.add(listener);
  }

  /**
   * Remove event listener
   */
  removeListener(listener: EventListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Emit event to all listeners
   */
  private emit(event: GnssWebSocketEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        // Silently ignore listener errors
      }
    });
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get connection state
   */
  getReadyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }
}

// Singleton instance
export const gnssWebSocket = new GnssWebSocketClient();
