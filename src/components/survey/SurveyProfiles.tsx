/**
 * Survey Profiles Component
 * Lists all road profiles associated with a survey
 * Provides actions: View Details, Export, Continue Recording
 * STAGE 2: Legacy record handling with UI warnings
 */

import React, { useEffect, useState } from 'react';
import { Survey } from '../../lib/survey/types';
import { openSurveyDB } from '../../lib/survey/db';
import { Download, Eye, TrendingUp, TrendingDown, AlertTriangle, MapPin, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { useLocation } from 'wouter';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { isStrictRoadProfile, type RoadProfileRead } from '@/lib/gnss/types';
import { isPhantomProfile, getProfileDisplayLabel } from '@/lib/roadProfile/profileUtils';

interface SurveyProfilesProps {
  activeSurvey: Survey;
}

const SurveyProfiles: React.FC<SurveyProfilesProps> = ({ activeSurvey }) => {
  const [profiles, setProfiles] = useState<RoadProfileRead[]>([]);
  const [legacyCount, setLegacyCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    loadProfiles();
  }, [activeSurvey.id]);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      const db = await openSurveyDB();
      
      // Get all profiles from IndexedDB for this survey
      const rawProfiles = await db.getAllFromIndex('roadProfiles', 'by-survey', activeSurvey.id);
      
      // Silently delete phantom profiles
      const phantoms = rawProfiles.filter((p: any) => isPhantomProfile(p));
      for (const phantom of phantoms) {
        db.delete('roadProfiles', phantom.id).catch(() => {});
      }
      
      const allProfiles = rawProfiles.filter((p: any) => !isPhantomProfile(p));
      
      // STAGE 2: Count legacy profiles (missing required IDs)
      const legacy = allProfiles.filter((p: RoadProfileRead) => !isStrictRoadProfile(p));
      setLegacyCount(legacy.length);
      
      // Sort by creation date (newest first) - STAGE 2: Use correct field name created_at
      const sortedProfiles = allProfiles.sort((a: RoadProfileRead, b: RoadProfileRead) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      setProfiles(sortedProfiles);
    } catch (error) {
      console.error('Failed to load profiles:', error);
      toast.error('Failed to load road profiles');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (profileId: string) => {
    // Navigate to main Settings with GNSS tab and profile ID
    setLocation(`/?tab=gnss&profileId=${profileId}`);
  };

  const handleExportProfile = async (profile: RoadProfileRead) => {
    // STAGE 2: Block export for legacy profiles
    if (!isStrictRoadProfile(profile)) {
      toast.error('Cannot Export Legacy Profile', {
        description: 'This profile is missing required identifiers. Retry Stage 1 migration to fix.'
      });
      return;
    }

    try {
      const db = await openSurveyDB();
      
      // Get events for this profile using indexed query (O(n) instead of O(n²))
      const events = await db.getAllFromIndex('roadProfileEvents', 'by-profile', profile.id);
      
      // Filter events by type locally (much faster than 3 separate full scans)
      const gradeEvents = events.filter((e: any) => e.eventType === 'grade');
      const kFactorEvents = events.filter((e: any) => e.eventType === 'k_factor');
      const railEvents = events.filter((e: any) => e.eventType === 'rail_crossing');

      const zip = new JSZip();

      // Add profile summary CSV
      const summaryCSV = [
        'Metric,Value',
        `Profile ID,${profile.id}`,
        `Survey ID,${profile.surveyId || 'N/A'}`,
        `Label,${profile.label || 'Unlabeled'}`,
        `Start Time,${new Date(profile.start).toLocaleString()}`,
        `End Time,${new Date(profile.end).toLocaleString()}`,
        `Total Distance (m),${(profile.summary?.totalDistance_m ?? 0).toFixed(2)}`,
        `Total Climb (m),${(profile.summary?.totalClimb_m ?? 0).toFixed(2)}`,
        `Total Descent (m),${(profile.summary?.totalDescent_m ?? 0).toFixed(2)}`,
        `Max Grade Up (%),${(profile.summary?.maxGradeUp_pct ?? 0).toFixed(2)}`,
        `Max Grade Down (%),${(profile.summary?.maxGradeDown_pct ?? 0).toFixed(2)}`,
        `Min K-Factor Convex,${profile.summary?.minKFactorConvex?.toFixed(2) || 'N/A'}`,
        `Min K-Factor Concave,${profile.summary?.minKFactorConcave?.toFixed(2) || 'N/A'}`,
        `Grade Events,${profile.summary?.numGradeEvents ?? 0}`,
        `K-Factor Events,${profile.summary?.numKFactorEvents ?? 0}`,
        `Rail Crossings,${profile.summary?.numRailCrossings ?? 0}`,
      ].join('\n');
      zip.file('profile_summary.csv', summaryCSV);

      // Add grade events CSV
      if (gradeEvents.length > 0) {
        const gradeCSV = [
          'Direction,Max Grade (%),Start Distance (m),End Distance (m),Length (m),Start Lat,Start Lon,End Lat,End Lon,Timestamp',
          ...gradeEvents.map((e: any) => 
            `${e.direction},${e.max_grade_pct},${e.start_distance_m},${e.end_distance_m},${e.length_m},${e.start_lat},${e.start_lon},${e.end_lat},${e.end_lon},${e.timestamp}`
          )
        ].join('\n');
        zip.file('grade_events.csv', gradeCSV);
      }

      // Add K-factor events CSV
      if (kFactorEvents.length > 0) {
        const kFactorCSV = [
          'Type,K-Factor,Distance (m),Latitude,Longitude,Severity,Timestamp',
          ...kFactorEvents.map((e: any) => 
            `${e.curvature_type},${e.k_factor},${e.distance_m},${e.lat},${e.lon},${e.severity},${e.timestamp}`
          )
        ].join('\n');
        zip.file('k_factor_events.csv', kFactorCSV);
      }

      // Add rail crossing events CSV
      if (railEvents.length > 0) {
        const railCSV = [
          'Detection Method,Distance (m),Latitude,Longitude,Elevation Change (m),Notes,Timestamp',
          ...railEvents.map((e: any) => 
            `${e.detection_method},${e.distance_m},${e.lat},${e.lon},${e.elevation_change_m || 'N/A'},${e.notes || ''},${e.timestamp}`
          )
        ].join('\n');
        zip.file('rail_crossings.csv', railCSV);
      }

      // Add GeoJSON
      const geoJSON = {
        type: 'FeatureCollection',
        features: [
          // Profile points as LineString
          ...((profile.summary?.totalDistance_m ?? 0) > 0 ? [{
            type: 'Feature',
            properties: {
              type: 'profile_line',
              id: profile.id,
              label: profile.label,
              distance_m: profile.summary?.totalDistance_m ?? 0,
            },
            geometry: {
              type: 'LineString',
              coordinates: [] // Would need to fetch profile points
            }
          }] : []),
          // Grade events
          ...gradeEvents.map((e: any) => ({
            type: 'Feature',
            properties: {
              type: 'grade_event',
              direction: e.direction,
              max_grade_pct: e.max_grade_pct,
              length_m: e.length_m,
            },
            geometry: {
              type: 'LineString',
              coordinates: [
                [e.start_lon, e.start_lat],
                [e.end_lon, e.end_lat]
              ]
            }
          })),
          // K-factor events
          ...kFactorEvents.map((e: any) => ({
            type: 'Feature',
            properties: {
              type: 'k_factor_event',
              curvature_type: e.curvature_type,
              k_factor: e.k_factor,
              severity: e.severity,
            },
            geometry: {
              type: 'Point',
              coordinates: [e.lon, e.lat]
            }
          })),
          // Rail crossings
          ...railEvents.map((e: any) => ({
            type: 'Feature',
            properties: {
              type: 'rail_crossing',
              detection_method: e.detection_method,
              notes: e.notes,
            },
            geometry: {
              type: 'Point',
              coordinates: [e.lon, e.lat]
            }
          })),
        ]
      };
      zip.file('profile.geojson', JSON.stringify(geoJSON, null, 2));

      // Generate and download ZIP
      const blob = await zip.generateAsync({ type: 'blob' });
      const filename = `road_profile_${profile.label || profile.id}_${new Date().toISOString().split('T')[0]}.zip`;
      saveAs(blob, filename);
      
      toast.success('Profile exported successfully');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export profile');
    }
  };

  const formatDistance = (meters: number) => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${meters.toFixed(0)} m`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-400">Loading road profiles...</div>
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <div className="text-center py-12">
        <Activity className="w-12 h-12 text-gray-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-300 mb-2">No Road Profiles Yet</h3>
        <p className="text-gray-400 mb-4">
          Start road profiling from the Survey Actions panel to create your first profile.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Road Profiles ({profiles.length})</h3>
      </div>

      {/* STAGE 2: Legacy Warning Banner */}
      {legacyCount > 0 && (
        <div className="flex items-center gap-2 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg mb-4" data-testid="banner-legacy-warning">
          <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
          <div>
            <p className="font-medium text-yellow-800 dark:text-yellow-200">
              {legacyCount} Legacy Profile{legacyCount > 1 ? 's' : ''} Found
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              These profiles are missing required identifiers. Export and some features are disabled. Retry Stage 1 migration to fix.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {profiles.map((profile) => (
          <div
            key={profile.id}
            className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
            data-testid={`profile-card-${profile.id}`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-white">
                    {getProfileDisplayLabel(profile)}
                  </h4>
                  {/* STAGE 2: Legacy Badge */}
                  {!isStrictRoadProfile(profile) && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 text-xs rounded" data-testid={`badge-legacy-profile-${profile.id}`}>
                      <AlertTriangle className="h-3 w-3" />
                      Legacy
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400">
                  Created: {formatDate(profile.created_at)}
                </p>
              </div>
            </div>

            {/* Summary Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-gray-700/50 rounded p-2">
                <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                  <MapPin className="w-3 h-3" />
                  Distance
                </div>
                <div className="text-sm font-semibold text-white">
                  {formatDistance(profile.summary?.totalDistance_m ?? 0)}
                </div>
              </div>

              <div className="bg-gray-700/50 rounded p-2">
                <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                  <TrendingUp className="w-3 h-3" />
                  Climb
                </div>
                <div className="text-sm font-semibold text-green-400">
                  {(profile.summary?.totalClimb_m ?? 0).toFixed(1)} m
                </div>
              </div>

              <div className="bg-gray-700/50 rounded p-2">
                <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                  <TrendingDown className="w-3 h-3" />
                  Descent
                </div>
                <div className="text-sm font-semibold text-blue-400">
                  {(profile.summary?.totalDescent_m ?? 0).toFixed(1)} m
                </div>
              </div>

              <div className="bg-gray-700/50 rounded p-2">
                <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                  <AlertTriangle className="w-3 h-3" />
                  Events
                </div>
                <div className="text-sm font-semibold text-yellow-400">
                  {(profile.summary?.numGradeEvents ?? 0) + (profile.summary?.numKFactorEvents ?? 0) + (profile.summary?.numRailCrossings ?? 0)}
                </div>
              </div>
            </div>

            {/* Additional Stats */}
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-400 mb-4">
              <div>Max Grade Up: <span className="text-white">{(profile.summary?.maxGradeUp_pct ?? 0).toFixed(1)}%</span></div>
              <div>Max Grade Down: <span className="text-white">{(profile.summary?.maxGradeDown_pct ?? 0).toFixed(1)}%</span></div>
              <div>Grade Events: <span className="text-white">{profile.summary?.numGradeEvents ?? 0}</span></div>
              <div>K-Factor Events: <span className="text-white">{profile.summary?.numKFactorEvents ?? 0}</span></div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {/* STAGE 2: Disable View button for legacy profiles */}
              <button
                onClick={() => handleViewDetails(profile.id)}
                disabled={!isStrictRoadProfile(profile)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded text-xs font-medium transition-colors ${
                  isStrictRoadProfile(profile)
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-gray-600 cursor-not-allowed opacity-50'
                }`}
                data-testid={`button-view-profile-${profile.id}`}
              >
                {!isStrictRoadProfile(profile) && <AlertTriangle className="w-3 h-3" />}
                {isStrictRoadProfile(profile) && <Eye className="w-3 h-3" />}
                View Details
              </button>
              {/* STAGE 2: Disable export button for legacy profiles */}
              <button
                onClick={() => handleExportProfile(profile)}
                disabled={!isStrictRoadProfile(profile)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded text-xs font-medium transition-colors ${
                  isStrictRoadProfile(profile)
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-gray-600 cursor-not-allowed opacity-50'
                }`}
                data-testid={`button-export-profile-${profile.id}`}
              >
                {!isStrictRoadProfile(profile) && <AlertTriangle className="w-3 h-3" />}
                {isStrictRoadProfile(profile) && <Download className="w-3 h-3" />}
                Export
              </button>
            </div>

            {/* STAGE 2: Show explanatory text for legacy profiles */}
            {!isStrictRoadProfile(profile) && (
              <p className="text-xs text-gray-400 mt-2" data-testid={`text-legacy-explanation-${profile.id}`}>
                This profile is missing required identifiers. Retry Stage 1 migration to fix.
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SurveyProfiles;
