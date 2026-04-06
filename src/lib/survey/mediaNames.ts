/**
 * Media Naming Utilities for Collision-Proof File Names
 * 
 * Generates globally unique file names for POI media (images, videos, drawings)
 * that work across multiple survey parts without conflicts.
 * 
 * Format: {surveyId8}_{partN}_{poiUID8}_{type}_{timestamp}.{ext}
 * Example: a1b2c3d4_p1_e5f6g7h8_bridge_1732123456.jpg
 */

import { Survey, Measurement } from './types';
import { DEFAULT_AUTO_PART_THRESHOLD } from './constants';

export interface MediaNameParams {
  surveyId: string;
  poiId: string;            // The measurement.id (UUID)
  poiType?: string | null;
  partOrdinal?: number;
  mediaType: 'image' | 'video' | 'drawing' | 'timelapse';
  extension?: string;
  index?: number;           // For multiple images per POI
}

/**
 * Generates a collision-proof filename for POI media
 * Uses first 8 chars of UUIDs for readability while maintaining uniqueness
 */
export function generateMediaFilename(params: MediaNameParams): string {
  const {
    surveyId,
    poiId,
    poiType,
    partOrdinal = 1,
    mediaType,
    extension,
    index
  } = params;
  
  // Use first 8 characters of UUIDs for readable but unique names
  const surveyShort = surveyId.replace(/-/g, '').substring(0, 8);
  const poiShort = poiId.replace(/-/g, '').substring(0, 8);
  
  // Sanitize POI type (remove special chars, lowercase)
  const typeClean = (poiType || 'poi').toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
  
  // Timestamp for additional uniqueness
  const timestamp = Date.now();
  
  // Determine file extension
  let ext: string;
  switch (mediaType) {
    case 'image':
      ext = extension || 'jpg';
      break;
    case 'video':
      ext = extension || 'webm';
      break;
    case 'drawing':
      ext = extension || 'png';
      break;
    case 'timelapse':
      ext = extension || 'mp4';
      break;
    default:
      ext = extension || 'bin';
  }
  
  // Build filename
  const parts = [
    surveyShort,
    `p${partOrdinal}`,
    poiShort,
    typeClean,
    timestamp.toString()
  ];
  
  // Add index for multiple images
  if (index !== undefined && index > 0) {
    parts.push(`i${index}`);
  }
  
  return `${parts.join('_')}.${ext}`;
}

/**
 * Generate all media filenames for a measurement/POI
 */
export function generatePOIMediaFilenames(
  survey: Survey,
  measurement: Measurement
): {
  image: string | null;
  video: string | null;
  drawing: string | null;
  images: string[];
} {
  const baseParams = {
    surveyId: survey.id,
    poiId: measurement.id,
    poiType: measurement.poi_type,
    partOrdinal: survey.partOrdinal || 1
  };
  
  return {
    image: measurement.imageUrl ? generateMediaFilename({
      ...baseParams,
      mediaType: 'image'
    }) : null,
    
    video: measurement.videoUrl ? generateMediaFilename({
      ...baseParams,
      mediaType: 'video'
    }) : null,
    
    drawing: measurement.drawingUrl ? generateMediaFilename({
      ...baseParams,
      mediaType: 'drawing'
    }) : null,
    
    images: (measurement.images || []).map((_, index) => 
      generateMediaFilename({
        ...baseParams,
        mediaType: 'image',
        index
      })
    )
  };
}

/**
 * Parse a media filename back to its components
 */
export function parseMediaFilename(filename: string): {
  surveyIdShort: string;
  partOrdinal: number;
  poiIdShort: string;
  poiType: string;
  timestamp: number;
  index?: number;
  extension: string;
} | null {
  // Remove extension
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return null;
  
  const extension = filename.substring(lastDot + 1);
  const name = filename.substring(0, lastDot);
  
  // Split by underscore
  const parts = name.split('_');
  if (parts.length < 5) return null;
  
  const surveyIdShort = parts[0];
  const partMatch = parts[1].match(/^p(\d+)$/);
  if (!partMatch) return null;
  const partOrdinal = parseInt(partMatch[1], 10);
  
  const poiIdShort = parts[2];
  const poiType = parts[3];
  const timestamp = parseInt(parts[4], 10);
  
  let index: number | undefined;
  if (parts.length > 5) {
    const indexMatch = parts[5].match(/^i(\d+)$/);
    if (indexMatch) {
      index = parseInt(indexMatch[1], 10);
    }
  }
  
  return {
    surveyIdShort,
    partOrdinal,
    poiIdShort,
    poiType,
    timestamp,
    index,
    extension
  };
}

/**
 * Generate timelapse segment filename
 */
export function generateTimelapseFilename(
  surveyId: string,
  partOrdinal: number,
  segmentIndex?: number
): string {
  const surveyShort = surveyId.replace(/-/g, '').substring(0, 8);
  const timestamp = Date.now();
  
  const parts = [
    'timelapse',
    surveyShort,
    `p${partOrdinal}`
  ];
  
  if (segmentIndex !== undefined) {
    parts.push(`seg${segmentIndex}`);
  }
  
  parts.push(timestamp.toString());
  
  return `${parts.join('_')}.mp4`;
}

/**
 * Generate a POI manifest entry for export
 * Maps the POI ID to all associated media files
 */
export interface POIManifestEntry {
  poiId: string;               // Full UUID
  surveyId: string;            // Full UUID
  partOrdinal: number;
  legacyRoadNumber: number | null;   // Old sequential number (for backward compat)
  legacyPoiNumber: number | null;    // Old sequential number (for backward compat)
  poiType: string | null;
  createdAt: string;
  coordinates: {
    latitude: number;
    longitude: number;
    altitude: number;
  };
  mediaFiles: {
    image?: string;
    video?: string;
    drawing?: string;
    images?: string[];
  };
  measurement: {
    height: number;
    width?: number;
    length?: number;
  };
}

/**
 * Create a manifest entry for a POI
 */
export function createPOIManifestEntry(
  survey: Survey,
  measurement: Measurement
): POIManifestEntry {
  const mediaFiles = generatePOIMediaFilenames(survey, measurement);
  
  return {
    poiId: measurement.id,
    surveyId: survey.id,
    partOrdinal: survey.partOrdinal || 1,
    legacyRoadNumber: measurement.roadNumber,
    legacyPoiNumber: measurement.poiNumber,
    poiType: measurement.poi_type || null,
    createdAt: measurement.createdAt,
    coordinates: {
      latitude: measurement.latitude,
      longitude: measurement.longitude,
      altitude: measurement.altGPS
    },
    mediaFiles: {
      image: mediaFiles.image || undefined,
      video: mediaFiles.video || undefined,
      drawing: mediaFiles.drawing || undefined,
      images: mediaFiles.images.length > 0 ? mediaFiles.images : undefined
    },
    measurement: {
      height: measurement.rel,
      width: measurement.widthMeasure || undefined,
      length: measurement.lengthMeasure || undefined
    }
  };
}

/**
 * Constants for survey part management.
 * Uses DEFAULT_AUTO_PART_THRESHOLD as the single source of truth.
 */
export const SURVEY_PART_CONSTANTS = {
  MAX_POI_PER_PART: DEFAULT_AUTO_PART_THRESHOLD,
  WARNING_THRESHOLD: DEFAULT_AUTO_PART_THRESHOLD - 50,
  TIMELAPSE_FRAMES_PER_SEGMENT: DEFAULT_AUTO_PART_THRESHOLD
};
