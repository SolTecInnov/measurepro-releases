/**
 * RoadScope Sync Service
 * Handles full and incremental synchronization between MeasurePRO and RoadScope
 */

import piexif from 'piexifjs';
import { openSharedSurveyDB } from '../survey/db.shared';
import { logger } from '../utils/logger';
import { getRoadScopeClient } from './client';
import { isAssetReference, getAssetBlob, isDataURL } from '../storage/assetHelper';
import {
  RoadScopePOI,
  RoadScopeRoute,
  CreateSurveyRequest,
  SyncProgressEvent,
  FileUploadRequest,
  FileRegistration
} from './types';
import type { Survey, Measurement, VehicleTrace, Route } from '../survey/types';

// Batch sizes from API spec
const POI_BATCH_SIZE = 500;
const ROUTE_BATCH_SIZE = 100;
const FILE_BATCH_SIZE = 50;

/**
 * Check if a URL is a storage URL (not a base64 data URL)
 * Only storage URLs should be included in POI payloads - base64 data URLs
 * are too large and will exceed the 11MB API limit
 */
function isStorageUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  // Storage URLs start with http/https, base64 starts with data:
  return url.startsWith('http://') || url.startsWith('https://');
}

/**
 * Get storage URL or undefined (filters out base64 data URLs)
 */
function getStorageUrl(url: string | undefined | null): string | undefined {
  return isStorageUrl(url) ? url! : undefined;
}

// Sync state stored in IndexedDB appSettings
interface SyncStateRecord {
  id: string;
  surveyId: string;
  roadscopeSurveyId?: string;
  lastSyncTime?: string;
  syncedPoiIds: string[];
  syncedRouteIds: string[];
  syncedFileIds: string[];
  poiIdMap: Record<string, string>; // measurepro ID -> roadscope ID
  routeIdMap: Record<string, string>;
}

export type SyncProgressCallback = (event: SyncProgressEvent) => void;

export interface SyncOptions {
  includeFiles?: boolean;
  forceResyncFiles?: boolean; // Force re-upload all files (clears file sync state)
  onProgress?: SyncProgressCallback;
  targetSurveyId?: string; // Existing RoadScope survey ID to link to
}

export interface SyncResult {
  success: boolean;
  surveyId: string;
  roadscopeSurveyId?: string;
  poisSynced: number;
  routesSynced: number;
  filesSynced: number;
  errors: string[];
}

/**
 * Map MeasurePRO POI type to RoadScope POI type
 * RoadScope's 35 types: Photo, Label, DronePhoto, Road, Intersection, Bridge, PowerLine, 
 * Trees, Signalization, Railroad, Structure, WeightLimit, TurnRestriction, RestArea, 
 * FuelStation, WeighStation, Custom, Signpost, OriginPoint, DestinationPoint, Overpass, 
 * Roundabout, TrafficLight, Parking, EmergencyParking, Danger, Information, WorkRequired, 
 * TruckStop, PayToll, Culvert, Wire, OpticalFiber, OverheadStructure, LateralObstruction
 */
function mapPOIType(poiType: string | null | undefined): string {
  if (!poiType) return 'Custom';
  
  const typeMap: Record<string, string> = {
    // Bridge mappings
    'bridge': 'Bridge',
    'pont': 'Bridge',
    // Power line mappings
    'powerline': 'PowerLine',
    'power_line': 'PowerLine',
    'ligne_electrique': 'PowerLine',
    'power': 'PowerLine',
    // Tree mappings
    'tree': 'Trees',
    'trees': 'Trees',
    'arbre': 'Trees',
    // Overpass/structure mappings
    'overpass': 'Overpass',
    'viaduc': 'Overpass',
    'overhead': 'OverheadStructure',
    'overhead_structure': 'OverheadStructure',
    // Road/intersection mappings
    'road': 'Road',
    'intersection': 'Intersection',
    'signpost': 'Signpost',
    'sign': 'Signpost',
    // Other common types
    'photo': 'Photo',
    'camera': 'Photo',
    'danger': 'Danger',
    'warning': 'Danger',
    'culvert': 'Culvert',
    'wire': 'Wire',
    'lateral': 'LateralObstruction',
    'structure': 'Structure',
    'railroad': 'Railroad',
    'rail': 'Railroad',
    'traffic_light': 'TrafficLight',
    'none': 'Custom',
    'custom': 'Custom'
  };
  
  const normalized = poiType.toLowerCase().replace(/\s+/g, '_');
  return typeMap[normalized] || 'Custom';
}

/**
 * Recursively remove undefined values from an object
 * RoadScope's Firestore doesn't accept undefined values
 */
function removeUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefined(item)) as T;
  }
  
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        result[key] = removeUndefined(value);
      }
    }
    return result as T;
  }
  
  return obj;
}

/**
 * Storage URL map for uploaded files
 * Maps measurement ID -> { photos: string[], drawings: string[] }
 */
interface UploadedFileUrls {
  photos: string[];
  drawings: string[];
}

type StorageUrlMap = Map<string, UploadedFileUrls>;

/**
 * Convert MeasurePRO measurement to RoadScope POI format
 * Maps all available fields per RoadScope API spec
 * Uses type assertion for extended fields that may exist at runtime
 * 
 * @param measurement - The measurement to convert
 * @param survey - The survey containing the measurement
 * @param storageUrlMap - Optional map of measurement ID -> uploaded file URLs
 */
