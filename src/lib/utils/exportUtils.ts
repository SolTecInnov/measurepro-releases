import { toast } from 'sonner';
import { API_BASE_URL } from '@/lib/config/environment';
import { openSurveyDB } from '../survey/db';
import { Survey, Measurement } from '../survey/types';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { saveFileNative } from '@/lib/electron-file-save';
import { getRoutesBySurvey, exportRouteToGeoJSON as exportSingleRouteToGeoJSON, initRoutesDB } from './routeUtils';
import { useCameraStore } from '@/lib/camera';
import { geoVideoRecorder } from '@/lib/video/geoVideoRecorder';
import { isStrictRoadProfile, isStrictRoadProfileSample, isStrictRoadProfileEvent } from '@/lib/gnss/types';
import { addRoadProfileExportsToZip } from '@/lib/roadProfile/exportHelper';
import {
  generatePOIMediaFilenames,
  createPOIManifestEntry,
  POIManifestEntry
} from '../survey/mediaNames';
import { isAssetReference, getAssetBlob } from '../storage/assetHelper';

/**
 * Download a file using native Electron save dialog when available,
 * falling back to browser-style download via saveAs / <a> click.
 */
async function downloadFile(data: Blob | string, filename: string, mimeType?: string): Promise<void> {
  if (window.electronAPI?.isElectron) {
    await saveFileNative(filename, data, mimeType);
    return;
  }
  // Browser fallback
  if (data instanceof Blob) {
    saveAs(data, filename);
  } else {
    const blob = new Blob([data], { type: mimeType || 'application/octet-stream' });
    saveAs(blob, filename);
  }
}

/**
 * MEMORY-EFFICIENT CHUNKED EXPORT HELPERS
 * Process measurements in batches to avoid loading everything into memory at once
 */
const EXPORT_CHUNK_SIZE = 100; // Process 100 measurements at a time

/**
 * Async generator that yields measurements in chunks
 * FIXED: Uses native IndexedDB with synchronous cursor to avoid transaction timeout
 * Then yields from collected array to prevent blocking
 */
async function* getMeasurementsInChunks(surveyId: string, chunkSize: number = EXPORT_CHUNK_SIZE): AsyncGenerator<Measurement[], void, unknown> {
  // CRITICAL: Use native IndexedDB with synchronous cursor to avoid transaction timeout
  // The idb library's async cursor wrapper causes "transaction finished" errors
  const allMeasurements = await new Promise<Measurement[]>((resolve) => {
    const openReq = indexedDB.open('survey-db');
    openReq.onerror = () => {
      // Fallback to measurepro-v2 if survey-db doesn't exist
      const fallbackReq = indexedDB.open('measurepro-v2');
      fallbackReq.onerror = () => resolve([]);
      fallbackReq.onsuccess = () => {
        const db = fallbackReq.result;
        if (!db.objectStoreNames.contains('measurements')) {
          db.close();
          resolve([]);
          return;
        }
        collectMeasurements(db, surveyId, resolve);
      };
    };
    openReq.onsuccess = () => {
      const db = openReq.result;
      if (!db.objectStoreNames.contains('measurements')) {
        db.close();
        resolve([]);
        return;
      }
      collectMeasurements(db, surveyId, resolve);
    };
  });

  function collectMeasurements(db: IDBDatabase, surveyId: string, resolve: (m: Measurement[]) => void) {
    const tx = db.transaction('measurements', 'readonly');
    const store = tx.objectStore('measurements');
    const results: Measurement[] = [];
    
    // Check if we have an index for by-survey
    let cursorSource: IDBObjectStore | IDBIndex = store;
    let keyRange: IDBKeyRange | null = null;
    
    if (store.indexNames.contains('by-survey')) {
      cursorSource = store.index('by-survey');
      keyRange = IDBKeyRange.only(surveyId);
    }
    
    const cursorReq = cursorSource.openCursor(keyRange);
    cursorReq.onsuccess = function(event: any) {
      const cursor = event.target.result;
      if (cursor) {
        const value = cursor.value as Measurement;
        // If using store directly (no index), filter by surveyId
        if (cursorSource === store) {
          if (value.surveyId === surveyId) {
            results.push(value);
          }
        } else {
          results.push(value);
        }
        cursor.continue(); // Synchronous - no await!
      } else {
        db.close();
        resolve(results);
      }
    };
    cursorReq.onerror = () => { db.close(); resolve([]); };
  }

  if (allMeasurements.length === 0) {
    return;
  }

  console.log(`[ChunkedExport] Processing ${allMeasurements.length} measurements in chunks of ${chunkSize}`);

  // Now yield from collected array (safe, no transaction involved)
  for (let i = 0; i < allMeasurements.length; i += chunkSize) {
    const chunk = allMeasurements.slice(i, i + chunkSize);
    yield chunk;
    // Allow UI to breathe between chunks
    await new Promise(resolve => setTimeout(resolve, 5));
  }

  console.log(`[ChunkedExport] Completed processing ${allMeasurements.length} measurements`);
}

/**
 * Get measurement count for a survey without loading data
 */
async function getMeasurementCount(surveyId: string): Promise<number> {
  const db = await openSurveyDB();
  const keys = await db.getAllKeysFromIndex('measurements', 'by-survey', surveyId);
  return keys.length;
}

/**
 * Get all vehicle traces for a survey from IndexedDB or localStorage
 * @param surveyId - ID of the survey
 * @returns Promise that resolves with array of trace points
 */
export const getVehicleTracesForSurvey = async (surveyId: string): Promise<any[]> => {
  try {
    let surveyTraces: any[] = [];
    
    // Try to load from IndexedDB first
    try {
      const db = await openSurveyDB();
      const traces = await db.getAll('vehicleTraces');
      surveyTraces = traces.filter((t: any) => t.surveyId === surveyId);
    } catch (dbError) {
      // Silent fail - will try localStorage
    }
    
    // Fallback to localStorage if IndexedDB has no data or failed
    if (surveyTraces.length === 0) {
      try {
        const localTraces = JSON.parse(localStorage.getItem('vehicleTraces') || '[]');
        surveyTraces = localTraces.filter((t: any) => t.surveyId === surveyId);
      } catch (localError) {
        // Silent fail
      }
    }
    
    // Sort by timestamp
    if (surveyTraces.length > 0) {
      surveyTraces.sort((a: any, b: any) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    }
    
    return surveyTraces;
  } catch (error) {
    return [];
  }
};

/**
 * Export trace to GPX format
 * @param traces - Array of trace points
 * @param name - Name for the trace
 * @returns GPX string
 */
export const exportTraceToGPX = (traces: any[], name: string): string => {
  const gpxHeader = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="MeasurePro" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${name || 'Vehicle Trace'}</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <trk>
    <name>${name || 'Vehicle Trace'}</name>
    <trkseg>`;
  
  const gpxPoints = traces.map(point => 
    `      <trkpt lat="${point.latitude}" lon="${point.longitude}">
        <time>${point.timestamp}</time>
        <speed>${point.speed}</speed>
        <course>${point.heading}</course>
      </trkpt>`
  ).join('\n');
  
  const gpxFooter = `
    </trkseg>
  </trk>
</gpx>`;
  
  return gpxHeader + '\n' + gpxPoints + gpxFooter;
};

/**
 * Export trace to KML format
 * @param traces - Array of trace points
 * @param name - Name for the trace
 * @returns KML string
 */
export const exportTraceToKML = (traces: any[], name: string): string => {
  const kmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${name || 'Vehicle Trace'}</name>
    <description>Exported from MeasurePro on ${new Date().toLocaleString()}</description>
    <Style id="traceStyle">
      <LineStyle>
        <color>ff0000ff</color>
        <width>3</width>
      </LineStyle>
    </Style>
    <Placemark>
      <name>${name || 'Vehicle Trace'}</name>
      <styleUrl>#traceStyle</styleUrl>
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>`;
  
  const kmlCoordinates = traces.map(point => 
    `${point.longitude},${point.latitude},0`
  ).join('\n          ');
  
  const kmlFooter = `
        </coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>`;
  
  return kmlHeader + '\n          ' + kmlCoordinates + kmlFooter;
};

/**
 * Export trace to GeoJSON format as LineString
 * @param traces - Array of trace points
 * @param name - Name for the trace
 * @returns GeoJSON string
 */
export const exportTraceToGeoJSON = (traces: any[], name: string): string => {
  const geoJson = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {
        name: name || 'Vehicle Trace',
        exportedAt: new Date().toISOString(),
        totalPoints: traces.length,
        startTime: traces.length > 0 ? traces[0].timestamp : null,
        endTime: traces.length > 0 ? traces[traces.length - 1].timestamp : null
      },
      geometry: {
        type: 'LineString',
        coordinates: traces.map(point => [
          point.longitude,
          point.latitude,
          0
        ])
      }
    }]
  };
  
  return JSON.stringify(geoJson, null, 2);
};

/**
 * Helper to generate UID-based filename for standalone exports (no survey context)
 * Uses measurement.user_id as surveyId proxy
 */
function generateStandaloneMediaFilename(m: Measurement, mediaType: 'image' | 'video' | 'drawing'): string | null {
  const url = mediaType === 'image' ? m.imageUrl : mediaType === 'video' ? m.videoUrl : m.drawingUrl;
  if (!url) return null;
  
  const surveyShort = (m.user_id || 'unknown').replace(/-/g, '').substring(0, 8);
  const poiShort = m.id.replace(/-/g, '').substring(0, 8);
  const typeClean = (m.poi_type || 'poi').toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
  const ext = mediaType === 'image' ? 'jpg' : mediaType === 'video' ? 'webm' : 'png';
  const timestamp = Date.now();
  
  return `${surveyShort}_p1_${poiShort}_${typeClean}_${timestamp}.${ext}`;
}

/**
 * Export survey to GeoJSON format
 * @param surveyId - ID of the survey to export
 * @returns Promise that resolves with GeoJSON string
 */
export const exportSurveyToGeoJSON = async (surveyId: string): Promise<string> => {
  try {
    // Open the database
    const db = await openSurveyDB();
    
    // MEMORY FIX: Use by-survey index to load only this survey's measurements
    // Previously loaded ALL measurements then filtered, causing OOM on large databases
    const surveyMeasurements = await db.getAllFromIndex('measurements', 'by-survey', surveyId);
    
    // Create GeoJSON features with UID-based filenames
    const features = surveyMeasurements.map(m => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [m.longitude, m.latitude]
      },
      properties: {
        id: m.id,
        poiUID: m.id,
        height: m.rel,
        altitude: m.altGPS,
        date: m.utcDate,
        time: m.utcTime,
        speed: m.speed,
        heading: m.heading,
        roadNumber: m.roadNumber,
        poiNumber: m.poiNumber,
        poiType: m.poi_type,
        note: m.note,
        imageUrl: m.imageUrl,
        videoUrl: m.videoUrl,
        widthMeasure: m.widthMeasure,
        lengthMeasure: m.lengthMeasure,
        drawingUrl: m.drawingUrl,
        imageFilename: generateStandaloneMediaFilename(m, 'image'),
        videoFilename: generateStandaloneMediaFilename(m, 'video'),
        drawingFilename: generateStandaloneMediaFilename(m, 'drawing')
      }
    }));
    
    // Create GeoJSON object
    const geoJson = {
      type: 'FeatureCollection',
      features,
      properties: {
        surveyId,
        exportedAt: new Date().toISOString()
      }
    };
    
    return JSON.stringify(geoJson, null, 2);
  } catch (error) {
    throw error;
  }
};

/**
 * Export measurements to CSV format with UID-based filenames
 * @param measurements - Array of measurements to export
 * @param filename - Base filename (without extension)
 */
export const exportMeasurementsToCSV = async (measurements: Measurement[], filename: string): Promise<void> => {
  try {
    const headers = [
      'Date',
      'Time',
      'POI UID',
      'Height (m)',
      'GPS Alt (m)',
      'Latitude',
      'Longitude',
      'Speed (km/h)',
      'Heading (°)',
      'Road Number',
      'POI Number',
      'POI Type',
      'Note',
      'Source',
      'Image Filename',
      'Video Filename',
      'Has Image',
      'Has Video'
    ].join(',');
    
    const rows = measurements.map(m => [
      m.utcDate,
      m.utcTime,
      m.id, // Full POI UID
      m.rel.toFixed(3),
      m.altGPS.toFixed(1),
      m.latitude.toFixed(6),
      m.longitude.toFixed(6),
      m.speed.toFixed(1),
      m.heading.toFixed(1),
      m.roadNumber || '',
      m.poiNumber || '',
      m.poi_type || '',
      (m.note || '').replace(/,/g, ';'), // Replace commas in notes to avoid CSV issues
      m.source || 'manual',
      generateStandaloneMediaFilename(m, 'image') || '',
      generateStandaloneMediaFilename(m, 'video') || '',
      m.imageUrl ? 'Yes' : 'No',
      m.videoUrl ? 'Yes' : 'No'
    ].join(','));
    
    const csvData = [headers, ...rows].join('\n');
    
    // Create and download file
    await downloadFile(csvData, `${filename}.csv`, 'text/csv;charset=utf-8;');

    /* toast removed */
  } catch (error) {
    toast.error('Failed to export CSV', {
      description: (error as Error).message
    });
  }
};

/**
 * Export measurements to GeoJSON format with UID-based filenames
 * @param measurements - Array of measurements to export
 * @param filename - Base filename (without extension)
 */
