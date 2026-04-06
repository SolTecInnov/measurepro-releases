import { openDB, type IDBPDatabase, DBSchema } from 'idb';
import { RoadProfileStrict, RoadProfileSampleStrict, RoadProfileEventStrict } from '../../../server/gnss/types';

/**
 * Shared Database Helper (Worker-Safe)
 * 
 * This module provides worker-safe database initialization with NO UI dependencies.
 * Both the main app and all workers import from here to ensure schema consistency.
 * 
 * CRITICAL: This is the single source of truth for:
 * - Database name
 * - Database version
 * - Schema upgrade logic
 * 
 * NO toast notifications or other UI code allowed in this file!
 */

// Quarantine Record Interface
export interface QuarantineRecord {
  id?: number;
  recordType: 'profile' | 'sample' | 'event';
  reason: string;
  originalPayload: any;
  timestamp: number;
}

// Define the database schema
interface SurveyDB extends DBSchema {
  surveys: {
    key: string;
    value: any;
    indexes: { 'by-date': string; 'by-active': string };
  };
  measurements: {
    key: string;
    value: any;
    indexes: { 'by-survey': string; 'by-date': string; 'by-created': string };
  };
  routes: {
    key: string;
    value: any;
    indexes: { 'by-survey': string; 'by-date': string };
  };
  alerts: {
    key: string;
    value: any;
    indexes: { 'by-survey': string; 'by-date': string };
  };
  vehicleTraces: {
    key: string;
    value: any;
    indexes: { 'by-survey': string; 'by-route': string };
  };
  appSettings: {
    key: string;
    value: any;
    indexes: { 'by-category': string };
  };
  voiceNotes: {
    key: string;
    value: any;
    indexes: { 'by-measurement': string; 'by-date': string };
  };
  timelapses: {
    key: string;
    value: any;
    indexes: { 'by-date': string };
  };
  frames: {
    key: string;
    value: any;
    indexes: { 'by-timestamp': string; 'by-status': string; 'by-created': string };
  };
  roadProfiles: {
    key: string;
    value: RoadProfileStrict;
    indexes: { 'by-survey': string; 'by-session': string; 'by-date': string };
  };
  roadProfileSamples: {
    key: number;
    value: RoadProfileSampleStrict;
    indexes: { 
      'by-profile': string; 
      'by-survey': string; 
      'by-session': string; 
      'by-timestamp': string;
      'surveyId_profileId_sessionId': [string, string, string];
    };
  };
  roadProfileEvents: {
    key: number;
    value: RoadProfileEventStrict;
    indexes: { 'by-profile': string; 'by-survey': string; 'by-session': string; 'by-type': string; 'by-timestamp': string };
  };
  roadProfileQuarantine: {
    key: number;
    value: QuarantineRecord;
    indexes: { 'by-type': string; 'by-timestamp': number };
  };
  processedPOIs: {
    key: string;
    value: { id: string; kind: string; lat: number; lon: number; timestamp: number };
    indexes: { 'by-timestamp': number; 'by-kind-timestamp': [string, number] };
  };
  surveyMetadata: {
    key: string;
    value: { surveyId: string; mutationVersion: number; updatedAt: string };
    indexes: { 'by-updated': string };
  };
  timelapseJobs: {
    key: string;
    value: {
      id: string;
      type: string;
      payload: any;
      status: 'pending' | 'committing' | 'complete' | 'failed';
      retryCount: number;
      createdAt: string;
      updatedAt: string;
    };
    indexes: { 'by-status': string; 'by-created': string };
  };
  surveyCheckpoints: {
    key: string;
    value: {
      id: string;
      surveyId: string;
      measurementCount: number;
      pendingWrites: number;
      createdAt: string;
      workerStats: {
        totalLogged: number;
        totalFailed: number;
        bufferSize: number;
      };
    };
    indexes: { 'by-survey': string; 'by-created': string };
  };
  uploadQueue: {
    key: string;
    value: {
      id: string;
      surveyId: string;
      fileName: string;
      fileSize: number;
      status: 'pending' | 'uploading' | 'completed' | 'failed';
      downloadUrl?: string;
      error?: string;
      createdAt: string;
      completedAt?: string;
      retryCount: number;
    };
    indexes: { 'by-survey': string; 'by-status': string; 'by-created': string };
  };
}

export const DB_NAME = 'survey-db';
export const DB_VERSION = 17;

/**
 * Shared database upgrade logic (worker-safe, no UI dependencies)
 * 
 * This function contains the complete schema definition for all object stores.
 * It is used by both the main app and all workers to ensure consistency.
 */
