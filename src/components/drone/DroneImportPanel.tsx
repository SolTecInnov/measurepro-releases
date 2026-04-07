/**
 * DroneImportPanel
 * Full import workflow: scan → preview → match → confirm → import
 */
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { X, ScanEye, HardDrive, Image, MapPin, CheckCircle, AlertCircle, Loader2, RefreshCw, Camera } from 'lucide-react';
import { useSurveyStore } from '@/lib/survey';
import { openSurveyDB } from '@/lib/survey/db';

interface DjiDevice {
  driveLetter: string; drivePath: string; driveLabel: string;
  dcimPath: string; imageCount: number; deviceType: string;
}

interface ImportGroup {
  groupId: string; images: any[]; centroid: { lat: number; lon: number };
  imageCount: number; altitudeRange: any; matchedPoi: any; suggestedName: string;
}

interface Props {
  initialDevice?: DjiDevice | null;
  onClose: () => void;
}

export function DroneImportPanel({ initialDevice, onClose }: Props) {
  const { activeSurvey } = useSurveyStore();
  const api = (window as any).electronAPI?.drone;

  const [phase, setPhase] = useState<'scan' | 'preview' | 'match' | 'import' | 'done'>('scan');
  const [devices, setDevices] = useState<DjiDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<DjiDevice | null>(initialDevice || null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [groups, setGroups] = useState<ImportGroup[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<any[]>([]);
  const [skipped, setSkipped] = useState<any[]>([]);
  const [duplicatesSkipped, setDuplicatesSkipped] = useState(0);

  // Scan for devices on mount
  useEffect(() => {
    scanDevices();
    api?.onProgress((p: any) => setProgress({ current: p.current, total: p.total }));
    return () => api?.removeListeners?.();
  }, []);

  // Auto-start if device provided
  useEffect(() => {
    if (initialDevice) {
      setSelectedDevice(initialDevice);
      startPreview(initialDevice);
    }
  }, [initialDevice]);

  const scanDevices = async () => {
    if (!api) return;
    const found = await api.scan();
    setDevices(found);
    if (found.length === 0 && !initialDevice) {
      setPhase('scan');
    }
  };

  const startPreview = async (device: DjiDevice) => {
    if (!api || !activeSurvey) return;
    setPhase('preview');
    setProgress({ current: 0, total: device.imageCount });

    try {
      const { images, skipped: sk, total } = await api.preview({ dcimPath: device.dcimPath });
      setSkipped(sk);

      // Load existing POIs for matching
      let existingPois: any[] = [];
      try {
        const db = await openSurveyDB();
        existingPois = await db.getAllFromIndex('measurements', 'by-survey', activeSurvey.id);
      } catch(e) {}

      const { groups: matched, duplicatesSkipped: dups } = await api.match({ images, existingPois });
      setDuplicatesSkipped(dups);
      setGroups(matched);
      setSelectedGroups(new Set(matched.map((g: ImportGroup) => g.groupId)));
      setPhase('match');
    } catch(e: any) {
      toast.error('Import failed', { description: e.message });
      setPhase('scan');
    }
  };

  const runImport = async () => {
    if (!api || !activeSurvey) return;
    setImporting(true);
    setPhase('import');
    const results: any[] = [];

    for (const group of groups) {
      if (!selectedGroups.has(group.groupId)) continue;

      const poiId = group.matchedPoi?.id || `drone_${Date.now()}_${group.groupId}`;
      const result = await api.importGroup({
        group,
        surveyId: activeSurvey.id,
        poiId,
        poiType: group.matchedPoi?.poi_type || 'drone',
      });
      results.push(result);
    }

    setImportResults(results);
    setImporting(false);
    setPhase('done');

    const totalImported = results.reduce((n, r) => n + r.imported.length, 0);
    // toast suppressed
  };

  const totalImages = groups
    .filter(g => selectedGroups.has(g.groupId))
    .reduce((n, g) => n + g.imageCount, 0);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[500] p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 rounded-lg">
              <ScanEye className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-white font-semibold">Drone Image Import</h2>
              <p className="text-gray-400 text-xs">
                {phase === 'scan' && 'Connect SD card or DJI device via USB-C'}
                {phase === 'preview' && `Scanning ${progress.total} images...`}
                {phase === 'match' && `${groups.length} location groups found`}
                {phase === 'import' && 'Importing...'}
                {phase === 'done' && 'Import complete!'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* SCAN phase */}
          {phase === 'scan' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-gray-300 text-sm">Detected DJI devices:</p>
                <button onClick={scanDevices} className="flex items-center gap-1 text-blue-400 text-xs hover:text-blue-300">
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>

              {devices.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <HardDrive className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p>No DJI device detected</p>
                  <p className="text-xs mt-1">Insert SD card or connect drone via USB-C</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {devices.map(d => (
                    <button
                      key={d.driveLetter}
                      onClick={() => { setSelectedDevice(d); startPreview(d); }}
                      className="w-full flex items-center gap-3 p-3 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-600 text-left transition-colors"
                    >
                      <HardDrive className="w-5 h-5 text-blue-400 shrink-0" />
                      <div className="flex-1">
                        <p className="text-white text-sm font-medium">{d.deviceType}</p>
                        <p className="text-gray-400 text-xs">{d.driveLetter} — {d.imageCount} photos</p>
                      </div>
                      <span className="text-blue-400 text-sm">Import →</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PREVIEW phase */}
          {phase === 'preview' && (
            <div className="text-center py-8">
              <Loader2 className="w-10 h-10 mx-auto mb-3 text-blue-400 animate-spin" />
              <p className="text-white">Scanning images...</p>
              <p className="text-gray-400 text-sm mt-1">
                {progress.current} / {progress.total}
              </p>
              <div className="mt-3 bg-gray-800 rounded-full h-2 mx-auto w-48">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${progress.total ? (progress.current / progress.total * 100) : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* MATCH phase */}
          {phase === 'match' && (
            <div className="space-y-3">
              {duplicatesSkipped > 0 && (
                <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg px-3 py-2 text-yellow-300 text-sm">
                  {duplicatesSkipped} duplicate image{duplicatesSkipped !== 1 ? 's' : ''} skipped (already imported)
                </div>
              )}
              {skipped.length > 0 && (
                <div className="bg-gray-800 rounded-lg px-3 py-2 text-gray-400 text-sm">
                  {skipped.length} image{skipped.length !== 1 ? 's' : ''} skipped (no GPS data)
                </div>
              )}

              {groups.map(group => (
                <div
                  key={group.groupId}
                  className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                    selectedGroups.has(group.groupId)
                      ? 'border-blue-500 bg-blue-900/20'
                      : 'border-gray-600 bg-gray-800/50'
                  }`}
                  onClick={() => {
                    const next = new Set(selectedGroups);
                    if (next.has(group.groupId)) next.delete(group.groupId);
                    else next.add(group.groupId);
                    setSelectedGroups(next);
                  }}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedGroups.has(group.groupId)}
                      onChange={() => {}}
                      className="mt-1 accent-blue-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Image className="w-4 h-4 text-blue-400" />
                        <p className="text-white text-sm font-medium">{group.suggestedName}</p>
                        <span className="text-gray-400 text-xs">{group.imageCount} photos</span>
                      </div>
                      <div className="flex items-center gap-4 mt-1">
                        <p className="text-gray-400 text-xs flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {group.centroid.lat.toFixed(5)}, {group.centroid.lon.toFixed(5)}
                        </p>
                        {group.altitudeRange && (
                          <p className="text-gray-400 text-xs">
                            Alt: {group.altitudeRange.min}–{group.altitudeRange.max}m
                          </p>
                        )}
                      </div>
                      {group.matchedPoi ? (
                        <p className="text-green-400 text-xs mt-1">
                          ✓ Matched to existing POI ({group.matchedPoi.distanceM}m away)
                        </p>
                      ) : (
                        <p className="text-blue-400 text-xs mt-1">
                          + New Drone POI will be created
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {groups.length === 0 && (
                <div className="text-center py-6 text-gray-500">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No valid GPS images found</p>
                </div>
              )}
            </div>
          )}

          {/* IMPORT phase */}
          {phase === 'import' && (
            <div className="text-center py-8">
              <Loader2 className="w-10 h-10 mx-auto mb-3 text-green-400 animate-spin" />
              <p className="text-white">Importing {totalImages} images...</p>
              <p className="text-gray-400 text-sm mt-1">Copying to survey storage</p>
            </div>
          )}

          {/* DONE phase */}
          {phase === 'done' && (
            <div className="text-center py-6">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
              <p className="text-white font-semibold text-lg">Import Complete!</p>
              <p className="text-gray-400 text-sm mt-1">
                {importResults.reduce((n, r) => n + r.imported.length, 0)} images imported to survey
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 flex justify-between items-center">
          <p className="text-gray-500 text-xs">
            {phase === 'match' && groups.length > 0 && `${selectedGroups.size} group${selectedGroups.size !== 1 ? 's' : ''} selected — ${totalImages} images`}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors">
              {phase === 'done' ? 'Close' : 'Cancel'}
            </button>
            {phase === 'match' && groups.length > 0 && selectedGroups.size > 0 && (
              <button
                onClick={runImport}
                disabled={importing}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <ScanEye className="w-4 h-4" />
                Import {totalImages} photos
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
