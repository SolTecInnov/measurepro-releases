/**
 * Alignment Manager Component
 * Create, load, and manage alignments and linked profiles
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Plus, Route, FileDown, Trash2, Link, Eye, MapPinned
} from 'lucide-react';
import type { Alignment, LinkedProfile, LatLon, LinkedProfileSample, LinkedProfileMetadata } from '@/lib/alignment/types';
import type { RoadProfile, ProfilePoint } from '../../../server/gnss/types';
import { 
  saveAlignment, 
  getAllAlignments, 
  deleteAlignment, 
  saveLinkedProfile,
  getProfilesByAlignment,
  createNewAlignment,
  generateProfileId
} from '@/lib/alignment/storage';
import { simplifyPolyline, projectPointToPolyline, detectLoopsAndBacktracking, computePolylineCumDist } from '@/lib/alignment/geometry';
import { exportAlignmentAsGeoJSON } from '@/lib/alignment/exports';
import { toast } from 'sonner';

interface AlignmentManagerProps {
  projectId: string;
  userId: string;
  onSelectLinkedSet: (alignment: Alignment, profile: LinkedProfile) => void;
  currentRecordedPath?: LatLon[];
  recordedProfile?: RoadProfile | null;
}

export function AlignmentManager({
  projectId,
  userId,
  onSelectLinkedSet,
  currentRecordedPath,
  recordedProfile
}: AlignmentManagerProps) {
  const [alignments, setAlignments] = useState<Alignment[]>([]);
  const [profileCounts, setProfileCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [newAlignmentName, setNewAlignmentName] = useState('');
  const [simplifyTolerance, setSimplifyTolerance] = useState(2);
  const [selectedAlignmentId, setSelectedAlignmentId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    loadAlignments();
  }, [projectId]);

  const loadAlignments = async () => {
    setLoading(true);
    try {
      const all = await getAllAlignments();
      const projectAlignments = all.filter(a => a.projectId === projectId);
      setAlignments(projectAlignments);

      // Batch fetch profile counts in parallel
      const countPromises = projectAlignments.map(async (alignment) => {
        const profiles = await getProfilesByAlignment(alignment.id);
        return { alignmentId: alignment.id, count: profiles.length };
      });
      
      const results = await Promise.all(countPromises);
      const counts: Record<string, number> = {};
      for (const { alignmentId, count } of results) {
        counts[alignmentId] = count;
      }
      setProfileCounts(counts);
    } catch (e) {
      console.error('[AlignmentManager] Failed to load alignments:', e);
      toast.error('Failed to load alignments');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFromPath = async () => {
    if (!currentRecordedPath || currentRecordedPath.length < 2) {
      toast.error('No recorded path available');
      return;
    }

    if (!newAlignmentName.trim()) {
      toast.error('Please enter an alignment name');
      return;
    }

    try {
      const simplified = simplifyPolyline(currentRecordedPath, simplifyTolerance);
      const cumDistM = computePolylineCumDist(simplified);
      
      // Check for loops and backtracking
      const { hasLoop, hasBacktrack, warnings } = detectLoopsAndBacktracking(simplified, cumDistM);
      
      // Show warnings if detected (toast suppressed)
      
      const alignment = createNewAlignment(
        projectId,
        newAlignmentName.trim(),
        simplified,
        userId
      );

      await saveAlignment(alignment);
      
      if (recordedProfile && recordedProfile.points.length > 0) {
        const linkedProfile = createLinkedProfileFromRoadProfile(
          recordedProfile,
          alignment,
          newAlignmentName.trim() + ' Profile'
        );
        await saveLinkedProfile(linkedProfile);
        
        const statusMsg = hasLoop || hasBacktrack 
          ? `Created alignment with ${simplified.length} vertices and linked profile (warnings detected)`
          : `Created alignment with ${simplified.length} vertices and linked profile`;
        // toast suppressed
      } else {
        const statusMsg = hasLoop || hasBacktrack
          ? `Created alignment with ${simplified.length} vertices (warnings detected)`
          : `Created alignment with ${simplified.length} vertices`;
        // toast suppressed
      }
      
      setCreateDialogOpen(false);
      setNewAlignmentName('');
      loadAlignments();
    } catch (e) {
      console.error('[AlignmentManager] Failed to create alignment:', e);
      toast.error('Failed to create alignment');
    }
  };

  const createLinkedProfileFromRoadProfile = (
    roadProfile: RoadProfile,
    alignment: Alignment,
    name: string
  ): LinkedProfile => {
    const samples: LinkedProfileSample[] = roadProfile.points.map((point: ProfilePoint) => {
      const projected = projectPointToPolyline(
        { lat: point.latitude, lon: point.longitude },
        alignment.polyline,
        alignment.cumDistM
      );

      return {
        s_m: projected.s_m,
        lat: point.latitude,
        lon: point.longitude,
        time: point.timestamp,
        altitude_raw_m: point.altitude,
        altitude_selected_m: point.altitude,
        altitude_corrected_m: point.altitude,
        grade_pct: point.grade_pct,
        k_factor: point.k_factor ?? null,
        curvature_type: point.curvature_type ?? null,
        lateralOffset_m: projected.offset_m,
        hdop: null,
        num_sats: null,
        speed_mps: null,
        heading_deg: null,
      };
    });

    const metadata: LinkedProfileMetadata = {
      altitudeStrategy: 'prefer_msl',
      altitudeOffsetM: 0,
      axisMapping: null,
      buildVersion: '1.0.0',
      createdAt: new Date().toISOString(),
      deviceId: undefined,
      mountName: undefined,
    };

    return {
      id: generateProfileId(),
      projectId,
      name,
      alignmentId: alignment.id,
      samples,
      metadata,
      cloudSynced: false,
    };
  };

  const handleLinkExistingProfile = async () => {
    if (!selectedAlignmentId || !recordedProfile) {
      toast.error('Select an alignment and ensure a profile is available');
      return;
    }

    const alignment = alignments.find(a => a.id === selectedAlignmentId);
    if (!alignment) {
      toast.error('Alignment not found');
      return;
    }

    try {
      const linkedProfile = createLinkedProfileFromRoadProfile(
        recordedProfile,
        alignment,
        `${alignment.name} - Profile ${Date.now()}`
      );
      await saveLinkedProfile(linkedProfile);
      // toast suppressed
      setLinkDialogOpen(false);
      loadAlignments();
    } catch (e) {
      console.error('[AlignmentManager] Failed to link profile:', e);
      toast.error('Failed to link profile');
    }
  };

  const handleDeleteAlignment = async (id: string) => {
    try {
      const result = await deleteAlignment(id);
      if (result.profilesAffected > 0) {
        /* toast removed */
      } else {
        // toast suppressed
      }
      setDeleteConfirmId(null);
      loadAlignments();
    } catch (e) {
      console.error('[AlignmentManager] Failed to delete alignment:', e);
      toast.error('Failed to delete alignment');
    }
  };

  const handleViewAlignment = async (alignment: Alignment) => {
    const profiles = await getProfilesByAlignment(alignment.id);
    if (profiles.length === 0) {
      // toast suppressed
      return;
    }
    onSelectLinkedSet(alignment, profiles[0]);
  };

  const formatLength = (meters: number): string => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${meters.toFixed(0)} m`;
  };

  const formatDate = (iso: string): string => {
    const date = new Date(iso);
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="py-8 text-center text-gray-500">
          Loading alignments...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-800/50 border-gray-700" data-testid="card-alignment-manager">
      <CardHeader className="py-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <Route className="w-4 h-4 text-blue-400" />
          Alignments & Linked Profiles
        </CardTitle>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!currentRecordedPath || currentRecordedPath.length < 2}
            onClick={() => setCreateDialogOpen(true)}
            data-testid="button-create-alignment"
          >
            <Plus className="h-4 w-4 mr-1" />
            Create from Path
          </Button>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Alignment from Driven Path</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Alignment Name</Label>
                  <Input
                    value={newAlignmentName}
                    onChange={(e) => setNewAlignmentName(e.target.value)}
                    placeholder="e.g., Main Route Section A"
                    className="bg-gray-900 border-gray-700"
                    data-testid="input-alignment-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Simplification Tolerance (meters)</Label>
                  <Input
                    type="number"
                    value={simplifyTolerance}
                    onChange={(e) => setSimplifyTolerance(Number(e.target.value))}
                    min={0.5}
                    max={50}
                    step={0.5}
                    className="bg-gray-900 border-gray-700"
                    data-testid="input-simplify-tolerance"
                  />
                  <p className="text-xs text-gray-400">
                    Higher values = fewer vertices. Original: {currentRecordedPath?.length || 0} points
                  </p>
                </div>
                {recordedProfile && recordedProfile.points && recordedProfile.points.length > 0 && (
                  <div className="p-2 bg-green-900/30 border border-green-700 rounded text-sm">
                    Profile will be automatically linked ({recordedProfile.points.length} samples)
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateFromPath} data-testid="button-confirm-create">
                  Create Alignment
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            size="sm"
            disabled={!recordedProfile || alignments.length === 0}
            onClick={() => setLinkDialogOpen(true)}
            data-testid="button-link-profile"
          >
            <Link className="h-4 w-4 mr-1" />
            Link to Alignment
          </Button>
          <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Link Profile to Existing Alignment</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Select Alignment</Label>
                  <Select value={selectedAlignmentId || ''} onValueChange={setSelectedAlignmentId}>
                    <SelectTrigger className="bg-gray-900 border-gray-700">
                      <SelectValue placeholder="Choose an alignment..." />
                    </SelectTrigger>
                    <SelectContent>
                      {alignments.map(a => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name} ({formatLength(a.cumDistM[a.cumDistM.length - 1] || 0)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-sm text-gray-400">
                  Each profile sample will be projected onto the alignment to compute station values.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleLinkExistingProfile} data-testid="button-confirm-link">
                  Link Profile
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent className="py-2">
        {alignments.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <MapPinned className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No alignments yet</p>
            <p className="text-xs mt-1">Record a path and create an alignment</p>
          </div>
        ) : (
          <div className="space-y-2">
            {alignments.map(alignment => (
              <div
                key={alignment.id}
                className="p-3 bg-gray-900/50 rounded border border-gray-700 flex items-center justify-between"
                data-testid={`alignment-item-${alignment.id}`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{alignment.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {formatLength(alignment.cumDistM[alignment.cumDistM.length - 1] || 0)}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {alignment.polyline.length} vertices
                    </Badge>
                    {profileCounts[alignment.id] > 0 && (
                      <Badge className="bg-blue-600 text-xs">
                        {profileCounts[alignment.id]} profile(s)
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Created: {formatDate(alignment.createdAt)} by {alignment.createdBy}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewAlignment(alignment)}
                    disabled={!profileCounts[alignment.id]}
                    data-testid={`button-view-${alignment.id}`}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => exportAlignmentAsGeoJSON(alignment)}
                    data-testid={`button-export-${alignment.id}`}
                  >
                    <FileDown className="h-4 w-4" />
                  </Button>
                  {deleteConfirmId === alignment.id ? (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteAlignment(alignment.id)}
                        data-testid={`button-confirm-delete-${alignment.id}`}
                      >
                        Confirm
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteConfirmId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteConfirmId(alignment.id)}
                      data-testid={`button-delete-${alignment.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
