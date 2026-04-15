import { describe, it, expect, beforeEach } from 'vitest';
import { usePointCloudStore } from '../pointCloudStore';

describe('usePointCloudStore', () => {
  const initialCurrentScan = {
    scanId: null,
    scanName: '',
    startTime: null,
    frameCount: 0,
    pointCount: 0,
    storageUsedBytes: 0,
    status: 'idle' as const,
  };

  beforeEach(() => {
    usePointCloudStore.setState({
      currentScan: { ...initialCurrentScan },
      recordingStatus: 'idle',
      savedScans: [],
      exportJobs: [],
      gpsStatus: { available: false, lastPosition: null, accuracy: null },
      storageQuota: 50 * 1024 * 1024 * 1024,
    });
  });

  it('has correct defaults', () => {
    const state = usePointCloudStore.getState();
    expect(state.currentScan).toEqual(initialCurrentScan);
    expect(state.recordingStatus).toBe('idle');
    expect(state.savedScans).toEqual([]);
    expect(state.exportJobs).toEqual([]);
    expect(state.gpsStatus.available).toBe(false);
    expect(state.storageQuota).toBe(50 * 1024 * 1024 * 1024);
  });

  describe('setCurrentScan', () => {
    it('merges partial scan state', () => {
      usePointCloudStore.getState().setCurrentScan({ scanId: 'scan1', scanName: 'Test Scan' });
      const scan = usePointCloudStore.getState().currentScan;
      expect(scan.scanId).toBe('scan1');
      expect(scan.scanName).toBe('Test Scan');
      expect(scan.frameCount).toBe(0); // unchanged
    });
  });

  describe('resetCurrentScan', () => {
    it('resets scan to initial state and sets recordingStatus to idle', () => {
      usePointCloudStore.getState().setCurrentScan({ scanId: 'scan1', frameCount: 10 });
      usePointCloudStore.getState().setRecordingStatus('recording');
      usePointCloudStore.getState().resetCurrentScan();
      const state = usePointCloudStore.getState();
      expect(state.currentScan).toEqual(initialCurrentScan);
      expect(state.recordingStatus).toBe('idle');
    });
  });

  describe('setRecordingStatus', () => {
    it('sets recording status', () => {
      usePointCloudStore.getState().setRecordingStatus('recording');
      expect(usePointCloudStore.getState().recordingStatus).toBe('recording');
    });

    it('sets paused status', () => {
      usePointCloudStore.getState().setRecordingStatus('paused');
      expect(usePointCloudStore.getState().recordingStatus).toBe('paused');
    });
  });

  describe('savedScans', () => {
    const mockScan = {
      id: 'scan1',
      name: 'Test',
      startTime: 1000,
      totalFrames: 5,
      totalPoints: 100,
      bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } },
      gpsCenter: { lat: 45, lon: -73, alt: 100 },
      status: 'completed' as const,
      storageSizeBytes: 1024,
    };

    it('setSavedScans replaces scans', () => {
      usePointCloudStore.getState().setSavedScans([mockScan]);
      expect(usePointCloudStore.getState().savedScans).toHaveLength(1);
      expect(usePointCloudStore.getState().savedScans[0].id).toBe('scan1');
    });

    it('addSavedScan appends', () => {
      usePointCloudStore.getState().addSavedScan(mockScan);
      usePointCloudStore.getState().addSavedScan({ ...mockScan, id: 'scan2' });
      expect(usePointCloudStore.getState().savedScans).toHaveLength(2);
    });

    it('removeSavedScan removes by id', () => {
      usePointCloudStore.getState().setSavedScans([mockScan, { ...mockScan, id: 'scan2' }]);
      usePointCloudStore.getState().removeSavedScan('scan1');
      const scans = usePointCloudStore.getState().savedScans;
      expect(scans).toHaveLength(1);
      expect(scans[0].id).toBe('scan2');
    });
  });

  describe('exportJobs', () => {
    const mockJob = {
      id: 'job1',
      scanId: 'scan1',
      format: 'ply' as const,
      status: 'queued' as const,
      progress: 0,
    };

    it('addExportJob appends', () => {
      usePointCloudStore.getState().addExportJob(mockJob);
      expect(usePointCloudStore.getState().exportJobs).toHaveLength(1);
    });

    it('updateExportJob updates by id', () => {
      usePointCloudStore.getState().addExportJob(mockJob);
      usePointCloudStore.getState().updateExportJob('job1', { status: 'processing', progress: 50 });
      const job = usePointCloudStore.getState().exportJobs[0];
      expect(job.status).toBe('processing');
      expect(job.progress).toBe(50);
    });

    it('updateExportJob does not affect other jobs', () => {
      usePointCloudStore.getState().addExportJob(mockJob);
      usePointCloudStore.getState().addExportJob({ ...mockJob, id: 'job2' });
      usePointCloudStore.getState().updateExportJob('job1', { progress: 75 });
      expect(usePointCloudStore.getState().exportJobs[1].progress).toBe(0);
    });

    it('removeExportJob removes by id', () => {
      usePointCloudStore.getState().addExportJob(mockJob);
      usePointCloudStore.getState().addExportJob({ ...mockJob, id: 'job2' });
      usePointCloudStore.getState().removeExportJob('job1');
      expect(usePointCloudStore.getState().exportJobs).toHaveLength(1);
      expect(usePointCloudStore.getState().exportJobs[0].id).toBe('job2');
    });
  });

  describe('gpsStatus', () => {
    it('setGPSStatus merges partial status', () => {
      usePointCloudStore.getState().setGPSStatus({ available: true });
      const gps = usePointCloudStore.getState().gpsStatus;
      expect(gps.available).toBe(true);
      expect(gps.lastPosition).toBeNull(); // unchanged
    });

    it('setGPSStatus updates position', () => {
      usePointCloudStore.getState().setGPSStatus({
        lastPosition: { lat: 45, lon: -73, alt: 50 },
        accuracy: 2.5,
      });
      const gps = usePointCloudStore.getState().gpsStatus;
      expect(gps.lastPosition).toEqual({ lat: 45, lon: -73, alt: 50 });
      expect(gps.accuracy).toBe(2.5);
    });
  });

  describe('storageQuota', () => {
    it('setStorageQuota updates quota', () => {
      usePointCloudStore.getState().setStorageQuota(100 * 1024 * 1024 * 1024);
      expect(usePointCloudStore.getState().storageQuota).toBe(100 * 1024 * 1024 * 1024);
    });
  });

  describe('stats helpers', () => {
    it('incrementFrameCount increments by 1', () => {
      usePointCloudStore.getState().incrementFrameCount();
      usePointCloudStore.getState().incrementFrameCount();
      expect(usePointCloudStore.getState().currentScan.frameCount).toBe(2);
    });

    it('addPoints adds to pointCount', () => {
      usePointCloudStore.getState().addPoints(100);
      usePointCloudStore.getState().addPoints(50);
      expect(usePointCloudStore.getState().currentScan.pointCount).toBe(150);
    });

    it('updateStorageUsed sets storageUsedBytes', () => {
      usePointCloudStore.getState().updateStorageUsed(2048);
      expect(usePointCloudStore.getState().currentScan.storageUsedBytes).toBe(2048);
    });
  });
});
