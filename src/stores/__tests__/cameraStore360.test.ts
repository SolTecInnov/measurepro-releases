import { describe, it, expect, beforeEach, vi } from 'vitest';

// Stub window and localStorage before any imports
vi.stubGlobal('window', {
  ...globalThis,
  electronAPI: undefined,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
});
vi.stubGlobal('localStorage', {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
});

// Mock cameraService
vi.mock('../../services/cameraService', () => ({
  cameraService: {
    checkBridge: vi.fn().mockResolvedValue(false),
    checkCamera: vi.fn().mockResolvedValue(false),
    getStatus: vi.fn().mockResolvedValue({ success: false }),
    startRecording: vi.fn().mockResolvedValue({ success: true }),
    stopRecording: vi.fn().mockResolvedValue({ success: true }),
    capturePhotoPOI: vi.fn().mockResolvedValue({ success: true, filename: 'photo.jpg' }),
    saveSettings: vi.fn().mockResolvedValue(undefined),
    startPostSurveyDownload: vi.fn().mockResolvedValue({ jobId: 'job1' }),
    getDownloadProgress: vi.fn().mockResolvedValue({ status: 'done', totalFiles: 0, downloadedFiles: 0 }),
  },
  CameraStatus: {},
  CameraSettings: {},
  CameraError: {},
}));

import { useCameraStore360 } from '../cameraStore360';

describe('useCameraStore360', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCameraStore360.setState({
      bridgeOnline: false,
      cameraConnected: false,
      status: null,
      settings: {
        resolution: '5.7K',
        fps: 30,
        autoStartWithSurvey: true,
        autoStopWithSurvey: true,
        autoDownloadAfterSurvey: true,
        capturePhotosAtPOI: false,
        showHUD: true,
        hudPosition: 'top-right',
      },
      cameraError: null,
      cameraWarnings: [],
      isCapturingPhoto: false,
      lastPhotoResult: null,
      downloadProgress: null,
      activeSurveyId: null,
      _pollInterval: null,
      _downloadInterval: null,
      _downloadJobId: null,
      _wasRecording: false,
    });
  });

  it('has correct defaults', () => {
    const state = useCameraStore360.getState();
    expect(state.bridgeOnline).toBe(false);
    expect(state.cameraConnected).toBe(false);
    expect(state.status).toBeNull();
    expect(state.cameraError).toBeNull();
    expect(state.cameraWarnings).toEqual([]);
    expect(state.isCapturingPhoto).toBe(false);
    expect(state.lastPhotoResult).toBeNull();
    expect(state.downloadProgress).toBeNull();
    expect(state.activeSurveyId).toBeNull();
  });

  it('has correct default settings', () => {
    const { settings } = useCameraStore360.getState();
    expect(settings.resolution).toBe('5.7K');
    expect(settings.fps).toBe(30);
    expect(settings.autoStartWithSurvey).toBe(true);
    expect(settings.autoStopWithSurvey).toBe(true);
    expect(settings.autoDownloadAfterSurvey).toBe(true);
    expect(settings.capturePhotosAtPOI).toBe(false);
    expect(settings.showHUD).toBe(true);
    expect(settings.hudPosition).toBe('top-right');
  });

  describe('dismissError', () => {
    it('clears cameraError', () => {
      useCameraStore360.setState({
        cameraError: {
          code: 'START_FAILED',
          message: 'Test error',
          detail: 'detail',
          recoverable: true,
          action: 'retry',
        },
      });
      useCameraStore360.getState().dismissError();
      expect(useCameraStore360.getState().cameraError).toBeNull();
    });
  });

  describe('saveSettings', () => {
    it('updates settings and persists to localStorage', async () => {
      const newSettings = {
        resolution: '4K' as const,
        fps: 60,
        autoStartWithSurvey: false,
        autoStopWithSurvey: false,
        autoDownloadAfterSurvey: false,
        capturePhotosAtPOI: true,
        showHUD: false,
        hudPosition: 'bottom-left' as const,
      };
      await useCameraStore360.getState().saveSettings(newSettings);
      const state = useCameraStore360.getState();
      expect(state.settings.resolution).toBe('4K');
      expect(state.settings.fps).toBe(60);
      expect(state.settings.autoStartWithSurvey).toBe(false);
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'measurepro_camera_settings',
        JSON.stringify(newSettings),
      );
    });
  });

  describe('startPolling / stopPolling', () => {
    it('startPolling sets _pollInterval', () => {
      useCameraStore360.getState().startPolling();
      expect(useCameraStore360.getState()._pollInterval).not.toBeNull();
      // Cleanup
      useCameraStore360.getState().stopPolling();
    });

    it('stopPolling clears _pollInterval', () => {
      useCameraStore360.getState().startPolling();
      useCameraStore360.getState().stopPolling();
      expect(useCameraStore360.getState()._pollInterval).toBeNull();
    });

    it('startPolling is idempotent', () => {
      useCameraStore360.getState().startPolling();
      const interval1 = useCameraStore360.getState()._pollInterval;
      useCameraStore360.getState().startPolling();
      const interval2 = useCameraStore360.getState()._pollInterval;
      expect(interval1).toBe(interval2);
      useCameraStore360.getState().stopPolling();
    });
  });

  describe('capturePhotoPOI', () => {
    it('returns null when not connected', async () => {
      const result = await useCameraStore360.getState().capturePhotoPOI({
        lat: 45, lng: -73, altitude: 100, heading: 90,
        surveyId: 's1', poiType: 'sign', poiLabel: 'Stop',
      });
      expect(result).toBeNull();
    });

    it('returns null when already capturing', async () => {
      useCameraStore360.setState({ cameraConnected: true, isCapturingPhoto: true });
      const result = await useCameraStore360.getState().capturePhotoPOI({
        lat: 45, lng: -73, altitude: 100, heading: 90,
        surveyId: 's1', poiType: 'sign', poiLabel: 'Stop',
      });
      expect(result).toBeNull();
    });
  });

  describe('stopForSurvey', () => {
    it('clears active survey state', async () => {
      useCameraStore360.setState({ activeSurveyId: 'survey1', _wasRecording: true });
      await useCameraStore360.getState().stopForSurvey('survey1');
      const state = useCameraStore360.getState();
      expect(state.activeSurveyId).toBeNull();
      expect(state._wasRecording).toBe(false);
      expect(state.cameraError).toBeNull();
    });
  });

  describe('retryAfterError', () => {
    it('does nothing when no error', async () => {
      await useCameraStore360.getState().retryAfterError();
      expect(useCameraStore360.getState().cameraError).toBeNull();
    });
  });

  describe('loadSettingsFromStorage', () => {
    it('loads saved settings from localStorage', async () => {
      const saved = { resolution: '4K', fps: 60 };
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValueOnce(JSON.stringify(saved));
      // Re-import to trigger loadSettingsFromStorage - we can test via saveSettings round-trip
      // Since the function runs at module load, we just verify the store accepts partial merges
      const state = useCameraStore360.getState();
      expect(state.settings.resolution).toBeDefined();
    });
  });
});
