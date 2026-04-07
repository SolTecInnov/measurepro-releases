import React, { useEffect, useState } from 'react';
import { X, RefreshCw, Upload, Cloud, CloudOff, CloudUpload, Loader2, MapPin, HardDrive, Moon, Check } from 'lucide-react';
import { Survey } from '../../lib/survey/types';
import { toast } from 'sonner';
import { useSurveyStore } from '../../lib/survey';
import { getLegacyPoiCountCache, setLegacyPoiCount } from '../../lib/survey/store';
import { openSurveyDB } from '../../lib/survey/db';
import { getSyncStatus } from '../../lib/roadscope/syncService';
import { syncSurveyNow } from '../../lib/firebase/autoSync';
import { getCurrentUser } from '../../lib/firebase';

import JSZip from 'jszip';

const CAMERA_BRIDGE_URL = 'http://localhost:3001';

interface RoadScopeSyncInfo {
  synced: boolean;
  lastSyncTime?: string;
  poisSynced: number;
}

interface DiskSurveyEntry {
  surveyId: string;
  folderName: string;
  downloadedAt: number | null;
  fileCount: number;
  photoCount: number;
  surveyTitle: string | null;
  surveyor: string | null;
  manifest?: any;
  photoMeta?: any[];
}

interface SurveyListProps {
  isOpen: boolean;
  onClose: () => void;
  surveys: Survey[];
  activeSurvey: Survey | null;
  setActiveSurvey: (survey: Survey) => void;
}

