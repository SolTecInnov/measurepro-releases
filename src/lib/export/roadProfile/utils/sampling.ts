/**
 * Sampling Utilities
 * Resampling and interpolation for profile data
 */

import type { LinkedProfileSample } from '@/lib/alignment/types';
import type { ExportSample } from '../types';

export function resampleProfile(
  samples: LinkedProfileSample[],
  interval_m: number,
  alignmentId: string,
  profileId: string,
  projectId: string
): ExportSample[] {
  if (samples.length === 0) return [];

  const sorted = [...samples].sort((a, b) => a.s_m - b.s_m);
  const startStation = sorted[0].s_m;
  const endStation = sorted[sorted.length - 1].s_m;

  const resampled: ExportSample[] = [];

  for (let s = startStation; s <= endStation; s += interval_m) {
    const interpolated = interpolateSampleAtStation(sorted, s);
    if (interpolated) {
      resampled.push(convertToExportSample(interpolated, alignmentId, profileId, projectId));
    }
  }

  return resampled;
}

export function interpolateSampleAtStation(
  sortedSamples: LinkedProfileSample[],
  targetStation: number
): LinkedProfileSample | null {
  if (sortedSamples.length === 0) return null;
  if (sortedSamples.length === 1) return sortedSamples[0];

  if (targetStation <= sortedSamples[0].s_m) {
    return sortedSamples[0];
  }
  if (targetStation >= sortedSamples[sortedSamples.length - 1].s_m) {
    return sortedSamples[sortedSamples.length - 1];
  }

  let before = sortedSamples[0];
  let after = sortedSamples[sortedSamples.length - 1];

  for (let i = 0; i < sortedSamples.length - 1; i++) {
    if (sortedSamples[i].s_m <= targetStation && sortedSamples[i + 1].s_m >= targetStation) {
      before = sortedSamples[i];
      after = sortedSamples[i + 1];
      break;
    }
  }

  const range = after.s_m - before.s_m;
  if (range === 0) return before;

  const t = (targetStation - before.s_m) / range;

  return {
    s_m: targetStation,
    lat: before.lat + t * (after.lat - before.lat),
    lon: before.lon + t * (after.lon - before.lon),
    time: before.time,
    altitude_raw_m: interpolateNullable(before.altitude_raw_m, after.altitude_raw_m, t),
    altitude_selected_m: interpolateNullable(before.altitude_selected_m, after.altitude_selected_m, t),
    altitude_corrected_m: interpolateNullable(before.altitude_corrected_m, after.altitude_corrected_m, t),
    grade_pct: interpolateNullable(before.grade_pct ?? null, after.grade_pct ?? null, t) ?? undefined,
    k_factor: before.k_factor,
    curvature_type: before.curvature_type,
    lateralOffset_m: interpolateNullable(before.lateralOffset_m ?? null, after.lateralOffset_m ?? null, t) ?? undefined,
    hdop: before.hdop,
    num_sats: before.num_sats,
    speed_mps: interpolateNullable(before.speed_mps ?? null, after.speed_mps ?? null, t),
    heading_deg: interpolateAngle(before.heading_deg ?? null, after.heading_deg ?? null, t),
    // Heavy haul safety fields (use nearest sample's value, no interpolation for discrete alerts)
    crossSlope_deg: interpolateNullable(before.crossSlope_deg ?? null, after.crossSlope_deg ?? null, t),
    bankingAlert: t < 0.5 ? before.bankingAlert : after.bankingAlert,
    curveRadius_m: interpolateNullable(before.curveRadius_m ?? null, after.curveRadius_m ?? null, t),
    radiusAlert: t < 0.5 ? before.radiusAlert : after.radiusAlert,
  };
}

function interpolateNullable(a: number | null, b: number | null, t: number): number | null {
  if (a === null || b === null) return a ?? b;
  return a + t * (b - a);
}

function interpolateAngle(a: number | null, b: number | null, t: number): number | null {
  if (a === null || b === null) return a ?? b;

  let diff = b - a;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;

  let result = a + t * diff;
  if (result < 0) result += 360;
  if (result >= 360) result -= 360;

  return result;
}

export function convertToExportSample(
  sample: LinkedProfileSample,
  alignmentId: string,
  profileId: string,
  projectId: string
): ExportSample {
  return {
    station_m: sample.s_m,
    station_km: sample.s_m / 1000,
    lat_deg: sample.lat,
    lon_deg: sample.lon,
    altitude_raw_m: sample.altitude_raw_m,
    altitude_selected_m: sample.altitude_selected_m,
    altitude_corrected_m: sample.altitude_corrected_m,
    grade_pct: sample.grade_pct ?? null,
    roll_deg: null,
    pitch_deg: null,
    yaw_deg: null,
    speed_mps: sample.speed_mps ?? null,
    heading_deg: sample.heading_deg ?? null,
    timestamp_utc: sample.time,
    fix_quality: null,
    sats: sample.num_sats ?? null,
    hdop: sample.hdop ?? null,
    alignment_id: alignmentId,
    profile_id: profileId,
    project_id: projectId,
    // Heavy haul safety fields (from GNSS profile recording)
    crossSlope_deg: sample.crossSlope_deg ?? null,
    bankingAlert: sample.bankingAlert ?? null,
    curveRadius_m: sample.curveRadius_m ?? null,
    radiusAlert: sample.radiusAlert ?? null,
  };
}

export function samplesToExportSamples(
  samples: LinkedProfileSample[],
  alignmentId: string,
  profileId: string,
  projectId: string
): ExportSample[] {
  return samples
    .sort((a, b) => a.s_m - b.s_m)
    .map(s => convertToExportSample(s, alignmentId, profileId, projectId));
}