export const exportMeasurementsToGeoJSON = async (measurements: Measurement[], filename: string): Promise<void> => {
  try {
    const features = measurements.map(m => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [m.longitude, m.latitude]
      },
      properties: {
        id: m.id,
        poiUID: m.id,
        legacyPoiId: m.roadNumber && m.poiNumber ? `R${String(m.roadNumber).padStart(3, '0')}-${String(m.poiNumber).padStart(5, '0')}` : null,
        height: m.rel,
        altitude: m.altGPS,
        date: m.utcDate,
        time: m.utcTime,
        speed: m.speed,
        heading: m.heading,
        roadNumber: m.roadNumber,
        poiNumber: m.poiNumber,
        poiType: m.poi_type,
        note: m.note,
        imageUrl: m.imageUrl,
        videoUrl: m.videoUrl,
        imageFilename: generateStandaloneMediaFilename(m, 'image'),
        videoFilename: generateStandaloneMediaFilename(m, 'video'),
        source: m.source || 'manual',
        createdAt: m.createdAt
      }
    }));
    
    const geoJson = {
      type: 'FeatureCollection',
      features,
      properties: {
        exportedAt: new Date().toISOString(),
        totalMeasurements: measurements.length,
        exportType: 'live-monitor'
      }
    };
    
    const geoJsonData = JSON.stringify(geoJson, null, 2);
    
    // Create and download file
    await downloadFile(geoJsonData, `${filename}.geojson`, 'application/json');

    /* toast removed */
  } catch (error) {
    toast.error('Failed to export GeoJSON', {
      description: (error as Error).message
    });
  }
};

/**
 * Export measurements with media files as a complete ZIP package
 * Uses UID-based filenames for collision-proof naming
 * @param measurements - Array of measurements to export
 * @param filename - Base filename (without extension)
 * @param survey - Optional survey for proper part tracking
 */
export const exportMeasurementsWithMedia = async (
  measurements: Measurement[], 
  filename: string,
  survey?: Survey | null
): Promise<void> => {
  try {
    toast.loading('Preparing export with media files...', {
      id: 'export-measurements-with-media'
    });

    // Create a new JSZip instance
    const zip = new JSZip();

    // Create folders
    const imagesFolder = zip.folder('images');
    const videosFolder = zip.folder('videos');
    const drawingsFolder = zip.folder('drawings');
    const docsFolder = zip.folder('documents');

    // Process measurements and extract media using UID-based filenames
    let imageCount = 0;
    let videoCount = 0;
    let drawingCount = 0;
    const poiManifest: POIManifestEntry[] = [];
    
    // Create a mock survey for filename generation if no survey provided
    const surveyContext: Survey = survey || {
      id: measurements[0]?.user_id || 'unknown',
      user_id: measurements[0]?.user_id || 'unknown',
      name: filename,
      date: new Date().toISOString().split('T')[0],
      ownerEmail: '',
      isActive: false,
      partOrdinal: 1
    };
    
    for (const m of measurements) {
      // Generate POI manifest and filenames using mediaNames.ts
      const manifest = createPOIManifestEntry(surveyContext, m);
      poiManifest.push(manifest);
      const mediaFiles = generatePOIMediaFilenames(surveyContext, m);
      
      // Process image if available using UID-based filename
      if (m.imageUrl && mediaFiles.image) {
        try {
          const imageFilename = mediaFiles.image;
          
          // Handle asset references (new blob storage format)
          if (isAssetReference(m.imageUrl)) {
            const blob = await getAssetBlob(m.imageUrl);
            if (blob) {
              imagesFolder?.file(imageFilename, blob);
              imageCount++;
            }
          } else if (m.imageUrl.startsWith('data:')) {
            // Handle legacy base64 data URLs
            const imageData = m.imageUrl.split(',')[1];
            if (imageData) {
              imagesFolder?.file(imageFilename, imageData, { base64: true });
              imageCount++;
            }
          } else {
            // Handle HTTP URLs
            try {
              const response = await fetch(m.imageUrl);
              const imageBlob = await response.blob();
              imagesFolder?.file(imageFilename, imageBlob);
              imageCount++;
            } catch (fetchError) {
              // Silent fail
            }
          }
        } catch (error) {
          // Silent fail
        }
      }

      // Process video if available using UID-based filename
      if (m.videoUrl && mediaFiles.video) {
        try {
          const videoFilename = mediaFiles.video;
          
          const response = await fetch(m.videoUrl);
          const videoBlob = await response.blob();
          videosFolder?.file(videoFilename, videoBlob);
          videoCount++;
        } catch (error) {
          // Silent fail
        }
      }

      // Process drawing if available using UID-based filename
      if (m.drawingUrl && mediaFiles.drawing) {
        try {
          const drawingFilename = mediaFiles.drawing;
          
          // Handle asset references (new blob storage format)
          if (isAssetReference(m.drawingUrl)) {
            const blob = await getAssetBlob(m.drawingUrl);
            if (blob) {
              drawingsFolder?.file(drawingFilename, blob);
              drawingCount++;
            }
          } else if (m.drawingUrl.startsWith('data:')) {
            // Handle legacy base64 data URLs
            const drawingData = m.drawingUrl.split(',')[1];
            if (drawingData) {
              drawingsFolder?.file(drawingFilename, drawingData, { base64: true });
              drawingCount++;
            }
          }
        } catch (error) {
          // Silent fail
        }
      }
    }
    
    // Add POI manifest for UID-based file mapping
    if (poiManifest.length > 0) {
      docsFolder?.file('poi_manifest.json', JSON.stringify({
        version: '2.0',
        format: 'UID-first',
        surveyId: surveyContext.id,
        totalPOIs: poiManifest.length,
        exportedAt: new Date().toISOString(),
        pois: poiManifest
      }, null, 2));
    }

    // Add geo-referenced video recordings for this survey
    let geoVideoCount = 0;
    try {
      const geoVideos = await geoVideoRecorder.getRecordingsForSurvey(surveyContext.id);
      for (const video of geoVideos) {
        const videoFilename = `survey_video_${video.id.substring(0, 8)}_${new Date(video.startTime).getTime()}.webm`;
        videosFolder?.file(videoFilename, video.blob);
        geoVideoCount++;
      }
      if (geoVideoCount > 0) {
        console.log(`[Export] Added ${geoVideoCount} geo-referenced video recordings`);
      }
    } catch (error) {
      console.warn('[Export] Failed to fetch geo-video recordings:', error);
    }

    // Add CSV data
    const csvData = await exportMeasurementsToCSVData(measurements);
    docsFolder?.file('measurements_data.csv', csvData);
    
    // Add GeoJSON data
    const geoJsonData = await exportMeasurementsToGeoJSONData(measurements);
    docsFolder?.file('measurements_data.geojson', geoJsonData);
    
    // Add metadata
    const metadata = {
      export: {
        type: 'live-monitor-export',
        exportedAt: new Date().toISOString(),
        totalMeasurements: measurements.length,
        totalImages: imageCount,
        totalVideos: videoCount + geoVideoCount,
        totalGeoVideos: geoVideoCount,
        totalDrawings: drawingCount
      },
      statistics: {
        uniqueUsers: new Set(measurements.map(m => m.user_id)).size,
        roadNumbers: [...new Set(measurements.map(m => m.roadNumber).filter(Boolean))].sort(),
        poiTypes: [...new Set(measurements.map(m => m.poi_type).filter(Boolean))].sort(),
        dateRange: {
          earliest: measurements.length > 0 ? measurements[measurements.length - 1].createdAt : null,
          latest: measurements.length > 0 ? measurements[0].createdAt : null
        }
      }
    };
    
    docsFolder?.file('export_metadata.json', JSON.stringify(metadata, null, 2));
    
    // Create README
    const readmeContent = `# Live Monitor Export

This package contains measurements exported from the Live Monitor.

## File Naming Format (v2.0 UID-based):
Files use collision-proof UID-based naming:
{surveyId8}_{pN}_{poiUID8}_{type}_{timestamp}.{ext}

Example: a1b2c3d4_p1_e5f6g7h8_bridge_1732123456.jpg

## Contents:

### Documents folder:
- measurements_data.csv: Tabular data in CSV format
- measurements_data.geojson: Geographic data in GeoJSON format  
- poi_manifest.json: UID to filename mapping for import compatibility
- export_metadata.json: Export information and statistics

### Images folder:
- ${imageCount} POI images with UID-based filenames

### Videos folder:
- ${videoCount} POI videos with UID-based filenames

### Drawings folder:
- ${drawingCount} POI drawings with UID-based filenames

## Statistics:
- Total Measurements: ${measurements.length}
- Total Images: ${imageCount}
- Total Videos: ${videoCount}
- Total Drawings: ${drawingCount}
- Unique Users: ${new Set(measurements.map(m => m.user_id)).size}

Exported on: ${new Date().toLocaleString()}
`;
    
    zip.file('README.txt', readmeContent);

    // Generate and download the zip file
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    await downloadFile(zipBlob, `${filename}.zip`, 'application/zip');

    /* toast removed */
  } catch (error) {
    toast.error('Failed to export with media', {
      id: 'export-measurements-with-media',
      description: (error as Error).message
    });
  }
};

/**
 * Helper function to generate CSV data without downloading
 * Uses UID-based filenames
 */
const exportMeasurementsToCSVData = async (measurements: Measurement[]): Promise<string> => {
  const headers = [
    'Date',
    'Time',
    'POI UID',
    'Height (m)',
    'GPS Alt (m)',
    'Latitude',
    'Longitude',
    'Speed (km/h)',
    'Heading (°)',
    'Road Number',
    'POI Number',
    'POI Type',
    'Note',
    'Source',
    'Width (m)',
    'Length (m)',
    'Drawing Filename',
    'Image Filename',
    'Video Filename',
    'Has Image',
    'Has Video',
    'Has Drawing'
  ].join(',');
  
  const rows = measurements.map(m => [
    m.utcDate,
    m.utcTime,
    m.id,
    m.rel.toFixed(3),
    m.altGPS.toFixed(1),
    m.latitude.toFixed(6),
    m.longitude.toFixed(6),
    m.speed.toFixed(1),
    m.heading.toFixed(1),
    m.roadNumber || '',
    m.poiNumber || '',
    m.poi_type || '',
    (m.note || '').replace(/,/g, ';'),
    m.source || 'manual',
    m.widthMeasure ? m.widthMeasure.toFixed(3) : '',
    m.lengthMeasure ? m.lengthMeasure.toFixed(3) : '',
    generateStandaloneMediaFilename(m, 'drawing') || '',
    generateStandaloneMediaFilename(m, 'image') || '',
    generateStandaloneMediaFilename(m, 'video') || '',
    m.imageUrl ? 'Yes' : 'No',
    m.videoUrl ? 'Yes' : 'No',
    m.drawingUrl ? 'Yes' : 'No'
  ].join(','));
  
  return [headers, ...rows].join('\n');
};

/**
 * Helper function to generate GeoJSON data without downloading
 * Uses UID-based filenames
 */
const exportMeasurementsToGeoJSONData = async (measurements: Measurement[]): Promise<string> => {
  const features = measurements.map(m => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [m.longitude, m.latitude]
    },
    properties: {
      id: m.id,
      poiUID: m.id,
      legacyPoiId: m.roadNumber && m.poiNumber ? `R${String(m.roadNumber).padStart(3, '0')}-${String(m.poiNumber).padStart(5, '0')}` : null,
      height: m.rel,
      altitude: m.altGPS,
      date: m.utcDate,
      time: m.utcTime,
      speed: m.speed,
      heading: m.heading,
      roadNumber: m.roadNumber,
      poiNumber: m.poiNumber,
      poiType: m.poi_type,
      note: m.note,
      imageUrl: m.imageUrl,
      videoUrl: m.videoUrl,
      widthMeasure: m.widthMeasure,
      lengthMeasure: m.lengthMeasure,
      drawingUrl: m.drawingUrl,
      imageFilename: generateStandaloneMediaFilename(m, 'image'),
      videoFilename: generateStandaloneMediaFilename(m, 'video'),
      drawingFilename: generateStandaloneMediaFilename(m, 'drawing'),
      source: m.source || 'manual',
      createdAt: m.createdAt
    }
  }));
  
  const geoJson = {
    type: 'FeatureCollection',
    features,
    properties: {
      exportedAt: new Date().toISOString(),
      totalMeasurements: measurements.length,
      exportType: 'live-monitor'
    }
  };
  
  return JSON.stringify(geoJson, null, 2);
};

/**
 * Export survey data to a file using STREAMING to prevent OOM
 * @param survey - The survey to export
 * @param format - The export format (csv, json, geojson)
 * @returns A promise that resolves when the export is complete
 */
