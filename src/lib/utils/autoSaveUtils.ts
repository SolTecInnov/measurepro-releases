import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { openSurveyDB } from '../survey/db';
import { Survey } from '../survey/types';

/**
 * Resolve ground reference value, in priority order:
 *   1. groundRefM (current schema, since v16.1.24)
 *   2. groundRef  (legacy field name)
 *   3. parse from `note` ("... | GND: 2.08m") for historical records
 */
function getGroundRef(m: any): number {
  if (typeof m.groundRefM === 'number') return m.groundRefM;
  if (typeof m.groundRef === 'number') return m.groundRef;
  const match = typeof m.note === 'string' && m.note.match(/GND:?\s*(-?\d+(?:\.\d+)?)\s*m/i);
  return match ? parseFloat(match[1]) : 0;
}

/**
 * Get the next auto-save part number for a survey
 */
const getNextPartNumber = (surveyId: string): number => {
  const key = `autoSave_partNumber_${surveyId}`;
  const currentPart = parseInt(localStorage.getItem(key) || '0', 10);
  const nextPart = currentPart + 1;
  localStorage.setItem(key, nextPart.toString());
  return currentPart;
};

/**
 * Reset part number for a new survey session
 */
export const resetAutoSavePartNumber = (surveyId: string): void => {
  const key = `autoSave_partNumber_${surveyId}`;
  localStorage.setItem(key, '0');
};

/**
 * Generate auto-save filename with survey title, date, time, and part number
 * Format: {surveyTitle}_{YYYY-MM-DD}_{HH-MM-SS}_part{N}.zip
 */
const generateAutoSaveFilename = (survey: Survey): string => {
  const now = new Date();
  const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const time = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
  
  // Sanitize survey title for filename
  const title = (survey.surveyTitle || survey.name || 'survey')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50);
  
  const partNumber = getNextPartNumber(survey.id);
  
  return `${title}_${date}_${time}_part${partNumber}.zip`;
};

/**
 * Comprehensive auto-save with all media:
 * - POI data (CSV + JSON)
 * - Images
 * - Timelapse frames
 * - Video recordings
 * - Drawings
 */
