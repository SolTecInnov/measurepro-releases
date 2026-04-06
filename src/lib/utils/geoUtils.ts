/**
 * Calculate the distance between two points using the Haversine formula
 * @param lat1 Latitude of first point in decimal degrees
 * @param lon1 Longitude of first point in decimal degrees
 * @param lat2 Latitude of second point in decimal degrees
 * @param lon2 Longitude of second point in decimal degrees
 * @returns Distance in kilometers
 */
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  // Handle invalid inputs
  if (!lat1 || !lon1 || !lat2 || !lon2 || 
      isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
    return 0;
  }
  
  // Haversine formula to calculate distance between two points
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  return distance;
};

/**
 * Convert decimal degrees to degrees, minutes, seconds format
 * @param dd Decimal degrees
 * @returns Object with degrees, minutes, seconds
 */
export const decimalToDMS = (dd: number): { degrees: number; minutes: number; seconds: number } => {
  const degrees = Math.floor(Math.abs(dd));
  const minutes = Math.floor((Math.abs(dd) - degrees) * 60);
  const seconds = ((Math.abs(dd) - degrees - minutes / 60) * 3600).toFixed(2);
  
  return {
    degrees,
    minutes,
    seconds: parseFloat(seconds)
  };
};

/**
 * Format decimal degrees to a human-readable string
 * @param dd Decimal degrees
 * @param isLatitude Whether this is a latitude value (true) or longitude (false)
 * @returns Formatted string
 */
export const formatCoordinate = (dd: number, isLatitude: boolean): string => {
  if (isNaN(dd)) return '--°';
  
  const dms = decimalToDMS(dd);
  const direction = isLatitude 
    ? (dd >= 0 ? 'N' : 'S')
    : (dd >= 0 ? 'E' : 'W');
  
  return `${dms.degrees}° ${dms.minutes}' ${dms.seconds}" ${direction}`;
};

/**
 * Calculate bearing between two points
 * @param lat1 Latitude of first point in decimal degrees
 * @param lon1 Longitude of first point in decimal degrees
 * @param lat2 Latitude of second point in decimal degrees
 * @param lon2 Longitude of second point in decimal degrees
 * @returns Bearing in degrees (0-360)
 */
export const calculateBearing = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  const lonDiff = (lon2 - lon1) * Math.PI / 180;
  
  const y = Math.sin(lonDiff) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(lonDiff);
  
  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  bearing = (bearing + 360) % 360; // Normalize to 0-360
  
  return bearing;
};