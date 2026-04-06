import { create } from 'zustand';
import type { ConvoySession, ConvoyMember, ConvoyMessage } from '@shared/schema';
import { soundManager } from '../sounds';
import { processSyncAcknowledgment } from '@/lib/convoy/logSyncService';
import { toast } from 'sonner';

interface ConvoyStore {
  // Session state
  currentSession: ConvoySession | null;
  isLeader: boolean;
  myMemberId: string | null;
  
  // Members
  members: ConvoyMember[];
  
  // Connection state
  ws: WebSocket | null;
  connected: boolean;
  leaderConnected: boolean;
  leaderLastSeen: number;
  sessionConnectedAt: number | null;
  
  // Real-time data
  currentMeasurement: string;
  lastAlert: {
    level: 'warning' | 'critical';
    message: string;
    timestamp: number;
  } | null;
  leaderGPS: {
    latitude: number;
    longitude: number;
    altitude: number;
  } | null;
  
  // Emergency state
  emergencyActive: boolean;
  emergencyReason: string | null;
  emergencyTriggeredBy: string | null;
  emergencyTimestamp: number | null;
  
  // Actions
  acknowledgeEmergency: () => void;
  connectToSession: (sessionId: string, qrToken: string, isLeader: boolean, leaderData?: any) => void;
  disconnect: () => void;
  sendMessage: (message: ConvoyMessage) => void;
  handleIncomingMessage: (message: ConvoyMessage) => void;
  updateMembers: (members: ConvoyMember[]) => void;
  setCurrentMeasurement: (measurement: string) => void;
  setAlert: (alert: { level: 'warning' | 'critical'; message: string } | null) => void;
  setEmergency: (active: boolean, reason?: string) => void;
  sendHeartbeat: () => void;
}

