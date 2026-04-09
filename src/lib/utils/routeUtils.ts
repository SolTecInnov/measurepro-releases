import { openDB } from 'idb';
import { toast } from 'sonner';
import axios from 'axios';
import L from 'leaflet';
// NOTE: leaflet-routing-machine is imported dynamically in RouteNavigator.tsx
// to prevent loading before Leaflet is ready

// Google Maps API key from environment variables
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export interface RoutePoint {
  id: string;
  position: [number, number]; // [latitude, longitude]
  type: 'origin' | 'waypoint' | 'destination';
  name?: string;
  order: number;
}

export interface Route {
  id: string;
  name: string;
  description?: string;
  points: RoutePoint[];
  color: string;
  createdAt: string;
  updatedAt: string;
  surveyId: string;
  routeGeometry?: [number, number][];
}

// Initialize the routes database
export const initRoutesDB = async () => {
  return openDB('routes-db', 1, {
    upgrade(db) {
      // Create routes store if it doesn't exist
      if (!db.objectStoreNames.contains('routes')) {
        const routesStore = db.createObjectStore('routes', { keyPath: 'id' });
        routesStore.createIndex('by-survey', 'surveyId');
        routesStore.createIndex('by-date', 'createdAt');
      }
      
      // Create route points store if it doesn't exist
      if (!db.objectStoreNames.contains('route-points')) {
        const pointsStore = db.createObjectStore('route-points', { keyPath: 'id' });
        pointsStore.createIndex('by-route', 'routeId');
        pointsStore.createIndex('by-order', 'order');
      }
    }
  });
};

// Get directions between points using Google Maps Directions API
export const getDirections = async (positions: [number, number][]): Promise<[number, number][] | undefined> => {
  if (positions.length < 2) return undefined;
  
  try {
    // Show loading toast
    toast.loading('Calculating route along roads...', {
      id: 'route-calculation'
    });

    // Get API key from localStorage if available (user entered in settings)
    const storedApiKey = localStorage.getItem('map_api_key_google') || GOOGLE_MAPS_API_KEY;
    
    // Validate API key
    if (!storedApiKey || storedApiKey === 'your_google_maps_api_key') {
      const osrmPath = await getDirectionsFromOSRM(positions);
      return osrmPath;
    }

    try {
      // Format origin, destination and waypoints
      const origin = `${positions[0][0]},${positions[0][1]}`;
      const destination = `${positions[positions.length - 1][0]},${positions[positions.length - 1][1]}`;
      
      // Format waypoints (if any)
      let waypointsParam = '';
      if (positions.length > 2) {
        const waypoints = positions.slice(1, positions.length - 1)
          .map(pos => `${pos[0]},${pos[1]}`)
          .join('|');
        waypointsParam = `&waypoints=optimize:true|${encodeURIComponent(waypoints)}`;
      }
      
      // Build the Google Maps Directions API URL
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}${waypointsParam}&key=${storedApiKey}`;
      
      const response = await axios.get(url, {
        timeout: 15000 // 15 second timeout
      });
      
      // Check API response status
      if (response.data.status !== 'OK') {
        const osrmPath = await getDirectionsFromOSRM(positions);
        return osrmPath;
      }
      
      // Extract the route path from the response
      const route = response.data.routes[0];
      if (!route || !route.overview_polyline || !route.overview_polyline.points) {
        const osrmPath = await getDirectionsFromOSRM(positions);
        return osrmPath;
      }
      
      // Decode the polyline
      const path = decodePolyline(route.overview_polyline.points);
      
      // Update toast
      /* toast removed */
      
      return path;
    } catch (error) {
      const osrmPath = await getDirectionsFromOSRM(positions);
      return osrmPath;
    }
  } catch (error) {
    // Fall back to straight lines between points
    /* toast removed */
    
    // Create a simple straight-line path between all points
    const straightLinePath: [number, number][] = [];
    positions.forEach(pos => {
      straightLinePath.push(pos);
    });
    
    return straightLinePath;
  } finally {
    // Clear loading toast if it's still showing
    setTimeout(() => {
      toast.dismiss('route-calculation');
    }, 1000);
  }
};

// Get directions using OSRM (Open Source Routing Machine) as a fallback
export const getDirectionsFromOSRM = async (positions: [number, number][]): Promise<[number, number][]> => {
  try {
    if (positions.length < 2) {
      throw new Error('At least 2 positions are required');
    }
    
    // Format coordinates for OSRM (longitude,latitude format)
    const coordinates = positions.map(pos => `${pos[1]},${pos[0]}`).join(';');
    
    // Use the OSRM demo server with more options
    const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=true&annotations=true`;
    
    const response = await axios.get(url, {
      timeout: 15000 // 15 second timeout
    });
    
    if (response.data.code !== 'Ok' || !response.data.routes || response.data.routes.length === 0) {
      throw new Error('No route found in OSRM response');
    }
    
    // Extract the route geometry
    const route = response.data.routes[0];
    if (!route.geometry || !route.geometry.coordinates || route.geometry.coordinates.length === 0) {
      throw new Error('No geometry found in OSRM route');
    }
    
    // Convert from [longitude, latitude] to [latitude, longitude]
    const path: [number, number][] = route.geometry.coordinates.map(
      (coord: [number, number]) => [coord[1], coord[0]]
    );
    
    /* toast removed */
    
    return path;
  } catch (error) {
    // Fall back to straight lines
    /* toast removed */
    
    return positions;
  }
};

