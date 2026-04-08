/**
 * AutoPartManager - Automatic Survey Part System
 *
 * Monitors POI count and automatically splits surveys at configurable thresholds.
 * When threshold is reached (default 200 POIs):
 * 1. Plays sound alert and shows visual notification
 * 2. Resets memory cache and switches to new survey immediately (non-blocking)
 * 3. Saves current part to hard drive (ZIP) — runs in background after switch
 * 4. Uploads to cloud if connected — background
 * 5. Sends email notification if configured — background
 * 6. Syncs to RoadScope if configured — background
 *
 * CRITICAL: Steps 2 (survey switch) happens BEFORE steps 3-6 (I/O) so laser
 * and GPS logging are never paused waiting for a file download or network call.
 */

import { toast } from 'sonner';
import { API_BASE_URL } from '@/lib/config/environment';
import { Survey } from './types';
import { openSurveyDB, countMeasurementsForSurvey } from './db';
import { getMeasurementFeed } from './MeasurementFeed';
import { getBaseTitle, getDisplayTitle } from './autoSplit';
import { soundManager, confirmationSound } from '../sounds';
import { useSurveyStore } from './store';
import { DEFAULT_AUTO_PART_THRESHOLD } from './constants';

export { DEFAULT_AUTO_PART_THRESHOLD };

export interface AutoPartConfig {
  enabled: boolean;
  threshold: number;
  saveToHardDrive: boolean;
  uploadToCloud: boolean;
  sendEmail: boolean;
  syncToRoadScope: boolean;
}

const DEFAULT_CONFIG: AutoPartConfig = {
  enabled: true,
  threshold: DEFAULT_AUTO_PART_THRESHOLD,
  saveToHardDrive: true,
  uploadToCloud: true,
  sendEmail: true,
  syncToRoadScope: true
};

class AutoPartManager {
  private config: AutoPartConfig = DEFAULT_CONFIG;
  private isProcessing: boolean = false;
  private lastCheckedCount: number = 0;
  private initialized: boolean = false;
  private dbChangeHandler: (() => void) | null = null;
  private checkDebounceTimer: NodeJS.Timeout | null = null;
  private partTransitionSound: HTMLAudioElement | null = null;

  constructor() {
    this.loadConfig();
    this.preloadSound();
  }

