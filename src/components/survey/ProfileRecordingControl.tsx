/**
 * Profile Recording Control Component
 * Compact control for profile recording within the survey panel
 * 
 * Features:
 * - Start/stop/pause/resume recording
 * - Section marking (start/end)
 * - Real-time stats display
 * - GPS source indicator
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Play,
  Square,
  Pause,
  SkipForward,
  Flag,
  MapPin,
  Satellite,
  Signal,
  AlertTriangle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import useProfileRecording from '@/hooks/useProfileRecording';

interface ProfileRecordingControlProps {
  compact?: boolean;
}

export function ProfileRecordingControl({ compact = false }: ProfileRecordingControlProps) {
  const {
    isRecording,
    isPaused,
    state,
    stats,
    gpsSource,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    markSectionStart,
    markSectionEnd
  } = useProfileRecording();

  const [expanded, setExpanded] = useState(false);
  const [sectionLabel, setSectionLabel] = useState('');
  const [inSection, setInSection] = useState(false);

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

  const formatDistance = (m: number): string => {
    if (m >= 1000) return `${(m / 1000).toFixed(2)} km`;
    return `${m.toFixed(0)} m`;
  };

  const formatDuration = (s: number): string => {
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const seconds = s % 60;
    if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getGpsSourceIcon = () => {
    switch (gpsSource) {
      case 'duro':
        return <Satellite className="w-3 h-3 text-green-400" />;
      case 'serial':
        return <Signal className="w-3 h-3 text-orange-400" />;
      case 'bluetooth':
        return <Signal className="w-3 h-3 text-blue-300" />;
      case 'browser':
        return <MapPin className="w-3 h-3 text-blue-400" />;
      default:
        return <Signal className="w-3 h-3 text-yellow-400" />;
    }
  };

  // Compact view for embedded display
  if (compact) {
    return (
      <div className="flex items-center gap-2 p-2 bg-gray-800 rounded-lg" data-testid="profile-recording-compact">
        {/* Recording state indicator */}
        <div className={`w-2 h-2 rounded-full ${
          isRecording ? 'bg-red-500 animate-pulse' : 
          isPaused ? 'bg-yellow-500' : 'bg-gray-500'
        }`} />
        
        {/* GPS source */}
        {getGpsSourceIcon()}
        
        {/* Stats */}
        {stats && (
          <div className="flex items-center gap-3 text-xs text-gray-300">
            <span>{formatDistance(stats.distance_m)}</span>
            <span>{formatDuration(stats.duration_s)}</span>
            {stats.alertCount > 0 && (
              <span className="flex items-center gap-1 text-orange-400">
                <AlertTriangle className="w-3 h-3" />
                {stats.alertCount}
              </span>
            )}
          </div>
        )}
        
        {/* Controls */}
        <div className="flex items-center gap-1 ml-auto">
          {state === 'idle' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={startRecording}
              data-testid="button-profile-start"
            >
              <Play className="w-3 h-3 text-green-400" />
            </Button>
          )}
          {isRecording && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={pauseRecording}
                data-testid="button-profile-pause"
              >
                <Pause className="w-3 h-3 text-yellow-400" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={stopRecording}
                data-testid="button-profile-stop"
              >
                <Square className="w-3 h-3 text-red-400" />
              </Button>
            </>
          )}
          {isPaused && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={resumeRecording}
                data-testid="button-profile-resume"
              >
                <Play className="w-3 h-3 text-green-400" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={stopRecording}
                data-testid="button-profile-stop"
              >
                <Square className="w-3 h-3 text-red-400" />
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  // Full view with section marking
  return (
    <Card className="bg-gray-800 border-gray-700" data-testid="profile-recording-full">
      <CardContent className="p-3 space-y-3">
        {/* Header with expand toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              isRecording ? 'bg-red-500 animate-pulse' : 
              isPaused ? 'bg-yellow-500' : 'bg-gray-500'
            }`} />
            <span className="text-sm font-medium text-white">Road Profile</span>
            {getGpsSourceIcon()}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setExpanded(!expanded)}
            data-testid="button-profile-expand"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>

        {/* Stats row */}
        {stats && (
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="bg-gray-900 rounded p-1">
              <div className="text-gray-400">Distance</div>
              <div className="text-white font-mono" data-testid="text-profile-distance">
                {formatDistance(stats.distance_m)}
              </div>
            </div>
            <div className="bg-gray-900 rounded p-1">
              <div className="text-gray-400">Time</div>
              <div className="text-white font-mono" data-testid="text-profile-duration">
                {formatDuration(stats.duration_s)}
              </div>
            </div>
            <div className="bg-gray-900 rounded p-1">
              <div className="text-gray-400">Grade</div>
              <div className={`font-mono ${
                Math.abs(stats.currentGrade_pct) >= 12 ? 'text-red-400' : 'text-white'
              }`} data-testid="text-profile-grade">
                {stats.currentGrade_pct.toFixed(1)}%
              </div>
            </div>
            <div className="bg-gray-900 rounded p-1">
              <div className="text-gray-400">Alerts</div>
              <div className={`font-mono ${
                stats.alertCount > 0 ? 'text-orange-400' : 'text-white'
              }`} data-testid="text-profile-alerts">
                {stats.alertCount}
              </div>
            </div>
          </div>
        )}

        {/* Recording controls */}
        <div className="flex items-center gap-2">
          {state === 'idle' && (
            <Button
              variant="default"
              size="sm"
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={startRecording}
              data-testid="button-profile-start-full"
            >
              <Play className="w-4 h-4 mr-1" />
              Start Recording
            </Button>
          )}
          {isRecording && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={pauseRecording}
                data-testid="button-profile-pause-full"
              >
                <Pause className="w-4 h-4 mr-1" />
                Pause
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="flex-1"
                onClick={stopRecording}
                data-testid="button-profile-stop-full"
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
                data-testid="button-profile-resume-full"
              >
                <SkipForward className="w-4 h-4 mr-1" />
                Resume
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="flex-1"
                onClick={stopRecording}
                data-testid="button-profile-stop-full"
              >
                <Square className="w-4 h-4 mr-1" />
                Stop
              </Button>
            </>
          )}
        </div>

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
      </CardContent>
    </Card>
  );
}

export default ProfileRecordingControl;
