/**
 * RoadScope API Types
 * Types for the MeasurePRO to RoadScope data sync integration
 */

// API Response wrapper
export interface RoadScopeResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Health check
export interface HealthCheckData {
  status: 'healthy' | 'degraded' | 'down';
  version: string;
  timestamp: string;
}

// Company context returned by /auth/validate
export interface AuthCompanyInfo {
  companyId: string;
  companyName: string;
  role: 'owner' | 'admin' | 'surveyor' | 'viewer';
}

// Auth validation
export interface AuthValidationData {
  valid: boolean;
  userId: string;
  userEmail: string;
  scopes: string[];
  expiresAt: string;
  keyName?: string;
  companies?: AuthCompanyInfo[];
}

// POI Type from RoadScope
export interface RoadScopePOIType {
  name: string;
  color: string;
  icon: string;
  prefix: string;
}

// RoadScope Survey
export interface RoadScopeSurvey {
  id: string;
  externalId?: string;
  name: string;
  description?: string;
  client?: string;
  projectNumber?: string;
  status: 'active' | 'completed' | 'archived';
  poiCount: number;
  routeCount: number;
  createdAt: string;
  updatedAt: string;
}

// Survey creation/update request
export interface CreateSurveyRequest {
  externalId: string; // MeasurePRO survey ID
  name: string;
  companyId?: string;             // Company context for RoadScope routing
  dataPhase?: 'field' | 'office'; // Always 'field' for MeasurePRO pushes
  surveyorFirebaseUid?: string;   // Firebase UID of the surveyor
  description?: string;
  client?: string;
  projectNumber?: string;
  status?: 'active' | 'completed';
  startDate?: string;
  endDate?: string;
  metadata?: {
    measureproVersion?: string;
    deviceId?: string;
    operator?: string;
    [key: string]: any;
  };
}

// Survey creation/update response
export interface CreateSurveyResponse {
  id: string;
  name: string;
  externalId: string;
  created: boolean;
  updated: boolean;
}

// POI for upload - matches RoadScope API spec exactly
export interface RoadScopePOI {
  externalId: string; // MeasurePRO measurement.id
  roadNumber?: string; // e.g., "R001"
  poiNumber?: number;
  name?: string;
  description?: string;
  type: string; // RoadScope POI type (Bridge, PowerLine, etc.)
  coordinates: {
    latitude: number;
    longitude: number;
    altitude?: number;
  };
  measurements?: {
    heightClearance?: number;
    widthClearance?: number;
    length?: number;
    unit?: 'meters' | 'feet';
  };
  gpsData?: {
    satellites?: number;
    hdop?: number;
    speed?: number;
    course?: number;
    accuracy?: number;
  };
  badges?: string[]; // e.g., ["Danger"]
  alerts?: string[]; // e.g., ["Low Clearance", "Weight Restriction"]
  notes?: string; // Public inspection notes
  privateNotes?: string; // Internal crew notes
  capturedAt: string; // ISO timestamp
  capturedDate?: string; // YYYY-MM-DD
  capturedTime?: string; // HH:mm:ss
  mileMarker?: number; // Kilometer/mile marker
  source?: string; // "MeasurePRO"
  photos?: string[]; // Photo file IDs or storage paths
  videos?: string[]; // Video file IDs or storage paths
  videoTime?: number; // Video timestamp in seconds
  timelapse?: string[]; // Timelapse frame IDs
  voiceNote?: string | null; // Voice note file ID
  drawing?: string | null; // Drawing/annotation file ID
  metadata?: Record<string, any>;
}

// POI batch upsert request
export interface BatchUpsertPOIsRequest {
  mode: 'create' | 'upsert';
  pois: RoadScopePOI[];
}

// POI batch result
export interface POIBatchResult {
  externalId: string;
  id: string;
  status: 'created' | 'updated' | 'error';
  error?: string;
}

export interface BatchUpsertPOIsResponse {
  results: POIBatchResult[];
  summary: {
    total: number;
    created: number;
    updated: number;
    errors: number;
  };
}

// Route/Trace for upload
export interface RoadScopeRoute {
  externalId: string;
  name: string;
  description?: string;
  type: 'trace' | 'route' | 'path';
  coordinates: Array<{
    latitude: number;
    longitude: number;
    altitude?: number;
    timestamp?: string;
  }>;
  metadata?: Record<string, any>;
  startTime?: string;
  endTime?: string;
  distance?: number;
  distanceUnit?: 'kilometers' | 'miles';
}

// Route batch upsert request
export interface BatchUpsertRoutesRequest {
  mode: 'create' | 'upsert';
  routes: RoadScopeRoute[];
}

// Route batch result
export interface RouteBatchResult {
  externalId: string;
  id: string;
  status: 'created' | 'updated' | 'error';
  error?: string;
}

export interface BatchUpsertRoutesResponse {
  results: RouteBatchResult[];
  summary: {
    total: number;
    created: number;
    updated: number;
    errors: number;
  };
}

