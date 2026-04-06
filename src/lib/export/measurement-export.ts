import { MeasurementRecord } from '@/types/measurements';

export function exportToCSV(measurements: MeasurementRecord[]): void {
  if (measurements.length === 0) {
    return;
  }

  const headers = [
    'Date',
    'Time',
    'Structure Type',
    'Clearance (Camera)',
    'Clearance (Laser)',
    'Clearance (Final)',
    'Confidence',
    'Compliance Level',
    'Latitude',
    'Longitude',
    'Notes'
  ];

  const rows = measurements.map(m => {
    const date = new Date(m.timestamp);
    
    return [
      date.toISOString().split('T')[0],
      date.toISOString().split('T')[1].split('.')[0],
      m.structureType,
      m.verticalClearance.camera?.value.toFixed(3) || '--',
      m.verticalClearance.laser?.value.toFixed(3) || '--',
      m.verticalClearance.validated?.value.toFixed(3) || '--',
      m.verticalClearance.validated?.confidence.toFixed(2) || m.verticalClearance.camera?.confidence.toFixed(2) || '--',
      m.complianceLevel || '--',
      m.location.lat?.toFixed(6) || '--',
      m.location.lon?.toFixed(6) || '--',
      `"${m.notes.replace(/"/g, '""')}"`
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `survey_measurements_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToJSON(measurements: MeasurementRecord[]): void {
  if (measurements.length === 0) {
    return;
  }

  const jsonContent = JSON.stringify(measurements, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `survey_measurements_${new Date().toISOString().split('T')[0]}.json`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToGeoJSON(measurements: MeasurementRecord[]): void {
  const features = measurements
    .filter(m => m.location.lat !== null && m.location.lon !== null)
    .map(m => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [m.location.lon, m.location.lat]
      },
      properties: {
        id: m.id,
        timestamp: m.timestamp,
        structureType: m.structureType,
        clearance: m.verticalClearance.validated?.value || m.verticalClearance.camera?.value || null,
        complianceLevel: m.complianceLevel,
        notes: m.notes
      }
    }));

  const geoJSON = {
    type: 'FeatureCollection',
    features
  };

  const jsonContent = JSON.stringify(geoJSON, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/geo+json;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `survey_measurements_${new Date().toISOString().split('T')[0]}.geojson`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
