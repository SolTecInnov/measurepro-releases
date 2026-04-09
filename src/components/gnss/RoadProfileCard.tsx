/**
 * RoadProfileCard - Road profile visualization with recording controls
 * Shows elevation chart, grade, K-factor, and integrated recording controls
 * All profile features available in the main app without the GNSS module
 */

import { useState, useMemo, useEffect } from 'react';
import { 
  Map, TrendingUp, Route, Mountain, Activity, Pause, Square, 
  Flag, Satellite, MapPin, Signal, ChevronDown, ChevronUp, AlertTriangle,
  SkipForward, History, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLocation } from 'wouter';
import useProfileRecording from '@/hooks/useProfileRecording';
import GradeEventLog from './GradeEventLog';
import type { RoadProfilePoint } from '@/lib/roadProfile/types';
import { getProfileRecordingBuffer } from '@/lib/roadProfile';
import { getProfileDataFromDB } from '@/lib/roadProfile/exportHelper';
import { useSurveyStore } from '@/lib/survey';
import { loadSessionState, loadSessionSamples } from '@/lib/gnss/gnssSessionPersistence';
import { computeProfileFromSamples } from '@/lib/gnss/profileComputation';

interface ProfilePoint {
  latitude: number;
  longitude: number;
  altitude: number;
  altitudeAvailable: boolean;
  distance: number;
  grade: number;
  kFactor?: number;
  timestamp: string;
}

const ElevationChart: React.FC<{ points: ProfilePoint[]; height?: number }> = ({ 
  points, 
  height = 100 
}) => {
  const chartData = useMemo(() => {
    if (points.length < 2) return null;

    // Use the explicit altitudeAvailable flag (preserved from raw GPS sample).
    // This correctly distinguishes missing altitude from a valid sea-level (0 m) reading.
    const hasAltitude = points.some(p => p.altitudeAvailable);
    if (!hasAltitude) return { noAltitude: true } as const;

    const altitudes = points.map(p => p.altitude ?? 0);
    const minAlt = Math.min(...altitudes);
    const maxAlt = Math.max(...altitudes);
    const altRange = maxAlt - minAlt || 1;
    const maxDist = points[points.length - 1]?.distance || 1;

    const pathPoints = points.map((p) => {
      const x = (p.distance / maxDist) * 100;
      const y = height - (((p.altitude ?? 0) - minAlt) / altRange) * (height - 10) - 5;
      return { x, y, grade: p.grade };
    });

    return { pathPoints, minAlt, maxAlt, maxDist };
  }, [points, height]);

  if (!chartData || points.length < 2) {
    return (
      <div className="flex items-center justify-center h-24 bg-gray-900 rounded-lg text-gray-500 text-sm" data-testid="elevation-no-data">
        <Mountain className="w-4 h-4 mr-2" />
        No elevation data yet
      </div>
    );
  }

  if ('noAltitude' in chartData) {
    return (
      <div className="flex items-center justify-center h-24 bg-gray-900 rounded-lg text-amber-600 text-sm" data-testid="elevation-no-altitude">
        <Mountain className="w-4 h-4 mr-2" />
        GPS source has no altitude data
      </div>
    );
  }

  const { pathPoints, minAlt, maxAlt, maxDist } = chartData;

  // Grade color helper: 0-8% green, 8-10% blue, 10-12% amber, 12-14% red, 14-16% purple, >16% black
  const getGradeColor = (grade: number): string => {
    const absGrade = Math.abs(grade);
    if (absGrade > 16) return '#111827'; // gray-900 / black
    if (absGrade > 14) return '#a855f7'; // purple-500
    if (absGrade > 12) return '#ef4444'; // red-500
    if (absGrade > 10) return '#f59e0b'; // amber-500
    if (absGrade > 8) return '#3b82f6';  // blue-500
    return '#10b981'; // green-500
  };

  // Get current point color for marker
  const currentPointColor = pathPoints.length > 0 
    ? getGradeColor(pathPoints[pathPoints.length - 1].grade)
    : '#10b981';

  return (
    <div className="relative" data-testid="elevation-chart">
      <svg
        viewBox={`0 0 100 ${height}`}
        className="w-full"
        style={{ height: `${height}px` }}
        preserveAspectRatio="none"
      >
        {/* Grid lines */}
        <line x1="0" y1="25%" x2="100" y2="25%" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
        <line x1="0" y1="50%" x2="100" y2="50%" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
        <line x1="0" y1="75%" x2="100" y2="75%" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
        
        {/* Area fill segments with grade-based colors */}
        {pathPoints.map((p, i) => {
          if (i === 0) return null;
          const prevP = pathPoints[i - 1];
          const baseY = height - 5;
          const fillColor = getGradeColor(p.grade);
          const d = `M ${prevP.x} ${baseY} L ${prevP.x} ${prevP.y} L ${p.x} ${p.y} L ${p.x} ${baseY} Z`;
          return (
            <path
              key={`fill-${i}`}
              d={d}
              fill={fillColor}
              fillOpacity="0.3"
            />
          );
        })}
        
        {/* Elevation line segments with grade-based colors */}
        {pathPoints.map((p, i) => {
          if (i === 0) return null;
          const prevP = pathPoints[i - 1];
          return (
            <line
              key={`line-${i}`}
              x1={prevP.x}
              y1={prevP.y}
              x2={p.x}
              y2={p.y}
              stroke={getGradeColor(p.grade)}
              strokeWidth="1.5"
            />
          );
        })}
        
        {/* Current position marker */}
        {pathPoints.length > 0 && (
          <circle
            cx={pathPoints[pathPoints.length - 1].x}
            cy={pathPoints[pathPoints.length - 1].y}
            r="3"
            fill={currentPointColor}
            stroke="white"
            strokeWidth="1"
          />
        )}
      </svg>
      
      {/* Axis labels */}
      <div className="absolute top-0 left-0 text-xs text-gray-400 font-mono">
        {maxAlt.toFixed(0)}m
      </div>
      <div className="absolute bottom-0 left-0 text-xs text-gray-400 font-mono">
        {minAlt.toFixed(0)}m
      </div>
      <div className="absolute bottom-0 right-0 text-xs text-gray-400 font-mono">
        {(maxDist / 1000).toFixed(1)}km
      </div>
    </div>
  );
};

