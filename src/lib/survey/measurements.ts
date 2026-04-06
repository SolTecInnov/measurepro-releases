import { Measurement } from './types';
import { openSurveyDB, initCSVBackupDB, incrementMutationCounter } from './db';
import { useVideoRecordingStore } from '../../stores/videoRecordingStore';
import { incrementPersistedVersion, invalidateSnapshot } from './measurementSnapshot';
import { addMeasurementViaWorker, isWorkerArchitectureAvailable } from './workerAdapter';
import { getMeasurementFeed } from './MeasurementFeed';
import { toast } from 'sonner';

export async function getNextPOINumber(surveyId: string): Promise<number> {
  const db = await openSurveyDB();
  
  // PERFORMANCE FIX: Use cursor-based scan to find highest POI number
  // Previous: getAllFromIndex loaded ALL measurements (O(n) lag at 5,000+ entries)
  // Current: Cursor scans backwards until first POI with poiNumber found
  // CRITICAL: Must scan until POI found, not stop after arbitrary count
  // (100+ non-POI measurements between POIs is common in continuous logging)
  const tx = db.transaction('measurements', 'readonly');
  const index = tx.objectStore('measurements').index('by-survey');
  
  // Open cursor in reverse (newest first) and scan until we find a POI
  let cursor = await index.openCursor(surveyId, 'prev');
  let maxPoiNumber = 0;
  
  // Scan backwards until we find a measurement with a POI number
  while (cursor) {
    const measurement = cursor.value as Measurement;
    if (measurement.poiNumber !== null && measurement.poiNumber !== undefined) {
      maxPoiNumber = Math.max(maxPoiNumber, measurement.poiNumber);
      break; // Found a POI number, this is our max (scanning newest first)
    }
    cursor = await cursor.continue();
  }
  
  return maxPoiNumber + 1;
}

export const addMeasurement = async (measurement: Measurement) => {
  try {
    // Check if video recording is active and add timestamp
    const videoRecordingState = useVideoRecordingStore.getState();
    if (videoRecordingState.isRecording && videoRecordingState.currentRecordingId) {
      const videoTimestamp = videoRecordingState.getCurrentTimestamp();
      if (videoTimestamp !== null) {
        measurement.videoTimestamp = videoTimestamp;
        measurement.videoBlobId = videoRecordingState.currentRecordingId;
      }
    }
    
    // PERFORMANCE FIX: Route ALL writes through worker architecture (no main thread writes!)
    if (isWorkerArchitectureAvailable()) {
      await addMeasurementViaWorker({
        measurement,
        gpsData: {
          latitude: measurement.latitude,
          longitude: measurement.longitude,
          altitude: measurement.altGPS,
          speed: measurement.speed,
          heading: measurement.heading
        }
      });
      return measurement;
    }
    
    // FALLBACK ONLY: If worker not available, use main thread (legacy compatibility)
    // This should NEVER happen in production since workers are initialized on app startup
    console.warn('⚠️ Worker not available - falling back to main thread write. This should not happen!');
    
    const db = await openSurveyDB();
    
    // Use put instead of add to handle potential ID conflicts
    await db.put('measurements', measurement);
    
    // PAGINATION: Increment mutation counter
    incrementMutationCounter();
    
    // Invalidate snapshot for live updates
    await incrementPersistedVersion(measurement.user_id);
    invalidateSnapshot(measurement.user_id);
    
    // Emergency backup to localStorage
    try {
      const backupKey = `measurement_${measurement.id}`;
      localStorage.setItem(backupKey, JSON.stringify(measurement));
    } catch (backupError) {
      // Silent fail
    }
    
    // NOTE: Main-thread CSV writing removed - causes blocking on high-volume surveys
    // CSV export is available through the export page when needed
    
    // Dispatch change event
    window.dispatchEvent(new Event('dbchange'));
    
    // Return the inserted measurement (UI will update via dbchange event)
    return measurement;
  } catch (error) {
    // Emergency fallback - save to localStorage
    try {
      const backupKey = `emergency_measurement_${measurement.id}`;
      localStorage.setItem(backupKey, JSON.stringify(measurement));
      
      // Show user-friendly error message
      throw new Error('Database temporarily unavailable. Your data has been saved locally and will be restored automatically.');
    } catch (emergencyError) {
      throw new Error('Critical error: Unable to save measurement. Please try refreshing the page.');
    }
  }
};

