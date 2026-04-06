import JSZip from 'jszip';
import { openSurveyDB } from '@/lib/survey/db';
import { openDB } from 'idb';
import { saveCalibrationToStorage } from '@/lib/opencv/calibration-storage';
import { saveFrame } from '@/lib/pointCloud/storage/indexedDbStore';
import type { PointCloudFrame } from '@/lib/pointCloud/types';
import { APP_VERSION } from '@/lib/version';

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB max to prevent browser memory issues

export interface RestoreProgress {
  phase: 'validating' | 'extracting' | 'restoring' | 'complete';
  current: number;
  total: number;
  message: string;
}

export interface RestoreMetadata {
  timestamp: string;
  appVersion: string;
  dataTypes: {
    surveys: number;
    measurements: number;
    videos: number;
    timelapses: number;
    pointClouds: number;
    voiceNotes: number;
    routes: number;
    alerts: number;
    vehicleTraces: number;
  };
  totalSize: number;
}

export type DuplicateStrategy = 'skip' | 'overwrite' | 'merge';

export class RestoreManager {
  private onProgress?: (progress: RestoreProgress) => void;
  private duplicateStrategy: DuplicateStrategy = 'merge';
  private abortSignal?: AbortSignal;

  constructor(onProgress?: (progress: RestoreProgress) => void, abortSignal?: AbortSignal) {
    this.onProgress = onProgress;
    this.abortSignal = abortSignal;
  }

  setDuplicateStrategy(strategy: DuplicateStrategy) {
    this.duplicateStrategy = strategy;
  }

  private checkCancelled(): void {
    if (this.abortSignal?.aborted) {
      throw new Error('Restore cancelled by user');
    }
  }

  /**
   * Validate backup ZIP file and extract metadata
   */
  async validateBackup(file: File): Promise<RestoreMetadata> {
    this.updateProgress('validating', 0, 4, 'Checking file size...');

    // Check file size limit
    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = Math.round(file.size / 1024 / 1024);
      const maxMB = Math.round(MAX_FILE_SIZE / 1024 / 1024);
      throw new Error(
        `Backup file is too large (${sizeMB}MB). Maximum allowed size is ${maxMB}MB to prevent browser memory issues.`
      );
    }

    this.updateProgress('validating', 1, 4, 'Loading backup file...');

    const zip = await JSZip.loadAsync(file);

    this.updateProgress('validating', 2, 4, 'Validating backup structure...');

    // Check for metadata.json
    const metadataFile = zip.file('metadata.json');
    if (!metadataFile) {
      throw new Error('Invalid backup file: metadata.json not found');
    }

    const metadataContent = await metadataFile.async('text');
    const metadata: RestoreMetadata = JSON.parse(metadataContent);

    // Validate app version compatibility
    if (metadata.appVersion) {
      const currentVersion = APP_VERSION;
      const backupVersion = metadata.appVersion;
      
      // Simple version check - could be enhanced with semver comparison
      const currentMajor = parseInt(currentVersion.split('.')[0]);
      const backupMajor = parseInt(backupVersion.split('.')[0]);
      
      if (backupMajor > currentMajor) {
        throw new Error(
          `Backup was created with a newer version (${backupVersion}) and may not be compatible with current version (${currentVersion}). Please update the app before restoring this backup.`
        );
      }
    }

    this.updateProgress('validating', 3, 4, 'Checking required files...');

    // Validate required files exist - REJECT if missing
    const requiredFiles = ['surveys.json', 'measurements.json', 'settings.json', 'metadata.json'];
    const missingFiles: string[] = [];
    
    for (const fileName of requiredFiles) {
      if (!zip.file(fileName)) {
        missingFiles.push(fileName);
      }
    }

    if (missingFiles.length > 0) {
      throw new Error(
        `Invalid backup file: Required files missing: ${missingFiles.join(', ')}. ` +
        `This backup may be corrupted or incomplete. Please use a valid backup file.`
      );
    }

    // Validate metadata structure
    if (!metadata.timestamp || !metadata.dataTypes) {
      throw new Error(
        'Invalid backup file: metadata.json is missing required fields (timestamp, dataTypes). ' +
        'This backup may be corrupted.'
      );
    }

