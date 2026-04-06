/**
 * Unit Conversion Utilities
 * 
 * All measurements in the backend are stored in METERS.
 * These utilities convert between meters and imperial (feet + inches) for DISPLAY ONLY.
 */

export type DisplayUnits = 'metric' | 'imperial';

/**
 * Convert meters to feet and inches
 * @param meters - Value in meters
 * @returns Object with feet and inches
 */
export const metersToFeetInches = (meters: number): { feet: number; inches: number; totalInches: number } => {
  const totalInches = meters * 39.3701; // 1 meter = 39.3701 inches
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  
  return {
    feet,
    inches,
    totalInches
  };
};

/**
 * Convert feet and inches to meters
 * @param feet - Number of feet
 * @param inches - Number of inches
 * @returns Value in meters
 */
export const feetInchesToMeters = (feet: number, inches: number): number => {
  const totalInches = (feet * 12) + inches;
  return totalInches / 39.3701; // Convert inches to meters
};

/**
 * Format a measurement value for display based on unit preference
 * @param meters - Value in meters
 * @param units - Display units ('metric' or 'imperial')
 * @param options - Formatting options
 * @returns Formatted string
 */
export const formatMeasurement = (
  meters: number | string,
  units: DisplayUnits,
  options?: {
    decimals?: number;
    showUnit?: boolean;
    shortFormat?: boolean;
  }
): string => {
  const { decimals = 2, showUnit = true, shortFormat = false } = options || {};
  
  // Handle non-numeric values
  if (typeof meters === 'string') {
    if (meters === '--' || meters === 'infinity' || meters === 'NaN' || meters === '') {
      return showUnit ? `--${units === 'imperial' ? 'ft' : 'm'}` : '--';
    }
    meters = parseFloat(meters);
  }
  
  if (isNaN(meters)) {
    return showUnit ? `--${units === 'imperial' ? 'ft' : 'm'}` : '--';
  }
  
  if (units === 'imperial') {
    const { feet, inches } = metersToFeetInches(meters);
    
    if (shortFormat) {
      // Short format: "12'6\"" or just the total in feet
      return showUnit 
        ? `${feet}'${inches.toFixed(0)}"` 
        : `${feet}.${Math.round(inches * 100 / 12)}`;
    } else {
      // Full format: "12ft 6in" or "12 feet 6 inches"
      const inchesStr = inches.toFixed(decimals);
      return showUnit 
        ? `${feet}ft ${inchesStr}in` 
        : `${feet} ${inchesStr}`;
    }
  } else {
    // Metric
    const value = meters.toFixed(decimals);
    return showUnit ? `${value}m` : value;
  }
};

/**
 * Format a measurement with both primary and secondary units
 * Displays the selected unit prominently and the other unit as secondary
 * @param meters - Value in meters
 * @param units - Primary display units
 * @returns Object with primary and secondary formatted strings
 */
export const formatMeasurementDual = (
  meters: number | string,
  units: DisplayUnits
): { primary: string; secondary: string } => {
  // Handle non-numeric values
  if (typeof meters === 'string') {
    if (meters === '--' || meters === 'infinity' || meters === 'NaN' || meters === '') {
      return {
        primary: units === 'imperial' ? '--ft' : '--m',
        secondary: units === 'imperial' ? '--m' : '--ft'
      };
    }
    meters = parseFloat(meters);
  }
  
  if (isNaN(meters)) {
    return {
      primary: units === 'imperial' ? '--ft' : '--m',
      secondary: units === 'imperial' ? '--m' : '--ft'
    };
  }
  
  if (units === 'imperial') {
    const { feet, inches } = metersToFeetInches(meters);
    return {
      primary: `${feet}ft ${inches.toFixed(2)}in`,
      secondary: `${meters.toFixed(2)}m`
    };
  } else {
    const { feet, inches } = metersToFeetInches(meters);
    return {
      primary: `${meters.toFixed(2)}m`,
      secondary: `${feet}ft ${inches.toFixed(2)}in`
    };
  }
};

/**
 * Parse user input and convert to meters
 * Supports various formats:
 * - Metric: "5.5" or "5.5m"
 * - Imperial: "12'6\"" or "12ft 6in" or "12 6"
 * @param input - User input string
 * @param assumedUnits - Units to assume if not specified
 * @returns Value in meters
 */
export const parseInputToMeters = (input: string, assumedUnits: DisplayUnits = 'metric'): number => {
  const cleaned = input.trim();
  
  // Check for imperial formats
  const imperialPatterns = [
    /(\d+(?:\.\d+)?)\s*['′]\s*(\d+(?:\.\d+)?)\s*["″]?/, // 12'6" or 12' 6"
    /(\d+(?:\.\d+)?)\s*ft\s*(\d+(?:\.\d+)?)\s*in/, // 12ft 6in
    /(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)(?!\.)/ // 12 6 (space separated)
  ];
  
  for (const pattern of imperialPatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      const feet = parseFloat(match[1]);
      const inches = parseFloat(match[2]);
      return feetInchesToMeters(feet, inches);
    }
  }
  
  // Check for single imperial value (feet only)
  const feetOnly = cleaned.match(/(\d+(?:\.\d+)?)\s*(?:ft|['′])/);
  if (feetOnly) {
    const feet = parseFloat(feetOnly[1]);
    return feetInchesToMeters(feet, 0);
  }
  
  // Check for metric format
  const metricMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*m?/);
  if (metricMatch) {
    const value = parseFloat(metricMatch[1]);
    
    // If no unit specified, use assumed units
    if (!cleaned.includes('m') && assumedUnits === 'imperial') {
      // Treat as feet
      return feetInchesToMeters(value, 0);
    }
    
    return value; // Already in meters or no unit
  }
  
  // Fallback: try to parse as number
  const numValue = parseFloat(cleaned);
  if (!isNaN(numValue)) {
    if (assumedUnits === 'imperial') {
      return feetInchesToMeters(numValue, 0);
    }
    return numValue;
  }
  
  return 0;
};
