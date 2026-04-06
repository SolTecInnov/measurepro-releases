import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { openDB } from 'idb';
import { openSurveyDB } from '@/lib/survey/db';
import { loadCalibrationFromStorage } from '@/lib/opencv/calibration-storage';
import { getAllScansMetadata, loadScanFrames } from '@/lib/pointCloud/storage/indexedDbStore';
import type { PointCloudFrame } from '@/lib/pointCloud/types';
import { APP_VERSION } from '@/lib/version';

export interface BackupMetadata {
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
    calibrations: number;
  };
  totalSize: number;
}

export interface BackupProgress {
  phase: 'collecting' | 'compressing' | 'downloading';
  current: number;
  total: number;
  message: string;
}

export class BackupManager {
  private onProgress?: (progress: BackupProgress) => void;
  private abortSignal?: AbortSignal;

  constructor(onProgress?: (progress: BackupProgress) => void, abortSignal?: AbortSignal) {
    this.onProgress = onProgress;
    this.abortSignal = abortSignal;
  }

  private checkCancelled(): void {
    if (this.abortSignal?.aborted) {
      throw new Error('Backup cancelled by user');
    }
  }

  async exportCompleteBackup(): Promise<void> {
    const zip = new JSZip();
    const metadata: BackupMetadata = {
      timestamp: new Date().toISOString(),
      appVersion: APP_VERSION,
      dataTypes: {
        surveys: 0,
        measurements: 0,
        videos: 0,
        timelapses: 0,
        pointClouds: 0,
        voiceNotes: 0,
        routes: 0,
        alerts: 0,
        vehicleTraces: 0,
        calibrations: 0,
      },
      totalSize: 0,
    };

    this.checkCancelled();
    this.updateProgress('collecting', 0, 11, 'Step 1/11: Collecting surveys...');

    const surveys = await this.exportSurveys();
    zip.file('surveys.json', JSON.stringify(surveys, null, 2));
    metadata.dataTypes.surveys = surveys.length;
    
    this.checkCancelled();
    this.updateProgress('collecting', 1, 11, `Step 2/11: Exporting ${surveys.length} surveys...`);

    const measurements = await this.exportMeasurements();
    const measurementsCSV = await this.convertMeasurementsToCSV(measurements);
    zip.file('measurements.csv', measurementsCSV);
    zip.file('measurements.json', JSON.stringify(measurements, null, 2));
    metadata.dataTypes.measurements = measurements.length;

    this.checkCancelled();
    this.updateProgress('collecting', 2, 11, `Step 3/11: Collecting videos (${measurements.length} measurements)...`);

    const videos = await this.exportVideos(zip);
    metadata.dataTypes.videos = videos.length;

    this.checkCancelled();
    this.updateProgress('collecting', 3, 11, `Step 4/11: Exporting ${videos.length} videos...`);

    const timelapses = await this.exportTimelapses(zip);
    metadata.dataTypes.timelapses = timelapses.length;

    this.checkCancelled();
    this.updateProgress('collecting', 4, 11, `Step 5/11: Exporting ${timelapses.length} timelapses...`);

    const pointClouds = await this.exportPointClouds(zip);
    metadata.dataTypes.pointClouds = pointClouds.length;

    this.checkCancelled();
    this.updateProgress('collecting', 5, 11, `Step 6/11: Exporting ${pointClouds.length} point clouds...`);

    const voiceNotes = await this.exportVoiceNotes(zip);
    metadata.dataTypes.voiceNotes = voiceNotes.length;

    this.checkCancelled();
    this.updateProgress('collecting', 6, 11, `Step 7/11: Exporting ${voiceNotes.length} voice notes...`);

    const routes = await this.exportRoutes();
    zip.file('routes.json', JSON.stringify(routes, null, 2));
    metadata.dataTypes.routes = routes.length;

    this.checkCancelled();
    this.updateProgress('collecting', 7, 11, `Step 8/11: Exporting ${routes.length} routes...`);

    const alerts = await this.exportAlerts();
    zip.file('alerts.json', JSON.stringify(alerts, null, 2));
    metadata.dataTypes.alerts = alerts.length;

    this.checkCancelled();
    this.updateProgress('collecting', 8, 11, 'Step 9/11: Collecting vehicle traces...');

    const vehicleTraces = await this.exportVehicleTraces();
    zip.file('vehicle_traces.json', JSON.stringify(vehicleTraces, null, 2));
    metadata.dataTypes.vehicleTraces = vehicleTraces.length;

    this.checkCancelled();
    this.updateProgress('collecting', 9, 11, 'Step 10/11: Collecting settings...');

    const settings = await this.exportSettings();
    zip.file('settings.json', JSON.stringify(settings, null, 2));

    this.checkCancelled();
    this.updateProgress('collecting', 10, 11, 'Step 11/11: Collecting calibrations...');

    const calibrations = await this.exportCalibrations();
    zip.file('calibrations.json', JSON.stringify(calibrations, null, 2));
    metadata.dataTypes.calibrations = calibrations ? 1 : 0;

    zip.file('metadata.json', JSON.stringify(metadata, null, 2));

    this.checkCancelled();
    this.updateProgress('compressing', 0, 1, 'Compressing backup (this may take a moment)...');

    const blob = await zip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    metadata.totalSize = blob.size;

    this.checkCancelled();
    const sizeMB = (blob.size / (1024 * 1024)).toFixed(1);
    this.updateProgress('downloading', 0, 1, `Downloading backup (${sizeMB}MB)...`);

    const filename = `measurepro_backup_${new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]}_${Date.now()}.zip`;
    saveAs(blob, filename);

    this.updateProgress('downloading', 1, 1, 'Backup complete!');
    
    localStorage.setItem('measurepro_last_backup_timestamp', Date.now().toString());
  }

