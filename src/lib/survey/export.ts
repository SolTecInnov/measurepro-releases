import { toast } from 'sonner';
import { initCSVBackupDB, openSurveyDB } from './db';
import { exportSurveyToGeoJSON } from '../utils/exportUtils';
import { Survey } from './types';
import { onSurveyExport } from '@/lib/firebase/autoSync';

// Generate CSV from measurements array
export const generateCSV = async (measurements: any[]): Promise<string> => {
  const headers = [
    'Date',
    'Time',
    'Height (m)',
    'Ground Ref (m)',
    'GPS Alt (m)',
    'Latitude',
    'Longitude',
    'Speed (km/h)',
    'Heading (°)',
    'Road Number',
    'POI Number',
    'POI Type',
    'Note',
    'Source'
  ].join(',');
  
  const rows = measurements.map(m => [
    m.utcDate,
    m.utcTime,
    m.rel.toFixed(3),
    (m.groundRef || 0).toFixed(3),
    m.altGPS.toFixed(1),
    m.latitude.toFixed(6),
    m.longitude.toFixed(6),
    m.speed.toFixed(1),
    m.heading.toFixed(1),
    m.roadNumber || '',
    m.poiNumber || '',
    m.poi_type || '',
    (m.note || '').replace(/,/g, ';'), // Replace commas in notes to avoid CSV issues
    m.source || 'manual'
  ].join(','));
  
  return [headers, ...rows].join('\n');
};

// Generate JSON from measurements array
export const generateJSON = async (measurements: any[]): Promise<string> => {
  return JSON.stringify(measurements, null, 2);
};

/**
 * Export orphaned measurements separately
 */
export const exportOrphanedMeasurements = async (format: 'csv' | 'json' | 'geojson'): Promise<string> => {
  const db = await openSurveyDB();
  
  // Get all measurements and surveys
  const allMeasurements = await db.getAll('measurements');
  const surveys = await db.getAll('surveys');
  const surveyIds = new Set(surveys.map(s => s.id));
  
  // Find orphaned measurements (measurements with no matching survey)
  const orphanedMeasurements = allMeasurements.filter(m => !surveyIds.has(m.user_id));
  
  if (format === 'csv') {
    return generateCSV(orphanedMeasurements);
  }
  
  if (format === 'json') {
    return generateJSON(orphanedMeasurements);
  }
  
  if (format === 'geojson') {
    const features = orphanedMeasurements.map(m => ({
      type: 'Feature',
      properties: {
        id: m.id,
        height: m.rel,
        groundRef: m.groundRef || 0,
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
        orphanedSurveyId: m.user_id // Track which survey this belonged to
      },
      geometry: {
        type: 'Point',
        coordinates: [m.longitude, m.latitude]
      }
    }));
    
    return JSON.stringify({
      type: 'FeatureCollection',
      features
    }, null, 2);
  }
  
  throw new Error(`Unsupported export format: ${format}`);
};

export const exportSurveyData = async (surveyId: string, format: 'csv' | 'json' | 'geojson', includeOrphaned: boolean = false): Promise<string> => {
  const db = await openSurveyDB();
  
  // Get all measurements for this survey
  const measurements = await db.getAllFromIndex('measurements', 'by-date');
  let surveyMeasurements = measurements.filter(m => m.user_id === surveyId);
  
  // If including orphaned data, add a separate section
  if (includeOrphaned) {
    const surveys = await db.getAll('surveys');
    const surveyIds = new Set(surveys.map(s => s.id));
    const orphanedMeasurements = measurements.filter(m => !surveyIds.has(m.user_id));
    
    if (orphanedMeasurements.length > 0) {
      // Mark orphaned measurements for identification
      const markedOrphaned = orphanedMeasurements.map(m => ({
        ...m,
        note: `[ORPHANED from ${m.user_id}] ${m.note || ''}`
      }));
      surveyMeasurements = [...surveyMeasurements, ...markedOrphaned];
    }
  }
  
  if (format === 'csv') {
    const headers = [
      'Date',
      'Time',
      'Height (m)',
      'Ground Ref (m)',
      'GPS Alt (m)',
      'Latitude',
      'Longitude',
      'Speed (km/h)',
      'Heading (°)',
      'Road Number',
      'POI Number',
      'POI Type',
      'Note',
      'Source'
    ].join(',');
    
    const rows = surveyMeasurements.map(m => [
      m.utcDate,
      m.utcTime,
      m.rel.toFixed(3),
      (m.groundRef || 0).toFixed(3),
      m.altGPS.toFixed(1),
      m.latitude.toFixed(6),
      m.longitude.toFixed(6),
      m.speed.toFixed(1),
      m.heading.toFixed(1),
      m.roadNumber || '',
      m.poiNumber || '',
      m.poi_type || '',
      (m.note || '').replace(/,/g, ';'), // Replace commas in notes to avoid CSV issues
      m.source || 'manual'
    ].join(','));
    
    return [headers, ...rows].join('\n');
  }
  
  if (format === 'json') {
    return JSON.stringify(surveyMeasurements, null, 2);
  }
  
  if (format === 'geojson') {
    const features = surveyMeasurements.map(m => ({
      type: 'Feature',
      properties: {
        id: m.id,
        height: m.rel,
        groundRef: m.groundRef || 0,
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
        videoUrl: m.videoUrl
      },
      geometry: {
        type: 'Point',
        coordinates: [m.longitude, m.latitude]
      }
    }));
    
    return JSON.stringify({
      type: 'FeatureCollection',
      features
    }, null, 2);
  }
  
  throw new Error(`Unsupported export format: ${format}`);
};

