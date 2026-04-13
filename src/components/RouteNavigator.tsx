import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L, { LatLngExpression } from 'leaflet';
import { Navigation, Play, Square, Volume2, VolumeX, Minimize2, Maximize2, ArrowUp, CornerDownRight, CornerDownLeft, CornerUpRight, CornerUpLeft, ArrowRight, ArrowLeft, X } from 'lucide-react';
import { Route } from '../lib/utils/routeUtils';
import { useGPSStore } from '../lib/stores/gpsStore';
import TurnByTurnNavigation from './TurnByTurnNavigation';
import { speakInstruction } from '../lib/utils/routeUtils';
import { toast } from 'sonner';
import { loadLeafletRoutingMachine } from '../lib/leaflet/loadLeafletRoutingMachine';

// Helper function to get instruction icon
const getInstructionIcon = (instruction: any) => {
  if (!instruction) return <ArrowUp className="w-4 h-4" />;
  
  const { type, modifier } = instruction;
  
  switch (type) {
    case 'turn':
      if (modifier === 'right') return <CornerDownRight className="w-4 h-4" />;
      if (modifier === 'left') return <CornerDownLeft className="w-4 h-4" />;
      if (modifier === 'slight right') return <CornerUpRight className="w-4 h-4" />;
      if (modifier === 'slight left') return <CornerUpLeft className="w-4 h-4" />;
      if (modifier === 'sharp right') return <ArrowRight className="w-4 h-4" />;
      if (modifier === 'sharp left') return <ArrowLeft className="w-4 h-4" />;
      return <ArrowUp className="w-4 h-4" />;
    case 'depart':
      return <ArrowUp className="w-4 h-4" />;
    case 'arrive':
      return <ArrowUp className="w-4 h-4 text-green-500" />;
    default:
      return <ArrowUp className="w-4 h-4" />;
  }
};

interface RouteNavigatorProps {
  route: Route;
  onClose: () => void;
  onMinimize?: () => void;
  isMinimized?: boolean;
}

const OFF_ROUTE_THRESHOLD_M = 80; // meters — consider off-route beyond this

interface RoutingMachineControlProps {
  route: Route;
  onInstructionsReady: (instructions: any[], _distance: number, time: number) => void;
  onLocationUpdate: (instructionIndex: number, distance: number, isOffRoute?: boolean) => void;
}

