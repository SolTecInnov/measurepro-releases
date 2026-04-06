/**
 * Profile Controls Component
 * Recording controls, session management, and profile saving
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Play, Square, Save, List, Scissors } from 'lucide-react';
import { toast } from 'sonner';
import { saveProfile, getSavedProfiles, deleteProfile, getProfileById } from '@/lib/gnssApi';
import { computeProfileFromSamples } from '@/lib/gnss/profileComputation';
import { openSurveyDB } from '@/lib/survey/db';
import type { RoadProfile, GnssSample } from '../../../server/gnss/types';

interface ProfileControlsProps {
  isRecording: boolean;
  onStartRecording: (sessionId: string) => void;
  onStopRecording: () => void;
  currentSessionId: string;
  recordingStats: {
    duration_s: number;
    distance_m: number;
    samples: number;
  };
  accumulatedSamples?: GnssSample[];
  onProfileSelect?: (profile: RoadProfile) => void;
}

export function ProfileControls({
  isRecording,
  onStartRecording,
  onStopRecording,
  currentSessionId,
  recordingStats,
  accumulatedSamples = [],
  onProfileSelect,
}: ProfileControlsProps) {
  const [sessionInput, setSessionInput] = useState('');
  const [savedProfiles, setSavedProfiles] = useState<RoadProfile[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);

  // Save thresholds (these would come from ThresholdSettings in real app)
  const [saveThresholds, setSaveThresholds] = useState({
    step_m: 5,
    grade_trigger_pct: 12,
    k_factor_convex_min: 5000,
    k_factor_concave_min: -4000,
  });

  // Section save state
  const [sectionData, setSectionData] = useState({
    fromDistance: 0,
    toDistance: 0,
    label: '',
  });

  useEffect(() => {
    loadSavedProfiles();
  }, []);

  const loadSavedProfiles = async () => {
    setIsLoadingProfiles(true);
    try {
      const profiles = await getSavedProfiles();
      setSavedProfiles(profiles);
    } catch (error) {
      toast.error('Failed to load saved profiles');
    } finally {
      setIsLoadingProfiles(false);
    }
  };

  const handleStartRecording = () => {
    const sessionId = sessionInput.trim() || `session-${Date.now()}`;
    setSessionInput(sessionId);
    onStartRecording(sessionId);
    toast.success(`Recording started: ${sessionId}`);
  };

  const handleStopRecording = () => {
    onStopRecording();
    toast.success('Recording stopped');
  };

  const handleSaveProfile = async () => {
    if (!isRecording && recordingStats.samples === 0) {
      toast.error('No data to save. Start and stop a recording first.');
      return;
    }

    if (accumulatedSamples.length < 2) {
      toast.error('Not enough GPS samples. Need at least 2 valid positions.');
      return;
    }

    setIsSaving(true);
    try {
      const profile = computeProfileFromSamples(
        accumulatedSamples,
        currentSessionId,
        {
          stepM: saveThresholds.step_m,
          gradeTriggerPct: saveThresholds.grade_trigger_pct,
          kFactorConvexMin: saveThresholds.k_factor_convex_min,
          kFactorConcaveMin: saveThresholds.k_factor_concave_min,
        }
      );

      if (!profile) {
        toast.error('Could not compute profile - insufficient valid data');
        return;
      }

      const db = await openSurveyDB();
      const tx = db.transaction('roadProfiles', 'readwrite');
      const store = tx.objectStore('roadProfiles');
      await store.put(profile);
      await tx.done;

      try {
        await saveProfile({
          sessionId: currentSessionId,
          startTime: profile.start,
          endTime: profile.end,
          ...saveThresholds,
        });
      } catch (serverError) {
        console.warn('[ProfileControls] Server save failed, profile saved locally:', serverError);
      }

      toast.success(`Profile saved: ${profile.id} (${profile.points.length} points)`);
      setShowSaveModal(false);
      await loadSavedProfiles();
    } catch (error) {
      console.error('[ProfileControls] Save error:', error);
      toast.error('Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProfile = async (profileId: string) => {
    if (!confirm('Are you sure you want to delete this profile?')) return;

    try {
      await deleteProfile(profileId);
      toast.success('Profile deleted');
      await loadSavedProfiles();
    } catch (error) {
      toast.error('Failed to delete profile');
    }
  };

  const handleLoadProfile = async (profileId: string) => {
    try {
      const profile = await getProfileById(profileId);
      if (onProfileSelect) {
        onProfileSelect(profile);
      }
      setShowHistoryModal(false);
      toast.success('Profile loaded');
    } catch (error) {
      toast.error('Failed to load profile');
    }
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  return (
    <>
      <Card className="w-full" data-testid="card-profile-controls">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Recording Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Session ID Input */}
          <div>
            <Label htmlFor="session-id">Session ID</Label>
            <Input
              id="session-id"
              value={sessionInput}
              onChange={(e) => setSessionInput(e.target.value)}
              placeholder="session-name or leave blank for auto"
              disabled={isRecording}
              data-testid="input-session-id"
            />
          </div>

          {/* Recording Controls */}
          <div className="flex gap-2">
            {!isRecording ? (
              <Button
                onClick={handleStartRecording}
                className="flex-1"
                data-testid="button-start-recording"
              >
                <Play className="h-4 w-4 mr-2" />
                Start Recording
              </Button>
            ) : (
              <Button
                onClick={handleStopRecording}
                variant="destructive"
                className="flex-1"
                data-testid="button-stop-recording"
              >
                <Square className="h-4 w-4 mr-2" />
                Stop Recording
              </Button>
            )}
          </div>

          {/* Recording Stats */}
          {(isRecording || recordingStats.samples > 0) && (
            <div className="grid grid-cols-3 gap-4 p-4 bg-gray-900/50 rounded border border-gray-700">
              <div>
                <div className="text-xs text-gray-400">Duration</div>
                <div className="font-mono text-sm" data-testid="text-duration">
                  {formatDuration(recordingStats.duration_s)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Distance</div>
                <div className="font-mono text-sm" data-testid="text-distance">
                  {(recordingStats?.distance_m ?? 0).toFixed(0)}m
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Samples</div>
                <div className="font-mono text-sm" data-testid="text-samples">
                  {recordingStats.samples}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2 border-t border-gray-700">
            <Button
              onClick={() => setShowSaveModal(true)}
              disabled={recordingStats.samples === 0}
              variant="outline"
              className="flex-1"
              data-testid="button-save-profile"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Profile
            </Button>
            <Button
              onClick={() => setShowSectionModal(true)}
              disabled={recordingStats.samples === 0}
              variant="outline"
              className="flex-1"
              data-testid="button-save-section"
            >
              <Scissors className="h-4 w-4 mr-2" />
              Save Section
            </Button>
            <Button
              onClick={() => setShowHistoryModal(true)}
              variant="outline"
              data-testid="button-view-history"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Save Profile Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="modal-save-profile">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Save Road Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Resampling Step (m)</Label>
                <Input
                  type="number"
                  value={saveThresholds.step_m}
                  onChange={(e) => setSaveThresholds(prev => ({ ...prev, step_m: Number(e.target.value) }))}
                  data-testid="input-step"
                />
              </div>
              <div>
                <Label>Grade Trigger (%)</Label>
                <Input
                  type="number"
                  value={saveThresholds.grade_trigger_pct}
                  onChange={(e) => setSaveThresholds(prev => ({ ...prev, grade_trigger_pct: Number(e.target.value) }))}
                  data-testid="input-grade-trigger"
                />
              </div>
              <div className="flex gap-4 pt-4">
                <Button onClick={() => setShowSaveModal(false)} variant="outline" className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleSaveProfile} disabled={isSaving} className="flex-1" data-testid="button-confirm-save">
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Profile History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="modal-profile-history">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-auto">
            <CardHeader>
              <CardTitle>Saved Profiles</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingProfiles ? (
                <div className="text-center py-8 text-gray-400">Loading...</div>
              ) : savedProfiles.length === 0 ? (
                <div className="text-center py-8 text-gray-400">No saved profiles yet</div>
              ) : (
                <div className="space-y-2">
                  {savedProfiles.map(profile => (
                    <div
                      key={profile.id}
                      className="flex items-center justify-between p-3 border border-gray-700 rounded hover:bg-gray-800"
                      data-testid={`row-profile-${profile.id}`}
                    >
                      <div className="flex-1">
                        <div className="font-medium">{profile.id}</div>
                        <div className="text-sm text-gray-400">
                          {(profile.summary?.totalDistance_m ?? 0).toFixed(0)}m • {profile.summary?.numGradeEvents ?? 0} grades • {profile.summary?.numKFactorEvents ?? 0} K-factors
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleLoadProfile(profile.id)}
                          data-testid={`button-load-${profile.id}`}
                        >
                          Load
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteProfile(profile.id)}
                          data-testid={`button-delete-${profile.id}`}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4">
                <Button onClick={() => setShowHistoryModal(false)} variant="outline" className="w-full">
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
