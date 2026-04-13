import React from 'react';
import { Map, Eye, Mountain, Layers, MapPin, Key, Globe, Satellite, Download, Trash2, WifiOff, HardDrive, Info } from 'lucide-react';
import { useSettingsStore } from '../../lib/settings';
import { toast } from 'sonner';
import { useEnabledFeatures } from '../../hooks/useLicenseEnforcement';
import { isBetaUser } from '../../lib/auth/masterAdmin';
import { getSafeAuth } from '../../lib/firebase';

// ==================== OFFLINE TILE PRE-DOWNLOAD ====================

// Must match the Workbox runtime cache name in vite.config.ts so predownloaded tiles
// are served by the same service-worker cache that handles live OSM tile requests.
const OFFLINE_TILES_CACHE = 'openstreetmap-tiles';
const CARTO_TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png';

/** Convert lon/lat/zoom to OSM tile x,y */
function lonLatToTile(lon: number, lat: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom);
  const x = Math.floor((lon + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { x: Math.max(0, Math.min(n - 1, x)), y: Math.max(0, Math.min(n - 1, y)) };
}

/** Count total tiles for a bbox + zoom range (capped for safety) */
function estimateTileCount(bbox: BBox, minZoom: number, maxZoom: number): number {
  let total = 0;
  for (let z = minZoom; z <= maxZoom; z++) {
    const topLeft = lonLatToTile(bbox.west, bbox.north, z);
    const bottomRight = lonLatToTile(bbox.east, bbox.south, z);
    total += (Math.abs(bottomRight.x - topLeft.x) + 1) * (Math.abs(bottomRight.y - topLeft.y) + 1);
  }
  return total;
}

/** Generate all tile URLs for a bbox + zoom range */
function* generateTileUrls(
  bbox: BBox,
  minZoom: number,
  maxZoom: number,
  urlTemplate: string
): Generator<string> {
  const subdomain = ['a', 'b', 'c', 'd'];
  let i = 0;
  for (let z = minZoom; z <= maxZoom; z++) {
    const topLeft = lonLatToTile(bbox.west, bbox.north, z);
    const bottomRight = lonLatToTile(bbox.east, bbox.south, z);
    const xMin = Math.min(topLeft.x, bottomRight.x);
    const xMax = Math.max(topLeft.x, bottomRight.x);
    const yMin = Math.min(topLeft.y, bottomRight.y);
    const yMax = Math.max(topLeft.y, bottomRight.y);
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        const s = subdomain[i++ % subdomain.length];
        yield urlTemplate.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y)).replace('{s}', s).replace('{r}', '');
      }
    }
  }
}

