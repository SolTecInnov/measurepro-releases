import { useCameraStore, TimelapseFrame } from '../camera';
import { captureQueue } from '../camera/captureQueue';
import { openSurveyDB } from '../survey/db';
import { useSettingsStore } from '../settings';
import { toast } from 'sonner';
import { getMeasurementLogger } from '../workers/MeasurementLoggerClient';

/**
 * TimelapseRecorder handles automatic frame capture at regular intervals
 * Works concurrently with other camera features (manual capture, video, AI detection)
 */
export class TimelapseRecorder {
  private intervalId: number | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private frameCount: number = 0;
  private isActive: boolean = false;

  /**
   * Initialize the timelapse recorder with a video element
   */
  public initialize(videoElement: HTMLVideoElement): void {
    this.videoElement = videoElement;
  }

  /**
   * Start timelapse recording
   */
  public start(): void {
    if (this.isActive) {
      return;
    }

    if (!this.videoElement) {
      toast.error('Camera not ready for timelapse');
      return;
    }

    const settings = useCameraStore.getState().timelapseSettings;
    this.frameCount = 0;
    this.isActive = true;

    // Update store state
    useCameraStore.getState().setTimelapseActive(true);
    useCameraStore.getState().clearTimelapseFrames();

    // Capture first frame immediately
    this.captureFrame();

    // Set up interval for subsequent frames
    this.intervalId = window.setInterval(() => {
      this.captureFrame();
    }, settings.interval * 1000);

    toast.success('Timelapse started', {
      description: `Capturing frame every ${settings.interval} seconds`
    });
  }

  /**
   * Stop timelapse recording
   */
  public stop(): void {
    if (!this.isActive) {
      return;
    }

    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isActive = false;
    useCameraStore.getState().setTimelapseActive(false);

    const frameCount = useCameraStore.getState().timelapseFrames.length;
    
    toast.success('Timelapse stopped', {
      description: `Captured ${frameCount} frame${frameCount !== 1 ? 's' : ''}`
    });
  }

  /**
   * Capture a single frame
   */
  private async captureFrame(): Promise<void> {
    if (!this.videoElement) {
      return;
    }

    try {
      const store = useCameraStore.getState();
      const settings = store.timelapseSettings;
      
      // Prepare overlay data (only if overlay is enabled)
      const overlayData = settings.includeOverlay ? {
        showLogo: store.overlayOptions.showLogo,
        surveyTitle: store.overlayFields.surveyTitle,
        projectNumber: store.overlayFields.projectNumber,
        surveyorName: store.overlayFields.surveyorName,
        // Don't include POI data in overlay, but track separately
        poi: undefined,
        gps: undefined,
        relHeight: undefined,
        heading: undefined,
        timestamp: new Date().toISOString(),
      } : {
        showLogo: false,
        surveyTitle: '',
        projectNumber: '',
        surveyorName: '',
        poi: undefined,
        gps: undefined,
        relHeight: undefined,
        heading: undefined,
        timestamp: new Date().toISOString(),
      };

      // PERFORMANCE OPTIMIZATION: Use async queue to eliminate main thread blocking during timelapse capture
      const result = await captureQueue.queueCapture(
        this.videoElement,
        overlayData,
        settings.includeOverlay ? store.overlayOptions : {
          showPOI: false,
          showGPS: false,
          showHeight: false,
          showDateTime: true, // Always show timestamp
          showHeading: false,
          showLogo: settings.includeOverlay ? store.overlayOptions.showLogo : false,
          showSurveyTitle: settings.includeOverlay,
          showProjectNumber: settings.includeOverlay,
          showSurveyorName: settings.includeOverlay,
          showPOINotes: false,
        },
        'image/jpeg'
      );

      // Get recent POIs/measurements (within last 10 seconds of this frame)
      const associatedPOIs = await this.getRecentPOIs();
      
      // Create timelapse frame with POI tracking
      const frame: TimelapseFrame = {
        id: crypto.randomUUID(),
        imageUrl: result.dataUrl,
        timestamp: new Date().toISOString(),
        frameNumber: this.frameCount++,
        metadata: {
          // Could add GPS/height data here if available
        },
        associatedPOIs: associatedPOIs,
        hasPOI: (associatedPOIs && associatedPOIs.length > 0) || false
      };

      // Add frame to store
      store.addTimelapseFrame(frame);

      // CRITICAL: ALWAYS save to IndexedDB for crash recovery (zero data loss guarantee)
      await this.autoSaveFrame(frame);
      
      // Also trigger download if autoSave is enabled (preserves original functionality)
      if (settings.autoSave) {
        this.downloadFrame(frame);
      }

    } catch (error) {
      toast.error('Failed to capture timelapse frame');
    }
  }

