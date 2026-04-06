/**
 * Utility functions for laser measurement processing
 */

/**
 * Converts a raw laser measurement to meters based on the laser type
 * 
 * @param rawValue - The raw measurement value from the laser (already in meters)
 * @param laserType - The type of laser device ('high-pole' for Jenoptik, others for SolTec)
 * @param groundReferenceHeight - The ground reference height to add (in meters)
 * @returns The measurement in meters
 */
export function convertToMeters(rawValue: string | number, laserType: string, groundReferenceHeight: number = 0): number {
  // Convert string to number if needed
  const value = typeof rawValue === 'string' ? parseFloat(rawValue) : rawValue;
  
  // Check for invalid values
  if (isNaN(value) || rawValue === '--' || rawValue === 'infinity') {
    return 0;
  }
  
  // Check for DE02 (infinity code) or values that look like GPS data
  if (typeof rawValue === 'string' && (rawValue === 'DE02' || rawValue.includes('DE02') || 
      (value > 180 || value < -180))) {
    return 0;
  }
  
  // All laser values are now in meters
  // Note: We don't add ground reference here - that's done at the measurement creation level
  return value;
}

/**
 * Formats a measurement value for display
 * 
 * @param value - The measurement value in meters
 * @param unit - The unit to display ('m' for meters, 'ft' for feet)
 * @param decimals - Number of decimal places to show
 * @returns Formatted measurement string
 */
export function formatMeasurement(value: number, unit: 'm' | 'ft' = 'm', decimals: number = 3): string {
  if (isNaN(value) || value === 0) {
    return '--' + (unit === 'm' ? 'm' : 'ft');
  }
  
  // Convert to feet if needed
  const convertedValue = unit === 'ft' ? value * 3.28084 : value;
  
  // Format with specified decimal places
  return `${convertedValue.toFixed(decimals)}${unit}`;
}

/**
 * Checks if a measurement is within valid range
 * 
 * @param value - The measurement value in meters
 * @param minHeight - Minimum valid height
 * @param maxHeight - Maximum valid height
 * @returns Boolean indicating if measurement is valid
 */
export function isValidMeasurement(value: number, minHeight: number = 0, maxHeight: number = 30): boolean {
  if (isNaN(value)) return false;
  return value >= minHeight && value <= maxHeight;
}

/**
 * Sky reading threshold - measurements at or below this value are considered sky readings
 * (likely noise, ground reflection, or no target)
 */
export const SKY_READING_THRESHOLD_M = 0.1;

/**
 * Helper function to check if a measurement value is invalid/sky
 * Invalid means: null, error code, OR below the sky reading threshold (0.1m)
 * 
 * @param value - The measurement value to check
 * @param skyThresholdM - Threshold below which readings are considered sky (default 0.1m)
 * @returns Boolean indicating if the measurement is invalid/sky
 */
export function isInvalidMeasurement(value: string | null, skyThresholdM: number = SKY_READING_THRESHOLD_M): boolean {
  if (!value) return true;
  
  // Check for error codes and special values
  if (value === 'infinity' || 
      value === 'DE02' || 
      value.includes('DE02') || 
      value === '--' || 
      value === 'NaN' || 
      value === 'undefined' || 
      value === 'null' || 
      value === '') {
    return true;
  }
  
  // Check if the numeric value is at or below the sky threshold
  const numValue = parseFloat(value);
  if (!isNaN(numValue) && numValue <= skyThresholdM) {
    return true;
  }
  
  return false;
}

/**
 * Creates a detailed log entry for a detected object
 * 
 * @param minHeight - The minimum height measurement in meters
 * @param measurements - Array of all measurements for this object
 * @param startTime - When object detection started
 * @param endTime - When object detection ended
 * @param gpsData - Current GPS data
 * @returns Object containing detailed detection information
 */
export function createObjectDetectionLog(
  minHeight: number,
  measurements: string[],
  startTime: Date,
  endTime: Date,
  gpsData: any
): Record<string, any> {
  // Convert all valid measurements to numbers
  const validMeasurements = measurements
    .filter(m => !isInvalidMeasurement(m))
    .map(m => parseFloat(m));
  
  // Calculate statistics
  const avgHeight = validMeasurements.length > 0 
    ? validMeasurements.reduce((sum, val) => sum + val, 0) / validMeasurements.length 
    : 0;
  
  const maxHeight = validMeasurements.length > 0 
    ? Math.max(...validMeasurements) 
    : 0;
  
  const detectionDuration = (endTime.getTime() - startTime.getTime()) / 1000; // in seconds
  
  return {
    minHeight,
    avgHeight,
    maxHeight,
    measurementCount: validMeasurements.length,
    totalSamples: measurements.length,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    duration: detectionDuration,
    location: {
      latitude: gpsData.latitude,
      longitude: gpsData.longitude,
      altitude: gpsData.altitude,
      speed: gpsData.speed,
      heading: gpsData.course
    }
  };
}