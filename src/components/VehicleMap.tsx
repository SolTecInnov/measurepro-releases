import React, { useState, useEffect, useRef, lazy, Suspense, useCallback, useMemo, memo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Navigation, MapPin, Flag, WifiOff, Route as RouteIcon, Maximize2, CloudRain, Cloud } from 'lucide-react';
import WeatherCard from './map/WeatherCard';
import { fetchWeatherData, getRadarTileUrl, type WeatherData } from '../lib/weather/weatherService';
import { useGPSStore } from '../lib/stores/gpsStore';
import { useSurveyStore } from '../lib/survey';
import { useSettingsStore } from '../lib/settings';
import { openSurveyDB } from '../lib/survey/db';
import { POI_TYPES, usePOIStore } from '../lib/poi';
import { toast } from 'sonner';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import POIDetailsModal from './POIDetailsModal';
import { logger } from '@/lib/utils/logger';
import { useMapMeasurements } from '../hooks/useMeasurementFeed';
import { isBetaUser } from '../lib/auth/masterAdmin';
import { useEnabledFeatures } from '../hooks/useLicenseEnforcement';
import { getSafeAuth } from '../lib/firebase';
import type { Measurement } from '../lib/survey/types';

const RouteManager = lazy(() => import('./RouteManager'));
const RouteNavigator = lazy(() => import('./RouteNavigator'));

// Fix Leaflet default markers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// POI Icon Cache - prevents recreation of L.divIcon on every render
const poiIconCache = new Map<string, L.DivIcon>();