export const exportSurveyData = async (survey: Survey | null, format: 'csv' | 'json' | 'geojson'): Promise<string> => {
  if (!survey) {
    throw new Error('No survey provided');
  }

  try {
    // STREAMING FIX: Build output incrementally using cursor iteration
    // This prevents loading all measurements + embedded media into memory at once
    const measurements: Measurement[] = [];
    
    // Load measurements in chunks to prevent OOM
    for await (const chunk of getMeasurementsInChunks(survey.id, 50)) {
      // For export formats, we only need metadata, not embedded base64
      // Strip heavy base64 data to reduce memory footprint
      for (const m of chunk) {
        measurements.push({
          ...m,
          // Keep URL references but mark if base64 was present
          imageUrl: m.imageUrl?.startsWith('data:') ? '[base64-embedded]' : m.imageUrl,
          videoUrl: m.videoUrl?.startsWith('data:') ? '[base64-embedded]' : m.videoUrl,
          drawingUrl: m.drawingUrl?.startsWith('data:') ? '[base64-embedded]' : m.drawingUrl,
        });
      }
    }
    
    const surveyMeasurements = measurements;
    
    if (format === 'csv') {
      const headers = [
        'Date',
        'Time',
        'POI UID',
        'Height (m)',
        'GPS Alt (m)',
        'Latitude',
        'Longitude',
        'Speed (km/h)',
        'Heading (°)',
        'Road Number',
        'POI Number',
        'POI Type',
        'Note',
        'Source',
        'Width (m)',
        'Length (m)',
        'Drawing Filename',
        'Image Filename',
        'Video Filename',
        'Has Image',
        'Has Video',
        'Has Drawing'
      ].join(',');
      
      const rows = surveyMeasurements.map(m => {
        const mediaFiles = generatePOIMediaFilenames(survey, m);
        return [
          m.utcDate,
          m.utcTime,
          m.id,
          m.rel.toFixed(3),
          m.altGPS.toFixed(1),
          m.latitude.toFixed(6),
          m.longitude.toFixed(6),
          m.speed.toFixed(1),
          m.heading.toFixed(1),
          m.roadNumber || '',
          m.poiNumber || '',
          m.poi_type || '',
          (m.note || '').replace(/,/g, ';'), // Replace commas in notes to avoid CSV issues
          m.source || 'manual',
          m.widthMeasure ? m.widthMeasure.toFixed(3) : '',
          m.lengthMeasure ? m.lengthMeasure.toFixed(3) : '',
          mediaFiles.drawing || '',
          mediaFiles.image || '',
          mediaFiles.video || '',
          m.imageUrl ? 'Yes' : 'No',
          m.videoUrl ? 'Yes' : 'No',
          m.drawingUrl ? 'Yes' : 'No'
        ].join(',');
      });
      
      return [headers, ...rows].join('\n');
    }
    
    if (format === 'json') {
      // Add image and video filenames to JSON export using UID-based naming
      const enhancedMeasurements = surveyMeasurements.map(m => {
        const mediaFiles = generatePOIMediaFilenames(survey, m);
        return {
          ...m,
          poiUID: m.id,
          widthMeasure: m.widthMeasure,
          lengthMeasure: m.lengthMeasure,
          drawingUrl: m.drawingUrl,
          imageFilename: mediaFiles.image,
          videoFilename: mediaFiles.video,
          drawingFilename: mediaFiles.drawing
        };
      });
      
      // Get vehicle traces for this survey
      const vehicleTraces = await getVehicleTracesForSurvey(survey.id);
      
      // Get routes for this survey
      let routes: any[] = [];
      try {
        routes = await getRoutesBySurvey(survey.id);
      } catch (error) {
        // Silent fail
      }
      
      // Combine measurements, traces, and routes in JSON output
      const jsonExport = {
        measurements: enhancedMeasurements,
        vehicleTraces: vehicleTraces,
        routes: routes,
        exportedAt: new Date().toISOString(),
        surveyId: survey.id,
        surveyName: survey.name
      };
      
      return JSON.stringify(jsonExport, null, 2);
    }
    
    if (format === 'geojson') {
      // Create measurement point features with UID-based filenames
      const measurementFeatures = surveyMeasurements.map(m => {
        const mediaFiles = generatePOIMediaFilenames(survey, m);
        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [m.longitude, m.latitude]
          },
          properties: {
            featureType: 'measurement',
            poiUID: m.id,
            legacyPoiId: m.roadNumber && m.poiNumber ? `R${String(m.roadNumber).padStart(3, '0')}-POI${String(m.poiNumber).padStart(5, '0')}` : null,
            height: m.rel,
            altitude: m.altGPS,
            date: m.utcDate,
            time: m.utcTime,
            speed: m.speed,
            heading: m.heading,
            roadNumber: m.roadNumber,
            poiNumber: m.poiNumber,
            poiType: m.poi_type,
            note: m.note,
            imageUrl: m.imageUrl,
            videoUrl: m.videoUrl,
            widthMeasure: m.widthMeasure,
            lengthMeasure: m.lengthMeasure,
            drawingUrl: m.drawingUrl,
            imageFilename: mediaFiles.image,
            videoFilename: mediaFiles.video,
            drawingFilename: mediaFiles.drawing
          }
        };
      });
      
      // Get vehicle traces for this survey
      const vehicleTraces = await getVehicleTracesForSurvey(survey.id);
      
      // Create trace LineString features
      const traceFeatures = vehicleTraces.length > 0 ? [{
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: vehicleTraces.map(t => [t.longitude, t.latitude])
        },
        properties: {
          featureType: 'vehicleTrace',
          name: 'Vehicle Trace',
          totalPoints: vehicleTraces.length,
          startTime: vehicleTraces[0]?.timestamp || null,
          endTime: vehicleTraces[vehicleTraces.length - 1]?.timestamp || null
        }
      }] : [];
      
      // Get routes for this survey
      let routes: any[] = [];
      try {
        routes = await getRoutesBySurvey(survey.id);
      } catch (error) {
        // Silent fail
      }
      
      // Create route LineString features
      const routeFeatures = routes.map(route => {
        // Sort points by order
        const sortedPoints = [...route.points].sort((a, b) => a.order - b.order);
        
        return {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: sortedPoints.map(point => [point.position[1], point.position[0]])
          },
          properties: {
            featureType: 'route',
            name: route.name,
            description: route.description || '',
            color: route.color,
            createdAt: route.createdAt,
            updatedAt: route.updatedAt
          }
        };
      });
      
      // Combine all features
      const allFeatures = [
        ...measurementFeatures,
        ...traceFeatures,
        ...routeFeatures
      ];
      
      return JSON.stringify({
        type: 'FeatureCollection',
        features: allFeatures,
        properties: {
          surveyId: survey.id,
          surveyName: survey.name,
          exportedAt: new Date().toISOString(),
          totalMeasurements: measurementFeatures.length,
          totalTraces: traceFeatures.length,
          totalRoutes: routeFeatures.length
        }
      }, null, 2);
    }
    
    throw new Error(`Unsupported export format: ${format}`);
  } catch (error) {
    throw error;
  }
};

/**
 * Export survey to a file
 * @param survey - The survey to export
 * @param format - The export format (csv, json, geojson)
 * @param silent - Whether to show success/error toasts
 * @returns A promise that resolves when the export is complete
 */
