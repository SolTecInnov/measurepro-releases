import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, Users, MapPin, Shield, QrCode, X, FileText, Download, XCircle } from 'lucide-react';
import { useConvoyStore } from '@/lib/stores/convoyStore';
import { soundManager } from '@/lib/sounds';
import { getWsUrl } from '@/lib/config/environment';
import { useWakeLock } from '@/lib/convoy/wakeLock';
import { 
  logConvoyEvent,
  logMemberJoin,
  logMemberLeave,
  logWarning,
  logEmergency,
  getBlackBoxEvents,
  exportBlackBoxEventsToCSV,
  getConvoyEventLogs,
} from '@/lib/convoy/eventLogger';
import { saveConvoySession, getConvoySession, clearConvoySession, updateConvoySessionActivity } from '@/lib/convoy/sessionPersistence';
import { performPeriodicSync, retryFailedSyncs, SYNC_INTERVAL_MS } from '@/lib/convoy/logSyncService';
import type { ConvoyJoinRequest } from '@shared/schema';

const ROLE_OPTIONS = [
  { value: 'pilot_car', label: 'Pilot Car', icon: '🚗' },
  { value: 'police_escort', label: 'Police Escort', icon: '🚔' },
  { value: 'bucket_truck', label: 'Bucket Truck', icon: '🏗️' },
  { value: 'oversized_load', label: 'Oversized Load', icon: '📦' },
  { value: 'chase', label: 'Chase Vehicle', icon: '🚙' },
  { value: 'support', label: 'Support Vehicle', icon: '🛠️' },
];