const GradeIndicator: React.FC<{ grade: number }> = ({ grade }) => {
  const getGradeColor = (g: number): string => {
    const absGrade = Math.abs(g);
    // Grade color scheme: 0-8% green, 8-10% blue, 10-12% amber, 12-14% red, 14-16% purple, >16% black
    if (absGrade > 16) return 'text-gray-900 dark:text-gray-100'; // black (use contrast colors)
    if (absGrade > 14) return 'text-purple-500';
    if (absGrade > 12) return 'text-red-500';
    if (absGrade > 10) return 'text-amber-500';
    if (absGrade > 8) return 'text-blue-500';
    return 'text-green-500';
  };

  const getGradeIcon = (g: number) => {
    if (g > 0.5) return <TrendingUp className="w-4 h-4 rotate-0" />;
    if (g < -0.5) return <TrendingUp className="w-4 h-4 rotate-180" />;
    return <Activity className="w-4 h-4" />;
  };

  return (
    <div className={`flex items-center gap-1 ${getGradeColor(grade)}`} data-testid="grade-indicator">
      {getGradeIcon(grade)}
      <span className="font-mono font-bold">
        {grade >= 0 ? '+' : ''}{grade.toFixed(1)}%
      </span>
    </div>
  );
};

const KFactorIndicator: React.FC<{ kFactor: number | null | undefined }> = ({ kFactor }) => {
  if (kFactor === null || kFactor === undefined) return null;
  
  const getKFactorColor = (k: number): string => {
    if (k > 0 && k < 10) return 'text-red-400'; // Convex warning
    if (k < 0 && k > -10) return 'text-orange-400'; // Concave warning  
    return 'text-green-400';
  };

  const getKFactorLabel = (k: number): string => {
    if (k > 0) return 'K+ (convex)';
    if (k < 0) return 'K- (concave)';
    return 'K (flat)';
  };

  return (
    <div className={`flex items-center gap-1 ${getKFactorColor(kFactor)}`} data-testid="kfactor-indicator">
      <span className="text-xs text-gray-400">{getKFactorLabel(kFactor)}</span>
      <span className="font-mono font-bold text-sm">
        {Math.abs(kFactor).toFixed(1)}
      </span>
    </div>
  );
};