// Function to append a measurement to the local CSV file
export const appendToLocalCSV = async (measurement: Measurement) => {
  try {
    const surveyId = measurement.user_id;
    const storageKey = `survey_csv_${surveyId}`;
    
    // Format the measurement as a CSV row first (cheap operation)
    const imageFilename = measurement.imageUrl ? 
      `image_${measurement.roadNumber || 'R000'}_${String(measurement.poiNumber || 0).padStart(5, '0')}_${measurement.poi_type || 'none'}_${measurement.id.substring(0, 8)}.jpg` : '';
    const videoFilename = measurement.videoUrl ? 
      `video_${measurement.roadNumber || 'R000'}_${String(measurement.poiNumber || 0).padStart(5, '0')}_${measurement.poi_type || 'none'}_${measurement.id.substring(0, 8)}.webm` : '';
    
    const row = [
      measurement.id,
      measurement.utcDate,
      measurement.utcTime,
      measurement.rel != null ? measurement.rel.toFixed(3) : '',
      measurement.altGPS != null ? measurement.altGPS.toFixed(1) : '',
      measurement.latitude.toFixed(6),
      measurement.longitude.toFixed(6),
      measurement.speed.toFixed(1),
      measurement.heading.toFixed(1),
      measurement.roadNumber || '',
      measurement.poiNumber || '',
      measurement.poi_type || '',
      (measurement.note || '').replace(/,/g, ';'),  // Replace commas in notes to avoid CSV issues
      measurement.source || 'manual',
      measurement.widthMeasure ? measurement.widthMeasure.toFixed(3) : '',
      measurement.lengthMeasure ? measurement.lengthMeasure.toFixed(3) : '',
      measurement.drawingUrl ? `drawing_${measurement.roadNumber || 'R000'}_${String(measurement.poiNumber || 0).padStart(5, '0')}_${measurement.poi_type || 'none'}_${measurement.id.substring(0, 8)}.png` : '',
      imageFilename,
      videoFilename,
      measurement.imageUrl ? 'Yes' : 'No',
      measurement.videoUrl ? 'Yes' : 'No',
      measurement.drawingUrl ? 'Yes' : 'No'
    ].join(',');
    
    // CRITICAL: Try localStorage first, fallback to IndexedDB on quota error
    try {
      // Get existing CSV data from localStorage
      let csvData = localStorage.getItem(storageKey) || '';
      
      // If this is the first entry, add headers
      if (!csvData) {
        const headers = [
          'ID', 'Date', 'Time', 'Height (m)', 'GPS Alt (m)',
          'Latitude', 'Longitude', 'Speed (km/h)', 'Heading (°)',
          'Road Number', 'POI Number', 'POI Type', 'Note', 'Source',
          'Width (m)', 'Length (m)', 'Drawing Filename', 'Image Filename',
          'Video Filename', 'Has Image', 'Has Video', 'Has Drawing'
        ].join(',');
        csvData = headers + '\n';
      }
      
      // Append the row
      csvData += row + '\n';
      
      // Try to save (will throw QuotaExceededError if over quota)
      localStorage.setItem(storageKey, csvData);
      
    } catch (localStorageError: any) {
      // QUOTA EXCEEDED: Fallback to IndexedDB only
      if (localStorageError.name === 'QuotaExceededError' || localStorageError.code === 22) {
        // Clear the localStorage CSV to free up space
        try {
          localStorage.removeItem(storageKey);
        } catch (e) {
          // Ignore errors clearing
        }
        
        // Notify user that CSV backup has moved to device storage
        toast.warning('CSV backup moved to device storage', {
          description: 'Your browser storage is full. The CSV backup has moved to device storage — your data is still safe.',
          duration: 8000,
          dismissible: true,
          id: `csv-quota-${surveyId}`,
        });
      }
    }
    
    // Always save to IndexedDB as backup (or primary if localStorage failed)
    const db = await initCSVBackupDB();
    if (db) {
      try {
        // Get existing CSV from IndexedDB
        let csvData = await db.get('csv-data', surveyId) as string || '';
        
        // Add headers if needed
        if (!csvData) {
          const headers = [
            'ID', 'Date', 'Time', 'Height (m)', 'GPS Alt (m)',
            'Latitude', 'Longitude', 'Speed (km/h)', 'Heading (°)',
            'Road Number', 'POI Number', 'POI Type', 'Note', 'Source',
            'Width (m)', 'Length (m)', 'Drawing Filename', 'Image Filename',
            'Video Filename', 'Has Image', 'Has Video', 'Has Drawing'
          ].join(',');
          csvData = headers + '\n';
        }
        
        csvData += row + '\n';
        await db.put('csv-data', csvData, surveyId);
      } catch (idbError) {
        // IndexedDB also failed — show persistent error banner with export action
        toast.error('CSV backup failed — export recommended', {
          description: 'Both browser storage and device storage failed for the CSV backup. Export your data now to avoid loss.',
          duration: Infinity,
          dismissible: true,
          id: `csv-double-fail-${surveyId}`,
          action: {
            label: 'Export Now',
            onClick: () => {
              window.dispatchEvent(new CustomEvent('trigger-csv-export', { detail: { surveyId } }));
            },
          },
        });
      }
    }
    
  } catch (error) {
    // CSV backup is non-critical, silent fail
  }
};

