import { create } from 'zustand';
import type { PointCloudScan, ExportJob } from '../lib/pointCloud/types';

export type RecordingStatus = 'idle' | 'recording' | 'paused';

interface CurrentScanState {
  scanId: string | null;
  scanName: string;
  startTime: number | null;
  frameCount: number;
  pointCount: number;
  storageUsedBytes: number;
  status: RecordingStatus;
  surveyId?: string;
}

interface GPSStatus {
  available: boolean;
  lastPosition: { lat: number; lon: number; alt: number } | null;
  accuracy: number | null;
}

interface PointCloudStore {
  // Current scan session
  currentScan: CurrentScanState;
  setCurrentScan: (scan: Partial<CurrentScanState>) => void;
  resetCurrentScan: () => void;

  // Recording control
  recordingStatus: RecordingStatus;
  setRecordingStatus: (status: RecordingStatus) => void;

  // Saved scans list
  savedScans: PointCloudScan[];
  setSavedScans: (scans: PointCloudScan[]) => void;
  addSavedScan: (scan: PointCloudScan) => void;
  removeSavedScan: (scanId: string) => void;

  // Export jobs
  exportJobs: ExportJob[];
  addExportJob: (job: ExportJob) => void;
  updateExportJob: (jobId: string, updates: Partial<ExportJob>) => void;
  removeExportJob: (jobId: string) => void;

  // GPS status
  gpsStatus: GPSStatus;
  setGPSStatus: (status: Partial<GPSStatus>) => void;

  // Storage quota
  storageQuota: number;
  setStorageQuota: (quota: number) => void;

  // Stats helpers
  incrementFrameCount: () => void;
  addPoints: (count: number) => void;
  updateStorageUsed: (bytes: number) => void;
}

const initialCurrentScan: CurrentScanState = {
  scanId: null,
  scanName: '',
  startTime: null,
  frameCount: 0,
  pointCount: 0,
  storageUsedBytes: 0,
  status: 'idle',
};

export const usePointCloudStore = create<PointCloudStore>((set) => ({
  // Current scan session
  currentScan: initialCurrentScan,
  setCurrentScan: (scan) =>
    set((state) => ({
      currentScan: { ...state.currentScan, ...scan },
    })),
  resetCurrentScan: () =>
    set({ currentScan: initialCurrentScan, recordingStatus: 'idle' }),

  // Recording status
  recordingStatus: 'idle',
  setRecordingStatus: (status) =>
    set({ recordingStatus: status }),

  // Saved scans
  savedScans: [],
  setSavedScans: (scans) => set({ savedScans: scans }),
  addSavedScan: (scan) =>
    set((state) => ({ savedScans: [...state.savedScans, scan] })),
  removeSavedScan: (scanId) =>
    set((state) => ({
      savedScans: state.savedScans.filter((s) => s.id !== scanId),
    })),

  // Export jobs
  exportJobs: [],
  addExportJob: (job) =>
    set((state) => ({ exportJobs: [...state.exportJobs, job] })),
  updateExportJob: (jobId, updates) =>
    set((state) => ({
      exportJobs: state.exportJobs.map((job) =>
        job.id === jobId ? { ...job, ...updates } : job
      ),
    })),
  removeExportJob: (jobId) =>
    set((state) => ({
      exportJobs: state.exportJobs.filter((job) => job.id !== jobId),
    })),

  // GPS status
  gpsStatus: {
    available: false,
    lastPosition: null,
    accuracy: null,
  },
  setGPSStatus: (status) =>
    set((state) => ({
      gpsStatus: { ...state.gpsStatus, ...status },
    })),

  // Storage quota (initialized to 50GB, will be updated based on actual device storage)
  // IMPORTANT: This is NOT an artificial limit - it's the LESSER of:
  // - Actual device free space
  // - 50GB cap
  storageQuota: 50 * 1024 * 1024 * 1024, // 50GB initial (will be updated by storageManager)
  setStorageQuota: (quota) => set({ storageQuota: quota }),

  // Stats helpers
  incrementFrameCount: () =>
    set((state) => ({
      currentScan: {
        ...state.currentScan,
        frameCount: state.currentScan.frameCount + 1,
      },
    })),
  addPoints: (count) =>
    set((state) => ({
      currentScan: {
        ...state.currentScan,
        pointCount: state.currentScan.pointCount + count,
      },
    })),
  updateStorageUsed: (bytes) =>
    set((state) => ({
      currentScan: {
        ...state.currentScan,
        storageUsedBytes: bytes,
      },
    })),
}));