const RoadProfileCard: React.FC = () => {
  const {
    isRecording,
    isPaused,
    state,
    stats,
    points,
    gpsSource,
    gradeEvents,
    stopRecording,
    pauseRecording,
    resumeRecording,
    markSectionStart,
    markSectionEnd
  } = useProfileRecording();

  const { activeSurvey } = useSurveyStore();
  const [, setLocation] = useLocation();
  const [expanded, setExpanded] = useState(false);
  const [sectionLabel, setSectionLabel] = useState('');
  const [inSection, setInSection] = useState(false);
  const [historicalPoints, setHistoricalPoints] = useState<RoadProfilePoint[]>([]);
  const [loadingHistorical, setLoadingHistorical] = useState(false);
  const [gnssSessionActive, setGnssSessionActive] = useState(false);
  const [gnssPoints, setGnssPoints] = useState<RoadProfilePoint[]>([]);

  // Subscribe to profile buffer for real-time updates (more responsive than polling)
  useEffect(() => {
    const buffer = getProfileRecordingBuffer();
    
    // Prime state immediately on mount before subscribing
    const initialBufferState = buffer.getState();
    const initialBufferPoints = buffer.getPoints();
    if (initialBufferState === 'recording' || initialBufferState === 'paused') {
      setGnssSessionActive(true);
    }
    if (initialBufferPoints.length > 0) {
      setGnssPoints(initialBufferPoints);
    }
    
    // Subscribe to buffer events for real-time point updates
    const unsubscribe = buffer.subscribe((event) => {
      if (event.type === 'point') {
        // Get all current points from buffer
        const currentPoints = buffer.getPoints();
        if (currentPoints.length > 0) {
          setGnssPoints(currentPoints);
        }
      } else if (event.type === 'state') {
        // Update active state based on buffer state
        const bufferState = buffer.getState();
        setGnssSessionActive(bufferState === 'recording' || bufferState === 'paused');
        
        if (bufferState === 'idle') {
          // Don't clear points - keep showing the last recorded profile
        }
      }
    });
    
    // Also check for existing GNSS session on mount (from persistence)
    const checkGnssSession = async () => {
      const gnssState = loadSessionState();
      const isActive = gnssState?.isRecording ?? false;
      
      // Check buffer state as well
      const bufferState = buffer.getState();
      const isBufferActive = bufferState === 'recording' || bufferState === 'paused';
      
      setGnssSessionActive(isActive || isBufferActive);
      
      // If buffer has points, use them (more current)
      const bufferPoints = buffer.getPoints();
      if (bufferPoints.length > 0) {
        setGnssPoints(bufferPoints);
        return;
      }
      
      // Otherwise load from persisted GNSS session
      if (isActive && gnssState) {
        try {
          const samples = await loadSessionSamples(gnssState.sessionId);
          if (samples.length > 0) {
            const profile = computeProfileFromSamples(samples, gnssState.sessionId);
            if (profile && profile.points && profile.points.length > 0) {
              const convertedPoints: RoadProfilePoint[] = profile.points.map(p => ({
                profileId: gnssState.sessionId,
                lat: p.latitude,
                lon: p.longitude,
                elev_m: p.altitude,
                altitudeAvailable: p.altitude !== null && p.altitude !== undefined,
                chainage_m: p.distance_m,
                grade_pct: p.grade_pct,
                k_factor: p.k_factor ?? 0,
                timestamp_iso: p.timestamp,
                quality: 'gnss',
                grade_alert_type: Math.abs(p.grade_pct) > 12 ? (p.grade_pct > 0 ? 'GRADE_12_UP' : 'GRADE_12_DOWN') : 'NONE',
                k_alert: (p.k_factor !== null && Math.abs(p.k_factor) < 10) ? 'K_OVER_10' : 'NONE'
              }));
              setGnssPoints(convertedPoints);
            }
          }
        } catch (err) {
          console.warn('[RoadProfileCard] Failed to load GNSS session samples:', err);
        }
      }
    };
    
    // Check on mount
    checkGnssSession();
    
    // Also poll periodically as backup (every 5 seconds) for persistence sync
    const interval = setInterval(checkGnssSession, 5000);
    
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  // Track previous survey ID to detect changes
  const [prevSurveyId, setPrevSurveyId] = useState<string | null>(null);
  
  // Load historical profile data when idle and we have an active survey
  useEffect(() => {
    const currentSurveyId = activeSurvey?.id ?? null;
    
    // Clear historical data only when survey actually changes
    if (currentSurveyId !== prevSurveyId) {
      setHistoricalPoints([]);
      setPrevSurveyId(currentSurveyId);
    }
    
    // Load historical data when idle with no live points
    if (state === 'idle' && currentSurveyId && (!points || points.length === 0)) {
      setLoadingHistorical(true);
      getProfileDataFromDB(currentSurveyId)
        .then((data) => {
          if (data && data.points.length > 0) {
            setHistoricalPoints(data.points);
          }
        })
        .catch(console.error)
        .finally(() => setLoadingHistorical(false));
    } else if (points && points.length > 0) {
      // Clear historical when we have live data
      setHistoricalPoints([]);
    }
  }, [state, activeSurvey?.id, points?.length, prevSurveyId]);
  
  // Use live points if available, then GNSS session points, otherwise historical
  const displayPoints = (points && points.length > 0) ? points :
                        (gnssPoints.length > 0 ? gnssPoints : historicalPoints);

  // Compute stats from display points (live or historical)
  const displayStats = useMemo(() => {
    if (stats) return stats; // Use live stats if available
    if (displayPoints.length === 0) return null;
    
    // Compute basic stats from historical points
    const lastPoint = displayPoints[displayPoints.length - 1];
    const firstPoint = displayPoints[0];
    const totalDistance = lastPoint?.chainage_m ?? 0;
    
    // Estimate duration from first/last timestamps if available
    let estimatedDuration = 0;
    if (firstPoint?.timestamp_iso && lastPoint?.timestamp_iso) {
      const startTime = new Date(firstPoint.timestamp_iso).getTime();
      const endTime = new Date(lastPoint.timestamp_iso).getTime();
      estimatedDuration = Math.max(0, (endTime - startTime) / 1000);
    }
    
    // Count alerts from historical points using same thresholds as live recording
    // Grade alerts: >12% up or down
    // K-factor alerts: absolute value < 10 (both convex and concave)
    const alertCount = displayPoints.filter(p => {
      const hasGradeAlert = p.grade_pct !== undefined && Math.abs(p.grade_pct) > 12;
      const hasKFactorAlert = p.k_factor !== undefined && Math.abs(p.k_factor) < 10;
      return hasGradeAlert || hasKFactorAlert;
    }).length;
    
    return {
      duration_s: estimatedDuration,
      distance_m: totalDistance,
      samples: displayPoints.length,
      currentGrade_pct: lastPoint?.grade_pct ?? 0,
      currentKFactor: lastPoint?.k_factor ?? 0,
      alertCount,
      currentElevation_m: lastPoint?.elev_m ?? 0,
      gpsSource: 'auto' as const,
      gpsQuality: 'historical'
    };
  }, [stats, displayPoints]);

  // Convert RoadProfilePoints to chart-compatible format
  const chartPoints: ProfilePoint[] = useMemo(() => {
    return displayPoints.map((p: RoadProfilePoint) => ({
      latitude: p.lat,
      longitude: p.lon,
      altitude: p.elev_m,
      altitudeAvailable: p.altitudeAvailable ?? false,
      distance: p.chainage_m,
      grade: p.grade_pct,
      kFactor: p.k_factor,
      timestamp: p.timestamp_iso
    }));
  }, [displayPoints]);



  const handleMarkSection = () => {
    if (inSection) {
      markSectionEnd(sectionLabel || undefined);
      setSectionLabel('');
      setInSection(false);
    } else {
      markSectionStart(sectionLabel || undefined);
      setInSection(true);
    }
  };

  const formatDistance = (meters: number): string => {
    if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
    return `${meters.toFixed(0)} m`;
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getGpsSourceIcon = () => {
    switch (gpsSource) {
      case 'duro':
        return <Satellite className="w-4 h-4 text-green-400" />;
      case 'serial':
        return <Signal className="w-4 h-4 text-orange-400" />;
      case 'bluetooth':
        return <Signal className="w-4 h-4 text-blue-300" />;
      case 'browser':
        return <MapPin className="w-4 h-4 text-blue-400" />;
      default:
        return <Signal className="w-4 h-4 text-yellow-400" />;
    }
  };

  const getGpsSourceLabel = () => {
    switch (gpsSource) {
      case 'duro': return 'Duro GNSS';
      case 'serial': return 'Serial GPS';
      case 'bluetooth': return 'Bluetooth GPS';
      case 'browser': return 'Device GPS';
      default: return 'Auto GPS';
    }
  };

  const getCurrentGrade = (): number => {
    return displayStats?.currentGrade_pct ?? 0;
  };

  const getCurrentKFactor = (): number | null => {
    if (chartPoints.length === 0) return null;
    return chartPoints[chartPoints.length - 1]?.kFactor ?? null;
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-4" data-testid="road-profile-card">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Route className="w-5 h-5 text-cyan-400" />
          Road Profile
        </h3>
        <div className="flex items-center gap-2">
          {/* GPS Source indicator */}
          <div className="flex items-center gap-1 text-xs text-gray-400" title={getGpsSourceLabel()}>
            {getGpsSourceIcon()}
          </div>
          
          {/* GNSS Profiling session indicator */}
          {gnssSessionActive && !isRecording && (
            <button
              onClick={() => setLocation('/gnss')}
              className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs hover:bg-blue-500/30 transition-colors cursor-pointer"
              title="GNSS Profiling is recording - click to view"
              data-testid="button-gnss-session-active"
            >
              <Satellite className="w-3 h-3" />
              <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
              GNSS Recording
              <ExternalLink className="w-3 h-3 ml-1" />
            </button>
          )}
          
          {/* Recording state indicator */}
          {isRecording && (
            <span className="flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              Recording
            </span>
          )}
          {isPaused && (
            <span className="flex items-center gap-1 px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs">
              <Pause className="w-3 h-3" />
              Paused
            </span>
          )}
                    
          {/* Expand toggle */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setExpanded(!expanded)}
            data-testid="button-profile-expand"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Recording Controls - only show when actively recording/paused */}
      <div className="flex items-center gap-2">
        {isRecording && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={pauseRecording}
              data-testid="button-profile-pause"
            >
              <Pause className="w-4 h-4 mr-1" />
              Pause
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="flex-1"
              onClick={stopRecording}
              data-testid="button-profile-stop"
            >
              <Square className="w-4 h-4 mr-1" />
              Stop
            </Button>
          </>
        )}
        {isPaused && (
          <>
            <Button
              variant="default"
              size="sm"
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={resumeRecording}
              data-testid="button-profile-resume"
            >
              <SkipForward className="w-4 h-4 mr-1" />
              Resume
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="flex-1"
              onClick={stopRecording}
              data-testid="button-profile-stop"
            >
              <Square className="w-4 h-4 mr-1" />
              Stop
            </Button>
          </>
        )}
      </div>

      {/* Stats Grid - show when recording or has data */}
      {displayStats && (
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="bg-gray-900 rounded-lg p-2">
            <div className="text-xs text-gray-400">Distance</div>
            <div className="text-sm font-bold text-white font-mono" data-testid="value-distance">
              {formatDistance(displayStats.distance_m)}
            </div>
          </div>
          <div className="bg-gray-900 rounded-lg p-2">
            <div className="text-xs text-gray-400">Samples</div>
            <div className="text-sm font-bold text-white font-mono" data-testid="value-samples">
              {displayStats.samples.toLocaleString()}
            </div>
          </div>
          <div className="bg-gray-900 rounded-lg p-2">
            <div className="text-xs text-gray-400">Duration</div>
            <div className="text-sm font-bold text-white font-mono" data-testid="value-duration">
              {formatDuration(displayStats.duration_s)}
            </div>
          </div>
          <div className="bg-gray-900 rounded-lg p-2">
            <div className="text-xs text-gray-400">Alerts</div>
            <div className={`text-sm font-bold font-mono ${
              displayStats.alertCount > 0 ? 'text-orange-400' : 'text-white'
            }`} data-testid="value-alerts">
              {displayStats.alertCount > 0 && <AlertTriangle className="w-3 h-3 inline mr-1" />}
              {displayStats.alertCount}
            </div>
          </div>
        </div>
      )}

      {/* Elevation Chart - show when has data */}
      {chartPoints.length > 0 && (
        <div className="bg-gray-900 rounded-lg p-3">
          <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
            <span className="flex items-center gap-1">
              <Mountain className="w-4 h-4" />
              Elevation Profile
            </span>
            {chartPoints.length >= 2 && (
              <span className="text-xs">
                {Math.min(...chartPoints.map(p => p.altitude)).toFixed(0)}m - {Math.max(...chartPoints.map(p => p.altitude)).toFixed(0)}m
              </span>
            )}
          </div>
          <ElevationChart points={chartPoints} height={80} />
        </div>
      )}

      {/* Current Grade & K-Factor */}
      {(isRecording || isPaused) && (
        <div className="bg-gray-900 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-xs text-gray-400 block">Current Grade</span>
              <GradeIndicator grade={getCurrentGrade()} />
            </div>
            {getCurrentKFactor() !== null && (
              <div>
                <span className="text-xs text-gray-400 block">K-Factor</span>
                <KFactorIndicator kFactor={getCurrentKFactor()} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Expanded section: Section marking */}
      {expanded && (isRecording || isPaused) && (
        <div className="space-y-2 pt-2 border-t border-gray-700">
          <div className="text-xs text-gray-400">Section Marking</div>
          <div className="flex items-center gap-2">
            <Input
              type="text"
              placeholder="Section label (optional)"
              value={sectionLabel}
              onChange={(e) => setSectionLabel(e.target.value)}
              className="flex-1 h-8 text-xs bg-gray-900 border-gray-600"
              data-testid="input-section-label"
            />
            <Button
              variant={inSection ? 'destructive' : 'outline'}
              size="sm"
              className="h-8"
              onClick={handleMarkSection}
              data-testid="button-mark-section"
            >
              <Flag className="w-3 h-3 mr-1" />
              {inSection ? 'End Section' : 'Start Section'}
            </Button>
          </div>
          {inSection && (
            <div className="text-xs text-yellow-400 flex items-center gap-1">
              <Flag className="w-3 h-3" />
              Recording section{sectionLabel ? `: ${sectionLabel}` : ''}
            </div>
          )}
        </div>
      )}

      {/* Grade Events Log */}
      {expanded && (isRecording || isPaused || gradeEvents.length > 0) && (
        <div className="pt-2 border-t border-gray-700">
          <GradeEventLog events={gradeEvents} maxHeight="200px" />
        </div>
      )}

      {/* Historical data indicator */}
      {state === 'idle' && historicalPoints.length > 0 && (
        <div className="flex items-center gap-2 px-2 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-xs">
          <History className="w-3 h-3" />
          <span>Showing previous recording ({historicalPoints.length} points)</span>
        </div>
      )}

      {/* Loading state */}
      {loadingHistorical && (
        <div className="flex items-center justify-center py-4 text-gray-500">
          <div className="animate-spin w-5 h-5 border-2 border-gray-500 border-t-transparent rounded-full mr-2" />
          <span className="text-sm">Loading profile data...</span>
        </div>
      )}

      {/* Empty state - show when no data and not recording */}
      {state === 'idle' && chartPoints.length === 0 && !loadingHistorical && !gnssSessionActive && (
        <div className="flex flex-col items-center justify-center py-4 text-gray-500">
          <Map className="w-10 h-10 mb-2 opacity-50" />
          <p className="text-sm">No road profile data</p>
          <p className="text-xs mt-1">Use GNSS Profiling to capture grade, elevation, and K-factor</p>
        </div>
      )}
    </div>
  );
};

export default RoadProfileCard;
