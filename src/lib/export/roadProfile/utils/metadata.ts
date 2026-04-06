/**
 * Export Metadata Generation
 * Creates comprehensive metadata.json for export bundles
 */

import type { Alignment, LinkedProfile } from '@/lib/alignment/types';
import type { ExportMetadata, ExportOptions } from '../types';
import { getCRSName } from './crs';

const APP_VERSION = '1.0.0';

export function generateExportMetadata(
  alignment: Alignment,
  profile: LinkedProfile,
  options: ExportOptions,
  warnings: string[] = []
): ExportMetadata {
  const sortedSamples = [...profile.samples].sort((a, b) => a.s_m - b.s_m);
  const firstSample = sortedSamples[0];
  const lastSample = sortedSamples[sortedSamples.length - 1];

  return {
    appVersion: APP_VERSION,
    buildVersion: profile.metadata.buildVersion,
    exportedAt: new Date().toISOString(),
    deviceId: profile.metadata.deviceId || null,
    mountName: profile.metadata.mountName || null,
    project: {
      id: profile.projectId,
    },
    alignment: {
      id: alignment.id,
      name: alignment.name,
      length_m: alignment.cumDistM[alignment.cumDistM.length - 1] || 0,
      vertexCount: alignment.polyline.length,
      createdAt: alignment.createdAt,
      createdBy: alignment.createdBy,
    },
    profile: {
      id: profile.id,
      name: profile.name,
      sampleCount: profile.samples.length,
      timestampRange: {
        start: firstSample?.time || '',
        end: lastSample?.time || '',
      },
    },
    calibration: {
      altitudeStrategy: profile.metadata.altitudeStrategy,
      altitudeOffsetM: profile.metadata.altitudeOffsetM,
      axisMapping: profile.metadata.axisMapping,
    },
    crs: {
      code: options.crs,
      name: getCRSName(options.crs),
    },
    processing: {
      samplingMode: options.samplingMode,
      resampleInterval_m: options.resampleInterval_m,
      altitudeMode: options.altitudeMode,
      smoothingApplied: false,
    },
    warnings,
  };
}

export function generateManifest(
  alignment: Alignment,
  profile: LinkedProfile,
  includedFiles: string[]
): object {
  return {
    version: '2.0.0',
    type: 'MeasurePRO_LinkedSet',
    createdAt: new Date().toISOString(),
    alignment: {
      id: alignment.id,
      name: alignment.name,
    },
    profile: {
      id: profile.id,
      name: profile.name,
      alignmentId: profile.alignmentId,
    },
    files: includedFiles,
  };
}