// File upload URL request
// CRITICAL: poiExternalId is required for RoadScope to build correct storage path
// Path format: measurepro/{surveyId}/photos/{poiExternalId}/{filename}
export interface FileUploadRequest {
  filename: string;
  contentType: string;
  size: number;
  type?: 'photo' | 'video' | 'timelapse' | 'drawing' | 'document';
  linkedPoiExternalId?: string | null;
  category: string; // REQUIRED: 'photos', 'drawings', 'timelapse', 'videos', 'files'
  poiExternalId: string; // REQUIRED: POI external ID for storage path organization
}

export interface UploadURLsRequest {
  files: FileUploadRequest[];
}

export interface UploadURLResult {
  filename: string;
  uploadUrl: string;
  storagePath: string;
  expiresAt: string;
}

export interface UploadURLsResponse {
  uploadUrls?: UploadURLResult[];
  uploads?: UploadURLResult[]; // Alternative field name from RoadScope API
  urls?: UploadURLResult[]; // Another alternative field name
}

// File registration request
// CRITICAL: Field names must EXACTLY match RoadScope API expectations
// RoadScope uses linkedPoiExternalId to auto-link photos to POIs
export interface FileRegistration {
  // Required fields (per RoadScope API spec)
  filename: string;               // Original filename
  storageUrl: string;             // CRITICAL: Path format: measurepro/{surveyId}/photos/{poiExternalId}/{filename}
  publicUrl?: string;             // Full URL for direct access (optional, RoadScope can derive from storageUrl)
  category: string;               // One of: 'photos', 'drawings', 'timelapse', 'videos', 'files'
  contentType: string;            // MIME type (e.g., 'image/jpeg') - NOT mimeType!
  size: number;                   // File size in bytes
  
  // CRITICAL for auto-linking
  linkedPoiExternalId: string;    // REQUIRED: Links file to POI by externalId - enables automatic photo display
  linkedRouteExternalId?: string | null;  // Links file to a route
  
  // Optional metadata
  metadata?: {
    captureTime?: string;         // ISO timestamp of when photo was taken
    caption?: string;             // Photo caption/description
  };
}

export interface RegisterFilesRequest {
  files: FileRegistration[];
}

export interface RegisterFilesResponse {
  registered: number;
  linked: number;
  files: Array<{
    id: string;
    storagePath: string;
    linkedPoiId?: string;
  }>;
}

// Sync state stored in IndexedDB
export interface SyncState {
  surveyId: string;
  roadscopeSurveyId?: string;
  lastSyncTime?: string;
  pendingPOIs: string[]; // POI IDs
  pendingRoutes: string[]; // Route IDs
  pendingFiles: string[]; // File paths
  syncedPOIs: Map<string, string>; // externalId -> roadscopeId
  syncedRoutes: Map<string, string>; // externalId -> roadscopeId
  syncedFiles: Set<string>; // storage paths
}

// Sync progress events
export interface SyncProgressEvent {
  phase: 'validating' | 'surveys' | 'pois' | 'routes' | 'files' | 'complete' | 'error';
  current: number;
  total: number;
  message: string;
  details?: string;
}

// Required scopes for full sync (files:read is NOT required - only upload is needed)
export const REQUIRED_SCOPES = [
  'surveys:read',
  'surveys:write',
  'pois:read',
  'pois:write',
  'routes:write',
  'files:upload'
] as const;

export type RequiredScope = typeof REQUIRED_SCOPES[number];

// API key validation result
export interface APIKeyValidation {
  valid: boolean;
  userId?: string;
  userEmail?: string;
  scopes?: string[];
  missingScopes?: string[];
  expiresAt?: string;
  companies?: AuthCompanyInfo[];
  error?: string;
}

// ===== Collaborative pairing (added 2026-04-10) =====

// Roles a collaborator can hold on a shared survey
export type CollaboratorRole = 'viewer' | 'editor' | 'owner';

// Collaborator entry as returned by RoadScope
export interface RoadScopeCollaborator {
  email: string;
  role: CollaboratorRole;
  addedAt?: string;
}

// Request body for POST /surveys/prepare
export interface PrepareSurveyRequest {
  name: string;
  description?: string;
  externalId?: string; // optional MeasurePRO survey ID for cross-reference
}

// Response from POST /surveys/prepare
export interface PrepareSurveyResponse {
  surveyId: string;       // RoadScope survey id
  pairingCode: string;    // RS-XXXXXX
  expiresAt: string;      // ISO timestamp, typically 7 days out
}

// Response from GET /surveys/pair/:code (no auth — code is the auth)
export interface PairingLookupResponse {
  surveyId: string;
  name: string;
  description?: string;
  createdBy: string;
  collaborators: RoadScopeCollaborator[];
}

// Request body for POST /surveys/:id/collaborators
export interface AddCollaboratorRequest {
  email: string;
  role: CollaboratorRole;
}

// Response from POST /surveys/:id/collaborators
export interface AddCollaboratorResponse {
  surveyId: string;
  email: string;
  role: CollaboratorRole;
  addedAt: string;
}