export const exportSurvey = async (survey: Survey | null, format: 'csv' | 'json' | 'geojson', silent: boolean = false): Promise<void> => {
  if (!survey) {
    if (!silent) toast.error('No active survey to export');
    return;
  }
  
  try {
    const data = await exportSurveyData(survey, format);
    
    // Create download link
    const blob = new Blob([data], { type: format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/json' });
    
    // Get custom filename from localStorage if available
    const customFilename = localStorage.getItem('autoSaveFilename') || 'survey-export';
    
    const filename = `${customFilename}-${survey.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || survey.id}-${new Date().toISOString().split('T')[0]}.${format}`;
    
    // Download the file
    await downloadFile(blob, filename, format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/json');
    
    // Dispatch autosave event if silent mode is on (autosave)
    if (silent) {
      const autosaveEvent = new CustomEvent('autosave-complete', {
        detail: {
          filename,
          timestamp: new Date().toISOString(),
          format
        }
      });
      window.dispatchEvent(autosaveEvent);
    }
    
    if (!silent) {
      /* toast removed */
    }
  } catch (error) {
    if (!silent) {
      toast.error('Failed to export survey', {
        description: (error as Error).message
      });
    }
  }
};

/**
 * Export survey with media files (images and videos) as a complete ZIP package
 * @param survey - Survey to export
 * @returns Promise that resolves when export is complete
 */
export const exportSurveyWithMedia = async (survey: Survey | null): Promise<void> => {
  if (!survey) {
    toast.error('No active survey to export');
    return;
  }

  try {
    toast.loading('Preparing export with media files...', {
      id: 'export-with-media'
    });

    // Create a new JSZip instance
    const zip = new JSZip();

    // Open the database
    const db = await openSurveyDB();
    
    // CHUNKED EXPORT: Get total count for progress tracking without loading data
    const totalMeasurements = await getMeasurementCount(survey.id);
    console.log(`[ChunkedExport] Starting export of ${totalMeasurements} measurements`);

    // Create folders for images, videos, traces, routes, timelapse, voice notes, geo-videos, profiles, and documents
    const imagesFolder = zip.folder('images');
    const videosFolder = zip.folder('videos');
    const tracesFolder = zip.folder('traces');
    const routesFolder = zip.folder('routes');
    const timelapseFolder = zip.folder('timelapse');
    const voiceNotesFolder = zip.folder('voice-notes');
    const geoVideosFolder = zip.folder('geo-videos');
    const profilesFolder = zip.folder('profiles');
    const docsFolder = zip.folder('documents');

    // Process measurements in CHUNKS to avoid memory issues
    let imageCount = 0;
    let videoCount = 0;
    let drawingCount = 0;
    let processedCount = 0;
    const poiManifest: POIManifestEntry[] = [];
    const features: any[] = [];
    
    // Create drawings folder
    const drawingsFolder = zip.folder('drawings');
    
    // Track all measurement IDs for voice note lookup later
    const surveyMeasurementIds = new Set<string>();
    
    // Track statistics during chunked processing (replaces surveyMeasurements.length references)
    const uniqueRoadNumbers = new Set<number>();
    const uniquePoiTypes = new Set<string>();
    
    // CHUNKED PROCESSING: Process measurements in batches to prevent OOM
    for await (const chunk of getMeasurementsInChunks(survey.id, EXPORT_CHUNK_SIZE)) {
      // Process each measurement in the chunk SEQUENTIALLY (not Promise.all)
      // This prevents holding all blobs in memory at once
      for (const m of chunk) {
        surveyMeasurementIds.add(m.id);
        
        // Track statistics during chunked processing
        if (m.roadNumber) uniqueRoadNumbers.add(m.roadNumber);
        if (m.poi_type) uniquePoiTypes.add(m.poi_type);
        
        // Generate POI manifest entry using mediaNames.ts helper
        const manifest = createPOIManifestEntry(survey, m);
        poiManifest.push(manifest);
        
        // Get media filenames from mediaNames.ts
        const mediaFiles = generatePOIMediaFilenames(survey, m);
        
        // Process image if available using UID-based filename
        const imageFilename = mediaFiles.image;
        if (m.imageUrl && imageFilename) {
          try {
            // Extract base64 data from data URL
            if (m.imageUrl.startsWith('data:')) {
              const imageData = m.imageUrl.split(',')[1];
              if (imageData) {
                imagesFolder?.file(imageFilename, imageData, { base64: true });
                imageCount++;
              }
            } else {
              // Handle blob URLs or other formats
              try {
                const response = await fetch(m.imageUrl);
                const imageBlob = await response.blob();
                imagesFolder?.file(imageFilename, imageBlob);
                imageCount++;
              } catch (fetchError) {
                // Silent fail
              }
            }
          } catch (error) {
            // Silent fail
          }
        }

        // Process video if available using UID-based filename
        const videoFilename = mediaFiles.video;
        if (m.videoUrl && videoFilename) {
          try {
            // Fetch the video blob from the URL
            const response = await fetch(m.videoUrl);
            const videoBlob = await response.blob();
            videosFolder?.file(videoFilename, videoBlob);
            videoCount++;
          } catch (error) {
            // Silent fail
          }
        }
        
        // Process drawing if available using UID-based filename
        const drawingFilename = mediaFiles.drawing;
        if (m.drawingUrl && drawingFilename) {
          try {
            if (m.drawingUrl.startsWith('data:')) {
              const drawingData = m.drawingUrl.split(',')[1];
              if (drawingData) {
                drawingsFolder?.file(drawingFilename, drawingData, { base64: true });
                drawingCount++;
              }
            } else {
              try {
                const response = await fetch(m.drawingUrl);
                const drawingBlob = await response.blob();
                drawingsFolder?.file(drawingFilename, drawingBlob);
                drawingCount++;
              } catch (fetchError) {
                // Silent fail
              }
            }
          } catch (error) {
            // Silent fail
          }
        }

        // Create GeoJSON feature with UID as primary identifier
        features.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [m.longitude, m.latitude]
          },
          properties: {
            id: m.id,
            poiUID: m.id,
            legacyPoiId: m.roadNumber && m.poiNumber ? `R${String(m.roadNumber).padStart(3, '0')}-POI${String(m.poiNumber).padStart(5, '0')}` : null,
            height: m.rel,
            altitude: m.altGPS,
            date: m.utcDate,
            time: m.utcTime,
            speed: m.speed,
            heading: m.heading,
            roadNumber: m.roadNumber,
            poiNumber: m.poiNumber,
            poiType: m.poi_type,
            note: m.note,
            imageFile: imageFilename,
            videoFile: videoFilename,
            drawingFile: drawingFilename,
            hasImage: !!m.imageUrl,
            hasVideo: !!m.videoUrl,
            hasDrawing: !!m.drawingUrl,
            createdAt: m.createdAt
          }
        });
        
        processedCount++;
      }
      
      // Update progress toast every chunk
      toast.loading(`Processing measurements: ${processedCount}/${totalMeasurements}...`, {
        id: 'export-with-media'
      });
      
      // Allow garbage collection between chunks
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    console.log(`[ChunkedExport] Completed processing ${processedCount} measurements`);
    
    // Add POI manifest to documents folder for RoadScope import compatibility
    if (poiManifest.length > 0) {
      docsFolder?.file('poi_manifest.json', JSON.stringify({
        version: '2.0',
        format: 'UID-first',
        surveyId: survey.id,
        rootSurveyId: survey.rootSurveyId || survey.id,
        partOrdinal: survey.partOrdinal || 1,
        partLabel: survey.partLabel || null,
        totalPOIs: poiManifest.length,
        exportedAt: new Date().toISOString(),
        pois: poiManifest
      }, null, 2));
    }

    // Get vehicle traces for this survey
    const vehicleTraces = await getVehicleTracesForSurvey(survey.id);
    let traceCount = 0;
    
    // Add vehicle trace files if traces exist
    if (vehicleTraces.length > 0) {
      const traceName = `${survey.name || 'survey'}_vehicle_trace`;
      
      // Add GPX file
      const gpxContent = exportTraceToGPX(vehicleTraces, traceName);
      tracesFolder?.file(`${traceName}.gpx`, gpxContent);
      
      // Add GeoJSON file
      const geoJsonContent = exportTraceToGeoJSON(vehicleTraces, traceName);
      tracesFolder?.file(`${traceName}.geojson`, geoJsonContent);
      
      // Add KML file
      const kmlContent = exportTraceToKML(vehicleTraces, traceName);
      tracesFolder?.file(`${traceName}.kml`, kmlContent);
      
      traceCount = 1;
    }
    
    // Get routes for this survey
    let routes: any[] = [];
    try {
      routes = await getRoutesBySurvey(survey.id);
    } catch (error) {
      // Silent fail - no routes available
    }
    
    // Add route files if routes exist
    let routeCount = 0;
    if (routes.length > 0) {
      for (const route of routes) {
        try {
          // Export each route as a separate GeoJSON file
          const routeGeoJson = exportSingleRouteToGeoJSON(route);
          const safeRouteName = (route.name || `route_${route.id}`).replace(/[^a-zA-Z0-9_-]/g, '_');
          routesFolder?.file(`${safeRouteName}.geojson`, routeGeoJson);
          routeCount++;
        } catch (error) {
          // Silent fail
        }
      }
    }
    
    // TIMELAPSE FRAMES EXPORT
    const timelapseFrames = useCameraStore.getState().timelapseFrames;
    let timelapseCount = 0;
    
    for (const frame of timelapseFrames) {
      try {
        const filename = `frame_${frame.timestamp.replace(/[:]/g, '-')}_${frame.hasPOI ? 'POI' : 'route'}.jpg`;
        if (frame.imageUrl && frame.imageUrl.startsWith('data:')) {
          const imageData = frame.imageUrl.split(',')[1];
          if (imageData) {
            timelapseFolder?.file(filename, imageData, { base64: true });
            timelapseCount++;
          }
        }
      } catch (error) {
        // Silent fail
      }
    }
    
    // Create timelapse metadata
    const timelapseMetadata = timelapseFrames.map(frame => ({
      filename: `frame_${frame.timestamp.replace(/[:]/g, '-')}_${frame.hasPOI ? 'POI' : 'route'}.jpg`,
      timestamp: frame.timestamp,
      hasPOI: frame.hasPOI,
      poiNumber: frame.associatedPOIs?.[0]?.poiNumber,
      frameNumber: frame.frameNumber
    }));
    
    if (timelapseMetadata.length > 0) {
      timelapseFolder?.file('timelapse_manifest.json', JSON.stringify(timelapseMetadata, null, 2));
    }
    
    // VOICE NOTES EXPORT (using UID-based naming)
    // Use the surveyMeasurementIds Set collected during chunked processing
    const voiceNotes = await db.getAllFromIndex('voiceNotes', 'by-date');
    const surveyVoiceNotes: { note: any; measurementId: string }[] = [];
    for (const note of voiceNotes) {
      // Check if note's measurement belongs to this survey using the ID Set
      if (surveyMeasurementIds.has(note.measurementId)) {
        surveyVoiceNotes.push({ note, measurementId: note.measurementId });
      }
    }
    
    let voiceNoteCount = 0;
    const surveyShort = survey.id.replace(/-/g, '').substring(0, 8);
    const partOrdinal = survey.partOrdinal || 1;
    
    for (const { note, measurementId } of surveyVoiceNotes) {
      try {
        const ext = note.mimeType.includes('webm') ? 'webm' : note.mimeType.includes('mp4') ? 'mp4' : 'ogg';
        const poiShort = measurementId.replace(/-/g, '').substring(0, 8);
        const noteShort = note.id.substring(0, 8);
        // UID-based voice note filename: {surveyId8}_p{N}_{poiUID8}_voice_{noteId8}.{ext}
        const filename = `${surveyShort}_p${partOrdinal}_${poiShort}_voice_${noteShort}.${ext}`;
        
        voiceNotesFolder?.file(filename, note.blob);
        voiceNoteCount++;
      } catch (error) {
        // Silent fail
      }
    }
    
    // Create voice notes manifest with UID references
    const voiceNotesMetadata = surveyVoiceNotes.map(({ note, measurementId }) => {
      const ext = note.mimeType.includes('webm') ? 'webm' : note.mimeType.includes('mp4') ? 'mp4' : 'ogg';
      const poiShort = measurementId.replace(/-/g, '').substring(0, 8);
      const noteShort = note.id.substring(0, 8);
      return {
        filename: `${surveyShort}_p${partOrdinal}_${poiShort}_voice_${noteShort}.${ext}`,
        noteId: note.id,
        measurementId: note.measurementId,
        poiUID: measurementId,
        duration: note.duration,
        language: note.language,
        createdAt: note.createdAt
      };
    });
    
    if (voiceNotesMetadata.length > 0) {
      voiceNotesFolder?.file('voice_notes_manifest.json', JSON.stringify(voiceNotesMetadata, null, 2));
    }
    
    // GEO-REFERENCED VIDEOS EXPORT
    const geoVideos = await geoVideoRecorder.getRecordingsForSurvey(survey.id);
    let geoVideoCount = 0;
    
    for (const video of geoVideos) {
      try {
        const filename = `geo_video_${new Date(video.startTime).toISOString().split('T')[0]}_${video.id.substring(0, 8)}.webm`;
        geoVideosFolder?.file(filename, video.blob);
        geoVideoCount++;
      } catch (error) {
        // Silent fail
      }
    }
    
    // Create geo-videos manifest
    const geoVideosMetadata = geoVideos.map(video => ({
      filename: `geo_video_${new Date(video.startTime).toISOString().split('T')[0]}_${video.id.substring(0, 8)}.webm`,
      id: video.id,
      startTime: video.startTime,
      endTime: video.endTime,
      duration: video.duration,
      sizeMB: (video.blob.size / 1024 / 1024).toFixed(2)
    }));
    
    if (geoVideosMetadata.length > 0) {
      geoVideosFolder?.file('geo_videos_manifest.json', JSON.stringify(geoVideosMetadata, null, 2));
    }
    
    // ROAD PROFILES EXPORT
    const roadProfiles = await db.getAllFromIndex('roadProfiles', 'by-survey', survey.id);
    let profileCount = 0;
    let exportedProfiles = 0;  // STAGE 2: Track actually exported profiles (with strict data)
    let skippedProfiles = 0;  // STAGE 2: Track skipped legacy profiles
    let skippedSamples = 0;   // STAGE 2: Track skipped legacy samples
    let skippedEvents = 0;    // STAGE 2: Track skipped legacy events
    const profileFeatures: any[] = [];
    
    for (const profile of roadProfiles) {
      // STAGE 2: Skip legacy profiles (missing required IDs)
      if (!isStrictRoadProfile(profile)) {
        console.warn(`[Export] Skipping legacy profile ${profile.id} - missing required IDs`);
        skippedProfiles++;
        continue;
      }

      try {
        const profileLabel = profile.label || `profile_${profile.id.substring(0, 8)}`;
        const safeLabel = profileLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
        
        // STAGE 2: Get and filter samples for this profile
        const allSamples = await db.getAllFromIndex('roadProfileSamples', 'by-profile', profile.id);
        const strictSamples = allSamples.filter(isStrictRoadProfileSample);
        skippedSamples += (allSamples.length - strictSamples.length);
        
        // STAGE 2: Get profile events and filter out legacy events
        const allProfileEvents = await db.getAll('roadProfileEvents');
        const profileEvents = allProfileEvents.filter((e: any) => e.profileId === profile.id);
        
        // Filter to strict events only
        const strictEvents = profileEvents.filter(isStrictRoadProfileEvent);
        skippedEvents += (profileEvents.length - strictEvents.length);
        
        // STAGE 2: Only export if we have strict data
        if (strictSamples.length === 0 && strictEvents.length === 0 && (!profile.points || profile.points.length === 0)) {
          console.warn(`[Export] Skipping profile ${profile.id} - no strict data to export`);
          continue;
        }
        
        // STAGE 2: Increment exported profiles counter
        exportedProfiles++;
        
        // Export profile summary CSV
        const summaryCSV = [
          'Metric,Value',
          `Profile ID,${profile.id}`,
          `Label,${profileLabel}`,
          `Session ID,${profile.sessionId || 'N/A'}`,
          `Start Time,${new Date(profile.start).toLocaleString()}`,
          `End Time,${new Date(profile.end).toLocaleString()}`,
          `Resampling Step (m),${profile.step_m}`,
          `Grade Trigger (%),${profile.grade_trigger_pct}`,
          `Total Distance (m),${(profile.summary?.totalDistance_m ?? 0).toFixed(2)}`,
          `Total Climb (m),${(profile.summary?.totalClimb_m ?? 0).toFixed(2)}`,
          `Total Descent (m),${(profile.summary?.totalDescent_m ?? 0).toFixed(2)}`,
          `Max Grade Up (%),${(profile.summary?.maxGradeUp_pct ?? 0).toFixed(2)}`,
          `Max Grade Down (%),${(profile.summary?.maxGradeDown_pct ?? 0).toFixed(2)}`,
          `Min K-Factor Convex,${profile.summary?.minKFactorConvex?.toFixed(2) || 'N/A'}`,
          `Min K-Factor Concave,${profile.summary?.minKFactorConcave?.toFixed(2) || 'N/A'}`,
          `Grade Events,${profile.summary?.numGradeEvents ?? 0}`,
          `K-Factor Events,${profile.summary?.numKFactorEvents ?? 0}`,
          `Rail Crossings,${profile.summary?.numRailCrossings ?? 0}`,
        ].join('\n');
        profilesFolder?.file(`${safeLabel}_summary.csv`, summaryCSV);
        
        // Export profile points CSV
        if (profile.points && profile.points.length > 0) {
          const pointsCSV = [
            'Distance (m),Latitude,Longitude,Altitude (m),Timestamp,Grade (%),K-Factor,Curvature Type',
            ...profile.points.map(p => 
              `${p.distance_m},${p.lat},${p.lon},${p.alt_m},${p.timestamp},${p.grade_pct},${p.k_factor || ''},${p.curvature_type || ''}`
            )
          ].join('\n');
          profilesFolder?.file(`${safeLabel}_points.csv`, pointsCSV);
        }
        
        // Separate by event type
        const gradeEvents = strictEvents.filter((e: any) => e.eventType === 'grade');
        const kFactorEvents = strictEvents.filter((e: any) => e.eventType === 'k_factor');
        const railEvents = strictEvents.filter((e: any) => e.eventType === 'rail_crossing');
        
        // Export grade events CSV
        if (gradeEvents.length > 0) {
          const gradeCSV = [
            'Direction,Max Grade (%),Start Distance (m),End Distance (m),Length (m),Start Lat,Start Lon,End Lat,End Lon,Timestamp',
            ...gradeEvents.map((e: any) => 
              `${e.direction},${e.max_grade_pct},${e.start_distance_m},${e.end_distance_m},${e.length_m},${e.start_lat},${e.start_lon},${e.end_lat},${e.end_lon},${e.timestamp}`
            )
          ].join('\n');
          profilesFolder?.file(`${safeLabel}_grade_events.csv`, gradeCSV);
        }
        
        // Export K-factor events CSV
        if (kFactorEvents.length > 0) {
          const kFactorCSV = [
            'Type,K-Factor,Distance (m),Latitude,Longitude,Severity,Timestamp',
            ...kFactorEvents.map((e: any) => 
              `${e.curvature_type},${e.k_factor},${e.distance_m},${e.lat},${e.lon},${e.severity},${e.timestamp}`
            )
          ].join('\n');
          profilesFolder?.file(`${safeLabel}_k_factor_events.csv`, kFactorCSV);
        }
        
        // Export rail crossing events CSV
        if (railEvents.length > 0) {
          const railCSV = [
            'Detection Method,Distance (m),Latitude,Longitude,Elevation Change (m),Notes,Timestamp',
            ...railEvents.map((e: any) => 
              `${e.detection_method},${e.distance_m},${e.lat},${e.lon},${e.elevation_change_m || ''},${(e.notes || '').replace(/,/g, ';')},${e.timestamp}`
            )
          ].join('\n');
          profilesFolder?.file(`${safeLabel}_rail_crossings.csv`, railCSV);
        }
        
        // Add profile line feature for GeoJSON
        if (profile.points && profile.points.length > 0) {
          profileFeatures.push({
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: profile.points.map(p => [p.lon, p.lat, p.alt_m])
            },
            properties: {
              featureType: 'roadProfile',
              id: profile.id,
              label: profileLabel,
              totalDistance_m: profile.summary?.totalDistance_m ?? 0,
              totalClimb_m: profile.summary?.totalClimb_m ?? 0,
              totalDescent_m: profile.summary?.totalDescent_m ?? 0,
              maxGradeUp_pct: profile.summary?.maxGradeUp_pct ?? 0,
              maxGradeDown_pct: profile.summary?.maxGradeDown_pct ?? 0,
            }
          });
          
          // Add grade event features
          gradeEvents.forEach((e: any) => {
            profileFeatures.push({
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: [[e.start_lon, e.start_lat], [e.end_lon, e.end_lat]]
              },
              properties: {
                featureType: 'gradeEvent',
                profileId: profile.id,
                direction: e.direction,
                max_grade_pct: e.max_grade_pct,
                length_m: e.length_m,
              }
            });
          });
          
          // Add K-factor event features
          kFactorEvents.forEach((e: any) => {
            profileFeatures.push({
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [e.lon, e.lat]
              },
              properties: {
                featureType: 'kFactorEvent',
                profileId: profile.id,
                curvature_type: e.curvature_type,
                k_factor: e.k_factor,
                severity: e.severity,
              }
            });
          });
          
          // Add rail crossing features
          railEvents.forEach((e: any) => {
            profileFeatures.push({
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [e.lon, e.lat]
              },
              properties: {
                featureType: 'railCrossing',
                profileId: profile.id,
                detection_method: e.detection_method,
                notes: e.notes,
              }
            });
          });
        }
        
        profileCount++;
      } catch (error) {
        // Silent fail for individual profiles
        console.error('Failed to export profile:', error);
      }
    }
    
    // STAGE 2: ABORT if no strict profiles were exported
    if (exportedProfiles === 0 && skippedProfiles > 0) {
      toast.error('Export Aborted', {
        id: 'export-with-media',
        description: `All ${skippedProfiles} profiles are legacy and cannot be exported. Retry Stage 1 migration to fix.`
      });
      return;  // Abort - don't create empty ZIP
    }
    
    // STAGE 2: Show toast with ALL skip counts if any (but export was successful)
    const totalSkipped = skippedProfiles + skippedSamples + skippedEvents;
    if (totalSkipped > 0) {
      /* toast removed */
    }
    
    // ACTIVITY LOGS EXPORT
    const alerts = await db.getAllFromIndex('alerts', 'by-survey', survey.id);
    
    if (alerts.length > 0) {
      // Export as JSON
      docsFolder?.file('activity_logs.json', JSON.stringify(alerts, null, 2));
      
      // Also create CSV
      const alertsCsvHeaders = ['Timestamp', 'Type', 'Message', 'Severity', 'Road Number', 'POI Number'].join(',');
      const alertsCsvRows = alerts.map(alert => [
        alert.createdAt || alert.timestamp,
        alert.type || 'general',
        (alert.message || '').replace(/,/g, ';'),
        alert.severity || 'info',
        alert.roadNumber || '',
        alert.poiNumber || ''
      ].join(','));
      docsFolder?.file('activity_logs.csv', [alertsCsvHeaders, ...alertsCsvRows].join('\n'));
    }
    
    // ROAD PROFILE STRUCTURED EXPORT (CSV + GeoJSON via dedicated helper)
    // Generates: road_profile_detail.csv, road_profile_summary.csv,
    //            road_profile_alerts.csv, road_profile.geojson, road_profile_alerts.geojson
    if (docsFolder) {
      await addRoadProfileExportsToZip(zip, survey.id, docsFolder).catch(err => {
        console.warn('[Export] Road profile structured export failed (non-fatal):', err);
      });
    }
    
    // Create trace LineString features for GeoJSON
    const traceFeatures = vehicleTraces.length > 0 ? [{
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: vehicleTraces.map(t => [t.longitude, t.latitude])
      },
      properties: {
        featureType: 'vehicleTrace',
        name: 'Vehicle Trace',
        totalPoints: vehicleTraces.length,
        startTime: vehicleTraces[0]?.timestamp || null,
        endTime: vehicleTraces[vehicleTraces.length - 1]?.timestamp || null
      }
    }] : [];
    
    // Create route LineString features for GeoJSON
    const routeFeatures = routes.map(route => {
      const sortedPoints = [...route.points].sort((a, b) => a.order - b.order);
      return {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: sortedPoints.map(point => [point.position[1], point.position[0]])
        },
        properties: {
          featureType: 'route',
          name: route.name,
          description: route.description || '',
          color: route.color
        }
      };
    });

    // Add survey metadata
    const surveyMetadata = {
      survey: {
        id: survey.id,
        name: survey.name || survey.surveyTitle,
        surveyor: survey.surveyor || survey.surveyorName,
        client: survey.clientName || survey.customerName,
        projectNumber: survey.projectNumber,
        originAddress: survey.originAddress,
        destinationAddress: survey.destinationAddress,
        description: survey.description,
        notes: survey.notes,
        createdAt: survey.createdAt,
        exportedAt: new Date().toISOString()
      },
      statistics: {
        totalMeasurements: processedCount,
        totalImages: imageCount,
        totalVideos: videoCount,
        totalTraces: traceCount,
        totalRoutes: routeCount,
        totalRoadProfiles: profileCount,
        totalTracePoints: vehicleTraces.length,
        totalTimelapseFrames: timelapseCount,
        totalVoiceNotes: voiceNoteCount,
        totalGeoVideos: geoVideoCount,
        totalActivityLogs: alerts.length,
        roadNumbers: [...uniqueRoadNumbers].sort((a, b) => a - b),
        poiTypes: [...uniquePoiTypes].sort()
      }
    };
    
    // Add metadata file
    docsFolder?.file('survey_metadata.json', JSON.stringify(surveyMetadata, null, 2));
    
    // Combine all features: measurements, traces, routes, and profiles
    const allGeoJsonFeatures = [
      ...features,
      ...traceFeatures,
      ...routeFeatures,
      ...profileFeatures
    ];
    
    // Add GeoJSON file to documents folder
    const geoJson = JSON.stringify({
      type: 'FeatureCollection',
      features: allGeoJsonFeatures,
      properties: {
        surveyName: survey.name,
        surveyId: survey.id,
        createdAt: survey.createdAt,
        exportedAt: new Date().toISOString(),
        totalMeasurements: processedCount,
        totalImages: imageCount,
        totalVideos: videoCount,
        totalTraces: traceCount,
        totalRoutes: routeCount,
        totalRoadProfiles: profileCount,
        totalTracePoints: vehicleTraces.length,
        totalTimelapseFrames: timelapseCount,
        totalVoiceNotes: voiceNoteCount,
        totalGeoVideos: geoVideoCount,
        totalActivityLogs: alerts.length
      }
    }, null, 2);

    docsFolder?.file('survey_data.geojson', geoJson);

    // Add enhanced CSV export with image/video mapping
    const csvData = await exportSurveyData(survey, 'csv');
    docsFolder?.file('survey_data.csv', csvData);
    
    // Create image mapping file using data from poiManifest (already collected during chunked processing)
    const imageMappingData = poiManifest
      .filter(p => p.mediaFiles?.image)
      .map(p => ({
        poiUID: p.poiId,
        legacyPoiId: p.legacyRoadNumber && p.legacyPoiNumber 
          ? `R${String(p.legacyRoadNumber).padStart(3, '0')}-POI${String(p.legacyPoiNumber).padStart(5, '0')}` 
          : null,
        roadNumber: p.legacyRoadNumber,
        poiNumber: p.legacyPoiNumber,
        poiType: p.poiType,
        imageFilename: p.mediaFiles?.image,
        coordinates: [p.coordinates.longitude, p.coordinates.latitude],
        timestamp: p.createdAt
      }));
    
    if (imageMappingData.length > 0) {
      docsFolder?.file('image_mapping.json', JSON.stringify(imageMappingData, null, 2));
      
      // Also create a simple CSV mapping for easy reference
      const mappingCsvHeaders = ['POI_UID', 'Legacy_POI_ID', 'Road_Number', 'POI_Number', 'POI_Type', 'Image_Filename', 'Latitude', 'Longitude'].join(',');
      const mappingCsvRows = imageMappingData.map(item => {
        const coords = item.coordinates as number[];
        return [
          item.poiUID,
          item.legacyPoiId || '',
          item.roadNumber || '',
          item.poiNumber || '',
          item.poiType || '',
          item.imageFilename || '',
          coords[1]?.toFixed(6) || '',
          coords[0]?.toFixed(6) || ''
        ].join(',');
      });
      
      docsFolder?.file('image_mapping.csv', [mappingCsvHeaders, ...mappingCsvRows].join('\n'));
    }
    
    // Create README file with instructions
    const readmeContent = `# ${survey.name || survey.surveyTitle} - Survey Export

This package contains a complete export of your survey data with all associated media files, vehicle traces, and routes.

## File Naming Format (v2.0 UID-based):
Media files use collision-proof UID-based naming:
{surveyId8}_{pN}_{poiUID8}_{type}_{timestamp}.{ext}

Example: a1b2c3d4_p1_e5f6g7h8_bridge_1732123456.jpg

This ensures filenames are globally unique across all survey parts and prevents collisions when surveys are restarted after crashes.

## Contents:

### Documents folder:
- survey_metadata.json: Complete survey information and statistics
- survey_data.geojson: Geographic data in GeoJSON format (includes measurements, traces, and routes as LineStrings)
- survey_data.csv: Tabular data in CSV format
- poi_manifest.json: UID to filename mapping for RoadScope import compatibility
- image_mapping.json: Detailed mapping of images to POIs with UID references
- image_mapping.csv: Simple CSV mapping of images to POIs
- activity_logs.json: All survey events and alerts in JSON format
- activity_logs.csv: Activity log in CSV format for spreadsheet analysis

### Images folder:
- ${imageCount} POI images with UID-based collision-proof filenames
- Each image filename corresponds to its POI in the manifest and mapping files

### Videos folder:
- ${videoCount} POI videos with UID-based collision-proof filenames
- Each video filename corresponds to its POI in the manifest and mapping files

### Drawings folder:
- POI drawings with UID-based collision-proof filenames
- Each drawing filename corresponds to its POI in the manifest

### Timelapse folder:
- ${timelapseCount} timelapse frames captured during survey
- timelapse_manifest.json: Frame metadata linking to POIs and route progress
- Frames are named: frame_[Timestamp]_[POI/route].jpg

### Voice Notes folder:
- ${voiceNoteCount} voice recordings linked to measurements
- voice_notes_manifest.json: Mapping of voice notes to POIs with UID references
- Voice notes use UID-based naming: {surveyId8}_p{N}_{poiUID8}_voice_{noteId8}.{ext}

### Geo-Videos folder:
- ${geoVideoCount} continuous video recordings with GPS timestamps
- geo_videos_manifest.json: Video timing and duration metadata
- Videos are named: geo_video_[Date]_[ID].webm

### Traces folder:
- ${traceCount > 0 ? `Vehicle trace data in multiple formats (GPX, GeoJSON, KML)` : 'No vehicle traces recorded for this survey'}
- Trace files contain GPS coordinates recorded during vehicle movement
- GPX files compatible with most GPS software
- GeoJSON files for use in mapping applications
- KML files for use in Google Earth and other platforms

### Routes folder:
- ${routeCount > 0 ? `${routeCount} route(s) exported as GeoJSON LineStrings` : 'No routes defined for this survey'}
- Each route is a separate GeoJSON file
- Routes represent planned or recorded paths

## File Naming Convention:
- Road numbers are formatted as R001, R002, etc.
- POI numbers are formatted as 5-digit numbers: 00001, 00002, etc.
- POI types indicate the type of object measured
- ID is a unique 8-character identifier

## Survey Information:
- Survey Name: ${survey.name || survey.surveyTitle}
- Surveyor: ${survey.surveyor || survey.surveyorName}
- Client: ${survey.clientName || survey.customerName}
- Project Number: ${survey.projectNumber}
- Created: ${new Date(survey.createdAt).toLocaleString()}
- Exported: ${new Date().toLocaleString()}

## Statistics:
- Total Measurements: ${processedCount}
- Total Images: ${imageCount}
- Total Videos: ${videoCount}
- Total Timelapse Frames: ${timelapseCount}
- Total Voice Notes: ${voiceNoteCount}
- Total Geo-Videos: ${geoVideoCount}
- Total Activity Logs: ${alerts.length}
- Total Vehicle Traces: ${traceCount}
- Total Trace Points: ${vehicleTraces.length}
- Total Routes: ${routeCount}

## GeoJSON Format Notes:
The survey_data.geojson file includes:
- Measurement points as Point features
- Vehicle traces as LineString features (if recorded)
- Routes as LineString features (if defined)
- All features have a 'featureType' property to distinguish between measurements, traces, and routes

For technical support, contact SolTec Innovation.
`;
    
    zip.file('README.txt', readmeContent);

    // Generate the zip file
    const zipBlob = await zip.generateAsync({ type: 'blob' });

    // Create custom filename
    const filename = `${survey.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || survey.id}-complete-export-${new Date().toISOString().split('T')[0]}.zip`;

    // Save the zip file
    await downloadFile(zipBlob, filename, 'application/zip');

    /* toast removed */
  } catch (error) {
    toast.error('Failed to export complete survey', {
      id: 'export-with-media',
      description: (error as Error).message
    });
  }
};