  private loadConfig(): void {
    try {
      const saved = localStorage.getItem('autoPartConfig');
      if (saved) {
        this.config = { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.error('[AutoPartManager] Failed to load config:', error);
    }
  }

  private saveConfig(): void {
    try {
      localStorage.setItem('autoPartConfig', JSON.stringify(this.config));
    } catch (error) {
      console.error('[AutoPartManager] Failed to save config:', error);
    }
  }

  private preloadSound(): void {
    try {
      this.partTransitionSound = new Audio(confirmationSound);
      this.partTransitionSound.preload = 'auto';
    } catch (error) {
      console.error('[AutoPartManager] Failed to preload sound:', error);
    }
  }

  private async playPartTransitionSound(): Promise<void> {
    try {
      await soundManager.initialize();
      if (this.partTransitionSound) {
        const playInstance = this.partTransitionSound.cloneNode(true) as HTMLAudioElement;
        playInstance.volume = 1.0;
        await playInstance.play();
      }
    } catch (error) {
      console.error('[AutoPartManager] Failed to play sound:', error);
    }
  }

  initialize(): void {
    if (this.initialized) return;

    console.log('[AutoPartManager] Initializing with threshold:', this.config.threshold);

    this.dbChangeHandler = () => {
      if (this.checkDebounceTimer) {
        clearTimeout(this.checkDebounceTimer);
      }
      this.checkDebounceTimer = setTimeout(() => {
        this.checkThreshold();
      }, 1000);
    };

    window.addEventListener('dbchange', this.dbChangeHandler);
    this.initialized = true;
  }

  dispose(): void {
    if (this.dbChangeHandler) {
      window.removeEventListener('dbchange', this.dbChangeHandler);
      this.dbChangeHandler = null;
    }
    if (this.checkDebounceTimer) {
      clearTimeout(this.checkDebounceTimer);
      this.checkDebounceTimer = null;
    }
    this.initialized = false;
  }

  /**
   * Check if the current survey has reached the POI threshold.
   * Uses count-only query (O(1) memory) instead of loading all measurements.
   */
  private async checkThreshold(): Promise<void> {
    if (!this.config.enabled || this.isProcessing) return;

    const activeSurvey = useSurveyStore.getState().activeSurvey;
    if (!activeSurvey) return;

    try {
      const currentCount = await countMeasurementsForSurvey(activeSurvey.id);

      if (currentCount >= this.config.threshold - 50 && currentCount < this.config.threshold) {
        const remaining = this.config.threshold - currentCount;
        if (
          this.lastCheckedCount < this.config.threshold - 50 ||
          (remaining <= 10 && this.lastCheckedCount !== currentCount)
        ) {
          /* toast removed */
        }
      }

      this.lastCheckedCount = currentCount;

      if (currentCount >= this.config.threshold) {
        await this.triggerPartTransition(activeSurvey, currentCount);
      }
    } catch (error) {
      console.error('[AutoPartManager] Failed to check threshold:', error);
    }
  }

  /**
   * Trigger automatic part transition.
   *
   * CRITICAL ORDER (non-blocking design):
   *   Phase A — Survey switch (synchronous-ish, fast):
   *     1. Play sound
   *     2. Close current survey in DB
   *     3. Create continuation survey in DB
   *     4. Reset memory cache
   *     5. Activate new survey in store → laser resumes immediately
   *
   *   Phase B — Export tail (async, runs in background after switch):
   *     6. Generate ZIP and save to disk
   *     7. Upload to cloud
   *     8. Send email
   *     9. Sync to RoadScope
   *    10. Save/close timelapse
   *
   * Phase B failures never prevent the survey from continuing.
   */
  private async triggerPartTransition(survey: Survey, poiCount: number): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    console.log(`[AutoPartManager] Triggering part transition at ${poiCount} POIs`);

    try {
      // ── Phase A: Switch survey (must complete before any I/O) ──────────────

      // Step 1: Play sound alert
      await this.playPartTransitionSound();

      const currentPart = survey.partOrdinal || 1;
      const nextPart = currentPart + 1;
      console.log(`[AutoPartManager] Part ${currentPart} → Part ${nextPart} (${poiCount} POIs)`);

      const db = await openSurveyDB();

      // Step 2: Mark current survey as closed
      const closedSurvey: Survey = {
        ...survey,
        closureReason: 'continuation',
        closedAt: new Date().toISOString(),
        active: false,
        poiCount
      };
      await db.put('surveys', closedSurvey);

      // Step 3: Create continuation survey
      const rootId = survey.rootSurveyId || survey.id;
      const baseTitle = getBaseTitle(survey.surveyTitle || survey.name || 'Survey');
      const newTitle = getDisplayTitle(baseTitle, nextPart);

      const continuationSurvey: Survey = {
        id: crypto.randomUUID(),
        surveyTitle: newTitle,
        name: newTitle,
        surveyorName: survey.surveyorName,
        surveyor: survey.surveyor,
        clientName: survey.clientName,
        customerName: survey.customerName,
        projectNumber: survey.projectNumber,
        originAddress: survey.originAddress,
        destinationAddress: survey.destinationAddress,
        description: survey.description,
        notes: `Auto-continuation from Part ${currentPart} at ${poiCount} POIs`,
        ownerEmail: survey.ownerEmail,
        completionEmailList: survey.completionEmailList,
        enableVehicleTrace: survey.enableVehicleTrace,
        enableAlertLog: survey.enableAlertLog,
        createdAt: new Date().toISOString(),
        active: true,
        outputFiles: survey.outputFiles,
        cloudUploadStatus: null,
        syncId: null,
        exportTarget: null,
        convoyId: survey.convoyId,
        fleetUnitRole: survey.fleetUnitRole,
        plannedRouteId: survey.plannedRouteId,
        routeAnalysis: null,
        aiUserModelId: survey.aiUserModelId,
        aiHistoryScore: null,
        interventionType: survey.interventionType,
        checklistCompleted: false,
        rootSurveyId: rootId,
        partOrdinal: nextPart,
        partLabel: `Part ${nextPart}`,
        maxPoiPerPart: this.config.threshold,
        poiCount: 0,
        closureReason: null
      };
      await db.put('surveys', continuationSurvey);

      // Step 4: Clear memory cache (releases old survey data)
      getMeasurementFeed().resetCache();
      console.log('[AutoPartManager] Memory cache cleared');

      // Step 5: Activate new survey — laser and GPS resume recording HERE
      useSurveyStore.getState().setActiveSurvey(continuationSurvey);
      this.lastCheckedCount = 0;

      /* toast removed */

      console.log(`[AutoPartManager] Survey switched. Part ${nextPart} is now active.`);

      // ── Phase B: Export tail (fire and forget, runs after switch) ──────────
      this.runExportTail(closedSurvey, currentPart, nextPart, poiCount).catch(err => {
        console.error('[AutoPartManager] Export tail error:', err);
      });

    } catch (error) {
      console.error('[AutoPartManager] Part transition failed:', error);
      toast.error('Auto-save failed', {
        description: 'Please manually save your survey.'
      });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Background export tail — runs AFTER the survey switch is complete.
   * Failures here are logged but never affect the active survey.
   */
  private async runExportTail(
    closedSurvey: Survey,
    currentPart: number,
    nextPart: number,
    poiCount: number
  ): Promise<void> {
    let packageData: { blob: Blob; filename: string; measurementCount: number } | null = null;

    // Step 6: Generate ZIP and save to disk
    try {
      toast.loading('Saving Part ' + currentPart + ' package…', { id: 'auto-part-save' });

      const { generateSurveyPackageBlob } = await import('../utils/exportUtils');
      packageData = await generateSurveyPackageBlob(closedSurvey);

      const { saveAs } = await import('file-saver');
      saveAs(packageData.blob, packageData.filename);

      toast.dismiss('auto-part-save');
      console.log('[AutoPartManager] Part saved to computer');
    } catch (error) {
      console.error('[AutoPartManager] Failed to save package:', error);
      toast.dismiss('auto-part-save');
      toast.error(`Part ${currentPart} package failed to save — continue recording`);
    }

    // Step 7: Upload to cloud
    if (this.config.uploadToCloud && navigator.onLine && packageData) {
      try {
        const { uploadSurveyPackage, canUploadToCloud } = await import('../firebase/storageUpload');
        if (canUploadToCloud()) {
          toast.loading('Uploading to cloud…', { id: 'auto-part-cloud' });
          const uploadResult = await uploadSurveyPackage(
            closedSurvey.id,
            packageData.blob,
            packageData.filename
          );
          toast.dismiss('auto-part-cloud');
          console.log('[AutoPartManager] Cloud upload', uploadResult.success ? 'OK' : 'failed');
        }
      } catch (error) {
        console.error('[AutoPartManager] Cloud upload failed:', error);
        toast.dismiss('auto-part-cloud');
      }
    }

    // Step 8: Send email — check BOTH emailConfig recipients AND survey-level recipients
    if (this.config.sendEmail && navigator.onLine && packageData) {
      try {
        const { getEmailConfig } = await import('../utils/emailConfig');
        const emailConfig = getEmailConfig();

        const recipients: string[] = [];
        if (closedSurvey.ownerEmail) recipients.push(closedSurvey.ownerEmail);
        if (closedSurvey.completionEmailList) recipients.push(...closedSurvey.completionEmailList);
        for (const r of emailConfig.surveyRecipients) {
          if (!recipients.includes(r)) recipients.push(r);
        }

        if (recipients.length > 0) {
          const { sendSurveyCompletionEmail } = await import('../utils/emailUtils');
          await sendSurveyCompletionEmail({
            to: recipients,
            bcc: ['admin@soltec.ca'],
            surveyTitle: `${closedSurvey.surveyTitle || closedSurvey.name || 'Survey'} (Part ${currentPart})`,
            surveyorName: closedSurvey.surveyorName || closedSurvey.surveyor || 'Unknown',
            clientName: closedSurvey.clientName || closedSurvey.customerName || 'Unknown',
            projectNumber: closedSurvey.projectNumber || closedSurvey.description,
            measurementCount: packageData.measurementCount,
            notes: `Auto-saved at ${poiCount} POIs. Continuing in Part ${nextPart}.`,
            packageSize: this.formatBytes(packageData.blob.size)
          });
          console.log('[AutoPartManager] Email notification sent to', recipients);
        } else {
          console.log('[AutoPartManager] No email recipients configured — skipping email');
        }
      } catch (error) {
        console.error('[AutoPartManager] Email failed:', error);
      }
    }

    // Step 9: Sync to RoadScope
    if (this.config.syncToRoadScope && navigator.onLine) {
      try {
        const userId = localStorage.getItem('current_user_id');
        if (userId) {
          const keyRes = await fetch(`${API_BASE_URL}/api/roadscope/settings/${userId}/key`);
          const keyJson = await keyRes.json();

          if (keyJson.success && keyJson.apiKey) {
            toast.loading('Syncing to RoadScope…', { id: 'auto-part-roadscope' });

            const { getRoadScopeClient } = await import('../roadscope/client');
            const client = getRoadScopeClient();
            client.setApiKey(keyJson.apiKey);

            const { syncSurveyToRoadScope } = await import('../roadscope/syncService');
            const result = await syncSurveyToRoadScope(closedSurvey, { includeFiles: false });

            toast.dismiss('auto-part-roadscope');
            console.log(
              '[AutoPartManager] RoadScope sync',
              result.success ? `OK (${result.poisSynced} POIs)` : 'incomplete'
            );
          }
        }
      } catch (error) {
        console.error('[AutoPartManager] RoadScope sync failed:', error);
        toast.dismiss('auto-part-roadscope');
      }
    }

    // Step 10: Save and close timelapse if active
    try {
      const { useCameraStore } = await import('../camera');
      if (useCameraStore.getState().isTimelapseActive) {
        console.log('[AutoPartManager] Stopping timelapse for Part', currentPart);
        toast.loading('Saving timelapse…', { id: 'auto-part-timelapse' });

        const { timelapseRecorder } = await import('../timelapse/TimelapseRecorder');
        await timelapseRecorder.stopRecording();

        toast.dismiss('auto-part-timelapse');
        console.log('[AutoPartManager] Timelapse saved for Part', currentPart);
      }
    } catch (error) {
      console.error('[AutoPartManager] Timelapse save failed:', error);
      toast.dismiss('auto-part-timelapse');
    }

    console.log('[AutoPartManager] Export tail complete for Part', currentPart);
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  getConfig(): AutoPartConfig {
    return { ...this.config };
  }

  setConfig(config: Partial<AutoPartConfig>): void {
    this.config = { ...this.config, ...config };
    this.saveConfig();
    console.log('[AutoPartManager] Config updated:', this.config);
  }

  setThreshold(threshold: number): void {
    this.config.threshold = Math.max(100, Math.min(1000, threshold));
    this.saveConfig();
    console.log('[AutoPartManager] Threshold set to:', this.config.threshold);
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    this.saveConfig();
    console.log('[AutoPartManager] Enabled:', enabled);
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  getThreshold(): number {
    return this.config.threshold;
  }

  async forceCheck(): Promise<void> {
    await this.checkThreshold();
  }

  /**
   * Manually trigger a part transition (for testing or manual override).
   * Uses count-only DB query.
   */
  async triggerManualTransition(): Promise<void> {
    const activeSurvey = useSurveyStore.getState().activeSurvey;
    if (!activeSurvey) {
      toast.error('No active survey');
      return;
    }

    const currentCount = await countMeasurementsForSurvey(activeSurvey.id);
    await this.triggerPartTransition(activeSurvey, currentCount);
  }
}

let autoPartManagerInstance: AutoPartManager | null = null;

export function getAutoPartManager(): AutoPartManager {
  if (!autoPartManagerInstance) {
    autoPartManagerInstance = new AutoPartManager();
  }
  return autoPartManagerInstance;
}

export function initAutoPartManager(): void {
  getAutoPartManager().initialize();
}