// Create a speech synthesis instance for voice guidance
const synth = window.speechSynthesis;

// Function to speak turn-by-turn instructions
export const speakInstruction = (instruction: string) => {
  // Cancel any ongoing speech
  synth.cancel();
  
  // Create a new utterance
  const utterance = new SpeechSynthesisUtterance(instruction);
  
  // Set properties
  utterance.volume = 1.0;  // 0 to 1
  utterance.rate = 1.0;    // 0.1 to 10
  utterance.pitch = 1.0;   // 0 to 2
  utterance.lang = 'en-US';
  
  // Speak the instruction
  synth.speak(utterance);
};

// Check if speech synthesis is available
export const isSpeechSynthesisAvailable = (): boolean => {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
};

// Function to get a simplified instruction from a maneuver
export const getSimplifiedInstruction = (maneuver: any): string => {
  if (!maneuver) return '';
  
  const { type, modifier, distance } = maneuver;
  
  // Format distance for speech
  const formattedDistance = distance ? 
    `In ${Math.round(distance / 10) * 10} meters` : 
    'Soon';
  
  // Map common maneuver types to simple instructions
  switch (type) {
    case 'turn':
      return `${formattedDistance}, turn ${modifier || 'ahead'}`;
    case 'new name':
      return `Continue straight ahead on the new road`;
    case 'depart':
      return `Start by heading ${modifier || 'forward'}`;
    case 'arrive':
      return `You have arrived at your destination`;
    case 'roundabout':
    case 'rotary':
      return `${formattedDistance}, enter roundabout and take the ${getExitNumber(maneuver)} exit`;
    case 'merge':
      return `${formattedDistance}, merge ${modifier || 'ahead'}`;
    case 'on ramp':
    case 'off ramp':
      return `${formattedDistance}, take the ramp ${modifier || 'ahead'}`;
    case 'fork':
      return `${formattedDistance}, keep ${modifier || 'straight'} at the fork`;
    case 'end of road':
      return `${formattedDistance}, road ends, turn ${modifier || 'ahead'}`;
    default:
      return `${formattedDistance}, ${type} ${modifier || ''}`;
  }
};

// Helper function to get exit number for roundabouts
const getExitNumber = (maneuver: any): string => {
  const exitNumber = maneuver.exit || 1;
  
  // Convert to ordinal number
  if (exitNumber === 1) return '1st';
  if (exitNumber === 2) return '2nd';
  if (exitNumber === 3) return '3rd';
  return `${exitNumber}th`;
};

// Generate a Google Maps directions URL for the route
export const getDirectionsUrl = (points: RoutePoint[]): string => {
  if (points.length < 2) {
    return '';
  }
  
  // Sort points by order
  const sortedPoints = [...points].sort((a, b) => a.order - b.order);
  
  // Find origin and destination
  const origin = sortedPoints.find(p => p.type === 'origin') || sortedPoints[0];
  const destination = sortedPoints.find(p => p.type === 'destination') || sortedPoints[sortedPoints.length - 1];
  
  // Get waypoints (excluding origin and destination)
  const waypoints = sortedPoints.filter(p => 
    p.type === 'waypoint' && 
    p.id !== origin.id && 
    p.id !== destination.id
  );
  
  // Format origin and destination
  const originStr = `${origin.position[0]},${origin.position[1]}`;
  const destinationStr = `${destination.position[0]},${destination.position[1]}`;
  
  // Format waypoints
  let waypointsStr = '';
  if (waypoints.length > 0) {
    waypointsStr = '&waypoints=' + waypoints.map(wp => 
      `${wp.position[0]},${wp.position[1]}`
    ).join('|');
  }
  
  // Build the URL
  return `https://www.google.com/maps/dir/?api=1&origin=${originStr}&destination=${destinationStr}${waypointsStr}&travelmode=driving`;
};

