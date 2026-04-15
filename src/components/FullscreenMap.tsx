/**
 * FullscreenMap — read-only fullscreen map visualization with HUD overlays.
 *
 * Overlays:
 * - GPS info (top-left): lat, lon, speed, fix, altitude
 * - Route button (top-right): opens existing route manager modal
 * - Active POI type + capture mode (right)
 * - Last 2 POIs (bottom): ID, Type (editable), Height, Delete
 * - Close button (X) + Escape key
 *
 * The app continues running in background — POI creation happens via
 * keyboard shortcuts / StreamDeck as usual.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  X, Satellite, Navigation, Route as RouteIcon, Pencil, Trash2, Check,
  Maximize2, ChevronUp, CloudRain, Cloud
} from 'lucide-react';
import WeatherCard from './map/WeatherCard';
import { fetchWeatherData, getRadarTileUrl, type WeatherData } from '../lib/weather/weatherService';
import { useGPSStore } from '@/lib/stores/gpsStore';
import { usePOIStore, POI_TYPES } from '@/lib/poi';
import { useSettingsStore } from '@/lib/settings';
import { useSurveyStore } from '@/lib/survey';
import { useMeasurementFeed } from '@/hooks/useMeasurementFeed';
import { updateMeasurement } from '@/lib/survey/measurements';
import { openSurveyDB } from '@/lib/survey/db';
import { getMeasurementFeed } from '@/lib/survey/MeasurementFeed';
import { getRoutesBySurvey } from '@/lib/utils/routeUtils';
import type { Measurement } from '@/lib/survey/types';
import type { POIType } from '@/lib/poi';
import { toast } from 'sonner';

// GPS marker that follows position
function GpsFollower() {
  const map = useMap();
  const { data: gpsData } = useGPSStore();

  useEffect(() => {
    if (gpsData.latitude !== 0 && gpsData.longitude !== 0) {
      map.setView([gpsData.latitude, gpsData.longitude], map.getZoom(), { animate: true });
    }
  }, [gpsData.latitude, gpsData.longitude, map]);

  return null;
}

// Compact camera thumbnail that finds the active video stream
function CameraThumbnail() {
  const miniVideoRef = React.useRef<HTMLVideoElement>(null);
  const [hasStream, setHasStream] = React.useState(false);

  useEffect(() => {
    const findAndAttach = () => {
      if (miniVideoRef.current?.srcObject) {
        // Already attached and playing
        const stream = miniVideoRef.current.srcObject as MediaStream;
        if (stream.active && stream.getVideoTracks().length > 0) {
          setHasStream(true);
          return;
        }
      }

      // Search ALL video elements for one with an active stream
      const videos = document.querySelectorAll('video');
      for (const v of videos) {
        if (v === miniVideoRef.current) continue; // Skip ourselves
        const stream = v.srcObject as MediaStream;
        if (stream?.active && stream.getVideoTracks().length > 0) {
          if (miniVideoRef.current) {
            miniVideoRef.current.srcObject = stream;
            miniVideoRef.current.play().catch(() => {});
            setHasStream(true);
          }
          return;
        }
      }
      setHasStream(false);
    };
    findAndAttach();
    const interval = setInterval(findAndAttach, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="absolute bottom-20 left-4 z-[99999] rounded-lg overflow-hidden border border-gray-600/50 shadow-lg bg-black"
      style={{ width: 200, height: 150, display: hasStream ? 'block' : 'none' }}
    >
      <video
        ref={miniVideoRef}
        autoPlay
        muted
        playsInline
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </div>
  );
}

interface FullscreenMapProps {
  onClose: () => void;
  onOpenRouteManager?: () => void;
}

const FullscreenMap: React.FC<FullscreenMapProps> = ({ onClose }) => {
  const { data: gpsData } = useGPSStore();
  const { selectedType: selectedPOIType } = usePOIStore();
  const { mapSettings } = useSettingsStore();
  const { activeSurvey } = useSurveyStore();
  const { getMeasurementsWithLimit, getMapMeasurements } = useMeasurementFeed();

  const [lastPOIs, setLastPOIs] = useState<Measurement[]>([]);
  const [allPOIs, setAllPOIs] = useState<Measurement[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState<string>('');
  const [routes, setRoutes] = useState<any[]>([]);

  // Weather & radar state (independent toggles)
  const [radarActive, setRadarActive] = useState(false);
  const [weatherCardOpen, setWeatherCardOpen] = useState(false);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [radarTileUrl, setRadarTileUrl] = useState<string | null>(null);
  const radarRefreshRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

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
    const lat = gpsData.latitude || 45.5;
    const lon = gpsData.longitude || -73.6;
    try {
      const data = await fetchWeatherData(lat, lon);
      setWeatherData(data);
      setWeatherCardOpen(true);
    } catch {
      toast.error('Weather unavailable');
    }
  }, [weatherCardOpen, gpsData.latitude, gpsData.longitude]);

  useEffect(() => {
    return () => { if (radarRefreshRef.current) clearInterval(radarRefreshRef.current); };
  }, []);

  // Load routes for active survey
  useEffect(() => {
    if (!activeSurvey?.id) return;
    getRoutesBySurvey(activeSurvey.id).then(r => {
      console.log('[FullscreenMap] Loaded routes:', r.length, r.map(rt => ({ id: rt.id, points: rt.points?.length, geometry: rt.routeGeometry?.length })));
      setRoutes(r);
    }).catch(() => {});
  }, [activeSurvey?.id]);

  // Refresh POIs periodically
  useEffect(() => {
    const refresh = () => {
      setLastPOIs(getMeasurementsWithLimit(2));
      setAllPOIs(getMapMeasurements(500));
    };
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [getMeasurementsWithLimit, getMapMeasurements]);

  // Escape key to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Tile config (same as VehicleMap)
  const getTileConfig = () => {
    if (mapSettings?.provider === 'google') {
      const lyrs = mapSettings.style === 'satellite' ? 's' : mapSettings.style === 'terrain' ? 'p' : mapSettings.style === 'hybrid' ? 'y' : 'm';
      return { url: `https://mt1.google.com/vt/lyrs=${lyrs}&x={x}&y={y}&z={z}`, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'] };
    }
    return { url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', subdomains: ['a', 'b', 'c', 'd'] };
  };
  const tileConfig = getTileConfig();

  // Current POI type config
  const poiConfig = selectedPOIType ? POI_TYPES.find(p => p.type === selectedPOIType) : null;
  const loggingMode = localStorage.getItem('loggingMode') || 'manual';
  const modeLabels: Record<string, { label: string; color: string }> = {
    manual: { label: 'MANUAL', color: 'bg-emerald-600' },
    all: { label: 'ALL DATA', color: 'bg-blue-600' },
    all_data: { label: 'ALL DATA', color: 'bg-blue-600' },
    counterDetection: { label: 'AUTO-CAPTURE', color: 'bg-amber-600' },
    counter: { label: 'AUTO-CAPTURE', color: 'bg-amber-600' },
  };
  const modeInfo = modeLabels[loggingMode] || modeLabels.manual;

  // GPS vehicle icon
  const vehicleIcon = L.divIcon({
    className: 'vehicle-marker',
    html: `<div style="width:20px;height:20px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 0 8px rgba(59,130,246,0.6)"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

  // Handle POI type edit
  const handleSaveType = async (id: string) => {
    try {
      const db = await openSurveyDB();
      const m = await db.get('measurements', id);
      if (m) {
        const updated = { ...m, poi_type: editType };
        await db.put('measurements', updated);
        getMeasurementFeed().updateMeasurement(id, updated);
        toast.success('POI type updated');
      }
    } catch {
      toast.error('Failed to update');
    }
    try { setEditingId(null); } catch {}
    try { setLastPOIs(getMeasurementsWithLimit(2)); } catch {}
  };

  // Handle POI delete
  const handleDelete = async (id: string) => {
    try {
      const db = await openSurveyDB();
      await db.delete('measurements', id);
      getMeasurementFeed().removeMeasurement(id);
      toast.success('POI deleted');
      try { setLastPOIs(getMeasurementsWithLimit(2)); } catch {}
    } catch {
      toast.error('Failed to delete');
    }
  };

  const center: [number, number] = gpsData.latitude !== 0 ? [gpsData.latitude, gpsData.longitude] : [45.5017, -73.5673];

  return (
    <div className="fixed inset-0 z-[99998] bg-black">
      {/* Full map */}
      <MapContainer center={center} zoom={15} style={{ height: '100%', width: '100%' }} zoomControl={false}>
        <TileLayer url={tileConfig.url} maxZoom={20} subdomains={tileConfig.subdomains} />
        {/* Precipitation Radar Overlay (RainViewer) */}
        {radarActive && radarTileUrl && (
          <TileLayer key={radarTileUrl} url={radarTileUrl} opacity={0.75} maxZoom={20} tileSize={256} />
        )}
        <GpsFollower />
        {gpsData.latitude !== 0 && (
          <Marker position={[gpsData.latitude, gpsData.longitude]} icon={vehicleIcon} />
        )}
        {/* Show survey routes (try both [lat,lng] and [lng,lat] formats) */}
        {routes.map(route => {
          let coords: [number, number][] = [];
          if (route.routeGeometry && route.routeGeometry.length > 0) {
            // routeGeometry can be [lat,lng] or [lng,lat] depending on source
            const first = route.routeGeometry[0];
            if (Array.isArray(first)) {
              // If first coord latitude-like (>-90 && <90), it's [lat,lng]
              coords = Math.abs(first[0]) <= 90
                ? route.routeGeometry
                : route.routeGeometry.map((c: number[]) => [c[1], c[0]] as [number, number]);
            }
          } else if (route.points?.length > 0) {
            coords = route.points.map((p: any) => p.position as [number, number]);
          }
          if (coords.length < 2) return null;
          return (
            <Polyline
              key={route.id}
              positions={coords}
              pathOptions={{ color: route.color || '#3b82f6', weight: 4, opacity: 0.8 }}
            />
          );
        })}

        {/* Show ALL survey POIs as markers (same size as card map: 24x24) */}
        {allPOIs.map(poi => {
          const typeConfig = POI_TYPES.find(p => p.type === poi.poi_type);
          return (
            <Marker
              key={poi.id}
              position={[poi.latitude, poi.longitude]}
              icon={L.divIcon({
                className: 'bg-transparent',
                html: `<div class="w-6 h-6 ${typeConfig?.bgColor || 'bg-gray-400/20'} ${typeConfig?.color || 'text-gray-400'} rounded-full border-2 border-white flex items-center justify-center shadow-lg">
                  <div class="w-3 h-3 bg-current rounded-full"></div>
                </div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12],
              })}
            >
              <Popup>
                <div className="text-xs">
                  <div className="font-bold">{typeConfig?.label || poi.poi_type}</div>
                  {poi.rel != null && <div>{poi.rel.toFixed(2)}m</div>}
                  <div className="text-gray-500">#{poi.poiNumber}</div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* ═══ HUD OVERLAYS ═══ */}

      {/* Radar + Weather + Close buttons */}
      <div className="absolute top-4 right-4 z-[99999] flex items-center gap-1.5">
        <button
          onClick={toggleRadar}
          className={`p-2 rounded-lg text-white backdrop-blur-sm border transition-colors ${
            radarActive
              ? 'bg-blue-600/80 hover:bg-blue-700 border-blue-400'
              : 'bg-black/70 hover:bg-black/90 border-gray-600/50'
          }`}
          title={radarActive ? 'Hide radar' : 'Show precipitation radar'}
        >
          <CloudRain className="w-5 h-5" />
        </button>
        <button
          onClick={toggleWeatherCard}
          className={`p-2 rounded-lg text-white backdrop-blur-sm border transition-colors ${
            weatherCardOpen
              ? 'bg-amber-600/80 hover:bg-amber-700 border-amber-400'
              : 'bg-black/70 hover:bg-black/90 border-gray-600/50'
          }`}
          title={weatherCardOpen ? 'Hide forecast' : 'Show precipitation forecast'}
        >
          <Cloud className="w-5 h-5" />
        </button>
        <button
          onClick={onClose}
          className="p-2 bg-black/70 hover:bg-black/90 rounded-lg text-white backdrop-blur-sm border border-gray-600/50 transition-colors"
          title="Close fullscreen (Escape)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Weather Forecast Card */}
      {weatherCardOpen && weatherData && (
        <div className="absolute top-16 right-4 z-[99999]">
          <WeatherCard weather={weatherData} onClose={toggleWeatherCard} />
        </div>
      )}

      {/* GPS Info — top left */}
      <div className="absolute top-4 left-4 z-[99999] bg-black/70 text-white px-3 py-2 rounded-lg backdrop-blur-sm border border-gray-600/50 text-xs space-y-1">
        <div className="flex items-center gap-2">
          <Satellite className="w-3.5 h-3.5 text-blue-400" />
          <div className={`w-2 h-2 rounded-full ${gpsData.fixQuality === 'GPS Fix' || gpsData.fixQuality === 'DGPS Fix' ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="font-mono">
            {gpsData.latitude !== 0 ? `${gpsData.latitude.toFixed(6)}, ${gpsData.longitude.toFixed(6)}` : 'No Fix'}
          </span>
        </div>
        <div className="flex items-center gap-3 text-gray-300">
          <span>{gpsData.speed?.toFixed(1) ?? '0.0'} km/h</span>
          <span>{gpsData.course?.toFixed(0) ?? '0'}°</span>
          <span>Alt: {gpsData.altitude?.toFixed(0) ?? '0'}m</span>
        </div>
      </div>

      {/* Route button — top center (opens route manager OVER fullscreen) */}
      <button
        onClick={() => {
          window.dispatchEvent(new Event('open-route-manager'));
        }}
        className="absolute top-4 left-1/2 -translate-x-1/2 z-[99999] flex items-center gap-1.5 bg-black/70 hover:bg-black/90 text-white text-xs font-medium px-3 py-2 rounded-lg backdrop-blur-sm border border-gray-600/50 transition-colors"
      >
        <RouteIcon className="w-3.5 h-3.5 text-blue-400" />
        Routes
      </button>

      {/* Active POI + Capture Mode — right side */}
      <div className="absolute top-16 right-4 z-[99999] bg-black/70 text-white px-3 py-2 rounded-lg backdrop-blur-sm border border-gray-600/50">
        <div className={`text-center text-[10px] font-bold tracking-wider px-2 py-0.5 rounded ${modeInfo.color} mb-1.5`}>
          {modeInfo.label}
        </div>
        {poiConfig ? (
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-md ${poiConfig.bgColor} flex items-center justify-center`}>
              <poiConfig.icon className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-medium">{poiConfig.label}</span>
          </div>
        ) : (
          <span className="text-xs text-gray-400">No POI selected</span>
        )}
      </div>

      {/* Live camera thumbnail — bottom left */}
      <CameraThumbnail />

      {/* Last 2 POIs — bottom */}
      {lastPOIs.length > 0 && (
        <div className="absolute bottom-4 left-4 right-4 z-[99999] flex gap-2 justify-center">
          {lastPOIs.map((poi) => {
            const typeConfig = POI_TYPES.find(p => p.type === poi.poi_type);
            const isEditing = editingId === poi.id;
            return (
              <div
                key={poi.id}
                className="bg-black/80 text-white px-3 py-2 rounded-lg backdrop-blur-sm border border-gray-600/50 flex items-center gap-3 text-xs max-w-[45%]"
              >
                {/* POI Type icon + label (editable) */}
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <select
                      value={editType}
                      onChange={(e) => setEditType(e.target.value)}
                      className="bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs w-28"
                      autoFocus
                    >
                      {POI_TYPES.filter(p => p.type !== '').map(p => (
                        <option key={p.type} value={p.type}>{p.label}</option>
                      ))}
                    </select>
                    <button onClick={() => handleSaveType(poi.id)} className="p-0.5 hover:bg-green-600/50 rounded">
                      <Check className="w-3 h-3 text-green-400" />
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-0.5 hover:bg-gray-600/50 rounded">
                      <X className="w-3 h-3 text-gray-400" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setEditingId(poi.id); setEditType(poi.poi_type || 'wire'); }}
                    className="flex items-center gap-1.5 hover:bg-gray-700/50 rounded px-1 py-0.5 transition-colors"
                    title="Click to change POI type"
                  >
                    {typeConfig && (
                      <div className={`w-5 h-5 rounded ${typeConfig.bgColor} flex items-center justify-center flex-shrink-0`}>
                        <typeConfig.icon className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <span className="font-medium truncate">{typeConfig?.label || poi.poi_type}</span>
                    <Pencil className="w-2.5 h-2.5 text-gray-400 flex-shrink-0" />
                  </button>
                )}

                {/* Height */}
                <span className="font-mono text-blue-300 flex-shrink-0">
                  {poi.rel != null ? `${poi.rel.toFixed(2)}m` : '—'}
                </span>

                {/* ID (short) */}
                <span className="text-gray-500 font-mono flex-shrink-0">
                  #{poi.poiNumber ?? poi.id?.substring(0, 6)}
                </span>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(poi.id)}
                  className="p-0.5 hover:bg-red-600/50 rounded flex-shrink-0"
                  title="Delete this POI"
                >
                  <Trash2 className="w-3 h-3 text-red-400" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FullscreenMap;
