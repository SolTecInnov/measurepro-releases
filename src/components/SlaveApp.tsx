import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera, MapPin, Save, Trash2, Plus, Minus, Navigation,
  CheckCircle, AlertTriangle, Wifi, WifiOff, ChevronDown,
  ChevronUp, PenLine, X, RotateCcw, Image, Smartphone, Clock,
  Building2, Anchor, Package, Flag, Hammer, Milestone, Disc,
  Route, MoreHorizontal, Loader2, type LucideIcon
} from 'lucide-react';
import { POI_TYPES, type POIType } from '../lib/poi';
import { toast } from 'sonner';
import { useSettingsStore } from '../lib/settings';
import { parseInputToMeters, formatMeasurement } from '../lib/utils/unitConversion';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DimensionEntry {
  id: string;
  label: string;
  value: string;
}

interface SlaveCapture {
  id: string;
  poiType: POIType | '';
  locationType: string;
  dimensions: DimensionEntry[];
  photos: string[];
  drawings: string[];
  note: string;
  gps: { latitude: number; longitude: number; altitude: number; accuracy: number };
  timestamp: string;
  surveyId: string;
  roadNumber: number;
  poiNumber: number;
}

interface SlaveAppProps {
  wsConnection?: WebSocket;
  onDisconnect?: () => void;
  onRegisterAckCallback?: (cb: (id: string, failed: boolean) => void) => void;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const LOCATION_TYPES: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'manufacturer', label: 'Manufacturer', icon: Building2 },
  { id: 'port',         label: 'Port / Cargo', icon: Anchor },
  { id: 'laydown',      label: 'Laydown',       icon: Package },
  { id: 'destination',  label: 'Destination',   icon: Flag },
  { id: 'construction', label: 'Construction',  icon: Hammer },
  { id: 'bridge',       label: 'Bridge',        icon: Milestone },
  { id: 'culvert',      label: 'Culvert',       icon: Disc },
  { id: 'road',         label: 'Road Feature',  icon: Route },
  { id: 'other',        label: 'Other',         icon: MoreHorizontal },
];

const PRESET_DIMENSIONS = [
  'Height', 'Width', 'Length', 'Left Clearance', 'Right Clearance', 'Overhead Clearance', 'Depth', 'Radius',
];