/**
 * Ramer-Douglas-Peucker simplification of a coordinate array.
 * epsilon is in degrees (≈0.00005° ≈ 5m at mid-latitudes).
 */
export function rdpSimplify(points: [number, number][], epsilon: number): [number, number][] {
  if (points.length <= 2) return points;

  const perpendicularDist = (p: [number, number], a: [number, number], b: [number, number]): number => {
    const [px, py] = p;
    const [ax, ay] = a;
    const [bx, by] = b;
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - ax, py - ay);
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  };

  let maxDist = 0;
  let maxIdx = 0;
  const first = points[0];
  const last = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDist(points[i], first, last);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    const left = rdpSimplify(points.slice(0, maxIdx + 1), epsilon);
    const right = rdpSimplify(points.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [first, last];
}

// Decode Google Maps polyline
function decodePolyline(encoded: string): [number, number][] {
  const poly: [number, number][] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    // Convert to [lat, lng] format and divide by 1e5 to get actual coordinates
    poly.push([lat / 1e5, lng / 1e5]);
  }

  return poly;
}

// Save a route to the database
export const saveRoute = async (route: Omit<Route, 'id' | 'createdAt' | 'updatedAt'>): Promise<Route> => {
  try {
    toast.loading('Saving route...', { id: 'save-route' });
    
    // Validate route has both origin and destination
    const hasOrigin = route.points.some(p => p.type === 'origin');
    const hasDestination = route.points.some(p => p.type === 'destination');
    
    if (!hasOrigin || !hasDestination) {
      toast.error('Route must have both an origin and destination point', { id: 'save-route' });
      throw new Error('Route must have both an origin and destination point');
    }
    
    // Use pre-provided routeGeometry (e.g. from imported GPS track) when available.
    // Only compute road geometry via directions API for manually-built routes that
    // don't already carry a track geometry.
    let routeGeometry: [number, number][] | undefined = route.routeGeometry;
    if (!routeGeometry && route.points.length >= 2) {
      // Sort points by order
      const sortedPoints = [...route.points].sort((a, b) => a.order - b.order);
      const positions = sortedPoints.map(point => point.position);
      
      try {
        // Get directions between points
        const directions = await getDirections(positions);
        if (directions) {
          routeGeometry = directions;
        }
      } catch (directionError) {
        // Continue with saving even if directions fail - we'll use straight lines
        toast.error('Could not calculate route along roads. Using straight lines instead.', { id: 'save-route' });
        
        // Create a simple straight-line path between all points
        routeGeometry = positions;
      }
    }
    
    const db = await initRoutesDB();
    
    const newRoute: Route = {
      ...route,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      routeGeometry
    };
    
    await db.put('routes', newRoute);
    
    // Save route points
    for (const point of route.points) {
      const pointWithRouteId = {
        ...point,
        routeId: newRoute.id
      };
      
      await db.put('route-points', pointWithRouteId);
    }

    toast.success('Route saved', { id: 'save-route' });
    return newRoute;
  } catch (error) {
    toast.error('Failed to save route', { id: 'save-route' });
    throw error;
  }
};