function measurementToPOI(
  measurement: Measurement, 
  survey: Survey,
  storageUrlMap?: StorageUrlMap
): RoadScopePOI {
  // Type assertion for extended fields that may exist on measurement
  const m = measurement as Measurement & {
    alertLevel?: string;
    description?: string;
    satellites?: number;
    hdop?: number;
    accuracy?: number;
    privateNote?: string;
    chainage?: number;
    voiceNoteUrl?: string;
    deviceModel?: string;
    appVersion?: string;
  };
  
  // Parse date/time from createdAt
  const createdDate = new Date(m.createdAt);
  const capturedDate = createdDate.toISOString().split('T')[0]; // YYYY-MM-DD
  const capturedTime = createdDate.toTimeString().split(' ')[0]; // HH:mm:ss
  
  // Build alerts array from measurement data
  const alerts: string[] = [];
  if (m.rel !== undefined && m.rel !== null && m.rel < 5.0) {
    alerts.push('Low Clearance');
  }
  
  // Build badges array
  const badges: string[] = [];
  if (m.alertLevel === 'critical' || m.alertLevel === 'danger') {
    badges.push('Danger');
  }
  
  // Build POI object and remove all undefined values (Firestore doesn't accept them)
  const poi: RoadScopePOI = {
    externalId: m.id,
    roadNumber: m.roadNumber ? `R${String(m.roadNumber).padStart(3, '0')}` : undefined,
    poiNumber: m.poiNumber ?? undefined,
    name: m.note || `POI ${m.poiNumber || m.id.substring(0, 8)}`,
    description: m.description ?? undefined,
    type: mapPOIType(m.poi_type),
    coordinates: {
      latitude: m.latitude,
      longitude: m.longitude,
      altitude: m.altGPS || undefined
    },
    measurements: {
      heightClearance: m.rel || undefined,
      widthClearance: m.widthMeasure ?? undefined,
      length: m.lengthMeasure ?? undefined,
      unit: 'meters'
    },
    gpsData: {
      satellites: m.satellites ?? undefined,
      hdop: m.hdop ?? undefined,
      speed: m.speed || undefined,
      course: m.heading || undefined,
      accuracy: m.accuracy ?? undefined
    },
    badges: badges.length > 0 ? badges : undefined,
    alerts: alerts.length > 0 ? alerts : undefined,
    notes: m.note ?? undefined,
    privateNotes: m.privateNote ?? undefined,
    capturedAt: m.createdAt,
    capturedDate,
    capturedTime,
    mileMarker: m.chainage ?? undefined,
    source: 'MeasurePRO',
    // CRITICAL: Use storage URLs from file upload, not base64 data URLs
    // Base64 data URLs are huge and will exceed the 11MB API payload limit
    // Priority: uploaded storage URLs > existing storage URLs in measurement
    photos: (() => {
      // First check if we have uploaded photos from the file upload phase
      const uploadedUrls = storageUrlMap?.get(m.id);
      if (uploadedUrls?.photos.length) {
        return uploadedUrls.photos;
      }
      // Fall back to existing storage URL if present
      const existingUrl = getStorageUrl(m.imageUrl);
      return existingUrl ? [existingUrl] : undefined;
    })(),
    videos: getStorageUrl(m.videoUrl) ? [getStorageUrl(m.videoUrl)!] : undefined,
    videoTime: m.videoTimestamp ?? undefined,
    timelapse: m.timelapseFrameNumber ? [`frame_${m.timelapseFrameNumber}`] : undefined,
    voiceNote: getStorageUrl(m.voiceNoteUrl) ?? null,
    // Use uploaded drawing URL or fall back to existing storage URL
    drawing: (() => {
      const uploadedUrls = storageUrlMap?.get(m.id);
      if (uploadedUrls?.drawings.length) {
        return uploadedUrls.drawings[0];
      }
      return getStorageUrl(m.drawingUrl) ?? null;
    })(),
    metadata: {
      measureproVersion: '2.1.0',
      source: m.source,
      measurementFree: m.measurementFree,
      timelapseFrameNumber: m.timelapseFrameNumber,
      surveyPartOrdinal: survey.partOrdinal || 1,
      deviceModel: m.deviceModel,
      appVersion: m.appVersion,
      inspector: survey.surveyorName
    }
  };
  
  // Clean up undefined values - RoadScope's Firestore doesn't accept them
  return removeUndefined(poi);
}

/**
 * Convert MeasurePRO vehicle traces to RoadScope route format
 */
function vehicleTracesToRoute(
  traces: VehicleTrace[],
  route: Route,
  survey: Survey
): RoadScopeRoute {
  // Sort traces by timestamp
  const sortedTraces = [...traces].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const coordinates = sortedTraces.map(trace => ({
    latitude: trace.latitude,
    longitude: trace.longitude,
    altitude: undefined,
    timestamp: trace.timestamp
  }));

  // Calculate approximate distance
  let distance = 0;
  for (let i = 1; i < coordinates.length; i++) {
    const prev = coordinates[i - 1];
    const curr = coordinates[i];
    distance += haversineDistance(
      prev.latitude, prev.longitude,
      curr.latitude, curr.longitude
    );
  }

  const routeData: RoadScopeRoute = {
    externalId: route.id,
    name: route.name || `Route ${route.routeNumber}`,
    description: `Vehicle trace from survey: ${survey.surveyTitle}`,
    type: 'trace',
    coordinates: removeUndefined(coordinates),
    metadata: {
      routeNumber: route.routeNumber,
      surveyId: survey.id,
      surveyPartOrdinal: survey.partOrdinal || 1
    },
    startTime: sortedTraces[0]?.timestamp,
    endTime: sortedTraces[sortedTraces.length - 1]?.timestamp,
    distance: distance / 1000, // Convert to km
    distanceUnit: 'kilometers'
  };
  
  // Clean up undefined values - RoadScope's Firestore doesn't accept them
  return removeUndefined(routeData);
}

