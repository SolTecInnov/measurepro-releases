/**
 * GNSS Logging Utilities
 * Stage 3: End-to-End API Validation
 * 
 * Structured logging for GNSS data validation, rejections, and sync operations.
 */

/**
 * GNSS Rejection Log Entry
 * Captures details about rejected GNSS data due to validation failures
 */
export interface GnssRejectionLog {
  timestamp: number;
  endpoint: string;
  reason: string;
  missingFields: string[];
  count: number;
  requestId?: string;
  sampleData?: any; // Optional sample of rejected data for debugging
}

/**
 * GNSS Sync Log Entry
 * Captures details about GNSS data synchronization operations
 */
export interface GnssSyncLog {
  timestamp: number;
  operation: 'ingest' | 'batch' | 'profile' | 'event';
  accepted: number;
  rejected: number;
  surveyId?: string;
  sessionId?: string;
  profileId?: string;
  requestId?: string;
}

/**
 * GNSS Validation Log Entry
 * Captures details about validation operations
 */
export interface GnssValidationLog {
  timestamp: number;
  type: 'sample' | 'event' | 'profile' | 'batch';
  success: boolean;
  errorCount?: number;
  errors?: Array<{ path: string; message: string }>;
  requestId?: string;
}

/**
 * Log GNSS data rejection
 * 
 * Structured warning log for rejected GNSS data with missing or invalid identifiers.
 * Includes timestamp, endpoint, reason, missing fields, and optional request ID.
 */
export function logGnssRejection(log: GnssRejectionLog): void {
  console.warn('[GNSS Rejection]', {
    timestamp: new Date(log.timestamp).toISOString(),
    endpoint: log.endpoint,
    reason: log.reason,
    missingFields: log.missingFields,
    count: log.count,
    requestId: log.requestId,
    sample: log.sampleData ? JSON.stringify(log.sampleData).substring(0, 200) : undefined,
  });
}

/**
 * Log GNSS sync operation
 * 
 * Structured info log for GNSS data synchronization operations.
 * Includes accepted and rejected counts, identifiers, and operation type.
 */
export function logGnssSync(log: GnssSyncLog): void {
  console.info('[GNSS Sync]', {
    timestamp: new Date(log.timestamp).toISOString(),
    operation: log.operation,
    accepted: log.accepted,
    rejected: log.rejected,
    surveyId: log.surveyId,
    sessionId: log.sessionId,
    profileId: log.profileId,
    requestId: log.requestId,
    status: log.rejected === 0 ? 'SUCCESS' : 'PARTIAL',
  });
}

/**
 * Log GNSS validation result
 * 
 * Structured log for validation operations.
 * Includes success status, error count, and detailed error messages.
 */
export function logGnssValidation(log: GnssValidationLog): void {
  if (log.success) {
    console.info('[GNSS Validation]', {
      timestamp: new Date(log.timestamp).toISOString(),
      type: log.type,
      status: 'PASSED',
      requestId: log.requestId,
    });
  } else {
    console.warn('[GNSS Validation]', {
      timestamp: new Date(log.timestamp).toISOString(),
      type: log.type,
      status: 'FAILED',
      errorCount: log.errorCount,
      errors: log.errors,
      requestId: log.requestId,
    });
  }
}

/**
 * Log GNSS Firestore write operation
 * 
 * Structured log for Firestore write operations with validation results.
 */
export function logFirestoreWrite(
  collection: string,
  operation: 'insert' | 'batch' | 'update',
  count: number,
  identifiers: { surveyId?: string; sessionId?: string; profileId?: string }
): void {
  console.info('[GNSS Firestore]', {
    timestamp: new Date().toISOString(),
    collection,
    operation,
    count,
    ...identifiers,
  });
}

/**
 * Log GNSS Firestore write error
 * 
 * Structured error log for failed Firestore write operations.
 */
export function logFirestoreError(
  collection: string,
  operation: 'insert' | 'batch' | 'update',
  error: Error,
  identifiers?: { surveyId?: string; sessionId?: string; profileId?: string }
): void {
  console.error('[GNSS Firestore Error]', {
    timestamp: new Date().toISOString(),
    collection,
    operation,
    error: error.message,
    stack: error.stack?.substring(0, 300),
    ...identifiers,
  });
}

/**
 * Extract request ID from Express request headers
 * 
 * Useful for request tracing and correlation.
 */
export function getRequestId(headers: any): string | undefined {
  return headers['x-request-id'] as string | undefined;
}