// Update an existing route
export const updateRoute = async (route: Route) => {
  try {
    toast.loading('Updating route...', { id: 'update-route' });
    
    // Validate route has both origin and destination
    const hasOrigin = route.points.some(p => p.type === 'origin');
    const hasDestination = route.points.some(p => p.type === 'destination');
    
    if (!hasOrigin || !hasDestination) {
      toast.error('Route must have both an origin and destination point', { id: 'update-route' });
      throw new Error('Route must have both an origin and destination point');
    }
    
    // Get route geometry if we have enough points
    let routeGeometry: [number, number][] | undefined;
    if (route.points.length >= 2) {
      // Sort points by order
      const sortedPoints = [...route.points].sort((a, b) => a.order - b.order);
      const positions = sortedPoints.map(point => point.position);
      
      try {
        // Always recalculate directions between points when updating
        const directions = await getDirections(positions);
        routeGeometry = directions || positions;
      } catch (directionError) {
        // Continue with saving even if directions fail - we'll use straight lines
        toast.error('Could not calculate route along roads. Using straight lines instead.', { id: 'update-route' });
        
        // Create a simple straight-line path between all points
        routeGeometry = positions;
      }
    }
    
    const db = await initRoutesDB();
    
    const updatedRoute: Route = {
      ...route,
      updatedAt: new Date().toISOString(),
      routeGeometry
    };
    
    await db.put('routes', updatedRoute);
    
    // Update route points - first delete existing points
    const tx = db.transaction('route-points', 'readwrite');
    const pointsStore = tx.objectStore('route-points');
    const existingPoints = await pointsStore.index('by-route').getAll(route.id);
    
    for (const point of existingPoints) {
      await pointsStore.delete(point.id);
    }
    
    // Then add the new points
    for (const point of route.points) {
      await pointsStore.put({
        ...point,
        routeId: route.id
      });
    }
    
    await tx.done;

    toast.success('Route updated', { id: 'update-route' });
    return updatedRoute;
  } catch (error) {
    toast.error('Failed to update route', { id: 'update-route' });
    throw error;
  }
};

// Get all routes for a survey
export const getRoutesBySurvey = async (surveyId: string): Promise<Route[]> => {
  try {
    const db = await initRoutesDB();
    const routes = await db.getAllFromIndex('routes', 'by-survey', surveyId);
    
    // For each route, get its points
    for (const route of routes) {
      const points = await db.getAllFromIndex('route-points', 'by-route', route.id);
      route.points = points.sort((a, b) => a.order - b.order);
    }
    
    return routes;
  } catch (error) {
    return [];
  }
};

// Delete a route
export const deleteRoute = async (routeId: string) => {
  try {
    const db = await initRoutesDB();
    
    // Delete route points first
    const tx = db.transaction('route-points', 'readwrite');
    const pointsStore = tx.objectStore('route-points');
    const points = await pointsStore.index('by-route').getAll(routeId);
    
    for (const point of points) {
      await pointsStore.delete(point.id);
    }
    
    await tx.done;
    
    // Then delete the route
    await db.delete('routes', routeId);
    
    /* toast removed */
  } catch (error) {
    toast.error('Failed to delete route');
    throw error;
  }
};

// Import a route from a GeoJSON file
export const importRouteFromGeoJSON = async (fileContent: string, surveyId: string): Promise<Route | null> => {
  try {
    const geoJson = JSON.parse(fileContent);
    
    if (!geoJson.features || !Array.isArray(geoJson.features) || geoJson.features.length === 0) {
      toast.error('Invalid GeoJSON file');
      return null;
    }
    
    // Find the first LineString feature
    const lineFeature = geoJson.features.find(f => 
      f.geometry && f.geometry.type === 'LineString' && 
      Array.isArray(f.geometry.coordinates) && 
      f.geometry.coordinates.length > 0
    );
    
    if (!lineFeature) {
      toast.error('No valid route found in GeoJSON file');
      return null;
    }
    
    // Extract coordinates and convert from [lng, lat] to [lat, lng]
    const coordinates = lineFeature.geometry.coordinates.map(coord => 
      [coord[1], coord[0]] as [number, number]
    );
    
    // Create route points
    const points: RoutePoint[] = coordinates.map((coord, index) => ({
      id: crypto.randomUUID(),
      position: coord,
      type: index === 0 ? 'origin' : 
            index === coordinates.length - 1 ? 'destination' : 'waypoint',
      order: index
    }));
    
    // Create and save the route
    const routeName = lineFeature.properties?.name || `Imported Route ${new Date().toLocaleString()}`;
    
    // Apply RDP simplification for routeGeometry
    const RDP_EPSILON_GJ = 0.00005;
    const simplifiedGjGeometry = rdpSimplify(coordinates, RDP_EPSILON_GJ);

    const route: Omit<Route, 'id' | 'createdAt' | 'updatedAt'> = {
      name: routeName,
      description: lineFeature.properties?.description || 'Imported from GeoJSON',
      points,
      color: '#3b82f6',
      surveyId,
      routeGeometry: simplifiedGjGeometry
    };
    
    return await saveRoute(route);
  } catch (error) {
    toast.error('Failed to import route');
    return null;
  }
};

