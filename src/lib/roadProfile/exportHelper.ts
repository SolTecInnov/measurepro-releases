/**
 * Road Profile Export Helper
 * Integrates road profile exports into survey ZIP
 * 
 * Adds these files to documents/ folder:
 * - road_profile_detail.csv
 * - road_profile_summary.csv  
 * - road_profile_alerts.csv
 * - road_profile.geojson
 * - road_profile_alerts.geojson
 */

import type JSZip from 'jszip';
import type { 
  RoadProfilePoint, 
  RoadProfileSession,
  RoadProfileExportData 
} from './types';
import {
  generateProfileDetailCSV,
  generateProfileSummaryCSV,
  generateProfileAlertsCSV,
  generateProfileGeoJSON,
  generateAlertsGeoJSON
} from './exporters';
import { 
  computeRoadProfileAlertSegments, 
  computeRoadProfileSummarySegments 
} from './alertSegments';
import { getProfileRecordingBuffer } from './recordingBuffer';
import { openSurveyDB } from '../survey/db';
import { 
  convertLegacyProfileToCanonical, 
  convertLegacySamplesToPoints 
} from './legacyAdapter';

/**
 * Add road profile exports to ZIP file
 * Gets data from in-memory buffer (active recording) or IndexedDB (completed surveys)
 */
export async function addRoadProfileExportsToZip(
  zip: JSZip,
  surveyId: string,
  docsFolder: ReturnType<JSZip['folder']>
): Promise<{ success: boolean; profileCount: number; pointCount: number }> {
  try {
    // Try to get from in-memory buffer first (for active surveys)
    const buffer = getProfileRecordingBuffer();
    const session = buffer.getSession();
    let points: RoadProfilePoint[] = [];
    let profileSession: RoadProfileSession | null = null;

    if (session && session.surveyId === surveyId) {
      // Active recording - get from buffer
      points = buffer.getPoints();
      profileSession = session;
    } else {
      // Completed survey - get from IndexedDB
      const profileData = await getProfileDataFromDB(surveyId);
      if (profileData) {
        points = profileData.points;
        profileSession = profileData.session;
      }
    }

    // No profile data - skip but don't fail
    if (points.length === 0) {
      return { success: true, profileCount: 0, pointCount: 0 };
    }

    // Compute derived data
    const alertSegments = computeRoadProfileAlertSegments(points);
    const summarySegments = computeRoadProfileSummarySegments(points);

    // Generate and add exports
    if (docsFolder) {
      // Detail CSV
      docsFolder.file('road_profile_detail.csv', generateProfileDetailCSV(points));
      
      // Summary CSV
      docsFolder.file('road_profile_summary.csv', generateProfileSummaryCSV(summarySegments));
      
      // Alerts CSV
      docsFolder.file('road_profile_alerts.csv', generateProfileAlertsCSV(alertSegments));
      
      // Profile GeoJSON
      docsFolder.file('road_profile.geojson', generateProfileGeoJSON(
        profileSession?.id || surveyId, 
        points
      ));
      
      // Alerts GeoJSON
      docsFolder.file('road_profile_alerts.geojson', generateAlertsGeoJSON(
        alertSegments, 
        points
      ));
    }

    return { 
      success: true, 
      profileCount: 1, 
      pointCount: points.length 
    };
  } catch (error) {
    console.error('[RoadProfile] Export failed:', error);
    return { success: false, profileCount: 0, pointCount: 0 };
  }
}

/**
 * Get road profile data from IndexedDB for completed surveys
 * Uses legacy adapter to normalize old data formats
 */
export async function getProfileDataFromDB(surveyId: string): Promise<{
  session: RoadProfileSession | null;
  points: RoadProfilePoint[];
} | null> {
  try {
    const db = await openSurveyDB();
    
    // Get profile session for this survey
    const profiles = await db.getAllFromIndex('roadProfiles', 'by-survey', surveyId);
    if (profiles.length === 0) {
      return null;
    }

    const profile = profiles[0];
    
    // Check if profile has inline points (legacy format with pre-computed points)
    if (profile.points && profile.points.length > 0) {
      // Use legacy adapter for inline points
      const { session, points } = convertLegacyProfileToCanonical(profile);
      return { session, points };
    }
    
    // Otherwise get samples from roadProfileSamples store
    const samples = await db.getAllFromIndex('roadProfileSamples', 'by-profile', profile.id);
    
    if (samples.length === 0) {
      return null;
    }

    // Convert legacy samples to canonical points
    const points = convertLegacySamplesToPoints(profile.id, samples, {
      grade_up_alert_pct: profile.grade_trigger_pct ?? 12,
      grade_down_alert_pct: -(profile.grade_trigger_pct ?? 12),
      k_factor_alert: 10
    });

    // Build session object using legacy adapter
    const { session } = convertLegacyProfileToCanonical({
      ...profile,
      points: [] // Clear points since we computed them separately
    });
    session.total_samples = samples.length;

    return { session, points };
  } catch (error) {
    console.error('[RoadProfile] Failed to load from DB:', error);
    return null;
  }
}

/**
 * Get export data for a survey (for external use)
 */
export async function getRoadProfileExportData(surveyId: string): Promise<RoadProfileExportData | null> {
  const buffer = getProfileRecordingBuffer();
  const session = buffer.getSession();
  
  let points: RoadProfilePoint[] = [];
  let profileSession: RoadProfileSession | null = null;

  if (session && session.surveyId === surveyId) {
    points = buffer.getPoints();
    profileSession = session;
  } else {
    const data = await getProfileDataFromDB(surveyId);
    if (data) {
      points = data.points;
      profileSession = data.session;
    }
  }

  if (!profileSession || points.length === 0) {
    return null;
  }

  return {
    session: profileSession,
    points,
    alertSegments: computeRoadProfileAlertSegments(points),
    summarySegments: computeRoadProfileSummarySegments(points),
    sections: profileSession.sections
  };
}