  private updateProgress(phase: BackupProgress['phase'], current: number, total: number, message: string) {
    if (this.onProgress) {
      this.onProgress({ phase, current, total, message });
    }
  }

  private async exportSurveys(): Promise<any[]> {
    try {
      const db = await openSurveyDB();
      return await db.getAll('surveys');
    } catch (error) {
      return [];
    }
  }

  private async exportMeasurements(): Promise<any[]> {
    try {
      const db = await openSurveyDB();
      return await db.getAll('measurements');
    } catch (error) {
      return [];
    }
  }

  private async exportVideos(zip: JSZip): Promise<any[]> {
    try {
      const videoDB = await openDB('geo-video-recordings-db', 2);
      const videos = await videoDB.getAll('videoRecordings');
      
      if (videos.length === 0) {
        return [];
      }

      const videosFolder = zip.folder('videos');
      const videoIndex: any[] = [];

      for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        if (video.blob) {
          videosFolder!.file(`video_${String(i + 1).padStart(3, '0')}.webm`, video.blob);
          videoIndex.push({
            filename: `video_${String(i + 1).padStart(3, '0')}.webm`,
            id: video.id,
            surveyId: video.surveyId,
            startTime: video.startTime,
            endTime: video.endTime,
            duration: video.duration,
          });
        }
      }

      videosFolder!.file('index.json', JSON.stringify(videoIndex, null, 2));
      return videos;
    } catch (error) {
      return [];
    }
  }

  private async exportTimelapses(zip: JSZip): Promise<any[]> {
    try {
      const db = await openSurveyDB();
      const timelapses = await db.getAll('timelapses');
      
      // Also get orphaned frames from 'frames' table (crash recovery frames)
      let orphanedFrames: any[] = [];
      try {
        orphanedFrames = await db.getAll('frames');
      } catch (error) {
        // frames table might not exist in older versions
      }
      
      if (timelapses.length === 0 && orphanedFrames.length === 0) {
        return [];
      }

      const timelapsesFolder = zip.folder('timelapses');
      const timelapseIndex: any[] = [];

      for (let i = 0; i < timelapses.length; i++) {
        const timelapse = timelapses[i];
        const timelapseFolderName = `timelapse_${String(i + 1).padStart(3, '0')}`;
        const folder = timelapsesFolder!.folder(timelapseFolderName);

        // Export frames as Blobs
        if (timelapse.frames && Array.isArray(timelapse.frames)) {
          for (let j = 0; j < timelapse.frames.length; j++) {
            const frame = timelapse.frames[j];
            
            // Handle different frame data formats: blob, imageData, or imageUrl
            let blob: Blob | null = null;
            
            if (frame.blob && frame.blob instanceof Blob) {
              blob = frame.blob;
            } else if (frame.imageData) {
              if (frame.imageData instanceof Blob) {
                blob = frame.imageData;
              } else if (typeof frame.imageData === 'string') {
                blob = await this.base64ToBlob(frame.imageData);
              }
            } else if (frame.imageUrl && typeof frame.imageUrl === 'string') {
              blob = await this.base64ToBlob(frame.imageUrl);
            }
            
            if (blob) {
              folder!.file(`frame_${String(j + 1).padStart(3, '0')}.jpg`, blob);
            }
          }
        }

        // Export metadata with ALL original properties
        const metadata = {
          id: timelapse.id,
          surveyId: timelapse.surveyId,
          startTime: timelapse.startTime,
          endTime: timelapse.endTime,
          interval: timelapse.interval,
          frameCount: timelapse.frames?.length || 0,
          frames: timelapse.frames?.map((f: any, idx: number) => ({
            timestamp: f.timestamp,
            associatedPOIs: f.associatedPOIs || [],
            hasPOI: f.hasPOI || false,
            frameNumber: f.frameNumber !== undefined ? f.frameNumber : idx,
          })) || []
        };
        folder!.file('metadata.json', JSON.stringify(metadata, null, 2));
        
        timelapseIndex.push({
          folder: timelapseFolderName,
          ...metadata
        });
      }

      // Export orphaned frames as a separate "unsaved timelapse"
      if (orphanedFrames.length > 0) {
        const orphanedFolderName = `timelapse_orphaned_frames`;
        const orphanedFolder = timelapsesFolder!.folder(orphanedFolderName);
        
        // Export each orphaned frame - handle all image formats
        for (let j = 0; j < orphanedFrames.length; j++) {
          const frame = orphanedFrames[j];
          let blob: Blob | null = null;
          
          // Handle different frame data formats: blob, imageData, or imageUrl (same as main timelapse export)
          if (frame.blob && frame.blob instanceof Blob) {
            blob = frame.blob;
          } else if (frame.imageData) {
            if (frame.imageData instanceof Blob) {
              blob = frame.imageData;
            } else if (typeof frame.imageData === 'string') {
              blob = await this.base64ToBlob(frame.imageData);
            }
          } else if (frame.imageUrl && typeof frame.imageUrl === 'string') {
            blob = await this.base64ToBlob(frame.imageUrl);
          }
          
          if (blob) {
            orphanedFolder!.file(`frame_${String(j + 1).padStart(3, '0')}.jpg`, blob);
          }
        }
        
        // Export orphaned frames metadata
        const orphanedMetadata = {
          id: 'orphaned-frames',
          note: 'Unsaved timelapse frames from crash recovery',
          frameCount: orphanedFrames.length,
          frames: orphanedFrames.map((f: any, idx: number) => ({
            id: f.id,
            timestamp: f.timestamp,
            associatedPOIs: f.associatedPOIs || [],
            hasPOI: f.hasPOI || false,
            frameNumber: f.frameNumber !== undefined ? f.frameNumber : idx,
          }))
        };
        orphanedFolder!.file('metadata.json', JSON.stringify(orphanedMetadata, null, 2));
        
        timelapseIndex.push({
          folder: orphanedFolderName,
          ...orphanedMetadata
        });
      }

      timelapsesFolder!.file('index.json', JSON.stringify(timelapseIndex, null, 2));
      return [...timelapses, ...(orphanedFrames.length > 0 ? [{ id: 'orphaned-frames', frames: orphanedFrames }] : [])];
    } catch (error) {
      return [];
    }
  }

  private async exportPointClouds(zip: JSZip): Promise<any[]> {
    try {
      const scansMetadata = await getAllScansMetadata();
      
      if (scansMetadata.length === 0) {
        return [];
      }

      const pointCloudsFolder = zip.folder('point_clouds');
      const scanIndex: any[] = [];

      for (let i = 0; i < scansMetadata.length; i++) {
        const scanMeta = scansMetadata[i];
        const frames = await loadScanFrames(scanMeta.scanId);
        
        if (frames.length === 0) continue;

        const plyData = await this.convertFramesToPLY(frames);
        const filename = `scan_${String(i + 1).padStart(3, '0')}.ply`;
        pointCloudsFolder!.file(filename, plyData);
        
        scanIndex.push({
          filename,
          scanId: scanMeta.scanId,
          totalFrames: scanMeta.totalFrames,
          totalPoints: scanMeta.totalPoints,
          storageSizeBytes: scanMeta.storageSizeBytes,
        });
      }

      pointCloudsFolder!.file('index.json', JSON.stringify(scanIndex, null, 2));
      return scansMetadata;
    } catch (error) {
      return [];
    }
  }

  private async exportVoiceNotes(zip: JSZip): Promise<any[]> {
    try {
      const db = await openSurveyDB();
      const voiceNotes = await db.getAll('voiceNotes');
      
      if (voiceNotes.length === 0) {
        return [];
      }

      const voiceNotesFolder = zip.folder('voice_notes');
      const noteIndex: any[] = [];

      for (let i = 0; i < voiceNotes.length; i++) {
        const note = voiceNotes[i];
        if (note.audioBlob) {
          voiceNotesFolder!.file(`note_${String(i + 1).padStart(3, '0')}.webm`, note.audioBlob);
          noteIndex.push({
            filename: `note_${String(i + 1).padStart(3, '0')}.webm`,
            id: note.id,
            measurementId: note.measurementId,
            timestamp: note.timestamp,
            duration: note.duration,
            transcript: note.transcript,
          });
        }
      }

      voiceNotesFolder!.file('index.json', JSON.stringify(noteIndex, null, 2));
      return voiceNotes;
    } catch (error) {
      return [];
    }
  }

  private async exportRoutes(): Promise<any[]> {
    try {
      const db = await openSurveyDB();
      return await db.getAll('routes');
    } catch (error) {
      return [];
    }
  }

  private async exportAlerts(): Promise<any[]> {
    try {
      const db = await openSurveyDB();
      return await db.getAll('alerts');
    } catch (error) {
      return [];
    }
  }

  private async exportVehicleTraces(): Promise<any[]> {
    try {
      const db = await openSurveyDB();
      if (db.objectStoreNames && db.objectStoreNames.contains('vehicleTraces')) {
        return await db.getAll('vehicleTraces');
      }
      return [];
    } catch (error) {
      return [];
    }
  }

  private async exportSettings(): Promise<any> {
    const settings: any = {};
    
    const settingsKeys = [
      'measurepro_laser_settings',
      'measurepro_gps_settings',
      'measurepro_camera_settings',
      'measurepro_map_settings',
      'measurepro_logging_settings',
      'measurepro_alert_settings',
      'measurepro_voice_settings',
      'measurepro_convoy_settings',
      'measurepro_ai_settings',
      'measurepro_detection_settings',
      'measurepro_envelope_settings',
      'measurepro_display_settings',
      'camera-store',
      'serial-store',
      'gps-store',
      'logging-store',
      'alerts-store',
      'convoy-store',
      'detection-store',
      'sweptPath-store',
      'envelope-store',
      'calibration-store',
      'pointCloud-store',
      'videoRecording-store',
      'vehicleTrace-store',
      'routeEnforcement-store',
    ];

    for (const key of settingsKeys) {
      const value = localStorage.getItem(key);
      if (value) {
        try {
          settings[key] = JSON.parse(value);
        } catch {
          settings[key] = value;
        }
      }
    }

    return settings;
  }

  private async exportCalibrations(): Promise<any> {
    try {
      const calibration = await loadCalibrationFromStorage();
      if (calibration) {
        return {
          current_calibration: calibration,
          exportedAt: new Date().toISOString(),
        };
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  private async convertMeasurementsToCSV(measurements: any[]): Promise<string> {
    if (measurements.length === 0) return '';

    const keys = Array.from(new Set(measurements.flatMap(m => Object.keys(m))));
    
    let csv = keys.join(',') + '\n';

    for (const measurement of measurements) {
      const row = keys.map(key => {
        const value = measurement[key];
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') {
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        }
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return String(value);
      });
      csv += row.join(',') + '\n';
    }

    return csv;
  }

  private async base64ToBlob(base64: string): Promise<Blob> {
    const base64Data = base64.split(',')[1] || base64;
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: 'image/jpeg' });
  }

  private async convertFramesToPLY(frames: PointCloudFrame[]): Promise<string> {
    let totalPoints = 0;
    const allPoints: number[] = [];
    const allColors: number[] = [];

    for (const frame of frames) {
      const points = frame.points;
      const colors = frame.colors;
      
      for (let i = 0; i < points.length; i += 3) {
        allPoints.push(points[i], points[i + 1], points[i + 2]);
        
        if (colors && colors.length >= i + 3) {
          allColors.push(colors[i], colors[i + 1], colors[i + 2]);
        } else {
          allColors.push(255, 255, 255);
        }
        
        totalPoints++;
      }
    }

    let ply = 'ply\n';
    ply += 'format ascii 1.0\n';
    ply += 'comment MeasurePRO Point Cloud Export\n';
    ply += `element vertex ${totalPoints}\n`;
    ply += 'property float x\n';
    ply += 'property float y\n';
    ply += 'property float z\n';
    ply += 'property uchar red\n';
    ply += 'property uchar green\n';
    ply += 'property uchar blue\n';
    ply += 'end_header\n';

    for (let i = 0; i < totalPoints; i++) {
      const x = allPoints[i * 3];
      const y = allPoints[i * 3 + 1];
      const z = allPoints[i * 3 + 2];
      const r = Math.round(allColors[i * 3]);
      const g = Math.round(allColors[i * 3 + 1]);
      const b = Math.round(allColors[i * 3 + 2]);
      
      ply += `${x} ${y} ${z} ${r} ${g} ${b}\n`;
    }

    return ply;
  }
}

export const backupManager = new BackupManager();

export async function createCompleteBackup(
  onProgress?: (progress: BackupProgress) => void,
  abortSignal?: AbortSignal
): Promise<void> {
  const manager = new BackupManager(onProgress, abortSignal);
  await manager.exportCompleteBackup();
}
