import { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '@/lib/config/environment';
import { Users, QrCode, AlertTriangle, Phone, Radio, StopCircle, Play, Pause, XCircle, Copy, Shield, FileText, Download, RefreshCw } from 'lucide-react';
import QRCode from 'qrcode';
import { useConvoyStore } from '@/lib/stores/convoyStore';
import { useLaserStore } from '@/lib/laser';
import { useGPSStore } from '@/lib/stores/gpsStore';
import { useSettingsStore } from '@/lib/settings';
import { soundManager } from '@/lib/sounds';
import { 
  logConvoyEvent, 
  getConvoyEventLogs, 
  logSessionStarted,
  logEmergency,
  logSessionEnded,
  getBlackBoxEvents,
  exportBlackBoxEventsToCSV,
} from '@/lib/convoy/eventLogger';
import { saveConvoySession, getConvoySession, clearConvoySession, updateConvoySessionActivity } from '@/lib/convoy/sessionPersistence';
import type { ConvoyMember } from '@shared/schema';

const ROLE_ICONS = {
  police_escort: '🚔',
  pilot_car: '🚗',
  bucket_truck: '🏗️',
  oversized_load: '📦',
  chase: '🚙',
  support: '🛠️',
  lead: '👑',
};

export default function ConvoyLeader() {
  const { convoySettings } = useSettingsStore();
  const { currentMeasure, groundReferenceHeight } = useLaserStore();
  const { data: gpsData } = useGPSStore();
  const {
    currentSession,
    members,
    connected,
    emergencyActive,
    emergencyReason,
    connectToSession,
    disconnect,
    sendMessage,
    sendHeartbeat,
    acknowledgeEmergency,
  } = useConvoyStore();

  // Session creation form
  const [sessionName, setSessionName] = useState('');
  const [warningThreshold, setWarningThreshold] = useState(convoySettings.defaultWarningThreshold);
  const [criticalThreshold, setCriticalThreshold] = useState(convoySettings.defaultCriticalThreshold);
  const [groundReference, setGroundReference] = useState(0);
  const [maxMembers, setMaxMembers] = useState(10);

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [convoyStatus, setConvoyStatus] = useState<'idle' | 'active' | 'paused'>('idle');
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  // Intervals
  const gpsInterval = useRef<number | null>(null);
  const measurementInterval = useRef<number | null>(null);
  
  // Event log viewer
  const [showEventLog, setShowEventLog] = useState(false);
  const [eventLogCount, setEventLogCount] = useState(0);
  
  // Session persistence
  const [isRestoringSession, setIsRestoringSession] = useState(false);
  const [showReconnectBanner, setShowReconnectBanner] = useState(false);
  
  // Track if we need to log session start after connection is confirmed
  const [needsSessionStartLog, setNeedsSessionStartLog] = useState(false);
  
  // Debug logs for mobile (iPhone can't see console)
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const addDebugLog = (message: string) => {
    setDebugLogs(prev => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${message}`]);
  };
  
  // Update event log count
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
   * Restore session on mount if exists
   */
  useEffect(() => {
    const savedSession = getConvoySession();
    if (savedSession && savedSession.isLeader && !connected) {
      setIsRestoringSession(true);
      // BUG FIX 3: Do NOT show reconnect banner yet - wait for join_approved
      
      // Restore session state
      setSessionId(savedSession.sessionId);
      setQrToken(savedSession.qrToken);
      setSessionName(savedSession.sessionName);
      setWarningThreshold(savedSession.warningThreshold || convoySettings.defaultWarningThreshold);
      setCriticalThreshold(savedSession.criticalThreshold || convoySettings.defaultCriticalThreshold);
      setGroundReference(savedSession.groundReference || 0);
      setMaxMembers(savedSession.maxMembers || 10);
      setQrCodeUrl(savedSession.qrCodeUrl || null);
      setConvoyStatus('active');
      
      // Regenerate QR code if missing
      if (!savedSession.qrCodeUrl) {
        const joinUrl = `${window.location.origin}/convoy/join/${savedSession.qrToken}`;
        QRCode.toDataURL(joinUrl, {
          width: 300,
          margin: 2,
          color: { dark: '#000000', light: '#FFFFFF' },
        }).then(setQrCodeUrl);
      }
      
      // Reconnect to WebSocket
      connectToSession(savedSession.sessionId, savedSession.qrToken, true, {
        name: savedSession.sessionName,
        vehicleId: 'LEADER',
        phoneNumber: '',
        radioChannel: '',
        company: '',
      });
      
      // Note: setIsRestoringSession(false) will happen after join_approved
    }
  }, []);
  
  /**
   * BUG FIX 3: Show reconnect banner only AFTER join_approved confirms the session
   */
  useEffect(() => {
    if (isRestoringSession && connected) {
      setShowReconnectBanner(true);
      setIsRestoringSession(false);
    }
  }, [isRestoringSession, connected]);
  
  /**
   * BUG FIX: Log session start AFTER connection is confirmed
   * This ensures the sessionId is properly set in the convoy store before logging
   */
  useEffect(() => {
    if (needsSessionStartLog && connected && currentSession) {
      // Black box logging: session started
      logSessionStarted(
        sessionName,
        'leader',
        {
          sessionName,
          warningThreshold,
          criticalThreshold,
          groundReference,
          maxMembers,
        },
        'LEADER'
      );
      
      // Legacy log (keep for backward compatibility)
      logConvoyEvent({
        eventType: 'convoy_session',
        sessionId: currentSession.id,
        severity: 'info',
        metadata: {
          action: 'started',
          sessionName,
          memberCount: 1,
          warningThreshold,
          criticalThreshold,
          groundReference,
        },
      });
      
      setNeedsSessionStartLog(false);
    }
  }, [needsSessionStartLog, connected, currentSession, sessionName, warningThreshold, criticalThreshold, groundReference, maxMembers]);
  
  /**
   * Update activity timestamp periodically
   */
  useEffect(() => {
    if (convoyStatus === 'active' && sessionId) {
      const interval = setInterval(() => {
        updateConvoySessionActivity();
      }, 30000); // Every 30 seconds
      
      return () => clearInterval(interval);
    }
  }, [convoyStatus, sessionId]);

  /**
   * Create convoy session
   */
  const handleCreateSession = async () => {
    if (!sessionName.trim()) {
      addDebugLog('❌ Session name required');
      alert('Please enter a convoy name');
      return;
    }

    addDebugLog('🚀 Creating session...');
    try {
      // Generate session ID and token
      // Use relative URL - works in all environments (localhost, Replit, production)
      const requestBody = {
        sessionName,
        warningThreshold,
        criticalThreshold,
        groundReference,
        maxMembers,
        leaderId: 'leader-' + Date.now(),
      };
      addDebugLog('📤 Sending API request...');
      
      const response = await fetch(`${API_BASE_URL}/api/convoy/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      addDebugLog(`📥 Response: ${response.status}`);
      const data = await response.json();
      
      if (!data.success) {
        addDebugLog(`❌ API Error: ${data.error}`);
        alert(`Failed to create session: ${data.error}`);
        return;
      }
      
      addDebugLog(`✅ Session created: ${data.qrToken}`);
      setSessionId(data.sessionId);
      setQrToken(data.qrToken);

      // Generate QR code
      const joinUrl = `${window.location.origin}/convoy/join/${data.qrToken}`;
      const qrUrl = await QRCode.toDataURL(joinUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
      setQrCodeUrl(qrUrl);

      // Connect to WebSocket and register as leader
      connectToSession(data.sessionId, data.qrToken, true, {
        name: sessionName,
        vehicleId: 'LEADER',
        phoneNumber: '',
        radioChannel: '',
        company: '',
      });

      setConvoyStatus('active');
      soundManager.playLogEntry();
      
      // Save session to localStorage for persistence
      saveConvoySession({
        sessionId: data.sessionId,
        qrToken: data.qrToken,
        sessionName,
        isLeader: true,
        warningThreshold,
        criticalThreshold,
        groundReference,
        maxMembers,
        qrCodeUrl: qrUrl,
        joinedAt: Date.now(),
      });

      // Set flag to trigger session start logging after connection is confirmed
      // This ensures the sessionId is properly set in the store before logging
      setNeedsSessionStartLog(true);
    } catch (error: any) {
      const errorMsg = error?.message || 'Unknown error';
      addDebugLog(`❌ Exception: ${errorMsg}`);
      alert(`Failed to create convoy session: ${errorMsg}`);
    }
  };

  /**
   * Start sharing measurements and GPS
   */
  useEffect(() => {
    if (convoyStatus === 'active' && connected && sessionId) {
      // Share measurements every 2 seconds
      measurementInterval.current = window.setInterval(() => {
        sendMessage({
          type: 'measurement',
          sessionId,
          data: {
            measurement: currentMeasure,
            groundReference: groundReferenceHeight,
            timestamp: Date.now(),
          },
          timestamp: Date.now(),
        });
      }, 2000);

      // Share GPS every 5 seconds
      gpsInterval.current = window.setInterval(() => {
        if (gpsData.latitude !== 0 && gpsData.longitude !== 0) {
          sendMessage({
            type: 'gps',
            sessionId,
            data: {
              latitude: gpsData.latitude,
              longitude: gpsData.longitude,
              altitude: gpsData.altitude,
              speed: gpsData.speed,
              course: gpsData.course,
              timestamp: Date.now(),
            },
            timestamp: Date.now(),
          });
        }
      }, 5000);

      return () => {
        if (measurementInterval.current) clearInterval(measurementInterval.current);
        if (gpsInterval.current) clearInterval(gpsInterval.current);
      };
    }
  }, [convoyStatus, connected, sessionId, currentMeasure, groundReferenceHeight, gpsData]);

  /**
   * CRITICAL FIX: Send heartbeat every 10 seconds to keep leader online status
   */
  useEffect(() => {
    if (connected && sessionId) {
      // Send initial heartbeat immediately
      sendHeartbeat();
      
      // Then send heartbeat every 10 seconds
      const heartbeatInterval = window.setInterval(() => {
        sendHeartbeat();
      }, 10000);

      return () => {
        clearInterval(heartbeatInterval);
      };
    }
  }, [connected, sessionId, sendHeartbeat]);

  /**
   * Send manual alert
   */
  const handleSendAlert = (level: 'warning' | 'critical') => {
    if (!sessionId) return;

    const message = level === 'critical'
      ? `🚨 CRITICAL ALERT: Clearance ${currentMeasure}m (Threshold: ${criticalThreshold}m)`
      : `⚠️ WARNING: Clearance ${currentMeasure}m (Threshold: ${warningThreshold}m)`;

    sendMessage({
      type: 'alert',
      sessionId,
      data: {
        level,
        message,
        measurement: currentMeasure,
        gps: {
          latitude: gpsData.latitude,
          longitude: gpsData.longitude,
        },
      },
      timestamp: Date.now(),
    });

    // Log alert event
    logConvoyEvent({
      eventType: 'convoy_alert',
      sessionId,
      severity: level,
      measurement: parseFloat(currentMeasure) || 0,
      metadata: {
        alertType: level,
        threshold: level === 'critical' ? criticalThreshold : warningThreshold,
        memberCount: members.length,
        message,
      },
    });

    if (level === 'critical') {
      soundManager.playCritical();
    } else {
      soundManager.playWarning();
    }
  };

  /**
   * Send emergency stop
   */
  const handleEmergencyStop = () => {
    if (!sessionId) return;

    const leaderName = sessionName || 'Leader';
    
    sendMessage({
      type: 'emergency',
      sessionId,
      data: {
        reason: 'manual_stop',
        message: `🚨 EMERGENCY STOP - Triggered by ${leaderName}`,
        triggeredBy: leaderName,
      },
      timestamp: Date.now(),
    });

    soundManager.playEmergency();
    setConvoyStatus('paused');
    
    // Black box logging: emergency stop
    logEmergency(
      leaderName,
      'leader',
      'Emergency stop manually triggered by convoy leader',
      'ConvoyLeader',
      undefined,
      'LEADER'
    );
    
    // Legacy log (keep for backward compatibility)
    logConvoyEvent({
      eventType: 'convoy_alert',
      sessionId,
      severity: 'critical',
      metadata: {
        action: 'emergency_stop_triggered',
        triggeredBy: leaderName,
        memberCount: members.length,
      },
    });
  };

  /**
   * End session
   */
  const handleEndSession = async () => {
    if (!sessionId) return;

    try {
      const sessionDuration = Date.now() - (currentSession?.createdAt ? new Date(currentSession.createdAt).getTime() : Date.now());
      
      // Black box logging: session ended
      logSessionEnded(
        sessionName || 'Leader',
        sessionDuration,
        members.length
      );
      
      // Legacy log (keep for backward compatibility)
      await logConvoyEvent({
        eventType: 'convoy_session',
        sessionId,
        severity: 'info',
        metadata: {
          action: 'ended',
          sessionName,
          duration: sessionDuration,
          memberCount: members.length,
        },
      });
      
      // Clear saved session from localStorage
      clearConvoySession();

      await fetch(`${API_BASE_URL}/api/convoy/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      disconnect();
      setSessionId(null);
      setQrToken(null);
      setQrCodeUrl(null);
      setConvoyStatus('idle');
      setShowEndConfirm(false);

      soundManager.playLogEntry();
    } catch (error) {
    }
  };

  /**
   * Copy join URL to clipboard
   */
  const handleCopyJoinUrl = () => {
    if (qrToken) {
      const joinUrl = `${window.location.origin}/convoy/join/${qrToken}`;
      navigator.clipboard.writeText(joinUrl);
      alert('Join URL copied to clipboard!');
    }
  };

  // Count connected members
  const connectedCount = members.filter(m => m.isConnected).length;
  const totalCount = members.length;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-blue-600 rounded-lg">
            <Shield className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Convoy Guardian - Leader</h1>
            <p className="text-gray-400">Real-time convoy coordination and monitoring</p>
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
                All convoy members must maintain stable cellular or WiFi connectivity throughout the operation.
              </p>
            </div>
          </div>
        </div>


        {/* Reconnect Banner */}
        {showReconnectBanner && sessionId && (
          <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5 text-green-400" />
                <div>
                  <p className="font-semibold text-green-400">Session Restored</p>
                  <p className="text-sm text-gray-300">
                    Reconnected to convoy: <span className="font-mono text-green-400">{sessionName}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowReconnectBanner(false)}
                className="p-2 hover:bg-green-800/30 rounded transition-colors"
                data-testid="button-dismiss-reconnect"
              >
                <XCircle className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>
        )}

        {/* Emergency Alert Banner */}
        {emergencyActive && sessionId && (
          <div className="bg-red-900/50 border-4 border-red-500 rounded-lg p-6 mb-6 animate-pulse">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-12 h-12 text-red-400 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-3xl font-bold text-red-300 mb-2">🚨 EMERGENCY STOP ACTIVE</h3>
                <p className="text-xl text-white mb-4">
                  {emergencyReason || 'Emergency stop has been triggered'}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => soundManager.stopEmergency()}
                    className="px-6 py-3 bg-orange-600 hover:bg-orange-700 rounded-lg font-bold text-lg transition-colors"
                    data-testid="button-stop-alarm"
                  >
                    🔇 Stop Alarm
                  </button>
                  <button
                    onClick={() => {
                      // BUG 2 FIX: Use the comprehensive acknowledgeEmergency method
                      // This stops the alarm, clears state, AND sends acknowledgment to all members
                      acknowledgeEmergency();
                    }}
                    className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-bold text-lg transition-colors"
                    data-testid="button-acknowledge-emergency"
                  >
                    ✅ Acknowledge & Clear Emergency
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Session Creation Form */}
        {!sessionId && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Create Convoy Session</h2>
            
            {/* Debug Panel (for iPhone users) */}
            {debugLogs.length > 0 && (
              <div className="bg-gray-900 border border-yellow-500 rounded p-3 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono text-yellow-400">🐛 DEBUG LOG</span>
                </div>
                <div className="text-xs font-mono space-y-1 text-gray-300 max-h-40 overflow-y-auto">
                  {debugLogs.map((log, idx) => (
                    <div key={idx}>{log}</div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-2">Convoy Name *</label>
                <input
                  type="text"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="e.g., Highway 401 Overpass Survey"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  data-testid="input-convoy-name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Max Members</label>
                <input
                  type="number"
                  value={maxMembers}
                  onChange={(e) => setMaxMembers(parseInt(e.target.value))}
                  min="2"
                  max="20"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  data-testid="input-max-members"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Warning Threshold (m)</label>
                <input
                  type="number"
                  value={warningThreshold}
                  onChange={(e) => setWarningThreshold(parseFloat(e.target.value))}
                  step="0.1"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  data-testid="input-warning-threshold"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Critical Threshold (m)</label>
                <input
                  type="number"
                  value={criticalThreshold}
                  onChange={(e) => setCriticalThreshold(parseFloat(e.target.value))}
                  step="0.1"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  data-testid="input-critical-threshold"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Ground Reference (m)</label>
                <input
                  type="number"
                  value={groundReference}
                  onChange={(e) => setGroundReference(parseFloat(e.target.value))}
                  step="0.01"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  data-testid="input-ground-reference"
                />
              </div>
            </div>

            <button
              onClick={handleCreateSession}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
              data-testid="button-create-session"
            >
              Create Convoy Session
            </button>
          </div>
        )}

        {/* Active Session */}
        {sessionId && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* QR Code & Session Info */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <QrCode className="w-5 h-5 text-blue-400" />
                <h2 className="text-xl font-semibold">Session QR Code</h2>
              </div>

              {qrCodeUrl && (
                <div className="bg-white p-4 rounded-lg mb-4">
                  <img src={qrCodeUrl} alt="Session QR Code" className="w-full" />
                </div>
              )}

              <div className="space-y-3">
                <div className="bg-gray-700 p-3 rounded-lg">
                  <p className="text-sm text-gray-400">Session Name</p>
                  <p className="font-semibold">{sessionName}</p>
                </div>

                <div className="bg-gray-700 p-3 rounded-lg">
                  <p className="text-sm text-gray-400">Join Code</p>
                  <div className="flex items-center justify-between">
                    <p className="text-2xl font-bold font-mono text-blue-400">{qrToken}</p>
                    <button
                      onClick={handleCopyJoinUrl}
                      className="p-2 hover:bg-gray-600 rounded transition-colors"
                      data-testid="button-copy-join-url"
                    >
                      <Copy className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="bg-gray-700 p-3 rounded-lg">
                  <p className="text-sm text-gray-400">Status</p>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${convoyStatus === 'active' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                    <p className="font-semibold capitalize">{convoyStatus}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Member Roster */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Team Members</h2>
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
                  <span className="text-lg font-bold">
                    {connectedCount}/{totalCount}
                  </span>
                </div>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {members.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No members yet</p>
                    <p className="text-sm">Share the QR code to add members</p>
                  </div>
                )}

                {members.map((member: ConvoyMember) => (
                  <div
                    key={member.id}
                    className={`p-3 rounded-lg border ${
                      member.isConnected
                        ? 'bg-gray-700 border-gray-600'
                        : 'bg-gray-800 border-gray-700 opacity-60'
                    }`}
                    data-testid={`member-card-${member.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{ROLE_ICONS[member.role as keyof typeof ROLE_ICONS] || '🚗'}</span>
                        <div>
                          <p className="font-semibold">{member.name}</p>
                          <p className="text-sm text-gray-400">{member.vehicleId}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <span className={member.isConnected ? 'text-green-400' : 'text-red-400'}>
                            {member.isConnected ? '🟢' : '🔴'}
                          </span>
                          <Phone className="w-4 h-4 text-gray-400" />
                        </div>
                        {member.radioChannel && (
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Radio className="w-3 h-3" />
                            <span>{member.radioChannel}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Control Buttons */}
        {sessionId && (
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            {convoyStatus === 'active' && (
              <button
                onClick={() => setConvoyStatus('paused')}
                className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
                data-testid="button-pause-convoy"
              >
                <Pause className="w-5 h-5" />
                Pause
              </button>
            )}

            {convoyStatus === 'paused' && (
              <button
                onClick={() => setConvoyStatus('active')}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
                data-testid="button-resume-convoy"
              >
                <Play className="w-5 h-5" />
                Resume
              </button>
            )}

            <button
              onClick={() => handleSendAlert('warning')}
              className="px-6 py-3 bg-orange-600 hover:bg-orange-700 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
              data-testid="button-send-warning"
            >
              <AlertTriangle className="w-5 h-5" />
              Send Warning
            </button>

            <button
              onClick={() => handleSendAlert('critical')}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
              data-testid="button-send-critical"
            >
              <AlertTriangle className="w-5 h-5" />
              Critical Alert
            </button>

            <button
              onClick={handleEmergencyStop}
              className="px-6 py-3 bg-red-800 hover:bg-red-900 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
              data-testid="button-emergency-stop"
            >
              <StopCircle className="w-5 h-5" />
              Emergency Stop
            </button>

            <button
              onClick={() => setShowEndConfirm(true)}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
              data-testid="button-end-session"
            >
              <XCircle className="w-5 h-5" />
              End Session
            </button>
          </div>
        )}

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
                      a.download = `convoy-blackbox-${sessionId}-${Date.now()}.csv`;
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

        {/* End Session Confirmation */}
        {showEndConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-md mx-4">
              <h3 className="text-xl font-semibold mb-4">End Convoy Session?</h3>
              <p className="text-gray-300 mb-6">
                This will disconnect all members and close the session. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowEndConfirm(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors"
                  data-testid="button-cancel-end"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEndSession}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition-colors"
                  data-testid="button-confirm-end"
                >
                  End Session
                </button>
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