// Import a route from a GPX file
// Import route from KML file
export const importRouteFromKML = async (fileContent: string, surveyId: string): Promise<Route | null> => {
  try {
    // Parse KML XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(fileContent, 'text/xml');
    
    // Check for parsing errors
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      toast.error('Invalid KML file format');
      return null;
    }
    
    // Look for LineString coordinates (most common for routes/paths)
    const lineStrings = xmlDoc.querySelectorAll('LineString coordinates');
    const placemarks = xmlDoc.querySelectorAll('Placemark');
    
    let coordinates: [number, number][] = [];
    let routeName = 'Imported KML Route';
    let routeDescription = 'Imported from KML file';
    
    // Try to get route name from KML
    const nameElement = xmlDoc.querySelector('Document > name') || xmlDoc.querySelector('Placemark > name');
    if (nameElement?.textContent) {
      routeName = nameElement.textContent;
    }
    
    const descElement = xmlDoc.querySelector('Document > description') || xmlDoc.querySelector('Placemark > description');
    if (descElement?.textContent) {
      routeDescription = descElement.textContent;
    }
    
    // Extract coordinates from LineString (route/path)
    if (lineStrings.length > 0) {
      const coordText = lineStrings[0].textContent?.trim();
      if (coordText) {
        // KML format: lon,lat,elevation (space-separated points)
        coordinates = coordText.split(/\s+/).map(coord => {
          const parts = coord.split(',');
          const lon = parseFloat(parts[0]);
          const lat = parseFloat(parts[1]);
          return [lat, lon] as [number, number]; // Return as [lat, lon]
        }).filter(coord => !isNaN(coord[0]) && !isNaN(coord[1]));
      }
    }
    // Fall back to Placemark Point elements
    else if (placemarks.length > 0) {
      for (const placemark of Array.from(placemarks)) {
        const pointCoords = placemark.querySelector('Point coordinates')?.textContent?.trim();
        if (pointCoords) {
          const parts = pointCoords.split(',');
          const lon = parseFloat(parts[0]);
          const lat = parseFloat(parts[1]);
          if (!isNaN(lat) && !isNaN(lon)) {
            coordinates.push([lat, lon]);
          }
        }
      }
    }
    
    if (coordinates.length === 0) {
      toast.error('No valid coordinates found in KML file');
      return null;
    }
    
    if (coordinates.length < 2) {
      toast.error('KML must contain at least 2 points to create a route');
      return null;
    }
    
    // Create route points from coordinates
    const points: RoutePoint[] = coordinates.map((coord, index) => ({
      id: crypto.randomUUID(),
      position: coord,
      type: index === 0 ? 'origin' : index === coordinates.length - 1 ? 'destination' : 'waypoint',
      order: index
    }));
    
    // Apply RDP simplification for routeGeometry (rendering), preserve raw coords in points
    const RDP_EPSILON_KML = 0.00005; // ≈5m
    const simplifiedKmlGeometry = rdpSimplify(coordinates, RDP_EPSILON_KML);

    // Create the route object
    const route: Route = {
      id: crypto.randomUUID(),
      name: routeName,
      description: routeDescription,
      points,
      color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      surveyId,
      routeGeometry: simplifiedKmlGeometry
    };
    
    // Save to database
    const db = await initRoutesDB();
    await db.put('routes', route);
    
    return route;
  } catch (error) {
    console.error('Failed to import KML:', error);
    toast.error('Failed to import KML file');
    return null;
  }
};

