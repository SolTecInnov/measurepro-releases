import { WebSocket, WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';
import type { 
  ConvoySession, 
  ConvoyMember, 
  ConvoyMessage,
  RouteEnforcementConvoy,
  RouteEnforcementMember,
  RouteEnforcementMessage,
  RouteIncident
} from '../shared/schema.js';
import { db } from '../db/index.js';
import { convoySessions, convoyEvents } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

interface SessionData {
  session: ConvoySession;
  members: Map<string, MemberConnection>;
  leaderConnection: WebSocket | null;
  lastLeaderSeen: number;
  leaderGPS: {
    latitude: number;
    longitude: number;
    altitude: number;
    timestamp: number;
  } | null;
  aggregatedLogs: Record<string, any[]>;
}

interface MemberConnection {
  member: ConvoyMember;
  ws: WebSocket;
  lastSeen: number;
  heartbeatTimeout?: NodeJS.Timeout;
}

interface RouteEnforcementSessionData {
  convoy: RouteEnforcementConvoy;
  members: Map<string, RouteEnforcementMemberConnection>;
  dispatchConnection: WebSocket | null;
  incidents: Map<string, RouteIncident>;
}

interface RouteEnforcementMemberConnection {
  member: RouteEnforcementMember;
  ws: WebSocket;
  lastSeen: number;
  lastGPS: {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
  } | null;
  offRouteStart: number | null; // Timestamp when off-route violation started (for persistence check)
}

class ConvoyHub {
  private sessions: Map<string, SessionData> = new Map();
  private routeEnforcementSessions: Map<string, RouteEnforcementSessionData> = new Map();
  private wss: WebSocketServer | null = null;
  private leaderTimeoutInterval: NodeJS.Timeout | null = null;
  private heartbeatCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start periodic checks
    this.startLeaderTimeoutChecker();
    this.startHeartbeatChecker();
    // Load persisted active sessions on startup
    this.loadSessionsFromDB().catch(err => {
      console.error('⚠️ Failed to load convoy sessions from DB on startup:', err);
    });
  }

  /**
   * Load active convoy sessions from the database on startup
   */
  private async loadSessionsFromDB(): Promise<void> {
    try {
      const activeSessions = await db
        .select()
        .from(convoySessions)
        .where(eq(convoySessions.status, 'active'));

      let restoredGuardian = 0;
      let restoredEnforcement = 0;

      for (const row of activeSessions) {
        const now = new Date();
        const expiresAt = row.expiresAt ? new Date(row.expiresAt) : null;
        if (expiresAt && expiresAt < now) {
          // Mark expired sessions as ended
          await db
            .update(convoySessions)
            .set({ status: 'ended', endedAt: now })
            .where(eq(convoySessions.id, row.id));
          continue;
        }

        if (row.sessionType === 'guardian') {
          const session: ConvoySession = {
            id: row.id,
            leaderId: row.leaderId || '',
            sessionName: row.sessionName || '',
            status: 'active',
            maxMembers: row.maxMembers || 10,
            warningThreshold: row.warningThreshold ? row.warningThreshold / 100 : 3.0,
            criticalThreshold: row.criticalThreshold ? row.criticalThreshold / 100 : 1.5,
            groundReference: row.groundReference ? row.groundReference / 100 : 0,
            createdAt: row.createdAt?.toISOString() || new Date().toISOString(),
            expiresAt: row.expiresAt?.toISOString() || null,
            qrToken: row.token,
          };

          this.sessions.set(row.id, {
            session,
            members: new Map(),
            leaderConnection: null,
            lastLeaderSeen: Date.now(),
            leaderGPS: null,
            aggregatedLogs: {},
          });
          restoredGuardian++;
        } else if (row.sessionType === 'enforcement') {
          const statusValue: 'active' | 'paused' | 'ended' =
            row.status === 'paused' ? 'paused' : row.status === 'ended' ? 'ended' : 'active';
          const envValue: 'rural' | 'urban' = row.environmentType === 'urban' ? 'urban' : 'rural';
          const geometry = Array.isArray(row.routeGeometry) ? (row.routeGeometry as [number, number][]) : [];

          const convoy: RouteEnforcementConvoy = {
            id: row.id,
            dispatcherId: row.dispatcherId || '',
            convoyName: row.sessionName || '',
            status: statusValue,
            routeGeometry: geometry,
            allowedDeviationMeters: row.allowedDeviationMeters ? row.allowedDeviationMeters / 10 : 30,
            persistenceSeconds: row.persistenceSeconds || 7,
            maxAccuracyMeters: 15,
            environmentType: envValue,
            windowStart: row.windowStart?.toISOString() || new Date().toISOString(),
            windowEnd: row.windowEnd?.toISOString() || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            dispatchPhone: row.dispatchPhone || undefined,
            dispatchEmail: row.dispatchEmail || undefined,
            qrToken: row.token,
            createdAt: row.createdAt?.toISOString() || new Date().toISOString(),
            expiresAt: row.expiresAt?.toISOString() || null,
          };

          this.routeEnforcementSessions.set(row.id, {
            convoy,
            members: new Map(),
            dispatchConnection: null,
            incidents: new Map(),
          });
          restoredEnforcement++;
        }
      }

      if (restoredGuardian > 0 || restoredEnforcement > 0) {
        console.log(`📂 Restored ${restoredGuardian} guardian + ${restoredEnforcement} enforcement session(s) from database`);
      }
    } catch (err) {
      console.error('❌ Error loading sessions from DB:', err);
    }
  }

  /**
   * Persist a convoy session record to the database
   */
  private async persistSessionToDB(session: ConvoySession): Promise<void> {
    try {
      const expiresAt = session.expiresAt ? new Date(session.expiresAt) : null;
      await db
        .insert(convoySessions)
        .values({
          id: session.id,
          token: session.qrToken,
          sessionType: 'guardian',
          sessionName: session.sessionName,
          status: 'active',
          leaderId: session.leaderId,
          warningThreshold: Math.round(session.warningThreshold * 100),
          criticalThreshold: Math.round(session.criticalThreshold * 100),
          groundReference: Math.round(session.groundReference * 100),
          maxMembers: session.maxMembers,
          createdAt: new Date(session.createdAt),
          expiresAt,
        })
        .onConflictDoUpdate({
          target: convoySessions.id,
          set: { status: 'active' },
        });
    } catch (err) {
      console.error('❌ Error persisting session to DB:', err);
    }
  }

  /**
   * Flush aggregated member events to the database on convoy end
   */
  private async flushEventsToDB(
    sessionId: string,
    aggregatedLogs: Record<string, any[]>
  ): Promise<void> {
    try {
      const allEvents: typeof convoyEvents.$inferInsert[] = [];

      for (const [memberId, events] of Object.entries(aggregatedLogs)) {
        for (const event of events) {
          allEvents.push({
            id: event.id || randomUUID(),
            sessionId,
            memberId: event.memberId || memberId,
            memberName: event.actor?.name || null,
            eventCategory: event.eventCategory || 'unknown',
            eventType: event.eventType || 'unknown',
            eventData: event,
            eventTimestamp: typeof event.timestamp === 'number' ? event.timestamp : Date.now(),
            sequenceNumber: event.sequenceNumber || null,
          });
        }
      }

      if (allEvents.length === 0) return;

      // Insert in batches of 500
      const BATCH_SIZE = 500;
      for (let i = 0; i < allEvents.length; i += BATCH_SIZE) {
        const batch = allEvents.slice(i, i + BATCH_SIZE);
        await db.insert(convoyEvents).values(batch).onConflictDoNothing();
      }

      console.log(`✅ Flushed ${allEvents.length} convoy events to database for session ${sessionId}`);
    } catch (err) {
      console.error('❌ Error flushing events to DB:', err);
    }
  }

  /**
   * Initialize WebSocket server
   */
  public initWebSocketServer(wss: WebSocketServer) {
    this.wss = wss;

    wss.on('connection', (ws: WebSocket, req) => {

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString()) as ConvoyMessage;
          console.log(`📨 Received convoy message: ${message.type} for session ${message.sessionId || 'unknown'}`);
          this.handleMessage(ws, message);
        } catch (error) {
          console.error('❌ Failed to parse WebSocket message:', error);
          this.sendError(ws, 'Invalid message format');
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });
  }

  /**
   * Create a new convoy session
   */
  public createSession(params: {
    sessionName: string;
    warningThreshold: number;
    criticalThreshold: number;
    groundReference: number;
    maxMembers: number;
    leaderId: string;
  }): { sessionId: string; qrToken: string } {
    const sessionId = randomUUID();
    const qrToken = randomUUID().substring(0, 8).toUpperCase(); // Short, memorable code
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

    const session: ConvoySession = {
      id: sessionId,
      leaderId: params.leaderId,
      sessionName: params.sessionName,
      status: 'active',
      maxMembers: params.maxMembers,
      warningThreshold: params.warningThreshold,
      criticalThreshold: params.criticalThreshold,
      groundReference: params.groundReference,
      createdAt: now,
      expiresAt,
      qrToken,
    };

    this.sessions.set(sessionId, {
      session,
      members: new Map(),
      leaderConnection: null,
      lastLeaderSeen: Date.now(),
      leaderGPS: null,
      aggregatedLogs: {},
    });

    console.log(`✅ Created convoy session: ${params.sessionName} (ID: ${sessionId}, Token: ${qrToken})`);
    console.log(`📊 Total active sessions: ${this.sessions.size}`);

    // Persist to database
    this.persistSessionToDB(session).catch(err => {
      console.error('⚠️ Failed to persist convoy session to DB:', err);
    });

    return { sessionId, qrToken };
  }

  /**
   * Find session by QR token
   */
  private findSessionByToken(token: string): SessionData | null {
    for (const sessionData of this.sessions.values()) {
      if (sessionData.session.qrToken === token) {
        return sessionData;
      }
    }
    return null;
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(ws: WebSocket, message: ConvoyMessage | RouteEnforcementMessage) {
    switch (message.type) {
      // Convoy Guardian messages
      case 'join_request':
        this.handleJoinRequest(ws, message as ConvoyMessage);
        break;

      case 'measurement':
        this.handleMeasurement(ws, message as ConvoyMessage);
        break;

      case 'alert':
        this.handleAlert(ws, message as ConvoyMessage);
        break;

      case 'gps':
        this.handleGPS(ws, message as ConvoyMessage);
        break;

      case 'config_change':
        this.handleConfigChange(ws, message as ConvoyMessage);
        break;

      case 'emergency':
        this.handleEmergency(ws, message as ConvoyMessage);
        break;

      case 'emergency_acknowledged':
        this.handleEmergencyAcknowledged(ws, message as ConvoyMessage);
        break;

      case 'member_status':
        this.handleMemberStatus(ws, message as ConvoyMessage);
        break;

      case 'log_sync_batch':
        this.handleLogSyncBatch(ws, message as ConvoyMessage);
        break;

      case 'sync_acknowledgment':
        this.handleSyncAcknowledgment(ws, message as ConvoyMessage);
        break;

      // Route Enforcement messages
      case 'route_join_request':
        this.handleRouteJoinRequest(ws, message as RouteEnforcementMessage);
        break;

      case 'position_update':
        this.handlePositionUpdate(ws, message as RouteEnforcementMessage);
        break;

      case 'off_route_alert':
        this.handleOffRouteAlert(ws, message as RouteEnforcementMessage);
        break;

      case 'incident_acknowledged':
        this.handleIncidentAcknowledged(ws, message as RouteEnforcementMessage);
        break;

      case 'incident_cleared':
        this.handleIncidentCleared(ws, message as RouteEnforcementMessage);
        break;

      case 'stop_command':
        this.handleStopCommand(ws, message as RouteEnforcementMessage);
        break;

      case 'resume_command':
        this.handleResumeCommand(ws, message as RouteEnforcementMessage);
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  /**
   * Handle join request from a convoy member
   */
  private handleJoinRequest(ws: WebSocket, message: ConvoyMessage) {
    const { sessionToken, memberData } = message.data;
    console.log(`🔍 Looking for session with token: ${sessionToken}`);
    console.log(`🗂️  Active sessions: ${this.sessions.size}`);
    for (const [sessionId, data] of this.sessions.entries()) {
      console.log(`  - Session ${sessionId}: token=${data.session.qrToken}`);
    }
    
    const sessionData = this.findSessionByToken(sessionToken);

    if (!sessionData) {
      console.error(`❌ Session not found for token: ${sessionToken}`);
      this.send(ws, {
        type: 'join_denied',
        sessionId: '',
        data: {
          reason: 'Invalid session token'
        },
        timestamp: Date.now(),
      });
      return;
    }

    if (sessionData.session.status !== 'active') {
      this.send(ws, {
        type: 'join_denied',
        sessionId: '',
        data: {
          reason: 'Session is not active'
        },
        timestamp: Date.now(),
      });
      return;
    }

    if (sessionData.members.size >= sessionData.session.maxMembers) {
      this.send(ws, {
        type: 'join_denied',
        sessionId: '',
        data: {
          reason: 'Session is full'
        },
        timestamp: Date.now(),
      });
      return;
    }

    // Create member
    const memberId = randomUUID();
    const member: ConvoyMember = {
      id: memberId,
      sessionId: sessionData.session.id,
      name: memberData.name,
      role: memberData.role,
      vehicleId: memberData.vehicleId,
      company: memberData.company,
      phoneNumber: memberData.phoneNumber,
      radioChannel: memberData.radioChannel,
      joinedAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      isConnected: true,
    };

    // Store member connection
    sessionData.members.set(memberId, {
      member,
      ws,
      lastSeen: Date.now(),
    });

    // If this is the leader, store their connection
    if (member.role === 'lead' || memberData.isLeader) {
      sessionData.leaderConnection = ws;
      sessionData.lastLeaderSeen = Date.now();
    }

    // Send approval to the joining member
    this.send(ws, {
      type: 'join_approved',
      sessionId: sessionData.session.id,
      data: {
        memberId,
        session: sessionData.session,
        members: Array.from(sessionData.members.values()).map(mc => mc.member),
      },
      timestamp: Date.now(),
    });

    // Broadcast member joined to all other members
    this.broadcastToSession(sessionData.session.id, {
      type: 'member_status',
      sessionId: sessionData.session.id,
      data: {
        action: 'joined',
        member,
      },
      timestamp: Date.now(),
    }, ws);
  }

  /**
   * Handle measurement update from leader
   */
  private handleMeasurement(ws: WebSocket, message: ConvoyMessage) {
    const sessionData = this.sessions.get(message.sessionId);
    if (!sessionData) return;

    // Update leader last seen
    if (sessionData.leaderConnection === ws) {
      sessionData.lastLeaderSeen = Date.now();
    }

    // Broadcast measurement to all members
    this.broadcastToSession(message.sessionId, message, ws);
  }

  /**
   * Handle alert broadcast
   */
  private handleAlert(ws: WebSocket, message: ConvoyMessage) {
    const sessionData = this.sessions.get(message.sessionId);
    if (!sessionData) return;

    // Broadcast alert to all members
    this.broadcastToSession(message.sessionId, message);
  }

  /**
   * Handle GPS position update
   */
  private handleGPS(ws: WebSocket, message: ConvoyMessage) {
    const sessionData = this.sessions.get(message.sessionId);
    if (!sessionData) return;

    // Update leader GPS if this is from the leader
    if (sessionData.leaderConnection === ws) {
      sessionData.leaderGPS = {
        latitude: message.data.latitude,
        longitude: message.data.longitude,
        altitude: message.data.altitude,
        timestamp: Date.now(),
      };
      sessionData.lastLeaderSeen = Date.now();
    }

    // Broadcast GPS to all members
    this.broadcastToSession(message.sessionId, message, ws);
  }

  /**
   * Handle configuration change
   */
  private handleConfigChange(ws: WebSocket, message: ConvoyMessage) {
    const sessionData = this.sessions.get(message.sessionId);
    if (!sessionData) return;

    // Only leader can change config
    if (sessionData.leaderConnection !== ws) {
      this.sendError(ws, 'Only leader can change configuration');
      return;
    }

    // Update session settings
    if (message.data.warningThreshold !== undefined) {
      sessionData.session.warningThreshold = message.data.warningThreshold;
    }
    if (message.data.criticalThreshold !== undefined) {
      sessionData.session.criticalThreshold = message.data.criticalThreshold;
    }
    if (message.data.groundReference !== undefined) {
      sessionData.session.groundReference = message.data.groundReference;
    }

    // Broadcast config change to all members
    this.broadcastToSession(message.sessionId, message);
  }

  /**
   * Handle emergency stop
   */
  private handleEmergency(ws: WebSocket, message: ConvoyMessage) {
    const sessionData = this.sessions.get(message.sessionId);
    if (!sessionData) return;

    const triggeredBy = message.data.triggeredBy || 'Unknown';

    // Broadcast emergency to all members with full details including who triggered it
    this.broadcastToSession(message.sessionId, {
      type: 'emergency',
      sessionId: message.sessionId,
      data: {
        reason: message.data.reason || 'Emergency stop initiated',
        message: message.data.message || `🚨 EMERGENCY STOP - Triggered by ${triggeredBy}`,
        triggeredBy: triggeredBy,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    });
  }

  /**
   * Handle emergency acknowledgement - clears emergency state for all members
   */
  private handleEmergencyAcknowledged(ws: WebSocket, message: ConvoyMessage) {
    const sessionData = this.sessions.get(message.sessionId);
    if (!sessionData) return;

    const acknowledgedBy = message.data.acknowledgedBy || 'Unknown';

    // Broadcast emergency clear to all members
    this.broadcastToSession(message.sessionId, {
      type: 'emergency_acknowledged',
      sessionId: message.sessionId,
      data: {
        acknowledgedBy: acknowledgedBy,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    });
  }

  /**
   * Handle member status updates (heartbeat)
   */
  private handleMemberStatus(ws: WebSocket, message: ConvoyMessage) {
    const sessionData = this.sessions.get(message.sessionId);
    if (!sessionData) return;

    // Find member by websocket
    for (const [memberId, memberConn] of sessionData.members.entries()) {
      if (memberConn.ws === ws) {
        memberConn.lastSeen = Date.now();
        memberConn.member.lastSeen = new Date().toISOString();
        
        // Update leader last seen if this is the leader
        if (sessionData.leaderConnection === ws) {
          sessionData.lastLeaderSeen = Date.now();
        }
        break;
      }
    }
  }

  /**
   * Handle log sync batch from follower - forward to leader only and store server-side
   */
  private handleLogSyncBatch(ws: WebSocket, message: ConvoyMessage) {
    const sessionData = this.sessions.get(message.sessionId);
    if (!sessionData) return;

    const { memberId, memberName, events } = message.data;
    console.log(`📦 Received log sync batch from member ${memberName}: ${events.length} events`);

    // Store events server-side for DB persistence on session end
    if (!sessionData.aggregatedLogs[memberId]) {
      sessionData.aggregatedLogs[memberId] = [];
    }
    const existingIds = new Set(sessionData.aggregatedLogs[memberId].map((e: any) => e.id));
    const newEvents = events.filter((e: any) => !existingIds.has(e.id));
    sessionData.aggregatedLogs[memberId].push(...newEvents);

    // Keep per-member cap
    const MAX_PER_MEMBER = 10000;
    if (sessionData.aggregatedLogs[memberId].length > MAX_PER_MEMBER) {
      sessionData.aggregatedLogs[memberId].splice(0, sessionData.aggregatedLogs[memberId].length - MAX_PER_MEMBER);
    }

    // Forward only to leader (not broadcast to all members)
    if (sessionData.leaderConnection && sessionData.leaderConnection.readyState === WebSocket.OPEN) {
      this.send(sessionData.leaderConnection, message);
    } else {
      console.warn('⚠️ Cannot forward log sync batch: leader not connected');
    }
  }

  /**
   * Handle sync acknowledgment from leader - forward back to specific follower
   */
  private handleSyncAcknowledgment(ws: WebSocket, message: ConvoyMessage) {
    const sessionData = this.sessions.get(message.sessionId);
    if (!sessionData) return;

    const targetMemberId = message.data.memberId;
    console.log(`✅ Forwarding sync acknowledgment to member ${targetMemberId}`);

    // Find the target member's websocket and send acknowledgment
    for (const [memberId, memberConn] of sessionData.members.entries()) {
      if (message.data.memberId === memberId || memberConn.member.id === targetMemberId) {
        this.send(memberConn.ws, message);
        return;
      }
    }

    console.warn(`⚠️ Could not find member ${targetMemberId} to send sync acknowledgment`);
  }

  /**
   * Handle WebSocket disconnect
   */
  private handleDisconnect(ws: WebSocket) {
    // Find which session and member this belongs to
    for (const [sessionId, sessionData] of this.sessions.entries()) {
      // Check if this is the leader
      if (sessionData.leaderConnection === ws) {
        sessionData.leaderConnection = null;

        // Flush forensic events to DB when leader leaves (data persistence guarantee)
        // Snapshot and clear aggregatedLogs so a subsequent endSession flush won't duplicate
        const logsSnapshot = sessionData.aggregatedLogs;
        sessionData.aggregatedLogs = {};
        this.flushEventsToDB(sessionId, logsSnapshot).catch(err =>
          console.warn('⚠️ Failed to flush events on leader disconnect:', err)
        );
        
        // Broadcast leader disconnected
        this.broadcastToSession(sessionId, {
          type: 'leader_status',
          sessionId,
          data: {
            connected: false,
            lastSeen: sessionData.lastLeaderSeen,
            gps: sessionData.leaderGPS,
          },
          timestamp: Date.now(),
        });
        return;
      }

      // Check if this is a member
      for (const [memberId, memberConn] of sessionData.members.entries()) {
        if (memberConn.ws === ws) {
          memberConn.member.isConnected = false;
          
          // Broadcast member disconnected
          this.broadcastToSession(sessionId, {
            type: 'member_status',
            sessionId,
            data: {
              action: 'disconnected',
              member: memberConn.member,
            },
            timestamp: Date.now(),
          });

          // Remove member after a grace period (they might reconnect)
          setTimeout(() => {
            sessionData.members.delete(memberId);
          }, 30000); // 30 seconds grace period

          return;
        }
      }
    }
  }

  /**
   * Broadcast message to all members in a session
   */
  private broadcastToSession(sessionId: string, message: ConvoyMessage, exclude?: WebSocket) {
    const sessionData = this.sessions.get(sessionId);
    if (!sessionData) return;

    const messageStr = JSON.stringify(message);

    // Send to all members
    for (const memberConn of sessionData.members.values()) {
      if (memberConn.ws !== exclude && memberConn.ws.readyState === WebSocket.OPEN) {
        memberConn.ws.send(messageStr);
      }
    }

    // Also send to leader if not excluded
    if (sessionData.leaderConnection && sessionData.leaderConnection !== exclude && 
        sessionData.leaderConnection.readyState === WebSocket.OPEN) {
      sessionData.leaderConnection.send(messageStr);
    }
  }

  /**
   * Send message to a specific WebSocket
   */
  private send(ws: WebSocket, message: ConvoyMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send error message
   */
  private sendError(ws: WebSocket, error: string) {
    this.send(ws, {
      type: 'emergency', // Use emergency type for errors
      sessionId: '',
      data: { error },
      timestamp: Date.now(),
    });
  }

  /**
   * Check for leader timeout (runs every 30 seconds)
   */
  private startLeaderTimeoutChecker() {
    this.leaderTimeoutInterval = setInterval(() => {
      const now = Date.now();
      const LEADER_TIMEOUT = 5 * 60 * 1000; // 5 minutes

      for (const [sessionId, sessionData] of this.sessions.entries()) {
        const timeSinceLastSeen = now - sessionData.lastLeaderSeen;

        if (timeSinceLastSeen > LEADER_TIMEOUT && sessionData.session.status === 'active') {
          // Broadcast emergency to all members
          this.broadcastToSession(sessionId, {
            type: 'emergency',
            sessionId,
            data: {
              reason: 'leader_timeout',
              message: 'Leader signal lost - STOP CONVOY IMMEDIATELY',
              timeSinceLost: timeSinceLastSeen,
              lastGPS: sessionData.leaderGPS,
            },
            timestamp: now,
          });

          // Mark session as paused
          sessionData.session.status = 'paused';
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Check for member heartbeat timeouts (runs every 10 seconds)
   */
  private startHeartbeatChecker() {
    this.heartbeatCheckInterval = setInterval(() => {
      const now = Date.now();
      const HEARTBEAT_TIMEOUT = 60 * 1000; // 60 seconds

      for (const [sessionId, sessionData] of this.sessions.entries()) {
        for (const [memberId, memberConn] of sessionData.members.entries()) {
          const timeSinceLastSeen = now - memberConn.lastSeen;

          if (timeSinceLastSeen > HEARTBEAT_TIMEOUT && memberConn.member.isConnected) {
            memberConn.member.isConnected = false;
            
            // Broadcast member disconnected
            this.broadcastToSession(sessionId, {
              type: 'member_status',
              sessionId,
              data: {
                action: 'timeout',
                member: memberConn.member,
              },
              timestamp: now,
            });
          }
        }
      }
    }, 10000); // Check every 10 seconds
  }

  // ========================================
  // ROUTE ENFORCEMENT HANDLERS
  // ========================================

  /**
   * Create a new route enforcement convoy
   */
  public createRouteEnforcementConvoy(params: {
    dispatcherId: string;
    convoyName: string;
    routeGeometry: [number, number][];
    routeName?: string;
    routeDescription?: string;
    allowedDeviationMeters: number;
    persistenceSeconds: number;
    environmentType: 'rural' | 'urban';
    windowStart: string;
    windowEnd: string;
    dispatchPhone?: string;
    dispatchEmail?: string;
  }): { convoyId: string; qrToken: string } {
    const convoyId = randomUUID();
    const qrToken = randomUUID().substring(0, 8).toUpperCase();
    const now = new Date().toISOString();

    const convoy: RouteEnforcementConvoy = {
      id: convoyId,
      dispatcherId: params.dispatcherId,
      convoyName: params.convoyName,
      status: 'active',
      routeGeometry: params.routeGeometry,
      routeName: params.routeName,
      routeDescription: params.routeDescription,
      allowedDeviationMeters: params.allowedDeviationMeters,
      persistenceSeconds: params.persistenceSeconds,
      maxAccuracyMeters: 15,
      environmentType: params.environmentType,
      windowStart: params.windowStart,
      windowEnd: params.windowEnd,
      dispatchPhone: params.dispatchPhone,
      dispatchEmail: params.dispatchEmail,
      qrToken,
      createdAt: now,
      expiresAt: params.windowEnd,
    };

    this.routeEnforcementSessions.set(convoyId, {
      convoy,
      members: new Map(),
      dispatchConnection: null,
      incidents: new Map(),
    });

    console.log(`✅ Created route enforcement convoy: ${params.convoyName} (ID: ${convoyId}, Token: ${qrToken})`);

    return { convoyId, qrToken };
  }

  /**
   * Register an externally-created RouteEnforcementConvoy into the in-memory session map.
   * Called by routes.ts after persisting the convoy to DB and storage, ensuring WS joins
   * work immediately without waiting for a server restart.
   */
  public registerEnforcementConvoy(convoy: RouteEnforcementConvoy): void {
    if (!this.routeEnforcementSessions.has(convoy.id)) {
      this.routeEnforcementSessions.set(convoy.id, {
        convoy,
        members: new Map(),
        dispatchConnection: null,
        incidents: new Map(),
      });
      console.log(`✅ Registered enforcement convoy in memory: ${convoy.convoyName} (ID: ${convoy.id}, Token: ${convoy.qrToken})`);
    }
  }

  /**
   * Find route enforcement session by QR token
   */
  private findRouteEnforcementSessionByToken(token: string): RouteEnforcementSessionData | null {
    for (const sessionData of this.routeEnforcementSessions.values()) {
      if (sessionData.convoy.qrToken === token) {
        return sessionData;
      }
    }
    return null;
  }

  /**
   * Handle route join request
   */
  private handleRouteJoinRequest(ws: WebSocket, message: RouteEnforcementMessage) {
    const { qrToken, memberData } = message.data;
    
    const sessionData = this.findRouteEnforcementSessionByToken(qrToken);

    if (!sessionData) {
      this.sendRouteMessage(ws, {
        type: 'route_join_denied',
        convoyId: '',
        data: { reason: 'Invalid QR token' },
        timestamp: Date.now(),
      });
      return;
    }

    if (sessionData.convoy.status !== 'active') {
      this.sendRouteMessage(ws, {
        type: 'route_join_denied',
        convoyId: '',
        data: { reason: 'Convoy is not active' },
        timestamp: Date.now(),
      });
      return;
    }

    // Create member
    const memberId = randomUUID();
    const member: RouteEnforcementMember = {
      id: memberId,
      convoyId: sessionData.convoy.id,
      name: memberData.name,
      role: memberData.role,
      vehicleId: memberData.vehicleId,
      company: memberData.company,
      phoneNumber: memberData.phoneNumber,
      joinedAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      isConnected: true,
      currentStatus: 'on_route',
    };

    sessionData.members.set(memberId, {
      member,
      ws,
      lastSeen: Date.now(),
      lastGPS: null,
      offRouteStart: null,
    });

    // Send approval
    this.sendRouteMessage(ws, {
      type: 'route_join_approved',
      convoyId: sessionData.convoy.id,
      data: {
        memberId,
        convoy: sessionData.convoy,
        members: Array.from(sessionData.members.values()).map(mc => mc.member),
      },
      timestamp: Date.now(),
    });

    // Broadcast to dispatch
    if (sessionData.dispatchConnection) {
      this.sendRouteMessage(sessionData.dispatchConnection, {
        type: 'member_status',
        convoyId: sessionData.convoy.id,
        data: { action: 'joined', member },
        timestamp: Date.now(),
      });
    }

    console.log(`✅ Member ${memberData.name} joined route enforcement convoy ${sessionData.convoy.convoyName}`);
  }

  /**
   * Handle position update from member
   */
  private handlePositionUpdate(ws: WebSocket, message: RouteEnforcementMessage) {
    const sessionData = this.routeEnforcementSessions.get(message.convoyId);
    if (!sessionData) return;

    // Find member
    let memberConn: RouteEnforcementMemberConnection | undefined;
    for (const mc of sessionData.members.values()) {
      if (mc.ws === ws) {
        memberConn = mc;
        break;
      }
    }

    if (!memberConn) return;

    // Update member GPS
    memberConn.lastGPS = {
      latitude: message.data.latitude,
      longitude: message.data.longitude,
      accuracy: message.data.accuracy,
      timestamp: Date.now(),
    };
    memberConn.lastSeen = Date.now();
    memberConn.member.lastGPS = memberConn.lastGPS;

    // Forward position to dispatch
    if (sessionData.dispatchConnection) {
      this.sendRouteMessage(sessionData.dispatchConnection, {
        type: 'position_update',
        convoyId: message.convoyId,
        data: {
          memberId: memberConn.member.id,
          ...message.data,
        },
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Handle off-route alert from member (client-side detection)
   */
  private handleOffRouteAlert(ws: WebSocket, message: RouteEnforcementMessage) {
    const sessionData = this.routeEnforcementSessions.get(message.convoyId);
    if (!sessionData) return;

    // Create incident
    const incidentId = randomUUID();
    const incident: RouteIncident = {
      id: incidentId,
      convoyId: message.convoyId,
      memberId: message.data.memberId,
      incidentType: message.data.incidentType || 'off_route_critical',
      distanceFromRoute: message.data.distanceFromRoute,
      persistenceDuration: message.data.persistenceDuration || 0,
      latitude: message.data.latitude,
      longitude: message.data.longitude,
      accuracy: message.data.accuracy,
      status: 'pending',
      detectedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    sessionData.incidents.set(incidentId, incident);

    // Send STOP command to member if critical
    if (incident.incidentType === 'off_route_critical') {
      this.sendRouteMessage(ws, {
        type: 'stop_command',
        convoyId: message.convoyId,
        data: {
          incidentId,
          reason: `Off-route violation: ${incident.distanceFromRoute.toFixed(1)}m from permitted route`,
        },
        timestamp: Date.now(),
      });
    }

    // Forward to dispatch
    if (sessionData.dispatchConnection) {
      this.sendRouteMessage(sessionData.dispatchConnection, {
        type: 'off_route_alert',
        convoyId: message.convoyId,
        data: { incident },
        timestamp: Date.now(),
      });
    }

    console.log(`⚠️ Off-route alert for member ${message.data.memberId}: ${incident.distanceFromRoute}m`);
  }

  /**
   * Handle incident acknowledged by dispatch
   */
  private handleIncidentAcknowledged(ws: WebSocket, message: RouteEnforcementMessage) {
    const sessionData = this.routeEnforcementSessions.get(message.convoyId);
    if (!sessionData) return;

    const incident = sessionData.incidents.get(message.data.incidentId);
    if (!incident) return;

    incident.status = 'acknowledged';
    incident.acknowledgedAt = new Date().toISOString();
    incident.dispatcherId = message.data.dispatcherId;
    incident.dispatchNotes = message.data.notes;
    incident.updatedAt = new Date().toISOString();

    // Broadcast to member
    const memberConn = sessionData.members.get(incident.memberId);
    if (memberConn) {
      this.sendRouteMessage(memberConn.ws, {
        type: 'incident_acknowledged',
        convoyId: message.convoyId,
        data: { incidentId: incident.id, notes: incident.dispatchNotes },
        timestamp: Date.now(),
      });
    }

    console.log(`✅ Incident ${incident.id} acknowledged by dispatch`);
  }

  /**
   * Handle incident cleared by dispatch
   */
  private handleIncidentCleared(ws: WebSocket, message: RouteEnforcementMessage) {
    const sessionData = this.routeEnforcementSessions.get(message.convoyId);
    if (!sessionData) return;

    const incident = sessionData.incidents.get(message.data.incidentId);
    if (!incident) return;

    incident.status = 'cleared';
    incident.clearedAt = new Date().toISOString();
    incident.dispatcherId = message.data.dispatcherId;
    incident.dispatchNotes = message.data.notes;
    incident.updatedAt = new Date().toISOString();

    // Send resume command to member
    const memberConn = sessionData.members.get(incident.memberId);
    if (memberConn) {
      this.sendRouteMessage(memberConn.ws, {
        type: 'resume_command',
        convoyId: message.convoyId,
        data: { incidentId: incident.id },
        timestamp: Date.now(),
      });
    }

    console.log(`✅ Incident ${incident.id} cleared by dispatch`);
  }

  /**
   * Handle stop command (from dispatch or system)
   */
  private handleStopCommand(ws: WebSocket, message: RouteEnforcementMessage) {
    const sessionData = this.routeEnforcementSessions.get(message.convoyId);
    if (!sessionData) return;

    // Broadcast stop to specific member or all members
    if (message.data.memberId) {
      const memberConn = sessionData.members.get(message.data.memberId);
      if (memberConn) {
        this.sendRouteMessage(memberConn.ws, message);
      }
    } else {
      // Broadcast to all members
      this.broadcastToRouteEnforcementSession(message.convoyId, message);
    }
  }

  /**
   * Handle resume command (from dispatch)
   */
  private handleResumeCommand(ws: WebSocket, message: RouteEnforcementMessage) {
    const sessionData = this.routeEnforcementSessions.get(message.convoyId);
    if (!sessionData) return;

    // Broadcast resume to specific member
    if (message.data.memberId) {
      const memberConn = sessionData.members.get(message.data.memberId);
      if (memberConn) {
        this.sendRouteMessage(memberConn.ws, message);
      }
    }
  }

  /**
   * Broadcast message to all members in a route enforcement session
   */
  private broadcastToRouteEnforcementSession(
    convoyId: string,
    message: RouteEnforcementMessage,
    exclude?: WebSocket
  ) {
    const sessionData = this.routeEnforcementSessions.get(convoyId);
    if (!sessionData) return;

    const messageStr = JSON.stringify(message);

    for (const memberConn of sessionData.members.values()) {
      if (memberConn.ws !== exclude && memberConn.ws.readyState === WebSocket.OPEN) {
        memberConn.ws.send(messageStr);
      }
    }

    // Also send to dispatch if not excluded
    if (sessionData.dispatchConnection && sessionData.dispatchConnection !== exclude && 
        sessionData.dispatchConnection.readyState === WebSocket.OPEN) {
      sessionData.dispatchConnection.send(messageStr);
    }
  }

  /**
   * Send route enforcement message to a specific WebSocket
   */
  private sendRouteMessage(ws: WebSocket, message: RouteEnforcementMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * End a route enforcement convoy
   */
  public endRouteEnforcementConvoy(convoyId: string) {
    const sessionData = this.routeEnforcementSessions.get(convoyId);
    if (!sessionData) return;

    // Notify all members
    this.broadcastToRouteEnforcementSession(convoyId, {
      type: 'convoy_status',
      convoyId,
      data: { status: 'ended', message: 'Convoy has been ended by dispatch' },
      timestamp: Date.now(),
    });

    // Close connections
    for (const memberConn of sessionData.members.values()) {
      memberConn.ws.close();
    }
    if (sessionData.dispatchConnection) {
      sessionData.dispatchConnection.close();
    }

    this.routeEnforcementSessions.delete(convoyId);
    console.log(`✅ Route enforcement convoy ${convoyId} ended`);

    // Mirror status to DB so restart restore is authoritative
    db.update(convoySessions)
      .set({ status: 'ended', endedAt: new Date() })
      .where(and(eq(convoySessions.id, convoyId), eq(convoySessions.sessionType, 'enforcement')))
      .catch(err => console.warn('⚠️ Could not sync enforcement convoy end to DB:', err));
  }

  // ========================================
  // END ROUTE ENFORCEMENT HANDLERS
  // ========================================

  /**
   * End a convoy session
   */
  public endSession(sessionId: string) {
    const sessionData = this.sessions.get(sessionId);
    if (!sessionData) return;

    // Broadcast session ended to all members
    this.broadcastToSession(sessionId, {
      type: 'session_ended',
      sessionId,
      data: {
        message: 'Convoy session has been ended by the leader',
      },
      timestamp: Date.now(),
    });

    // Close all WebSocket connections
    for (const memberConn of sessionData.members.values()) {
      memberConn.ws.close();
    }
    if (sessionData.leaderConnection) {
      sessionData.leaderConnection.close();
    }

    // Persist events and mark session as ended in DB
    const aggregatedLogs = { ...sessionData.aggregatedLogs };
    db.update(convoySessions)
      .set({ status: 'ended', endedAt: new Date() })
      .where(eq(convoySessions.id, sessionId))
      .catch(err => console.error('⚠️ Failed to mark session as ended in DB:', err));

    if (Object.keys(aggregatedLogs).length > 0) {
      this.flushEventsToDB(sessionId, aggregatedLogs).catch(err => {
        console.error('⚠️ Failed to flush convoy events to DB:', err);
      });
    }

    // Remove session
    this.sessions.delete(sessionId);
  }

  /**
   * Get active sessions
   */
  public getActiveSessions() {
    return Array.from(this.sessions.values()).map(sd => ({
      session: sd.session,
      memberCount: sd.members.size,
      leaderConnected: sd.leaderConnection !== null,
    }));
  }

  /**
   * Cleanup on shutdown
   */
  public shutdown() {
    if (this.leaderTimeoutInterval) {
      clearInterval(this.leaderTimeoutInterval);
    }
    if (this.heartbeatCheckInterval) {
      clearInterval(this.heartbeatCheckInterval);
    }
    
    // End all sessions
    for (const sessionId of this.sessions.keys()) {
      this.endSession(sessionId);
    }
  }
}

// Export singleton instance
export const convoyHub = new ConvoyHub();