export async function openSharedSurveyDB(): Promise<IDBPDatabase<SurveyDB>> {
  const db = await openDB<SurveyDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, transaction) {
      // Create surveys store
      if (!db.objectStoreNames.contains('surveys')) {
        const surveysStore = db.createObjectStore('surveys', { keyPath: 'id' });
        surveysStore.createIndex('by-date', 'createdAt');
        surveysStore.createIndex('by-active', 'active');
      }
      
      // Create measurements store
      if (!db.objectStoreNames.contains('measurements')) {
        const measurementsStore = db.createObjectStore('measurements', { keyPath: 'id' });
        measurementsStore.createIndex('by-survey', 'user_id');
        measurementsStore.createIndex('by-date', 'createdAt');
        measurementsStore.createIndex('by-created', 'createdAt');
      }
      
      // Create routes store
      if (!db.objectStoreNames.contains('routes')) {
        const routesStore = db.createObjectStore('routes', { keyPath: 'id' });
        routesStore.createIndex('by-survey', 'surveyId');
        routesStore.createIndex('by-date', 'createdAt');
      }
      
      // Create alerts store
      if (!db.objectStoreNames.contains('alerts')) {
        const alertsStore = db.createObjectStore('alerts', { keyPath: 'id' });
        alertsStore.createIndex('by-survey', 'surveyId');
        alertsStore.createIndex('by-date', 'createdAt');
      }
      
      // Create vehicleTraces store
      if (!db.objectStoreNames.contains('vehicleTraces')) {
        const tracesStore = db.createObjectStore('vehicleTraces', { keyPath: 'id' });
        tracesStore.createIndex('by-survey', 'surveyId');
        tracesStore.createIndex('by-route', 'routeId');
      }
      
      // Create appSettings store
      if (!db.objectStoreNames.contains('appSettings')) {
        const settingsStore = db.createObjectStore('appSettings', { keyPath: 'id' });
        settingsStore.createIndex('by-category', 'category');
      }
      
      // Create voiceNotes store (added in version 6)
      if (!db.objectStoreNames.contains('voiceNotes')) {
        const voiceNotesStore = db.createObjectStore('voiceNotes', { keyPath: 'id' });
        voiceNotesStore.createIndex('by-measurement', 'measurementId');
        voiceNotesStore.createIndex('by-date', 'createdAt');
      }
      
      // Create timelapses store (added in version 7)
      if (!db.objectStoreNames.contains('timelapses')) {
        const timelapsesStore = db.createObjectStore('timelapses', { keyPath: 'id' });
        timelapsesStore.createIndex('by-date', 'startTime');
      }
      
      // Create frames store for crash recovery (added in version 8)
      if (!db.objectStoreNames.contains('frames')) {
        const framesStore = db.createObjectStore('frames', { keyPath: 'id' });
        framesStore.createIndex('by-timestamp', 'timestamp');
        framesStore.createIndex('by-status', 'status');
        framesStore.createIndex('by-created', 'createdAt');
      }
      
      // Create GNSS road profiling stores (added in version 9)
      if (!db.objectStoreNames.contains('roadProfiles')) {
        const roadProfilesStore = db.createObjectStore('roadProfiles', { keyPath: 'id' });
        roadProfilesStore.createIndex('by-survey', 'surveyId');
        roadProfilesStore.createIndex('by-session', 'sessionId');
        roadProfilesStore.createIndex('by-date', 'created_at');
      }
      
      if (!db.objectStoreNames.contains('roadProfileSamples')) {
        const roadProfileSamplesStore = db.createObjectStore('roadProfileSamples', { keyPath: 'id' });
        roadProfileSamplesStore.createIndex('by-profile', 'profileId');
        roadProfileSamplesStore.createIndex('by-survey', 'surveyId');
        roadProfileSamplesStore.createIndex('by-session', 'sessionId');
        roadProfileSamplesStore.createIndex('by-timestamp', 'timestamp');
        roadProfileSamplesStore.createIndex('surveyId_profileId_sessionId', ['surveyId', 'profileId', 'sessionId']);
      }
      
      // Migration for version 10: Add composite index to existing roadProfileSamples store
      if (oldVersion < 10 && db.objectStoreNames.contains('roadProfileSamples')) {
        const tx = transaction.objectStore('roadProfileSamples');
        if (!tx.indexNames.contains('surveyId_profileId_sessionId')) {
          tx.createIndex('surveyId_profileId_sessionId', ['surveyId', 'profileId', 'sessionId']);
        }
      }
      
      if (!db.objectStoreNames.contains('roadProfileEvents')) {
        const roadProfileEventsStore = db.createObjectStore('roadProfileEvents', { keyPath: 'id' });
        roadProfileEventsStore.createIndex('by-profile', 'profileId');
        roadProfileEventsStore.createIndex('by-survey', 'surveyId');
        roadProfileEventsStore.createIndex('by-session', 'sessionId');
        roadProfileEventsStore.createIndex('by-type', 'eventType');
        roadProfileEventsStore.createIndex('by-timestamp', 'timestamp');
      }
      
      // Create roadProfileQuarantine store (added in version 11)
      if (!db.objectStoreNames.contains('roadProfileQuarantine')) {
        const quarantineStore = db.createObjectStore('roadProfileQuarantine', {
          keyPath: 'id',
          autoIncrement: true
        });
        quarantineStore.createIndex('by-type', 'recordType');
        quarantineStore.createIndex('by-timestamp', 'timestamp');
      }
      
      // Create processedPOIs store (added in version 12)
      if (!db.objectStoreNames.contains('processedPOIs')) {
        const processedPOIsStore = db.createObjectStore('processedPOIs', { keyPath: 'id' });
        processedPOIsStore.createIndex('by-timestamp', 'timestamp');
        processedPOIsStore.createIndex('by-kind-timestamp', ['kind', 'timestamp']);
      }
      
      // Migration for version 13: Add composite index to existing processedPOIs store
      if (oldVersion < 13 && db.objectStoreNames.contains('processedPOIs')) {
        const tx = transaction.objectStore('processedPOIs');
        if (!tx.indexNames.contains('by-kind-timestamp')) {
          tx.createIndex('by-kind-timestamp', ['kind', 'timestamp']);
        }
      }
      
      // Create surveyMetadata store for mutation versioning (added in version 14)
      if (!db.objectStoreNames.contains('surveyMetadata')) {
        const metadataStore = db.createObjectStore('surveyMetadata', { keyPath: 'surveyId' });
        metadataStore.createIndex('by-updated', 'updatedAt');
      }
      
      // Create timelapseJobs store for durable job queue (added in version 14)
      if (!db.objectStoreNames.contains('timelapseJobs')) {
        const jobsStore = db.createObjectStore('timelapseJobs', { keyPath: 'id' });
        jobsStore.createIndex('by-status', 'status');
        jobsStore.createIndex('by-created', 'createdAt');
      }
      
      // Migration for version 15: Ensure by-survey index exists on measurements store
      // CRITICAL FIX: Required by snapshot-loader.worker.ts for streaming measurements
      if (oldVersion < 15 && db.objectStoreNames.contains('measurements')) {
        const measurementsStore = transaction.objectStore('measurements');
        if (!measurementsStore.indexNames.contains('by-survey')) {
          measurementsStore.createIndex('by-survey', 'user_id');
        }
      }
      
      // Create surveyCheckpoints store for storage health monitoring (added in version 16)
      // Lightweight JSON metadata checkpoints every 10 minutes for production resilience
      if (!db.objectStoreNames.contains('surveyCheckpoints')) {
        const checkpointsStore = db.createObjectStore('surveyCheckpoints', { keyPath: 'id' });
        checkpointsStore.createIndex('by-survey', 'surveyId');
        checkpointsStore.createIndex('by-created', 'createdAt');
      }
      
      // Create uploadQueue store for cloud storage upload tracking (added in version 17)
      // Tracks pending uploads for retry capability when offline
      if (!db.objectStoreNames.contains('uploadQueue')) {
        const uploadQueueStore = db.createObjectStore('uploadQueue', { keyPath: 'id' });
        uploadQueueStore.createIndex('by-survey', 'surveyId');
        uploadQueueStore.createIndex('by-status', 'status');
        uploadQueueStore.createIndex('by-created', 'createdAt');
      }
    },
    blocked(_currentVersion, _blockedVersion, event) {
      // FIX 1: Force-close the stale connection so the upgrade can proceed
      console.warn('[DB] Upgrade blocked — closing stale connection');
      try {
        (event.target as IDBOpenDBRequest)?.result?.close();
      } catch (_e) {
        // May not have a result yet — ignore
      }
    },
    blocking(_currentVersion, _blockedVersion, event) {
      // FIX 1: This connection is blocking another — close it to unblock the upgrade
      console.warn('[DB] This connection is blocking an upgrade — closing');
      try {
        (event.target as IDBOpenDBRequest)?.result?.close();
      } catch (_e) {}
    },
    terminated() {
      // Database connection terminated unexpectedly
      console.error('Database connection terminated unexpectedly');
    }
  });

  // FIX 3: Handle version changes from other tabs — close this connection
  // so the other tab's upgrade can proceed without deadlock
  db.addEventListener('versionchange', () => {
    db.close();
    console.warn('[DB] Version change detected — connection closed');
  });

  return db;
}
