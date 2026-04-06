/**
 * Road Profile Page
 * Main page for MeasurePRO GNSS Profiling - Professional road profiling system
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getCurrentUser } from '@/lib/firebase';
import { auditLog } from '@/lib/auditLog';
import { Input } from '@/components/ui/input';
import { Satellite, TrendingUp, Settings, MapPin, AlertTriangle, Library, Plus, Search, ExternalLink, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useGnssData } from '@/hooks/useGnssData';
import { GnssViewer } from '@/components/gnss/GnssViewer';
import { ProfileVisualization } from '@/components/gnss/ProfileVisualization';
import { EventList } from '@/components/gnss/EventList';
import RoadProfileCard from '@/components/gnss/RoadProfileCard';
import { ProfileControls } from '@/components/gnss/ProfileControls';
import { CorrectionSettings } from '@/components/gnss/CorrectionSettings';
import { ThresholdSettings } from '@/components/gnss/ThresholdSettings';
import { WindBladeSettings } from '@/components/gnss/WindBladeSettings';
import { DuroCalibrationSettings } from '@/components/gnss/DuroCalibrationSettings';
import { DuroBridgeConnectionSettings } from '@/components/gnss/DuroBridgeConnectionSettings';
import { AlignmentManager } from '@/components/gnss/AlignmentManager';
import { LinkedProfileViewer } from '@/components/gnss/LinkedProfileViewer';
import type { Alignment, LinkedProfile, LatLon } from '@/lib/alignment/types';
import { 
  getRecentProfile, 
  getGradeEvents, 
  getKFactorEvents, 
  getRailCrossingEvents,
  logRailCrossing,
  ingestGNSS
} from '@/lib/gnssApi';
import { openSurveyDB } from '@/lib/survey/db';
import { duroGpsService } from '@/lib/gnss/duroGpsService';
import { useGPSStore } from '@/lib/stores/gpsStore';
import { computeProfileFromSamples } from '@/lib/gnss/profileComputation';
import { 
  saveSessionState, 
  loadSessionState, 
  clearSessionState,
  loadSessionSamples,
  appendSamples,
} from '@/lib/gnss/gnssSessionPersistence';
import { getProfileRecordingBuffer } from '@/lib/roadProfile';
import { isPhantomProfile, getProfileDisplayLabel } from '@/lib/roadProfile/profileUtils';
import type { RoadProfile, GradeEvent, KFactorEvent, RailCrossingEvent, ProfilePoint, GnssSample } from '../../server/gnss/types';

const BACKEND_URL_KEY = 'measurepro_gnss_backend_url';

type TabValue = 'library' | 'live-gnss' | 'profile-viewer' | 'settings';

export default function RoadProfilePage() {
  // Navigation
  const navigate = useNavigate();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabValue>('library');

  // Audit: track feature access on mount
  useEffect(() => {
    try {
      const u = getCurrentUser();
      if (u) auditLog.featureAccess(u.uid, u.email || '', 'GNSS Road Profiling');
    } catch (_e) {}
  }, []);

  // Auto-start DuroGpsService if backend URL is configured
  useEffect(() => {
    const backendUrl = localStorage.getItem(BACKEND_URL_KEY);
    if (backendUrl && !duroGpsService.isActive()) {
      console.log('[RoadProfile] Auto-starting DuroGpsService with backend:', backendUrl);
      duroGpsService.start();
    }
    
    return () => {
      // Don't stop on unmount - let it run globally
    };
  }, []);

  // Unified GNSS data (local bridge or WebSocket)
  const { latestSample, isConnected, error: wsError, source: gnssSource, hasImu, fixQuality, dataSource, diagnosticSats, diagnosticHdop } = useGnssData();

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState('');
  const [recordingStartTime, setRecordingStartTime] = useState<Date | null>(null);
  const [accumulatedSamples, setAccumulatedSamples] = useState<GnssSample[]>([]);
  const [sessionRestored, setSessionRestored] = useState(false);
  
  // Ref to track last persisted sample count (for incremental saves)
  const lastPersistedCount = useRef(0);

  // Restore active session on mount (CRITICAL for persistence across navigation)
  useEffect(() => {
    const restoreSession = async () => {
      // First check if buffer already has an active session (from navigation back)
      const buffer = getProfileRecordingBuffer();
      const bufferState = buffer.getState();
      
      if (bufferState === 'recording' || bufferState === 'paused') {
        // Buffer is already recording - sync local state with buffer
        const session = buffer.getSession();
        const points = buffer.getPoints();
        
        if (session) {
          console.log('[RoadProfile] Syncing with active buffer session:', session.id.substring(0, 8));
          setCurrentSessionId(session.id);
          setIsRecording(bufferState === 'recording');
          setRecordingStartTime(new Date(session.start_timestamp || Date.now()));
          
          // Convert buffer points to profile format
          if (points.length > 0) {
            const profile: RoadProfile = {
              id: session.id,
              sessionId: session.id,
              surveyId: session.surveyId,
              label: `Profile ${session.id.substring(0, 8)}`,
              start: session.start_timestamp || new Date().toISOString(),
              end: new Date().toISOString(),
              created_at: session.created_at || new Date().toISOString(),
              step_m: 1,
              grade_trigger_pct: 10,
              k_factor_convex_min: 10,
              k_factor_concave_min: 10,
              points: points.map(p => ({
                distance_m: p.chainage_m,
                latitude: p.lat,
                longitude: p.lon,
                altitude: p.elev_m,
                grade_pct: p.grade_pct,
                k_factor: p.k_factor,
                curvature_type: null,
                timestamp: p.timestamp_iso
              })),
              summary: {
                totalDistance_m: points[points.length - 1]?.chainage_m || 0,
                totalClimb_m: 0,
                totalDescent_m: 0,
                maxGradeUp_pct: Math.max(0, ...points.map(p => p.grade_pct)),
                maxGradeDown_pct: Math.min(0, ...points.map(p => p.grade_pct)),
                numGradeEvents: 0,
                numKFactorEvents: 0,
                numRailCrossings: 0,
                minKFactorConvex: 0,
                minKFactorConcave: 0
              }
            };
            setCurrentProfile(profile);
          }
          
          setSessionRestored(true);
          return;
        }
      }
      
      // Fallback: check localStorage for saved session
      const savedState = loadSessionState();
      if (savedState && savedState.isRecording) {
        console.log('[RoadProfile] Restoring active session from persistence:', savedState.sessionId.substring(0, 8));
        
        // Load persisted samples from IndexedDB
        const samples = await loadSessionSamples(savedState.sessionId);
        if (samples.length > 0) {
          setAccumulatedSamples(samples);
          lastPersistedCount.current = samples.length;
          setCurrentSessionId(savedState.sessionId);
          setIsRecording(true);
          setRecordingStartTime(new Date(savedState.startTime));
          
          // Compute profile from restored samples
          const restoredProfile = computeProfileFromSamples(samples, savedState.sessionId);
          if (restoredProfile) {
            setCurrentProfile(restoredProfile);
          }
          
          // Also sync with buffer
          buffer.startRecording({
            surveyId: savedState.sessionId,
            sessionId: savedState.sessionId,
            gpsSource: 'duro'
          });
          
          toast.success(`Restored recording session with ${samples.length} samples`);
        }
      }
      setSessionRestored(true);
    };
    
    restoreSession();
  }, []);

  // Persist session state whenever recording state changes
  useEffect(() => {
    if (!sessionRestored) return;
    
    if (isRecording && currentSessionId) {
      saveSessionState({
        sessionId: currentSessionId,
        isRecording: true,
        startTime: recordingStartTime?.toISOString() || new Date().toISOString(),
        sampleCount: accumulatedSamples.length,
        lastUpdated: new Date().toISOString(),
      });
    } else if (!isRecording) {
      // Clear session state when recording stops
      clearSessionState();
    }
  }, [isRecording, currentSessionId, recordingStartTime, accumulatedSamples.length, sessionRestored]);

  // Incrementally persist new samples to IndexedDB (every 10 samples)
  useEffect(() => {
    const newSamples = accumulatedSamples.slice(lastPersistedCount.current);
    if (newSamples.length >= 10 && currentSessionId) {
      appendSamples(currentSessionId, newSamples);
      lastPersistedCount.current = accumulatedSamples.length;
    }
  }, [accumulatedSamples.length, currentSessionId]);

  // Profile and events state
  const [currentProfile, setCurrentProfile] = useState<RoadProfile | null>(null);
  const [gradeEvents, setGradeEvents] = useState<GradeEvent[]>([]);
  const [kFactorEvents, setKFactorEvents] = useState<KFactorEvent[]>([]);
  const [railCrossings, setRailCrossings] = useState<RailCrossingEvent[]>([]);
  const [highlightedDistance, setHighlightedDistance] = useState<number | undefined>();

  // Duro connection status from GPS store (more reliable than API call)
  const gpsData = useGPSStore((s) => s.data);
  const gpsConnected = useGPSStore((s) => s.connected);
  const duroConnected = gpsConnected && gpsData.source === 'duro';

  // Library state
  const [allProfiles, setAllProfiles] = useState<RoadProfile[]>([]);
  const [filteredProfiles, setFilteredProfiles] = useState<RoadProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRangeFilter, setDateRangeFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [eventTypeFilter, setEventTypeFilter] = useState<'all' | 'grade' | 'kfactor' | 'rail'>('all');

  // Alignment + Linked Profile state
  const [selectedAlignment, setSelectedAlignment] = useState<Alignment | null>(null);
  const [selectedLinkedProfile, setSelectedLinkedProfile] = useState<LinkedProfile | null>(null);

  // Extract recorded path from accumulated samples
  const recordedPath: LatLon[] = accumulatedSamples
    .filter(s => s.latitude && s.longitude && s.latitude !== 0 && s.longitude !== 0)
    .map(s => ({ lat: s.latitude, lon: s.longitude }));

  // Refs
  const eventsFetchInterval = useRef<NodeJS.Timeout | null>(null);

  // Calculate recording stats
  const recordingStats = {
    duration_s: recordingStartTime ? Math.floor((Date.now() - recordingStartTime.getTime()) / 1000) : 0,
    distance_m: accumulatedSamples.length > 1 
      ? calculateTotalDistance(accumulatedSamples) 
      : 0,
    samples: accumulatedSamples.length,
  };

  // Load all profiles from IndexedDB for library
  useEffect(() => {
    const loadProfiles = async () => {
      try {
        const db = await openSurveyDB();
        const profiles = await db.getAll('roadProfiles');
        
        // Silently delete phantom/orphan profiles in the background
        const phantoms = profiles.filter(isPhantomProfile);
        for (const phantom of phantoms) {
          db.delete('roadProfiles', phantom.id).catch(() => {});
        }
        
        // Only show real profiles
        const realProfiles = profiles.filter((p: any) => !isPhantomProfile(p));
        
        // Sort by most recent first
        realProfiles.sort((a: RoadProfile, b: RoadProfile) => new Date(b.end).getTime() - new Date(a.end).getTime());
        setAllProfiles(realProfiles);
      } catch (error) {
        console.error('Failed to load profiles:', error);
      }
    };

    loadProfiles();
    // Refresh every 30 seconds
    const interval = setInterval(loadProfiles, 30000);
    return () => clearInterval(interval);
  }, []);

  // Filter profiles based on search and filters
  useEffect(() => {
    let filtered = [...allProfiles];

    // Search by label
    if (searchQuery) {
      filtered = filtered.filter(p => 
        (p.label || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.id.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by date range
    if (dateRangeFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      filtered = filtered.filter(p => {
        const profileDate = new Date(p.end);
        if (dateRangeFilter === 'today') return profileDate >= today;
        if (dateRangeFilter === 'week') return profileDate >= weekAgo;
        if (dateRangeFilter === 'month') return profileDate >= monthAgo;
        return true;
      });
    }

    // Filter by event type
    if (eventTypeFilter !== 'all') {
      filtered = filtered.filter(p => {
        if (eventTypeFilter === 'grade') return p.summary.numGradeEvents > 0;
        if (eventTypeFilter === 'kfactor') return p.summary.numKFactorEvents > 0;
        if (eventTypeFilter === 'rail') return p.summary.numRailCrossings > 0;
        return true;
      });
    }

    setFilteredProfiles(filtered);
  }, [allProfiles, searchQuery, dateRangeFilter, eventTypeFilter]);

  // Accumulate samples when recording and send to server
  useEffect(() => {
    if (isRecording && latestSample) {
      // Add session ID to sample for server-side grouping
      const sampleWithSession: GnssSample = {
        ...latestSample,
        sessionId: currentSessionId,
        surveyId: currentSessionId,
      };
      
      setAccumulatedSamples(prev => [...prev, sampleWithSession]);
      
      // Send sample to server for profile generation
      ingestGNSS({ sample: sampleWithSession }).catch(err => {
        console.warn('[RoadProfile] Failed to ingest sample:', err.message);
      });
    }
  }, [isRecording, latestSample, currentSessionId]);

  // Fetch recent profile periodically when not recording
  useEffect(() => {
    if (!isRecording) {
      const fetchProfile = async () => {
        try {
          const profile = await getRecentProfile(300); // Last 5 minutes
          setCurrentProfile(profile);
        } catch (error) {
          // Silently handle - profile may not exist
        }
      };

      fetchProfile();
      const interval = setInterval(fetchProfile, 10000); // Every 10s
      return () => clearInterval(interval);
    }
  }, [isRecording]);

  // Compute live profile during recording
  useEffect(() => {
    if (isRecording && accumulatedSamples.length >= 2) {
      const liveProfile = computeProfileFromSamples(accumulatedSamples, currentSessionId);
      if (liveProfile) {
        setCurrentProfile(liveProfile);
      }
    }
  }, [isRecording, accumulatedSamples, currentSessionId]);

  // Fetch events periodically
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const [grades, kFactors, rails] = await Promise.all([
          getGradeEvents(currentSessionId || undefined),
          getKFactorEvents(currentSessionId || undefined),
          getRailCrossingEvents(currentSessionId || undefined),
        ]);
        setGradeEvents(grades);
        setKFactorEvents(kFactors);
        setRailCrossings(rails);
      } catch (error) {
        // Silently handle
      }
    };

    fetchEvents();
    eventsFetchInterval.current = setInterval(fetchEvents, 5000); // Every 5s
    return () => {
      if (eventsFetchInterval.current) {
        clearInterval(eventsFetchInterval.current);
      }
    };
  }, [currentSessionId]);

  // Start recording
  const handleStartRecording = useCallback((sessionId: string) => {
    // CRITICAL: Clear old profile data to ensure viewer shows fresh recording
    setCurrentProfile(null);
    setAccumulatedSamples([]);
    lastPersistedCount.current = 0;
    
    // Start fresh recording
    setIsRecording(true);
    setCurrentSessionId(sessionId);
    setRecordingStartTime(new Date());
    
    // IMPORTANT: Also start the global ProfileRecordingBuffer so RoadProfileCard in main app shows live data
    const buffer = getProfileRecordingBuffer();
    buffer.startRecording({
      surveyId: sessionId,
      sessionId: sessionId,
      gpsSource: 'duro',
      thresholds: {
        grade_up_alert_pct: 10,
        grade_down_alert_pct: -10,
        k_factor_alert: 10
      }
    });
    
    // Switch to live view tab to see the new recording
    setActiveTab('live-gnss');
    
    toast.success(`Recording started: ${sessionId}`);
  }, []);

  // Stop recording
  const handleStopRecording = useCallback(async () => {
    // Persist any remaining samples before stopping
    const remainingSamples = accumulatedSamples.slice(lastPersistedCount.current);
    if (remainingSamples.length > 0 && currentSessionId) {
      await appendSamples(currentSessionId, remainingSamples);
    }
    
    // Reset persistence tracking
    lastPersistedCount.current = 0;
    
    // Stop the global ProfileRecordingBuffer
    const buffer = getProfileRecordingBuffer();
    await buffer.stopRecording();
    
    setIsRecording(false);
    setRecordingStartTime(null);
    toast.success('Recording stopped');
  }, [accumulatedSamples, currentSessionId]);

  // Handle profile selection from history
  const handleProfileSelect = useCallback((profile: RoadProfile) => {
    setCurrentProfile(profile);
    setActiveTab('profile-viewer');
    toast.success(`Loaded profile: ${profile.label || profile.id}`);
  }, []);

  // Handle view profile from library
  const handleViewProfile = useCallback((profile: RoadProfile) => {
    setCurrentProfile(profile);
    setCurrentSessionId(profile.sessionId || '');
    setActiveTab('profile-viewer');
  }, []);

  // Handle navigate to parent survey
  const handleNavigateToSurvey = useCallback((surveyId: string) => {
    navigate(`/surveys/${surveyId}`);
  }, [navigate]);

  // Handle new profile creation
  const handleNewProfile = useCallback(() => {
    setActiveTab('live-gnss');
    toast.info('Ready to create new profile. Start recording to begin.');
  }, []);

  // Handle event click (highlight on profile)
  const handleEventClick = useCallback((_type: 'grade' | 'kfactor' | 'rail', _eventId: string, distance: number) => {
    setHighlightedDistance(distance);
    setActiveTab('profile-viewer');
  }, []);

  // Handle profile point click
  const handlePointClick = useCallback((point: ProfilePoint) => {
    toast.info(`Distance: ${point.distance_m.toFixed(1)}m, Elevation: ${point.altitude.toFixed(2)}m, Grade: ${point.grade_pct.toFixed(2)}%`);
  }, []);

  // Manual rail crossing trigger
  const handleManualRailCrossing = useCallback(async () => {
    if (!latestSample) {
      toast.error('No GPS data available');
      return;
    }

    try {
      await logRailCrossing(latestSample.latitude, latestSample.longitude, 'Manual trigger');
      toast.success('Rail crossing logged');
    } catch (error) {
      toast.error('Failed to log rail crossing');
    }
  }, [latestSample]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'r':
          if (isRecording) {
            handleStopRecording();
          } else {
            handleStartRecording(`session-${Date.now()}`);
          }
          break;
        case 's':
          // Save profile - would trigger save modal
          toast.info('Press Save Profile button to save');
          break;
        case 'm':
          handleManualRailCrossing();
          break;
        case '1':
          setActiveTab('library');
          break;
        case '2':
          setActiveTab('live-gnss');
          break;
        case '3':
          setActiveTab('profile-viewer');
          break;
        case '4':
          setActiveTab('settings');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isRecording, handleStartRecording, handleStopRecording, handleManualRailCrossing]);

  // WebSocket error toast
  useEffect(() => {
    if (wsError) {
      toast.error(`WebSocket error: ${wsError}`);
    }
  }, [wsError]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-[1800px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => navigate('/')}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              data-testid="button-back-to-main"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Main App
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Satellite className="h-8 w-8 text-blue-500" />
                MeasurePRO GNSS Profiling
              </h1>
              <p className="text-gray-400 mt-1">
                Professional road profiling for heavy transport route analysis
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* GNSS Source indicator */}
            {gnssSource !== 'none' && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm ${
                gnssSource === 'local-bridge' ? 'bg-green-600/20 text-green-400' : 'bg-blue-600/20 text-blue-400'
              }`}>
                <Satellite className="h-4 w-4" />
                <span>{gnssSource === 'local-bridge' ? 'Duro Bridge' : 'WebSocket'}</span>
                {hasImu && <span className="text-xs bg-orange-500/30 px-1.5 rounded">IMU</span>}
              </div>
            )}
            <Button
              onClick={handleManualRailCrossing}
              disabled={!latestSample}
              variant="outline"
              data-testid="button-manual-rail-crossing"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Manual Rail Crossing (M)
            </Button>
            {isRecording && (
              <div className="flex items-center gap-2 px-4 py-2 bg-red-600 rounded animate-pulse">
                <div className="h-3 w-3 rounded-full bg-white" />
                <span className="font-medium">RECORDING</span>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Card data-testid="card-tabs">
          <div className="border-b border-gray-700">
            <div className="flex gap-1 p-2">
              {[
                { id: 'library' as TabValue, label: 'Profile Library', icon: Library, shortcut: '1' },
                { id: 'live-gnss' as TabValue, label: 'Live GNSS', icon: Satellite, shortcut: '2' },
                { id: 'profile-viewer' as TabValue, label: 'Profile Viewer', icon: TrendingUp, shortcut: '3' },
                { id: 'settings' as TabValue, label: 'Settings', icon: Settings, shortcut: '4' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-750 hover:text-white'
                  }`}
                  data-testid={`tab-${tab.id}`}
                >
                  <tab.icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                  <span className="text-xs opacity-60">({tab.shortcut})</span>
                </button>
              ))}
            </div>
          </div>

          <CardContent className="p-6">
            {/* Profile Library Tab */}
            {activeTab === 'library' && (
              <div className="space-y-6" data-testid="tab-content-library">
                {/* Search and Filters */}
                <div className="flex gap-4 items-center flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Search profiles by label or ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 bg-gray-800 border-gray-700 text-white"
                        data-testid="input-search-profiles"
                      />
                    </div>
                  </div>
                  
                  <select
                    value={dateRangeFilter}
                    onChange={(e) => setDateRangeFilter(e.target.value as any)}
                    className="px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white"
                    data-testid="select-date-range"
                  >
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="week">Last 7 Days</option>
                    <option value="month">Last 30 Days</option>
                  </select>

                  <select
                    value={eventTypeFilter}
                    onChange={(e) => setEventTypeFilter(e.target.value as any)}
                    className="px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white"
                    data-testid="select-event-type"
                  >
                    <option value="all">All Events</option>
                    <option value="grade">Grade Events</option>
                    <option value="kfactor">K-Factor Events</option>
                    <option value="rail">Rail Crossings</option>
                  </select>

                  <Button
                    onClick={handleNewProfile}
                    className="bg-green-600 hover:bg-green-700"
                    data-testid="button-new-profile"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New Profile
                  </Button>
                </div>

                {/* Profiles List */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredProfiles.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-gray-400">
                      <Library className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No profiles found</p>
                      <p className="text-sm mt-2">
                        {allProfiles.length === 0 
                          ? 'Create your first profile by clicking "New Profile"' 
                          : 'Try adjusting your filters'}
                      </p>
                    </div>
                  ) : (
                    filteredProfiles.map((profile) => (
                      <Card key={profile.id} className="bg-gray-800 border-gray-700 hover:border-blue-500 transition-colors">
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            {/* Header */}
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h3 className="font-semibold text-white truncate" data-testid={`text-profile-label-${profile.id}`}>
                                  {getProfileDisplayLabel(profile)}
                                </h3>
                                <p className="text-xs text-gray-400">
                                  {profile.end
                                    ? (() => {
                                        const d = new Date(profile.end);
                                        return d.getFullYear() > 2000
                                          ? `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`
                                          : profile.start ? `${new Date(profile.start).toLocaleDateString()} ${new Date(profile.start).toLocaleTimeString()}` : 'In progress';
                                      })()
                                    : 'In progress'}
                                </p>
                              </div>
                              {profile.surveyId && (
                                <button
                                  onClick={() => handleNavigateToSurvey(profile.surveyId!)}
                                  className="text-blue-400 hover:text-blue-300 transition-colors"
                                  title="View parent survey"
                                  data-testid={`button-view-survey-${profile.id}`}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </button>
                              )}
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-gray-400">Distance:</span>
                                <span className="ml-1 text-white font-medium">
                                  {((profile.summary?.totalDistance_m ?? 0) / 1000).toFixed(2)} km
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-400">Climb:</span>
                                <span className="ml-1 text-white font-medium">
                                  {(profile.summary?.totalClimb_m ?? 0).toFixed(1)} m
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-400">Descent:</span>
                                <span className="ml-1 text-white font-medium">
                                  {(profile.summary?.totalDescent_m ?? 0).toFixed(1)} m
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-400">Max Grade:</span>
                                <span className="ml-1 text-white font-medium">
                                  {Math.max(profile.summary?.maxGradeUp_pct ?? 0, Math.abs(profile.summary?.maxGradeDown_pct ?? 0)).toFixed(1)}%
                                </span>
                              </div>
                            </div>

                            {/* Events */}
                            <div className="flex gap-3 text-xs">
                              {(profile.summary?.numGradeEvents ?? 0) > 0 && (
                                <div className="flex items-center gap-1 text-yellow-400">
                                  <TrendingUp className="h-3 w-3" />
                                  <span>{profile.summary?.numGradeEvents}</span>
                                </div>
                              )}
                              {(profile.summary?.numKFactorEvents ?? 0) > 0 && (
                                <div className="flex items-center gap-1 text-orange-400">
                                  <AlertTriangle className="h-3 w-3" />
                                  <span>{profile.summary?.numKFactorEvents}</span>
                                </div>
                              )}
                              {(profile.summary?.numRailCrossings ?? 0) > 0 && (
                                <div className="flex items-center gap-1 text-red-400">
                                  <MapPin className="h-3 w-3" />
                                  <span>{profile.summary?.numRailCrossings}</span>
                                </div>
                              )}
                            </div>

                            {/* Actions */}
                            <Button
                              onClick={() => handleViewProfile(profile)}
                              size="sm"
                              className="w-full bg-blue-600 hover:bg-blue-700"
                              data-testid={`button-view-profile-${profile.id}`}
                            >
                              View Details
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Live GNSS Tab */}
            {activeTab === 'live-gnss' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" data-testid="tab-content-live-gnss">
                <div className="lg:col-span-2 space-y-6">
                  <GnssViewer 
                    sample={latestSample} 
                    isConnected={isConnected} 
                    duroConnected={duroConnected}
                    fixQuality={fixQuality}
                    dataSource={dataSource}
                    diagnosticSats={diagnosticSats}
                    diagnosticHdop={diagnosticHdop}
                  />
                  <ProfileControls
                    isRecording={isRecording}
                    onStartRecording={handleStartRecording}
                    onStopRecording={handleStopRecording}
                    currentSessionId={currentSessionId}
                    recordingStats={recordingStats}
                    accumulatedSamples={accumulatedSamples}
                    onProfileSelect={handleProfileSelect}
                  />
                  <RoadProfileCard />
                </div>
                <div>
                  <EventList
                    gradeEvents={gradeEvents}
                    kFactorEvents={kFactorEvents}
                    railCrossings={railCrossings}
                    onEventClick={handleEventClick}
                  />
                </div>
              </div>
            )}

            {/* Profile Viewer Tab */}
            {activeTab === 'profile-viewer' && (
              <div className="space-y-6" data-testid="tab-content-profile-viewer">
                {selectedAlignment && selectedLinkedProfile ? (
                  <LinkedProfileViewer
                    alignment={selectedAlignment}
                    profile={selectedLinkedProfile}
                  />
                ) : (
                  <ProfileVisualization
                    profile={currentProfile}
                    highlightedPoint={highlightedDistance}
                    onPointClick={handlePointClick}
                  />
                )}
                
                <AlignmentManager
                  projectId="default"
                  userId="default-user"
                  currentRecordedPath={recordedPath.length > 0 ? recordedPath : undefined}
                  recordedProfile={currentProfile}
                  onSelectLinkedSet={(alignment, linkedProfile) => {
                    setSelectedAlignment(alignment);
                    setSelectedLinkedProfile(linkedProfile);
                    toast.success(`Loaded linked set: ${alignment.name}`);
                  }}
                />
                
                <EventList
                  gradeEvents={gradeEvents}
                  kFactorEvents={kFactorEvents}
                  railCrossings={railCrossings}
                  onEventClick={handleEventClick}
                />
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div className="space-y-6" data-testid="tab-content-settings">
                {/* Connection Settings */}
                <DuroBridgeConnectionSettings 
                  onConnectionChange={() => {
                    if (!duroGpsService.isActive()) {
                      duroGpsService.start();
                    }
                  }}
                />
                
                {/* Duro Calibration */}
                <DuroCalibrationSettings />
                
                {/* Other Settings */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <CorrectionSettings />
                  <ThresholdSettings />
                </div>
                
                {/* Wind Blade Transport Settings */}
                <WindBladeSettings />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Keyboard Shortcuts Help */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-sm text-gray-400">
              <div className="flex items-center gap-6">
                <span className="font-medium text-gray-300">Keyboard Shortcuts:</span>
                <div className="flex gap-4">
                  <span><kbd className="px-2 py-1 bg-gray-800 rounded">R</kbd> Start/Stop Recording</span>
                  <span><kbd className="px-2 py-1 bg-gray-800 rounded">M</kbd> Manual Rail Crossing</span>
                  <span><kbd className="px-2 py-1 bg-gray-800 rounded">1</kbd> Library</span>
                  <span><kbd className="px-2 py-1 bg-gray-800 rounded">2</kbd> Live GNSS</span>
                  <span><kbd className="px-2 py-1 bg-gray-800 rounded">3</kbd> Profile Viewer</span>
                  <span><kbd className="px-2 py-1 bg-gray-800 rounded">4</kbd> Settings</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * Calculate total distance from GNSS samples using Haversine formula
 */
function calculateTotalDistance(samples: GnssSample[]): number {
  if (!samples || samples.length < 2) return 0;

  let totalDistance = 0;
  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1];
    const curr = samples[i];
    if (prev && curr && 
        typeof prev.latitude === 'number' && typeof prev.longitude === 'number' &&
        typeof curr.latitude === 'number' && typeof curr.longitude === 'number' &&
        prev.latitude !== 0 && prev.longitude !== 0 &&
        curr.latitude !== 0 && curr.longitude !== 0) {
      const dist = haversineDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
      if (!isNaN(dist) && isFinite(dist)) {
        totalDistance += dist;
      }
    }
  }
  return isNaN(totalDistance) ? 0 : totalDistance;
}

/**
 * Haversine distance between two GPS coordinates (in meters)
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (typeof lat1 !== 'number' || typeof lon1 !== 'number' || 
      typeof lat2 !== 'number' || typeof lon2 !== 'number') {
    return 0;
  }
  
  const R = 6371000; // Earth radius in meters
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const result = R * c;
  return isNaN(result) ? 0 : result;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}