export default function ConvoyFollower() {
  const { token } = useParams<{ token?: string }>();
  const {
    currentSession,
    members,
    connected,
    currentMeasurement,
    lastAlert,
    leaderConnected,
    leaderLastSeen,
    leaderGPS,
    emergencyActive,
    emergencyReason,
    disconnect,
    sendMessage,
    sendHeartbeat,
    handleIncomingMessage,
    acknowledgeEmergency,
  } = useConvoyStore();
  
  // Get store setter
  const set = useConvoyStore.setState;

  // Join form state
  const [showJoinForm, setShowJoinForm] = useState(true); // Always show form until successfully joined
  const [sessionToken, setSessionToken] = useState(token || '');
  const [formData, setFormData] = useState<ConvoyJoinRequest>({
    sessionToken: token || '',
    name: '',
    role: 'pilot_car',
    vehicleId: '',
    company: '',
    phoneNumber: '',
    radioChannel: '',
    notes: '',
  });

  // Join status for user feedback
  const [joinStatus, setJoinStatus] = useState<'idle' | 'connecting' | 'success' | 'error'>('idle');
  const [joinMessage, setJoinMessage] = useState('');

  // Session persistence
  const [, setIsRestoringSession] = useState(false);
  const [showReconnectBanner, setShowReconnectBanner] = useState(false);
  
  // BUG FIX 2: Track the provisional restore socket separately from the approved session socket
  const restoringWsRef = useRef<WebSocket | null>(null);
  
  // BUG FIX 3: Track the join socket separately to prevent premature cleanup
  const joiningWsRef = useRef<WebSocket | null>(null);
  
  // BUG FIX 4: Prevent concurrent reconnection attempts
  const reconnectingRef = useRef<boolean>(false);
  
  // BUG FIX 5: Track connection timeout to prevent late close
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Helper to clear join timeout safely
  const clearJoinTimeout = () => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
  };
  
  // CRITICAL: Wake lock to keep app running in background
  const { isSupported: wakeLockSupported, request: requestWakeLock, release: releaseWakeLock } = useWakeLock();

  /**
   * BUG FIX: Cleanup timeout on unmount to prevent late close
   */
  useEffect(() => {
    return () => {
      clearJoinTimeout();
    };
  }, []);

  /**
   * Restore session on mount if exists
   */
  useEffect(() => {
    const savedSession = getConvoySession();
    const { ws: existingWs } = useConvoyStore.getState();
    
    if (savedSession && !savedSession.isLeader && !connected) {
      setIsRestoringSession(true);
      
      // Close existing WebSocket if any
      if (existingWs) {
        existingWs.close();
      }
      
      // Restore form data
      setSessionToken(savedSession.qrToken);
      setFormData({
        sessionToken: savedSession.qrToken,
        name: savedSession.memberName || '',
        role: savedSession.vehicleRole as any || 'pilot_car',
        vehicleId: savedSession.vehicleId || '',
        company: savedSession.company || '',
        phoneNumber: savedSession.phoneNumber || '',
        radioChannel: savedSession.radioChannel || '',
        notes: '',
      });
      
      // Reconnect to WebSocket
      const wsUrl = getWsUrl('/api');

      const ws = new WebSocket(wsUrl);

      // BUG FIX 2: Track this provisional socket in the ref
      restoringWsRef.current = ws;
      
      ws.onopen = () => {
        const joinRequest = {
          type: 'join_request',
          sessionId: savedSession.sessionId,
          data: {
            sessionToken: savedSession.qrToken,
            memberData: {
              sessionToken: savedSession.qrToken,
              name: savedSession.memberName,
              role: savedSession.vehicleRole,
              vehicleId: savedSession.vehicleId,
              company: savedSession.company,
              phoneNumber: savedSession.phoneNumber,
              radioChannel: savedSession.radioChannel,
              notes: '',
            },
          },
          timestamp: Date.now(),
        };
        
        ws.send(JSON.stringify(joinRequest));
        soundManager.playLogEntry();
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleIncomingMessage(message);
          
          if (message.type === 'join_approved') {
            setShowJoinForm(false);
            setIsRestoringSession(false);
            setShowReconnectBanner(true);
            // BUG FIX: Save approved socket to store NOW (not before)
            set({ ws, isLeader: false });
            // Clear the restoring ref since this socket is now the approved session socket
            restoringWsRef.current = null;
          } else if (message.type === 'join_denied') {
            clearConvoySession();
            setIsRestoringSession(false);
            setShowReconnectBanner(false);
            // BUG FIX: Clear ref BEFORE closing to prevent stale ref handling
            restoringWsRef.current = null;
            ws.close();
          }
        } catch (err) {
        }
      };
      
      ws.onerror = (error) => {
        clearConvoySession();
        setIsRestoringSession(false);
        setShowReconnectBanner(false);
        // BUG FIX 1: Close the orphan WebSocket
        ws.close();
        restoringWsRef.current = null;
      };
      
      ws.onclose = (event) => {
        const storeWs = useConvoyStore.getState().ws;
        // BUG FIX: Only disconnect if this is the approved socket (not a provisional one)
        // Check both store reference AND that this wasn't the provisional restoration socket
        if (ws === storeWs && ws !== restoringWsRef.current) {
          disconnect();
        }
      };
      
      // BUG FIX: Do NOT save provisional socket to store yet - wait for join_approved
      // set({ ws, isLeader: false }); // REMOVED - moved to join_approved handler
    }
    
    // BUG FIX 2: Only close the provisional restoring socket, NOT the approved session socket
    return () => {
      // Only close the restoring socket if it exists, is open, AND is NOT the store's active connection
      const storeWs = useConvoyStore.getState().ws;
      if (restoringWsRef.current && 
          (restoringWsRef.current.readyState === WebSocket.CONNECTING || restoringWsRef.current.readyState === WebSocket.OPEN) &&
          restoringWsRef.current !== storeWs) {
        restoringWsRef.current.close();
        restoringWsRef.current = null;
      }
      // NOTE: We do NOT close the approved session socket from the store here
      // That socket should only be closed via the disconnect() action or when user explicitly disconnects
    };
  }, []);

  // Update formData when sessionToken changes (for manual entry)
  useEffect(() => {
    setFormData(prev => ({ ...prev, sessionToken }));
  }, [sessionToken]);
  
  // BUG FIX 3: Cleanup effect for joining socket
  useEffect(() => {
    return () => {
      // Only close the joining socket if it exists, is open, AND is NOT the store's active connection
      const storeWs = useConvoyStore.getState().ws;
      if (joiningWsRef.current && 
          (joiningWsRef.current.readyState === WebSocket.CONNECTING || joiningWsRef.current.readyState === WebSocket.OPEN) &&
          joiningWsRef.current !== storeWs) {
        joiningWsRef.current.close();
        joiningWsRef.current = null;
      }
    };
  }, []);

  // Emergency state
  const [timeSinceLeaderLost, setTimeSinceLeaderLost] = useState<number>(0);
  const [emergencySound, setEmergencySound] = useState(false);
  const [emergencyLogged, setEmergencyLogged] = useState(false);
  const [emergencyDismissed] = useState(false);
  const [alertDismissed, setAlertDismissed] = useState(false); // ISSUE 4: Track alert dismissal

  // ISSUE 7: Warning message state
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');

  // Event log viewer
  const [showEventLog, setShowEventLog] = useState(false);
  const [eventLogCount, setEventLogCount] = useState(0);

  // Heartbeat interval
  const heartbeatInterval = useRef<number | null>(null);
  const audioInterval = useRef<number | null>(null);
  
  // Emergency modal auto-scroll ref
  const emergencyModalRef = useRef<HTMLDivElement>(null);

  /**
   * Update event log count
   */
  useEffect(() => {
    const updateCount = () => {
      const blackBoxEvents = getBlackBoxEvents();
      setEventLogCount(blackBoxEvents.length);
    };
    
    updateCount();
    window.addEventListener('convoy-event-logged', updateCount);
    return () => window.removeEventListener('convoy-event-logged', updateCount);
  }, []);

  /**
   * Periodic log sync to leader (every 2-3 minutes)
   */
  useEffect(() => {
    if (!connected || !currentSession) {
      return;
    }

    const memberName = formData.name || 'Unknown Member';

    // Perform initial sync after 10 seconds
    const initialSyncTimeout = setTimeout(() => {
      performPeriodicSync(memberName, currentSession.id);
      retryFailedSyncs(memberName, currentSession.id);
    }, 10000);

    // Set up periodic sync interval
    const syncInterval = setInterval(() => {
      performPeriodicSync(memberName, currentSession.id);
      retryFailedSyncs(memberName, currentSession.id);
    }, SYNC_INTERVAL_MS);

    return () => {
      clearTimeout(initialSyncTimeout);
      clearInterval(syncInterval);
    };
  }, [connected, currentSession, formData.name]);

  /**
   * Auto-scroll emergency modal to show latest content (BUG FIX 1)
   */
  useEffect(() => {
    const isEmergency = emergencyActive || (!leaderConnected && timeSinceLeaderLost > 300000);
    
    // Auto-scroll to bottom of modal content when emergency info changes
    if (isEmergency && emergencyModalRef.current) {
      emergencyModalRef.current.scrollTop = emergencyModalRef.current.scrollHeight;
    }
  }, [emergencyActive, emergencyReason, leaderConnected, timeSinceLeaderLost]);

  /**
   * Handle disconnect with logging
   */
  const handleDisconnect = () => {
    if (currentSession) {
      const memberName = formData.name || 'Unknown Member';
      const reason = emergencyActive ? 'emergency_disconnect' : 'manual_disconnect';
      
      // Black box logging: member leave
      logMemberLeave(
        memberName,
        formData.role,
        reason,
        formData.vehicleId
      );
      
      // Legacy log (keep for backward compatibility)
      logConvoyEvent({
        eventType: 'convoy_member',
        sessionId: currentSession.id,
        severity: 'info',
        metadata: {
          action: 'left',
          reason,
          timeSinceLeaderLost: Math.floor(timeSinceLeaderLost / 1000),
        },
      });
    }
    // Clear saved session when disconnecting
    clearConvoySession();
    disconnect();
  };

  /**
   * Handle emergency stop triggered by follower
   */
  const handleEmergencyStop = () => {
    if (!currentSession) return;

    const memberName = formData.name || 'Unknown Member';
    
    sendMessage({
      type: 'emergency',
      sessionId: currentSession.id,
      data: {
        reason: 'manual_stop',
        message: `🚨 EMERGENCY STOP - Triggered by ${memberName}`,
        triggeredBy: memberName,
      },
      timestamp: Date.now(),
    });

    soundManager.playEmergency();
    
    // Black box logging: emergency stop
    logEmergency(
      memberName,
      formData.role,
      'Emergency stop manually triggered by convoy member',
      'ConvoyFollower',
      undefined,
      formData.vehicleId
    );
    
    // Legacy log (keep for backward compatibility)
    logConvoyEvent({
      eventType: 'convoy_alert',
      sessionId: currentSession.id,
      severity: 'critical',
      metadata: {
        action: 'emergency_stop_triggered',
        triggeredBy: memberName,
        memberCount: members.length,
      },
    });
  };

  /**
   * ISSUE 7: Handle sending warning message to convoy
   */
  const handleSendWarning = () => {
    if (!currentSession || !warningMessage.trim()) return;

    const memberName = formData.name || 'Unknown Member';
    
    sendMessage({
      type: 'alert',
      sessionId: currentSession.id,
      data: {
        level: 'warning',
        message: `⚠️ ${memberName}: ${warningMessage}`,
      },
      timestamp: Date.now(),
    });

    soundManager.playWarning();
    
    // Black box logging: warning message
    logWarning(
      memberName,
      formData.role,
      warningMessage,
      'ConvoyFollower'
    );
    
    // Legacy log (keep for backward compatibility)
    logConvoyEvent({
      eventType: 'convoy_alert',
      sessionId: currentSession.id,
      severity: 'warning',
      metadata: {
        action: 'warning_sent',
        sentBy: memberName,
        message: warningMessage,
        memberCount: members.length,
      },
    });

    // Clear and close dialog
    setWarningMessage('');
    setShowWarningDialog(false);
  };

  /**
   * CRITICAL: Reconnect to convoy (used by visibility change handler)
   */
  const reconnectToConvoy = async () => {
    // BUG FIX: Prevent concurrent reconnection attempts
    if (reconnectingRef.current) {
      return;
    }
    
    reconnectingRef.current = true;
    
    const savedSession = getConvoySession();
    if (!savedSession || savedSession.isLeader) {
      reconnectingRef.current = false;
      return;
    }

    try {
      const wsUrl = getWsUrl('/api');

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        const joinRequest = {
          type: 'join_request',
          sessionId: savedSession.sessionId,
          data: {
            sessionToken: savedSession.qrToken,
            memberData: {
              sessionToken: savedSession.qrToken,
              name: savedSession.memberName,
              role: savedSession.vehicleRole,
              vehicleId: savedSession.vehicleId,
              company: savedSession.company,
              phoneNumber: savedSession.phoneNumber,
              radioChannel: savedSession.radioChannel,
              notes: '',
            },
          },
          timestamp: Date.now(),
        };
        
        ws.send(JSON.stringify(joinRequest));
      };

      ws.onerror = (error) => {
        setShowReconnectBanner(true);
        reconnectingRef.current = false;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleIncomingMessage(message);

          if (message.type === 'join_approved') {
            setShowReconnectBanner(false);
            // BUG FIX: Save approved socket to store NOW (not before)
            set({ ws, isLeader: false });
            // Clear reconnecting flag
            reconnectingRef.current = false;
          } else if (message.type === 'join_denied') {
            setShowReconnectBanner(true);
            reconnectingRef.current = false;
            ws.close();
          }
        } catch (err) {
        }
      };

      ws.onclose = (event) => {
        // BUG FIX: Reset reconnecting flag so future attempts can proceed
        reconnectingRef.current = false;
        
        const storeWs = useConvoyStore.getState().ws;
        if (ws === storeWs) {
          disconnect();
        }
      };

      // BUG FIX: Do NOT save provisional socket to store yet - wait for join_approved
      // set({ ws, isLeader: false }); // REMOVED - moved to join_approved handler

    } catch (error) {
      setShowReconnectBanner(true);
      reconnectingRef.current = false;
    }
  };

  /**
   * Handle join form submission
   */
  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.vehicleId || !formData.phoneNumber) {
      setJoinStatus('error');
      setJoinMessage('Please fill in: Name, Vehicle ID, and Phone Number');
      return;
    }

    setJoinStatus('connecting');
    setJoinMessage('Connecting to convoy...');

    try{
      // WebSocket URL
      const wsUrl = getWsUrl('/api');
      
      setJoinMessage(`Connecting to server...`);
      
      const ws = new WebSocket(wsUrl);
      
      // BUG FIX 3: Track this joining socket to prevent premature cleanup
      joiningWsRef.current = ws;

      // BUG FIX: Use ref for timeout so it can be cleared in all paths
      connectionTimeoutRef.current = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          setJoinStatus('error');
          setJoinMessage('Connection timeout. Server not responding.');
          // BUG FIX: Clear ref after timeout fires
          connectionTimeoutRef.current = null;
        }
      }, 10000); // 10 second timeout

      ws.onopen = () => {
        clearJoinTimeout();
        setJoinMessage('Connected! Sending join request...');
        
        const joinRequest = {
          type: 'join_request',
          sessionId: '', // Followers don't know sessionId yet
          data: {
            sessionToken,
            memberData: formData,
          },
          timestamp: Date.now(),
        };
        
        try {
          ws.send(JSON.stringify(joinRequest));
          setJoinMessage('Waiting for approval...');
          soundManager.playLogEntry();
        } catch (sendError) {
          setJoinStatus('error');
          setJoinMessage('Failed to send join request');
        }
      };

      ws.onerror = (error) => {
        clearJoinTimeout();
        setJoinStatus('error');
        setJoinMessage(`WebSocket error. Check console.`);
        // BUG FIX 1: Close the orphan WebSocket on error
        ws.close();
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleIncomingMessage(message);

          // Log member join event after approval
          if (message.type === 'join_approved') {
            // BUG FIX: Clear timeout to prevent late close
            clearJoinTimeout();
            
            setJoinStatus('success');
            setJoinMessage('Successfully joined convoy!');
            setShowJoinForm(false);
            
            // BUG FIX: Save approved socket to store NOW (not before)
            set({ ws, isLeader: false });
            // Clear joining ref since socket is now approved and in store
            joiningWsRef.current = null;
            
            // Save session to localStorage for persistence
            saveConvoySession({
              sessionId: message.data.session.id,
              qrToken: sessionToken,
              sessionName: message.data.session.sessionName,
              isLeader: false,
              memberName: formData.name,
              vehicleRole: formData.role,
              vehicleId: formData.vehicleId,
              phoneNumber: formData.phoneNumber,
              radioChannel: formData.radioChannel,
              company: formData.company,
              joinedAt: Date.now(),
            });
            
            setTimeout(() => {
              // Black box logging: member join
              logMemberJoin(
                formData.name,
                formData.role,
                formData.company,
                formData.phoneNumber,
                {
                  vehicleId: formData.vehicleId,
                  radioChannel: formData.radioChannel,
                  notes: formData.notes,
                }
              );
              
              // Legacy log (keep for backward compatibility)
              logConvoyEvent({
                eventType: 'convoy_member',
                sessionId: message.data.session.id,
                severity: 'info',
                metadata: {
                  action: 'joined',
                  memberName: formData.name,
                  memberRole: formData.role,
                  vehicleId: formData.vehicleId,
                  company: formData.company,
                  phoneNumber: formData.phoneNumber,
                },
              });
            }, 500);
          } else if (message.type === 'join_denied') {
            // BUG FIX: Clear timeout and ref before closing
            clearJoinTimeout();
            joiningWsRef.current = null;
            
            setJoinStatus('error');
            setJoinMessage(message.data?.reason || 'Join request denied');
            ws.close();
          }
        } catch (err) {
        }
      };

      ws.onclose = (event) => {
        const storeWs = useConvoyStore.getState().ws;
        if (ws === storeWs) {
          disconnect();
        }
        // Clear joining ref on close
        joiningWsRef.current = null;
      };

      // BUG FIX: Do NOT save provisional socket to store yet - wait for join_approved
      // set({ ws, isLeader: false }); // REMOVED - moved to join_approved handler

    } catch (error) {
      setJoinStatus('error');
      setJoinMessage(`Failed to join convoy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  /**
   * Send heartbeat every 10 seconds
   */
  useEffect(() => {
    if (connected && currentSession) {
      heartbeatInterval.current = window.setInterval(() => {
        sendHeartbeat();
      }, 10000);

      return () => {
        if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
      };
    }
  }, [connected, currentSession, sendHeartbeat]);

  /**
   * Update activity timestamp periodically
   */
  useEffect(() => {
    if (connected && currentSession) {
      const interval = setInterval(() => {
        updateConvoySessionActivity();
      }, 30000); // Every 30 seconds
      
      return () => clearInterval(interval);
    }
  }, [connected, currentSession]);

  /**
   * CRITICAL: Keep screen on and app running during convoy operations
   */
  useEffect(() => {
    if (connected && currentSession && wakeLockSupported) {
      // Request wake lock to prevent screen from sleeping
      requestWakeLock();

      return () => {
        // Release wake lock when disconnected
        releaseWakeLock();
      };
    }
  }, [connected, currentSession, wakeLockSupported, requestWakeLock, releaseWakeLock]);

  /**
   * CRITICAL: Handle app visibility changes - automatically reconnect when app returns to foreground
   */
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (!document.hidden && currentSession) {
        // App came back to foreground
        const { ws } = useConvoyStore.getState();
        
        // If WebSocket is closed or closing, immediately reconnect
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          // CRITICAL FIX: Actually reconnect instead of just showing banner
          await reconnectToConvoy();
        } else {
          // Send immediate heartbeat to confirm connection
          sendHeartbeat();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentSession, sendHeartbeat]);

  /**
   * Monitor leader connection and calculate time since lost
   */
  useEffect(() => {
    if (!leaderConnected && leaderLastSeen > 0) {
      const interval = setInterval(() => {
        const timeSince = Date.now() - leaderLastSeen;
        setTimeSinceLeaderLost(timeSince);

        // Trigger emergency after 5 minutes
        if (timeSince > 300000) {
          if (!emergencySound) {
            setEmergencySound(true);
          }
          
          // Log emergency event (only once)
          if (!emergencyLogged && currentSession) {
            logConvoyEvent({
              eventType: 'convoy_leader_lost',
              sessionId: currentSession.id,
              severity: 'critical',
              measurement: parseFloat(currentMeasurement) || 0,
              metadata: {
                timeSinceLost: Math.floor(timeSince / 1000),
                lastGPS: leaderGPS ? `${leaderGPS.latitude.toFixed(6)}, ${leaderGPS.longitude.toFixed(6)}` : 'N/A',
                lastMeasurement: currentMeasurement,
                leaderName: members.find(m => m.role === 'lead')?.name || 'Unknown',
                memberCount: members.length,
              },
            });
            setEmergencyLogged(true);
          }
        }
      }, 1000);

      return () => clearInterval(interval);
    } else {
      setTimeSinceLeaderLost(0);
      setEmergencySound(false);
      setEmergencyLogged(false);
    }
  }, [leaderConnected, leaderLastSeen, emergencySound, emergencyLogged, currentSession, currentMeasurement, leaderGPS, members]);

  /**
   * Continuous emergency audio alert
   */
  useEffect(() => {
    if (emergencySound || (!leaderConnected && timeSinceLeaderLost > 300000)) {
      // Play critical alert every 3 seconds
      audioInterval.current = window.setInterval(() => {
        soundManager.playCritical();
      }, 3000);

      return () => {
        if (audioInterval.current) clearInterval(audioInterval.current);
      };
    }
  }, [emergencySound, leaderConnected, timeSinceLeaderLost]);

  /**
   * Handle alert sounds
   */
  useEffect(() => {
    if (lastAlert) {
      if (lastAlert.level === 'critical') {
        soundManager.playCritical();
      } else {
        soundManager.playWarning();
      }
    }
  }, [lastAlert]);

  /**
   * Format time since leader lost
   */
  const formatTimeSince = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  /**
   * Get leader phone number
   */
  const leaderPhone = members.find(m => m.role === 'lead')?.phoneNumber || 'N/A';
  const memberCount = members.filter(m => m.isConnected).length;

  // Show join form if not connected
  if (showJoinForm || !currentSession) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-6 flex items-center justify-center">
        <div className="max-w-2xl w-full">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-blue-600 rounded-lg">
                <Shield className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Join Convoy</h1>
                <p className="text-gray-400">Enter your details to join the convoy</p>
              </div>
            </div>

            {/* Internet Required Warning */}
            <div className="mb-6 p-4 bg-orange-900/30 border-2 border-orange-500 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-orange-400 flex-shrink-0 mt-1" />
                <div>
                  <p className="font-semibold text-orange-300 mb-1">⚠️ Internet Connection Required</p>
                  <p className="text-sm text-orange-200">
                    Convoy Guardian requires an active internet connection to communicate between vehicles in real-time. 
                    Ensure all devices have stable cellular or WiFi connectivity.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleJoinSubmit} className="space-y-4">
              {/* Session Token - Only show if not pre-filled from QR code */}
              {!token ? (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Session Code *
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={sessionToken}
                      onChange={(e) => setSessionToken(e.target.value.toUpperCase())}
                      placeholder="Enter 8-digit code"
                      className="flex-1 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white text-center text-lg font-mono tracking-wider"
                    maxLength={8}
                    required
                    data-testid="input-session-token"
                  />
                  <button
                    type="button"
                    className="w-full sm:w-auto px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center justify-center gap-2"
                    data-testid="button-scan-qr"
                  >
                    <QrCode className="w-6 h-6" />
                    <span className="sm:hidden">Scan QR Code</span>
                  </button>
                </div>
              </div>
              ) : (
                <div className="bg-green-900/30 border border-green-500/50 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <QrCode className="w-6 h-6 text-green-400" />
                    <div>
                      <p className="font-semibold text-green-300">QR Code Scanned Successfully</p>
                      <p className="text-sm text-gray-400">Session: {sessionToken}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-sm font-medium mb-2">Your Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., John Smith"
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  required
                  data-testid="input-member-name"
                />
              </div>

              {/* Vehicle Role */}
              <div>
                <label className="block text-sm font-medium mb-2">Vehicle Role *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  required
                  data-testid="select-vehicle-role"
                >
                  {ROLE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.icon} {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Vehicle ID */}
              <div>
                <label className="block text-sm font-medium mb-2">Vehicle ID / License Plate *</label>
                <input
                  type="text"
                  value={formData.vehicleId}
                  onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })}
                  placeholder="e.g., ABC-1234"
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  required
                  data-testid="input-vehicle-id"
                />
              </div>

              {/* Company */}
              <div>
                <label className="block text-sm font-medium mb-2">Company / Agency</label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  placeholder="e.g., ABC Transport"
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  data-testid="input-company"
                />
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-sm font-medium mb-2">Phone Number *</label>
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  placeholder="e.g., +1.438.533.5344"
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  required
                  data-testid="input-phone"
                />
              </div>

              {/* Radio Channel */}
              <div>
                <label className="block text-sm font-medium mb-2">Radio Channel</label>
                <input
                  type="text"
                  value={formData.radioChannel}
                  onChange={(e) => setFormData({ ...formData, radioChannel: e.target.value })}
                  placeholder="e.g., CH 12"
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  data-testid="input-radio-channel"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium mb-2">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  placeholder="Any additional information..."
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white resize-none"
                  data-testid="textarea-notes"
                />
              </div>

              {/* Status Message Banner */}
              {joinMessage && (
                <div className={`p-4 rounded-lg text-center font-semibold ${
                  joinStatus === 'error' ? 'bg-red-500/20 text-red-300 border-2 border-red-500' :
                  joinStatus === 'success' ? 'bg-green-500/20 text-green-300 border-2 border-green-500' :
                  'bg-blue-500/20 text-blue-300 border-2 border-blue-500'
                }`}>
                  {joinStatus === 'connecting' && (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-blue-300 border-t-transparent rounded-full animate-spin"></div>
                      <span>{joinMessage}</span>
                    </div>
                  )}
                  {joinStatus !== 'connecting' && <span>{joinMessage}</span>}
                </div>
              )}

              <button
                type="submit"
                disabled={joinStatus === 'connecting'}
                className={`w-full px-6 py-4 rounded-lg font-semibold text-lg transition-colors ${
                  joinStatus === 'connecting' 
                    ? 'bg-gray-600 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
                data-testid="button-join-convoy"
              >
                {joinStatus === 'connecting' ? 'Joining...' : 'Join Convoy'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Emergency Alert (Leader Lost) - PERSISTENT MODAL
  if ((emergencyActive || (!leaderConnected && timeSinceLeaderLost > 300000)) && !emergencyDismissed) {
    return (
      <div className="fixed inset-0 z-[9999] bg-red-600 flex items-center justify-center">
        {/* Pulsing background */}
        <div className="absolute inset-0 bg-red-600 animate-pulse opacity-90"></div>
        
        {/* Modal - Cannot be dismissed by clicking outside */}
        <div ref={emergencyModalRef} className="relative bg-white dark:bg-gray-900 rounded-2xl p-10 max-w-3xl w-full mx-4 border-8 border-red-600 shadow-2xl overflow-y-auto max-h-[90vh]">
          <div className="text-center space-y-6">
            {/* Animated warning icon */}
            <div className="relative">
              <AlertTriangle className="w-40 h-40 text-red-600 mx-auto animate-bounce" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-40 h-40 bg-red-600 rounded-full animate-ping opacity-20"></div>
              </div>
            </div>
            
            <h1 className="text-6xl font-black text-red-600 uppercase tracking-tight animate-pulse">
              🚨 LEADER SIGNAL LOST 🚨
            </h1>
            
            <div className="text-4xl font-bold text-gray-900 dark:text-white bg-red-100 dark:bg-red-900 py-4 px-6 rounded-lg">
              Lost contact: {formatTimeSince(timeSinceLeaderLost)}
            </div>
            
            <div className="bg-red-100 dark:bg-red-900 p-8 rounded-xl border-4 border-red-600">
              <h2 className="text-3xl font-black mb-6 text-red-700 dark:text-red-300">
                🛑 ACTION REQUIRED - DO NOT PROCEED
              </h2>
              <ol className="text-left text-2xl space-y-4 text-gray-900 dark:text-white font-semibold">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-10 h-10 bg-red-600 text-white rounded-full flex items-center justify-center">1</span>
                  <span className="pt-1">STOP CONVOY IMMEDIATELY</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-10 h-10 bg-red-600 text-white rounded-full flex items-center justify-center">2</span>
                  <span className="pt-1">CALL LEAD VEHICLE: {leaderPhone}</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-10 h-10 bg-red-600 text-white rounded-full flex items-center justify-center">3</span>
                  <span className="pt-1">DO NOT PROCEED UNTIL CONTACT RESTORED</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-10 h-10 bg-red-600 text-white rounded-full flex items-center justify-center">4</span>
                  <span className="pt-1">NOTIFY OTHER TEAM MEMBERS</span>
                </li>
              </ol>
            </div>
            
            {leaderGPS && (
              <div className="text-xl text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800 p-6 rounded-xl">
                <div className="font-bold mb-3">📍 Last known position:</div>
                <div className="font-mono text-2xl text-blue-600 dark:text-blue-400">
                  {leaderGPS.latitude.toFixed(6)}, {leaderGPS.longitude.toFixed(6)}
                </div>
                <div className="text-lg text-gray-500 mt-3">
                  Last measurement: <span className="font-bold">{currentMeasurement}m</span>
                </div>
              </div>
            )}

            {emergencyReason && (
              <div className="bg-yellow-100 dark:bg-yellow-900/30 border-4 border-yellow-500 rounded-xl p-6">
                <p className="text-xl text-gray-900 dark:text-yellow-200">
                  <strong>Reason:</strong> {emergencyReason}
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button
                onClick={() => {
                  // Stop ALL looping sounds (emergency + critical loop)
                  soundManager.stopEmergency();
                  soundManager.stopSound('critical');
                  
                  // Clear the emergencySound state to stop the interval
                  setEmergencySound(false);
                }}
                className="flex-1 px-8 py-5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-xl transition-colors shadow-lg"
                data-testid="button-stop-alarm"
              >
                🔇 Stop Alarm
              </button>
              
              <button
                onClick={() => {
                  // CRITICAL FIX: Use the comprehensive acknowledgeEmergency method
                  // This stops ALL alarms, clears state, and sends acknowledgment
                  acknowledgeEmergency();
                  
                  // Also clear local emergencySound state to stop the critical loop
                  setEmergencySound(false);
                }}
                className="flex-1 px-8 py-5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-xl transition-colors shadow-lg"
                data-testid="button-acknowledge-emergency"
              >
                ✅ Acknowledge Emergency
              </button>
              
              <button
                onClick={handleDisconnect}
                className="flex-1 px-8 py-5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-bold text-xl transition-colors shadow-lg"
                data-testid="button-leave-convoy"
              >
                🚪 Leave Convoy
              </button>
            </div>

            <div className="text-sm text-gray-600 dark:text-gray-400 pt-4 border-t border-gray-300 dark:border-gray-700">
              <p className="font-semibold">All team members have been notified.</p>
              <p>System will continue monitoring for leader reconnection.</p>
              <p className="text-red-600 dark:text-red-400 font-bold mt-2">⚠️ This alert will remain until you acknowledge it or leave the convoy.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Monitoring Dashboard
  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 pb-24">
      <div className="max-w-6xl mx-auto">
        {/* Session Restored Banner */}
        {showReconnectBanner && (
          <div className="bg-green-900/30 border-2 border-green-500 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="w-6 h-6 text-green-400" />
                <div>
                  <p className="font-semibold text-green-300">✅ Session Restored</p>
                  <p className="text-sm text-green-200">
                    Successfully reconnected to convoy session
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowReconnectBanner(false)}
                className="p-2 hover:bg-green-800/50 rounded-lg transition-colors"
                data-testid="button-dismiss-reconnect-banner"
              >
                <X className="w-5 h-5 text-green-400" />
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">{currentSession.sessionName}</h1>
            <p className="text-gray-400">Convoy Guardian - Follower</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowEventLog(true)}
              className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors text-sm"
              data-testid="button-view-event-log"
            >
              <FileText className="w-4 h-4" />
              Event Log
              {eventLogCount > 0 && (
                <span className="px-2 py-0.5 bg-purple-500 rounded-full text-xs font-bold">
                  {eventLogCount}
                </span>
              )}
            </button>
            <button
              onClick={handleDisconnect}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              data-testid="button-disconnect"
            >
              Leave Convoy
            </button>
          </div>
        </div>

        {/* ISSUE 3: Emergency Stop Button - Moved to top for prominence */}
        <div className="mb-6">
          <button
            onClick={handleEmergencyStop}
            className="w-full px-8 py-6 bg-red-800 hover:bg-red-900 rounded-lg font-bold text-2xl flex items-center justify-center gap-3 transition-colors shadow-xl border-4 border-red-600"
            data-testid="button-emergency-stop-follower"
          >
            <AlertTriangle className="w-8 h-8" />
            🚨 EMERGENCY STOP 🚨
          </button>
          <p className="text-center text-gray-400 text-sm mt-2">
            Press to halt entire convoy immediately
          </p>
        </div>

        {/* ISSUE 7: Warning Button for Followers */}
        <div className="mb-6">
          <button
            onClick={() => setShowWarningDialog(true)}
            className="w-full px-6 py-4 bg-yellow-700 hover:bg-yellow-800 rounded-lg font-semibold text-lg flex items-center justify-center gap-3 transition-colors border-2 border-yellow-500"
            data-testid="button-send-warning"
          >
            <AlertTriangle className="w-6 h-6" />
            ⚠️ Send Warning to Convoy
          </button>
        </div>

        {/* ISSUE 7: Warning Dialog */}
        {showWarningDialog && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-lg p-6 max-w-lg w-full border-2 border-yellow-500">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-yellow-400" />
                Send Warning to Convoy
              </h2>
              <p className="text-gray-300 mb-4">
                Type your warning message to broadcast to all convoy members:
              </p>
              <textarea
                value={warningMessage}
                onChange={(e) => setWarningMessage(e.target.value)}
                placeholder="e.g., Low clearance ahead, slow down..."
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white resize-none mb-4"
                rows={4}
                data-testid="textarea-warning-message"
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  onClick={handleSendWarning}
                  disabled={!warningMessage.trim()}
                  className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-colors ${
                    warningMessage.trim()
                      ? 'bg-yellow-600 hover:bg-yellow-700'
                      : 'bg-gray-600 cursor-not-allowed'
                  }`}
                  data-testid="button-confirm-warning"
                >
                  Send Warning
                </button>
                <button
                  onClick={() => {
                    setWarningMessage('');
                    setShowWarningDialog(false);
                  }}
                  className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors"
                  data-testid="button-cancel-warning"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Current Clearance - HUGE Display */}
        <div className="bg-gradient-to-br from-blue-900 to-blue-800 rounded-2xl p-12 mb-6 text-center border-4 border-blue-600">
          <div className="text-8xl font-bold mb-4" data-testid="text-current-clearance">
            {currentMeasurement || '--'}m
          </div>
          <div className="text-3xl text-blue-200">Current Clearance</div>
          <div className="mt-4 text-xl text-gray-300">
            Warning: {currentSession.warningThreshold}m | Critical: {currentSession.criticalThreshold}m
          </div>
        </div>

        {/* ISSUE 4: Alert Banner with Close Button */}
        {lastAlert && !alertDismissed && (
          <div
            className={`rounded-lg p-6 mb-6 border-4 ${
              lastAlert.level === 'critical'
                ? 'bg-red-900 border-red-500'
                : 'bg-yellow-900 border-yellow-500'
            }`}
            data-testid="alert-banner"
          >
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-12 h-12 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-2xl font-bold uppercase">{lastAlert.level} ALERT</div>
                <div className="text-xl mt-2">{lastAlert.message}</div>
              </div>
              {/* ISSUE 4: Close button for alert */}
              <button
                onClick={() => setAlertDismissed(true)}
                className="p-2 hover:bg-black/20 rounded-lg transition-colors"
                data-testid="button-dismiss-alert"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
        )}

        {/* Connection Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Leader Status</h3>
            <div className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full ${leaderConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-2xl font-semibold">
                {leaderConnected ? '🟢 Connected' : '🔴 DISCONNECTED'}
              </span>
            </div>
            {!leaderConnected && leaderLastSeen > 0 && (
              <div className="mt-3 text-yellow-400">
                Lost contact: {formatTimeSince(timeSinceLeaderLost)}
              </div>
            )}
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Team Status</h3>
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6" />
              <span className="text-2xl font-semibold">
                {memberCount} Active Vehicles
              </span>
            </div>
            <div className="mt-3 text-gray-400">
              {members.filter(m => !m.isConnected).length} disconnected
            </div>
          </div>
        </div>

        {/* GPS Location (if available) */}
        {leaderGPS && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <MapPin className="w-6 h-6" />
              Leader Position
            </h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-sm text-gray-400">Latitude</div>
                <div className="text-lg font-mono">{leaderGPS.latitude.toFixed(6)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">Longitude</div>
                <div className="text-lg font-mono">{leaderGPS.longitude.toFixed(6)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">Altitude</div>
                <div className="text-lg font-mono">{leaderGPS.altitude.toFixed(1)}m</div>
              </div>
            </div>
          </div>
        )}

        {/* Emergency Stop Button - Available to ALL members */}
        <div className="mt-6">
          <button
            onClick={handleEmergencyStop}
            className="w-full px-8 py-6 bg-red-800 hover:bg-red-900 rounded-lg font-bold text-2xl flex items-center justify-center gap-3 transition-colors shadow-xl border-4 border-red-600"
            data-testid="button-emergency-stop-follower"
          >
            <AlertTriangle className="w-8 h-8" />
            🚨 EMERGENCY STOP 🚨
          </button>
          <p className="text-center text-gray-400 text-sm mt-2">
            Press to halt entire convoy immediately
          </p>
        </div>

        {/* Event Log Viewer */}
        {showEventLog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 border border-gray-700 rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between p-6 border-b border-gray-700">
                <div className="flex items-center gap-3">
                  <FileText className="w-6 h-6 text-purple-400" />
                  <h3 className="text-2xl font-semibold">Convoy Event Log</h3>
                  <span className="px-3 py-1 bg-purple-600 rounded-full text-sm font-bold">
                    {eventLogCount} events
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const blackBoxEvents = getBlackBoxEvents();
                      const csv = exportBlackBoxEventsToCSV(blackBoxEvents);
                      const blob = new Blob([csv], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `convoy-blackbox-follower-${currentSession.id}-${Date.now()}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex items-center gap-2"
                    data-testid="button-export-log"
                  >
                    <Download className="w-4 h-4" />
                    Export Black Box CSV
                  </button>
                  <button
                    onClick={() => setShowEventLog(false)}
                    className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                    data-testid="button-close-log"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="overflow-y-auto flex-1 p-6">
                {eventLogCount === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">No events logged yet</p>
                    <p className="text-sm">Session events will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {getConvoyEventLogs().map((log: any) => (
                      <div
                        key={log.id}
                        className={`p-4 rounded-lg border ${
                          log.severity === 'critical'
                            ? 'bg-red-900/20 border-red-700'
                            : log.severity === 'warning'
                            ? 'bg-yellow-900/20 border-yellow-700'
                            : 'bg-gray-700 border-gray-600'
                        }`}
                        data-testid={`event-log-${log.id}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className={`px-2 py-1 rounded text-xs font-bold ${
                                log.severity === 'critical'
                                  ? 'bg-red-600'
                                  : log.severity === 'warning'
                                  ? 'bg-yellow-600'
                                  : 'bg-blue-600'
                              }`}>
                                {log.severity.toUpperCase()}
                              </span>
                              <span className="text-sm text-gray-400 font-mono">
                                {new Date(log.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <p className="font-semibold mb-1">{log.eventType.replace(/_/g, ' ').toUpperCase()}</p>
                            {log.metadata && (
                              <pre className="text-xs text-gray-400 mt-2 overflow-x-auto">
                                {JSON.stringify(JSON.parse(log.metadata), null, 2)}
                              </pre>
                            )}
                          </div>
                          <div className="text-right text-sm text-gray-400">
                            {log.latitude !== 0 && log.longitude !== 0 && (
                              <div className="mb-1">
                                📍 {log.latitude.toFixed(6)}, {log.longitude.toFixed(6)}
                              </div>
                            )}
                            {log.measurement && (
                              <div>📏 {log.measurement}m</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Safety Disclaimer Footer */}
        <div className="mt-8 pt-6 border-t border-gray-700">
          <div className="flex items-start gap-3 text-sm text-gray-400">
            <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>
              <span className="font-semibold">Safety Notice:</span> This system is an ADDITIONAL layer of safety. 
              Physical high pole procedures, spotter vehicles, and all standard safety protocols MUST still be followed at all times.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
