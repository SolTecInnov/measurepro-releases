/**
 * GeoReferencer - Add GPS coordinates to point cloud frames
 * 
 * COORDINATE SYSTEMS:
 * - Local: XYZ in meters relative to camera
 * - Global: Lat/Lon/Alt (WGS84)
 * 
 * TRANSFORMATION:
 * 1. Get GPS position from browser Geolocation API or serial GPS
 * 2. Apply camera orientation (roll/pitch/yaw) to points
 * 3. Transform local XYZ → global lat/lon/alt
 * 
 * GPS SOURCES:
 * - Browser Geolocation API (WiFi/cellular triangulation)
 * - Serial GPS device (NMEA sentences)
 * - Fallback: Manual GPS entry
 */

import type { GPSPosition, CameraOrientation } from './types';

export interface GeoreferenceOptions {
  applyOrientation?: boolean;
  transformToGlobal?: boolean;
}

const EARTH_RADIUS = 6378137.0;

export function georeference(
  points: Float32Array,
  gpsPosition: GPSPosition,
  cameraOrientation?: CameraOrientation,
  options: GeoreferenceOptions = {}
): Float32Array {
  if (!gpsPosition || gpsPosition.lat === 0 && gpsPosition.lon === 0) {
    return points;
  }

  const {
    applyOrientation = true,
    transformToGlobal = false,
  } = options;

  let transformedPoints = new Float32Array(points);

  if (applyOrientation && cameraOrientation) {
    transformedPoints = applyRotation(transformedPoints, cameraOrientation);
  }

  if (transformToGlobal) {
    transformedPoints = localToGlobal(transformedPoints, gpsPosition);
  }

  return transformedPoints;
}

function applyRotation(
  points: Float32Array,
  orientation: CameraOrientation
): Float32Array {
  const { roll, pitch, yaw } = orientation;
  
  const rollRad = (roll * Math.PI) / 180;
  const pitchRad = (pitch * Math.PI) / 180;
  const yawRad = (yaw * Math.PI) / 180;

  const cosRoll = Math.cos(rollRad);
  const sinRoll = Math.sin(rollRad);
  const cosPitch = Math.cos(pitchRad);
  const sinPitch = Math.sin(pitchRad);
  const cosYaw = Math.cos(yawRad);
  const sinYaw = Math.sin(yawRad);

  const r00 = cosYaw * cosPitch;
  const r01 = cosYaw * sinPitch * sinRoll - sinYaw * cosRoll;
  const r02 = cosYaw * sinPitch * cosRoll + sinYaw * sinRoll;
  const r10 = sinYaw * cosPitch;
  const r11 = sinYaw * sinPitch * sinRoll + cosYaw * cosRoll;
  const r12 = sinYaw * sinPitch * cosRoll - cosYaw * sinRoll;
  const r20 = -sinPitch;
  const r21 = cosPitch * sinRoll;
  const r22 = cosPitch * cosRoll;

  const rotated = new Float32Array(points.length);

  for (let i = 0; i < points.length; i += 3) {
    const x = points[i];
    const y = points[i + 1];
    const z = points[i + 2];

    rotated[i] = r00 * x + r01 * y + r02 * z;
    rotated[i + 1] = r10 * x + r11 * y + r12 * z;
    rotated[i + 2] = r20 * x + r21 * y + r22 * z;
  }

  return rotated;
}

function localToGlobal(
  points: Float32Array,
  gpsPosition: GPSPosition
): Float32Array {
  const { lat, lon, alt } = gpsPosition;
  const latRad = (lat * Math.PI) / 180;

  const metersPerDegreeLat = 111132.954 - 559.822 * Math.cos(2 * latRad) + 1.175 * Math.cos(4 * latRad);
  const metersPerDegreeLon = (Math.PI / 180) * EARTH_RADIUS * Math.cos(latRad);

  const globalPoints = new Float32Array(points.length);

  for (let i = 0; i < points.length; i += 3) {
    const x = points[i];
    const y = points[i + 1];
    const z = points[i + 2];

    const deltaLat = y / metersPerDegreeLat;
    const deltaLon = x / metersPerDegreeLon;
    const deltaAlt = z;

    globalPoints[i] = lon + deltaLon;
    globalPoints[i + 1] = lat + deltaLat;
    globalPoints[i + 2] = alt + deltaAlt;
  }

  return globalPoints;
}

export async function getCurrentGPSPosition(): Promise<GPSPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          alt: position.coords.altitude || 0,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        });
      },
      (error) => {
        reject(new Error(`GPS error: ${error.message}`));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    );
  });
}

export function calculateGPSCenter(positions: GPSPosition[]): GPSPosition {
  if (positions.length === 0) {
    return { lat: 0, lon: 0, alt: 0 };
  }

  let sumLat = 0;
  let sumLon = 0;
  let sumAlt = 0;

  for (const pos of positions) {
    sumLat += pos.lat;
    sumLon += pos.lon;
    sumAlt += pos.alt;
  }

  return {
    lat: sumLat / positions.length,
    lon: sumLon / positions.length,
    alt: sumAlt / positions.length,
  };
}

export function isValidGPSPosition(position: GPSPosition): boolean {
  return (
    position &&
    typeof position.lat === 'number' &&
    typeof position.lon === 'number' &&
    typeof position.alt === 'number' &&
    position.lat >= -90 &&
    position.lat <= 90 &&
    position.lon >= -180 &&
    position.lon <= 180 &&
    !isNaN(position.lat) &&
    !isNaN(position.lon) &&
    !isNaN(position.alt)
  );
}
