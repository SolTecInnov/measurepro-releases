import React from 'react';
import { Map, Eye, Mountain, Layers, MapPin, Key, Globe, Satellite, Download, Trash2, WifiOff, HardDrive, Info } from 'lucide-react';
import { useSettingsStore } from '../../lib/settings';
import { toast } from 'sonner';
import { useEnabledFeatures } from '../../hooks/useLicenseEnforcement';
import { isBetaUser } from '../../lib/auth/masterAdmin';
import { getAuth } from 'firebase/auth';

// ==================== OFFLINE TILE PRE-DOWNLOAD ====================

// Must match the Workbox runtime cache name in vite.config.ts so predownloaded tiles
// are served by the same service-worker cache that handles live OSM tile requests.
const OFFLINE_TILES_CACHE = 'openstreetmap-tiles';

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
  const subdomain = ['a', 'b', 'c'];
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
        yield urlTemplate.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y)).replace('{s}', s);
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

const MAX_TILES = 5000; // Safety cap to prevent multi-GB downloads

// ==================== OFFLINE TILE UI COMPONENT ====================

const OfflineTileSection: React.FC<{ tileUrlTemplate: string }> = ({ tileUrlTemplate }) => {
  const [bbox, setBbox] = React.useState<BBox>({ north: 46.0, south: 45.4, east: -73.4, west: -74.0 });
  const [minZoom, setMinZoom] = React.useState(10);
  const [maxZoom, setMaxZoom] = React.useState(14);
  const [regionName, setRegionName] = React.useState('');
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null);
  const [regions, setRegions] = React.useState<CachedRegion[]>(loadRegions);
  const [storageUsed, setStorageUsed] = React.useState<string>('');
  const abortRef = React.useRef(false);

  const tileCount = estimateTileCount(bbox, minZoom, maxZoom);
  const isSafe = tileCount <= MAX_TILES;

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
      // toast suppressed
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
      // toast suppressed
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

      {/* Bbox inputs */}
      <div className="bg-gray-700/40 rounded-lg p-4 space-y-3">
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Bounding Box</p>
        <div className="grid grid-cols-3 gap-2 items-center">
          <div />
          <div>
            <label className="block text-xs text-gray-400 mb-1">North</label>
            <input type="number" step="0.0001" value={bbox.north}
              onChange={e => handleBboxChange('north', e.target.value)}
              className={inputCls} data-testid="input-bbox-north" />
          </div>
          <div />
          <div>
            <label className="block text-xs text-gray-400 mb-1">West</label>
            <input type="number" step="0.0001" value={bbox.west}
              onChange={e => handleBboxChange('west', e.target.value)}
              className={inputCls} data-testid="input-bbox-west" />
          </div>
          <div className="text-center text-gray-500 text-xs">↕ ↔</div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">East</label>
            <input type="number" step="0.0001" value={bbox.east}
              onChange={e => handleBboxChange('east', e.target.value)}
              className={inputCls} data-testid="input-bbox-east" />
          </div>
          <div />
          <div>
            <label className="block text-xs text-gray-400 mb-1">South</label>
            <input type="number" step="0.0001" value={bbox.south}
              onChange={e => handleBboxChange('south', e.target.value)}
              className={inputCls} data-testid="input-bbox-south" />
          </div>
          <div />
        </div>

        {/* Zoom range */}
        <div className="grid grid-cols-2 gap-4 mt-2">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Min Zoom: {minZoom}</label>
            <input type="range" min="1" max="18" value={minZoom}
              onChange={e => setMinZoom(Math.min(Number(e.target.value), maxZoom))}
              className="w-full" data-testid="slider-min-zoom" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Max Zoom: {maxZoom}</label>
            <input type="range" min="1" max="18" value={maxZoom}
              onChange={e => setMaxZoom(Math.max(Number(e.target.value), minZoom))}
              className="w-full" data-testid="slider-max-zoom" />
          </div>
        </div>

        {/* Estimate */}
        <div className={`flex items-center gap-2 text-sm ${isSafe ? 'text-gray-300' : 'text-red-400'}`}
          data-testid="text-tile-estimate">
          <Info className="w-4 h-4 flex-shrink-0" />
          {tileCount.toLocaleString()} tiles · ~{formatBytes(estimateSizeBytes(tileCount))} estimated
          {!isSafe && <span className="ml-1">(exceeds {MAX_TILES} tile limit)</span>}
        </div>

        {/* Region name + download */}
        <div className="flex gap-2 mt-2">
          <input
            type="text"
            placeholder="Region name (e.g. Montreal)"
            value={regionName}
            onChange={e => setRegionName(e.target.value)}
            className={`${inputCls} flex-1`}
            data-testid="input-region-name"
            disabled={isDownloading}
          />
          {isDownloading ? (
            <button onClick={handleCancel}
              className="px-4 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
              data-testid="button-cancel-download">
              Cancel
            </button>
          ) : (
            <button onClick={handleDownload} disabled={!isSafe || tileCount === 0}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors flex items-center gap-1 whitespace-nowrap"
              data-testid="button-download-tiles">
              <Download className="w-4 h-4" />
              Download
            </button>
          )}
        </div>

        {/* Progress bar */}
        {isDownloading && progress && (
          <div className="space-y-1" data-testid="section-download-progress">
            <div className="flex justify-between text-xs text-gray-400">
              <span>Downloading tiles…</span>
              <span>{progress.done} / {progress.total}</span>
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
  { id: 'google', name: 'Google Maps', url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', requiresKey: true },
  { id: 'osm', name: 'OpenStreetMap', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' },
  { id: 'mapbox', name: 'Mapbox', url: 'https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/{z}/{x}/{y}', requiresKey: true },
  { id: 'igo2', name: 'IGO2', url: 'https://geoegl.msp.gouv.qc.ca/apis/carto/tms/1.0.0/carte_gouv_qc_ro/{z}/{x}/{y}.png', requiresKey: true }
];

const MapSettings = () => {
  // Check if beta user (hide Mapbox, iGo2, and default zoom for beta/not-logged-in users)
  const auth = getAuth();
  const { features } = useEnabledFeatures();
  const isBeta = isBetaUser(auth.currentUser, features);
  
  // Filter map providers - only show Google and OSM for beta users
  const mapProviders = isBeta 
    ? allMapProviders.filter(p => p.id === 'google' || p.id === 'osm')
    : allMapProviders;
  const { mapSettings, setMapSettings } = useSettingsStore();
  const [apiKeys, setApiKeys] = React.useState({
    google: localStorage.getItem('map_api_key_google') || '',
    mapbox: localStorage.getItem('map_api_key_mapbox') || '',
    igo2: localStorage.getItem('map_api_key_igo2') || ''
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
    
    // toast suppressed
  };

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <h2 className="text-xl font-semibold mb-4">Map Settings</h2>
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          <div className="col-span-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-400" />
                Map Provider
              </h3>
              <button
                onClick={handleVisibilityToggle}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  mapSettings.visible ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-600 hover:bg-gray-500'
                }`}
              >
                <Eye className="w-4 h-4" />
                {mapSettings.visible ? 'Hide Map' : 'Show Map'}
              </button>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {mapProviders.map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => handleProviderChange(provider.id)}
                  className={`p-4 rounded-lg border-2 transition-colors ${
                    mapSettings.provider === provider.id
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <Map className="w-6 h-6 mx-auto mb-2" />
                  <div className="text-sm font-medium">{provider.name}</div>
                </button>
              ))}
            </div>
          </div>
          
          {/* API Key Settings (Only show Google for beta users) */}
          <div className="col-span-4 space-y-4 mb-6">
            <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
              <Key className="w-5 h-5 text-blue-400" />
              API Keys
            </h3>
            
            {mapProviders.filter(p => p.requiresKey).map((provider) => (
              <div key={provider.id} className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">
                  {provider.name} API Key
                </label>
                <input
                  type="password"
                  value={apiKeys[provider.id as keyof typeof apiKeys]}
                  onChange={(e) => handleApiKeyChange(provider.id, e.target.value)}
                  className={commonInputClasses}
                  placeholder={`Enter your ${provider.name} API key`}
                />
              </div>
            ))}
            
            <div className="flex justify-between items-center pt-4">
              <p className="text-sm text-gray-400">
                API keys are stored securely in your browser's local storage
              </p>
              <button
                onClick={handleSaveApiKeys}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
              >
                Save API Keys
              </button>
            </div>
          </div>
          
          <div className="col-span-4 mb-6">
            <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
              <Layers className="w-5 h-5 text-blue-400" />
              Google Maps Style
            </h3>
            <div className="grid grid-cols-4 gap-4">
              <button
                onClick={() => {
                  setCurrentMapType('roadmap');
                  handleStyleChange('roadmap');
                }}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  currentMapType === 'roadmap'
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <Map className="w-6 h-6 mx-auto mb-2" />
                <div className="text-sm font-medium">Roadmap</div>
              </button>
              
              <button
                onClick={() => {
                  setCurrentMapType('satellite');
                  handleStyleChange('satellite');
                }}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  currentMapType === 'satellite'
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <Satellite className="w-6 h-6 mx-auto mb-2" />
                <div className="text-sm font-medium">Satellite</div>
              </button>
              
              <button
                onClick={() => {
                  setCurrentMapType('hybrid');
                  handleStyleChange('hybrid');
                }}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  currentMapType === 'hybrid'
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <Globe className="w-6 h-6 mx-auto mb-2" />
                <div className="text-sm font-medium">Hybrid</div>
              </button>
              
              <button
                onClick={() => {
                  setCurrentMapType('terrain');
                  handleStyleChange('terrain');
                }}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  currentMapType === 'terrain'
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <Mountain className="w-6 h-6 mx-auto mb-2" />
                <div className="text-sm font-medium">Terrain</div>
              </button>
            </div>
            
            <div className="mt-4 p-3 bg-gray-700/50 rounded text-sm">
              <p className="text-gray-300 mb-2">Note: Map style changes will be applied to the Route Map in real-time.</p>
              <p className="text-gray-400 text-xs">Current selection affects the main map display immediately.</p>
            </div>
          </div>

          <div className="col-span-4 space-y-4">
            <h3 className="text-lg font-medium">Default Location</h3>
            <p className="text-sm text-gray-400 mb-4">
              Set the default map center coordinates. Current location: Montreal, QC, Canada
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Default Latitude</label>
                <input
                  type="number"
                  value={previewCoords.lat}
                  onChange={(e) => handleCoordinateChange('lat', Number(e.target.value))}
                  className={commonInputClasses}
                  step="0.000001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Default Longitude</label>
                <input
                  type="number"
                  value={previewCoords.lng}
                  onChange={(e) => handleCoordinateChange('lng', Number(e.target.value))}
                  className={commonInputClasses}
                  step="0.000001"
                />
              </div>
            </div>
            
            <button
              onClick={handleCoordinateSubmit}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
            >
              Update Map Center
            </button>
          </div>

          {/* Default Zoom Level (Hidden for beta users) */}
          {!isBeta && (
            <div className="col-span-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">Default Zoom Level</label>
              <input
                type="range"
                min="1"
                max="20"
                value={mapSettings.zoom}
                onChange={(e) => setMapSettings({
                  ...mapSettings,
                  zoom: Number(e.target.value)
                })}
                className="w-full"
              />
              <div className="text-sm text-gray-400 mt-1">
                Current zoom: {mapSettings.zoom}
              </div>
            </div>
          )}

          {/* Offline Map Tile Pre-Download */}
          <div className="col-span-4 border-t border-gray-700 pt-6">
            <OfflineTileSection
              tileUrlTemplate={
                // Use OSM as the offline tile source (always works without an API key)
                'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapSettings;