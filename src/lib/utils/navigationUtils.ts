import { Route, RoutePoint } from './routeUtils';
import { speakInstruction } from './routeUtils';

// Interface for navigation state
export interface NavigationState {
  isNavigating: boolean;
  currentRouteId: string | null;
  currentInstructionIndex: number;
  distanceToNextInstruction: number;
  estimatedTimeToArrival: string;
  isMuted: boolean;
}

// Interface for a navigation instruction
export interface NavigationInstruction {
  text: string;
  distance: number;
  time: number;
  type: string;
  modifier?: string;
  coordinates: [number, number];
}

// Calculate distance between two points using Haversine formula
export const calculateDistance = (
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number => {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
};

// Calculate bearing between two points
export const calculateBearing = (
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number => {
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const λ1 = lon1 * Math.PI / 180;
  const λ2 = lon2 * Math.PI / 180;

  const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) -
          Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
  const θ = Math.atan2(y, x);

  return (θ * 180 / Math.PI + 360) % 360; // Bearing in degrees
};

// Get turn direction based on bearing change
export const getTurnDirection = (currentBearing: number, nextBearing: number): string => {
  const bearingDiff = ((nextBearing - currentBearing + 360) % 360);
  
  if (bearingDiff > 330 || bearingDiff < 30) return 'continue';
  if (bearingDiff >= 30 && bearingDiff < 60) return 'slight right';
  if (bearingDiff >= 60 && bearingDiff < 120) return 'right';
  if (bearingDiff >= 120 && bearingDiff < 150) return 'sharp right';
  if (bearingDiff >= 150 && bearingDiff < 210) return 'u-turn';
  if (bearingDiff >= 210 && bearingDiff < 240) return 'sharp left';
  if (bearingDiff >= 240 && bearingDiff < 300) return 'left';
  if (bearingDiff >= 300 && bearingDiff < 330) return 'slight left';
  
  return 'continue';
};

// Generate navigation instructions from route points
export const generateInstructions = (route: Route): NavigationInstruction[] => {
  if (!route || !route.points || route.points.length < 2) {
    return [];
  }
  
  // Sort points by order
  const sortedPoints = [...route.points].sort((a, b) => a.order - b.order);
  
  // Generate instructions
  const instructions: NavigationInstruction[] = [];
  
  // Add departure instruction
  const origin = sortedPoints[0];
  instructions.push({
    text: `Start from ${route.name} origin`,
    distance: 0,
    time: 0,
    type: 'depart',
    coordinates: origin.position
  });
  
  // Add instructions for each segment
  for (let i = 1; i < sortedPoints.length; i++) {
    const prevPoint = sortedPoints[i-1];
    const currentPoint = sortedPoints[i];
    
    // Calculate distance
    const distance = calculateDistance(
      prevPoint.position[0], prevPoint.position[1],
      currentPoint.position[0], currentPoint.position[1]
    );
    
    // Calculate bearing
    const bearing = calculateBearing(
      prevPoint.position[0], prevPoint.position[1],
      currentPoint.position[0], currentPoint.position[1]
    );
    
    // Calculate previous bearing (if not first segment)
    let turnDirection = 'continue';
    if (i > 1) {
      const prevPrevPoint = sortedPoints[i-2];
      const prevBearing = calculateBearing(
        prevPrevPoint.position[0], prevPrevPoint.position[1],
        prevPoint.position[0], prevPoint.position[1]
      );
      
      turnDirection = getTurnDirection(prevBearing, bearing);
    }
    
    // Calculate estimated time (assuming 50 km/h average speed)
    const time = distance / (50000 / 3600); // Time in seconds
    
    // Create instruction
    let text = '';
    let type = 'turn';
    let modifier = turnDirection;
    
    if (i === sortedPoints.length - 1) {
      // Destination
      text = `Arrive at ${route.name} destination`;
      type = 'arrive';
      modifier = undefined;
    } else if (turnDirection === 'continue') {
      // Continue straight
      text = `Continue straight for ${Math.round(distance)} meters`;
      type = 'new name';
      modifier = 'straight';
    } else if (turnDirection.includes('right')) {
      // Turn right
      text = `Turn ${turnDirection} in ${Math.round(distance)} meters`;
    } else if (turnDirection.includes('left')) {
      // Turn left
      text = `Turn ${turnDirection} in ${Math.round(distance)} meters`;
    } else if (turnDirection === 'u-turn') {
      // U-turn
      text = `Make a U-turn in ${Math.round(distance)} meters`;
      modifier = 'uturn';
    }
    
    instructions.push({
      text,
      distance,
      time,
      type,
      modifier,
      coordinates: currentPoint.position
    });
  }
  
  return instructions;
};

// Announce upcoming instruction
export const announceInstruction = (
  instruction: NavigationInstruction,
  distance: number,
  isMuted: boolean
): void => {
  if (isMuted) return;
  
  let announcement = '';
  
  // Format distance
  const formattedDistance = distance < 1000 
    ? `${Math.round(distance / 10) * 10} meters` 
    : `${(distance / 1000).toFixed(1)} kilometers`;
  
  // Create announcement based on instruction type
  switch (instruction.type) {
    case 'depart':
      announcement = `Starting navigation. ${instruction.text}`;
      break;
    case 'arrive':
      announcement = `You have arrived at your destination.`;
      break;
    case 'turn':
      announcement = `In ${formattedDistance}, ${instruction.text}`;
      break;
    case 'new name':
      announcement = `Continue straight for ${formattedDistance}`;
      break;
    default:
      announcement = instruction.text;
  }
  
  // Speak the announcement
  speakInstruction(announcement);
};

// Calculate ETA based on remaining distance and average speed
export const calculateETA = (
  remainingDistance: number,
  averageSpeed: number = 50 // km/h
): string => {
  // Convert to meters per second
  const speedMps = (averageSpeed * 1000) / 3600;
  
  // Calculate remaining time in seconds
  const remainingTimeSeconds = remainingDistance / speedMps;
  
  // Calculate arrival time
  const now = new Date();
  const arrivalTime = new Date(now.getTime() + remainingTimeSeconds * 1000);
  
  // Format as HH:MM
  return arrivalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};