/**
 * GeoJSON Export Writer
 * Alignment LineString and Profile features for GIS tools
 */

import type { Alignment, LinkedProfile } from '@/lib/alignment/types';
import type { ExportOptions, ExportResult, ExportSample } from '../types';
import { transformCoordinates, isProjectedCRS } from '../utils/crs';
import { samplesToExportSamples, resampleProfile } from '../utils/sampling';
import { getGradeClass, getGradeColor, getGradeTier } from '../utils/gradeColor';

interface GeoJSONFeature {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry: {
    type: string;
    coordinates: unknown;
  };
}

interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
  crs?: {
    type: string;
    properties: {
      name: string;
    };
  };
}

export function exportAlignmentAsGeoJSON(
  alignment: Alignment,
  options: ExportOptions
): ExportResult {
  const coordinates = alignment.polyline.map(p => [p.lon, p.lat] as [number, number]);
  const transformedCoords = transformCoordinates(coordinates, 'EPSG:4326', options.crs);

  const feature: GeoJSONFeature = {
    type: 'Feature',
    properties: {
      id: alignment.id,
      name: alignment.name,
      projectId: alignment.projectId,
      length_m: alignment.cumDistM[alignment.cumDistM.length - 1] || 0,
      vertexCount: alignment.polyline.length,
      createdAt: alignment.createdAt,
      createdBy: alignment.createdBy,
    },
    geometry: {
      type: 'LineString',
      coordinates: transformedCoords,
    },
  };

  const collection: GeoJSONFeatureCollection = {
    type: 'FeatureCollection',
    features: [feature],
  };

  if (options.crs !== 'EPSG:4326') {
    collection.crs = {
      type: 'name',
      properties: {
        name: options.crs,
      },
    };
  }

  const blob = new Blob([JSON.stringify(collection, null, 2)], { type: 'application/geo+json' });
  const filename = `${alignment.name.replace(/[^a-zA-Z0-9]/g, '_')}_alignment.geojson`;

  return {
    format: 'geojson',
    filename,
    blob,
    mimeType: 'application/geo+json',
  };
}

export function exportProfileAsGeoJSON(
  alignment: Alignment,
  profile: LinkedProfile,
  options: ExportOptions
): ExportResult {
  let samples = options.samplingMode === 'resample' && options.resampleInterval_m
    ? resampleProfile(profile.samples, options.resampleInterval_m, alignment.id, profile.id, profile.projectId)
    : samplesToExportSamples(profile.samples, alignment.id, profile.id, profile.projectId);

  const includeGrade = options.includeGradeColor === true;
  const features: GeoJSONFeature[] = [];

  const getCoord = (s: ExportSample): [number, number] => {
    if (isProjectedCRS(options.crs)) {
      return transformCoordinates([[s.lon_deg, s.lat_deg]], 'EPSG:4326', options.crs)[0] as [number, number];
    }
    return [s.lon_deg, s.lat_deg];
  };

  const getCoordWithAlt = (s: ExportSample): number[] => {
    const [x, y] = getCoord(s);
    const alt = getAltitude(s, options.altitudeMode);
    return alt !== null ? [x, y, alt] : [x, y];
  };

  if (includeGrade && samples.length > 1) {
    // Emit one LineString feature per segment (i → i+1), each coloured by the grade class
    // at point i. Every segment gets its own feature — no run-merging.
    for (let i = 0; i < samples.length - 1; i++) {
      const s1 = samples[i];
      const s2 = samples[i + 1];
      const tier = getGradeTier(s1.grade_pct);

      features.push({
        type: 'Feature',
        properties: {
          featureType: 'gradeSegment',
          segment_index: i,
          grade_class: tier.cls,
          grade_color: tier.hex,
          'stroke': tier.hex,
          'stroke-width': 3,
          'stroke-opacity': 1,
          station_start_km: s1.station_km,
          station_end_km: s2.station_km,
        },
        geometry: {
          type: 'LineString',
          coordinates: [getCoordWithAlt(s1), getCoordWithAlt(s2)],
        },
      });
    }
  } else {
    // Single polyline without grade colouring
    const lineCoords = samples.map(getCoordWithAlt);

    features.push({
      type: 'Feature',
      properties: {
        id: profile.id,
        name: profile.name,
        alignmentId: profile.alignmentId,
        sampleCount: samples.length,
        featureType: 'profileLine',
      },
      geometry: {
        type: 'LineString',
        coordinates: lineCoords,
      },
    });
  }

  // Point features always emitted (with optional grade colour properties)
  samples.forEach((s, idx) => {
    const [x, y] = getCoord(s);
    const alt = getAltitude(s, options.altitudeMode);

    const props: Record<string, unknown> = {
      index: idx,
      station_m: s.station_m,
      station_km: s.station_km,
      altitude_m: alt,
      grade_pct: s.grade_pct,
      speed_mps: s.speed_mps,
      heading_deg: s.heading_deg,
      timestamp: s.timestamp_utc,
      featureType: 'profilePoint',
      crossSlope_deg: s.crossSlope_deg,
      bankingAlert: s.bankingAlert,
      curveRadius_m: s.curveRadius_m,
      radiusAlert: s.radiusAlert,
    };

    if (includeGrade) {
      props['grade_class'] = getGradeClass(s.grade_pct);
      props['grade_color'] = getGradeColor(s.grade_pct);
      props['marker-color'] = getGradeColor(s.grade_pct);
    }

    features.push({
      type: 'Feature',
      properties: props,
      geometry: {
        type: 'Point',
        coordinates: alt !== null ? [x, y, alt] : [x, y],
      },
    });
  });

  const collection: GeoJSONFeatureCollection = {
    type: 'FeatureCollection',
    features,
  };

  if (options.crs !== 'EPSG:4326') {
    collection.crs = {
      type: 'name',
      properties: {
        name: options.crs,
      },
    };
  }

  const blob = new Blob([JSON.stringify(collection, null, 2)], { type: 'application/geo+json' });
  const filename = `${profile.name.replace(/[^a-zA-Z0-9]/g, '_')}_profile.geojson`;

  return {
    format: 'geojson',
    filename,
    blob,
    mimeType: 'application/geo+json',
  };
}

function getAltitude(
  sample: { altitude_raw_m: number | null; altitude_selected_m: number | null; altitude_corrected_m: number | null },
  mode: 'raw' | 'selected' | 'corrected' | 'all'
): number | null {
  switch (mode) {
    case 'raw': return sample.altitude_raw_m;
    case 'selected': return sample.altitude_selected_m;
    case 'corrected':
    case 'all':
    default: return sample.altitude_corrected_m;
  }
}