/** Estimate byte size from tile count (avg ~12 KB per OSM tile) */
function estimateSizeBytes(tileCount: number): number {
  return tileCount * 12 * 1024;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface BBox { north: number; south: number; east: number; west: number; }
interface CachedRegion { name: string; bbox: BBox; minZoom: number; maxZoom: number; tileCount: number; downloadedAt: string; }

const REGIONS_KEY = 'offline_tile_regions';
function loadRegions(): CachedRegion[] {
  try { return JSON.parse(localStorage.getItem(REGIONS_KEY) || '[]'); } catch { return []; }
}
function saveRegions(regions: CachedRegion[]) {
  localStorage.setItem(REGIONS_KEY, JSON.stringify(regions));
}

const MAX_TILES_WARNING = 100_000; // Yellow warning above this
const MAX_TILES_HARD = 500_000;   // Hard cap to prevent browser crash

// ==================== OFFLINE TILE UI COMPONENT ====================

import { OFFLINE_REGIONS, GROUP_LABELS, type OfflineRegion } from '../../lib/offlineRegions';

const OfflineTileSection: React.FC<{ tileUrlTemplate: string }> = ({ tileUrlTemplate }) => {
  const [selectedRegionIdx, setSelectedRegionIdx] = React.useState<number>(-1);
  const [bbox, setBbox] = React.useState<BBox>({ north: 46.0, south: 45.4, east: -73.4, west: -74.0 });
  const [minZoom, setMinZoom] = React.useState(7);
  const [maxZoom, setMaxZoom] = React.useState(12);
  const [regionName, setRegionName] = React.useState('');
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null);
  const [regions, setRegions] = React.useState<CachedRegion[]>(loadRegions);
  const [storageUsed, setStorageUsed] = React.useState<string>('');
  const abortRef = React.useRef(false);

  const tileCount = estimateTileCount(bbox, minZoom, maxZoom);
  const isSafe = tileCount <= MAX_TILES_HARD;
  const isLarge = tileCount > MAX_TILES_WARNING;

  // When user selects a predefined region, populate bbox + name + zoom
  const handleRegionSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const idx = parseInt(e.target.value);
    setSelectedRegionIdx(idx);
    if (idx >= 0 && idx < OFFLINE_REGIONS.length) {
      const r = OFFLINE_REGIONS[idx];
      setBbox(r.bbox);
      setMinZoom(r.defaultMinZoom);
      setMaxZoom(r.defaultMaxZoom);
      setRegionName(r.name);
    }
  };

  // Estimate cache storage on mount and after downloads
  const refreshStorage = async () => {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      if (est.usage !== undefined) setStorageUsed(formatBytes(est.usage));
    }
  };
  React.useEffect(() => { refreshStorage(); }, []);

  const handleBboxChange = (field: keyof BBox, value: string) => {
    setBbox(prev => ({ ...prev, [field]: parseFloat(value) || 0 }));
  };

  const handleDownload = async () => {
    if (!isSafe) {
      toast.error('Too many tiles', { description: `Reduce the area or zoom range. Maximum is ${MAX_TILES} tiles.` });
      return;
    }
    if (!regionName.trim()) {
      toast.error('Please enter a region name');
      return;
    }
    const cache = await caches.open(OFFLINE_TILES_CACHE);
    setIsDownloading(true);
    abortRef.current = false;
    setProgress({ done: 0, total: tileCount });

    let done = 0;
    const CONCURRENCY = 6;
    const urlGen = generateTileUrls(bbox, minZoom, maxZoom, tileUrlTemplate);
    const batch: Promise<void>[] = [];

    const downloadOne = async (url: string) => {
      if (abortRef.current) return;
      try {
        const resp = await fetch(url, { cache: 'no-store' });
        if (resp.ok) await cache.put(url, resp);
      } catch { /* individual tile failure is non-fatal */ }
      done++;
      setProgress({ done, total: tileCount });
    };

    for (const url of urlGen) {
      if (abortRef.current) break;
      batch.push(downloadOne(url));
      if (batch.length >= CONCURRENCY) {
        await Promise.all(batch);
        batch.length = 0;
      }
    }
    if (batch.length > 0) await Promise.all(batch);

    if (!abortRef.current) {
      const newRegion: CachedRegion = {
        name: regionName.trim(),
        bbox,
        minZoom,
        maxZoom,
        tileCount: done,
        downloadedAt: new Date().toISOString(),
      };
      const updated = [...regions, newRegion];
      saveRegions(updated);
      setRegions(updated);
      setRegionName('');
    }
    setIsDownloading(false);
    setProgress(null);
    refreshStorage();
  };

  const handleCancel = () => { abortRef.current = true; };

  const handleDeleteRegion = async (idx: number) => {
    const region = regions[idx];
    try {
      const cache = await caches.open(OFFLINE_TILES_CACHE);
      // Delete all tile URLs for this region from the cache
      let deleted = 0;
      for (const url of generateTileUrls(region.bbox, region.minZoom, region.maxZoom, tileUrlTemplate)) {
        if (await cache.delete(url)) deleted++;
      }
      const updated = regions.filter((_, i) => i !== idx);
      saveRegions(updated);
      setRegions(updated);
      refreshStorage();
    } catch {
      toast.error('Failed to delete region');
    }
  };

  const inputCls = "w-full px-3 py-1.5 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none";

  return (
    <div className="col-span-4 space-y-4" data-testid="section-offline-tiles">
      <h3 className="text-lg font-medium flex items-center gap-2">
        <WifiOff className="w-5 h-5 text-blue-400" />
        Offline Map Tiles
      </h3>
      <p className="text-sm text-gray-400">
        Pre-download map tiles for a geographic area so the map works without an internet connection.
      </p>

      {/* Region selector */}
      <div className="bg-gray-700/40 rounded-lg p-4 space-y-3">
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Select Region</p>

        <select
          value={selectedRegionIdx}
          onChange={handleRegionSelect}
          className={`${inputCls} text-base`}
          data-testid="select-offline-region"
          disabled={isDownloading}
        >
          <option value={-1}>-- Pick a province, state, or country --</option>
          {(['country', 'ca-province', 'us-state'] as const).map(group => (
            <optgroup key={group} label={GROUP_LABELS[group]}>
              {OFFLINE_REGIONS
                .map((r, i) => ({ r, i }))
                .filter(({ r }) => r.group === group)
                .map(({ r, i }) => (
                  <option key={i} value={i}>{r.name}</option>
                ))
              }
            </optgroup>
          ))}
        </select>

        {/* Zoom range */}
        <div className="grid grid-cols-2 gap-4 mt-2">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Min Zoom: {minZoom}</label>
            <input type="range" min="1" max="16" value={minZoom}
              onChange={e => setMinZoom(Math.min(Number(e.target.value), maxZoom))}
              className="w-full accent-blue-500" data-testid="slider-min-zoom" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Max Zoom: {maxZoom}</label>
            <input type="range" min="1" max="16" value={maxZoom}
              onChange={e => setMaxZoom(Math.max(Number(e.target.value), minZoom))}
              className="w-full accent-blue-500" data-testid="slider-max-zoom" />
          </div>
        </div>

        {/* Estimate — color-coded by size */}
        <div className={`flex items-center gap-2 text-sm ${
          !isSafe ? 'text-red-400' : isLarge ? 'text-amber-400' : 'text-gray-300'
        }`} data-testid="text-tile-estimate">
          <Info className="w-4 h-4 flex-shrink-0" />
          <span>
            {tileCount.toLocaleString()} tiles · ~{formatBytes(estimateSizeBytes(tileCount))}
            {!isSafe && ' — exceeds 500K tile safety cap, reduce max zoom'}
            {isSafe && isLarge && ' — large download, may take a while'}
          </span>
        </div>

        {/* Download button */}
        <div className="flex gap-2 mt-2">
          {isDownloading ? (
            <button onClick={handleCancel}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors"
              data-testid="button-cancel-download">
              Cancel Download
            </button>
          ) : (
            <button onClick={handleDownload} disabled={!isSafe || tileCount === 0 || selectedRegionIdx < 0}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
              data-testid="button-download-tiles">
              <Download className="w-4 h-4" />
              Download {regionName || 'Region'}
            </button>
          )}
        </div>

        {/* Progress bar */}
        {isDownloading && progress && (
          <div className="space-y-1" data-testid="section-download-progress">
            <div className="flex justify-between text-xs text-gray-400">
              <span>Downloading {regionName}…</span>
              <span>{progress.done.toLocaleString()} / {progress.total.toLocaleString()} ({Math.round(progress.done / progress.total * 100)}%)</span>
            </div>
            <div className="w-full bg-gray-600 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-200"
                style={{ width: `${Math.round(progress.done / progress.total * 100)}%` }}
                data-testid="bar-download-progress"
              />
            </div>
          </div>
        )}
      </div>

      {/* Storage usage */}
      {storageUsed && (
        <div className="flex items-center gap-2 text-sm text-gray-400" data-testid="text-storage-used">
          <HardDrive className="w-4 h-4" />
          Browser cache used: <span className="text-gray-200 ml-1">{storageUsed}</span>
        </div>
      )}

      {/* Cached regions list */}
      {regions.length > 0 && (
        <div className="space-y-2" data-testid="list-cached-regions">
          <p className="text-sm font-medium text-gray-300">Cached Regions</p>
          {regions.map((region, idx) => (
            <div key={idx} className="flex items-center justify-between bg-gray-700/50 rounded-lg px-3 py-2"
              data-testid={`card-region-${idx}`}>
              <div>
                <p className="text-sm font-medium text-gray-200">{region.name}</p>
                <p className="text-xs text-gray-400">
                  {region.tileCount.toLocaleString()} tiles · Zoom {region.minZoom}–{region.maxZoom} ·{' '}
                  {new Date(region.downloadedAt).toLocaleDateString()}
                </p>
              </div>
              <button onClick={() => handleDeleteRegion(idx)}
                className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                data-testid={`button-delete-region-${idx}`}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {regions.length === 0 && !isDownloading && (
        <p className="text-sm text-gray-500 italic" data-testid="text-no-regions">
          No offline regions cached yet.
        </p>
      )}
    </div>
  );
};

const allMapProviders = [
  { id: 'osm', name: 'OpenStreetMap (CARTO)', url: CARTO_TILE_URL, description: 'Free, works offline, road/street map. Best for field surveying.' },
  { id: 'google', name: 'Google Maps', url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', requiresKey: true, description: 'Requires API key. Satellite/hybrid views available. Online only.' },
];

const MapSettings = () => {
  const mapProviders = allMapProviders;
  const { mapSettings, setMapSettings } = useSettingsStore();
  const [apiKeys, setApiKeys] = React.useState({
    google: localStorage.getItem('map_api_key_google') || '',
  });
  const [previewCoords, setPreviewCoords] = React.useState({
    lat: mapSettings.center[0],
    lng: mapSettings.center[1]
  });
  const [currentMapType, setCurrentMapType] = React.useState<'roadmap' | 'satellite' | 'hybrid' | 'terrain'>('roadmap');

  const commonInputClasses = "w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500";

  const handleCoordinateChange = (type: 'lat' | 'lng', value: number) => {
    setPreviewCoords(prev => ({
      ...prev,
      [type]: value
    }));
  };

  const handleCoordinateSubmit = () => {
    setMapSettings({
      ...mapSettings,
      center: [previewCoords.lat, previewCoords.lng]
    });
  };

  const handleProviderChange = (provider: string) => {
    setMapSettings({
      ...mapSettings,
      provider: provider as 'google' | 'osm' | 'mapbox' | 'igo2'
    });
  };

  const handleStyleChange = (style: string) => {
    setMapSettings({
      ...mapSettings,
      style
    });
  };

  const handleVisibilityToggle = () => {
    setMapSettings({
      ...mapSettings,
      visible: !mapSettings.visible
    });
  };

  const handleApiKeyChange = (provider: string, value: string) => {
    setApiKeys(prev => {
      const newKeys = { ...prev, [provider]: value };
      return newKeys;
    });
  };

  const handleSaveApiKeys = () => {
    // Save all API keys to localStorage
    Object.entries(apiKeys || {}).forEach(([provider, key]) => {
      if (key && key.trim()) {
        localStorage.setItem(`map_api_key_${provider}`, key.trim());
      }
    });
    
  };

  const isGoogleSelected = mapSettings.provider === 'google';

  return (
    <div className="bg-gray-800 rounded-xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Map Settings</h2>
        <button
          onClick={handleVisibilityToggle}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
            mapSettings.visible ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-600 hover:bg-gray-500'
          }`}
        >
          <Eye className="w-4 h-4" />
          {mapSettings.visible ? 'Map Visible' : 'Map Hidden'}
        </button>
      </div>

      {/* ── Section 1: Map Provider ──────────────────────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-base font-medium flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-400" />
          Map Provider
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {mapProviders.map((provider) => (
            <button
              key={provider.id}
              onClick={() => handleProviderChange(provider.id)}
              className={`p-4 rounded-lg border-2 text-left transition-colors ${
                mapSettings.provider === provider.id
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-3">
                <Map className="w-6 h-6 text-blue-400 flex-shrink-0" />
                <div>
                  <div className="font-medium">{provider.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{(provider as any).description}</div>
                </div>
              </div>
              {provider.id === 'osm' && (
                <div className="mt-2 text-[10px] uppercase tracking-wider text-green-400 font-bold">
                  Works offline
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Section 2: Google Maps options (only if Google selected) ──── */}
      {isGoogleSelected && (
        <div className="space-y-4 bg-gray-700/30 rounded-lg p-4">
          <h3 className="text-base font-medium flex items-center gap-2">
            <Key className="w-5 h-5 text-amber-400" />
            Google Maps API Key
          </h3>
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKeys.google}
              onChange={(e) => handleApiKeyChange('google', e.target.value)}
              className={`${commonInputClasses} flex-1`}
              placeholder="Enter your Google Maps API key"
            />
            <button
              onClick={handleSaveApiKeys}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium"
            >
              Save
            </button>
          </div>

          <h3 className="text-base font-medium flex items-center gap-2 pt-2">
            <Layers className="w-5 h-5 text-blue-400" />
            Map Style
          </h3>
          <div className="grid grid-cols-4 gap-2">
            {([
              { type: 'roadmap',   label: 'Road',      icon: Map },
              { type: 'satellite', label: 'Satellite',  icon: Satellite },
              { type: 'hybrid',    label: 'Hybrid',     icon: Globe },
              { type: 'terrain',   label: 'Terrain',    icon: Mountain },
            ] as const).map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                onClick={() => { setCurrentMapType(type); handleStyleChange(type); }}
                className={`p-3 rounded-lg border-2 transition-colors ${
                  currentMapType === type
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <Icon className="w-5 h-5 mx-auto mb-1" />
                <div className="text-xs font-medium text-center">{label}</div>
              </button>
            ))}
          </div>
          <p className="text-xs text-amber-300/80">
            Google Maps requires an internet connection. When offline, MeasurePRO cannot display Google tiles.
            For offline use, switch to OpenStreetMap and download tiles below.
          </p>
        </div>
      )}

      {/* ── Section 3: Offline Map Downloads ─────────────────────────── */}
      <div className="border-t border-gray-700 pt-6">
        <OfflineTileSection
          tileUrlTemplate={CARTO_TILE_URL}
        />
        {isGoogleSelected && (
          <div className="mt-3 p-3 bg-amber-900/20 border border-amber-700/40 rounded-lg text-xs text-amber-300">
            <strong>Note:</strong> Your map is set to Google Maps, but offline tiles are OpenStreetMap (road map).
            When you lose internet, switch to OpenStreetMap provider to see the cached tiles.
            You can change the provider at any time without re-downloading.
          </div>
        )}
      </div>
    </div>
  );
};

export default MapSettings;