export const autoSaveSurvey = async (survey: Survey | null): Promise<void> => {
  if (!survey) {
    return;
  }
  
  try {
    const autoSaveEnabled = localStorage.getItem('autoSaveEnabled') !== 'false';
    
    if (!autoSaveEnabled) {
      return;
    }
    
    console.log('[AutoSave] Starting comprehensive auto-save for survey:', survey.id);
    
    const db = await openSurveyDB();
    const zip = new JSZip();
    
    // 1. Export survey metadata
    zip.file('survey.json', JSON.stringify(survey, null, 2));
    
    // 2. Export POI data (measurements)
    const allMeasurements = await db.getAllFromIndex('measurements', 'by-date');
    const surveyMeasurements = allMeasurements.filter(m => m.user_id === survey.id);
    
    // POI data as JSON
    zip.file('pois.json', JSON.stringify(surveyMeasurements, null, 2));
    
    // POI data as CSV
    const csvHeaders = [
      'ID', 'Date', 'Time', 'Height (m)', 'Ground Ref (m)', 'GPS Alt (m)',
      'Latitude', 'Longitude', 'Speed (km/h)', 'Heading (°)',
      'Road Number', 'POI Number', 'POI Type', 'Note', 'Has Image', 'Has Video'
    ].join(',');
    
    const csvRows = surveyMeasurements.map(m => [
      m.id,
      m.utcDate,
      m.utcTime,
      m.rel?.toFixed(3) || '',
      getGroundRef(m).toFixed(3),
      m.altGPS?.toFixed(1) || '',
      m.latitude?.toFixed(6) || '',
      m.longitude?.toFixed(6) || '',
      m.speed?.toFixed(1) || '',
      m.heading?.toFixed(1) || '',
      m.roadNumber || '',
      m.poiNumber || '',
      m.poi_type || '',
      (m.note || '').replace(/,/g, ';'),
      m.imageUrl ? 'Yes' : 'No',
      m.videoUrl || m.videoBlobId ? 'Yes' : 'No'
    ].join(','));
    
    zip.file('pois.csv', [csvHeaders, ...csvRows].join('\n'));
    
    // 3. Export Images
    const imagesFolder = zip.folder('images');
    let imageCount = 0;
    
    for (const measurement of surveyMeasurements) {
      if (measurement.imageUrl && measurement.imageUrl.startsWith('data:')) {
        try {
          const base64Data = measurement.imageUrl.split(',')[1];
          if (base64Data) {
            const imageName = `POI_${measurement.poiNumber || measurement.id}_${measurement.poi_type || 'manual'}.jpg`;
            imagesFolder?.file(imageName, base64Data, { base64: true });
            imageCount++;
          }
        } catch (err) {
          console.warn('[AutoSave] Failed to export image for POI:', measurement.id);
        }
      }
    }
    
    // 4. Export Videos
    const videosFolder = zip.folder('videos');
    let videoCount = 0;
    
    if (db.objectStoreNames.contains('videos')) {
      try {
        const videos = await db.getAll('videos');
        const surveyVideos = videos.filter((v: any) => v.surveyId === survey.id);
        
        for (const video of surveyVideos) {
          if (video.blob) {
            try {
              const arrayBuffer = await video.blob.arrayBuffer();
              const videoName = `video_${video.id || Date.now()}.webm`;
              videosFolder?.file(videoName, arrayBuffer);
              videoCount++;
            } catch (err) {
              console.warn('[AutoSave] Failed to export video:', video.id);
            }
          }
        }
      } catch (err) {
        console.warn('[AutoSave] Videos store access failed');
      }
    }
    
    // 5. Export Timelapse frames
    const timelapseFolder = zip.folder('timelapse');
    let timelapseCount = 0;
    
    if (db.objectStoreNames.contains('timelapseFrames')) {
      try {
        const frames = await db.getAll('timelapseFrames');
        const surveyFrames = frames.filter((f: any) => f.surveyId === survey.id);
        
        for (let i = 0; i < surveyFrames.length; i++) {
          const frame = surveyFrames[i];
          if (frame.imageData && frame.imageData.startsWith('data:')) {
            const base64Data = frame.imageData.split(',')[1];
            if (base64Data) {
              const frameName = `frame_${String(i).padStart(5, '0')}.jpg`;
              timelapseFolder?.file(frameName, base64Data, { base64: true });
              timelapseCount++;
            }
          }
        }
        
        // Also export timelapse metadata
        if (surveyFrames.length > 0) {
          const metadata = surveyFrames.map((f: any) => ({
            timestamp: f.timestamp,
            gps: f.gps,
            poiId: f.poiId
          }));
          timelapseFolder?.file('timelapse_metadata.json', JSON.stringify(metadata, null, 2));
        }
      } catch (err) {
        console.warn('[AutoSave] Timelapse frames access failed');
      }
    }
    
    // 6. Export Drawings
    const drawingsFolder = zip.folder('drawings');
    let drawingCount = 0;
    
    for (const measurement of surveyMeasurements) {
      if ((measurement as any).drawingData) {
        try {
          const drawingData = (measurement as any).drawingData;
          if (drawingData.startsWith('data:')) {
            const base64Data = drawingData.split(',')[1];
            if (base64Data) {
              const drawingName = `drawing_POI_${measurement.poiNumber || measurement.id}.png`;
              drawingsFolder?.file(drawingName, base64Data, { base64: true });
              drawingCount++;
            }
          } else {
            // It might be JSON drawing data
            const drawingName = `drawing_POI_${measurement.poiNumber || measurement.id}.json`;
            drawingsFolder?.file(drawingName, typeof drawingData === 'string' ? drawingData : JSON.stringify(drawingData));
            drawingCount++;
          }
        } catch (err) {
          console.warn('[AutoSave] Failed to export drawing for POI:', measurement.id);
        }
      }
    }
    
    // 7. Export Vehicle Traces (route data)
    if (db.objectStoreNames.contains('vehicleTraces')) {
      try {
        const traces = await db.getAllFromIndex('vehicleTraces', 'by-survey', survey.id);
        if (traces.length > 0) {
          zip.file('vehicle_traces.json', JSON.stringify(traces, null, 2));
        }
      } catch (err) {
        console.warn('[AutoSave] Vehicle traces access failed');
      }
    }
    
    // 8. Export summary
    const summary = {
      surveyId: survey.id,
      surveyTitle: survey.surveyTitle || survey.name,
      exportDate: new Date().toISOString(),
      counts: {
        pois: surveyMeasurements.length,
        images: imageCount,
        videos: videoCount,
        timelapseFrames: timelapseCount,
        drawings: drawingCount
      }
    };
    zip.file('autosave_summary.json', JSON.stringify(summary, null, 2));
    
    // Generate filename
    const filename = generateAutoSaveFilename(survey);
    
    // Generate ZIP
    const blob = await zip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    // PERF/UX FIX: In Electron, save silently to Documents/MeasurePRO/surveys/
    // without showing a save dialog every time (was interrupting driving!)
    if (window.electronAPI?.isElectron && window.electronAPI?.writeFile) {
      try {
        const buffer = await blob.arrayBuffer();
        // Use a fixed auto-save path — no dialog
        const autoSavePath = await window.electronAPI.getAutoSavePath?.(filename);
        if (autoSavePath) {
          await window.electronAPI.writeFile(autoSavePath, Array.from(new Uint8Array(buffer)));
          console.log('[AutoSave] Saved silently to:', autoSavePath);
        } else {
          // Fallback: use saveFileNative which shows dialog
          const { saveFileNative } = await import('./exportUtils');
          // Don't show dialog for auto-save — just skip
          console.log('[AutoSave] Silent save unavailable, skipping dialog in Electron');
        }
        return; // Done — don't fall through to saveAs
      } catch(e) {
        console.warn('[AutoSave] Silent save failed, falling back:', e);
      }
    }

    // Browser fallback: use file-saver (triggers download in browser)
    saveAs(blob, filename);
    
    console.log(`[AutoSave] Complete! Saved ${filename} with:`, summary.counts);
    
    // Update last auto-save time in IndexedDB
    await db.put('surveys', {
      ...survey,
      lastAutoSaved: new Date().toISOString()
    });
    
    // Dispatch auto-save event
    window.dispatchEvent(new CustomEvent('autosave-complete', {
      detail: {
        surveyId: survey.id,
        filename,
        timestamp: new Date().toISOString(),
        counts: summary.counts
      }
    }));
    
    // Update last auto-save time
    localStorage.setItem('lastAutoSaveTime', new Date().toISOString());
    localStorage.setItem(`survey_lastSaved_${survey.id}`, new Date().toISOString());
    
  } catch (error) {
    console.error('[AutoSave] Failed:', error);
    
    // Dispatch error event
    window.dispatchEvent(new CustomEvent('autosave-error', {
      detail: {
        surveyId: survey.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }));
    
    // Try to save at least to localStorage as emergency backup
    try {
      localStorage.setItem(`emergency_survey_${survey.id}`, JSON.stringify(survey));
    } catch (emergencyError) {
      // Silent fail
    }
  }
};

/**
 * Set up auto-save interval for a survey
 * @param survey - Survey to auto-save
 * @param intervalMinutes - Interval in minutes between auto-saves (default: 60 minutes / 1 hour)
 * @returns Interval ID for clearing the interval later
 */
export const setupAutoSave = (survey: Survey | null, intervalMinutes: number = 60): number => {
  if (!survey) {
    return 0;
  }
  
  // Convert minutes to milliseconds
  const intervalMs = intervalMinutes * 60 * 1000;
  
  console.log(`[AutoSave] Setting up auto-save every ${intervalMinutes} minutes for survey:`, survey.id);
  
  // Set up interval for auto-save
  const intervalId = window.setInterval(() => {
    autoSaveSurvey(survey);
  }, intervalMs);
  
  return intervalId;
};

/**
 * Clear auto-save interval
 * @param intervalId - Interval ID to clear
 */
export const clearAutoSave = (intervalId: number): void => {
  if (intervalId) {
    window.clearInterval(intervalId);
  }
};

/**
 * Trigger manual auto-save (for "Save Now" button)
 */
export const triggerManualAutoSave = async (survey: Survey | null): Promise<boolean> => {
  if (!survey) {
    return false;
  }
  
  try {
    await autoSaveSurvey(survey);
    return true;
  } catch (error) {
    console.error('[AutoSave] Manual save failed:', error);
    return false;
  }
};