export const exportSurveyFunction = async (activeSurvey: Survey | null, format: 'csv' | 'json' | 'geojson', silent: boolean = false) => {
  if (!activeSurvey) {
    if (!silent) toast.error('No active survey to export');
    return;
  }
  
  // Use the enhanced GeoJSON export with media for geojson format
  if (format === 'geojson') {
    try {
      // For regular GeoJSON export (without media)
      const geoJsonData = await exportSurveyToGeoJSON(activeSurvey.id);
      
      // Create download link
      const blob = new Blob([geoJsonData], { type: 'application/json' });
      
      // Get custom filename from localStorage if available
      const customFilename = localStorage.getItem('autoSaveFilename') || 'survey-export';
      
      const filename = `${customFilename}-${activeSurvey.surveyTitle?.toLowerCase().replace(/[^a-z0-9]/g, '-') || activeSurvey.id}-${new Date().toISOString().split('T')[0]}.geojson`;
      
      // Create and trigger download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      if (!silent) {
        toast.success(`Survey exported as GeoJSON`, {
          description: `File saved as ${filename}`
        });
      }
      
      try {
        await onSurveyExport(activeSurvey);
      } catch (syncError) {
        console.error('[Export] Failed to trigger Firebase sync:', syncError);
      }
      
      return;
    } catch (error) {
      if (!silent) {
        toast.error('Failed to export survey as GeoJSON', {
          description: error instanceof Error ? error.message : String(error)
        });
      }
      return;
    }
  }
  
  try {
    // Try to get CSV data from localStorage first
    const storageKey = `survey_csv_${activeSurvey.id}`;
    let csvData = localStorage.getItem(storageKey);
    
    // If not found in localStorage, try to get from IndexedDB backup
    if (!csvData) {
      try {
        const csvDb = await initCSVBackupDB();
        csvData = await csvDb.get('csv-data', activeSurvey.id);
      } catch (error) {
      }
    }
    
    // If still not found, generate from measurements
    if (!csvData || format !== 'csv') {
      const data = await exportSurveyData(activeSurvey.id, format);
      
      // Create download link
      const blob = new Blob([data], { type: format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/json' });
      
      // Get custom filename from localStorage if available
      const customFilename = localStorage.getItem('autoSaveFilename') || 'survey-export';
      
      const filename = `${customFilename}-${activeSurvey.surveyTitle?.toLowerCase().replace(/[^a-z0-9]/g, '-') || activeSurvey.id}-${new Date().toISOString().split('T')[0]}.${format}`;
      
      // Create and trigger download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
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
        toast.success(`Survey exported as ${format.toUpperCase()}`, {
          description: `File saved as ${filename}`
        });
      }
    } else {
      // Use the CSV data from storage
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      
      // Get custom filename from localStorage if available
      const customFilename = localStorage.getItem('autoSaveFilename') || 'survey-autosave';
      const surveyName = activeSurvey.surveyTitle || activeSurvey.name || activeSurvey.id;
      const timestamp = new Date().toISOString().split('T')[0];
      
      const filename = `${customFilename}-${surveyName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${timestamp}.${format}`;
      
      // Create and trigger download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
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
        toast.success(`Survey exported as ${format.toUpperCase()}`, {
          description: `File saved as ${filename}`
        });
      }
    }
    
    try {
      await onSurveyExport(activeSurvey);
    } catch (syncError) {
      console.error('[Export] Failed to trigger Firebase sync:', syncError);
    }
  } catch (error) {
    if (!silent) {
      toast.error('Failed to export survey', {
        description: error instanceof Error ? error.message : String(error)
      });
    }
  }
};