// Component to handle routing machine
const RoutingMachineControl = ({ route, onInstructionsReady, onLocationUpdate }: RoutingMachineControlProps) => {
  const map = useMap();
  const routingControlRef = useRef<any>(null);
  const { data: gpsData } = useGPSStore();
  const lastPositionRef = useRef<[number, number] | null>(null);
  const instructionsRef = useRef<any[]>([]);
  const currentInstructionIndexRef = useRef<number>(0);
  const [isRoutingLoaded, setIsRoutingLoaded] = useState(false);
  
  // Load leaflet-routing-machine
  useEffect(() => {
    let mounted = true;
    
    loadLeafletRoutingMachine()
      .then(() => {
        if (mounted) {
          setIsRoutingLoaded(true);
        }
      })
      .catch((error) => {
        console.error('Failed to load leaflet-routing-machine:', error);
      });
    
    return () => {
      mounted = false;
    };
  }, []);
  
  // Initialize routing machine after it's loaded
  useEffect(() => {
    if (!isRoutingLoaded) return;
    
    initializeRoutingControl();
    
    // Clean up
    return () => {
      if (routingControlRef.current && map) {
        try {
          map.removeControl(routingControlRef.current);
        } catch (e) {
          console.warn('Failed to remove routing control:', e);
        }
        routingControlRef.current = null;
      }
    };
  }, [map, route, isRoutingLoaded]);
  
  const initializeRoutingControl = () => {
    if (!map || !route || !route.points || route.points.length < 2) return;
    
    // Sort points by order
    const sortedPoints = [...route.points].sort((a, b) => a.order - b.order);
    
    // Create waypoints from route points
    const waypoints = sortedPoints.map(point => 
      L.latLng(point.position[0], point.position[1])
    );
    
    // Create routing control
    const routingControl = L.Routing.control({
      waypoints,
      routeWhileDragging: false,
      lineOptions: {
        styles: [
          { color: route.color || '#3b82f6', weight: 6, opacity: 0.7 }
        ],
        addWaypoints: false
      },
      createMarker: function() {
        return null; // Don't create markers for waypoints
      }
    }).addTo(map);
    
    // Store reference
    routingControlRef.current = routingControl;
    
    // Listen for route calculation
    routingControl.on('routesfound', (e: any) => {
      const routes = e.routes;
      if (routes && routes.length > 0) {
        const foundRoute = routes[0];
        
        // Get instructions
        const instructions = foundRoute.instructions.map((instruction: any) => ({
          text: instruction.text,
          distance: instruction.distance,
          time: instruction.time,
          type: instruction.type,
          modifier: instruction.modifier,
          icon: null // Will be set in the TurnByTurnNavigation component
        }));
        
        // Store instructions
        instructionsRef.current = instructions;
        
        // Notify parent
        onInstructionsReady(instructions, foundRoute.summary.totalDistance, foundRoute.summary.totalTime);
      }
    });
  };
  
  // Update current position and check for instruction changes
  useEffect(() => {
    if (!gpsData || !gpsData.latitude || !gpsData.longitude) return;
    
    const currentPosition: [number, number] = [gpsData.latitude, gpsData.longitude];
    
    // Skip if position hasn't changed significantly
    if (lastPositionRef.current && 
        Math.abs(lastPositionRef.current[0] - currentPosition[0]) < 0.00001 &&
        Math.abs(lastPositionRef.current[1] - currentPosition[1]) < 0.00001) {
      return;
    }
    
    // Update last position
    lastPositionRef.current = currentPosition;
    
    // Check if we're close to any instruction point
    if (instructionsRef.current.length > 0 && routingControlRef.current) {
      const router = routingControlRef.current.getRouter();
      if (!router || !router.route) return;
      
      // Find the closest instruction
      let minDistance = Infinity;
      let closestInstructionIndex = 0;
      
      instructionsRef.current.forEach((_instruction, index) => {
        // Calculate distance to instruction
        const distance = calculateDistanceToInstruction(currentPosition, router.route, index);
        
        if (distance < minDistance) {
          minDistance = distance;
          closestInstructionIndex = index;
        }
      });
      
      const isOffRoute = minDistance > OFF_ROUTE_THRESHOLD_M;

      // If we're close to the next instruction, update current instruction index
      if (closestInstructionIndex !== currentInstructionIndexRef.current) {
        currentInstructionIndexRef.current = closestInstructionIndex;

        // Notify parent
        onLocationUpdate(
          closestInstructionIndex,
          minDistance,
          isOffRoute
        );
      } else {
        // Just update the distance
        onLocationUpdate(
          currentInstructionIndexRef.current,
          minDistance,
          isOffRoute
        );
      }
    }
  }, [gpsData, onLocationUpdate]);
  
  // Helper function to calculate distance to an instruction
  const calculateDistanceToInstruction = (
    currentPosition: [number, number],
    routeData: any,
    instructionIndex: number
  ): number => {
    // This is a simplified calculation
    // In a real app, you would use the actual route geometry
    if (!routeData.coordinates || !routeData.coordinates[instructionIndex]) {
      return Infinity;
    }
    
    const instructionPosition = routeData.coordinates[instructionIndex];
    
    // Calculate haversine distance
    const R = 6371e3; // Earth radius in meters
    const φ1 = currentPosition[0] * Math.PI / 180;
    const φ2 = instructionPosition.lat * Math.PI / 180;
    const Δφ = (instructionPosition.lat - currentPosition[0]) * Math.PI / 180;
    const Δλ = (instructionPosition.lng - currentPosition[1]) * Math.PI / 180;
    
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c; // Distance in meters
  };
  
  return null;
};

// Component to handle current position marker
const PositionMarker = () => {
  const map = useMap();
  const { data: gpsData } = useGPSStore();
  const markerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.CircleMarker | null>(null);
  const headingMarkerRef = useRef<L.Marker | null>(null);
  
  // Update marker position when GPS data changes
  useEffect(() => {
    if (!gpsData || !gpsData.latitude || !gpsData.longitude) return;
    
    const position: [number, number] = [gpsData.latitude, gpsData.longitude];
    
    // Create position icon
    const positionIcon = L.divIcon({
      className: 'bg-transparent',
      html: `<div class="relative">
        <div class="absolute w-4 h-4 bg-blue-500 rounded-full border-2 border-white animate-ping"></div>
        <div class="absolute w-4 h-4 bg-blue-500 rounded-full border-2 border-white"></div>
      </div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });
    
    // Create heading icon
    const createHeadingIcon = (heading: number) => {
      return L.divIcon({
        className: 'bg-transparent',
        html: `<div class="relative" style="transform: rotate(${heading}deg)">
          <div class="w-6 h-6 bg-blue-500 rounded-full border-2 border-white flex items-center justify-center">
            <div class="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[10px] border-b-white transform -translate-y-1"></div>
          </div>
        </div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });
    };
    
    // Create or update position marker
    if (!markerRef.current) {
      markerRef.current = L.marker(position, { icon: positionIcon }).addTo(map);
    } else {
      markerRef.current.setLatLng(position);
      markerRef.current.setIcon(positionIcon);
    }
    
    // Create or update accuracy circle
    if (!accuracyCircleRef.current) {
      accuracyCircleRef.current = L.circle(position, {
        radius: gpsData.hdop * 5 || 10,
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.1,
        weight: 1
      }).addTo(map);
    } else {
      accuracyCircleRef.current.setLatLng(position);
      accuracyCircleRef.current.setRadius(gpsData.hdop * 5 || 10);
    }
    
    // Create or update heading marker if we have a valid course
    if (gpsData.course && gpsData.course > 0) {
      const headingIcon = createHeadingIcon(gpsData.course);
      if (!headingMarkerRef.current) {
        headingMarkerRef.current = L.marker(position, { 
          icon: headingIcon,
          zIndexOffset: 1000
        }).addTo(map);
      } else {
        headingMarkerRef.current.setLatLng(position);
        headingMarkerRef.current.setIcon(headingIcon);
      }
    }
    
    // Center map on current position
    map.setView(position, map.getZoom());
  }, [gpsData, map]);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
      }
      if (accuracyCircleRef.current) {
        map.removeLayer(accuracyCircleRef.current);
      }
      if (headingMarkerRef.current) {
        map.removeLayer(headingMarkerRef.current);
      }
    };
  }, [map]);
  
  return null;
};