export const deleteMeasurement = async (id: string) => {
  const db = await openSurveyDB();
  try {
    // Get measurement to get surveyId before deletion
    const measurement = await db.get('measurements', id);
    const surveyId = measurement?.user_id;
    
    await db.delete('measurements', id);
    
    // CRITICAL: Also remove from in-memory cache so UI updates immediately
    const feed = getMeasurementFeed();
    feed.removeMeasurement(id);
    
    // PAGINATION: Increment mutation counter
    incrementMutationCounter();
    
    // Invalidate snapshot for live updates
    if (surveyId) {
      await incrementPersistedVersion(surveyId);
      invalidateSnapshot(surveyId);
    }
    
    // Dispatch change event for any legacy listeners
    window.dispatchEvent(new Event('dbchange'));
  } catch (error) {
    throw error;
  }
};

export const deleteAllMeasurements = async (surveyId: string) => {
  const db = await openSurveyDB();
  try {
    const store = db.transaction('measurements', 'readwrite').objectStore('measurements');
    const measurements = await store.getAll();
    const feed = getMeasurementFeed();
    
    for (const measurement of measurements) {
      if (measurement.user_id === surveyId) {
        await store.delete(measurement.id);
        
        // CRITICAL: Also remove from in-memory cache
        feed.removeMeasurement(measurement.id);
        
        // PAGINATION: Increment mutation counter
        incrementMutationCounter();
      }
    }
    
    // Invalidate snapshot for live updates
    await incrementPersistedVersion(surveyId);
    invalidateSnapshot(surveyId);
    
    // Dispatch change event
    window.dispatchEvent(new Event('dbchange'));
  } catch (error) {
    throw error;
  }
};

export const addMileMarker = async (surveyId: string, roadNumber: number, kilometer: number, gpsData: any) => {
  const markerPOI = {
    id: crypto.randomUUID(),
    rel: 0,
    altGPS: gpsData.altitude,
    latitude: gpsData.latitude,
    longitude: gpsData.longitude,
    utcDate: new Date().toISOString().split('T')[0],
    utcTime: new Date().toTimeString().split(' ')[0],
    speed: gpsData.speed,
    heading: gpsData.course,
    roadNumber: roadNumber,
    poiNumber: null,
    cloudUploadStatus: null,
    note: `Road ${roadNumber} - KM ${kilometer}`,
    createdAt: new Date().toISOString(),
    user_id: surveyId
  };

  // PERFORMANCE FIX: Use worker-based logging for off-thread, batched writes
  const { getMeasurementLogger } = await import('../workers/MeasurementLoggerClient');
  const workerClient = getMeasurementLogger();
  await workerClient.logMeasurement(markerPOI);
};

export const deleteLastMeasurement = async (surveyId: string) => {
  const db = await openSurveyDB();
  
  try {
    // Use index to efficiently query only this survey's measurements
    const surveyMeasurements = await db.getAllFromIndex(
      'measurements',
      'by-survey',
      surveyId
    );
    
    if (surveyMeasurements.length === 0) {
      throw new Error('No measurements to delete');
    }
    
    // Find the measurement with the highest POI number
    const lastMeasurement = surveyMeasurements.reduce((max: Measurement, current: Measurement) => {
      const maxPOI = max.poiNumber || 0;
      const currentPOI = current.poiNumber || 0;
      return currentPOI > maxPOI ? current : max;
    }, surveyMeasurements[0]);
    
    // Delete the measurement from IndexedDB
    await db.delete('measurements', lastMeasurement.id);
    
    // CRITICAL: Also remove from in-memory cache so UI updates immediately
    const feed = getMeasurementFeed();
    feed.removeMeasurement(lastMeasurement.id);
    
    // Dispatch change event for UI updates
    window.dispatchEvent(new Event('dbchange'));
    
    return lastMeasurement;
  } catch (error) {
    throw error;
  }
};

export const updateMeasurement = async (id: string, updates: Partial<Measurement>) => {
  const db = await openSurveyDB();
  
  try {
    // Get the existing measurement
    const existingMeasurement = await db.get('measurements', id);
    
    if (!existingMeasurement) {
      throw new Error('Measurement not found');
    }
    
    // Merge updates with existing measurement
    const updatedMeasurement: Measurement = {
      ...existingMeasurement,
      ...updates,
      // Ensure ID is not changed
      id: existingMeasurement.id
    };
    
    // Update in IndexedDB
    await db.put('measurements', updatedMeasurement);
    
    // CRITICAL: Also update in-memory cache so UI updates immediately
    const feed = getMeasurementFeed();
    feed.updateMeasurement(id, updatedMeasurement);
    
    // PAGINATION: Increment mutation counter
    incrementMutationCounter();
    
    // Invalidate snapshot for live updates
    await incrementPersistedVersion(updatedMeasurement.user_id);
    invalidateSnapshot(updatedMeasurement.user_id);
    
    // Dispatch change event for UI updates
    window.dispatchEvent(new Event('dbchange'));
    
    return updatedMeasurement;
  } catch (error) {
    throw error;
  }
};