import { create } from 'zustand';
import { useGPSStore } from '../stores/gpsStore';
import { toast } from 'sonner';
import { Survey, Route, Alert, VehicleTrace, SurveyStore } from './types';
import { openSurveyDB, initCSVBackupDB, getSurveysPaginated, perfLog } from './db';
import { autoSaveSurvey } from '../utils/autoSaveUtils';
import { deleteAllMeasurements } from './measurements';
import { getMeasurementLogger } from '../workers/MeasurementLoggerClient';
import { getMeasurementFeed } from './MeasurementFeed';
import { DEFAULT_AUTO_PART_THRESHOLD } from './constants';
import { exportSurveyFunction as exportSurveyFn } from './export';
import { getCurrentUser, importSurveysFromFirebase } from '@/lib/firebase';
import { getStorageQuota } from '@/lib/utils/storageManager';
import { cleanupEmergencyData } from '@/lib/utils/storageCleanup';
import { startCheckpointTimer, stopCheckpointTimer } from './checkpoints';
import { onSurveyClose } from '@/lib/firebase/autoSync';

/**
 * Store-level cache for legacy survey POI counts.
 * Populated by SurveyList on first modal open (single cursor pass).
 * Subsequent opens read from here — no IndexedDB re-scan needed.
 */
const legacyPoiCountCache = new Map<string, number>();

export function getLegacyPoiCountCache(): ReadonlyMap<string, number> {
  return legacyPoiCountCache;
}

export function setLegacyPoiCount(surveyId: string, count: number): void {
  legacyPoiCountCache.set(surveyId, count);
}

export function clearLegacyPoiCountCache(): void {
  legacyPoiCountCache.clear();
}

/**
 * Check quota before save operation to prevent QuotaExceededError
 * Requires at least 10MB free OR 10% of quota, whichever is larger
 */
async function checkQuotaBeforeSave(_estimatedSize: number = 1024 * 1024): Promise<boolean> {
  try {
    const quota = await getStorageQuota();
    const available = quota.available;
    
    // Require at least 10MB free OR 10% of quota, whichever is larger
    const minRequired = Math.max(10 * 1024 * 1024, quota.quota * 0.1);
    
    if (available < minRequired) {
      toast.error('Storage space critically low', {
        description: `Only ${(available / (1024**3)).toFixed(2)} GB available. Please free up space or sync to cloud.`
      });
      return false;
    }
    
    return true;
  } catch (e) {
    return true; // Allow save if quota check fails
  }
}