const RouteNavigator: React.FC<RouteNavigatorProps> = ({ route, onClose }) => {
  const [isNavigating, setIsNavigating] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [instructions, setInstructions] = useState<any[]>([]);
  const [currentInstructionIndex, setCurrentInstructionIndex] = useState(0);
  const [distanceToNextInstruction, setDistanceToNextInstruction] = useState(0);
  const [estimatedTimeToArrival, setEstimatedTimeToArrival] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [isRoutingReady, setIsRoutingReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isOffRoute, setIsOffRoute] = useState(false);
  const offRouteAnnouncedRef = useRef(false); // Prevents spam — only announce once per deviation
  const { data: gpsData } = useGPSStore();
  
  // CRITICAL: Load routing machine BEFORE rendering MapContainer
  // This prevents "G is not a constructor" error in production
  useEffect(() => {
    let mounted = true;
    
    loadLeafletRoutingMachine()
      .then(() => {
        if (mounted) {
          setIsRoutingReady(true);
        }
      })
      .catch((error) => {
        console.error('Failed to load routing module:', error);
        if (mounted) {
          setLoadError('Failed to load navigation module. Please try again.');
        }
      });
    
    return () => {
      mounted = false;
    };
  }, []);
  
  // Handle instructions ready
  const handleInstructionsReady = (instructions: any[], _distance: number, time: number) => {
    setInstructions(instructions);
    
    // Calculate ETA
    const now = new Date();
    const eta = new Date(now.getTime() + time * 1000);
    setEstimatedTimeToArrival(eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  };
  
  // Handle location updates (with off-route detection)
  const handleLocationUpdate = (instructionIndex: number, distance: number, offRoute?: boolean) => {
    setCurrentInstructionIndex(instructionIndex);
    setDistanceToNextInstruction(Math.round(distance));

    if (offRoute && !isOffRoute) {
      // Just went off-route — announce ONCE
      setIsOffRoute(true);
      if (!isMuted && !offRouteAnnouncedRef.current) {
        offRouteAnnouncedRef.current = true;
        speakInstruction('Off route.');
      }
    } else if (!offRoute && isOffRoute) {
      // Back on route — reset so we can announce again if they deviate later
      setIsOffRoute(false);
      offRouteAnnouncedRef.current = false;
    }
  };
  
  // Start navigation
  const startNavigation = () => {
    setIsNavigating(true);
    
    // Announce start of navigation
    if (!isMuted) {
      speakInstruction(`Starting navigation for route ${route.name}. Follow the instructions on screen.`);
    }
    
    // toast suppressed
  };
  
  // Stop navigation
  const stopNavigation = () => {
    setIsNavigating(false);
    
    // Announce end of navigation
    if (!isMuted) {
      speakInstruction('Navigation stopped.');
    }
    
    // toast suppressed
    onClose();
  };
  
  // Toggle mute
  const toggleMute = () => {
    setIsMuted(!isMuted);
    
    if (isMuted) {
      speakInstruction('Voice guidance enabled');
    } else {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
    }
  };
  
  // Handle minimize/maximize
  const handleMinimize = () => {
    setIsMinimized(true);
  };

  const handleMaximize = () => {
    setIsMinimized(false);
  };

  // Esc to fully close the navigator (most fullscreen overlays do this — was missing here).
  // Only listens while maximized so it doesn't trap the key when collapsed to the corner widget.
  useEffect(() => {
    if (isMinimized) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMinimized, onClose]);

  // Compute center position for map
  const mapCenter: LatLngExpression = (gpsData.latitude !== 0 && gpsData.longitude !== 0) 
    ? [gpsData.latitude, gpsData.longitude] 
    : [45.5017, -73.5673];

  // If minimized, render as a compact overlay
  if (isMinimized) {
    return (
      <div className={`fixed bottom-4 right-4 bg-gray-800 border rounded-lg shadow-lg p-4 z-[10000] max-w-sm ${isOffRoute ? 'border-red-500' : 'border-gray-700'}`}>
        {isOffRoute && (
          <div className="bg-red-600/20 text-red-300 text-xs font-bold px-2 py-1 rounded mb-2 text-center">
            OFF ROUTE
          </div>
        )}
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Navigation className="w-4 h-4 text-blue-400" />
            Navigating: {route.name}
          </h3>
          <div className="flex items-center gap-1">
            <button
              onClick={handleMaximize}
              className="p-1 bg-gray-700 hover:bg-gray-600 rounded"
              title="Maximize Navigation"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={stopNavigation}
              className="p-1 bg-red-600 hover:bg-red-700 rounded"
              title="Stop Navigation"
            >
              <Square className="w-3 h-3" />
            </button>
          </div>
        </div>
        
        {isNavigating && instructions[currentInstructionIndex] && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="bg-blue-500 p-1 rounded">
                {getInstructionIcon(instructions[currentInstructionIndex])}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {instructions[currentInstructionIndex].text}
                </p>
                <p className="text-xs text-gray-400">
                  {distanceToNextInstruction < 1000 
                    ? `${distanceToNextInstruction} m` 
                    : `${(distanceToNextInstruction / 1000).toFixed(1)} km`}
                </p>
              </div>
            </div>
            
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>ETA: {estimatedTimeToArrival}</span>
              <button
                onClick={toggleMute}
                className="p-1 bg-gray-700 hover:bg-gray-600 rounded"
              >
                {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }
  
  // Show loading/error state — compact overlay instead of full-screen block
  if (!isRoutingReady) {
    return (
      <div className="fixed bottom-4 right-4 bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-4 z-[10000] max-w-sm">
        {loadError ? (
          <div className="flex items-center gap-3">
            <Navigation className="w-4 h-4 text-red-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-white">{route.name}</p>
              <p className="text-xs text-red-400">Navigation module unavailable</p>
            </div>
            <button
              onClick={onClose}
              className="p-1 bg-red-600 hover:bg-red-700 rounded"
              title="Stop Navigation"
            >
              <Square className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin shrink-0"></div>
            <p className="text-sm text-gray-400">Loading navigation...</p>
          </div>
        )}
      </div>
    );
  }
  
  return (
    <div className="fixed inset-0 bg-gray-900 z-[10000] flex flex-col">
      <div className="p-4 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Navigation className="w-6 h-6 text-blue-400" />
          Navigate: {route.name}
        </h2>
        <div className="flex items-center gap-4">
          <button
            onClick={toggleMute}
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded-full"
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
          <button
            onClick={handleMinimize}
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded-full"
            title="Minimize Navigation (Esc to close)"
          >
            <Minimize2 className="w-5 h-5" />
          </button>
          {!isNavigating ? (
            <button
              onClick={startNavigation}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg"
            >
              <Play className="w-5 h-5" />
              Start Navigation
            </button>
          ) : (
            <button
              onClick={stopNavigation}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg"
            >
              <Square className="w-5 h-5" />
              Stop Navigation
            </button>
          )}
          {/* Always-visible Close button — works even before navigation starts, so the
              user can never get stuck in this fullscreen overlay. */}
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg border border-gray-600"
            data-testid="button-close-navigator"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
            <span>Close</span>
          </button>
        </div>
      </div>
      
      <div className="flex-1 relative">
        <MapContainer
          center={mapCenter}
          zoom={15}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
          />
          
          <PositionMarker />
          
          <RoutingMachineControl 
            route={route}
            onInstructionsReady={handleInstructionsReady}
            onLocationUpdate={handleLocationUpdate}
          />
        </MapContainer>
      </div>
      
      <TurnByTurnNavigation
        instructions={instructions}
        currentInstructionIndex={currentInstructionIndex}
        distanceToNextInstruction={distanceToNextInstruction}
        estimatedTimeToArrival={estimatedTimeToArrival}
        isMuted={isMuted}
        onToggleMute={toggleMute}
        isNavigating={isNavigating}
        onStopNavigation={stopNavigation}
      />
    </div>
  );
};

export default RouteNavigator;