/**
 * Haversine formula for distance calculation
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Get sync state for a survey from IndexedDB
 */
async function getSyncState(surveyId: string): Promise<SyncStateRecord | null> {
  const db = await openSharedSurveyDB();
  const state = await db.get('appSettings', `roadscope_sync_${surveyId}`);
  return state as SyncStateRecord | null;
}

/**
 * Save sync state to IndexedDB
 */
async function saveSyncState(state: SyncStateRecord): Promise<void> {
  const db = await openSharedSurveyDB();
  await db.put('appSettings', {
    ...state,
    id: `roadscope_sync_${state.surveyId}`,
    category: 'roadscope_sync'
  });
}

/**
 * Get measurements for a survey that haven't been synced yet
 */
async function getUnsyncedMeasurements(
  surveyId: string,
  syncedIds: string[]
): Promise<Measurement[]> {
  const db = await openSharedSurveyDB();
  
  logger.debug(`[RoadScope Sync] Looking for measurements with surveyId: ${surveyId}`);
  
  // Query using the 'by-survey' index which is keyed on 'user_id'
  const allMeasurements = await db.getAllFromIndex('measurements', 'by-survey', surveyId);
  
  logger.debug(`[RoadScope Sync] Found ${allMeasurements.length} total measurements for survey`);
  
  // Debug: If no measurements found, check if there are any measurements at all
  if (allMeasurements.length === 0) {
    const allDbMeasurements = await db.getAll('measurements');
    logger.debug(`[RoadScope Sync] Total measurements in DB: ${allDbMeasurements.length}`);
    if (allDbMeasurements.length > 0) {
      const sample = allDbMeasurements[0];
      logger.debug(`[RoadScope Sync] Sample measurement user_id: ${sample.user_id}, surveyId field: ${(sample as any).surveyId}`);
    }
  }
  
  const syncedSet = new Set(syncedIds);
  const unsynced = allMeasurements.filter(m => !syncedSet.has(m.id));
  
  logger.debug(`[RoadScope Sync] Unsynced measurements: ${unsynced.length} (${syncedIds.length} already synced)`);
  
  return unsynced;
}

/**
 * Get all routes and traces for a survey
 */
async function getRoutesAndTraces(surveyId: string): Promise<{
  routes: Route[];
  traces: VehicleTrace[];
}> {
  const db = await openSharedSurveyDB();
  const routes = await db.getAllFromIndex('routes', 'by-survey', surveyId);
  const traces = await db.getAllFromIndex('vehicleTraces', 'by-survey', surveyId);
  
  return { routes, traces };
}

/**
 * Check if a URL has uploadable media (data: URL or asset: reference)
 * Excludes https:// storage URLs (already uploaded) and null/undefined
 */
function hasUploadableMedia(url: string | null | undefined): boolean {
  if (!url) return false;
  return isDataURL(url) || isAssetReference(url);
}

/**
 * Estimate file size for asset references
 * For data: URLs we can calculate exactly, for asset: we estimate based on typical JPEG sizes
 */
function estimateFileSize(url: string): number {
  if (isDataURL(url)) {
    const base64Data = url.split(',')[1];
    return Math.ceil((base64Data.length * 3) / 4);
  }
  // For asset references, estimate ~100KB for photos, ~50KB for drawings
  return 100000;
}

/**
 * Collect media files from measurements
 * CRITICAL: Uses poiExternalId for RoadScope storage path organization
 * Path format: measurepro/{surveyId}/photos/{poiExternalId}/{filename}
 * 
 * Supports both legacy data: URLs and new asset: references
 */
function collectMediaFiles(measurements: Measurement[]): FileUploadRequest[] {
  const files: FileUploadRequest[] = [];

  for (const m of measurements) {
    // Main image - handle both data: and asset: formats
    if (hasUploadableMedia(m.imageUrl)) {
      const contentType = isDataURL(m.imageUrl!) 
        ? (m.imageUrl!.match(/^data:([^;]+);/)?.[1] || 'image/jpeg')
        : 'image/jpeg';
      const size = estimateFileSize(m.imageUrl!);
      
      files.push({
        filename: `photo_001.jpg`,  // Simple filename, path includes poiExternalId
        contentType,
        size,
        category: 'photos',
        poiExternalId: m.id  // CRITICAL: Used for storage path and auto-linking
      });
    }

    // Additional images - handle both data: and asset: formats
    if (m.images?.length) {
      m.images.forEach((img, idx) => {
        if (hasUploadableMedia(img)) {
          const contentType = isDataURL(img) 
            ? (img.match(/^data:([^;]+);/)?.[1] || 'image/jpeg')
            : 'image/jpeg';
          const size = estimateFileSize(img);
          
          files.push({
            filename: `photo_${String(idx + 2).padStart(3, '0')}.jpg`,  // photo_002, photo_003, etc.
            contentType,
            size,
            category: 'photos',
            poiExternalId: m.id  // CRITICAL: Used for storage path and auto-linking
          });
        }
      });
    }

    // Drawing - handle both data: and asset: formats
    if (hasUploadableMedia(m.drawingUrl)) {
      const contentType = isDataURL(m.drawingUrl!) 
        ? (m.drawingUrl!.match(/^data:([^;]+);/)?.[1] || 'image/png')
        : 'image/png';
      const size = estimateFileSize(m.drawingUrl!);
      
      files.push({
        filename: `drawing_001.png`,
        contentType,
        size,
        category: 'drawings',
        poiExternalId: m.id  // CRITICAL: Used for storage path and auto-linking
      });
    }
  }

  return files;
}