/**
 * Export survey with images only (no videos) for faster export
 * @param survey - Survey to export
 * @returns Promise that resolves when export is complete
 */
export const exportSurveyWithImages = async (survey: Survey | null): Promise<void> => {
  if (!survey) {
    toast.error('No active survey to export');
    return;
  }

  try {
    toast.loading('Preparing survey export with images...', {
      id: 'export-with-images'
    });

    // Create a new JSZip instance
    const zip = new JSZip();
    
    // CHUNKED EXPORT: Get total count for progress tracking without loading data
    const totalMeasurements = await getMeasurementCount(survey.id);
    console.log(`[ChunkedExport] Starting images-only export of ${totalMeasurements} measurements`);

    // Create folders
    const imagesFolder = zip.folder('images');
    const docsFolder = zip.folder('documents');

    // CHUNKED PROCESSING: Process images in batches
    let imageCount = 0;
    let processedCount = 0;
    const poiManifest: POIManifestEntry[] = [];
    const imageMappingData: any[] = [];
    
    for await (const chunk of getMeasurementsInChunks(survey.id, EXPORT_CHUNK_SIZE)) {
      for (const m of chunk) {
        if (m.imageUrl) {
          try {
            // Generate POI manifest and get UID-based filename
            const manifest = createPOIManifestEntry(survey, m);
            poiManifest.push(manifest);
            const mediaFiles = generatePOIMediaFilenames(survey, m);
            const imageFilename = mediaFiles.image;
            
            if (imageFilename && m.imageUrl.startsWith('data:')) {
              const imageData = m.imageUrl.split(',')[1];
              if (imageData) {
                imagesFolder?.file(imageFilename, imageData, { base64: true });
                imageCount++;
              }
            } else if (imageFilename) {
              try {
                const response = await fetch(m.imageUrl);
                const imageBlob = await response.blob();
                imagesFolder?.file(imageFilename, imageBlob);
                imageCount++;
              } catch (fetchError) {
                // Silent fail
              }
            }
            
            // Build image mapping entry
            imageMappingData.push({
              poiUID: m.id,
              legacyPoiId: m.roadNumber && m.poiNumber ? `R${String(m.roadNumber).padStart(3, '0')}-POI${String(m.poiNumber).padStart(5, '0')}` : null,
              roadNumber: m.roadNumber,
              poiNumber: m.poiNumber,
              poiType: m.poi_type,
              imageFilename,
              latitude: m.latitude,
              longitude: m.longitude,
              date: m.utcDate,
              time: m.utcTime
            });
          } catch (error) {
            // Silent fail
          }
        }
        processedCount++;
      }
      
      // Update progress toast every chunk
      toast.loading(`Processing images: ${processedCount}/${totalMeasurements}...`, {
        id: 'export-with-images'
      });
      
      // Allow garbage collection between chunks
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    console.log(`[ChunkedExport] Completed images export: ${imageCount} images from ${processedCount} measurements`);
    
    // Add POI manifest for UID-based file mapping
    if (poiManifest.length > 0) {
      docsFolder?.file('poi_manifest.json', JSON.stringify({
        version: '2.0',
        format: 'UID-first',
        surveyId: survey.id,
        partOrdinal: survey.partOrdinal || 1,
        totalPOIs: poiManifest.length,
        exportedAt: new Date().toISOString(),
        pois: poiManifest.filter(p => p.mediaFiles.image)
      }, null, 2));
    }

    // Add enhanced CSV with image mapping
    const csvData = await exportSurveyData(survey, 'csv');
    docsFolder?.file('survey_data.csv', csvData);
    
    if (imageMappingData.length > 0) {
      docsFolder?.file('image_mapping.json', JSON.stringify(imageMappingData, null, 2));
    }

    // Generate the zip file
    const zipBlob = await zip.generateAsync({ type: 'blob' });

    // Create custom filename
    const filename = `${survey.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || survey.id}-with-images-${new Date().toISOString().split('T')[0]}.zip`;

    // Save the zip file
    await downloadFile(zipBlob, filename, 'application/zip');

    /* toast removed */
  } catch (error) {
    toast.error('Failed to export survey with images', {
      id: 'export-with-images',
      description: (error as Error).message
    });
  }
};
/**
 * STREAMING EXPORT: Generate survey package using chunked iteration
 * Prevents OOM by never loading all measurements into memory at once
 * 
 * NOW USES UID-BASED NAMING consistent with Export All Data:
 * - images/{surveyId8}_{partN}_{poiUID8}_{type}_{timestamp}.jpg
 * - videos/{surveyId8}_{partN}_{poiUID8}_{type}_{timestamp}.webm
 * - drawings/{surveyId8}_{partN}_{poiUID8}_{type}_{timestamp}.png
 * 
 * Includes POI manifest (poi_manifest.json) that maps POI IDs to their media files
 * 
 * Strategy:
 * 1. Count measurements first (lightweight)
 * 2. Build CSV/JSON incrementally using cursor iteration
 * 3. Strip base64 media from JSON (only keep URLs) to reduce memory
 * 4. Process media files separately in chunks with UID-based names
 */
export const generateSurveyPackageBlob = async (survey: Survey): Promise<{ blob: Blob; filename: string; measurementCount: number }> => {
  const db = await openSurveyDB();
  
  // Step 1: Get count without loading data
  const measurementCount = await db.countFromIndex('measurements', 'by-survey', survey.id);
  console.log(`[StreamingExport] Starting export for ${measurementCount} measurements`);

  const zip = new JSZip();
  const docsFolder = zip.folder('documents');
  const imagesFolder = zip.folder('images');
  const videosFolder = zip.folder('videos');
  const drawingsFolder = zip.folder('drawings');

  // Step 2: Add survey metadata (lightweight)
  const metadata = {
    id: survey.id,
    name: survey.name,
    surveyTitle: survey.surveyTitle,
    surveyor: survey.surveyor,
    surveyorName: survey.surveyorName,
    clientName: survey.clientName,
    customerName: survey.customerName,
    projectNumber: survey.projectNumber,
    originAddress: survey.originAddress,
    destinationAddress: survey.destinationAddress,
    description: survey.description,
    notes: survey.notes,
    ownerEmail: survey.ownerEmail,
    completionEmailList: survey.completionEmailList,
    createdAt: survey.createdAt,
    closedAt: survey.closedAt,
    measurementCount,
    exportedAt: new Date().toISOString()
  };
  docsFolder?.file('survey_metadata.json', JSON.stringify(metadata, null, 2));

  // Step 3: Build CSV and lightweight JSON incrementally using cursor
  // CSV now includes Image Filename and Video Filename columns
  const csvHeaders = [
    'Date', 'Time', 'POI UID', 'Height (m)', 'GPS Alt (m)', 'Latitude', 'Longitude',
    'Speed (km/h)', 'Heading', 'Road Number', 'POI Number', 'POI Type', 'Note',
    'Source', 'Width (m)', 'Length (m)', 'Image Filename', 'Video Filename', 'Drawing Filename',
    'Has Image', 'Has Video', 'Has Drawing'
  ].join(',');
  
  const csvRows: string[] = [csvHeaders];
  const lightweightMeasurements: any[] = [];
  const poiManifest: POIManifestEntry[] = [];
  let processedCount = 0;
  let imageCount = 0;
  let videoCount = 0;
  let drawingCount = 0;
  
  // Use chunked iteration to prevent OOM
  for await (const chunk of getMeasurementsInChunks(survey.id, 25)) {
    for (const m of chunk) {
      processedCount++;
      
      // Generate UID-based media filenames using mediaNames.ts
      const manifestEntry = createPOIManifestEntry(survey, m);
      poiManifest.push(manifestEntry);
      const mediaFiles = generatePOIMediaFilenames(survey, m);
      
      // Build CSV row with actual filenames
      csvRows.push([
        m.utcDate || '',
        m.utcTime || '',
        m.id,
        (m.rel || 0).toFixed(3),
        (m.altGPS || 0).toFixed(1),
        (m.latitude || 0).toFixed(6),
        (m.longitude || 0).toFixed(6),
        (m.speed || 0).toFixed(1),
        (m.heading || 0).toFixed(1),
        m.roadNumber || '',
        m.poiNumber || '',
        m.poi_type || '',
        (m.note || '').replace(/,/g, ';'),
        m.source || 'manual',
        m.widthMeasure ? m.widthMeasure.toFixed(3) : '',
        m.lengthMeasure ? m.lengthMeasure.toFixed(3) : '',
        mediaFiles.image || '',
        mediaFiles.video || '',
        mediaFiles.drawing || '',
        m.imageUrl ? 'Yes' : 'No',
        m.videoUrl ? 'Yes' : 'No',
        m.drawingUrl ? 'Yes' : 'No'
      ].join(','));
      
      // Build lightweight measurement with filename references
      const lightMeasurement = {
        id: m.id,
        utcDate: m.utcDate,
        utcTime: m.utcTime,
        rel: m.rel,
        altGPS: m.altGPS,
        latitude: m.latitude,
        longitude: m.longitude,
        speed: m.speed,
        heading: m.heading,
        roadNumber: m.roadNumber,
        poiNumber: m.poiNumber,
        poi_type: m.poi_type,
        note: m.note,
        source: m.source,
        widthMeasure: m.widthMeasure,
        lengthMeasure: m.lengthMeasure,
        imageFilename: mediaFiles.image,
        videoFilename: mediaFiles.video,
        drawingFilename: mediaFiles.drawing,
        hasImage: !!m.imageUrl,
        hasVideo: !!m.videoUrl,
        hasDrawing: !!m.drawingUrl,
        createdAt: m.createdAt
      };
      lightweightMeasurements.push(lightMeasurement);
      
      // Process image with UID-based filename
      if (m.imageUrl && mediaFiles.image) {
        try {
          if (isAssetReference(m.imageUrl)) {
            const blob = await getAssetBlob(m.imageUrl);
            if (blob) {
              imagesFolder?.file(mediaFiles.image, blob);
              imageCount++;
            }
          } else if (m.imageUrl.startsWith('data:')) {
            const base64Data = m.imageUrl.split(',')[1];
            if (base64Data) {
              imagesFolder?.file(mediaFiles.image, base64Data, { base64: true });
              imageCount++;
            }
          }
        } catch {}
      }
      
      // Process video with UID-based filename
      if (m.videoUrl && mediaFiles.video) {
        try {
          if (isAssetReference(m.videoUrl)) {
            const blob = await getAssetBlob(m.videoUrl);
            if (blob) {
              videosFolder?.file(mediaFiles.video, blob);
              videoCount++;
            }
          } else if (m.videoUrl.startsWith('data:')) {
            const base64Data = m.videoUrl.split(',')[1];
            if (base64Data) {
              videosFolder?.file(mediaFiles.video, base64Data, { base64: true });
              videoCount++;
            }
          }
        } catch {}
      }
      
      // Process drawing with UID-based filename
      if (m.drawingUrl && mediaFiles.drawing) {
        try {
          if (isAssetReference(m.drawingUrl)) {
            const blob = await getAssetBlob(m.drawingUrl);
            if (blob) {
              drawingsFolder?.file(mediaFiles.drawing, blob);
              drawingCount++;
            }
          } else if (m.drawingUrl.startsWith('data:')) {
            const base64Data = m.drawingUrl.split(',')[1];
            if (base64Data) {
              drawingsFolder?.file(mediaFiles.drawing, base64Data, { base64: true });
              drawingCount++;
            }
          }
        } catch {}
      }
    }
    
    // Allow GC between chunks
    await new Promise(resolve => setTimeout(resolve, 10));
    
    if (processedCount % 100 === 0) {
      console.log(`[StreamingExport] Processed ${processedCount}/${measurementCount} measurements`);
    }
  }
  
  // Step 4: Write accumulated data to ZIP
  docsFolder?.file('survey_data.csv', csvRows.join('\n'));
  docsFolder?.file('survey_data.json', JSON.stringify({
    survey: metadata,
    measurements: lightweightMeasurements
  }, null, 2));
  
  // POI Manifest - maps POI IDs to their media files
  docsFolder?.file('poi_manifest.json', JSON.stringify(poiManifest, null, 2));
  
  // Step 5: Add road profiles (usually small)
  try {
    const tx = db.transaction('roadProfiles', 'readonly');
    const store = tx.objectStore('roadProfiles');
    const profiles: any[] = [];
    let cursor = await store.openCursor();
    while (cursor) {
      if (cursor.value.surveyId === survey.id) {
        profiles.push(cursor.value);
      }
      cursor = await cursor.continue();
    }
    if (profiles.length > 0) {
      docsFolder?.file('road_profiles.json', JSON.stringify(profiles, null, 2));
    }
  } catch {}

  // Step 5b: Add structured road profile exports (CSV + GeoJSON)
  // Generates: road_profile_detail.csv, road_profile_summary.csv,
  //            road_profile_alerts.csv, road_profile.geojson, road_profile_alerts.geojson
  if (docsFolder) {
    await addRoadProfileExportsToZip(zip, survey.id, docsFolder).catch(err => {
      console.warn('[StreamingExport] Road profile structured export failed (non-fatal):', err);
    });
  }
  
  // Step 6: Add README with structure explanation
  const readmeContent = `SURVEY PACKAGE - ${survey.surveyTitle || survey.name || survey.id}
============================================================
Exported: ${new Date().toISOString()}
Survey ID: ${survey.id}
Total POIs: ${measurementCount}

FOLDER STRUCTURE:
-----------------
documents/
  - survey_metadata.json  : Survey details and settings
  - survey_data.csv       : All POI data with media filenames
  - survey_data.json      : POI data in JSON format
  - poi_manifest.json     : Maps POI IDs to their media files
  - road_profiles.json    : Road profile data (if any)

images/
  - Contains ${imageCount} image files
  - Naming: {surveyId}_{part}_{poiId}_{type}_{timestamp}.jpg
  
videos/
  - Contains ${videoCount} video files
  - Naming: {surveyId}_{part}_{poiId}_{type}_{timestamp}.webm

drawings/
  - Contains ${drawingCount} drawing files
  - Naming: {surveyId}_{part}_{poiId}_{type}_{timestamp}.png

HOW TO LINK MEDIA TO POIs:
--------------------------
1. Open poi_manifest.json to see the complete mapping
2. Each POI entry includes:
   - poiId: The unique POI identifier
   - mediaFiles.image: Filename in images/ folder
   - mediaFiles.video: Filename in videos/ folder
   - mediaFiles.drawing: Filename in drawings/ folder
   
3. Or use survey_data.csv which includes:
   - POI UID column: The unique identifier
   - Image Filename column: Corresponding image file
   - Video Filename column: Corresponding video file
   - Drawing Filename column: Corresponding drawing file

Generated by MeasurePRO v2.1.0
`;
  zip.file('README.txt', readmeContent);

  console.log(`[StreamingExport] Generating ZIP blob...`);
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const filename = `${survey.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || survey.id}-${new Date().toISOString().split('T')[0]}.zip`;

  console.log(`[StreamingExport] Complete: ${measurementCount} POIs, ${imageCount} images, ${videoCount} videos, ${drawingCount} drawings, ZIP size: ${(zipBlob.size / 1024 / 1024).toFixed(2)}MB`);
  return { blob: zipBlob, filename, measurementCount };
};

/**
 * Close survey with automatic export and email notification
 * 
 * ARCHITECTURE:
 * 1. Mark survey as inactive FIRST (data integrity)
 * 2. Generate complete package ZIP
 * 3. Save locally for user download
 * 4. Upload to Firebase Storage (if online)
 * 5. Send email with download link (NOT attachments - packages are too large)
 * 
 * @param survey - Survey to close
 * @param options - Optional settings for the closure
 * @returns Promise that resolves when closure is complete
 */
export const closeSurveyWithExport = async (
  survey: Survey,
  options: {
    sendEmail?: boolean;
    downloadPackage?: boolean;
  } = { sendEmail: true, downloadPackage: true }
): Promise<{ success: boolean; error?: string; updatedSurvey?: Survey; downloadUrl?: string }> => {
  if (!survey) {
    return { success: false, error: 'No survey provided' };
  }

  try {
    toast.loading('Closing survey and preparing export...', {
      id: 'close-survey'
    });

    // Step 1: Mark survey as inactive FIRST (ensures data integrity)
    const db = await openSurveyDB();
    const updatedSurvey: Survey = { 
      ...survey, 
      active: false, 
      closedAt: new Date().toISOString() 
    };
    await db.put('surveys', updatedSurvey);
    console.log('[CloseSurvey] Survey marked as inactive:', survey.id);

    // Step 2: Generate complete package
    let packageBlob: Blob | null = null;
    let packageFilename = '';
    let measurementCount = 0;
    let downloadUrl: string | undefined;

    try {
      const packageData = await generateSurveyPackageBlob(updatedSurvey);
      packageBlob = packageData.blob;
      packageFilename = packageData.filename;
      measurementCount = packageData.measurementCount;
      console.log('[CloseSurvey] Package generated:', packageFilename, 'Size:', formatBytes(packageBlob.size));
    } catch (genError) {
      console.error('[CloseSurvey] Package generation failed:', genError);
      toast.error('Failed to generate survey package', {
        description: (genError as Error).message
      });
    }

    // Step 3: Save locally for user download
    if (options.downloadPackage && packageBlob) {
      try {
        await downloadFile(packageBlob, packageFilename, 'application/zip');
        console.log('[CloseSurvey] Local download initiated');
      } catch (saveError) {
        console.error('[CloseSurvey] Local save failed:', saveError);
      }
    }

    // Step 4: Upload to Firebase Storage for email link
    if (options.sendEmail && packageBlob && navigator.onLine) {
      try {
        toast.loading('Uploading to cloud storage...', { id: 'close-survey' });
        
        const { uploadSurveyPackage, canUploadToCloud } = await import('../firebase/storageUpload');
        
        if (canUploadToCloud()) {
          const uploadResult = await uploadSurveyPackage(
            survey.id,
            packageBlob,
            packageFilename,
            (progress) => {
              toast.loading(`Uploading... ${progress.percentage}%`, { id: 'close-survey' });
            }
          );

          if (uploadResult.success && uploadResult.downloadUrl) {
            downloadUrl = uploadResult.downloadUrl;
            console.log('[CloseSurvey] Upload complete, download URL:', downloadUrl.substring(0, 50) + '...');
          } else {
            console.warn('[CloseSurvey] Upload failed:', uploadResult.error);
          }
        } else {
          console.log('[CloseSurvey] Cloud upload not available');
        }
      } catch (uploadError) {
        console.error('[CloseSurvey] Upload failed:', uploadError);
        // Continue - email will inform user to use local download
      }
    }

    // Step 5: Send email notification with download link
    if (options.sendEmail) {
      const recipients: string[] = [];
      
      console.log('[CloseSurvey] Email check - ownerEmail:', survey.ownerEmail, 'completionEmailList:', survey.completionEmailList);
      
      if (survey.ownerEmail) {
        recipients.push(survey.ownerEmail);
      }
      
      if (survey.completionEmailList && survey.completionEmailList.length > 0) {
        recipients.push(...survey.completionEmailList);
      }

      if (recipients.length > 0) {
        try {
          toast.loading('Sending completion email...', { id: 'close-survey' });
          console.log('[CloseSurvey] Sending email to:', recipients);
          
          const { sendSurveyCompletionEmail } = await import('./emailUtils');
          await sendSurveyCompletionEmail(
            {
              to: recipients,
              bcc: ['admin@soltec.ca'],
              surveyTitle: updatedSurvey.surveyTitle || updatedSurvey.name || 'Untitled Survey',
              surveyorName: updatedSurvey.surveyorName || updatedSurvey.surveyor || 'Unknown',
              clientName: updatedSurvey.clientName || updatedSurvey.customerName || 'Unknown',
              projectNumber: updatedSurvey.projectNumber || updatedSurvey.description,
              measurementCount: measurementCount,
              notes: updatedSurvey.notes || '',
              downloadUrl: downloadUrl,
              packageSize: packageBlob ? formatBytes(packageBlob.size) : undefined
            }
          );
          console.log('[CloseSurvey] Email sent successfully to:', recipients.join(', '));
        } catch (emailError) {
          console.error('[CloseSurvey] Email failed:', emailError);
          toast.error('Failed to send email notification', {
            description: (emailError as Error).message
          });
        }
      } else {
        console.warn('[CloseSurvey] No recipients found - ownerEmail and completionEmailList are empty');
        /* toast removed */
      }
    }

    // Step 6: Sync to RoadScope if API key is configured
    try {
      const { getAuth } = await import('firebase/auth');
      const auth = getAuth();
      const userId = auth.currentUser?.uid;
      
      if (userId && navigator.onLine) {
        // Check if RoadScope is configured for this user
        const settingsRes = await fetch(`${API_BASE_URL}/api/roadscope/settings/${userId}`);
        const settingsJson = await settingsRes.json();
        
        if (settingsJson.success && settingsJson.data?.apiKeyValidated === true) {
          console.log('[CloseSurvey] RoadScope API key is configured, syncing survey...');
          toast.loading('Syncing to RoadScope...', { id: 'close-survey' });
          
          const { syncSurveyToRoadScope, getSyncStatus } = await import('../roadscope/syncService');
          const status = await getSyncStatus(survey.id);
          
          const result = await syncSurveyToRoadScope(updatedSurvey, userId, {
            includeFiles: true, // Include all files on survey close (full sync)
            targetSurveyId: status?.roadscopeSurveyId,
            onProgress: (progress) => {
              if (progress.phase === 'uploading-files') {
                toast.loading(`Uploading files ${progress.current}/${progress.total}...`, { id: 'close-survey' });
              }
            }
          });
          
          if (result.success) {
            console.log(`[CloseSurvey] RoadScope sync complete: ${result.poisSynced} POIs, ${result.filesSynced} files`);
            /* toast removed */
          } else {
            console.warn('[CloseSurvey] RoadScope sync failed:', result.errors);
            /* toast removed */
          }
        } else {
          console.log('[CloseSurvey] RoadScope not configured, skipping sync');
        }
      }
    } catch (roadScopeError) {
      console.error('[CloseSurvey] RoadScope sync failed:', roadScopeError);
      // Don't fail the entire close operation if RoadScope sync fails
    }

    toast.dismiss('close-survey');
    
    return { success: true, updatedSurvey, downloadUrl };
  } catch (error) {
    console.error('[CloseSurvey] Failed:', error);
    toast.error('Failed to close survey', {
      id: 'close-survey',
      description: (error as Error).message
    });
    return { success: false, error: (error as Error).message };
  }
};

/**
 * Format bytes to human readable string
 */
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Export route to GeoJSON
 * @param route - Route to export
 * @returns GeoJSON string
 */
export const exportRouteToGeoJSON = (route: any): string => {
  // Sort points by order
  const sortedPoints = [...route.points].sort((a, b) => a.order - b.order);
  
  // Convert points to GeoJSON coordinates [lng, lat]
  const coordinates = sortedPoints.map(point => [point.position[1], point.position[0]]);
  
  const geoJson = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          name: route.name,
          description: route.description || '',
          color: route.color
        },
        geometry: {
          type: 'LineString',
          coordinates
        }
      }
    ]
  };
  
  return JSON.stringify(geoJson, null, 2);
};

