import { captureBlackBoxContext, getCurrentSessionId, getCurrentConvoyRole } from './blackBoxContext';
import type { ConvoyBlackBoxEvent, Actor, TriggerContext } from '@shared/schema';

// Maximum events to keep in localStorage (1000-event rotation)
const MAX_BLACK_BOX_EVENTS = 1000;
const BLACK_BOX_STORAGE_KEY = 'convoy_black_box_events';
const SEQUENCE_COUNTER_KEY = 'convoy_sequence_counter';
const MEMBER_ID_KEY = 'convoy_member_id';

/**
 * Get or initialize sequence counter for this device
 */
function getNextSequenceNumber(): number {
  try {
    const current = localStorage.getItem(SEQUENCE_COUNTER_KEY);
    const next = current ? parseInt(current, 10) + 1 : 1;
    localStorage.setItem(SEQUENCE_COUNTER_KEY, next.toString());
    return next;
  } catch (error) {
    return Date.now(); // Fallback to timestamp
  }
}

/**
 * Get or generate member ID for this device
 */
function getMemberId(): string {
  try {
    let memberId = localStorage.getItem(MEMBER_ID_KEY);
    if (!memberId) {
      memberId = crypto.randomUUID();
      localStorage.setItem(MEMBER_ID_KEY, memberId);
    }
    return memberId;
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Core function to create and store a black box event
 */
function createAndStoreBlackBoxEvent(
  eventCategory: ConvoyBlackBoxEvent['eventCategory'],
  eventType: string,
  actor: Actor,
  triggerContext: TriggerContext,
  payload: Record<string, any>,
  vehicleId?: string,
  videoReference?: string,
  imageReference?: string
): ConvoyBlackBoxEvent {
  // Capture context
  const context = captureBlackBoxContext();
  const now = Date.now();

  // Get sync metadata
  const sequenceNumber = getNextSequenceNumber();
  const memberId = getMemberId();

  // Create comprehensive black box event
  const event: ConvoyBlackBoxEvent = {
    id: crypto.randomUUID(),
    timestamp: now,
    timestampISO: new Date(now).toISOString(),
    eventCategory,
    eventType,
    sessionId: getCurrentSessionId(),
    convoyRole: getCurrentConvoyRole(),
    actor,
    convoyState: context.convoyState || undefined,
    gpsSnapshot: context.gpsSnapshot || undefined,
    vehicleId,
    triggerContext,
    payload,
    deviceMetadata: context.deviceMetadata,
    videoReference,
    imageReference,
    // Sync metadata
    sequenceNumber,
    memberId,
    syncStatus: 'local',
    syncRetries: 0,
  };

  // Store to localStorage
  try {
    const events = getBlackBoxEvents();
    events.unshift(event);

    // Keep only last 1000 events
    if (events.length > MAX_BLACK_BOX_EVENTS) {
      events.splice(MAX_BLACK_BOX_EVENTS);
    }

    localStorage.setItem(BLACK_BOX_STORAGE_KEY, JSON.stringify(events));

    // Dispatch event for UI updates
    window.dispatchEvent(new CustomEvent('convoy-event-logged'));

  } catch (error) {
  }

  return event;
}

/**
 * Get all black box events from localStorage
 */
export function getBlackBoxEvents(): ConvoyBlackBoxEvent[] {
  try {
    const data = localStorage.getItem(BLACK_BOX_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    return [];
  }
}

/**
 * Clear all black box events
 */
export function clearBlackBoxEvents(): void {
  try {
    localStorage.removeItem(BLACK_BOX_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('convoy-event-logged'));
  } catch (error) {
  }
}

// ==================== SYNC MANAGEMENT FUNCTIONS ====================

/**
 * Get all unsynced events (status = 'local' or 'failed')
 */
export function getUnsyncedEvents(): ConvoyBlackBoxEvent[] {
  try {
    const events = getBlackBoxEvents();
    return events.filter(e => e.syncStatus === 'local' || e.syncStatus === 'failed');
  } catch (error) {
    return [];
  }
}

/**
 * Update sync status for events
 */
export function updateEventsSyncStatus(
  eventIds: string[],
  status: 'local' | 'synced' | 'failed',
  incrementRetries = false
): void {
  try {
    const events = getBlackBoxEvents();
    const eventIdSet = new Set(eventIds);
    
    const updatedEvents = events.map(event => {
      if (eventIdSet.has(event.id)) {
        return {
          ...event,
          syncStatus: status,
          lastSyncAttempt: Date.now(),
          syncRetries: incrementRetries ? (event.syncRetries || 0) + 1 : event.syncRetries,
        };
      }
      return event;
    });
    
    localStorage.setItem(BLACK_BOX_STORAGE_KEY, JSON.stringify(updatedEvents));
    window.dispatchEvent(new CustomEvent('convoy-event-logged'));
  } catch (error) {
  }
}

/**
 * Get current member ID
 */
export function getCurrentMemberId(): string {
  return getMemberId();
}

// ==================== TYPED BUILDER FUNCTIONS ====================

/**
 * Log session started event
 */
export function logSessionStarted(
  creatorName: string,
  creatorRole: string,
  sessionConfig: {
    sessionName: string;
    warningThreshold: number;
    criticalThreshold: number;
    groundReference: number;
    maxMembers: number;
  },
  vehicleId?: string
): ConvoyBlackBoxEvent {
  return createAndStoreBlackBoxEvent(
    'session_lifecycle',
    'session_started',
    {
      name: creatorName,
      role: creatorRole,
    },
    {
      sourceModule: 'ConvoyLeader',
      uiElement: 'create-session-button',
      triggeredBy: 'user',
    },
    {
      sessionName: sessionConfig.sessionName,
      warningThreshold: sessionConfig.warningThreshold,
      criticalThreshold: sessionConfig.criticalThreshold,
      groundReference: sessionConfig.groundReference,
      maxMembers: sessionConfig.maxMembers,
    },
    vehicleId
  );
}

/**
 * Log member join event
 */
export function logMemberJoin(
  memberName: string,
  memberRole: string,
  memberCompany: string | undefined,
  memberPhone: string,
  joinFormData: {
    vehicleId: string;
    radioChannel?: string;
    notes?: string;
  }
): ConvoyBlackBoxEvent {
  return createAndStoreBlackBoxEvent(
    'member_activity',
    'member_joined',
    {
      name: memberName,
      company: memberCompany,
      role: memberRole,
      phoneNumber: memberPhone,
    },
    {
      sourceModule: 'ConvoyFollower',
      uiElement: 'join-form',
      triggeredBy: 'user',
    },
    {
      vehicleId: joinFormData.vehicleId,
      radioChannel: joinFormData.radioChannel,
      notes: joinFormData.notes,
    },
    joinFormData.vehicleId
  );
}

/**
 * Log member leave event
 */
export function logMemberLeave(
  memberName: string,
  memberRole: string,
  reason: string,
  vehicleId?: string
): ConvoyBlackBoxEvent {
  return createAndStoreBlackBoxEvent(
    'member_activity',
    'member_left',
    {
      name: memberName,
      role: memberRole,
    },
    {
      sourceModule: 'ConvoyFollower',
      triggeredBy: reason.includes('emergency') ? 'system' : 'user',
    },
    {
      reason,
    },
    vehicleId
  );
}

/**
 * Log measurement broadcast
 */
export function logMeasurement(
  value: number,
  source: string,
  triggeredBy: string,
  actorName: string,
  actorRole: string
): ConvoyBlackBoxEvent {
  return createAndStoreBlackBoxEvent(
    'measurement',
    'measurement_broadcast',
    {
      name: actorName,
      role: actorRole,
    },
    {
      sourceModule: source,
      triggeredBy: 'automatic',
    },
    {
      measurementValue: value,
      measurementUnit: 'meters',
      laserSource: source,
    }
  );
}

/**
 * Log laser alert
 */
export function logLaserAlert(
  alertLevel: 'warning' | 'critical',
  measurementValue: number,
  source: string,
  actorName: string,
  actorRole: string,
  threshold: number
): ConvoyBlackBoxEvent {
  return createAndStoreBlackBoxEvent(
    'alert',
    'laser_alert',
    {
      name: actorName,
      role: actorRole,
    },
    {
      sourceModule: source,
      triggeredBy: 'automatic',
    },
    {
      alertLevel,
      measurementValue,
      measurementUnit: 'meters',
      threshold,
      laserSource: source,
    }
  );
}

/**
 * Log emergency stop
 */
export function logEmergency(
  triggeredBy: string,
  triggeredByRole: string,
  reason: string,
  sourceModule: string,
  videoReference?: string,
  vehicleId?: string
): ConvoyBlackBoxEvent {
  return createAndStoreBlackBoxEvent(
    'emergency',
    'emergency_stop',
    {
      name: triggeredBy,
      role: triggeredByRole,
    },
    {
      sourceModule,
      uiElement: 'emergency-stop-button',
      triggeredBy: 'user',
    },
    {
      reason,
      emergencyType: 'manual_stop',
    },
    vehicleId,
    videoReference
  );
}

/**
 * Log warning message
 */
export function logWarning(
  sentBy: string,
  sentByRole: string,
  message: string,
  sourceModule: string
): ConvoyBlackBoxEvent {
  return createAndStoreBlackBoxEvent(
    'communication',
    'warning_message',
    {
      name: sentBy,
      role: sentByRole,
    },
    {
      sourceModule,
      uiElement: 'warning-button',
      triggeredBy: 'user',
    },
    {
      message,
      messageType: 'warning',
    }
  );
}

/**
 * Log configuration change
 */
export function logConfigChange(
  changedBy: string,
  changedByRole: string,
  changes: Record<string, any>,
  sourceModule: string
): ConvoyBlackBoxEvent {
  return createAndStoreBlackBoxEvent(
    'configuration',
    'config_changed',
    {
      name: changedBy,
      role: changedByRole,
    },
    {
      sourceModule,
      triggeredBy: 'user',
    },
    {
      changes,
    }
  );
}

/**
 * Log session ended
 */
export function logSessionEnded(
  leaderName: string,
  sessionDuration: number,
  totalMembers: number
): ConvoyBlackBoxEvent {
  return createAndStoreBlackBoxEvent(
    'session_lifecycle',
    'session_ended',
    {
      name: leaderName,
      role: 'leader',
    },
    {
      sourceModule: 'ConvoyLeader',
      uiElement: 'end-session-button',
      triggeredBy: 'user',
    },
    {
      sessionDurationMs: sessionDuration,
      totalMembers,
    }
  );
}

/**
 * Log leader connection lost
 */
export function logLeaderLost(
  timeSinceLost: number,
  lastMeasurement: string,
  memberName: string
): ConvoyBlackBoxEvent {
  return createAndStoreBlackBoxEvent(
    'emergency',
    'leader_connection_lost',
    {
      name: memberName,
      role: 'follower',
    },
    {
      sourceModule: 'ConvoyFollower',
      triggeredBy: 'system',
    },
    {
      timeSinceLostMs: timeSinceLost,
      lastMeasurement,
    }
  );
}

// ==================== ENHANCED CSV EXPORT ====================

/**
 * Export black box events to comprehensive CSV format
 * For leaders: includes aggregated logs from all convoy members
 */
export function exportBlackBoxEventsToCSV(events: ConvoyBlackBoxEvent[]): string {
  // For leaders: merge local events with aggregated member logs
  let allEvents = [...events];
  
  try {
    const aggregatedLogs = localStorage.getItem('convoy_aggregated_logs');
    if (aggregatedLogs) {
      const memberEvents: ConvoyBlackBoxEvent[] = JSON.parse(aggregatedLogs);
      allEvents = [...allEvents, ...memberEvents];
    }
  } catch (error) {
  }
  
  // Deduplicate by event ID
  const uniqueEvents = new Map<string, ConvoyBlackBoxEvent>();
  for (const event of allEvents) {
    if (!uniqueEvents.has(event.id)) {
      uniqueEvents.set(event.id, event);
    }
  }
  
  // Sort by timestamp for complete timeline
  const sortedEvents = Array.from(uniqueEvents.values()).sort((a, b) => a.timestamp - b.timestamp);
  
  const headers = [
    // Source Device (NEW)
    'Source Device',
    'Source Member ID',
    'Sync Status',
    
    // Time
    'Timestamp (ISO)',
    'Timestamp (ms)',
    
    // Event Classification
    'Event Category',
    'Event Type',
    'Session ID',
    'Convoy Role',
    
    // Actor
    'Actor Name',
    'Actor Role',
    'Actor Company',
    'Actor Phone',
    
    // GPS Data
    'Latitude',
    'Longitude',
    'Altitude (m)',
    'Speed (m/s)',
    'Course (deg)',
    'Fix Quality',
    'Satellites',
    'HDOP',
    'GPS Source',
    
    // Convoy State
    'Total Members',
    'Connected Members',
    'Warning Threshold (m)',
    'Critical Threshold (m)',
    'Ground Reference (m)',
    
    // Vehicle Info
    'Vehicle ID',
    'VIN',
    'License Plate',
    
    // Trigger Context
    'Source Module',
    'UI Element',
    'Triggered By',
    
    // Event-Specific Data
    'Alert Level',
    'Measurement Value',
    'Measurement Unit',
    'Laser Source',
    'Reason/Message',
    'Video Reference',
    'Image Reference',
    
    // Device
    'User Agent',
    'Platform',
    'Screen (WxH)',
    'Network Type',
    'Online',
    
    // Raw Payload
    'Payload (JSON)',
  ];

  const rows = sortedEvents.map(event => [
    // Source Device columns
    event.actor.name || 'Unknown',
    event.memberId || 'leader',
    event.syncStatus || 'local',
    event.timestampISO,
    event.timestamp.toString(),
    event.eventCategory,
    event.eventType,
    event.sessionId,
    event.convoyRole,
    event.actor.name,
    event.actor.role,
    event.actor.company || '',
    event.actor.phoneNumber || '',
    event.gpsSnapshot?.latitude?.toFixed(6) || '',
    event.gpsSnapshot?.longitude?.toFixed(6) || '',
    event.gpsSnapshot?.altitude?.toFixed(2) || '',
    event.gpsSnapshot?.speed?.toFixed(2) || '',
    event.gpsSnapshot?.course?.toFixed(1) || '',
    event.gpsSnapshot?.fixQuality || '',
    event.gpsSnapshot?.satellites?.toString() || '',
    event.gpsSnapshot?.hdop?.toFixed(1) || '',
    event.gpsSnapshot?.source || '',
    event.convoyState?.totalMembers?.toString() || '',
    event.convoyState?.connectedMembers?.toString() || '',
    event.convoyState?.warningThreshold?.toFixed(2) || '',
    event.convoyState?.criticalThreshold?.toFixed(2) || '',
    event.convoyState?.groundReference?.toFixed(2) || '',
    event.vehicleId || '',
    event.vin || '',
    event.licensePlate || '',
    event.triggerContext.sourceModule,
    event.triggerContext.uiElement || '',
    event.triggerContext.triggeredBy,
    event.payload.alertLevel || '',
    event.payload.measurementValue?.toString() || '',
    event.payload.measurementUnit || '',
    event.payload.laserSource || '',
    event.payload.reason || event.payload.message || '',
    event.videoReference || '',
    event.imageReference || '',
    event.deviceMetadata.userAgent,
    event.deviceMetadata.platform,
    `${event.deviceMetadata.screenWidth}x${event.deviceMetadata.screenHeight}`,
    event.deviceMetadata.networkType || '',
    event.deviceMetadata.online.toString(),
    JSON.stringify(event.payload).replace(/"/g, '""'), // Escape quotes for CSV
  ]);

  // CSV formatting with proper escaping
  const csvRows = [headers.join(',')];
  for (const row of rows) {
    const escapedRow = row.map(field => {
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      const fieldStr = String(field);
      if (fieldStr.includes(',') || fieldStr.includes('"') || fieldStr.includes('\n')) {
        return `"${fieldStr.replace(/"/g, '""')}"`;
      }
      return fieldStr;
    });
    csvRows.push(escapedRow.join(','));
  }

  return csvRows.join('\n');
}

// ==================== LEGACY COMPATIBILITY ====================
// Keep old functions for backward compatibility

export interface ConvoyEventLog {
  eventType: 'convoy_session' | 'convoy_member' | 'convoy_alert' | 'convoy_leader_lost' | 'convoy_config';
  sessionId: string;
  memberId?: string;
  severity: 'info' | 'warning' | 'critical';
  measurement?: number;
  videoUrl?: string;
  imageUrl?: string;
  metadata: any;
}

export const logConvoyEvent = async (event: ConvoyEventLog) => {
  // Still store in old format for backward compatibility
  try {
    const context = captureBlackBoxContext();
    
    const logEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      eventType: event.eventType,
      sessionId: event.sessionId,
      memberId: event.memberId || null,
      severity: event.severity,
      measurement: event.measurement || null,
      latitude: context.gpsSnapshot?.latitude || 0,
      longitude: context.gpsSnapshot?.longitude || 0,
      altitude: context.gpsSnapshot?.altitude || 0,
      speed: context.gpsSnapshot?.speed || 0,
      videoUrl: event.videoUrl || null,
      imageUrl: event.imageUrl || null,
      metadata: JSON.stringify(event.metadata),
      utcDate: new Date().toISOString().split('T')[0],
      utcTime: new Date().toTimeString().split(' ')[0],
    };
    
    const independentLogs = JSON.parse(localStorage.getItem('convoy_event_logs') || '[]');
    independentLogs.unshift(logEntry);
    
    if (independentLogs.length > 1000) {
      independentLogs.splice(1000);
    }
    
    localStorage.setItem('convoy_event_logs', JSON.stringify(independentLogs));
    window.dispatchEvent(new CustomEvent('convoy-event-logged'));
    
    return logEntry;
  } catch (error) {
    return null;
  }
};

export const getConvoyEventLogs = (): any[] => {
  try {
    return JSON.parse(localStorage.getItem('convoy_event_logs') || '[]');
  } catch (error) {
    return [];
  }
};

export const clearConvoyEventLogs = () => {
  try {
    localStorage.removeItem('convoy_event_logs');
    window.dispatchEvent(new CustomEvent('convoy-event-logged'));
  } catch (error) {
  }
};

export const exportConvoyLogsToCSV = (logs: any[]): string => {
  const headers = [
    'Timestamp',
    'Event Type',
    'Severity',
    'Session ID',
    'Member ID',
    'Measurement',
    'Latitude',
    'Longitude',
    'Altitude',
    'Speed',
    'Video URL',
    'Image URL',
    'Metadata'
  ];
  
  const rows = logs.map(log => [
    new Date(log.timestamp).toISOString(),
    log.eventType,
    log.severity,
    log.sessionId,
    log.memberId || '',
    log.measurement || '',
    log.latitude,
    log.longitude,
    log.altitude,
    log.speed,
    log.videoUrl || '',
    log.imageUrl || '',
    log.metadata
  ]);
  
  return [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');
};