const getCachedPOIIcon = (poiType: string): L.DivIcon | null => {
  if (poiIconCache.has(poiType)) {
    return poiIconCache.get(poiType)!;
  }
  
  const poiConfig = POI_TYPES.find(poi => poi.type === poiType);
  if (!poiConfig) return null;
  
  const icon = L.divIcon({
    className: 'bg-transparent',
    html: `<div class="w-6 h-6 ${poiConfig.bgColor} ${poiConfig.color} rounded-full border-2 border-white flex items-center justify-center shadow-lg">
      <div class="w-3 h-3 bg-current rounded-full"></div>
    </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
  
  poiIconCache.set(poiType, icon);
  return icon;
};

// CRITICAL FIX: Memoized POI Marker component with stable event handlers
// This prevents the "20-30 clicks to open modal" bug by keeping event handlers stable
interface POIMarkerProps {
  measurement: Measurement;
  onPOIClick: (measurement: Measurement) => void;
}

const POIMarker = memo(({ measurement, onPOIClick }: POIMarkerProps) => {
  const icon = getCachedPOIIcon(measurement.poi_type || 'none');
  
  // Create stable event handlers object using useMemo
  const eventHandlers = useMemo(() => ({
    click: () => onPOIClick(measurement)
  }), [measurement.id, onPOIClick]); // Only recreate if measurement ID or handler changes
  
  if (!icon || !measurement.latitude || !measurement.longitude) {
    return null;
  }
  
  return (
    <Marker
      position={[measurement.latitude, measurement.longitude]}
      icon={icon}
      zIndexOffset={1000}
      eventHandlers={eventHandlers}
    >
      <Popup>
        <div className="text-sm">
          <div className="font-medium mb-2">
            POI {measurement.id.substring(0, 8)}
          </div>
          <div className="space-y-1">
            <div><strong>Type:</strong> {measurement.poi_type || 'none'}</div>
            <div><strong>Height:</strong> {measurement.rel != null ? measurement.rel.toFixed(2) + 'm' : 'N/A'}</div>
            <div><strong>Time:</strong> {measurement.utcTime}</div>
            {measurement.note && (
              <div><strong>Note:</strong> {measurement.note}</div>
            )}
          </div>
          <button
            onClick={() => onPOIClick(measurement)}
            className="mt-2 px-2 py-1 bg-blue-500 text-white rounded text-xs"
            data-testid={`button-poi-details-${measurement.id}`}
          >
            View Details
          </button>
        </div>
      </Popup>
    </Marker>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if measurement ID changes or it's a different measurement
  return prevProps.measurement.id === nextProps.measurement.id &&
         prevProps.measurement.latitude === nextProps.measurement.latitude &&
         prevProps.measurement.longitude === nextProps.measurement.longitude &&
         prevProps.measurement.poi_type === nextProps.measurement.poi_type;
});

POIMarker.displayName = 'POIMarker';

interface Route {
  id: string;
  name: string;
  description?: string;
  points: Array<{
    id: string;
    position: [number, number];
    type: 'origin' | 'waypoint' | 'destination';
    order: number;
  }>;
  color: string;
  routeGeometry?: [number, number][];
}

// Component to handle map clicks for route creation
const MapClickHandler = ({ 
  routeCreationMode, 
  onAddPoint, 
  onClearMode 
}: { 
  routeCreationMode: 'origin' | 'waypoint' | 'destination' | null;
  onAddPoint: (position: [number, number], type: 'origin' | 'waypoint' | 'destination') => void;
  onClearMode: () => void;
}) => {
  useMapEvents({
    click: (e) => {
      if (routeCreationMode) {
        const { lat, lng } = e.latlng;
        onAddPoint([lat, lng], routeCreationMode);
        onClearMode();
        // toast suppressed
      }
    }
  });
  
  return null;
};

// Component to handle current position marker
const PositionMarker = () => {
  const map = useMap();
  const { data: gpsData } = useGPSStore();
  const markerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  
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
  
  // Update marker position when GPS data changes
  useEffect(() => {
    logger.debug('📍 PositionMarker: GPS data:', gpsData);
    
    if (!gpsData || !gpsData.latitude || !gpsData.longitude) {
      logger.debug('📍 PositionMarker: No GPS data or invalid coordinates');
      return;
    }
    
    const position: [number, number] = [gpsData.latitude, gpsData.longitude];
    logger.debug('📍 PositionMarker: Creating/updating marker at:', position);
    
    // Create or update position marker
    if (!markerRef.current) {
      markerRef.current = L.marker(position, { icon: positionIcon }).addTo(map);
      logger.debug('📍 PositionMarker: Created new marker');
    } else {
      markerRef.current.setLatLng(position);
      logger.debug('📍 PositionMarker: Updated marker position');
    }
    
    // Create or update accuracy circle
    if (!accuracyCircleRef.current) {
      accuracyCircleRef.current = L.circle(position, {
        radius: gpsData.hdop * 5 || 10,
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.1,
        weight: 1,
        interactive: false  // FIX: Don't block POI marker clicks
      }).addTo(map);
      logger.debug('📍 PositionMarker: Created accuracy circle');
    } else {
      accuracyCircleRef.current.setLatLng(position);
      accuracyCircleRef.current.setRadius(gpsData.hdop * 5 || 10);
      logger.debug('📍 PositionMarker: Updated accuracy circle');
    }
    
    // Center map on current position if this is the first GPS fix
    if (gpsData.fixQuality !== 'No Fix') {
      map.setView(position, map.getZoom());
      logger.debug('📍 PositionMarker: Centered map on position');
    }
  }, [gpsData, map, positionIcon]);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
      }
      if (accuracyCircleRef.current) {
        map.removeLayer(accuracyCircleRef.current);
      }
    };
  }, [map]);
  
  return null;
};

const VehicleMap: React.FC = () => {
  const { data: gpsData } = useGPSStore();
  const { activeSurvey } = useSurveyStore();
  const { mapSettings } = useSettingsStore();
  const selectedPOIType = usePOIStore(s => s.selectedType);
  const { isOnline, wasOnlineAtStart } = useOnlineStatus();
  
  // PERFORMANCE FIX: Use in-memory cache instead of IndexedDB queries
  const measurements = useMapMeasurements(100);
  
  // Check if beta user (hide create route button for beta/not-logged-in users)
  const auth = getSafeAuth();
  const { features } = useEnabledFeatures();
  const isBeta = isBetaUser(auth?.currentUser, features);

  const [routes, setRoutes] = useState<Route[]>([]);
  const [visibleRoutes, setVisibleRoutes] = useState<Set<string>>(new Set());

  // Navigation to start point
  const [navigationToStart, setNavigationToStart] = useState<{
    route: Route;
    path: [number, number][];
  } | null>(null);

  // Route navigation (lifted from RouteManager so it persists when modal closes)
  const [activeNavRoute, setActiveNavRoute] = useState<Route | null>(null);

  // Auto-load routes when survey changes (persist across modal open/close)
  useEffect(() => {
    if (!activeSurvey?.id) { setRoutes([]); setVisibleRoutes(new Set()); return; }
    import('../lib/utils/routeUtils').then(({ getRoutesBySurvey }) => {
      getRoutesBySurvey(activeSurvey.id).then(surveyRoutes => {
        setRoutes(surveyRoutes);
        setVisibleRoutes(new Set(surveyRoutes.map(r => r.id)));
      }).catch(() => {});
    });
  }, [activeSurvey?.id]);

  // Route creation state
  const [showRouteCreator, setShowRouteCreator] = useState(false);
  const [showRouteManager, setShowRouteManager] = useState(false);

  // Weather & radar state (independent toggles)
  const [radarActive, setRadarActive] = useState(false);
  const [weatherCardOpen, setWeatherCardOpen] = useState(false);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [radarTileUrl, setRadarTileUrl] = useState<string | null>(null);
  const radarRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const toggleRadar = useCallback(async () => {
    if (radarActive) {
      setRadarActive(false);
      setRadarTileUrl(null);
      if (radarRefreshRef.current) { clearInterval(radarRefreshRef.current); radarRefreshRef.current = null; }
      return;
    }
    setRadarActive(true);
    try {
      const url = await getRadarTileUrl();
      setRadarTileUrl(url);
      if (radarRefreshRef.current) clearInterval(radarRefreshRef.current);
      radarRefreshRef.current = setInterval(async () => {
        const u = await getRadarTileUrl();
        setRadarTileUrl(u);
      }, 5 * 60 * 1000);
    } catch {
      toast.error('Radar unavailable');
      setRadarActive(false);
    }
  }, [radarActive]);

  const toggleWeatherCard = useCallback(async () => {
    if (weatherCardOpen) {
      setWeatherCardOpen(false);
      return;
    }
    const { data: gps } = useGPSStore.getState();
    const lat = gps.latitude || 45.5;
    const lon = gps.longitude || -73.6;
    try {
      const data = await fetchWeatherData(lat, lon);
      setWeatherData(data);
      setWeatherCardOpen(true);
    } catch {
      toast.error('Weather unavailable');
    }
  }, [weatherCardOpen]);

  useEffect(() => {
    return () => { if (radarRefreshRef.current) clearInterval(radarRefreshRef.current); };
  }, []);

  // Listen for navigation events from RouteManager
  useEffect(() => {
    const handleNavRequest = (e: CustomEvent) => {
      setActiveNavRoute(e.detail);
      setShowRouteManager(false); // Close modal when navigating
    };
    window.addEventListener('route-navigate-request', handleNavRequest as EventListener);
    return () => window.removeEventListener('route-navigate-request', handleNavRequest as EventListener);
  }, []);

  // Listen for open-route-manager event (from fullscreen map)
  useEffect(() => {
    const open = () => setShowRouteManager(true);
    window.addEventListener('open-route-manager', open);
    return () => window.removeEventListener('open-route-manager', open);
  }, []);
  const [routeCreationMode, setRouteCreationMode] = useState<'origin' | 'waypoint' | 'destination' | null>(null);
  const [tempRoute, setTempRoute] = useState({
    name: '',
    description: '',
    color: '#3b82f6',
    points: [] as Array<{
      id: string;
      position: [number, number];
      type: 'origin' | 'waypoint' | 'destination';
      order: number;
    }>,
    routeGeometry: [] as [number, number][]
  });
  
  // POI details modal
  const [selectedPOI, setSelectedPOI] = useState<any>(null);
  const [showPOIDetails, setShowPOIDetails] = useState(false);

  // Route creation functions
  const handleAddRoutePoint = (position: [number, number], type: 'origin' | 'waypoint' | 'destination') => {
    const newPoint = {
      id: crypto.randomUUID(),
      position,
      type,
      order: tempRoute.points.length
    };
    
    setTempRoute(prev => ({
      ...prev,
      points: [...prev.points, newPoint]
    }));
  };

  const handleSaveRoute = async () => {
    if (!tempRoute.name.trim()) {
      toast.error('Please enter a route name');
      return;
    }

    const hasOrigin = tempRoute.points.some(p => p.type === 'origin');
    const hasDestination = tempRoute.points.some(p => p.type === 'destination');

    if (!hasOrigin || !hasDestination) {
      toast.error('Route must have both origin and destination');
      return;
    }

    try {
      // Create new route
      const newRoute: Route = {
        id: crypto.randomUUID(),
        name: tempRoute.name,
        description: tempRoute.description,
        points: tempRoute.points,
        color: tempRoute.color,
        routeGeometry: tempRoute.routeGeometry
      };
      
      setRoutes(prev => [...prev, newRoute]);
      
      // Make new route visible
      setVisibleRoutes(prev => new Set([...prev, newRoute.id]));
      
      // Reset temp route
      setTempRoute({
        name: '',
        description: '',
        color: '#3b82f6',
        points: [],
        routeGeometry: []
      });
      
      setShowRouteCreator(false);
      setRouteCreationMode(null);
      
      // toast suppressed
    } catch (error) {
      toast.error('Failed to save route');
    }
  };

  // POI click handler - CRITICAL: useCallback prevents recreation on every render
  // This fixes the "dozens of clicks" bug by keeping event handlers stable
  const handlePOIClick = useCallback((measurement: Measurement) => {
    setSelectedPOI(measurement);
    setShowPOIDetails(true);
  }, []); // Empty deps - only setState which is stable

  // Get map tile config based on settings
  const getMapTileConfig = () => {
    const provider = mapSettings?.provider || 'osm';
    const style = mapSettings?.style || 'default';

    if (provider === 'google') {
      const lyrs = style === 'satellite' ? 's' : style === 'terrain' ? 'p' : style === 'hybrid' ? 'y' : 'm';
      return {
        url: `https://mt1.google.com/vt/lyrs=${lyrs}&x={x}&y={y}&z={z}`,
        attribution: '&copy; <a href="https://www.google.com/maps" target="_blank" rel="noopener noreferrer">Google Maps</a>',
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      };
    }
    // OSM via Carto CDN (openstreetmap.org blocks Electron's User-Agent with 403)
    return {
      url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> &copy; <a href="https://carto.com/" target="_blank" rel="noopener noreferrer">CARTO</a>',
      subdomains: ['a', 'b', 'c', 'd'],
    };
  };
  const tileConfig = getMapTileConfig();
  const isOSM = (mapSettings?.provider || 'osm') === 'osm';


  return (
    <div className="bg-gray-800 rounded-xl overflow-hidden h-[400px] flex flex-col">
      {/* Map Container */}
      <div className="flex-1 relative overflow-hidden">
        {/* Block map ONLY if offline AND using Google (no cached tiles).
            OSM works offline if the user has downloaded tiles, so always show it. */}
        {!isOnline && !isOSM && !wasOnlineAtStart ? (
          <div className="h-full flex items-center justify-center bg-gray-900">
            <div className="text-center p-6">
              <WifiOff className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Map Offline</h3>
              <p className="text-gray-400">
                Google Maps requires internet. Switch to OpenStreetMap in Settings to use cached offline tiles.
              </p>
            </div>
          </div>
        ) : (
          <MapContainer
            center={gpsData.latitude !== 0 && gpsData.longitude !== 0 ? [gpsData.latitude, gpsData.longitude] : [45.5017, -73.5673]}
            zoom={mapSettings?.zoom || 13}
            style={{ height: '100%', width: '100%' }}
            className="leaflet-container"
          >
            <TileLayer
              key={tileConfig.url}
              url={tileConfig.url}
              attribution={tileConfig.attribution}
              maxZoom={20}
              subdomains={tileConfig.subdomains}
              tileSize={256}
              zoomOffset={0}
            />

            {/* Precipitation Radar Overlay (RainViewer) */}
            {radarActive && radarTileUrl && (
              <TileLayer
                key={radarTileUrl}
                url={radarTileUrl}
                opacity={0.75}
                maxZoom={20}
                tileSize={256}
                zoomOffset={0}
              />
            )}

          {/* Current Position Marker */}
          <PositionMarker />
          
          {/* Map Click Handler for Route Creation */}
          <MapClickHandler
            routeCreationMode={routeCreationMode}
            onAddPoint={handleAddRoutePoint}
            onClearMode={() => setRouteCreationMode(null)}
          />
          
          {/* POI Markers - Using memoized component for stable event handlers */}
          {measurements.map((measurement) => (
            <POIMarker
              key={measurement.id}
              measurement={measurement}
              onPOIClick={handlePOIClick}
            />
          ))}
          
          {/* Route Polylines */}
          {routes.filter(route => visibleRoutes.has(route.id)).map(route => {
            const positions = route.routeGeometry || route.points.map(p => p.position);
            return (
              <Polyline
                key={route.id}
                positions={positions}
                color={route.color || '#3b82f6'}
                weight={8}
                opacity={0.85}
                interactive={false}
              />
            );
          })}
          
          {/* Navigation to Start Point - Green Route */}
          {navigationToStart && (
            <Polyline
              positions={navigationToStart.path}
              color="#22c55e"
              weight={8}
              opacity={0.9}
              dashArray="12, 6"
              interactive={false}
            />
          )}
          
          {/* Temp Route Points (during creation) */}
          {tempRoute.points.map(point => (
            <Marker
              key={point.id}
              position={point.position}
              icon={L.divIcon({
                className: 'bg-transparent',
                html: `<div class="w-6 h-6 ${
                  point.type === 'origin' ? 'bg-green-500' :
                  point.type === 'destination' ? 'bg-purple-500' :
                  'bg-blue-500'
                } rounded-full border-2 border-white shadow-lg flex items-center justify-center">
                  ${point.type === 'origin' ? '<div class="w-2 h-2 bg-white rounded-full"></div>' :
                    point.type === 'destination' ? '<div class="w-2 h-2 bg-white rounded-full"></div>' :
                    '<div class="w-2 h-2 bg-white rounded-full"></div>'}
                </div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
              })}
            >
              <Popup>
                <div className="text-sm">
                  <div className="font-medium capitalize">{point.type}</div>
                  <div className="text-xs text-gray-600">
                    {point.position[0].toFixed(6)}, {point.position[1].toFixed(6)}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
        )}
        
        {/* Radar + Weather + Routes + Fullscreen Buttons */}
        <div className="absolute top-4 right-4 z-[10] flex items-center gap-1.5">
          <button
            onClick={toggleRadar}
            className={`flex items-center gap-1 text-white text-xs font-medium px-2 py-1.5 rounded-lg shadow-lg border backdrop-blur-sm transition-colors ${
              radarActive
                ? 'bg-blue-600/80 hover:bg-blue-700 border-blue-400'
                : 'bg-gray-900/80 hover:bg-gray-800 border-gray-600'
            }`}
            title={radarActive ? 'Hide radar' : 'Show precipitation radar'}
            data-testid="button-radar-toggle"
          >
            <CloudRain className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={toggleWeatherCard}
            className={`flex items-center gap-1 text-white text-xs font-medium px-2 py-1.5 rounded-lg shadow-lg border backdrop-blur-sm transition-colors ${
              weatherCardOpen
                ? 'bg-amber-600/80 hover:bg-amber-700 border-amber-400'
                : 'bg-gray-900/80 hover:bg-gray-800 border-gray-600'
            }`}
            title={weatherCardOpen ? 'Hide forecast' : 'Show precipitation forecast'}
            data-testid="button-weather-toggle"
          >
            <Cloud className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowRouteManager(true)}
            data-testid="button-open-route-manager"
            className="flex items-center gap-1.5 bg-gray-900/80 hover:bg-gray-800 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg border border-gray-600 backdrop-blur-sm transition-colors"
            title="Manage Routes"
          >
            <RouteIcon className="w-3.5 h-3.5 text-blue-400" />
            Routes
          </button>
          <button
            onClick={() => window.dispatchEvent(new Event('open-fullscreen-map'))}
            className="flex items-center gap-1 bg-gray-900/80 hover:bg-gray-800 text-white text-xs font-medium px-2 py-1.5 rounded-lg shadow-lg border border-gray-600 backdrop-blur-sm transition-colors"
            title="Fullscreen map"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Weather Forecast Card */}
        {weatherCardOpen && weatherData && (
          <div className="absolute top-14 right-4 z-[11]">
            <WeatherCard weather={weatherData} onClose={toggleWeatherCard} />
          </div>
        )}

        {/* Route Creation Mode Indicator */}
        {routeCreationMode && (
          <div className="absolute top-4 left-4 bg-blue-600 text-white px-3 py-2 rounded-lg shadow-lg z-[10]">
            <div className="flex items-center gap-2">
              {routeCreationMode === 'origin' && <MapPin className="w-4 h-4" />}
              {routeCreationMode === 'waypoint' && <Navigation className="w-4 h-4" />}
              {routeCreationMode === 'destination' && <Flag className="w-4 h-4" />}
              <span>Click map to add {routeCreationMode}</span>
            </div>
          </div>
        )}
        
        {/* GPS Status Indicator */}
        <div className="absolute bottom-4 left-4 bg-black/70 text-white px-3 py-2 rounded-lg text-sm z-[10]">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              gpsData.fixQuality === 'GPS Fix' || gpsData.fixQuality === 'DGPS Fix' ? 'bg-green-500' : 'bg-red-500'
            }`} />
            <span>
              {gpsData.latitude !== 0 && gpsData.longitude !== 0
                ? `${gpsData.latitude.toFixed(6)}°, ${gpsData.longitude.toFixed(6)}°`
                : 'No GPS Fix'}
            </span>
          </div>
          {gpsData.speed > 0 && (
            <div className="text-xs text-gray-300 mt-1">
              Speed: {gpsData.speed?.toFixed(1) ?? '0.0'} km/h • Heading: {gpsData.course?.toFixed(0) ?? '0'}°
            </div>
          )}
        </div>

        {/* Active POI Type + Logging Mode Indicator */}
        {(() => {
          const poiConfig = selectedPOIType ? POI_TYPES.find(p => p.type === selectedPOIType) : null;
          if (!poiConfig) return null;
          const IconComponent = poiConfig.icon;
          // Read logging mode from localStorage (shared with LoggingControls)
          const mode = localStorage.getItem('loggingMode') || 'manual';
          const modeLabels: Record<string, { label: string; color: string }> = {
            manual:           { label: 'MANUAL',   color: 'bg-emerald-600' },
            all:              { label: 'ALL DATA',  color: 'bg-blue-600' },
            counterDetection: { label: 'AUTO',      color: 'bg-amber-600' },
            detection:        { label: 'DETECT',    color: 'bg-purple-600' },
          };
          const modeInfo = modeLabels[mode] || modeLabels.manual;
          return (
            <div className="absolute bottom-4 right-4 bg-black/70 text-white px-3 py-2 rounded-lg text-sm z-[10] backdrop-blur-sm border border-gray-600/50">
              <div className={`text-center text-[10px] font-bold tracking-wider px-2 py-0.5 rounded ${modeInfo.color} mb-1.5`}>
                {modeInfo.label}
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-md ${poiConfig.bgColor} flex items-center justify-center`}>
                  <IconComponent className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="font-medium">{poiConfig.label}</span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Route Creator Modal */}
      {showRouteCreator && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-8">
          <div className="bg-gray-800 rounded-xl w-full max-w-4xl p-6 mx-4 my-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Create New Route</h2>
              <button
                onClick={() => {
                  setShowRouteCreator(false);
                  setRouteCreationMode(null);
                  setTempRoute({
                    name: '',
                    description: '',
                    color: '#3b82f6',
                    points: [],
                    routeGeometry: []
                  });
                }}
                className="text-gray-400 hover:text-gray-300"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Left Column - Route Details */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Route Name *
                  </label>
                  <input
                    type="text"
                    value={tempRoute.name}
                    onChange={(e) => setTempRoute(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter route name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={tempRoute.description}
                    onChange={(e) => setTempRoute(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 h-24"
                    placeholder="Enter route description"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Route Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={tempRoute.color}
                      onChange={(e) => setTempRoute(prev => ({ ...prev, color: e.target.value }))}
                      className="bg-gray-700 border border-gray-600 rounded h-10 w-10"
                    />
                    <input
                      type="text"
                      value={tempRoute.color}
                      onChange={(e) => setTempRoute(prev => ({ ...prev, color: e.target.value }))}
                      className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="#3b82f6"
                    />
                  </div>
                </div>

                {/* Point Creation Controls */}
                <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-blue-400 mb-3">Add Points</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setRouteCreationMode('origin');
                        setShowRouteCreator(false);
                        // toast suppressed
                      }}
                      disabled={tempRoute.points.some(p => p.type === 'origin')}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-xs"
                    >
                      <MapPin className="w-3 h-3" />
                      Set Origin
                    </button>
                    <button
                      onClick={() => {
                        setRouteCreationMode('destination');
                        setShowRouteCreator(false);
                        // toast suppressed
                      }}
                      disabled={tempRoute.points.some(p => p.type === 'destination')}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-xs"
                    >
                      <Flag className="w-3 h-3" />
                      Set Destination
                    </button>
                    <button
                      onClick={() => {
                        setRouteCreationMode('waypoint');
                        setShowRouteCreator(false);
                        // toast suppressed
                      }}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                    >
                      <Navigation className="w-3 h-3" />
                      Add Waypoint
                    </button>
                  </div>
                  
                  <div className="text-xs text-gray-400 mt-2">
                    Click the buttons above, then click on the map to place points
                  </div>
                </div>
              </div>

              {/* Right Column - Route Points */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium mb-4">Route Points ({tempRoute.points.length})</h3>
                  
                  {tempRoute.points.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 bg-gray-700/50 rounded-lg">
                      <MapPin className="w-12 h-12 mx-auto mb-4 text-gray-500" />
                      <p className="text-lg font-medium mb-2">No points added yet</p>
                      <p>Click the buttons above to start adding points</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {tempRoute.points
                        .sort((a, b) => {
                          const typeOrder = { origin: 0, waypoint: 1, destination: 2 };
                          return typeOrder[a.type] - typeOrder[b.type] || a.order - b.order;
                        })
                        .map((point) => (
                        <div key={point.id} className="bg-gray-700 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {point.type === 'origin' && <MapPin className="w-4 h-4 text-green-400" />}
                              {point.type === 'waypoint' && <Navigation className="w-4 h-4 text-blue-400" />}
                              {point.type === 'destination' && <Flag className="w-4 h-4 text-purple-400" />}
                              <div>
                                <div className="font-medium capitalize">{point.type}</div>
                                <div className="text-xs text-gray-500 font-mono">
                                  {point.position[0].toFixed(6)}, {point.position[1].toFixed(6)}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setTempRoute(prev => ({
                                  ...prev,
                                  points: prev.points.filter(p => p.id !== point.id)
                                }));
                              }}
                              className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-4 mt-6 pt-4 border-t border-gray-700">
              <button
                onClick={() => {
                  setShowRouteCreator(false);
                  setRouteCreationMode(null);
                  setTempRoute({
                    name: '',
                    description: '',
                    color: '#3b82f6',
                    points: [],
                    routeGeometry: []
                  });
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRoute}
                disabled={!tempRoute.name.trim() || tempRoute.points.length < 2}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-sm"
              >
                Save Route
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Route Manager Modal */}
      {showRouteManager && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowRouteManager(false); }}>
          <div className="bg-gray-900 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <Suspense fallback={
          <div className="flex items-center justify-center p-8">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-lg">Loading Route Manager...</span>
            </div>
          </div>
        }>
          <RouteManager
            onClose={() => setShowRouteManager(false)}
            onSelectRoute={(route) => {
              setRoutes(prev => {
                // Add route if not already in the list
                if (!prev.find(r => r.id === route.id)) {
                  return [...prev, route];
                }
                return prev;
              });
              setVisibleRoutes(prev => new Set([...prev, route.id]));
            }}
            onShowRoute={(route) => {
              setRoutes(prev => {
                // Add route if not already in the list
                if (!prev.find(r => r.id === route.id)) {
                  return [...prev, route];
                }
                return prev;
              });
              setVisibleRoutes(prev => {
                const newSet = new Set([...prev, route.id]);
                return newSet;
              });
            }}
            onHideRoute={(routeId) => {
              setVisibleRoutes(prev => {
                const newSet = new Set(prev);
                newSet.delete(routeId);
                return newSet;
              });
            }}
            onNavigateToStart={async (route) => {
              // Get current GPS position
              const currentPosition: [number, number] = gpsData.latitude && gpsData.longitude
                ? [gpsData.latitude, gpsData.longitude]
                : [0, 0]; // Default if no GPS
              
              // Get route's start point (first point sorted by order)
              const startPoint = route.points.sort((a, b) => a.order - b.order)[0];
              
              if (!startPoint) {
                toast.error('Route has no start point');
                return;
              }
              
              if (currentPosition[0] === 0 && currentPosition[1] === 0) {
                toast.error('No GPS position available');
                return;
              }
              
              try {
                // Import getDirections dynamically to avoid circular dependency
                const { getDirections } = await import('../lib/utils/routeUtils');
                
                // Get road-based navigation path from current position to start point
                const navigationPath = await getDirections([
                  currentPosition,
                  startPoint.position
                ]);
                
                if (navigationPath && navigationPath.length > 0) {
                  setNavigationToStart({
                    route,
                    path: navigationPath
                  });
                  
                  // toast suppressed
                } else {
                  // Fallback to straight line if routing fails
                  setNavigationToStart({
                    route,
                    path: [currentPosition, startPoint.position]
                  });
                  
                  // toast suppressed
                }
              } catch (error) {
                // Fallback to straight line
                setNavigationToStart({
                  route,
                  path: [currentPosition, startPoint.position]
                });
                
                toast.error('Could not calculate road path, using direct line');
              }
            }}
          />
        </Suspense>
          </div>
        </div>
      )}

      {/* Route Navigation (outside modal so it persists) — keyed by route ID to prevent remount */}
      {activeNavRoute && activeNavRoute.points && activeNavRoute.points.length >= 2 && (
        <Suspense key={`nav-${activeNavRoute.id}`} fallback={
          <div className="fixed bottom-4 right-4 bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-4 z-[9998] max-w-sm">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin shrink-0"></div>
              <p className="text-sm text-gray-300">Loading navigation...</p>
            </div>
          </div>
        }>
          <RouteNavigator
            route={activeNavRoute}
            onClose={() => setActiveNavRoute(null)}
          />
        </Suspense>
      )}

      {/* POI Details Modal */}
      {showPOIDetails && selectedPOI && (
        <POIDetailsModal
          isOpen={showPOIDetails}
          onClose={() => {
            setShowPOIDetails(false);
            setSelectedPOI(null);
          }}
          poiData={selectedPOI}
          onEdit={async (updatedPOI) => {
            try {
              const db = await openSurveyDB();
              await db.put('measurements', updatedPOI);
              
              // Update local state
              setMeasurements(prev => prev.map(m => 
                m.id === updatedPOI.id ? updatedPOI : m
              ));
              
              // toast suppressed
              setShowPOIDetails(false);
              setSelectedPOI(null);
            } catch (error) {
              console.error('Failed to update POI:', error);
              toast.error('Failed to update POI');
            }
          }}
          onDelete={async (poiId) => {
            try {
              // Use proper deleteMeasurement function which handles snapshot invalidation
              const { deleteMeasurement } = await import('../lib/survey/measurements');
              await deleteMeasurement(poiId);
              
              // Update local state
              setMeasurements(prev => prev.filter(m => m.id !== poiId));
              
              // toast suppressed
              setShowPOIDetails(false);
              setSelectedPOI(null);
            } catch (error) {
              console.error('Failed to delete POI:', error);
              toast.error('Failed to delete POI');
            }
          }}
        />
      )}
    </div>
  );
};

export default VehicleMap;