export const importRouteFromGPX = async (fileContent: string, surveyId: string): Promise<Route | null> => {
  try {
    // Parse GPX XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(fileContent, 'text/xml');
    
    // Check for parsing errors
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      toast.error('Invalid GPX file format');
      return null;
    }
    
    // Look for track points (trkpt) or route points (rtept)
    const trackPoints = xmlDoc.querySelectorAll('trkpt');
    const routePoints = xmlDoc.querySelectorAll('rtept');
    const waypoints = xmlDoc.querySelectorAll('wpt');
    
    let coordinates: [number, number][] = [];
    let routeName = 'Imported GPX Route';
    let routeDescription = 'Imported from GPX file';
    
    // Try to get route name from GPX metadata
    const nameElement = xmlDoc.querySelector('name');
    if (nameElement?.textContent) {
      routeName = nameElement.textContent;
    }
    
    const descElement = xmlDoc.querySelector('desc');
    if (descElement?.textContent) {
      routeDescription = descElement.textContent;
    }
    
    // Extract coordinates from track points (most common in GPX)
    if (trackPoints.length > 0) {
      coordinates = Array.from(trackPoints).map(point => {
        const lat = parseFloat(point.getAttribute('lat') || '0');
        const lon = parseFloat(point.getAttribute('lon') || '0');
        return [lat, lon] as [number, number];
      });
    }
    // Fall back to route points
    else if (routePoints.length > 0) {
      coordinates = Array.from(routePoints).map(point => {
        const lat = parseFloat(point.getAttribute('lat') || '0');
        const lon = parseFloat(point.getAttribute('lon') || '0');
        return [lat, lon] as [number, number];
      });
    }
    // Fall back to waypoints
    else if (waypoints.length > 0) {
      coordinates = Array.from(waypoints).map(point => {
        const lat = parseFloat(point.getAttribute('lat') || '0');
        const lon = parseFloat(point.getAttribute('lon') || '0');
        return [lat, lon] as [number, number];
      });
    }
    
    if (coordinates.length < 2) {
      toast.error('GPX file must contain at least 2 points');
      return null;
    }
    
    // Apply RDP simplification for routeGeometry (rendering), preserve raw coords in points
    const RDP_EPSILON = 0.00005; // ≈5m
    const simplifiedGeometry = rdpSimplify(coordinates, RDP_EPSILON);
    
    // Create route points from the full-resolution coordinates
    const points: RoutePoint[] = coordinates.map((coord, index) => ({
      id: crypto.randomUUID(),
      position: coord,
      type: index === 0 ? 'origin' : 
            index === coordinates.length - 1 ? 'destination' : 'waypoint',
      order: index
    }));
    
    // Create and save the route
    const route: Omit<Route, 'id' | 'createdAt' | 'updatedAt'> = {
      name: routeName,
      description: routeDescription,
      points,
      color: '#3b82f6',
      surveyId,
      routeGeometry: simplifiedGeometry // Simplified geometry for rendering
    };
    
    const savedRoute = await saveRoute(route);
    
    /* toast removed */
    
    return savedRoute;
  } catch (error) {
    toast.error('Failed to import GPX route');
    return null;
  }
};

// Export a route to GeoJSON
export const exportRouteToGeoJSON = (route: Route): string => {
  // Sort points by order
  const sortedPoints = [...route.points].sort((a, b) => a.order - b.order);
  
  // Convert points to GeoJSON coordinates [lng, lat]
  const coordinates = sortedPoints.map(point => [point.position[1], point.position[0]]);
  
  const geoJson = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          name: route.name,
          description: route.description || '',
          color: route.color
        },
        geometry: {
          type: 'LineString',
          coordinates
        }
      }
    ]
  };
  
  return JSON.stringify(geoJson, null, 2);
};

// Optimize a route using a simple algorithm (for demo purposes)
// In a real app, you might use a routing service API
export const optimizeRoute = (route: Route): Route => {
  // This is a very simple optimization that just sorts waypoints by distance from origin
  // A real implementation would use a proper routing algorithm or external API
  
  // Find origin and destination
  const origin = route.points.find(p => p.type === 'origin');
  const destination = route.points.find(p => p.type === 'destination');
  
  if (!origin || !destination) {
    toast.error('Route must have an origin and destination');
    return route;
  }
  
  // Get waypoints
  const waypoints = route.points.filter(p => p.type === 'waypoint');
  
  // Sort waypoints by distance from origin
  const sortedWaypoints = [...waypoints].sort((a, b) => {
    const distA = calculateDistance(origin.position, a.position);
    const distB = calculateDistance(origin.position, b.position);
    return distA - distB;
  });
  
  // Create new points array with updated order
  const newPoints: RoutePoint[] = [
    { ...origin, order: 0 },
    ...sortedWaypoints.map((wp, idx) => ({ ...wp, order: idx + 1 })),
    { ...destination, order: sortedWaypoints.length + 1 }
  ];
  
  const optimizedRoute = {
    ...route,
    points: newPoints,
    updatedAt: new Date().toISOString()
  };
  
  return optimizedRoute;
};

// Calculate distance between two points (Haversine formula)
const calculateDistance = (point1: [number, number], point2: [number, number]): number => {
  const [lat1, lon1] = point1;
  const [lat2, lon2] = point2;
  
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};