export const useSurveyStore = create<SurveyStore>((set, get) => ({
  activeSurvey: null,
  currentRoute: null,
  surveys: [], 
  routes: [],
  alerts: [],
  vehicleTraces: [],
  setActiveSurvey: (survey) => set({ activeSurvey: survey }),
  setCurrentRoute: (route) => set({ currentRoute: route }),
  setSurveys: (surveys) => set({ surveys }),
  setRoutes: (routes) => set({ routes }),
  setAlerts: (alerts) => set({ alerts }),
  setVehicleTraces: (traces) => set({ vehicleTraces: traces }),
  
  createSurvey: async (surveyData) => {
    try {
      
      // Check storage quota before attempting to save
      if (!(await checkQuotaBeforeSave())) {
        throw new Error('Insufficient storage space');
      }
      
      // Validate required fields
      if (!surveyData.surveyTitle && !surveyData.name) {
        throw new Error('Survey title is required');
      }
      if (!surveyData.surveyorName && !surveyData.surveyor) {
        throw new Error('Surveyor name is required');
      }
      if (!surveyData.clientName && !surveyData.customerName) {
        throw new Error('Client name is required');
      }
      
      const survey: Survey = {
        id: crypto.randomUUID(),
        surveyTitle: surveyData.surveyTitle || surveyData.name || '',
        name: surveyData.name || surveyData.surveyTitle || '',
        surveyorName: surveyData.surveyorName || surveyData.surveyor || '',
        surveyor: surveyData.surveyor || surveyData.surveyorName || '',
        clientName: surveyData.clientName || surveyData.customerName || '',
        customerName: surveyData.customerName || surveyData.clientName || '',
        projectNumber: surveyData.projectNumber || '',
        originAddress: surveyData.originAddress || '',
        destinationAddress: surveyData.destinationAddress || '',
        description: surveyData.description || '',
        notes: surveyData.notes || '',
        ownerEmail: surveyData.ownerEmail || '',
        completionEmailList: surveyData.completionEmailList || [],
        enableVehicleTrace: surveyData.enableVehicleTrace !== undefined ? surveyData.enableVehicleTrace : true,
        enableAlertLog: surveyData.enableAlertLog !== undefined ? surveyData.enableAlertLog : true,
        createdAt: new Date().toISOString(),
        active: true,
        outputFiles: surveyData.outputFiles || ['CSV', 'JSON', 'GeoJSON'],
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
        // Survey Part Tracking
        // For Part 1 (or new surveys), rootSurveyId is self-referential
        // For continuation parts, rootSurveyId points to the original survey
        rootSurveyId: surveyData.rootSurveyId || null, // Will be set after id is assigned below
        partOrdinal: surveyData.partOrdinal || 1,
        partLabel: surveyData.partLabel || (surveyData.partOrdinal && surveyData.partOrdinal > 1 ? `Part ${surveyData.partOrdinal}` : null),
        maxPoiPerPart: surveyData.maxPoiPerPart || DEFAULT_AUTO_PART_THRESHOLD,
        poiCount: 0,
        closureReason: null
      };
      
      // Set rootSurveyId to self for Part 1 surveys (allows consistent part discovery)
      if (!surveyData.rootSurveyId && (!surveyData.partOrdinal || surveyData.partOrdinal === 1)) {
        survey.rootSurveyId = survey.id;
      }

      // Emergency backup to localStorage first
      localStorage.setItem(`emergency_survey_${survey.id}`, JSON.stringify(survey));
      
      const db = await openSurveyDB();
      
      // Deactivate current active survey if exists
      const { activeSurvey, surveys } = get();
      if (activeSurvey) {
        const updatedSurvey = { ...activeSurvey, active: false };
        await db.put('surveys', updatedSurvey);
      }

      // Save new survey
      await db.put('surveys', survey);
      
      // Verify the survey was saved
      const savedSurvey = await db.get('surveys', survey.id);
      if (!savedSurvey) {
        throw new Error('Failed to save survey to database');
      }
      
      // Remove emergency backup since save was successful
      localStorage.removeItem(`emergency_survey_${survey.id}`);
      
      // Clean up old emergency data after successful IndexedDB save
      setTimeout(() => {
        cleanupEmergencyData().catch(err => {
        });
      }, 1000);
      
      // Create a local CSV file for this survey
      const csvHeaders = [
        'ID',
        'Date',
        'Time',
        'Height (m)',
        'GPS Alt (m)',
        'Latitude',
        'Longitude',
        'Speed (km/h)',
        'Heading (°)',
        'Road Number',
        'POI Number',
        'POI Type',
        'Note'
      ].join(',') + '\n';
      
      // Save initial CSV to localStorage
      localStorage.setItem(`survey_csv_${survey.id}`, csvHeaders);
      
      // Also save to IndexedDB as backup
      try {
        const csvDb = await initCSVBackupDB();
        if (csvDb) {
          await csvDb.put('csv-data', csvHeaders, survey.id);
        }
    } catch (error) {
        // Continue without CSV backup
      }

      // Get GPS data from store
      const gpsData = useGPSStore.getState().data;

      // Create initial POI for survey start
      const initialPOI = {
        id: crypto.randomUUID(),
        rel: 0,
        altGPS: gpsData.altitude,
        latitude: gpsData.latitude,
        longitude: gpsData.longitude,
        mileMarker: 0,
        poiType: 'START',
        notes: 'Survey Start',
        imageUrl: null,
        addMethod: 'manual' as const,
        generatedByAI: false,
        fromHighPole: false,
        fromSlave: false,
        cloudUploadStatus: null,
        photoCloudLink: null,
        collectable: false,
        slaveDeviceId: null,
        replayKey: null,
        frameIndex: null,
        utcDate: new Date().toISOString().split('T')[0],
        utcTime: new Date().toTimeString().split(' ')[0],
        speed: 0,
        heading: 0,
        roadNumber: 1,
        poiNumber: 1,
        note: 'SURVEY START',
        createdAt: new Date().toISOString(),
        user_id: survey.id
      };

      // PERFORMANCE FIX: Use worker-based logging for off-thread, batched writes
      const workerClient = getMeasurementLogger();
      await workerClient.logMeasurement(initialPOI);

      // Start checkpoint timer for storage health monitoring
      startCheckpointTimer(survey.id);

      // Set up auto-save for the new survey
      const autoSaveEnabled = localStorage.getItem('autoSaveEnabled') !== 'false';
      if (autoSaveEnabled) {
        // Trigger initial auto-save after a delay to allow survey creation to complete
        setTimeout(() => {
          autoSaveSurvey(survey);
        }, 5000);
      }

      set({ 
        activeSurvey: survey,
        surveys: [...surveys, survey]
      });
    } catch (error: unknown) {
      
      // Check if this is a database corruption error
      if (error instanceof Error && (error.message?.includes('backing store') || 
          error.message?.includes('corrupted') ||
          error.name === 'VersionError')) {
        throw new Error('Database error detected. Your survey has been saved as an emergency backup. Please refresh the page to recover your data.');
      }
      
      throw error;
    }
  },

  closeSurvey: async (reason: 'completed' | 'continuation' | 'error' = 'completed') => {
    const db = await openSurveyDB();
    const { activeSurvey, surveys } = get();
    
    if (activeSurvey) {
      stopCheckpointTimer();
      
      const closedSurvey: Survey = { 
        ...activeSurvey, 
        active: false, 
        closedAt: new Date().toISOString(),
        closureReason: reason
      };
      
      await db.put('surveys', closedSurvey);
      
      try {
        await onSurveyClose(closedSurvey);
      } catch (error) {
        console.error('[SurveyStore] Failed to queue survey for Firebase sync:', error);
      }
      
      // MEMORY FIX: Reset measurement cache to release memory immediately
      // Closed surveys don't need to stay in cache - only active survey should be cached
      // NOTE: Using resetCache() instead of clear() to preserve React component subscriptions
      getMeasurementFeed().resetCache();

      
      set({ 
        activeSurvey: null,
        surveys: surveys.map(s => s.id === closedSurvey.id ? closedSurvey : s)
      });
      
      /* toast removed */
    }
  },

  endDaySurvey: async () => {
    const db = await openSurveyDB();
    const { activeSurvey, surveys } = get();
    
    if (activeSurvey) {
      stopCheckpointTimer();
      
      const now = new Date().toISOString();
      const pausedSurvey: Survey = {
        ...activeSurvey,
        active: false,
        closedAt: now,
        closureReason: 'end_of_day',
        pausedAt: now
      };
      
      await db.put('surveys', pausedSurvey);
      
      try {
        await onSurveyClose(pausedSurvey);
      } catch (error) {
        console.error('[SurveyStore] Failed to queue end-of-day survey for sync:', error);
      }
      
      getMeasurementFeed().resetCache();
      
      set({
        activeSurvey: null,
        surveys: surveys.map(s => s.id === pausedSurvey.id ? pausedSurvey : s)
      });
      
      /* toast removed */
    }
  },

  clearSurvey: async () => {
    const db = await openSurveyDB();
    const { activeSurvey } = get();
    
    if (activeSurvey) {
      stopCheckpointTimer();
      
      await deleteAllMeasurements(activeSurvey.id);
      
      const updatedSurvey = { ...activeSurvey, active: false };
      await db.put('surveys', updatedSurvey);
      
      // MEMORY FIX: Reset measurement cache to release memory immediately
      // NOTE: Using resetCache() instead of clear() to preserve React component subscriptions
      getMeasurementFeed().resetCache();

      
      set({ activeSurvey: null });
    }
  },
  
  loadPreviousSurvey: async (surveyId) => {
    const db = await openSurveyDB();
    try {
      const survey = await db.get('surveys', surveyId);
      if (!survey) {
        throw new Error('Survey not found');
      }
      
      const { activeSurvey, surveys } = get();
      if (activeSurvey && activeSurvey.id !== surveyId) {
        stopCheckpointTimer();
        
        const closedSurvey: Survey = { 
          ...activeSurvey, 
          active: false, 
          closedAt: new Date().toISOString(),
          closureReason: 'continuation' as const
        };
        await db.put('surveys', closedSurvey);
        
        try {
          await onSurveyClose(closedSurvey);
        } catch (error) {
          console.error('[SurveyStore] Failed to sync previous survey:', error);
        }
        
        // MEMORY FIX: Reset old survey's measurement cache before loading new survey
        // This ensures old survey data is released from memory
        // NOTE: Using resetCache() instead of clear() to preserve React component subscriptions
        getMeasurementFeed().resetCache();

        
        set({
          surveys: surveys.map(s => s.id === closedSurvey.id ? closedSurvey : s)
        });
      }
      
      const isEndOfDay = survey.closureReason === 'end_of_day';
      const updatedSurvey: Survey = {
        ...survey,
        active: true,
        closureReason: null,
        pausedAt: null
      };
      await db.put('surveys', updatedSurvey);
      
      set({ activeSurvey: updatedSurvey });
      
      startCheckpointTimer(surveyId);
      
      // If this was an end-of-day paused survey, log a DAY_RESUME POI
      if (isEndOfDay) {
        try {
          const gpsData = useGPSStore.getState().data;
          const resumePOI = {
            id: crypto.randomUUID(),
            rel: null,
            altGPS: gpsData?.altitude ?? null,
            latitude: gpsData?.latitude ?? 0,
            longitude: gpsData?.longitude ?? 0,
            utcDate: new Date().toISOString().split('T')[0],
            utcTime: new Date().toTimeString().split(' ')[0],
            speed: gpsData?.speed ?? null,
            heading: gpsData?.course ?? null,
            roadNumber: null,
            poiNumber: null,
            poi_type: 'DAY_RESUME',
            note: 'DAY RESUME',
            createdAt: new Date().toISOString(),
            user_id: surveyId,
            measurementFree: true
          };
          const workerClient = getMeasurementLogger();
          await workerClient.logMeasurement(resumePOI);
        } catch (err) {
          console.error('[SurveyStore] Failed to log DAY_RESUME POI:', err);
        }
      }
      
      window.dispatchEvent(new Event('dbchange'));
      
    } catch (error: unknown) {
      toast.error('Failed to load survey', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  },
  
  // Import surveys from Firebase
  importSurveysFromFirebase: async (): Promise<void> => {
    if (!getCurrentUser()) {
      toast.error('Authentication required', {
        description: 'Please sign in to import surveys from the cloud'
      });
      return;
    }
    
    try {
      // Show loading toast
      toast.loading('Importing surveys from cloud...', {
        id: 'import-surveys'
      });
      
      // Import surveys from Firebase
      const surveys = await importSurveysFromFirebase();
      
      if (surveys.length === 0) {
        toast.error('No surveys found in the cloud', {
          id: 'import-surveys'
        });
        return;
      }
      
      // Get current surveys from the store
      const currentSurveys = get().surveys;
      
      // Filter out surveys that already exist locally
      const newSurveys = surveys.filter(s => !currentSurveys.some(existing => existing.id === s.id));
      
      // Update the store with the imported surveys
      const updatedSurveys = [...currentSurveys, ...newSurveys];
      set({ surveys: updatedSurveys });
      
      // For each survey, import its POIs
      // TODO: Re-implement POI import functionality
      // let totalPOIs = 0;
      // for (const survey of surveys) {
      //   const pois = await importPOIsFromFirebase(survey.id);
      //   totalPOIs += pois.length;
      // }
      
      // Show success toast
      /* toast removed */
      
    } catch (error: unknown) {
      toast.error('Failed to import surveys', {
        id: 'import-surveys',
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  },
  loadRoutes: async () => {
    const db = await openSurveyDB();
    const { activeSurvey } = get();
    if (activeSurvey) {
      const routes = await db.getAllFromIndex('routes', 'by-survey', activeSurvey.id);
      set({ routes });
    }
  },

  loadAlerts: async () => {
    const db = await openSurveyDB();
    const { activeSurvey } = get();
    if (activeSurvey) {
      const alerts = await db.getAllFromIndex('alerts', 'by-survey', activeSurvey.id);
      set({ alerts });
    }
  },

  loadVehicleTraces: async () => {
    const db = await openSurveyDB();
    const { activeSurvey } = get();
    if (activeSurvey) {
      const traces = await db.getAllFromIndex('vehicleTraces', 'by-survey', activeSurvey.id);
      set({ vehicleTraces: traces });
    }
  },

  updateSurvey: async (survey) => {
    const db = await openSurveyDB();
    await db.put('surveys', survey);
    
    // Make sure we're updating the active survey if it's the one being edited
    const isActive = survey.active || (get().activeSurvey?.id === survey.id);
    
    // If this is the active survey, make sure it stays active
    if (isActive) {
      survey.active = true;
    }
    
    const { surveys } = get();
    set({
      surveys: surveys.map(s => s.id === survey.id ? survey : s),
      activeSurvey: isActive ? survey : get().activeSurvey
    });
    
    // Trigger a database change event to refresh measurements
    window.dispatchEvent(new Event('dbchange'));
    
    return survey;
  },

  createRoute: async (name: string) => {
    const db = await openSurveyDB();
    const { activeSurvey, routes } = get();
    
    if (!activeSurvey) {
      throw new Error('No active survey');
    }
    
    const routeNumber = routes.length + 1;
    const route: Route = {
      id: crypto.randomUUID(),
      surveyId: activeSurvey.id,
      name,
      routeNumber,
      createdAt: new Date().toISOString()
    };
    
    await db.add('routes', route);
    set({ routes: [...routes, route], currentRoute: route });
  },

  addAlert: async (alert) => {
    const db = await openSurveyDB();
    const { activeSurvey, alerts } = get();
    
    if (!activeSurvey) {
      throw new Error('No active survey');
    }
    
    const newAlert: Alert = {
      ...alert,
      id: crypto.randomUUID(),
      surveyId: activeSurvey.id,
      createdAt: new Date().toISOString()
    };
    
    await db.add('alerts', newAlert);
    set({ alerts: [...alerts, newAlert] });
  },

  addVehicleTrace: async (trace) => {
    const db = await openSurveyDB();
    const { activeSurvey, currentRoute, vehicleTraces } = get();

    if (!activeSurvey || !currentRoute) {
      return;
    }

    const newTrace: VehicleTrace = {
      ...trace,
      id: crypto.randomUUID(),
      surveyId: activeSurvey.id,
      routeId: currentRoute?.id || 'default-route',
      timestamp: new Date().toISOString()
    };

    try {
      await db.add('vehicleTraces', newTrace);
      set({ vehicleTraces: [...vehicleTraces, newTrace] });
    } catch (error) {
      // Store in localStorage as fallback
      const traces = JSON.parse(localStorage.getItem('vehicleTraces') || '[]');
      traces.push(newTrace);
      localStorage.setItem('vehicleTraces', JSON.stringify(traces));
    }
  },

  exportSurvey: async (format: 'csv' | 'json' | 'geojson') => {
    const { activeSurvey } = get();
    await exportSurveyFn(activeSurvey, format);
  },

  loadSurveys: async () => {
    const perfStart = performance.now();
    
    try {
      const db = await openSurveyDB();
      
      // PRODUCTION FIX: Load recent surveys first using offset-based pagination
      // If active not found, do a focused search for active survey
      const { surveys: recentSurveys, total, hasMore } = await getSurveysPaginated(500, 0);
      
      let activeSurvey = recentSurveys.find((s: Survey) => s.active);
      
      // If active not in initial batch, search for it specifically
      if (!activeSurvey) {
        // Optimized: Cursor search with early exit on first active=true
        const tx = db.transaction('surveys', 'readonly');
        let cursor = await tx.store.openCursor();
        
        while (cursor && !activeSurvey) {
          if (cursor.value.active === true) {
            activeSurvey = cursor.value;
            break;  // Early exit
          }
          cursor = await cursor.continue();
        }
      }
      
      // Build initial list with active survey at top if not already included
      let initialSurveys = [...recentSurveys];
      if (activeSurvey && !initialSurveys.find(s => s.id === activeSurvey.id)) {
        // Active survey not in recent 50, add it at the top
        initialSurveys = [activeSurvey, ...initialSurveys];
      }
      
      set({ 
        surveys: initialSurveys,
        activeSurvey 
      });
      
      perfLog('loadSurveys (initial)', performance.now() - perfStart);
      
      // Dispatch custom event to notify that surveys have been loaded
      window.dispatchEvent(new CustomEvent('surveys-loaded', { 
        detail: { surveys: initialSurveys, activeSurvey, hasMore } 
      }));

      // BACKGROUND MIGRATION: Backfill poiCount for legacy surveys that lack it.
      // Runs after initial render so it doesn't block the UI.
      // Uses a single cursor pass to count all surveys in one transaction,
      // then atomically writes the authoritative starting value.
      // After migration, all increments are delta-safe.
      setTimeout(async () => {
        try {
          const migrationDb = await openSurveyDB();
          const allSurveys: Survey[] = await migrationDb.getAll('surveys');
          const legacySurveys = allSurveys.filter(s => typeof s.poiCount !== 'number');
          
          if (legacySurveys.length === 0) return;
          
          const legacyIds = new Set(legacySurveys.map(s => s.id));
          const counts = new Map<string, number>();
          for (const id of legacyIds) counts.set(id, 0);

          // Single cursor scan — one DB call regardless of how many legacy surveys
          const scanTx = migrationDb.transaction('measurements', 'readonly');
          let cursor = await scanTx.objectStore('measurements').index('by-survey').openCursor();
          while (cursor) {
            const sid = cursor.value.user_id as string;
            if (counts.has(sid)) counts.set(sid, counts.get(sid)! + 1);
            cursor = await cursor.continue();
          }

          // Write authoritative counts atomically.
          // Re-read each survey inside the transaction and only write if poiCount
          // is still absent — guards against overwriting a newer live increment.
          const writeTx = migrationDb.transaction('surveys', 'readwrite');
          for (const survey of legacySurveys) {
            const fresh = await writeTx.store.get(survey.id);
            if (fresh && typeof fresh.poiCount !== 'number') {
              await writeTx.store.put({ ...fresh, poiCount: counts.get(survey.id) ?? 0 });
            }
          }
          await writeTx.done;

          // Reflect in Zustand store (the in-memory surveys list)
          const { surveys: currentSurveys, activeSurvey: currentActive } = get();
          const updatedSurveys = currentSurveys.map(s => {
            if (!legacyIds.has(s.id)) return s;
            return { ...s, poiCount: counts.get(s.id) ?? 0 };
          });
          const updatedActive = currentActive && legacyIds.has(currentActive.id)
            ? { ...currentActive, poiCount: counts.get(currentActive.id) ?? 0 }
            : currentActive;
          set({ surveys: updatedSurveys, activeSurvey: updatedActive });

          // Also update module-level legacy cache so modal is instant on next open
          for (const [id, count] of counts) {
            setLegacyPoiCount(id, count);
          }
        } catch {
          // Non-critical migration — will retry on next loadSurveys call
        }
      }, 2000); // 2s delay — after UI renders and background load starts
      
      // PRODUCTION FIX: Load rest in background using offset-based pagination
      if (hasMore && total > 500) {
        setTimeout(async () => {
          try {
            // Load additional surveys using offset (skip first 500 already loaded)
            const { surveys: moreSurveys } = await getSurveysPaginated(total - 500, 500);
            
            const { surveys: currentSurveys } = get();
            const currentIds = new Set(currentSurveys.map(s => s.id));
            
            // Add only new surveys (preserve ordering)
            const newSurveys = moreSurveys.filter(s => !currentIds.has(s.id));
            
            // PRESERVE ORDER: Append at end
            set({ surveys: [...currentSurveys, ...newSurveys] });
          } catch (err) {
            console.error('Background survey load failed:', err);
          }
        }, 1000);  // 1 second delay - UI already responsive
      }
      
    } catch (error) {
      console.error('Failed to load surveys:', error);
      // Set empty array on error to prevent undefined state
      set({ surveys: [], activeSurvey: null });
    }
  }
}));