/**
 * MEMORY CLEANUP: Purge a survey and all its data from IndexedDB
 * Call this AFTER successfully saving the survey to disk/cloud
 * 
 * @param surveyId - The survey ID to purge
 * @returns Summary of deleted items
 */
export const purgeSurveyFromIndexedDB = async (surveyId: string): Promise<{
  success: boolean;
  deleted: { survey: boolean; measurements: number; traces: number; alerts: number };
  error?: string;
}> => {
  const deleted = { survey: false, measurements: 0, traces: 0, alerts: 0 };
  
  try {
    const db = await openSurveyDB();
    console.log(`[Purge] Starting purge for survey ${surveyId}`);
    
    // 1. Delete measurements using cursor to avoid loading all into memory
    const measurementTx = db.transaction('measurements', 'readwrite');
    const measurementIndex = measurementTx.store.index('by-survey');
    let measurementCursor = await measurementIndex.openCursor(surveyId);
    
    while (measurementCursor) {
      await measurementCursor.delete();
      deleted.measurements++;
      measurementCursor = await measurementCursor.continue();
    }
    await measurementTx.done;
    console.log(`[Purge] Deleted ${deleted.measurements} measurements`);
    
    // 2. Delete vehicle traces
    if (db.objectStoreNames.contains('vehicleTraces')) {
      try {
        const traceTx = db.transaction('vehicleTraces', 'readwrite');
        const traceIndex = traceTx.store.index('by-survey');
        let traceCursor = await traceIndex.openCursor(surveyId);
        
        while (traceCursor) {
          await traceCursor.delete();
          deleted.traces++;
          traceCursor = await traceCursor.continue();
        }
        await traceTx.done;
        console.log(`[Purge] Deleted ${deleted.traces} vehicle traces`);
      } catch (e) {
        console.warn('[Purge] Vehicle traces cleanup skipped:', e);
      }
    }
    
    // 3. Delete alerts
    if (db.objectStoreNames.contains('alerts')) {
      try {
        const alertTx = db.transaction('alerts', 'readwrite');
        const alertIndex = alertTx.store.index('by-survey');
        let alertCursor = await alertIndex.openCursor(surveyId);
        
        while (alertCursor) {
          await alertCursor.delete();
          deleted.alerts++;
          alertCursor = await alertCursor.continue();
        }
        await alertTx.done;
        console.log(`[Purge] Deleted ${deleted.alerts} alerts`);
      } catch (e) {
        console.warn('[Purge] Alerts cleanup skipped:', e);
      }
    }
    
    // 4. Delete the survey record itself
    await db.delete('surveys', surveyId);
    deleted.survey = true;
    console.log(`[Purge] Deleted survey record`);
    
    console.log(`[Purge] Complete for survey ${surveyId}:`, deleted);
    
    return { success: true, deleted };
  } catch (error) {
    console.error('[Purge] Failed:', error);
    return { success: false, deleted, error: (error as Error).message };
  }
};