const SKETCH_COLORS = ['#000000', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#ffffff'];
const SKETCH_SIZES = [2, 5, 12];
const OFFLINE_QUEUE_KEY = 'slaveApp_offlineQueue';
const MAX_PHOTOS = 8;

// ─── Photo Compression ────────────────────────────────────────────────────────

function compressImage(dataUrl: string, maxWidth = 1024, quality = 0.72): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ratio = Math.min(maxWidth / img.width, 1);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

const SlaveApp = ({ wsConnection, onDisconnect, onRegisterAckCallback }: SlaveAppProps) => {
  const { displaySettings } = useSettingsStore();
  const displayUnits = displaySettings?.units || 'metric';

  // Survey context
  const [activeSurvey, setActiveSurvey] = useState<any>(null);
  const [nextPoiNumber, setNextPoiNumber] = useState(1);
  const [nextRoadNumber, setNextRoadNumber] = useState(1);

  // GPS
  const [gps, setGps] = useState({ latitude: 0, longitude: 0, altitude: 0, accuracy: 999 });
  const [gpsReady, setGpsReady] = useState(false);

  // Form state
  const [locationType, setLocationType] = useState('');
  const [poiType, setPoiType] = useState<POIType | ''>('');
  const [dimensions, setDimensions] = useState<DimensionEntry[]>([
    { id: crypto.randomUUID(), label: 'Height', value: '' },
    { id: crypto.randomUUID(), label: 'Width', value: '' },
    { id: crypto.randomUUID(), label: 'Length', value: '' },
  ]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [drawings, setDrawings] = useState<string[]>([]);
  const [note, setNote] = useState('');

  // UI state
  const [showSketch, setShowSketch] = useState(false);
  const [surveyOpen, setSurveyOpen] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle');
  const [offlineCount, setOfflineCount] = useState(0);
  const [history, setHistory] = useState<SlaveCapture[]>([]);

  // Per-capture ACK tracking
  const pendingAcksRef = useRef<Map<string, SlaveCapture>>(new Map());

  // Register the ACK callback with the parent (SlaveAppWithPairing)
  useEffect(() => {
    if (!onRegisterAckCallback) return;
    onRegisterAckCallback((id: string, failed: boolean) => {
      const capture = pendingAcksRef.current.get(id);
      if (!capture) return;
      pendingAcksRef.current.delete(id);

      if (failed) {
        // Master not reachable — re-queue the capture
        const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
        const queue: SlaveCapture[] = raw ? JSON.parse(raw) : [];
        if (!queue.find(c => c.id === id)) {
          queue.push(capture);
          localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
          setOfflineCount(queue.length);
        }
        toast.warning('Tablet not reachable — capture kept in offline queue');
        setSyncStatus('error');
        setTimeout(() => setSyncStatus('idle'), 3000);
      } else {
        // ACK received — remove from localStorage queue if present
        const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
        if (raw) {
          try {
            const queue: SlaveCapture[] = JSON.parse(raw);
            const filtered = queue.filter(c => c.id !== id);
            if (filtered.length === 0) {
              localStorage.removeItem(OFFLINE_QUEUE_KEY);
            } else {
              localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(filtered));
            }
            setOfflineCount(filtered.length);
          } catch {}
        }
        setSyncStatus('done');
        setTimeout(() => setSyncStatus('idle'), 3000);
        toast.success('Capture confirmed by tablet ✓');
      }
    });
  }, [onRegisterAckCallback]);

  // Sketch state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sketchHistoryRef = useRef<ImageData[]>([]);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [sketchColor, setSketchColor] = useState('#000000');
  const [sketchSize, setSketchSize] = useState(5);
  const [isEraser, setIsEraser] = useState(false);

  // Photo input ref
  const photoInputRef = useRef<HTMLInputElement>(null);

  // ── Load survey from localStorage ──────────────────────────────────────────

  useEffect(() => {
    const load = () => {
      const surveyJson = localStorage.getItem('mainApp_activeSurvey');
      if (surveyJson) {
        try { setActiveSurvey(JSON.parse(surveyJson)); } catch {}
      }
      const rn = localStorage.getItem('mainApp_nextRoadNumber');
      const pn = localStorage.getItem('mainApp_nextPoiNumber');
      if (rn) setNextRoadNumber(parseInt(rn) || 1);
      if (pn) setNextPoiNumber(parseInt(pn) || 1);

      const q = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (q) { try { setOfflineCount(JSON.parse(q).length); } catch {} }
    };
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  // ── GPS ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setGps({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          altitude: pos.coords.altitude ?? 0,
          accuracy: pos.coords.accuracy,
        });
        setGpsReady(true);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // ── Build payload ─────────────────────────────────────────────────────────

  const buildPayload = useCallback((capture: SlaveCapture) => {
    const heightDim = capture.dimensions.find(d => d.label.toLowerCase().includes('height'));
    const widthDim = capture.dimensions.find(d => d.label.toLowerCase().includes('width'));
    const lengthDim = capture.dimensions.find(d => d.label.toLowerCase().includes('length'));

    const heightM = heightDim?.value ? parseInputToMeters(heightDim.value, displayUnits) : 0;
    const widthM = widthDim?.value ? parseInputToMeters(widthDim.value, displayUnits) : null;
    const lengthM = lengthDim?.value ? parseInputToMeters(lengthDim.value, displayUnits) : null;

    const dimNote = capture.dimensions
      .filter(d => d.value)
      .map(d => `${d.label}: ${d.value}${displayUnits === 'imperial' ? ' ft' : ' m'}`)
      .join(', ');
    const locLabel = LOCATION_TYPES.find(l => l.id === capture.locationType)?.label || capture.locationType;
    const fullNote = [
      `[FIELD APP]`,
      locLabel ? `Location: ${locLabel}` : '',
      dimNote,
      capture.note,
    ].filter(Boolean).join(' | ');

    return {
      id: capture.id,
      rel: heightM,
      widthMeasure: widthM,
      lengthMeasure: lengthM,
      altGPS: capture.gps.altitude,
      latitude: capture.gps.latitude,
      longitude: capture.gps.longitude,
      utcDate: capture.timestamp.split('T')[0],
      utcTime: capture.timestamp.split('T')[1]?.split('.')[0] || '',
      speed: 0,
      heading: 0,
      roadNumber: capture.roadNumber,
      poiNumber: capture.poiNumber,
      poi_type: capture.poiType,
      note: fullNote,
      locationType: capture.locationType,
      imageUrl: capture.photos[0] ?? null,
      photos: capture.photos,
      drawingUrl: capture.drawings[0] ?? null,
      drawings: capture.drawings,
      dimensions: capture.dimensions.filter(d => d.value),
      createdAt: capture.timestamp,
      survey_id: capture.surveyId,
      source: 'fieldApp',
    };
  }, [displayUnits]);

  // ── Drain offline queue when WS opens ─────────────────────────────────────

  useEffect(() => {
    if (!wsConnection) return;

    const drainQueue = () => {
      const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (!raw) return;
      try {
        const queue: SlaveCapture[] = JSON.parse(raw);
        if (queue.length === 0) return;
        queue.forEach((capture) => {
          wsConnection.send(JSON.stringify({ type: 'slave_pairing_measurement', measurement: buildPayload(capture) }));
          // Track in pendingAcks — item stays in localStorage until ACK arrives
          pendingAcksRef.current.set(capture.id, capture);
          // 8-second timeout: re-queue if no ACK
          setTimeout(() => {
            if (!pendingAcksRef.current.has(capture.id)) return;
            pendingAcksRef.current.delete(capture.id);
            const currentRaw = localStorage.getItem(OFFLINE_QUEUE_KEY);
            const currentQueue: SlaveCapture[] = currentRaw ? JSON.parse(currentRaw) : [];
            if (!currentQueue.find(c => c.id === capture.id)) {
              currentQueue.push(capture);
              localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(currentQueue));
              setOfflineCount(currentQueue.length);
            }
            toast.warning('No acknowledgement from tablet — capture re-queued for retry');
          }, 8000);
        });
      } catch {}
    };

    // Drain immediately if already open
    if (wsConnection.readyState === WebSocket.OPEN) {
      drainQueue();
    }
    // Also listen for open event (reconnect case)
    wsConnection.addEventListener('open', drainQueue);
    return () => wsConnection.removeEventListener('open', drainQueue);
  }, [wsConnection, buildPayload]);

  // ── Dimensions helpers ─────────────────────────────────────────────────────

  const addDimension = (label: string) => {
    setDimensions(prev => [...prev, { id: crypto.randomUUID(), label, value: '' }]);
  };

  const addCustomDimension = () => {
    const label = prompt('Dimension name (e.g. Axle Weight, Radius):');
    if (label?.trim()) addDimension(label.trim());
  };

  const removeDimension = (id: string) => {
    setDimensions(prev => prev.filter(d => d.id !== id));
  };

  const updateDimension = (id: string, value: string) => {
    setDimensions(prev => prev.map(d => d.id === id ? { ...d, value } : d));
  };

  // ── Photos ────────────────────────────────────────────────────────────────

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const remaining = MAX_PHOTOS - photos.length;
    const toProcess = files.slice(0, remaining);

    const compressed = await Promise.all(toProcess.map(file => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = async (ev) => {
          const dataUrl = ev.target?.result as string;
          resolve(await compressImage(dataUrl, 1024, 0.72));
        };
        reader.readAsDataURL(file);
      });
    }));

    setPhotos(prev => [...prev, ...compressed]);
    if (e.target) e.target.value = '';
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  // ── Initialize sketch canvas when modal opens ───────────────────────────

  useEffect(() => {
    if (!showSketch || !canvasRef.current) return;
    // Small delay to let the canvas render
    requestAnimationFrame(() => {
      if (!canvasRef.current) return;
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      sketchHistoryRef.current = [];
    });
  }, [showSketch]);

  // ── Sketch helpers ────────────────────────────────────────────────────────

  const getCanvasPoint = (e: React.TouchEvent | React.MouseEvent) => {
    if (!canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = canvasRef.current.width / rect.width;
    const sy = canvasRef.current.height / rect.height;
    const clientX = 'touches' in e ? e.touches[0]?.clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0]?.clientY : e.clientY;
    if (clientX === undefined || clientY === undefined) return null;
    return { x: (clientX - rect.left) * sx, y: (clientY - rect.top) * sy };
  };

  const pushSketchHistory = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d')!;
    sketchHistoryRef.current.push(ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height));
    if (sketchHistoryRef.current.length > 30) sketchHistoryRef.current.shift();
  };

  const startSketch = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    pushSketchHistory();
    isDrawingRef.current = true;
    lastPointRef.current = getCanvasPoint(e);
  };

  const doSketch = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isDrawingRef.current || !canvasRef.current || !lastPointRef.current) return;
    const pt = getCanvasPoint(e);
    if (!pt) return;
    const ctx = canvasRef.current.getContext('2d')!;
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.strokeStyle = isEraser ? '#ffffff' : sketchColor;
    ctx.lineWidth = isEraser ? sketchSize * 3 : sketchSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPointRef.current = pt;
  };

  const stopSketch = () => { isDrawingRef.current = false; lastPointRef.current = null; };

  const undoSketch = () => {
    if (!canvasRef.current || sketchHistoryRef.current.length === 0) return;
    const ctx = canvasRef.current.getContext('2d')!;
    ctx.putImageData(sketchHistoryRef.current.pop()!, 0, 0);
  };

  const clearSketch = () => {
    if (!canvasRef.current) return;
    pushSketchHistory();
    const ctx = canvasRef.current.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  const saveSketch = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    setDrawings(prev => [...prev, dataUrl]);
    setShowSketch(false);
    toast.success('Sketch saved');
  };


  // ── Save / Sync ────────────────────────────────────────────────────────────

  const saveCapture = () => {
    if (!activeSurvey) {
      toast.error('No active survey on master device');
      return;
    }
    if (!poiType) {
      toast.error('Please select a POI type');
      return;
    }
    const hasDim = dimensions.some(d => d.value.trim() !== '');
    if (!hasDim && photos.length === 0) {
      toast.error('Add at least one measurement or photo');
      return;
    }

    const capture: SlaveCapture = {
      id: crypto.randomUUID(),
      poiType,
      locationType,
      dimensions,
      photos,
      drawings,
      note,
      gps,
      timestamp: new Date().toISOString(),
      surveyId: activeSurvey.id,
      roadNumber: nextRoadNumber,
      poiNumber: nextPoiNumber,
    };

    const isWsOpen = wsConnection && wsConnection.readyState === WebSocket.OPEN;

    if (isWsOpen) {
      setSyncStatus('syncing');
      wsConnection!.send(JSON.stringify({ type: 'slave_pairing_measurement', measurement: buildPayload(capture) }));
      // Track in pendingAcks — ACK handler will set 'done' and show toast
      pendingAcksRef.current.set(capture.id, capture);
      // 8-second timeout: if no ACK, queue offline and show warning
      setTimeout(() => {
        if (!pendingAcksRef.current.has(capture.id)) return;
        pendingAcksRef.current.delete(capture.id);
        const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
        const queue: SlaveCapture[] = raw ? JSON.parse(raw) : [];
        if (!queue.find(c => c.id === capture.id)) {
          queue.push(capture);
          localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
          setOfflineCount(queue.length);
        }
        setSyncStatus('error');
        setTimeout(() => setSyncStatus('idle'), 3000);
        toast.warning('No acknowledgement from tablet — capture saved offline for retry');
      }, 8000);
    } else {
      // Queue offline
      const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
      const queue: SlaveCapture[] = raw ? JSON.parse(raw) : [];
      queue.push(capture);
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
      setOfflineCount(queue.length);
      toast.info(`Saved offline (${queue.length} pending). Will sync when reconnected.`);
    }

    // Add to local history
    setHistory(prev => [capture, ...prev].slice(0, 20));

    // Increment POI number
    setNextPoiNumber(prev => prev + 1);

    // Reset form
    setPoiType('');
    setLocationType('');
    setDimensions([
      { id: crypto.randomUUID(), label: 'Height', value: '' },
      { id: crypto.randomUUID(), label: 'Width', value: '' },
      { id: crypto.randomUUID(), label: 'Length', value: '' },
    ]);
    setPhotos([]);
    setDrawings([]);
    setNote('');
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  const isWsConnected = wsConnection && wsConnection.readyState === WebSocket.OPEN;
  const unitLabel = displayUnits === 'imperial' ? 'ft' : 'm';

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 pb-24">

      {/* ── Sticky Header ────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-gray-900 border-b border-gray-700 shadow-lg">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-blue-400" />
            <span className="font-bold text-lg">Field Capture</span>
            {offlineCount > 0 && (
              <span className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {offlineCount} pending
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* GPS indicator */}
            <div className={`flex items-center gap-1 text-xs ${gpsReady ? 'text-green-400' : 'text-gray-500'}`}>
              <Navigation className="w-3.5 h-3.5" />
              {gpsReady ? `±${Math.round(gps.accuracy)}m` : 'GPS...'}
            </div>
            {/* Connection indicator */}
            <div className={`flex items-center gap-1 text-xs ${isWsConnected ? 'text-green-400' : 'text-orange-400'}`}>
              {isWsConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              {isWsConnected ? 'Live' : 'Offline'}
            </div>
            {/* Disconnect button */}
            {onDisconnect && (
              <button
                onClick={onDisconnect}
                className="text-xs text-gray-400 hover:text-red-400 px-2 py-1 rounded border border-gray-700 hover:border-red-600 transition-colors"
                data-testid="button-disconnect"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">

        {/* ── Survey Banner ────────────────────────────────────────────────── */}
        <div className={`rounded-xl border ${activeSurvey ? 'bg-green-950/40 border-green-800/40' : 'bg-yellow-950/40 border-yellow-700/40'}`}>
          <button
            className="w-full flex items-center justify-between p-4"
            onClick={() => setSurveyOpen(p => !p)}
          >
            <div className="flex items-center gap-2">
              {activeSurvey
                ? <CheckCircle className="w-5 h-5 text-green-400" />
                : <AlertTriangle className="w-5 h-5 text-yellow-400" />}
              <span className={`font-semibold ${activeSurvey ? 'text-green-300' : 'text-yellow-300'}`}>
                {activeSurvey ? (activeSurvey.name || activeSurvey.surveyTitle || 'Active Survey') : 'No Active Survey'}
              </span>
            </div>
            {surveyOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
          {surveyOpen && (
            <div className="px-4 pb-4">
              {activeSurvey ? (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-gray-800/60 rounded-lg p-2">
                    <div className="text-gray-400 text-xs mb-1">Surveyor</div>
                    <div className="font-medium truncate">{activeSurvey.surveyor || activeSurvey.surveyorName || '—'}</div>
                  </div>
                  <div className="bg-gray-800/60 rounded-lg p-2">
                    <div className="text-gray-400 text-xs mb-1">Next POI</div>
                    <div className="font-mono font-bold text-blue-300">#{String(nextPoiNumber).padStart(4, '0')}</div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-yellow-200/70">
                  Open MeasurePRO on the tablet and activate a survey, then connect the Field App.
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Location Type ────────────────────────────────────────────────── */}
        <div className="bg-gray-900 rounded-xl border border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-400" />
            Location Type
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {LOCATION_TYPES.map(lt => (
              <button
                key={lt.id}
                onClick={() => setLocationType(locationType === lt.id ? '' : lt.id)}
                className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg border text-xs font-medium transition-all ${
                  locationType === lt.id
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-300 active:bg-gray-700'
                }`}
                data-testid={`button-loctype-${lt.id}`}
              >
                <lt.icon className="w-5 h-5" />
                <span>{lt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── POI Type ─────────────────────────────────────────────────────── */}
        <div className="bg-gray-900 rounded-xl border border-gray-700 p-4">
          <label className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-purple-400" />
            POI Type *
          </label>
          <select
            value={poiType}
            onChange={(e) => setPoiType(e.target.value as POIType)}
            className="w-full mt-2 bg-gray-800 border border-gray-600 text-gray-100 rounded-lg px-3 py-3 text-base focus:ring-2 focus:ring-blue-500"
            data-testid="select-poi-type"
          >
            <option value="">— Select POI Type —</option>
            {POI_TYPES.filter(p => p.type !== '').map(p => (
              <option key={p.type} value={p.type}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* ── Dimensions ───────────────────────────────────────────────────── */}
        <div className="bg-gray-900 rounded-xl border border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
            </svg>
            Measurements ({unitLabel})
          </h3>

          <div className="space-y-2 mb-3">
            {dimensions.map((dim, i) => (
              <div key={dim.id} className="flex items-center gap-2">
                <div className="flex-1 bg-gray-800 border border-gray-700 rounded-lg flex overflow-hidden">
                  <span className="px-3 py-3 text-xs text-gray-400 bg-gray-700/60 border-r border-gray-700 whitespace-nowrap min-w-[7rem] flex items-center">
                    {dim.label}
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={dim.value}
                    onChange={(e) => updateDimension(dim.id, e.target.value)}
                    className="flex-1 bg-transparent px-3 py-3 text-gray-100 text-base focus:outline-none focus:ring-0"
                    placeholder="0.000"
                    step="0.001"
                    data-testid={`input-dim-${i}`}
                  />
                  <span className="px-2 py-3 text-xs text-gray-500 flex items-center">{unitLabel}</span>
                </div>
                <button
                  onClick={() => removeDimension(dim.id)}
                  className="p-2 text-gray-500 hover:text-red-400 active:text-red-400"
                  data-testid={`button-remove-dim-${i}`}
                >
                  <Minus className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Preset quick-add */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {PRESET_DIMENSIONS.filter(p => !dimensions.some(d => d.label === p)).map(preset => (
              <button
                key={preset}
                onClick={() => addDimension(preset)}
                className="px-2.5 py-1 bg-gray-800 border border-gray-600 text-gray-300 text-xs rounded-full hover:bg-gray-700 active:bg-gray-700 flex items-center gap-1"
                data-testid={`button-preset-${preset}`}
              >
                <Plus className="w-3 h-3" />
                {preset}
              </button>
            ))}
            <button
              onClick={addCustomDimension}
              className="px-2.5 py-1 bg-blue-900/40 border border-blue-700/50 text-blue-300 text-xs rounded-full hover:bg-blue-900/60 active:bg-blue-900/60 flex items-center gap-1"
              data-testid="button-custom-dim"
            >
              <Plus className="w-3 h-3" />
              Custom…
            </button>
          </div>
        </div>

        {/* ── Photos ───────────────────────────────────────────────────────── */}
        <div className="bg-gray-900 rounded-xl border border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <Image className="w-4 h-4 text-yellow-400" />
              Photos ({photos.length}/{MAX_PHOTOS})
            </h3>
            {photos.length < MAX_PHOTOS && (
              <button
                onClick={() => photoInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-600/80 hover:bg-yellow-600 active:bg-yellow-700 rounded-lg text-sm font-medium"
                data-testid="button-add-photo"
              >
                <Camera className="w-4 h-4" />
                Add Photo
              </button>
            )}
          </div>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={handlePhotoCapture}
            data-testid="input-photo"
          />

          {photos.length === 0 ? (
            <button
              onClick={() => photoInputRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-700 rounded-xl py-8 flex flex-col items-center gap-2 text-gray-500 hover:border-gray-500 active:border-gray-500 transition-colors"
              data-testid="button-photo-placeholder"
            >
              <Camera className="w-8 h-8" />
              <span className="text-sm">Tap to add photos</span>
              <span className="text-xs">Camera or file (up to {MAX_PHOTOS})</span>
            </button>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((photo, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-gray-800">
                  <img src={photo} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 bg-black/70 rounded-full p-0.5 text-white"
                    data-testid={`button-remove-photo-${i}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <div className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-1 rounded">
                    {i + 1}
                  </div>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button
                  onClick={() => photoInputRef.current?.click()}
                  className="aspect-square rounded-lg border-2 border-dashed border-gray-700 flex flex-col items-center justify-center gap-1 text-gray-500 hover:border-gray-500 active:border-gray-500"
                  data-testid="button-add-more-photos"
                >
                  <Plus className="w-5 h-5" />
                  <span className="text-xs">Add</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Sketches ─────────────────────────────────────────────────────── */}
        <div className="bg-gray-900 rounded-xl border border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <PenLine className="w-4 h-4 text-purple-400" />
              Sketches ({drawings.length})
            </h3>
            <button
              onClick={() => setShowSketch(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-700/80 hover:bg-purple-700 active:bg-purple-800 rounded-lg text-sm font-medium"
              data-testid="button-open-sketch"
            >
              <PenLine className="w-4 h-4" />
              Draw
            </button>
          </div>

          {drawings.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {drawings.map((drawing, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-white">
                  <img src={drawing} alt={`Sketch ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => setDrawings(prev => prev.filter((_, j) => j !== i))}
                    className="absolute top-1 right-1 bg-black/70 rounded-full p-0.5 text-white"
                    data-testid={`button-remove-sketch-${i}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Notes ────────────────────────────────────────────────────────── */}
        <div className="bg-gray-900 rounded-xl border border-gray-700 p-4">
          <label className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Notes
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full mt-2 bg-gray-800 border border-gray-700 text-gray-100 rounded-lg px-3 py-3 text-base focus:ring-2 focus:ring-blue-500 h-24 resize-none"
            placeholder="Additional observations, conditions, remarks…"
            data-testid="textarea-notes"
          />
        </div>

        {/* ── GPS Info ─────────────────────────────────────────────────────── */}
        <div className="bg-gray-900/60 rounded-xl border border-gray-800 p-3">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Navigation className={`w-3.5 h-3.5 ${gpsReady ? 'text-green-400' : 'text-gray-600'}`} />
            {gpsReady
              ? `${gps.latitude.toFixed(6)}°, ${gps.longitude.toFixed(6)}° · Alt ${gps.altitude.toFixed(0)}m · ±${Math.round(gps.accuracy)}m`
              : 'Acquiring GPS location…'}
          </div>
        </div>

        {/* ── Recent Captures ──────────────────────────────────────────────── */}
        {history.length > 0 && (
          <div className="bg-gray-900 rounded-xl border border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              Recent Captures ({history.length})
            </h3>
            <div className="space-y-2">
              {history.slice(0, 5).map((cap) => (
                <div key={cap.id} className="bg-gray-800 rounded-lg p-3 flex items-start gap-3">
                  {cap.photos[0] && (
                    <img src={cap.photos[0]} alt="" className="w-12 h-12 object-cover rounded-lg flex-shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-blue-300">#{String(cap.poiNumber).padStart(4, '0')}</span>
                      <span className="text-xs bg-gray-700 px-1.5 py-0.5 rounded text-gray-300">{cap.poiType}</span>
                      {cap.locationType && (
                        <span className="text-xs text-gray-500">{LOCATION_TYPES.find(l => l.id === cap.locationType)?.label}</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">
                      {cap.dimensions.filter(d => d.value).map(d => `${d.label}: ${d.value}${unitLabel}`).join(' · ')}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {new Date(cap.timestamp).toLocaleTimeString()} · {cap.photos.length} photo{cap.photos.length !== 1 ? 's' : ''} · {cap.drawings.length} sketch{cap.drawings.length !== 1 ? 'es' : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Sticky Save Button ────────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-gray-950/95 backdrop-blur border-t border-gray-800 p-4">
        <div className="max-w-lg mx-auto">
          {!isWsConnected && (
            <div className="text-center text-xs text-orange-400 mb-2 flex items-center justify-center gap-1">
              <WifiOff className="w-3 h-3" />
              Not connected — captures will be saved offline and synced when reconnected
            </div>
          )}
          <button
            onClick={saveCapture}
            disabled={syncStatus === 'syncing'}
            className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-base transition-all ${
              syncStatus === 'done'
                ? 'bg-green-600 text-white'
                : syncStatus === 'syncing'
                ? 'bg-blue-700 text-white'
                : 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white'
            }`}
            data-testid="button-save-capture"
          >
            {syncStatus === 'syncing' ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Sending…</>
            ) : syncStatus === 'done' ? (
              <><CheckCircle className="w-5 h-5" /> Confirmed by tablet ✓</>
            ) : (
              <><Save className="w-5 h-5" /> Save & Sync to Tablet</>
            )}
          </button>
        </div>
      </div>

      {/* ── Sketch Modal ─────────────────────────────────────────────────────── */}
      {showSketch && (
        <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col">
          {/* Sketch toolbar */}
          <div className="bg-gray-900 border-b border-gray-700 p-3 flex items-center gap-3 flex-wrap">
            <button onClick={() => setShowSketch(false)} className="p-2 text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <span className="text-sm font-semibold text-gray-300 mr-1">Sketch</span>

            {/* Colors */}
            <div className="flex gap-1.5">
              {SKETCH_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => { setSketchColor(color); setIsEraser(false); }}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${
                    !isEraser && sketchColor === color ? 'border-white scale-110' : 'border-gray-600'
                  }`}
                  style={{ backgroundColor: color }}
                  data-testid={`button-color-${color}`}
                />
              ))}
            </div>

            {/* Sizes */}
            <div className="flex gap-1.5 items-center">
              {SKETCH_SIZES.map(size => (
                <button
                  key={size}
                  onClick={() => { setSketchSize(size); setIsEraser(false); }}
                  className={`rounded-full bg-white transition-all ${sketchSize === size && !isEraser ? 'ring-2 ring-blue-400' : 'opacity-50'}`}
                  style={{ width: size * 2 + 8, height: size * 2 + 8 }}
                  data-testid={`button-size-${size}`}
                />
              ))}
            </div>

            {/* Eraser */}
            <button
              onClick={() => setIsEraser(p => !p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${isEraser ? 'bg-gray-300 text-gray-900 border-gray-200' : 'bg-gray-800 text-gray-300 border-gray-600'}`}
              data-testid="button-eraser"
            >
              Eraser
            </button>

            <div className="flex gap-2 ml-auto">
              <button onClick={undoSketch} className="p-2 text-gray-400 hover:text-white" data-testid="button-undo-sketch">
                <RotateCcw className="w-4 h-4" />
              </button>
              <button onClick={clearSketch} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs" data-testid="button-clear-sketch">
                Clear
              </button>
              <button onClick={saveSketch} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-semibold" data-testid="button-save-sketch">
                Save
              </button>
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1 overflow-hidden bg-white">
            <canvas
              ref={canvasRef}
              width={1200}
              height={1600}
              className="w-full h-full"
              style={{ touchAction: 'none', cursor: isEraser ? 'cell' : 'crosshair' }}
              onMouseDown={startSketch}
              onMouseMove={doSketch}
              onMouseUp={stopSketch}
              onMouseLeave={stopSketch}
              onTouchStart={startSketch}
              onTouchMove={doSketch}
              onTouchEnd={stopSketch}
              data-testid="canvas-sketch"
            />
          </div>

          <div className="bg-gray-900 border-t border-gray-700 p-2 text-center text-xs text-gray-500">
            Draw with finger · Pinch/zoom not available · Use eraser to correct
          </div>
        </div>
      )}
    </div>
  );
};

export default SlaveApp;