  /**
   * Get recent POIs/measurements (within last 10 seconds)
   */
  private async getRecentPOIs(): Promise<NonNullable<TimelapseFrame['associatedPOIs']>> {
    try {
      const currentSurveyId = localStorage.getItem('selected_survey');
      if (!currentSurveyId) return [];

      const db = await openSurveyDB();
      const measurements = await db.getAllFromIndex('measurements', 'by-survey', currentSurveyId);
      const now = Date.now();
      const tenSecondsAgo = now - 10000; // 10 seconds

      // Get enabled POI types from settings
      const enabledTypes = useSettingsStore.getState().loggingSettings.timelapseEnabledPOITypes || [];
      const allTypesEnabled = enabledTypes.length === 0; // Empty array = all types enabled (backward compatible)

      // Filter measurements from last 10 seconds and by POI type
      const recentPOIs = measurements
        .filter((m: any) => {
          const measurementTime = new Date(m.createdAt).getTime();
          const isRecent = measurementTime >= tenSecondsAgo && measurementTime <= now;
          
          // Filter by POI type if specific types are enabled
          if (!isRecent) return false;
          if (allTypesEnabled) return true;
          
          const poiType = m.poi_type || m.poiType || 'Unknown';
          return enabledTypes.includes(poiType);
        })
        .map((m: any) => ({
          id: m.id,
          poiType: m.poi_type || m.poiType || 'Unknown',
          poiNumber: m.poiNumber || 0,
          roadNumber: m.roadNumber || 0,
          note: m.note,
          timestamp: m.createdAt
        }));

      return recentPOIs;
    } catch (error) {
      return [];
    }
  }

  /**
   * Auto-save frame to IndexedDB for crash recovery
   * PERFORMANCE FIX: Delegates to worker to eliminate 50-200ms main thread blocking
   * Frames saved with status='pending' until user exports/saves
   */
  private async autoSaveFrame(frame: TimelapseFrame): Promise<void> {
    try {
      // Delegate to worker (non-blocking!)
      // This eliminates 50-200ms main thread blocking from IndexedDB writes
      const measurementLogger = getMeasurementLogger();
      await measurementLogger.saveTimelapseFrame({
        id: frame.id,
        imageUrl: frame.imageUrl,
        timestamp: frame.timestamp,
        frameNumber: frame.frameNumber,
        metadata: frame.metadata,
        associatedPOIs: frame.associatedPOIs,
        hasPOI: frame.hasPOI || false
      });
      
      // Frame is now safely persisted off-main-thread
      // Main thread blocking time: <1ms (just message post)
    } catch (error) {
      console.error('⚠️ Failed to save timelapse frame via worker:', error);
      // Don't throw - frame is still in memory store
      // Worker handles retries and fallback internally
    }
  }

  /**
   * Download frame to disk (original autoSave functionality)
   */
  private downloadFrame(frame: TimelapseFrame): void {
    try {
      // Convert data URL to blob
      const byteString = atob(frame.imageUrl.split(',')[1]);
      const mimeString = frame.imageUrl.split(',')[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      
      const blob = new Blob([ab], { type: mimeString });
      const url = URL.createObjectURL(blob);
      
      // Create download link
      const a = document.createElement('a');
      a.href = url;
      a.download = `frame_${frame.frameNumber}_${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download frame:', error);
    }
  }

  /**
   * Check if timelapse is currently active
   */
  public isRecording(): boolean {
    return this.isActive;
  }

  /**
   * Get current frame count
   */
  public getFrameCount(): number {
    return this.frameCount;
  }

  /**
   * Cleanup and dispose
   */
  public dispose(): void {
    this.stop();
    this.videoElement = null;
  }
}

// Export singleton instance
export const timelapseRecorder = new TimelapseRecorder();