/**
 * IMPORT: Load a survey from a ZIP file saved on disk
 * Allows users to reload surveys that were previously exported
 * 
 * @param file - The ZIP file to import
 * @returns The imported survey ID and count of items
 */
export const importSurveyFromZip = async (file: File): Promise<{
  success: boolean;
  surveyId?: string;
  surveyName?: string;
  measurementCount?: number;
  error?: string;
}> => {
  try {
    console.log(`[Import] Starting import from ${file.name}`);
    toast.loading('Importing survey from ZIP...', { id: 'import-survey' });
    
    const zip = await JSZip.loadAsync(file);
    
    // Look for survey metadata in documents folder
    const metadataFile = zip.file('documents/survey_metadata.json') || zip.file('survey_metadata.json');
    if (!metadataFile) {
      throw new Error('Invalid survey package: missing survey_metadata.json');
    }
    
    const metadataJson = await metadataFile.async('text');
    const metadata = JSON.parse(metadataJson);
    
    if (!metadata.id) {
      throw new Error('Invalid survey metadata: missing survey ID');
    }
    
    const db = await openSurveyDB();
    
    // Check if survey already exists
    const existingSurvey = await db.get('surveys', metadata.id);
    if (existingSurvey) {
      throw new Error(`Survey "${metadata.name}" already exists in local database. Delete it first to reimport.`);
    }
    
    // Create survey record (mark as imported/inactive) with all required fields
    const importedSurvey: Survey = {
      id: metadata.id,
      name: metadata.name || 'Imported Survey',
      surveyTitle: metadata.surveyTitle || metadata.name || 'Imported Survey',
      surveyor: metadata.surveyor || '',
      surveyorName: metadata.surveyorName || metadata.surveyor || '',
      clientName: metadata.clientName || '',
      customerName: metadata.customerName || metadata.clientName || '',
      projectNumber: metadata.projectNumber || '',
      originAddress: metadata.originAddress || '',
      destinationAddress: metadata.destinationAddress || '',
      description: metadata.description || '',
      notes: metadata.notes || '',
      ownerEmail: metadata.ownerEmail || '',
      completionEmailList: metadata.completionEmailList || [],
      createdAt: metadata.createdAt || new Date().toISOString(),
      closedAt: metadata.closedAt,
      active: false, // Imported surveys are not active
      cloudUploadStatus: 'synced', // Already saved
      // Required fields with defaults
      enableVehicleTrace: metadata.enableVehicleTrace ?? false,
      enableAlertLog: metadata.enableAlertLog ?? false,
      syncId: metadata.syncId || null,
      exportTarget: metadata.exportTarget || null,
      convoyId: metadata.convoyId || null,
      fleetUnitRole: metadata.fleetUnitRole || null,
      plannedRouteId: metadata.plannedRouteId || null,
      routeAnalysis: metadata.routeAnalysis || null,
      aiUserModelId: metadata.aiUserModelId || null,
      aiHistoryScore: metadata.aiHistoryScore || null,
      interventionType: metadata.interventionType || null,
      checklistCompleted: metadata.checklistCompleted ?? false,
      // Import tracking
      importedAt: new Date().toISOString(),
      importedFrom: file.name
    };
    
    await db.put('surveys', importedSurvey);
    console.log(`[Import] Survey record created: ${metadata.id}`);
    
    // Import measurements from JSON if available
    let measurementCount = 0;
    const dataFile = zip.file('documents/survey_data.json') || zip.file('survey_data.json');
    
    if (dataFile) {
      const dataJson = await dataFile.async('text');
      const data = JSON.parse(dataJson);
      
      if (data.measurements && Array.isArray(data.measurements)) {
        // Import measurements in batches to avoid OOM
        const BATCH_SIZE = 50;
        const measurements = data.measurements;
        
        for (let i = 0; i < measurements.length; i += BATCH_SIZE) {
          const batch = measurements.slice(i, i + BATCH_SIZE);
          const tx = db.transaction('measurements', 'readwrite');
          
          for (const m of batch) {
            // Ensure measurement has required fields
            const measurement: Measurement = {
              ...m,
              id: m.id || `imported_${Date.now()}_${measurementCount}`,
              user_id: metadata.id, // Link to survey
              createdAt: m.createdAt || new Date().toISOString()
            };
            await tx.store.put(measurement);
            measurementCount++;
          }
          
          await tx.done;
          
          // Allow GC between batches
          await new Promise(resolve => setTimeout(resolve, 10));
          
          if (i % 200 === 0) {
            toast.loading(`Importing measurements... ${measurementCount}`, { id: 'import-survey' });
          }
        }
        
        console.log(`[Import] Imported ${measurementCount} measurements`);
      }
    }
    
    // Import road profiles if available
    const profilesFile = zip.file('documents/road_profiles.json');
    if (profilesFile) {
      try {
        const profilesJson = await profilesFile.async('text');
        const profiles = JSON.parse(profilesJson);
        
        if (Array.isArray(profiles)) {
          const tx = db.transaction('roadProfiles', 'readwrite');
          for (const p of profiles) {
            await tx.store.put(p);
          }
          await tx.done;
          console.log(`[Import] Imported ${profiles.length} road profiles`);
        }
      } catch (e) {
        console.warn('[Import] Road profiles import skipped:', e);
      }
    }
    
    /* toast removed */
    
    return {
      success: true,
      surveyId: metadata.id,
      surveyName: metadata.name,
      measurementCount
    };
    
  } catch (error) {
    console.error('[Import] Failed:', error);
    toast.error('Failed to import survey', {
      id: 'import-survey',
      description: (error as Error).message
    });
    return { success: false, error: (error as Error).message };
  }
};

