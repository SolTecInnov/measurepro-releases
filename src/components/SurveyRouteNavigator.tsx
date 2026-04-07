import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import L, { LatLngExpression } from 'leaflet';
import {
  Compass, Square, Minimize2, Maximize2, AlertTriangle, WifiOff,
  Navigation, TriangleAlert, X
} from 'lucide-react';
import { Route } from '../lib/utils/routeUtils';
import { useGPSStore } from '../lib/stores/gpsStore';
import { detectOffRoute } from '../lib/utils/offRouteDetection';
import { toast } from 'sonner';
import { calculateDistance } from '../lib/utils/geoUtils';

const BEARING_MIN_DEGREES = 30;
const BEARING_MIN_DIST_M = 50;
const DEFAULT_DEVIATION_THRESHOLD_M = 30;
const MAX_GPS_ACCURACY_M = 50;

function bearing(a: [number, number], b: [number, number]): number {
  const lat1 = a[0] * Math.PI / 180;
  const lat2 = b[0] * Math.PI / 180;
  const dLon = (b[1] - a[1]) * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

function haversineMeters(a: [number, number], b: [number, number]): number {
  return calculateDistance(a[0], a[1], b[0], b[1]) * 1000;
}

function bearingLabel(deg: number): string {
  const normalized = ((deg % 360) + 360) % 360;
  if (normalized >= 315 || normalized < 45) return 'Continue straight';
  if (normalized < 135) return 'Turn right';
  if (normalized < 225) return 'Turn around';
  return 'Turn left';
}

function computeDistanceRemaining(pos: [number, number], geometry: [number, number][]): number {
  if (geometry.length === 0) return 0;
  // Find nearest segment
  let nearestSegIdx = 0;
  let nearestT = 0;
  let minDist = Infinity;
  for (let i = 0; i < geometry.length - 1; i++) {
    const [ax, ay] = geometry[i];
    const [bx, by] = geometry[i + 1];
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    let t = 0;
    if (lenSq > 0) {
      t = Math.max(0, Math.min(1, ((pos[0] - ax) * dx + (pos[1] - ay) * dy) / lenSq));
    }
    const nx = ax + t * dx, ny = ay + t * dy;
    const d = Math.hypot(pos[0] - nx, pos[1] - ny);
    if (d < minDist) { minDist = d; nearestSegIdx = i; nearestT = t; }
  }
  // Sum remaining lengths from the projection point to the end
  const [ax, ay] = geometry[nearestSegIdx];
  const [bx, by] = geometry[nearestSegIdx + 1];
  const projPt: [number, number] = [ax + nearestT * (bx - ax), ay + nearestT * (by - ay)];
  let dist = haversineMeters(projPt, geometry[nearestSegIdx + 1]);
  for (let i = nearestSegIdx + 1; i < geometry.length - 1; i++) {
    dist += haversineMeters(geometry[i], geometry[i + 1]);
  }
  return dist;
}

interface NextBearing {
  label: string;
  distanceM: number;
  degrees: number;
}

function computeNextBearing(pos: [number, number], geometry: [number, number][]): NextBearing | null {
  if (geometry.length < 3) return null;

  // Project pos onto the nearest segment to find starting point + along-route offset
  let nearestSegIdx = 0;
  let nearestT = 0;
  let minDist = Infinity;
  for (let i = 0; i < geometry.length - 1; i++) {
    const [ax, ay] = geometry[i];
    const [bx, by] = geometry[i + 1];
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    let t = 0;
    if (lenSq > 0) {
      t = Math.max(0, Math.min(1, ((pos[0] - ax) * dx + (pos[1] - ay) * dy) / lenSq));
    }
    const d = Math.hypot(pos[0] - (ax + t * dx), pos[1] - (ay + t * dy));
    if (d < minDist) { minDist = d; nearestSegIdx = i; nearestT = t; }
  }

  // Build starting point and initial bearing from projection to next vertex
  const [ax, ay] = geometry[nearestSegIdx];
  const [bx, by] = geometry[nearestSegIdx + 1];
  const projPt: [number, number] = [ax + nearestT * (bx - ax), ay + nearestT * (by - ay)];

  // Along-route distance starts as distance from projPt to end of current segment
  let routeDistM = haversineMeters(projPt, geometry[nearestSegIdx + 1]);

  // Track the last surfaced bearing-change point and its bearing
  let lastChangePt: [number, number] = projPt;
  let lastSurfacedBearing = bearing(projPt, geometry[nearestSegIdx + 1]);

  // Walk forward from the segment AFTER the nearest one
  for (let i = nearestSegIdx + 1; i < geometry.length - 1; i++) {
    const segBearing = bearing(geometry[i], geometry[i + 1]);
    const distFromLastChange = haversineMeters(lastChangePt, geometry[i]);

    let delta = Math.abs(segBearing - lastSurfacedBearing);
    if (delta > 180) delta = 360 - delta;

    if (delta >= BEARING_MIN_DEGREES && distFromLastChange >= BEARING_MIN_DIST_M) {
      return {
        label: bearingLabel(segBearing - lastSurfacedBearing),
        distanceM: routeDistM,
        degrees: delta
      };
    }

    // Only update the surfaced-change baseline once we've moved far enough from it
    if (distFromLastChange >= BEARING_MIN_DIST_M) {
      lastChangePt = geometry[i];
      lastSurfacedBearing = segBearing;
    }

    routeDistM += haversineMeters(geometry[i], geometry[i + 1]);
  }

  return null;
}

// Module-level flag for online notice (session-scoped, not localStorage)
let hasShownOnlineNotice = false;

const PositionMarker = ({ position }: { position: [number, number] | null }) => {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!position) return;
    const icon = L.divIcon({
      className: 'bg-transparent',
      html: `<div style="position:relative">
        <div style="position:absolute;width:16px;height:16px;background:#3b82f6;border-radius:50%;border:2px solid white;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;opacity:0.75"></div>
        <div style="position:absolute;width:16px;height:16px;background:#3b82f6;border-radius:50%;border:2px solid white"></div>
      </div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });
    if (!markerRef.current) {
      markerRef.current = L.marker(position, { icon, zIndexOffset: 1000 }).addTo(map);
    } else {
      markerRef.current.setLatLng(position);
      markerRef.current.setIcon(icon);
    }
    map.setView(position, map.getZoom());
  }, [position, map]);

  useEffect(() => {
    return () => {
      if (markerRef.current) map.removeLayer(markerRef.current);
    };
  }, [map]);

  return null;
};

interface SurveyRouteNavigatorProps {
  route: Route;
  onClose: () => void;
}

const SurveyRouteNavigator: React.FC<SurveyRouteNavigatorProps> = ({ route, onClose }) => {
  const { data: gpsData } = useGPSStore();
  const [isMinimized, setIsMinimized] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  // Geometry
  const [geometry, setGeometry] = useState<[number, number][]>([]);
  const [waypointFallback, setWaypointFallback] = useState(false);

  // HUD state
  const [distRemaining, setDistRemaining] = useState<number | null>(null);
  const [nextBearing, setNextBearing] = useState<NextBearing | null>(null);

  // Off-route / GPS state
  const [offRouteInfo, setOffRouteInfo] = useState<{ isOff: boolean; distM: number } | null>(null);
  const [gpsLost, setGpsLost] = useState(false);
  const violationStartRef = useRef<number | null>(null);

  // Wakelock
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Build geometry on mount.
  // Prefer the stored GPS track (routeGeometry) — it is the exact imported route and
  // must not be modified. For older routes without routeGeometry, fall back to the
  // route's points array and show an informational warning.
  useEffect(() => {
    if (route.routeGeometry && route.routeGeometry.length >= 2) {
      setGeometry(route.routeGeometry);
      setWaypointFallback(false);
    } else {
      const sorted = [...route.points].sort((a, b) => a.order - b.order);
      const pts: [number, number][] = sorted.map(p => p.position);
      setGeometry(pts);
      setWaypointFallback(true);
    }
  }, [route]);

  // Show online notice once per session
  useEffect(() => {
    if (!hasShownOnlineNotice) {
      hasShownOnlineNotice = true;
      // toast suppressed
    }
  }, []);

  // Acquire wakelock on navigation start
  const acquireWakeLock = useCallback(async () => {
    const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinel> } };
    if (nav.wakeLock) {
      try {
        wakeLockRef.current = await nav.wakeLock.request('screen');
      } catch (_e) {
        // Not critical — device may not support wake lock
      }
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
  }, []);

  const startNavigation = useCallback(async () => {
    setIsNavigating(true);
    await acquireWakeLock();
    // toast suppressed
  }, [acquireWakeLock, route.name]);

  const stopNavigation = useCallback(() => {
    setIsNavigating(false);
    releaseWakeLock();
    // toast suppressed
    onClose();
  }, [releaseWakeLock, onClose]);

  // Release wakelock on unmount
  useEffect(() => {
    return () => {
      releaseWakeLock();
    };
  }, [releaseWakeLock]);

  // GPS tick — update HUD and off-route detection
  useEffect(() => {
    if (!isNavigating || geometry.length === 0) return;
    const { latitude, longitude, hdop, fixQuality } = gpsData;

    // Evaluate GPS-loss BEFORE any lat/lon guard so the banner appears even when
    // coordinates are not yet available. Use Number.isFinite to avoid treating
    // valid 0° lat/lon coordinates (near equator/prime meridian) as a no-fix.
    const accuracyM = (hdop || 0) * 5;
    const isGpsLost =
      fixQuality === 'No Fix' ||
      !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      accuracyM > MAX_GPS_ACCURACY_M;

    setGpsLost(isGpsLost);
    if (isGpsLost) {
      // GPS-loss banner replaces and clears off-route state while signal is degraded
      setOffRouteInfo(null);
      violationStartRef.current = null;
      return;
    }

    const pos: [number, number] = [latitude, longitude];

    // Off-route detection
    const result = detectOffRoute(
      { latitude, longitude, accuracy: accuracyM, timestamp: Date.now() },
      geometry,
      { allowedDeviationMeters: DEFAULT_DEVIATION_THRESHOLD_M, persistenceSeconds: 0, maxAccuracyMeters: MAX_GPS_ACCURACY_M },
      violationStartRef.current
    );
    violationStartRef.current = result.violationStartTime;

    if (result.isOffRoute) {
      setOffRouteInfo({ isOff: true, distM: Math.round(result.distanceFromRoute) });
    } else {
      setOffRouteInfo(null);
    }

    // HUD updates
    const distR = computeDistanceRemaining(pos, geometry);
    setDistRemaining(distR);
    const nb = computeNextBearing(pos, geometry);
    setNextBearing(nb);
  }, [gpsData, isNavigating, geometry]);

  const gpsPosition: [number, number] | null =
    Number.isFinite(gpsData.latitude) && Number.isFinite(gpsData.longitude)
      ? [gpsData.latitude, gpsData.longitude]
      : null;

  const mapCenter: LatLngExpression = gpsPosition || (geometry.length > 0 ? geometry[0] : [45.5017, -73.5673]);

  const formatDist = (m: number) => m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;

  if (isMinimized) {
    return (
      <div
        className="fixed bottom-4 right-4 bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-4 z-50 max-w-xs"
        data-testid="survey-nav-minimized"
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Compass className="w-4 h-4 text-green-400" />
            Survey Nav: {route.name}
          </h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(false)}
              className="p-1 bg-gray-700 hover:bg-gray-600 rounded"
              title="Maximize"
              data-testid="button-survey-nav-maximize"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={stopNavigation}
              className="p-1 bg-red-600 hover:bg-red-700 rounded"
              title="Stop Navigation"
              data-testid="button-survey-nav-stop-min"
            >
              <Square className="w-3 h-3" />
            </button>
          </div>
        </div>
        {offRouteInfo && (
          <div className="text-xs text-red-400 font-semibold flex items-center gap-1">
            <TriangleAlert className="w-3 h-3" />
            OFF ROUTE — {offRouteInfo.distM}m from route
          </div>
        )}
        {gpsLost && !offRouteInfo && (
          <div className="text-xs text-orange-400 flex items-center gap-1">
            <WifiOff className="w-3 h-3" />
            GPS signal lost
          </div>
        )}
        {distRemaining !== null && (
          <div className="text-xs text-gray-400 mt-1">Remaining: {formatDist(distRemaining)}</div>
        )}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-gray-900"
      data-testid="survey-navigator"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 z-10">
        <div className="flex items-center gap-2">
          <Compass className="w-5 h-5 text-green-400" />
          <span className="font-semibold text-sm truncate max-w-[200px]">Survey Nav: {route.name}</span>
        </div>
        <div className="flex items-center gap-2">
          {!isNavigating && (
            <button
              onClick={startNavigation}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm"
              data-testid="button-survey-nav-start"
            >
              <Navigation className="w-4 h-4" />
              Start
            </button>
          )}
          {isNavigating && (
            <button
              onClick={stopNavigation}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-sm"
              data-testid="button-survey-nav-stop"
            >
              <Square className="w-4 h-4" />
              Stop
            </button>
          )}
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded"
            title="Minimize"
            data-testid="button-survey-nav-minimize"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => { releaseWakeLock(); onClose(); }}
            className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded"
            title="Close Survey Navigation"
            data-testid="button-survey-nav-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Waypoint-fallback notice */}
      {waypointFallback && (
        <div className="bg-amber-900/60 border-b border-amber-700 px-4 py-1.5 text-xs text-amber-300 flex items-center gap-2" data-testid="banner-waypoint-fallback">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Route built from waypoints only — full GPS track geometry unavailable for this route.
        </div>
      )}

      {/* Off-route banner */}
      {offRouteInfo && offRouteInfo.isOff && (
        <div
          className="bg-red-600 px-4 py-2 text-center text-sm font-bold flex items-center justify-center gap-2 z-10"
          data-testid="banner-off-route"
        >
          <TriangleAlert className="w-4 h-4" />
          OFF ROUTE — {offRouteInfo.distM}m from route
        </div>
      )}

      {/* GPS lost banner */}
      {gpsLost && isNavigating && (
        <div
          className="bg-orange-500 px-4 py-2 text-center text-sm font-bold flex items-center justify-center gap-2 z-10"
          data-testid="banner-gps-lost"
        >
          <WifiOff className="w-4 h-4" />
          GPS signal lost
        </div>
      )}

      {/* Map */}
      <div className="flex-1 relative">
        <MapContainer
          center={mapCenter}
          zoom={15}
          style={{ width: '100%', height: '100%' }}
          zoomControl={true}
        >
          <TileLayer
            url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
          />
          {geometry.length >= 2 && (
            <Polyline
              positions={geometry}
              color={route.color || '#22c55e'}
              weight={5}
              opacity={0.85}
            />
          )}
          {gpsPosition && isNavigating && (
            <PositionMarker position={gpsPosition} />
          )}
        </MapContainer>

        {/* HUD Overlay */}
        {isNavigating && (
          <div
            className="absolute top-3 left-3 right-3 flex gap-2 z-[1000] pointer-events-none"
            data-testid="hud-overlay"
          >
            {/* Distance remaining */}
            <div className="bg-gray-900/90 rounded-lg px-3 py-2 text-center flex-1">
              <p className="text-xs text-gray-400 mb-0.5">Distance remaining</p>
              <p className="text-lg font-bold text-white" data-testid="hud-distance-remaining">
                {distRemaining !== null ? formatDist(distRemaining) : '—'}
              </p>
            </div>

            {/* Next bearing */}
            <div className="bg-gray-900/90 rounded-lg px-3 py-2 text-center flex-1">
              <p className="text-xs text-gray-400 mb-0.5">Next turn</p>
              {nextBearing ? (
                <>
                  <p className="text-sm font-bold text-white leading-tight" data-testid="hud-next-turn-label">
                    {nextBearing.label}
                  </p>
                  <p className="text-xs text-gray-300" data-testid="hud-next-turn-dist">
                    in {formatDist(nextBearing.distanceM)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-400" data-testid="hud-next-turn-label">—</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SurveyRouteNavigator;
