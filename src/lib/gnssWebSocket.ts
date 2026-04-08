// Stub — original deleted during orphan cleanup
export type GnssWebSocketEventType = 'gnss_sample' | 'connected' | 'disconnected' | 'error';
export interface GnssWebSocketEvent { type: GnssWebSocketEventType; data?: any; }
class GnssWebSocketClient {
  connect(_url: string) {}
  disconnect() {}
  subscribe(_fn: (e: GnssWebSocketEvent) => void) { return () => {}; }
  get isConnected() { return false; }
}
export const gnssWebSocket = new GnssWebSocketClient();