const SurveyList: React.FC<SurveyListProps> = ({ 
  isOpen, 
  onClose, 
  surveys, 
  activeSurvey,
  setActiveSurvey
}) => {
  const { loadSurveys, loadPreviousSurvey } = useSurveyStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [syncStatuses, setSyncStatuses] = useState<Record<string, RoadScopeSyncInfo>>({});
  const [poiCounts, setPoiCounts] = useState<Record<string, number>>({});
  const [diskOnlySurveys, setDiskOnlySurveys] = useState<DiskSurveyEntry[]>([]);
  const [cloudSyncingIds, setCloudSyncingIds] = useState<Set<string>>(new Set());
  const [cloudSyncedIds, setCloudSyncedIds] = useState<Set<string>>(new Set());
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Load POI counts for all surveys
  // Uses denormalized poiCount when available; falls back to a single batch cursor pass
  // for legacy surveys missing the field — eliminating the O(n) countFromIndex loop.
  // Results are cached in a module-level Map so reopening the modal is instant.
  useEffect(() => {
    if (isOpen && surveys.length > 0) {
      const loadPoiCounts = async () => {
        // Seed from denormalized counts first (instant, no DB needed)
        const counts: Record<string, number> = {};
        const legacySurveyIds: string[] = [];
        const cache = getLegacyPoiCountCache();

        for (const survey of surveys) {
          if (typeof survey.poiCount === 'number') {
            counts[survey.id] = survey.poiCount;
          } else if (cache.has(survey.id)) {
            // Cache hit — reopening is instant
            counts[survey.id] = cache.get(survey.id)!;
          } else {
            counts[survey.id] = 0;
            legacySurveyIds.push(survey.id);
          }
        }

        // Immediately render what we have from denormalized/cached data
        setPoiCounts({ ...counts });

        // Only scan IndexedDB for surveys not yet in cache
        if (legacySurveyIds.length > 0) {
          try {
            const db = await openSurveyDB();
            const batchCounts: Record<string, number> = {};
            for (const id of legacySurveyIds) batchCounts[id] = 0;

            // Single transaction, single cursor scan over the by-survey index
            const tx = db.transaction('measurements', 'readonly');
            const index = tx.objectStore('measurements').index('by-survey');
            let cursor = await index.openCursor();
            while (cursor) {
              const surveyId = cursor.value.user_id as string;
              if (surveyId in batchCounts) {
                batchCounts[surveyId]++;
              }
              cursor = await cursor.continue();
            }

            // Persist results into the module-level cache
            for (const [id, count] of Object.entries(batchCounts)) {
              setLegacyPoiCount(id, count);
            }

            setPoiCounts(prev => ({ ...prev, ...batchCounts }));
          } catch {
            // Non-critical — leave zeroes in place
          }
        }
      };
      loadPoiCounts();
    }
  }, [isOpen, surveys]);

  useEffect(() => {
    if (isOpen && surveys.length > 0) {
      const loadSyncStatuses = async () => {
        const statuses: Record<string, RoadScopeSyncInfo> = {};
        for (const survey of surveys) {
          try {
            const status = await getSyncStatus(survey.id);
            if (status.synced) {
              statuses[survey.id] = {
                synced: true,
                lastSyncTime: status.lastSyncTime,
                poisSynced: status.syncedPoiCount
              };
            }
          } catch (err) {
            // Ignore errors for individual surveys
          }
        }
        setSyncStatuses(statuses);
      };
      loadSyncStatuses();
    }
  }, [isOpen, surveys]);
  
  const handleRefreshSurveys = async () => {
    setIsRefreshing(true);
    try {
      await loadSurveys();

      // Scan disk folders from camera-bridge (silently skip if unavailable)
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(`${CAMERA_BRIDGE_URL}/surveys/local-folders`, { signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.folders)) {
            // Get the latest survey IDs from IndexedDB (after loadSurveys refreshed them)
            const db = await openSurveyDB();
            const allDbSurveys: Survey[] = await db.getAll('surveys');
            const dbIds = new Set(allDbSurveys.map((s: Survey) => s.id));

            // Keep only disk folders whose surveyId is not already in IndexedDB
            const recoverable: DiskSurveyEntry[] = data.folders.filter(
              (f: DiskSurveyEntry) => !dbIds.has(f.surveyId)
            );
            setDiskOnlySurveys(recoverable);
          }
        }
      } catch {
        // Camera-bridge unavailable — skip silently
      }
    } catch (error) {
      toast.error('Failed to refresh surveys');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleImportSurvey = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      toast.loading('Importing survey package...', { id: 'import-survey' });

      const zip = new JSZip();
      const zipContent = await zip.loadAsync(file);

      let importedMeasurements = 0;
      let importedSurvey: Survey | null = null;
      const seenMeasurementIds = new Set<string>();

      // Helper to generate unique survey ID (avoid duplicates)
      const generateUniqueSurveyId = async (originalId?: string): Promise<string> => {
        const db = await openSurveyDB();
        if (originalId) {
          const existing = await db.get('surveys', originalId);
          if (!existing) return originalId;
        }
        return crypto.randomUUID();
      };

      // Helper to validate and normalize measurement
      const normalizeMeasurement = (m: any, surveyId: string): any => {
        const id = m.id || crypto.randomUUID();
        if (seenMeasurementIds.has(id)) {
          return null; // Skip duplicate
        }
        seenMeasurementIds.add(id);

        return {
          id,
          rel: typeof m.rel === 'number' ? m.rel : 0,
          altGPS: typeof m.altGPS === 'number' ? m.altGPS : 0,
          latitude: typeof m.latitude === 'number' ? m.latitude : 0,
          longitude: typeof m.longitude === 'number' ? m.longitude : 0,
          utcDate: m.utcDate || new Date().toISOString().split('T')[0],
          utcTime: m.utcTime || new Date().toTimeString().split(' ')[0],
          speed: typeof m.speed === 'number' ? m.speed : 0,
          heading: typeof m.heading === 'number' ? m.heading : 0,
          roadNumber: m.roadNumber ?? null,
          poiNumber: m.poiNumber ?? null,
          poi_type: m.poi_type || 'none',
          note: m.note || null,
          createdAt: m.createdAt || new Date().toISOString(),
          user_id: surveyId,
          imageUrl: m.imageUrl || null,
          videoUrl: m.videoUrl || null
        };
      };

      // Look for survey_metadata.json first
      const metadataFile = zipContent.file('documents/survey_metadata.json');
      if (metadataFile) {
        const metadataContent = await metadataFile.async('string');
        const metadata = JSON.parse(metadataContent);
        
        // Generate unique ID (avoid overwriting existing surveys)
        const surveyId = await generateUniqueSurveyId(metadata.id);
        
        // Create survey from metadata with proper defaults
        const db = await openSurveyDB();
        importedSurvey = {
          id: surveyId,
          name: metadata.name || metadata.surveyTitle || file.name.replace('.zip', ''),
          surveyTitle: metadata.surveyTitle || metadata.name || file.name.replace('.zip', ''),
          surveyor: metadata.surveyor || metadata.surveyorName || 'Imported',
          surveyorName: metadata.surveyorName || metadata.surveyor || 'Imported',
          clientName: metadata.clientName || metadata.customerName || 'Imported',
          customerName: metadata.customerName || metadata.clientName || 'Imported',
          projectNumber: metadata.projectNumber || '',
          originAddress: metadata.originAddress || '',
          destinationAddress: metadata.destinationAddress || '',
          description: metadata.description || `Imported from ${file.name}`,
          notes: metadata.notes || '',
          ownerEmail: metadata.ownerEmail || '',
          completionEmailList: Array.isArray(metadata.completionEmailList) ? metadata.completionEmailList : [],
          createdAt: metadata.createdAt || new Date().toISOString(),
          active: false,
          enableVehicleTrace: metadata.enableVehicleTrace ?? true,
          enableAlertLog: metadata.enableAlertLog ?? true,
          outputFiles: Array.isArray(metadata.outputFiles) ? metadata.outputFiles : ['CSV', 'JSON', 'GeoJSON'],
          cloudUploadStatus: null,
          syncId: null,
          exportTarget: null,
          convoyId: null,
          fleetUnitRole: null,
          plannedRouteId: null,
          routeAnalysis: null,
          aiUserModelId: null,
          aiHistoryScore: null,
          interventionType: null,
          checklistCompleted: false,
          // Preserve pause state so cross-device end-of-day resume works correctly
          closureReason: (['completed', 'continuation', 'error', 'end_of_day'].includes(metadata.closureReason)
            ? metadata.closureReason : null) as 'completed' | 'continuation' | 'error' | 'end_of_day' | null,
          pausedAt: metadata.pausedAt || null,
          importedAt: new Date().toISOString(),
          importedFrom: file.name
        };

        await db.put('surveys', importedSurvey);
        console.log('[Import] Survey created:', surveyId);
      }

      // Look for measurements in survey_data.json
      const dataFile = zipContent.file('documents/survey_data.json');
      if (dataFile && importedSurvey) {
        const dataContent = await dataFile.async('string');
        const data = JSON.parse(dataContent);

        if (data.measurements && Array.isArray(data.measurements)) {
          const db = await openSurveyDB();
          for (const m of data.measurements) {
            const measurement = normalizeMeasurement(m, importedSurvey.id);
            if (measurement) {
              await db.put('measurements', measurement);
              importedMeasurements++;
            }
          }
        }
      }

      // Alternatively, try to import from GeoJSON
      if (!importedSurvey) {
        const geojsonFile = zipContent.file('documents/survey_data.geojson');
        if (geojsonFile) {
          const geojsonContent = await geojsonFile.async('string');
          const geojson = JSON.parse(geojsonContent);

          // Create a new survey from geojson metadata
          const surveyId = crypto.randomUUID();
          const db = await openSurveyDB();
          
          importedSurvey = {
            id: surveyId,
            name: file.name.replace('.zip', ''),
            surveyTitle: file.name.replace('.zip', ''),
            surveyor: 'Imported',
            surveyorName: 'Imported',
            clientName: 'Imported',
            customerName: 'Imported',
            projectNumber: '',
            originAddress: '',
            destinationAddress: '',
            description: `Imported from ${file.name}`,
            notes: '',
            ownerEmail: '',
            completionEmailList: [],
            createdAt: new Date().toISOString(),
            active: false,
            enableVehicleTrace: true,
            enableAlertLog: true,
            outputFiles: ['CSV', 'JSON', 'GeoJSON'],
            cloudUploadStatus: null,
            syncId: null,
            exportTarget: null,
            convoyId: null,
            fleetUnitRole: null,
            plannedRouteId: null,
            routeAnalysis: null,
            aiUserModelId: null,
            aiHistoryScore: null,
            interventionType: null,
            checklistCompleted: false
          };

          await db.put('surveys', importedSurvey);
          console.log('[Import] Survey created from GeoJSON:', surveyId);

          // Import features as measurements
          if (geojson.features && Array.isArray(geojson.features)) {
            for (const feature of geojson.features) {
              if (feature.geometry?.type === 'Point' && feature.properties) {
                const props = feature.properties;
                const measurement = normalizeMeasurement({
                  id: props.id,
                  rel: props.height,
                  altGPS: props.altitude,
                  latitude: feature.geometry.coordinates[1],
                  longitude: feature.geometry.coordinates[0],
                  utcDate: props.date,
                  utcTime: props.time,
                  speed: props.speed,
                  heading: props.heading,
                  roadNumber: props.roadNumber,
                  poiNumber: props.poiNumber,
                  poi_type: props.poiType,
                  note: props.note,
                  createdAt: props.createdAt
                }, surveyId);
                
                if (measurement) {
                  await db.put('measurements', measurement);
                  importedMeasurements++;
                }
              }
            }
          }
        }
      }

      // Refresh the surveys list
      await loadSurveys();

      toast.dismiss('import-survey');
      
      if (!importedSurvey) {
        toast.error('Could not find survey data in the ZIP file');
      }
    } catch (error) {
      console.error('[Import] Failed:', error);
      toast.error('Failed to import survey', {
        id: 'import-survey',
        description: (error as Error).message
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleLoadDiskSurvey = async (diskEntry: DiskSurveyEntry) => {
    try {
      toast.loading('Recovering survey from disk...', { id: 'recover-disk-survey' });

      // Fetch full folder details from camera-bridge
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${CAMERA_BRIDGE_URL}/surveys/local-folders/${diskEntry.surveyId}`, {
        signal: controller.signal
      });
      clearTimeout(timer);

      let folder: DiskSurveyEntry = diskEntry;
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.folder) folder = data.folder;
      }

      const db = await openSurveyDB();

      // Deactivate current active survey if any
      if (activeSurvey) {
        await db.put('surveys', { ...activeSurvey, active: false });
      }

      // Build a minimal Survey record from folder metadata
      const manifest = folder.manifest ?? {};
      const recoveredSurvey: Survey = {
        id: folder.surveyId,
        name: manifest.surveyTitle || manifest.name || folder.surveyTitle || folder.folderName,
        surveyTitle: manifest.surveyTitle || manifest.name || folder.surveyTitle || folder.folderName,
        surveyor: manifest.surveyor || manifest.surveyorName || folder.surveyor || 'Recovered',
        surveyorName: manifest.surveyorName || manifest.surveyor || folder.surveyor || 'Recovered',
        clientName: manifest.clientName || manifest.customerName || 'Recovered',
        customerName: manifest.customerName || manifest.clientName || 'Recovered',
        projectNumber: manifest.projectNumber || '',
        originAddress: manifest.originAddress || '',
        destinationAddress: manifest.destinationAddress || '',
        description: manifest.description || `Recovered from disk folder: ${folder.folderName}`,
        notes: manifest.notes || '',
        ownerEmail: manifest.ownerEmail || '',
        completionEmailList: Array.isArray(manifest.completionEmailList) ? manifest.completionEmailList : [],
        createdAt: folder.downloadedAt ? new Date(folder.downloadedAt).toISOString() : new Date().toISOString(),
        active: true,
        enableVehicleTrace: manifest.enableVehicleTrace ?? true,
        enableAlertLog: manifest.enableAlertLog ?? true,
        outputFiles: Array.isArray(manifest.outputFiles) ? manifest.outputFiles : ['CSV', 'JSON', 'GeoJSON'],
        cloudUploadStatus: null,
        syncId: null,
        exportTarget: null,
        convoyId: null,
        fleetUnitRole: null,
        plannedRouteId: null,
        routeAnalysis: null,
        aiUserModelId: null,
        aiHistoryScore: null,
        interventionType: null,
        checklistCompleted: false,
        rootSurveyId: folder.surveyId,
        partOrdinal: 1,
        partLabel: null,
        maxPoiPerPart: null,
        poiCount: folder.photoCount,
        closureReason: null
      };

      await db.put('surveys', recoveredSurvey);

      setActiveSurvey(recoveredSurvey);
      setDiskOnlySurveys(prev => prev.filter(d => d.surveyId !== diskEntry.surveyId));

      // Refresh the full list so the recovered survey appears normally
      await loadSurveys();

      window.dispatchEvent(new CustomEvent('dbchange'));
      toast.dismiss('recover-disk-survey');
      // toast suppressed
      onClose();
    } catch (error) {
      toast.error('Failed to recover survey from disk', {
        id: 'recover-disk-survey',
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const handleSaveToCloud = async (e: React.MouseEvent, survey: Survey) => {
    e.stopPropagation();

    const user = getCurrentUser();
    if (!user) {
      toast.error('Sign in to save to cloud', {
        description: 'You need to be signed in to upload surveys to the cloud.'
      });
      return;
    }

    setCloudSyncingIds(prev => new Set(prev).add(survey.id));
    try {
      const success = await syncSurveyNow(survey.id);
      if (success) {
        setCloudSyncedIds(prev => new Set(prev).add(survey.id));
        await loadSurveys();
      }
    } finally {
      setCloudSyncingIds(prev => {
        const next = new Set(prev);
        next.delete(survey.id);
        return next;
      });
    }
  };

  const handleLoadSurvey = async (survey: Survey) => {
    try {
      // Use the store's loadPreviousSurvey action — it handles end-of-day resume
      // (logs DAY_RESUME POI, clears pausedAt/closureReason) and crash recovery consistently
      await loadPreviousSurvey(survey.id);
      
      // Close the survey list
      onClose();
      
      // toast suppressed
      
    } catch (error) {
      toast.error('Failed to load survey', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl w-full max-w-3xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold">Load Previous Survey</h3>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              onChange={handleImportSurvey}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs"
              title="Import survey from exported ZIP"
              data-testid="button-import-survey"
            >
              <Upload className={`w-3 h-3 ${isImporting ? 'animate-pulse' : ''}`} />
              {isImporting ? 'Importing...' : 'Import ZIP'}
            </button>
            <button
              onClick={handleRefreshSurveys}
              disabled={isRefreshing}
              className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
              title="Refresh survey list"
              data-testid="button-refresh-surveys"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-300">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {surveys.length === 0 && diskOnlySurveys.length === 0 ? (
          <div className="text-center py-8 bg-yellow-500/20 border-l-4 border-yellow-500 p-4 rounded">
            <p className="text-yellow-500 font-bold">No surveys found</p>
            <p className="text-gray-300 mt-2">Create a new survey to get started</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            {surveys.map((survey) => (
              <div 
                key={survey.id} 
                className={`p-4 rounded-lg border ${
                  survey.active ? 'border-green-500 bg-green-500/10' : 'border-gray-700 bg-gray-700/50'
                } hover:border-blue-500 cursor-pointer transition-colors`}
                onClick={() => handleLoadSurvey(survey)}
                data-testid={`card-survey-${survey.id}`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-medium text-lg flex items-center gap-2">
                      {survey.name || survey.surveyTitle}
                      {survey.partOrdinal && survey.partOrdinal > 1 && (
                        <span className="bg-blue-500/30 text-blue-300 text-xs px-2 py-0.5 rounded-full">
                          Part {survey.partOrdinal}
                        </span>
                      )}
                    </h4>
                    <p className="text-gray-400 text-sm flex items-center gap-2">
                      {new Date(survey.createdAt).toLocaleDateString()} • {survey.surveyor || survey.surveyorName}
                      {poiCounts[survey.id] !== undefined && (
                        <span className="inline-flex items-center gap-1 bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded text-xs" data-testid={`poi-count-${survey.id}`}>
                          <MapPin className="w-3 h-3" />
                          {poiCounts[survey.id]} POIs
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {/* Cloud sync status badge + Save to Cloud button */}
                    {(survey.cloudUploadStatus === 'synced' || cloudSyncedIds.has(survey.id)) ? (
                      <div
                        className="bg-green-500/20 text-green-300 text-xs px-2 py-1 rounded-full flex items-center gap-1"
                        title="Saved to cloud"
                        data-testid={`badge-cloud-synced-${survey.id}`}
                      >
                        <Check className="w-3 h-3" />
                        Saved
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <div
                          className="bg-amber-500/20 text-amber-300 text-xs px-2 py-1 rounded-full flex items-center gap-1"
                          title="Not yet saved to cloud"
                          data-testid={`badge-not-synced-${survey.id}`}
                        >
                          <CloudOff className="w-3 h-3" />
                          Not saved
                        </div>
                        <button
                          onClick={(e) => handleSaveToCloud(e, survey)}
                          disabled={cloudSyncingIds.has(survey.id)}
                          className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs font-medium transition-colors"
                          title="Upload this survey to the cloud"
                          data-testid={`button-save-to-cloud-${survey.id}`}
                        >
                          {cloudSyncingIds.has(survey.id) ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <CloudUpload className="w-3 h-3" />
                          )}
                          {cloudSyncingIds.has(survey.id) ? 'Saving...' : 'Save to Cloud'}
                        </button>
                      </div>
                    )}
                    {syncStatuses[survey.id]?.synced && (
                      <div 
                        className="bg-purple-500/30 text-purple-300 text-xs px-2 py-1 rounded-full flex items-center gap-1"
                        title={`RoadScope synced: ${syncStatuses[survey.id].poisSynced} POIs`}
                        data-testid={`badge-roadscope-sync-${survey.id}`}
                      >
                        <Cloud className="w-3 h-3" />
                        RS {syncStatuses[survey.id].lastSyncTime 
                          ? new Date(syncStatuses[survey.id].lastSyncTime!).toLocaleDateString(undefined, { 
                              month: 'short', 
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : 'Synced'}
                      </div>
                    )}
                    {survey.closureReason === 'end_of_day' && (
                      <div 
                        className="bg-amber-500/30 text-amber-300 text-xs px-2 py-1 rounded-full flex items-center gap-1"
                        title={survey.pausedAt ? `Paused on ${new Date(survey.pausedAt).toLocaleDateString()}` : 'Paused for end of day'}
                        data-testid={`badge-end-of-day-${survey.id}`}
                      >
                        <Moon className="w-3 h-3" />
                        Paused — End of Day
                        {survey.pausedAt && (
                          <span className="ml-1">
                            {new Date(survey.pausedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                    )}
                    {survey.closureReason === 'continuation' && (
                      <div className="bg-yellow-500/30 text-yellow-300 text-xs px-2 py-1 rounded-full">
                        Continued
                      </div>
                    )}
                    {survey.closureReason === 'completed' && (
                      <div className="bg-gray-500/30 text-gray-300 text-xs px-2 py-1 rounded-full">
                        Completed
                      </div>
                    )}
                    {survey.active && (
                      <div className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                        Active
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-2 text-sm text-gray-300">
                  {survey.description}
                </div>
              </div>
            ))}

            {/* Disk-only recoverable surveys */}
            {diskOnlySurveys.length > 0 && (
              <>
                <div className="pt-2 pb-1 border-t border-gray-600">
                  <p className="text-xs text-gray-400 uppercase tracking-wide flex items-center gap-1">
                    <HardDrive className="w-3 h-3" />
                    Recoverable from disk
                  </p>
                </div>
                {diskOnlySurveys.map((diskEntry) => (
                  <div
                    key={diskEntry.surveyId}
                    className="p-4 rounded-lg border border-orange-700 bg-orange-900/20 hover:border-orange-500 cursor-pointer transition-colors"
                    onClick={() => handleLoadDiskSurvey(diskEntry)}
                    data-testid={`card-disk-survey-${diskEntry.surveyId}`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-medium text-lg flex items-center gap-2">
                          {diskEntry.surveyTitle || diskEntry.manifest?.surveyTitle || diskEntry.manifest?.name || diskEntry.folderName}
                          <span className="bg-orange-500/30 text-orange-300 text-xs px-2 py-0.5 rounded-full flex items-center gap-1" data-testid={`badge-recoverable-${diskEntry.surveyId}`}>
                            <HardDrive className="w-3 h-3" />
                            Recoverable
                          </span>
                        </h4>
                        <p className="text-gray-400 text-sm flex items-center gap-2">
                          {diskEntry.downloadedAt
                            ? new Date(diskEntry.downloadedAt).toLocaleDateString()
                            : 'Unknown date'}{' '}
                          • {diskEntry.fileCount} files • {diskEntry.photoCount} photos
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-orange-400">Click to recover</span>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
        
        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default SurveyList;