/**
 * Convert decimal degrees to DMS format for EXIF
 */
function decimalToDMS(decimal: number): [number, number, number] {
  const absolute = Math.abs(decimal);
  const degrees = Math.floor(absolute);
  const minutesDecimal = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesDecimal);
  const seconds = (minutesDecimal - minutes) * 60;
  return [degrees, minutes, seconds];
}

/**
 * Check if a JPEG data URL already has GPS EXIF data
 */
function hasGpsExif(dataURL: string): boolean {
  try {
    const exifData = piexif.load(dataURL);
    const gps = exifData['GPS'];
    return !!(gps && gps[piexif.GPSIFD.GPSLatitude] && gps[piexif.GPSIFD.GPSLongitude]);
  } catch {
    return false;
  }
}

/**
 * Inject GPS EXIF data into a JPEG data URL if missing
 * This ensures photos remain georeferenced when exported/synced
 */
function injectGpsExifIfMissing(
  dataURL: string, 
  latitude: number | undefined, 
  longitude: number | undefined,
  altitude?: number
): string {
  // Only process JPEG images with valid GPS coordinates
  if (!dataURL.startsWith('data:image/jpeg') || 
      latitude === undefined || longitude === undefined ||
      (latitude === 0 && longitude === 0)) {
    return dataURL;
  }

  // Check if GPS EXIF already exists
  if (hasGpsExif(dataURL)) {
    return dataURL;
  }

  try {
    logger.debug(`[RoadScope Sync] Injecting GPS EXIF: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
    
    const zeroth: Record<number, string> = {};
    const gps: Record<number, unknown> = {};

    zeroth[piexif.ImageIFD.Make] = 'MeasurePRO';
    zeroth[piexif.ImageIFD.Software] = 'MeasurePRO GPS Sync';

    const latDMS = decimalToDMS(latitude);
    const lonDMS = decimalToDMS(longitude);

    gps[piexif.GPSIFD.GPSLatitudeRef] = latitude >= 0 ? 'N' : 'S';
    gps[piexif.GPSIFD.GPSLatitude] = [
      [latDMS[0], 1],
      [Math.floor(latDMS[1] * 100), 100],
      [Math.floor(latDMS[2] * 10000), 10000]
    ];

    gps[piexif.GPSIFD.GPSLongitudeRef] = longitude >= 0 ? 'E' : 'W';
    gps[piexif.GPSIFD.GPSLongitude] = [
      [lonDMS[0], 1],
      [Math.floor(lonDMS[1] * 100), 100],
      [Math.floor(lonDMS[2] * 10000), 10000]
    ];

    if (altitude !== undefined) {
      gps[piexif.GPSIFD.GPSAltitude] = [Math.floor(Math.abs(altitude) * 100), 100];
      gps[piexif.GPSIFD.GPSAltitudeRef] = altitude >= 0 ? 0 : 1;
    }

    const exifObj = { '0th': zeroth, 'GPS': gps };
    const exifBytes = piexif.dump(exifObj);
    return piexif.insert(exifBytes, dataURL);
  } catch (error) {
    console.warn('[RoadScope Sync] Failed to inject GPS EXIF:', error);
    return dataURL;
  }
}

/**
 * Convert base64 data URL to Blob
 */
function dataURLToBlob(dataURL: string): Blob {
  const parts = dataURL.split(',');
  const match = parts[0].match(/:(.*?);/);
  const contentType = match?.[1] || 'application/octet-stream';
  const base64 = parts[1];
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: contentType });
}

/**
 * Main sync function - performs full or incremental sync
 */
export async function syncSurveyToRoadScope(
  survey: Survey,
  options: SyncOptions = {}
): Promise<SyncResult> {
  const client = getRoadScopeClient();
  const errors: string[] = [];
  const { onProgress, targetSurveyId, includeFiles = true, forceResyncFiles = false } = options;

  const progress = (event: Partial<SyncProgressEvent>) => {
    onProgress?.({
      phase: 'validating',
      current: 0,
      total: 0,
      message: '',
      ...event
    } as SyncProgressEvent);
  };

  // Phase 1: Validate API key
  progress({ phase: 'validating', message: 'Validating API key...', current: 0, total: 1 });
  
  const validation = await client.validateApiKey();
  if (!validation.valid) {
    return {
      success: false,
      surveyId: survey.id,
      poisSynced: 0,
      routesSynced: 0,
      filesSynced: 0,
      errors: [validation.error || 'API key validation failed']
    };
  }

  if (validation.missingScopes?.length) {
    return {
      success: false,
      surveyId: survey.id,
      poisSynced: 0,
      routesSynced: 0,
      filesSynced: 0,
      errors: [`Missing required scopes: ${validation.missingScopes.join(', ')}`]
    };
  }

  // Get existing sync state
  let syncState = await getSyncState(survey.id);
  if (!syncState) {
    syncState = {
      id: `roadscope_sync_${survey.id}`,
      surveyId: survey.id,
      syncedPoiIds: [],
      syncedRouteIds: [],
      syncedFileIds: [],
      poiIdMap: {},
      routeIdMap: {}
    };
  }

  // If forceResyncFiles is set, clear file sync state to re-upload all files
  if (forceResyncFiles && syncState.syncedFileIds.length > 0) {
    logger.debug(`[RoadScope Sync] Force re-sync files enabled - clearing ${syncState.syncedFileIds.length} synced file IDs`);
    syncState.syncedFileIds = [];
    await saveSyncState(syncState);
  }

  // Phase 2: Create/link survey
  progress({ phase: 'surveys', message: 'Syncing survey...', current: 0, total: 1 });

  let roadscopeSurveyId = targetSurveyId || syncState.roadscopeSurveyId;

  if (!roadscopeSurveyId) {
    // Create new survey in RoadScope
    const surveyRequest: CreateSurveyRequest = {
      externalId: survey.id,
      name: survey.surveyTitle,
      description: survey.description || undefined,
      client: survey.clientName || undefined,
      projectNumber: survey.projectNumber || undefined,
      status: survey.closedAt ? 'completed' : 'active',
      startDate: survey.createdAt.split('T')[0],
      endDate: survey.closedAt?.split('T')[0],
      metadata: {
        measureproVersion: '2.1.0',
        operator: survey.surveyorName,
        ownerEmail: survey.ownerEmail
      }
    };

    const surveyResult = await client.upsertSurvey(surveyRequest);
    
    if (!surveyResult.success || !surveyResult.data) {
      return {
        success: false,
        surveyId: survey.id,
        poisSynced: 0,
        routesSynced: 0,
        filesSynced: 0,
        errors: [surveyResult.error || 'Failed to create survey']
      };
    }

    roadscopeSurveyId = surveyResult.data.id;
    syncState.roadscopeSurveyId = roadscopeSurveyId;
  }

  progress({ phase: 'surveys', message: 'Survey synced', current: 1, total: 1 });

  // ============================================================
  // PHASE 3: Upload Files FIRST (before POIs)
  // This ensures we have storage URLs to include in POI records
  // ============================================================
  const storageUrlMap: StorageUrlMap = new Map();
  let filesSynced = 0;

  if (includeFiles) {
    // Get ALL measurements for the survey (not just unsynced ones)
    // This ensures files are synced even if POIs were synced in a previous attempt
    const db = await openSharedSurveyDB();
    const allMeasurements = await db.getAllFromIndex('measurements', 'by-survey', survey.id);
    
    logger.debug(`[RoadScope Sync] Phase 3: Checking files for ${allMeasurements.length} total measurements`);
    
    const measurementsWithMedia = allMeasurements.filter(
      m => m.imageUrl || m.images?.length || m.drawingUrl
    );
    
    logger.debug(`[RoadScope Sync] Found ${measurementsWithMedia.length} measurements with media`);
    
    const allFiles = collectMediaFiles(measurementsWithMedia);
    
    // Use per-measurement file keys to avoid collisions: {poiExternalId}/{filename}
    const getFileKey = (poiId: string, filename: string) => `${poiId}/${filename}`;
    
    // Pre-populate storageUrlMap with already-synced files
    // This ensures POIs get storage URLs even on repeat syncs
    for (const fileInfo of allFiles) {
      const fileKey = getFileKey(fileInfo.poiExternalId, fileInfo.filename);
      if (syncState.syncedFileIds.includes(fileKey)) {
        // Reconstruct storage URL from known path pattern
        const storagePath = `measurepro/${roadscopeSurveyId}/${fileInfo.category}/${fileInfo.poiExternalId}/${fileInfo.filename}`;
        const fullStorageUrl = `https://storage.googleapis.com/os-hub-db.firebasestorage.app/${storagePath}`;
        
        if (!storageUrlMap.has(fileInfo.poiExternalId)) {
          storageUrlMap.set(fileInfo.poiExternalId, { photos: [], drawings: [] });
        }
        const urlEntry = storageUrlMap.get(fileInfo.poiExternalId)!;
        
        if (fileInfo.category === 'drawings') {
          urlEntry.drawings.push(fullStorageUrl);
        } else {
          urlEntry.photos.push(fullStorageUrl);
        }
        
        logger.debug(`[RoadScope Sync] Restored storage URL for ${fileKey}: ${fullStorageUrl}`);
      }
    }
    
    logger.debug(`[RoadScope Sync] Pre-populated ${storageUrlMap.size} entries from previously synced files`);
    
    const unsyncedFiles = allFiles.filter(f => !syncState.syncedFileIds.includes(getFileKey(f.poiExternalId, f.filename)));
    
    logger.debug(`[RoadScope Sync] ${unsyncedFiles.length} files need syncing (${syncState.syncedFileIds.length} already synced)`);

    if (unsyncedFiles.length > 0) {
      const totalFileBatches = Math.ceil(unsyncedFiles.length / FILE_BATCH_SIZE);

      for (let i = 0; i < unsyncedFiles.length; i += FILE_BATCH_SIZE) {
        const batch = unsyncedFiles.slice(i, i + FILE_BATCH_SIZE);
        const batchNum = Math.floor(i / FILE_BATCH_SIZE) + 1;

        progress({
          phase: 'files',
          message: `Uploading files (batch ${batchNum}/${totalFileBatches})...`,
          current: batchNum,
          total: totalFileBatches,
          details: `${batch.length} files`
        });

        // Get upload URLs
        const urlsResult = await client.getUploadUrls(roadscopeSurveyId, { files: batch });
        
        if (!urlsResult.success || !urlsResult.data) {
          errors.push(`Failed to get upload URLs: ${urlsResult.error}`);
          continue;
        }

        // Handle different response formats from RoadScope API
        const uploadUrls = urlsResult.data.uploads || urlsResult.data.uploadUrls || urlsResult.data.urls || [];
        
        logger.debug('[RoadScope Sync] Upload URLs response:', JSON.stringify(urlsResult.data).substring(0, 500));
        logger.debug('[RoadScope Sync] Found', uploadUrls.length, 'upload URLs');
        
        if (!Array.isArray(uploadUrls) || uploadUrls.length === 0) {
          logger.debug('[RoadScope Sync] No upload URLs returned, skipping file upload');
          continue;
        }

        const uploadedFiles: FileRegistration[] = [];

        // Build a map from original batch files to measurements for matching
        const fileToMeasurement = new Map<string, { measurement: Measurement; fileRequest: FileUploadRequest }>();
        for (const fileReq of batch) {
          const measurement = measurementsWithMedia.find(m => m.id === fileReq.poiExternalId);
          if (measurement) {
            fileToMeasurement.set(fileReq.filename, { measurement, fileRequest: fileReq });
          }
        }

        // Upload files in PARALLEL
        const uploadPromise = async (urlInfo: { filename: string; uploadUrl: string; storagePath: string }): Promise<FileRegistration | null> => {
          const filenameOnly = urlInfo.filename.split('/').pop() || urlInfo.filename;
          
          let matchedData = fileToMeasurement.get(filenameOnly);
          
          if (!matchedData) {
            for (const [, data] of fileToMeasurement) {
              if (urlInfo.storagePath.includes(data.measurement.id)) {
                matchedData = data;
                break;
              }
            }
          }
          
          if (!matchedData) {
            logger.debug(`[RoadScope Sync] Could not match file: ${urlInfo.filename}`);
            return null;
          }
          
          const { measurement, fileRequest } = matchedData;

          let mediaUrl: string | undefined;
          
          if (fileRequest.category === 'drawings') {
            mediaUrl = measurement.drawingUrl ?? undefined;
          } else if (fileRequest.filename.includes('photo_001')) {
            mediaUrl = measurement.imageUrl ?? undefined;
          } else {
            const photoNumMatch = fileRequest.filename.match(/photo_(\d+)/);
            if (photoNumMatch) {
              const idx = parseInt(photoNumMatch[1]) - 2;
              mediaUrl = idx >= 0 ? measurement.images?.[idx] : measurement.imageUrl ?? undefined;
            } else {
              mediaUrl = measurement.imageUrl ?? undefined;
            }
          }

          if (!mediaUrl || (!isDataURL(mediaUrl) && !isAssetReference(mediaUrl))) {
            logger.debug(`[RoadScope Sync] Skipping ${filenameOnly}: no uploadable media URL`);
            return null;
          }

          try {
            let blob: Blob;
            
            if (isAssetReference(mediaUrl)) {
              const assetBlob = await getAssetBlob(mediaUrl);
              if (!assetBlob) {
                logger.debug(`[RoadScope Sync] Could not resolve asset: ${mediaUrl}`);
                return null;
              }
              blob = assetBlob;
              logger.debug(`[RoadScope Sync] Resolved asset reference to blob: ${blob.size} bytes`);
            } else {
              const gpsEnrichedDataUrl = injectGpsExifIfMissing(
                mediaUrl, 
                measurement.latitude, 
                measurement.longitude,
                measurement.altGPS ?? undefined
              );
              blob = dataURLToBlob(gpsEnrichedDataUrl);
            }
            
            const uploadResult = await client.uploadFile(urlInfo.uploadUrl, blob, blob.type);
            
            if (uploadResult.success) {
              // Build the full storage URL from the storage path
              // RoadScope returns storagePath like: measurepro/{surveyId}/photos/{poiExternalId}/{filename}
              // The full URL will be: https://storage.googleapis.com/os-hub-db.firebasestorage.app/{storagePath}
              const fullStorageUrl = `https://storage.googleapis.com/os-hub-db.firebasestorage.app/${urlInfo.storagePath}`;
              
              // Add to storage URL map for use in POI sync
              const measurementId = measurement.id;
              if (!storageUrlMap.has(measurementId)) {
                storageUrlMap.set(measurementId, { photos: [], drawings: [] });
              }
              const urlEntry = storageUrlMap.get(measurementId)!;
              
              if (fileRequest.category === 'drawings') {
                urlEntry.drawings.push(fullStorageUrl);
              } else {
                urlEntry.photos.push(fullStorageUrl);
              }
              
              logger.debug(`[RoadScope Sync] Added storage URL for ${measurementId}: ${fullStorageUrl}`);
              
              return {
                filename: filenameOnly,
                storageUrl: urlInfo.storagePath,
                category: fileRequest.category,
                contentType: blob.type,
                size: blob.size,
                linkedPoiExternalId: measurement.id,
                // Store poiExternalId for per-measurement file key tracking
                _poiExternalId: measurement.id,
                metadata: {
                  captureTime: measurement.createdAt,
                  caption: measurement.note || undefined
                }
              } as FileRegistration & { _poiExternalId: string };
            } else {
              errors.push(`Upload ${urlInfo.filename}: ${uploadResult.error}`);
              return null;
            }
          } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err);
            errors.push(`Upload ${urlInfo.filename}: ${errMsg}`);
            return null;
          }
        };

        // Execute uploads in parallel (max 5 concurrent)
        const PARALLEL_UPLOADS = 5;
        for (let j = 0; j < uploadUrls.length; j += PARALLEL_UPLOADS) {
          const urlBatch = uploadUrls.slice(j, j + PARALLEL_UPLOADS);
          const results = await Promise.all(urlBatch.map(uploadPromise));
          for (const r of results) {
            if (r) uploadedFiles.push(r);
          }
        }
        logger.debug(`[RoadScope Sync] Parallel upload complete: ${uploadedFiles.length}/${uploadUrls.length} successful`);

        // Register uploaded files with RoadScope
        if (uploadedFiles.length > 0) {
          logger.debug(`[RoadScope Sync] Registering ${uploadedFiles.length} files with RoadScope...`);
          
          const registerResult = await client.registerFiles(roadscopeSurveyId, {
            files: uploadedFiles
          });
          
          if (registerResult.success) {
            const responseData = registerResult.data as Record<string, unknown> | undefined;
            const registeredCount = typeof responseData?.registered === 'number' 
              ? responseData.registered 
              : uploadedFiles.length;
            filesSynced += registeredCount;
            // Use per-measurement file keys to avoid collisions
            uploadedFiles.forEach(f => {
              const fileWithPoi = f as FileRegistration & { _poiExternalId?: string };
              const poiId = fileWithPoi._poiExternalId || fileWithPoi.linkedPoiExternalId || '';
              const fileKey = `${poiId}/${f.filename}`;
              syncState.syncedFileIds.push(fileKey);
            });
            logger.debug(`[RoadScope Sync] Registered ${registeredCount} files successfully`);
          } else {
            errors.push(`Register files: ${registerResult.error}`);
          }
        }

        await saveSyncState(syncState);
      }
    }
    
    logger.debug(`[RoadScope Sync] File upload phase complete. Storage URL map has ${storageUrlMap.size} entries`);
  }

  // ============================================================
  // PHASE 4: Sync POIs (with storage URLs from file upload)
  // ============================================================
  const unsyncedMeasurements = await getUnsyncedMeasurements(
    survey.id,
    syncState.syncedPoiIds
  );

  let poisSynced = 0;
  const totalPoiBatches = Math.ceil(unsyncedMeasurements.length / POI_BATCH_SIZE);

  for (let i = 0; i < unsyncedMeasurements.length; i += POI_BATCH_SIZE) {
    const batch = unsyncedMeasurements.slice(i, i + POI_BATCH_SIZE);
    const batchNum = Math.floor(i / POI_BATCH_SIZE) + 1;
    
    progress({
      phase: 'pois',
      message: `Syncing POIs (batch ${batchNum}/${totalPoiBatches})...`,
      current: batchNum,
      total: totalPoiBatches,
      details: `${batch.length} POIs in this batch`
    });

    // Pass storage URL map so POIs get the uploaded file URLs
    const pois: RoadScopePOI[] = batch.map(m => measurementToPOI(m, survey, storageUrlMap));
    
    // Debug: Log first POI to verify storage URLs are included
    if (pois.length > 0) {
      const firstPoi = pois[0];
      logger.debug('[RoadScope Sync] First POI sample:', JSON.stringify(firstPoi).substring(0, 500));
      logger.debug('[RoadScope Sync] First POI photos:', firstPoi.photos);
      logger.debug('[RoadScope Sync] First POI drawing:', firstPoi.drawing);
      
      // Double-check for undefined values
      const hasUndefined = JSON.stringify(firstPoi).includes('undefined');
      logger.debug('[RoadScope Sync] Contains undefined in JSON:', hasUndefined);
    }
    
    const result = await client.batchUpsertPOIs(roadscopeSurveyId, {
      mode: 'upsert',
      pois
    });

    if (result.success && result.data) {
      for (const r of result.data.results) {
        if (r.status === 'created' || r.status === 'updated') {
          syncState.syncedPoiIds.push(r.externalId);
          syncState.poiIdMap[r.externalId] = r.id;
          poisSynced++;
        } else if (r.status === 'error') {
          errors.push(`POI ${r.externalId}: ${r.error}`);
        }
      }
    } else {
      errors.push(`POI batch ${batchNum}: ${result.error}`);
    }

    // Save progress
    await saveSyncState(syncState);
  }

  // Phase 4: Sync Routes/Traces
  const { routes, traces } = await getRoutesAndTraces(survey.id);
  const unsyncedRoutes = routes.filter(r => !syncState.syncedRouteIds.includes(r.id));
  
  let routesSynced = 0;

  if (unsyncedRoutes.length > 0 && traces.length > 0) {
    const totalRouteBatches = Math.ceil(unsyncedRoutes.length / ROUTE_BATCH_SIZE);
    
    for (let i = 0; i < unsyncedRoutes.length; i += ROUTE_BATCH_SIZE) {
      const batch = unsyncedRoutes.slice(i, i + ROUTE_BATCH_SIZE);
      const batchNum = Math.floor(i / ROUTE_BATCH_SIZE) + 1;
      
      progress({
        phase: 'routes',
        message: `Syncing routes (batch ${batchNum}/${totalRouteBatches})...`,
        current: batchNum,
        total: totalRouteBatches
      });

      const routeRequests: RoadScopeRoute[] = batch.map(route => {
        const routeTraces = traces.filter(t => t.routeId === route.id);
        return vehicleTracesToRoute(routeTraces, route, survey);
      });

      const result = await client.batchUpsertRoutes(roadscopeSurveyId, {
        mode: 'upsert',
        routes: routeRequests
      });

      if (result.success && result.data) {
        for (const r of result.data.results) {
          if (r.status === 'created' || r.status === 'updated') {
            syncState.syncedRouteIds.push(r.externalId);
            syncState.routeIdMap[r.externalId] = r.id;
            routesSynced++;
          } else if (r.status === 'error') {
            errors.push(`Route ${r.externalId}: ${r.error}`);
          }
        }
      } else {
        errors.push(`Route batch ${batchNum}: ${result.error}`);
      }

      await saveSyncState(syncState);
    }
  }

  // ============================================================
  // PHASE 6: Final Save
  // ============================================================
  syncState.lastSyncTime = new Date().toISOString();
  await saveSyncState(syncState);

  progress({
    phase: 'complete',
    message: 'Sync complete',
    current: 1,
    total: 1,
    details: `${poisSynced} POIs, ${routesSynced} routes, ${filesSynced} files`
  });

  return {
    success: errors.length === 0,
    surveyId: survey.id,
    roadscopeSurveyId,
    poisSynced,
    routesSynced,
    filesSynced,
    errors
  };
}

