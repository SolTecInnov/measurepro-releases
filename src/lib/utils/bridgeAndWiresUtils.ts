/**
 * Bridge & Wires Detection Utilities
 * 
 * SIMPLIFIED CLASSIFICATION LOGIC:
 * When user selects "Bridge & Wires", they expect BOTH an overpass AND wires.
 * 
 * Classification is based on temporal order and height difference:
 * - If first measurement set is HIGHER than second → First is Wire, Second is Overpass
 * - If first measurement set is LOWER than second → First is Overpass, Second is Wire
 * 
 * Typically there's 2+ meters difference between overpass and wire heights.
 * NEVER combine - always create 2 separate POIs.
 */

export interface BufferedDetection {
  value: number; // Adjusted measurement value in meters
  timestamp: number; // When detection occurred
  rawValue: string; // Original measurement string
  imageUrl?: string; // Captured image if available
  images?: string[]; // All captured images
  videoTimestamp?: number | null; // Video timestamp if recording
  intendedPOIType?: 'overpass' | 'wire' | 'bridgeAndWires' | ''; // Classified type
  capture?: { imageId: string; dataUrl: string }; // HYBRID FIX: Preserved capture for retry accuracy
}

export interface ClassifiedDetections {
  bridges: BufferedDetection[]; // Actually "overpass" type POIs (lower clearance)
  wires: BufferedDetection[]; // "wire" type POIs (higher clearance)
  combined: BufferedDetection[]; // NEVER USED - we always classify into overpass/wire
}

// Minimum height difference to distinguish overpass from wire (typically 2+ meters)
const MIN_HEIGHT_DIFFERENCE = 2.0; // meters

// Time gap to consider measurements as separate "sets" (e.g., passing under overpass, then under wires)
const SET_GAP_MS = 2000; // 2 seconds gap indicates new obstacle

const DETECTION_TIMEOUT_MS = 6000; // 6 seconds total window

/**
 * Groups detections into measurement "sets" based on time gaps.
 * A gap of 2+ seconds indicates transitioning from one obstacle to another.
 */
function groupIntoSets(detections: BufferedDetection[]): BufferedDetection[][] {
  if (detections.length === 0) return [];
  
  // Sort by timestamp
  const sorted = [...detections].sort((a, b) => a.timestamp - b.timestamp);
  
  const sets: BufferedDetection[][] = [];
  let currentSet: BufferedDetection[] = [sorted[0]];
  
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].timestamp - sorted[i - 1].timestamp;
    
    if (gap >= SET_GAP_MS) {
      // Gap detected - start new set
      sets.push(currentSet);
      currentSet = [sorted[i]];
    } else {
      // Same obstacle - add to current set
      currentSet.push(sorted[i]);
    }
  }
  
  // Don't forget the last set
  if (currentSet.length > 0) {
    sets.push(currentSet);
  }
  
  return sets;
}

/**
 * Gets the minimum (lowest clearance) value from a set of detections
 */
function getMinFromSet(set: BufferedDetection[]): BufferedDetection | null {
  if (set.length === 0) return null;
  return set.reduce((min, d) => d.value < min.value ? d : min, set[0]);
}

/**
 * Classifies buffered detections into overpass and wire categories.
 * 
 * SIMPLE LOGIC:
 * - Group measurements into temporal sets (separated by 2+ second gaps)
 * - Compare minimum values from first set vs second set
 * - Lower set = Overpass, Higher set = Wire
 * - Each POI uses the LOWEST measurement from its respective set
 * 
 * @param detections Array of buffered detections
 * @param threshold Minimum height difference required (default 2.0m)
 * @returns Classified detections with overpass in 'bridges' and wires in 'wires'
 */