/**
 * Get IndexedDB stats for the current origin
 * Useful for seeing what data exists before backup or cache clear
 */
export const getIndexedDBStats = async (): Promise<{
  origin: string;
  hostname: string;
  surveys: number;
  measurements: number;
  traces: number;
  alerts: number;
  profiles: number;
  estimatedSizeMB: number;
}> => {
  const db = await openSurveyDB();
  const origin = window.location.origin;
  const hostname = window.location.hostname;
  
  let surveys = 0, measurements = 0, traces = 0, alerts = 0, profiles = 0;
  
  try {
    surveys = await db.count('surveys');
  } catch {}
  
  try {
    measurements = await db.count('measurements');
  } catch {}
  
  try {
    if (db.objectStoreNames.contains('vehicleTraces')) {
      traces = await db.count('vehicleTraces');
    }
  } catch {}
  
  try {
    if (db.objectStoreNames.contains('alerts')) {
      alerts = await db.count('alerts');
    }
  } catch {}
  
  try {
    if (db.objectStoreNames.contains('roadProfiles')) {
      profiles = await db.count('roadProfiles');
    }
  } catch {}
  
  // Estimate size (rough: ~50KB per measurement with media, ~1KB for others)
  const estimatedSizeMB = Math.round((measurements * 50 + (surveys + traces + alerts + profiles) * 1) / 1024 * 10) / 10;
  
  const stats = { origin, hostname, surveys, measurements, traces, alerts, profiles, estimatedSizeMB };
  
  console.log('[IndexedDB Stats]', stats);
  return stats;
};

/**
 * Show IndexedDB stats in a toast notification
 */
export const showIndexedDBStats = async (): Promise<void> => {
  const stats = await getIndexedDBStats();
  /* toast removed */
};

/**
 * FULL DATABASE BACKUP: Export EVERYTHING from IndexedDB to a single backup ZIP
 * Uses streaming/chunked processing to avoid OOM errors
 * 
 * This exports ALL data regardless of which survey it belongs to:
 * - All surveys
 * - All measurements (in chunks to avoid OOM)
 * - All vehicle traces
 * - All alerts
 * - All road profiles
 * - All voice notes
 * - All routes
 * 
 * Use this before clearing cache to ensure no data is lost.
 */
export const exportFullDatabaseBackup = async (): Promise<{
  success: boolean;
  filename?: string;
  stats?: {
    surveys: number;
    measurements: number;
    traces: number;
    alerts: number;
    profiles: number;
    voiceNotes: number;
    routes: number;
  };
  error?: string;
}> => {
  const stats = {
    surveys: 0,
    measurements: 0,
    traces: 0,
    alerts: 0,
    profiles: 0,
    voiceNotes: 0,
    routes: 0
  };

  try {
    toast.loading('Preparing full database backup...', { id: 'full-backup' });
    console.log('[FullBackup] Starting full IndexedDB backup');

    const zip = new JSZip();
    const dataFolder = zip.folder('data');
    const mediaFolder = zip.folder('media');
    
    // Helper function to export a store using native IndexedDB (avoids transaction timeout)
    const exportStoreNative = async (dbName: string, storeName: string): Promise<any[]> => {
      return new Promise((resolve) => {
        const openReq = indexedDB.open(dbName);
        openReq.onerror = () => resolve([]); // Return empty if db doesn't exist
        openReq.onsuccess = () => {
          const nativeDb = openReq.result;
          
          // Check if store exists
          if (!nativeDb.objectStoreNames.contains(storeName)) {
            console.log(`[FullBackup] Store '${storeName}' not found in '${dbName}'`);
            nativeDb.close();
            resolve([]);
            return;
          }
          
          const tx = nativeDb.transaction(storeName, 'readonly');
          const store = tx.objectStore(storeName);
          const results: any[] = [];
          
          const cursorReq = store.openCursor();
          cursorReq.onsuccess = function(event: any) {
            const cursor = event.target.result;
            if (cursor) {
              const record = { ...cursor.value };
              
              // Extract media data URLs to separate files
              if (record.imageUrl && record.imageUrl.startsWith('data:')) {
                try {
                  const base64Data = record.imageUrl.split(',')[1];
                  if (base64Data) {
                    mediaFolder?.file(`${record.id}_image.jpg`, base64Data, { base64: true });
                  }
                } catch {}
                record.imageUrl = `[extracted:${record.id}_image.jpg]`;
              }
              if (record.videoUrl && record.videoUrl.startsWith('data:')) {
                try {
                  const base64Data = record.videoUrl.split(',')[1];
                  if (base64Data) {
                    mediaFolder?.file(`${record.id}_video.webm`, base64Data, { base64: true });
                  }
                } catch {}
                record.videoUrl = `[extracted:${record.id}_video.webm]`;
              }
              if (record.drawingUrl && record.drawingUrl.startsWith('data:')) {
                try {
                  const base64Data = record.drawingUrl.split(',')[1];
                  if (base64Data) {
                    mediaFolder?.file(`${record.id}_drawing.png`, base64Data, { base64: true });
                  }
                } catch {}
                record.drawingUrl = `[extracted:${record.id}_drawing.png]`;
              }
              
              results.push(record);
              cursor.continue(); // Synchronous - no await!
            } else {
              nativeDb.close();
              resolve(results);
            }
          };
          cursorReq.onerror = () => { nativeDb.close(); resolve([]); };
          tx.onerror = () => { nativeDb.close(); resolve([]); };
        };
      });
    };
    
    // Get list of all IndexedDB databases
    const dbList = await indexedDB.databases();
    console.log('[FullBackup] Found databases:', dbList.map(d => d.name));
    
    // Databases to check (both legacy and new, plus video recordings and asset storage)
    const databasesToBackup = ['measurepro-v2', 'measurepro', 'geo-video-recordings-db', 'poi-assets-db'];
    const allStoreData: Record<string, Record<string, any[]>> = {};
    
    for (const dbName of databasesToBackup) {
      // Check if this database exists
      const dbInfo = dbList.find(d => d.name === dbName);
      if (!dbInfo) {
        console.log(`[FullBackup] Database '${dbName}' not found, skipping`);
        continue;
      }
      
      toast.loading(`Backing up ${dbName}...`, { id: 'full-backup' });
      console.log(`[FullBackup] Opening database: ${dbName}`);
      
      // Open to discover stores
      const storeNames = await new Promise<string[]>((resolve) => {
        const openReq = indexedDB.open(dbName);
        openReq.onerror = () => resolve([]);
        openReq.onsuccess = () => {
          const db = openReq.result;
          const names = Array.from(db.objectStoreNames);
          db.close();
          resolve(names);
        };
      });
      
      console.log(`[FullBackup] Found stores in ${dbName}:`, storeNames);
      allStoreData[dbName] = {};
      
      // Export each store
      for (const storeName of storeNames) {
        toast.loading(`Backing up ${dbName}/${storeName}...`, { id: 'full-backup' });
        const records = await exportStoreNative(dbName, storeName);
        allStoreData[dbName][storeName] = records;
        
        // Update stats based on store name
        if (storeName === 'surveys') stats.surveys += records.length;
        else if (storeName === 'measurements') stats.measurements += records.length;
        else if (storeName === 'vehicleTraces') stats.traces += records.length;
        else if (storeName === 'alerts') stats.alerts += records.length;
        else if (storeName === 'roadProfiles') stats.profiles += records.length;
        else if (storeName === 'voiceNotes') stats.voiceNotes += records.length;
        else if (storeName === 'routes') stats.routes += records.length;
        
        console.log(`[FullBackup] Exported ${records.length} records from ${dbName}/${storeName}`);
        
        // Write to ZIP (chunk large stores)
        if (records.length > 100) {
          const CHUNK_SIZE = 50;
          const chunkFiles: string[] = [];
          for (let i = 0; i < records.length; i += CHUNK_SIZE) {
            const chunk = records.slice(i, i + CHUNK_SIZE);
            const chunkFilename = `${dbName}/${storeName}_chunk_${String(chunkFiles.length).padStart(4, '0')}.json`;
            dataFolder?.file(chunkFilename, JSON.stringify(chunk));
            chunkFiles.push(chunkFilename);
          }
          dataFolder?.file(`${dbName}/${storeName}_manifest.json`, JSON.stringify({
            total: records.length,
            chunkFiles,
            chunkSize: CHUNK_SIZE
          }, null, 2));
        } else {
          dataFolder?.file(`${dbName}/${storeName}.json`, JSON.stringify(records, null, 2));
        }
      }
    }

    // Create backup manifest with origin info
    const origin = window.location.origin;
    const hostname = window.location.hostname;
    const manifest = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      origin: origin,
      hostname: hostname,
      deviceInfo: navigator.userAgent,
      stats,
      databases: Object.keys(allStoreData),
      storesByDatabase: Object.fromEntries(
        Object.entries(allStoreData).map(([db, stores]) => [
          db,
          Object.keys(stores)
        ])
      )
    };
    zip.file('backup_manifest.json', JSON.stringify(manifest, null, 2));

    // Generate ZIP
    toast.loading('Generating backup file...', { id: 'full-backup' });
    console.log('[FullBackup] Generating ZIP blob...');
    const zipBlob = await zip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    // Save to disk with origin-identifying filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const safeHostname = hostname.replace(/[^a-zA-Z0-9-]/g, '_').substring(0, 30);
    const filename = `measurepro-backup-${safeHostname}-${timestamp}.zip`;
    await downloadFile(zipBlob, filename, 'application/zip');

    /* toast removed */

    console.log('[FullBackup] Complete:', stats);
    return { success: true, filename, stats };

  } catch (error) {
    console.error('[FullBackup] Failed:', error);
    toast.error('Full backup failed', {
      id: 'full-backup',
      description: (error as Error).message
    });
    return { success: false, error: (error as Error).message };
  }
};

/**
 * Restore a full database backup from ZIP
 * Imports all data back into IndexedDB
 */
export const restoreFullDatabaseBackup = async (file: File): Promise<{
  success: boolean;
  stats?: {
    surveys: number;
    measurements: number;
    traces: number;
    alerts: number;
    profiles: number;
  };
  error?: string;
}> => {
  const stats = {
    surveys: 0,
    measurements: 0,
    traces: 0,
    alerts: 0,
    profiles: 0
  };

  try {
    toast.loading('Restoring from backup...', { id: 'restore-backup' });
    console.log(`[Restore] Starting restore from ${file.name}`);

    const zip = await JSZip.loadAsync(file);
    
    // Check manifest
    const manifestFile = zip.file('backup_manifest.json');
    if (!manifestFile) {
      throw new Error('Invalid backup file: missing manifest');
    }
    
    const manifest = JSON.parse(await manifestFile.async('text'));
    console.log('[Restore] Backup manifest:', manifest);

    const db = await openSurveyDB();

    // 1. Restore surveys
    const surveysFile = zip.file('data/surveys.json');
    if (surveysFile) {
      const surveys = JSON.parse(await surveysFile.async('text'));
      for (const survey of surveys) {
        const existing = await db.get('surveys', survey.id);
        if (!existing) {
          await db.put('surveys', survey);
          stats.surveys++;
        }
      }
      console.log(`[Restore] Restored ${stats.surveys} surveys`);
    }

    // 2. Restore measurements from chunks
    const measurementManifestFile = zip.file('data/measurements_manifest.json');
    if (measurementManifestFile) {
      const measurementManifest = JSON.parse(await measurementManifestFile.async('text'));
      
      for (const chunkFilename of measurementManifest.chunkFiles) {
        const chunkFile = zip.file(`data/${chunkFilename}`);
        if (chunkFile) {
          const measurements = JSON.parse(await chunkFile.async('text'));
          
          const tx = db.transaction('measurements', 'readwrite');
          for (const m of measurements) {
            const existing = await tx.store.get(m.id);
            if (!existing) {
              await tx.store.put(m);
              stats.measurements++;
            }
          }
          await tx.done;
        }
        
        // Progress update
        if (stats.measurements % 500 === 0) {
          toast.loading(`Restoring measurements... ${stats.measurements}`, { id: 'restore-backup' });
        }
        
        // Allow GC
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      console.log(`[Restore] Restored ${stats.measurements} measurements`);
    }

    // 3. Restore vehicle traces
    const tracesFile = zip.file('data/vehicleTraces.json');
    if (tracesFile && db.objectStoreNames.contains('vehicleTraces')) {
      const traces = JSON.parse(await tracesFile.async('text'));
      for (const trace of traces) {
        try {
          await db.put('vehicleTraces', trace);
          stats.traces++;
        } catch {}
      }
      console.log(`[Restore] Restored ${stats.traces} vehicle traces`);
    }

    // 4. Restore alerts
    const alertsFile = zip.file('data/alerts.json');
    if (alertsFile && db.objectStoreNames.contains('alerts')) {
      const alerts = JSON.parse(await alertsFile.async('text'));
      for (const alert of alerts) {
        try {
          await db.put('alerts', alert);
          stats.alerts++;
        } catch {}
      }
      console.log(`[Restore] Restored ${stats.alerts} alerts`);
    }

    // 5. Restore road profiles
    const profilesFile = zip.file('data/roadProfiles.json');
    if (profilesFile && db.objectStoreNames.contains('roadProfiles')) {
      const profiles = JSON.parse(await profilesFile.async('text'));
      for (const profile of profiles) {
        try {
          await db.put('roadProfiles', profile);
          stats.profiles++;
        } catch {}
      }
      console.log(`[Restore] Restored ${stats.profiles} road profiles`);
    }

    /* toast removed */

    console.log('[Restore] Complete:', stats);
    return { success: true, stats };

  } catch (error) {
    console.error('[Restore] Failed:', error);
    toast.error('Restore failed', {
      id: 'restore-backup',
      description: (error as Error).message
    });
    return { success: false, error: (error as Error).message };
  }
};