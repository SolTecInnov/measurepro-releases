import { WebSocket, WebSocketServer } from 'ws';
import crypto from 'crypto';

// Session management for slave app pairing
interface PairingSession {
  code: string;  // 6-digit code
  masterWs: WebSocket | null;
  slaveWs: WebSocket | null;
  surveyId: string | null;
  surveyData: any | null;
  createdAt: number;
  expiresAt: number;
}

class SlaveAppPairingManager {
  private sessions: Map<string, PairingSession> = new Map();
  private readonly SESSION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
  private readonly CODE_LENGTH = 6;
  private cleanupInterval: NodeJS.Timeout | null = null;

  // Generate a unique 6-digit pairing code
  generatePairingCode(): string {
    let code: string;
    do {
      code = Math.floor(100000 + Math.random() * 900000).toString();
    } while (this.sessions.has(code));
    return code;
  }

  // Create a new pairing session
  createSession(masterWs: WebSocket): string {
    const code = this.generatePairingCode();
    const now = Date.now();
    
    this.sessions.set(code, {
      code,
      masterWs,
      slaveWs: null,
      surveyId: null,
      surveyData: null,
      createdAt: now,
      expiresAt: now + this.SESSION_TIMEOUT_MS
    });

    console.log(`[Pairing] Created session ${code}`);
    return code;
  }

  // Join an existing session with a pairing code
  joinSession(code: string, slaveWs: WebSocket): boolean {
    const session = this.sessions.get(code);
    
    if (!session) {
      console.log(`[Pairing] Invalid code: ${code}`);
      return false;
    }

    if (Date.now() > session.expiresAt) {
      console.log(`[Pairing] Expired code: ${code}`);
      this.sessions.delete(code);
      return false;
    }

    if (session.slaveWs) {
      console.log(`[Pairing] Code already in use: ${code}`);
      return false;
    }

    session.slaveWs = slaveWs;
    console.log(`[Pairing] Slave joined session ${code}`);

    // Notify master that slave connected
    if (session.masterWs && session.masterWs.readyState === WebSocket.OPEN) {
      session.masterWs.send(JSON.stringify({
        type: 'slave_connected',
        code
      }));
    }

    // Send survey data to slave if available
    if (session.surveyData && slaveWs.readyState === WebSocket.OPEN) {
      slaveWs.send(JSON.stringify({
        type: 'survey_data',
        data: session.surveyData
      }));
    }

    return true;
  }

  // Update survey data for a session
  updateSurveyData(code: string, surveyData: any): void {
    const session = this.sessions.get(code);
    if (session) {
      session.surveyData = surveyData;
      session.surveyId = surveyData.id;

      // Send to slave if connected
      if (session.slaveWs && session.slaveWs.readyState === WebSocket.OPEN) {
        session.slaveWs.send(JSON.stringify({
          type: 'survey_data',
          data: surveyData
        }));
      }
    }
  }

  // Forward measurement from slave to master, then ACK back to slave
  forwardMeasurement(code: string, measurement: any, slaveWs: WebSocket): void {
    const session = this.sessions.get(code);
    if (session && session.masterWs && session.masterWs.readyState === WebSocket.OPEN) {
      session.masterWs.send(JSON.stringify({
        type: 'slave_measurement',
        data: measurement
      }));
      // ACK back to the slave — delivery confirmed
      if (slaveWs.readyState === WebSocket.OPEN) {
        slaveWs.send(JSON.stringify({
          type: 'slave_measurement_ack',
          id: measurement.id
        }));
      }
    } else {
      // Master not reachable — send a failed ACK so the phone keeps the capture queued
      if (slaveWs.readyState === WebSocket.OPEN) {
        slaveWs.send(JSON.stringify({
          type: 'slave_measurement_ack',
          id: measurement.id,
          failed: true
        }));
      }
    }
  }

  // Get session by WebSocket
  getSessionByWebSocket(ws: WebSocket): PairingSession | null {
    for (const session of this.sessions.values()) {
      if (session.masterWs === ws || session.slaveWs === ws) {
        return session;
      }
    }
    return null;
  }

  // Clean up when WebSocket disconnects
  handleDisconnect(ws: WebSocket): void {
    const session = this.getSessionByWebSocket(ws);
    if (session) {
      if (session.masterWs === ws) {
        console.log(`[Pairing] Master disconnected from session ${session.code}`);
        // Notify slave
        if (session.slaveWs && session.slaveWs.readyState === WebSocket.OPEN) {
          session.slaveWs.send(JSON.stringify({ type: 'master_disconnected' }));
        }
        // Delete session
        this.sessions.delete(session.code);
      } else if (session.slaveWs === ws) {
        console.log(`[Pairing] Slave disconnected from session ${session.code}`);
        session.slaveWs = null;
        // Notify master
        if (session.masterWs && session.masterWs.readyState === WebSocket.OPEN) {
          session.masterWs.send(JSON.stringify({ type: 'slave_disconnected' }));
        }
      }
    }
  }

  // Start cleanup interval
  startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const expiredCodes: string[] = [];

      for (const [code, session] of this.sessions.entries()) {
        if (now > session.expiresAt) {
          expiredCodes.push(code);
        }
      }

      expiredCodes.forEach(code => {
        console.log(`[Pairing] Cleaning up expired session ${code}`);
        this.sessions.delete(code);
      });
    }, 60000); // Check every minute
  }

  // Stop cleanup interval
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  // Get active sessions count
  getActiveSessionsCount(): number {
    return this.sessions.size;
  }
}

export const slavePairingManager = new SlaveAppPairingManager();

// Initialize WebSocket handling for slave app pairing
export function initSlaveAppPairing(wss: WebSocketServer): void {
  slavePairingManager.startCleanup();

  wss.on('connection', (ws) => {
    let pairingCode: string | null = null;
    let isMaster = false;

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());

        switch (message.type) {
          case 'slave_pairing_request_code':
            // Master requests a pairing code
            pairingCode = slavePairingManager.createSession(ws);
            isMaster = true;
            ws.send(JSON.stringify({
              type: 'pairing_code',
              code: pairingCode
            }));
            break;

          case 'slave_pairing_join':
            // Slave joins with a code
            if (!message.code || typeof message.code !== 'string') {
              ws.send(JSON.stringify({
                type: 'pairing_join_result',
                success: false,
                error: 'Invalid pairing code'
              }));
              break;
            }
            {
              const code = message.code; // Local const for type narrowing
              pairingCode = code;
              const success = slavePairingManager.joinSession(code, ws);
              ws.send(JSON.stringify({
                type: 'pairing_join_result',
                success,
                code
              }));
            }
            break;

          case 'slave_pairing_update_survey':
            // Master sends updated survey data
            if (pairingCode && isMaster) {
              slavePairingManager.updateSurveyData(pairingCode, message.surveyData);
            }
            break;

          case 'slave_pairing_measurement':
            // Slave sends a measurement to master
            if (pairingCode) {
              slavePairingManager.forwardMeasurement(pairingCode, message.measurement, ws);
            }
            break;

          case 'ping':
            // Heartbeat — keep connection alive through proxy
            ws.send(JSON.stringify({ type: 'pong' }));
            break;
        }
      } catch (error) {
        console.error('[Pairing] Error handling message:', error);
      }
    });

    ws.on('close', () => {
      slavePairingManager.handleDisconnect(ws);
    });
  });

  console.log('✅ Slave app pairing system initialized');
}

// Graceful shutdown
export function shutdownSlaveAppPairing(): void {
  slavePairingManager.stopCleanup();
  console.log('✅ Slave app pairing system shutdown complete');
}