    this.updateProgress('validating', 4, 4, 'Backup validated successfully');
    return metadata;
  }

  /**
   * Restore complete backup from ZIP file
   */
  async restoreCompleteBackup(file: File): Promise<void> {
    this.checkCancelled();
    this.updateProgress('extracting', 0, 11, 'Loading backup file...');

    const zip = await JSZip.loadAsync(file);
    const metadata = await this.validateBackup(file);

    this.checkCancelled();
    const totalItems = Object.values(metadata.dataTypes).reduce((sum, count) => sum + count, 0);
    this.updateProgress('restoring', 0, 11, `Starting restore (${totalItems} items)...`);

    // Track which operations succeeded for potential rollback
    const restoredOperations: string[] = [];
    let lastSuccessfulStep = '';

    try {
      // 1. Restore Surveys
      this.checkCancelled();
      lastSuccessfulStep = 'surveys';
      this.updateProgress('restoring', 0, 11, `Step 1/11: Restoring ${metadata.dataTypes.surveys} surveys...`);
      await this.restoreSurveys(zip);
      restoredOperations.push('surveys');

      // 2. Restore Measurements
      this.checkCancelled();
      lastSuccessfulStep = 'measurements';
      this.updateProgress('restoring', 1, 11, `Step 2/11: Restoring ${metadata.dataTypes.measurements} measurements...`);
      await this.restoreMeasurements(zip);
      restoredOperations.push('measurements');

      // 3. Restore Videos
      this.checkCancelled();
      lastSuccessfulStep = 'videos';
      this.updateProgress('restoring', 2, 11, `Step 3/11: Restoring ${metadata.dataTypes.videos} videos...`);
      await this.restoreVideos(zip);
      restoredOperations.push('videos');

      // 4. Restore Timelapses
      this.checkCancelled();
      lastSuccessfulStep = 'timelapses';
      this.updateProgress('restoring', 3, 11, `Step 4/11: Restoring ${metadata.dataTypes.timelapses} timelapses...`);
      await this.restoreTimelapses(zip);
      restoredOperations.push('timelapses');

      // 5. Restore Point Clouds
      this.checkCancelled();
      lastSuccessfulStep = 'point clouds';
      this.updateProgress('restoring', 4, 11, `Step 5/11: Restoring ${metadata.dataTypes.pointClouds} point clouds...`);
      await this.restorePointClouds(zip);
      restoredOperations.push('pointClouds');

      // 6. Restore Voice Notes
      this.checkCancelled();
      lastSuccessfulStep = 'voice notes';
      this.updateProgress('restoring', 5, 11, `Step 6/11: Restoring ${metadata.dataTypes.voiceNotes} voice notes...`);
      await this.restoreVoiceNotes(zip);
      restoredOperations.push('voiceNotes');

      // 7. Restore Routes
      this.checkCancelled();
      lastSuccessfulStep = 'routes';
      this.updateProgress('restoring', 6, 11, `Step 7/11: Restoring ${metadata.dataTypes.routes} routes...`);
      await this.restoreRoutes(zip);
      restoredOperations.push('routes');

      // 8. Restore Alerts
      this.checkCancelled();
      lastSuccessfulStep = 'alerts';
      this.updateProgress('restoring', 7, 11, `Step 8/11: Restoring ${metadata.dataTypes.alerts} alerts...`);
      await this.restoreAlerts(zip);
      restoredOperations.push('alerts');

      // 9. Restore Vehicle Traces
      this.checkCancelled();
      lastSuccessfulStep = 'vehicle traces';
      this.updateProgress('restoring', 8, 11, `Step 9/11: Restoring ${metadata.dataTypes.vehicleTraces} vehicle traces...`);
      await this.restoreVehicleTraces(zip);
      restoredOperations.push('vehicleTraces');

      // 10. Restore Settings
      this.checkCancelled();
      lastSuccessfulStep = 'settings';
      this.updateProgress('restoring', 9, 11, 'Step 10/11: Restoring settings...');
      await this.restoreSettings(zip);
      restoredOperations.push('settings');

      // 11. Restore Calibrations
      this.checkCancelled();
      lastSuccessfulStep = 'calibrations';
      this.updateProgress('restoring', 10, 11, 'Step 11/11: Restoring calibrations...');
      await this.restoreCalibrations(zip);
      restoredOperations.push('calibrations');

      this.updateProgress('complete', 11, 11, `Restore complete! ${totalItems} items restored.`);
    } catch (error) {
      // Provide detailed error information
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Re-throw with enhanced error message
      throw new Error(
        `Restore failed while restoring ${lastSuccessfulStep}: ${errorMessage}. ` +
        `Successfully restored: ${restoredOperations.length > 0 ? restoredOperations.join(', ') : 'none'}. ` +
        `Some data may have been partially restored. Please check the application state.`
      );
    }
  }

  private async restoreSurveys(zip: JSZip): Promise<void> {
    try {
      const file = zip.file('surveys.json');
      if (!file) {
        return;
      }

      const content = await file.async('text');
      const surveys = JSON.parse(content);

      const db = await openSurveyDB();
      for (const survey of surveys) {
        await this.handleDuplicate(db, 'surveys', survey);
      }
    } catch (error) {
      throw new Error(`Failed to restore surveys: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async restoreMeasurements(zip: JSZip): Promise<void> {
    try {
      const file = zip.file('measurements.json');
      if (!file) {
        return;
      }

      const content = await file.async('text');
      const measurements = JSON.parse(content);

      const db = await openSurveyDB();
      for (const measurement of measurements) {
        await this.handleDuplicate(db, 'measurements', measurement);
      }
    } catch (error) {
      throw new Error(`Failed to restore measurements: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async restoreVideos(zip: JSZip): Promise<void> {
    try {
      const indexFile = zip.file('videos/index.json');
      if (!indexFile) {
        return;
      }

      const indexContent = await indexFile.async('text');
      const videoIndex = JSON.parse(indexContent);

      const db = await openDB('geo-video-recordings-db', 2);

      for (const videoMeta of videoIndex) {
        const videoFile = zip.file(`videos/${videoMeta.filename}`);
        if (videoFile) {
          const videoBlob = await videoFile.async('blob');
          const videoData = {
            ...videoMeta,
            blob: videoBlob,
          };
          await this.handleDuplicate(db, 'videoRecordings', videoData);
        }
      }
    } catch (error) {
      throw new Error(`Failed to restore videos: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async restoreTimelapses(zip: JSZip): Promise<void> {
    try {
      const indexFile = zip.file('timelapses/index.json');
      if (!indexFile) {
        return;
      }

      const indexContent = await indexFile.async('text');
      const timelapseIndex = JSON.parse(indexContent);

      const db = await openSurveyDB();
      let restoredCount = 0;

      for (const timelapseMeta of timelapseIndex) {
        const folder = zip.folder(`timelapses/${timelapseMeta.folder}`);
        if (!folder) {
          continue;
        }

        const metadataFile = folder.file('metadata.json');
        if (!metadataFile) {
          continue;
        }

        const metadataContent = await metadataFile.async('text');
        const metadata = JSON.parse(metadataContent);

        // Restore frames with original timestamps and metadata - store as Blobs
        const frames: any[] = [];
        const frameMetadata = metadata.frames || [];
        
        for (let i = 0; i < metadata.frameCount; i++) {
          const frameName = `frame_${String(i + 1).padStart(3, '0')}.jpg`;
          const frameFile = folder.file(frameName);
          if (frameFile) {
            const frameBlob = await frameFile.async('blob');
            
            // Preserve original frame metadata - store as Blob (not base64)
            const originalFrameMeta = frameMetadata[i] || {};
            
            frames.push({
              blob: frameBlob,
              timestamp: originalFrameMeta.timestamp || metadata.startTime + (i * (metadata.interval || 5) * 1000),
              associatedPOIs: originalFrameMeta.associatedPOIs || [],
              hasPOI: originalFrameMeta.hasPOI || false,
              frameNumber: originalFrameMeta.frameNumber !== undefined ? originalFrameMeta.frameNumber : i,
            });
          }
        }

        // Restore to IndexedDB 'timelapses' store (each timelapse as separate entry)
        const timelapseData = {
          id: metadata.id || `timelapse_${Date.now()}`,
          startTime: metadata.startTime,
          endTime: metadata.endTime,
          interval: metadata.interval || 5,
          frameCount: frames.length,
          frames: frames,
        };

        await this.handleDuplicate(db, 'timelapses', timelapseData);
        restoredCount++;
      }
    } catch (error) {
      throw new Error(`Failed to restore timelapses: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async restorePointClouds(zip: JSZip): Promise<void> {
    try {
      const indexFile = zip.file('point_clouds/index.json');
      if (!indexFile) {
        return;
      }

      const indexContent = await indexFile.async('text');
      const scanIndex = JSON.parse(indexContent);
      let restoredCount = 0;

      for (const scanMeta of scanIndex) {
        const plyFile = zip.file(`point_clouds/${scanMeta.filename}`);
        if (!plyFile) {
          continue;
        }

        const plyContent = await plyFile.async('text');
        
        // Parse PLY and extract metadata from file
        const { metadata: plyMetadata, points, colors } = await this.parsePLYWithMetadata(plyContent);
        
        // Use original metadata from index.json (not synthetic data)
        const frames = await this.createFramesFromPLY(
          points, 
          colors, 
          scanMeta,  // Original metadata from backup
          plyMetadata // Metadata from PLY file itself
        );
        
        // Save frames to IndexedDB with original metadata
        for (const frame of frames) {
          await saveFrame(frame);
        }
        
        restoredCount++;
      }
    } catch (error) {
      throw new Error(`Failed to restore point clouds: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse PLY file and extract metadata from header comments
   */
  private async parsePLYWithMetadata(plyContent: string): Promise<{
    metadata: any;
    points: number[];
    colors: number[];
  }> {
    const lines = plyContent.split('\n');
    let vertexCount = 0;
    const points: number[] = [];
    const colors: number[] = [];
    const metadata: any = {};

    // Parse header for metadata and structure
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Extract metadata from comments
      if (line.startsWith('comment')) {
        const commentContent = line.substring(7).trim();
        // Parse metadata like "timestamp: 1234567890" or "gps_lat: 43.123"
        const colonIndex = commentContent.indexOf(':');
        if (colonIndex > 0) {
          const key = commentContent.substring(0, colonIndex).trim();
          const value = commentContent.substring(colonIndex + 1).trim();
          metadata[key] = isNaN(Number(value)) ? value : Number(value);
        }
      }
      
      if (line.startsWith('element vertex')) {
        vertexCount = parseInt(line.split(' ')[2]);
      }
      
      if (line === 'end_header') {
        // Parse vertex data
        for (let j = i + 1; j < lines.length && points.length / 3 < vertexCount; j++) {
          const vertexLine = lines[j].trim();
          if (!vertexLine) continue;
          
          const values = vertexLine.split(/\s+/).map(v => parseFloat(v));
          if (values.length >= 3) {
            points.push(values[0], values[1], values[2]);
            
            if (values.length >= 6) {
              colors.push(values[3], values[4], values[5]);
            } else {
              colors.push(255, 255, 255);
            }
          }
        }
        break;
      }
    }

    return { metadata, points, colors };
  }

  /**
   * Create frames from PLY data using original metadata
   */
  private async createFramesFromPLY(
    points: number[],
    colors: number[],
    scanMeta: any,
    plyMetadata: any
  ): Promise<PointCloudFrame[]> {
    // Use original metadata from backup, not synthetic data
    const frame: PointCloudFrame = {
      id: plyMetadata.frameId || scanMeta.frameId || `${scanMeta.scanId}_frame_0`,
      scanId: scanMeta.scanId,
      frameNumber: plyMetadata.frameNumber !== undefined ? plyMetadata.frameNumber : 0,
      timestamp: plyMetadata.timestamp || scanMeta.timestamp || Date.now(),
      points: new Float32Array(points),
      colors: new Uint8Array(colors),
      pointCount: points.length / 3,
      gpsPosition: {
        lat: plyMetadata.gps_lat || scanMeta.gps_lat || 0,
        lon: plyMetadata.gps_lon || scanMeta.gps_lon || 0,
        alt: plyMetadata.gps_alt || scanMeta.gps_alt || 0,
      },
    };

    // Preserve any additional metadata properties from backup
    if (plyMetadata.intensity !== undefined) {
      (frame as any).intensity = plyMetadata.intensity;
    }
    if (scanMeta.cameraPosition) {
      (frame as any).cameraPosition = scanMeta.cameraPosition;
    }
    if (scanMeta.orientation) {
      (frame as any).orientation = scanMeta.orientation;
    }

    return [frame];
  }

  private async restoreVoiceNotes(zip: JSZip): Promise<void> {
    const indexFile = zip.file('voice_notes/index.json');
    if (!indexFile) return;

    const indexContent = await indexFile.async('text');
    const noteIndex = JSON.parse(indexContent);

    const db = await openSurveyDB();

    for (const noteMeta of noteIndex) {
      const noteFile = zip.file(`voice_notes/${noteMeta.filename}`);
      if (noteFile) {
        const audioBlob = await noteFile.async('blob');
        const noteData = {
          ...noteMeta,
          audioBlob,
        };
        await this.handleDuplicate(db, 'voiceNotes', noteData);
      }
    }
  }

  private async restoreRoutes(zip: JSZip): Promise<void> {
    const file = zip.file('routes.json');
    if (!file) return;

    const content = await file.async('text');
    const routes = JSON.parse(content);

    const db = await openSurveyDB();
    for (const route of routes) {
      await this.handleDuplicate(db, 'routes', route);
    }
  }

  private async restoreAlerts(zip: JSZip): Promise<void> {
    const file = zip.file('alerts.json');
    if (!file) return;

    const content = await file.async('text');
    const alerts = JSON.parse(content);

    const db = await openSurveyDB();
    for (const alert of alerts) {
      await this.handleDuplicate(db, 'alerts', alert);
    }
  }

  private async restoreVehicleTraces(zip: JSZip): Promise<void> {
    const file = zip.file('vehicle_traces.json');
    if (!file) return;

    const content = await file.async('text');
    const traces = JSON.parse(content);

    const db = await openSurveyDB();
    if (db.objectStoreNames && db.objectStoreNames.contains('vehicleTraces')) {
      for (const trace of traces) {
        await this.handleDuplicate(db, 'vehicleTraces', trace);
      }
    }
  }

  private async restoreSettings(zip: JSZip): Promise<void> {
    const file = zip.file('settings.json');
    if (!file) return;

    const content = await file.async('text');
    const settings = JSON.parse(content);

    // Restore to localStorage
    for (const [key, value] of Object.entries(settings)) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }

  private async restoreCalibrations(zip: JSZip): Promise<void> {
    const file = zip.file('calibrations.json');
    if (!file) return;

    const content = await file.async('text');
    const calibrations = JSON.parse(content);

    // Restore calibrations using the same storage helper as backup
    if (calibrations.current_calibration) {
      await saveCalibrationToStorage(calibrations.current_calibration);
    }
  }

  private async handleDuplicate(db: any, storeName: string, data: any): Promise<void> {
    if (!data.id) {
      // No ID, just add
      await db.add(storeName, data);
      return;
    }

    // Check if exists
    const existing = await db.get(storeName, data.id);

    if (!existing) {
      // Doesn't exist, just add
      await db.add(storeName, data);
      return;
    }

    // Handle based on strategy
    switch (this.duplicateStrategy) {
      case 'skip':
        // Do nothing - skip this entry
        break;
      case 'overwrite':
        await db.put(storeName, data);
        break;
      case 'merge':
        // FIXED: Properly delete the id property before adding
        // Clone object and completely DELETE the id property
        const newData = { ...data };
        delete newData.id;
        await db.add(storeName, newData);
        break;
    }
  }

  private updateProgress(
    phase: RestoreProgress['phase'],
    current: number,
    total: number,
    message: string
  ) {
    if (this.onProgress) {
      this.onProgress({ phase, current, total, message });
    }
  }
}

// Export convenience function
export async function restoreBackup(
  file: File,
  onProgress?: (progress: RestoreProgress) => void,
  duplicateStrategy: DuplicateStrategy = 'merge',
  abortSignal?: AbortSignal
): Promise<void> {
  const manager = new RestoreManager(onProgress, abortSignal);
  manager.setDuplicateStrategy(duplicateStrategy);
  await manager.restoreCompleteBackup(file);
}
