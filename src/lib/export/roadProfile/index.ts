/**
 * Road Profile Export Orchestrator
 * Main entry point for Survey + Engineering Export pipeline
 */

import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { Alignment, LinkedProfile } from '@/lib/alignment/types';
import type { ExportOptions, ExportResult, ExportMetadata } from './types';
import { exportProfileAsCSV } from './formats/csv';
import { exportAlignmentAsGeoJSON, exportProfileAsGeoJSON } from './formats/geojson';
import { exportAsDXF } from './formats/dxf';
import { exportAsLandXML } from './formats/landxml';
import { exportAsShapefile } from './formats/shapefile';
import { exportAsKML, exportAsKMZ } from './formats/kml';
import { exportAsGPX } from './formats/gpx';
import { generateExportMetadata, generateManifest } from './utils/metadata';
import { initializeCRS, registerCustomCRS } from './utils/crs';

export * from './types';
export { initializeCRS, registerCustomCRS } from './utils/crs';

export async function exportLinkedSet(
  alignment: Alignment,
  profile: LinkedProfile,
  options: ExportOptions
): Promise<ExportResult[]> {
  initializeCRS();

  if (options.customProj4 && options.crs !== 'EPSG:4326' && options.crs !== 'EPSG:3857') {
    registerCustomCRS(options.crs, options.customProj4);
  }

  const results: ExportResult[] = [];
  const warnings: string[] = [];

  for (const format of options.formats) {
    try {
      switch (format) {
        case 'csv':
          results.push(exportProfileAsCSV(alignment, profile, options));
          break;
        case 'geojson':
          results.push(exportAlignmentAsGeoJSON(alignment, options));
          results.push(exportProfileAsGeoJSON(alignment, profile, options));
          break;
        case 'shapefile':
          results.push(await exportAsShapefile(alignment, profile, options));
          break;
        case 'dxf':
          results.push(exportAsDXF(alignment, profile, options));
          break;
        case 'landxml':
          results.push(exportAsLandXML(alignment, profile, options));
          break;
        case 'kml':
          results.push(exportAsKML(alignment, profile, options));
          break;
        case 'kmz':
          results.push(await exportAsKMZ(alignment, profile, options));
          break;
        case 'gpx':
          results.push(exportAsGPX(alignment, profile, options));
          break;
        case 'zip':
          results.push(await exportAsZipBundle(alignment, profile, options, warnings));
          break;
      }
    } catch (error) {
      console.error(`[Export] Failed to export ${format}:`, error);
      warnings.push(`Failed to export ${format}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return results;
}

export async function exportAsZipBundle(
  alignment: Alignment,
  profile: LinkedProfile,
  options: ExportOptions,
  warnings: string[] = []
): Promise<ExportResult> {
  initializeCRS();

  const zip = new JSZip();
  const includedFiles: string[] = [];

  const csvResult = exportProfileAsCSV(alignment, profile, options);
  zip.file('profile.csv', csvResult.blob);
  includedFiles.push('profile.csv');

  const alignmentGeoJSON = exportAlignmentAsGeoJSON(alignment, options);
  zip.file('alignment.geojson', alignmentGeoJSON.blob);
  includedFiles.push('alignment.geojson');

  const profileGeoJSON = exportProfileAsGeoJSON(alignment, profile, options);
  zip.file('profile.geojson', profileGeoJSON.blob);
  includedFiles.push('profile.geojson');

  try {
    const dxfResult = exportAsDXF(alignment, profile, options);
    zip.file('profile.dxf', dxfResult.blob);
    includedFiles.push('profile.dxf');
  } catch (e) {
    console.warn('[Export] DXF generation failed:', e);
    warnings.push('DXF export failed');
  }

  try {
    const landxmlResult = exportAsLandXML(alignment, profile, options);
    zip.file('export.xml', landxmlResult.blob);
    includedFiles.push('export.xml');
  } catch (e) {
    console.warn('[Export] LandXML generation failed:', e);
    warnings.push('LandXML export failed');
  }

  try {
    const kmlResult = exportAsKML(alignment, profile, options);
    zip.file('profile.kml', kmlResult.blob);
    includedFiles.push('profile.kml');
  } catch (e) {
    console.warn('[Export] KML generation failed:', e);
    warnings.push('KML export failed');
  }

  try {
    const gpxResult = exportAsGPX(alignment, profile, options);
    zip.file('profile.gpx', gpxResult.blob);
    includedFiles.push('profile.gpx');
  } catch (e) {
    console.warn('[Export] GPX generation failed:', e);
    warnings.push('GPX export failed');
  }

  const metadata = generateExportMetadata(alignment, profile, options, warnings);
  zip.file('metadata.json', JSON.stringify(metadata, null, 2));
  includedFiles.push('metadata.json');

  const manifest = generateManifest(alignment, profile, includedFiles);
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  includedFiles.push('manifest.json');

  const alignmentData = {
    ...alignment,
    __type: 'Alignment',
  };
  zip.file('alignment.json', JSON.stringify(alignmentData, null, 2));
  includedFiles.push('alignment.json');

  const profileData = {
    ...profile,
    __type: 'LinkedProfile',
  };
  zip.file('profile_data.json', JSON.stringify(profileData, null, 2));
  includedFiles.push('profile_data.json');

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const filename = `${alignment.name.replace(/[^a-zA-Z0-9]/g, '_')}_export_${Date.now()}.zip`;

  return {
    format: 'zip',
    filename,
    blob,
    mimeType: 'application/zip',
  };
}

export function downloadExportResult(result: ExportResult): void {
  saveAs(result.blob, result.filename);
}

export async function downloadAllExportResults(results: ExportResult[]): Promise<void> {
  for (const result of results) {
    saveAs(result.blob, result.filename);
    await new Promise(resolve => setTimeout(resolve, 300));
  }
}

export interface ZipImportResult {
  alignment: Alignment;
  profile: LinkedProfile;
  metadata: ExportMetadata | null;
  warnings: string[];
}

export async function importFromZip(file: File): Promise<ZipImportResult> {
  const zip = await JSZip.loadAsync(file);
  const warnings: string[] = [];

  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) {
    throw new Error('Invalid export bundle: manifest.json not found');
  }

  const manifest = JSON.parse(await manifestFile.async('string'));
  if (manifest.type !== 'MeasurePRO_LinkedSet') {
    warnings.push('Bundle may not be a valid MeasurePRO export');
  }

  const alignmentFile = zip.file('alignment.json');
  if (!alignmentFile) {
    throw new Error('Invalid export bundle: alignment.json not found');
  }
  const alignmentData = JSON.parse(await alignmentFile.async('string'));
  delete alignmentData.__type;
  const alignment = alignmentData as Alignment;

  const profileFile = zip.file('profile_data.json');
  if (!profileFile) {
    throw new Error('Invalid export bundle: profile_data.json not found');
  }
  const profileData = JSON.parse(await profileFile.async('string'));
  delete profileData.__type;
  const profile = profileData as LinkedProfile;

  let metadata: ExportMetadata | null = null;
  const metadataFile = zip.file('metadata.json');
  if (metadataFile) {
    metadata = JSON.parse(await metadataFile.async('string')) as ExportMetadata;
  }

  return {
    alignment,
    profile,
    metadata,
    warnings,
  };
}