export const useConvoyStore = create<ConvoyStore>((set, get) => ({
  currentSession: null,
  isLeader: false,
  myMemberId: null,
  members: [],
  ws: null,
  connected: false,
  leaderConnected: false,
  leaderLastSeen: 0,
  sessionConnectedAt: null,
  currentMeasurement: '--',
  lastAlert: null,
  leaderGPS: null,
  emergencyActive: false,
  emergencyReason: null,
  emergencyTriggeredBy: null,
  emergencyTimestamp: null,

  connectToSession: (sessionId, qrToken, isLeader, leaderData) => {
    // ISSUE 5 FIX: Close existing WebSocket first to prevent conflicts
    const { ws: existingWs } = get();
    if (existingWs && existingWs.readyState !== WebSocket.CLOSED) {
      existingWs.close();
    }
    
    // BUG 1 FIX: Track connection time IMMEDIATELY to prevent alarms during reconnection
    set({ sessionConnectedAt: Date.now() });
    
    // WebSocket URL - connect via /api path which Vite will proxy to backend
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    
    // Use /API path for WebSocket so Vite proxy handles it
    const wsUrl = `${protocol}//${host}/api`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      set({ ws, isLeader, currentSession: { id: sessionId } as ConvoySession });
      
      // If leader, send join_request to register with backend
      if (isLeader && leaderData) {
        const joinRequest = {
          type: 'join_request',
          sessionId: sessionId, // Use actual sessionId instead of empty string
          data: {
            sessionToken: qrToken,
            memberData: {
              ...leaderData,
              role: 'lead',
              isLeader: true,
            },
          },
          timestamp: Date.now(),
        };
        ws.send(JSON.stringify(joinRequest));
      }
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as ConvoyMessage;
        get().handleIncomingMessage(message);
      } catch (error) {
      }
    };

    ws.onclose = (event) => {
      // Only set connected=false if this is the current WebSocket
      const currentWs = get().ws;
      if (currentWs === ws) {
        set({ connected: false, ws: null });
        
        // Show lightweight notification for unexpected disconnects
        if (!event.wasClean) {
          toast.warning('Convoy connection lost', {
            description: 'Reconnect or check your network connection'
          });
        }
      }
    };

    ws.onerror = () => {
      // Only clean up if this is the current WebSocket (prevent stale socket errors from breaking reconnections)
      const currentWs = get().ws;
      if (currentWs === ws) {
        set({ connected: false, ws: null });
        ws.close(); // Explicitly close the errored socket
        
        // Show lightweight notification for connection errors
        toast.error('Convoy connection error', {
          description: 'Failed to connect. Please try again.'
        });
      }
    };

    set({ ws });
  },

  disconnect: () => {
    const { ws, currentSession } = get();
    const sessionId = currentSession?.id;
    
    // Clean up localStorage acknowledgment timestamp
    if (sessionId) {
      localStorage.removeItem(`convoy_last_ack_${sessionId}`);
    }
    
    if (ws) {
      ws.close();
      set({
        ws: null,
        connected: false,
        currentSession: null,
        members: [],
        isLeader: false,
        myMemberId: null,
        sessionConnectedAt: null,
      });
    }
  },

  sendMessage: (message) => {
    const { ws, connected } = get();
    if (ws && connected) {
      ws.send(JSON.stringify(message));
    }
  },

  handleIncomingMessage: (message) => {
    switch (message.type) {
      case 'join_approved':
        set({
          connected: true,
          currentSession: message.data.session,
          myMemberId: message.data.memberId,
          members: message.data.members,
          // sessionConnectedAt already set in connectToSession
        });
        break;

      case 'measurement':
        set({ currentMeasurement: message.data.measurement });
        break;

      case 'alert':
        set({
          lastAlert: {
            level: message.data.level,
            message: message.data.message,
            timestamp: message.timestamp,
          },
        });
        break;

      case 'gps':
        set({
          leaderGPS: {
            latitude: message.data.latitude,
            longitude: message.data.longitude,
            altitude: message.data.altitude,
          },
        });
        break;

      case 'member_status':
        const { members } = get();
        if (message.data.action === 'joined') {
          set({ members: [...members, message.data.member] });
        } else if (message.data.action === 'disconnected' || message.data.action === 'timeout') {
          set({
            members: members.map(m =>
              m.id === message.data.member.id
                ? { ...m, isConnected: false }
                : m
            ),
          });
        }
        break;

      case 'leader_status':
        const wasLeaderConnected = get().leaderConnected;
        const isNowConnected = message.data.connected;
        
        // ISSUE 6 FIX: Play alarm when leader goes offline
        if (wasLeaderConnected && !isNowConnected && !get().isLeader) {
          soundManager.playEmergency();
          
          // Set emergency state to show visual alert
          set({
            emergencyActive: true,
            emergencyReason: '⚠️ Leader Connection Lost - STOP CONVOY IMMEDIATELY',
            emergencyTriggeredBy: 'System',
            emergencyTimestamp: Date.now(),
          });
        }
        
        set({
          leaderConnected: isNowConnected,
          leaderLastSeen: message.data.lastSeen,
          leaderGPS: message.data.gps,
        });
        break;

      case 'config_change':
        const { currentSession } = get();
        if (currentSession) {
          set({
            currentSession: {
              ...currentSession,
              ...message.data,
            },
          });
        }
        break;

      case 'emergency':
        const emergencyTimestamp = message.timestamp || Date.now();
        const { sessionConnectedAt } = get();
        const emergencySession = get().currentSession;
        
        // Get last acknowledged emergency timestamp from localStorage
        const sessionId = emergencySession?.id || '';
        const lastAckTimestamp = parseInt(localStorage.getItem(`convoy_last_ack_${sessionId}`) || '0', 10);
        
        // Skip alarm if we've already acknowledged this emergency
        // OR if it's a pre-existing emergency from before we connected
        const isAlreadyAcknowledged = emergencyTimestamp <= lastAckTimestamp;
        const isPreExistingEmergency = sessionConnectedAt !== null && emergencyTimestamp <= sessionConnectedAt;
        const shouldPlayAlarm = !isAlreadyAcknowledged && !isPreExistingEmergency;
        
        if (shouldPlayAlarm) {
          soundManager.playEmergency().catch(err => {
          });
        }
        
        set({
          emergencyActive: message.data.emergencyActive !== false, // Allow clearing via emergencyActive: false
          emergencyReason: message.data.message || message.data.reason || 'Emergency stop initiated',
          emergencyTriggeredBy: message.data.triggeredBy || 'Unknown',
          emergencyTimestamp,
        });
        break;

      case 'emergency_acknowledged':
        // Clear emergency state when acknowledged
        soundManager.stopSound('emergency');
        
        set({
          emergencyActive: false,
          emergencyReason: null,
          emergencyTriggeredBy: null,
          emergencyTimestamp: null,
        });
        break;

      case 'session_ended':
        // Clean up localStorage acknowledgment timestamp
        const endedSessionId = get().currentSession?.id;
        if (endedSessionId) {
          localStorage.removeItem(`convoy_last_ack_${endedSessionId}`);
        }
        
        set({
          currentSession: null,
          members: [],
          connected: false,
          emergencyActive: false,
          emergencyReason: null,
          emergencyTriggeredBy: null,
          emergencyTimestamp: null,
        });
        break;

      case 'log_sync_batch':
        // Leader receives log sync batch from follower
        if (get().isLeader) {
          const { memberId, memberName, events } = message.data;
          
          // CRITICAL FIX: Store aggregated logs partitioned per member
          // Each member gets their own 10000-event buffer to prevent forensic data loss
          try {
            const storageKey = 'convoy_aggregated_logs';
            // Store as { memberId: events[] } for per-member partitioning
            const allLogs = JSON.parse(localStorage.getItem(storageKey) || '{}');
            
            // Initialize member's log array if not exists
            if (!allLogs[memberId]) {
              allLogs[memberId] = [];
            }
            
            const memberLogs = allLogs[memberId];
            const eventIds = new Set(memberLogs.map((e: any) => e.id));
            
            // Deduplicate and add new events
            const newEvents = events.filter((e: any) => !eventIds.has(e.id));
            allLogs[memberId] = [...memberLogs, ...newEvents];
            
            // CRITICAL: Maintain per-member cap of 10000 events (increased from 1000 shared pool)
            // This prevents data loss in multi-hour convoy operations
            const MAX_EVENTS_PER_MEMBER = 10000;
            if (allLogs[memberId].length > MAX_EVENTS_PER_MEMBER) {
              allLogs[memberId].splice(0, allLogs[memberId].length - MAX_EVENTS_PER_MEMBER);
            }
            
            localStorage.setItem(storageKey, JSON.stringify(allLogs));
            
            // Send acknowledgment back to follower
            const ackMessage = {
              type: 'sync_acknowledgment' as const,
              sessionId: message.sessionId,
              data: {
                memberId,
                eventIds: events.map((e: any) => e.id),
                timestamp: Date.now(),
              },
              timestamp: Date.now(),
            };
            
            get().sendMessage(ackMessage);
          } catch (error) {
          }
        }
        break;

      case 'sync_acknowledgment':
        // Follower receives acknowledgment from leader
        if (!get().isLeader) {
          const { eventIds } = message.data;
          
          // Update local events to mark them as synced
          processSyncAcknowledgment(eventIds);
        }
        break;
    }
  },

  updateMembers: (members) => {
    const prevMembers = get().members;
    const currentSession = get().currentSession;
    
    // Log member changes (joins/leaves)
    if (currentSession && get().isLeader) {
      const { logConvoyEvent } = require('../convoy/eventLogger');
      
      // Check for new members
      members.forEach(member => {
        if (!prevMembers.find(m => m.id === member.id)) {
          logConvoyEvent({
            eventType: 'convoy_member',
            sessionId: currentSession.id,
            memberId: member.id,
            severity: 'info',
            metadata: {
              action: 'joined_convoy',
              memberName: member.name,
              memberRole: member.role,
              vehicleId: member.vehicleId,
              company: member.company,
              phoneNumber: member.phoneNumber,
              totalMembers: members.length,
            },
          });
        }
      });
      
      // Check for removed members
      prevMembers.forEach(prevMember => {
        if (!members.find(m => m.id === prevMember.id)) {
          logConvoyEvent({
            eventType: 'convoy_member',
            sessionId: currentSession.id,
            memberId: prevMember.id,
            severity: 'warning',
            metadata: {
              action: 'left_convoy',
              memberName: prevMember.name,
              memberRole: prevMember.role,
              remainingMembers: members.length,
            },
          });
        }
      });
    }
    
    set({ members });
  },

  setCurrentMeasurement: (measurement) => {
    set({ currentMeasurement: measurement });
  },

  setAlert: (alert) => {
    set({
      lastAlert: alert
        ? { ...alert, timestamp: Date.now() }
        : null,
    });
  },

  setEmergency: (active, reason) => {
    const currentSession = get().currentSession;
    const members = get().members;
    
    // Log emergency activation
    if (active && currentSession) {
      const { logConvoyEvent } = require('../convoy/eventLogger');
      logConvoyEvent({
        eventType: 'convoy_alert',
        sessionId: currentSession.id,
        severity: 'critical',
        metadata: {
          action: 'emergency_stop_activated',
          reason: reason || 'Manual emergency stop',
          memberCount: members.length,
          triggeredBy: get().isLeader ? 'leader' : 'follower',
        },
      });
    }
    
    set({ 
      emergencyActive: active, 
      emergencyReason: reason || null,
      emergencyTriggeredBy: null,
      emergencyTimestamp: active ? Date.now() : null,
    });
  },

  acknowledgeEmergency: () => {
    // BUG 2 FIX: Comprehensive emergency acknowledgment handler
    const { currentSession, sendMessage, emergencyTimestamp } = get();
    const sessionId = currentSession?.id;
    const ackTimestamp = emergencyTimestamp || Date.now();
    
    // 1. Save acknowledgment timestamp to localStorage
    if (sessionId) {
      localStorage.setItem(`convoy_last_ack_${sessionId}`, String(ackTimestamp));
    }
    
    // 2. Stop ALL alarm sounds (emergency + critical loop)
    soundManager.stopSound('emergency');
    soundManager.stopSound('critical');
    
    // 3. Clear local emergency state
    set({
      emergencyActive: false,
      emergencyReason: null,
      emergencyTriggeredBy: null,
      emergencyTimestamp: null,
    });
    
    // 4. Send acknowledgment message to all convoy members
    if (currentSession) {
      sendMessage({
        type: 'emergency_acknowledged',
        sessionId: currentSession.id,
        data: {
          acknowledgedBy: 'Leader',
        },
        timestamp: Date.now(),
      });
    }
  },

  sendHeartbeat: () => {
    const { currentSession, sendMessage } = get();
    if (currentSession) {
      sendMessage({
        type: 'member_status',
        sessionId: currentSession.id,
        data: { action: 'heartbeat' },
        timestamp: Date.now(),
      });
    }
  },
}));