export function classifyDetections(
  detections: BufferedDetection[],
  threshold: number = MIN_HEIGHT_DIFFERENCE
): ClassifiedDetections {
  // Handle empty case
  if (detections.length === 0) {
    return { bridges: [], wires: [], combined: [] };
  }
  
  // Group into temporal sets
  const sets = groupIntoSets(detections);
  
  // If only one set, we can't distinguish - but still classify based on height
  // This shouldn't happen if user correctly uses Bridge & Wires mode
  if (sets.length === 1) {
    // Single set - use "overpass" as default (lower clearance is more critical)
    const minDetection = getMinFromSet(sets[0]);
    if (minDetection) {
      return { 
        bridges: [{ ...minDetection, intendedPOIType: 'overpass' }], 
        wires: [], 
        combined: [] 
      };
    }
    return { bridges: [], wires: [], combined: [] };
  }
  
  // Get minimum value from each set (we use the lowest reading as the POI value)
  const firstSetMin = getMinFromSet(sets[0]);
  const secondSetMin = getMinFromSet(sets[1]);
  
  if (!firstSetMin || !secondSetMin) {
    return { bridges: [], wires: [], combined: [] };
  }
  
  const heightDifference = Math.abs(firstSetMin.value - secondSetMin.value);
  
  // If difference is less than threshold, still classify but log warning
  if (heightDifference < threshold) {
    console.warn(`[BridgeAndWires] Height difference (${heightDifference.toFixed(2)}m) is less than threshold (${threshold}m), classifying anyway`);
  }
  
  // CLASSIFICATION LOGIC:
  // - First set HIGHER than second → First is Wire, Second is Overpass
  // - First set LOWER than second → First is Overpass, Second is Wire
  
  let overpassDetection: BufferedDetection;
  let wireDetection: BufferedDetection;
  
  if (firstSetMin.value > secondSetMin.value) {
    // First set is higher → First is Wire, Second is Overpass
    wireDetection = { ...firstSetMin, intendedPOIType: 'wire' };
    overpassDetection = { ...secondSetMin, intendedPOIType: 'overpass' };
  } else {
    // First set is lower → First is Overpass, Second is Wire
    overpassDetection = { ...firstSetMin, intendedPOIType: 'overpass' };
    wireDetection = { ...secondSetMin, intendedPOIType: 'wire' };
  }
  
  // Return in temporal order: overpass in 'bridges', wire in 'wires'
  // Note: 'bridges' array is used for overpass POIs for backward compatibility
  return {
    bridges: [overpassDetection],
    wires: [wireDetection],
    combined: [] // NEVER combine - always 2 separate POIs
  };
}

/**
 * Checks if a new detection should be added to the buffer
 * @param lastTimestamp Timestamp of last detection in buffer
 * @param currentTimestamp Timestamp of new detection
 * @param timeoutMs Timeout window in milliseconds (default 6000ms)
 * @returns True if detection is within timeout window
 */
export function isWithinDetectionWindow(
  lastTimestamp: number,
  currentTimestamp: number,
  timeoutMs: number = DETECTION_TIMEOUT_MS
): boolean {
  return (currentTimestamp - lastTimestamp) <= timeoutMs;
}

/**
 * Sorts detections by value (ascending) for consistent ordering
 */
export function sortDetectionsByValue(detections: BufferedDetection[]): BufferedDetection[] {
  return [...detections].sort((a, b) => a.value - b.value);
}

/**
 * Formats detection summary for logging
 */
export function formatDetectionSummary(classified: ClassifiedDetections): string {
  const parts: string[] = [];
  
  if (classified.bridges.length > 0) {
    const values = classified.bridges.map(d => `${d.value.toFixed(2)}m`).join(', ');
    parts.push(`Overpass: [${values}]`);
  }
  
  if (classified.wires.length > 0) {
    const values = classified.wires.map(d => `${d.value.toFixed(2)}m`).join(', ');
    parts.push(`Wire: [${values}]`);
  }
  
  if (parts.length === 0) {
    return 'Bridge & Wires: No detections';
  }
  
  return parts.join(', ');
}