/**
 * Clear sync state for a survey (useful for re-syncing)
 */
export async function clearSyncState(surveyId: string): Promise<void> {
  const db = await openSharedSurveyDB();
  await db.delete('appSettings', `roadscope_sync_${surveyId}`);
}

/**
 * Clear ONLY file sync state for a survey (keeps POI/route sync intact)
 * Use this when files are marked as synced locally but missing from RoadScope
 */
export async function clearFileSyncState(surveyId: string): Promise<number> {
  const syncState = await getSyncState(surveyId);
  
  if (!syncState) {
    logger.debug('[RoadScope Sync] No sync state found for survey');
    return 0;
  }
  
  const clearedCount = syncState.syncedFileIds.length;
  
  if (clearedCount > 0) {
    logger.debug(`[RoadScope Sync] Clearing ${clearedCount} synced file IDs for survey ${surveyId}`);
    syncState.syncedFileIds = [];
    await saveSyncState(syncState);
  }
  
  return clearedCount;
}

/**
 * Validate local file sync state against RoadScope
 * Resets sync flags for files that are marked synced locally but missing from RoadScope
 */
export async function validateFileSyncState(
  surveyId: string,
  roadscopeSurveyId: string
): Promise<{ validated: number; reset: number }> {
  const client = getRoadScopeClient();
  const syncState = await getSyncState(surveyId);
  
  if (!syncState || syncState.syncedFileIds.length === 0) {
    return { validated: 0, reset: 0 };
  }
  
  try {
    // Get files that RoadScope actually has
    const response = await client.getSurveyFiles(roadscopeSurveyId);
    
    if (!response.success || !response.data) {
      console.warn('[RoadScope Sync] Could not fetch files from RoadScope:', response.error);
      return { validated: 0, reset: 0 };
    }
    
    const roadscopeFiles = response.data.files || [];
    const roadscopeFilenames = new Set(roadscopeFiles.map((f: any) => f.filename));
    
    logger.debug(`[RoadScope Sync] Validating ${syncState.syncedFileIds.length} local synced files against ${roadscopeFilenames.size} RoadScope files`);
    
    // Find files marked synced locally but missing from RoadScope
    const missingFiles = syncState.syncedFileIds.filter(f => !roadscopeFilenames.has(f));
    
    if (missingFiles.length > 0) {
      console.warn(`[RoadScope Sync] Found ${missingFiles.length} files marked synced locally but missing from RoadScope`);
      
      // Remove missing files from synced list
      syncState.syncedFileIds = syncState.syncedFileIds.filter(f => roadscopeFilenames.has(f));
      await saveSyncState(syncState);
      
      return {
        validated: syncState.syncedFileIds.length,
        reset: missingFiles.length
      };
    }
    
    return {
      validated: syncState.syncedFileIds.length,
      reset: 0
    };
    
  } catch (error) {
    console.warn('[RoadScope Sync] Error validating sync state:', error);
    return { validated: 0, reset: 0 };
  }
}

/**
 * Get sync status for a survey
 */
export async function getSyncStatus(surveyId: string): Promise<{
  synced: boolean;
  roadscopeSurveyId?: string;
  lastSyncTime?: string;
  syncedPoiCount: number;
  syncedRouteCount: number;
  syncedFileCount: number;
}> {
  const state = await getSyncState(surveyId);
  
  if (!state) {
    return {
      synced: false,
      syncedPoiCount: 0,
      syncedRouteCount: 0,
      syncedFileCount: 0
    };
  }

  return {
    synced: !!state.roadscopeSurveyId,
    roadscopeSurveyId: state.roadscopeSurveyId,
    lastSyncTime: state.lastSyncTime,
    syncedPoiCount: state.syncedPoiIds.length,
    syncedRouteCount: state.syncedRouteIds.length,
    syncedFileCount: state.syncedFileIds.length
  };
}
