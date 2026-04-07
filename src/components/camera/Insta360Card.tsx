/**
 * Insta360 X5 Card
 * 100% native — no bridge, no external process
 * Controls the camera via OSC API over USB-C virtual network
 */
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Camera, Video, VideoOff, CircleDot, Circle,
  Battery, HardDrive, Wifi, WifiOff, Eye, AlertTriangle,
  RefreshCw, Aperture
} from 'lucide-react';

interface CameraInfo {
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  firmwareVersion?: string;
  [key: string]: any;
}

interface CameraState {
  state?: {
    batteryLevel?: number;
    storageUri?: string;
    _recordingTime?: number;
    _captureStatus?: 'idle' | 'recording' | 'capturing';
    [key: string]: any;
  };
  [key: string]: any;
}

export function Insta360Card() {
  const api = (window as any).electronAPI?.insta360;
  const isElectron = !!(window as any).electronAPI?.isElectron;

  const [connected, setConnected] = useState(false);
  const [info, setInfo] = useState<CameraInfo | null>(null);
  const [cameraState, setCameraState] = useState<CameraState | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [showLensPreview, setShowLensPreview] = useState(false);
  const [lensPreviewUrl, setLensPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Parse battery level (OSC returns 0.0 to 1.0 or percentage)
  const batteryPct = cameraState?.state?.batteryLevel !== undefined
    ? Math.round(cameraState.state.batteryLevel * 100)
    : null;

  // Parse storage (bytes remaining)
  const storageGB = cameraState?.state?.remainingSpace !== undefined
    ? (cameraState.state.remainingSpace / 1024 / 1024 / 1024).toFixed(1)
    : null;

  const captureStatus = cameraState?.state?._captureStatus || 'idle';

  useEffect(() => {
    if (!api || !isElectron) return;

    // Listen for connection events
    api.onConnection(({ connected: c }: { connected: boolean }) => {
      setConnected(c);
      if (!c) {
        setInfo(null);
        setCameraState(null);
        setIsRecording(false);
      }
    });

    // Listen for status updates
    api.onStatus(({ info: i, state: s }: any) => {
      if (i) setInfo(i);
      if (s) {
        setCameraState(s);
        setIsRecording(s?.state?._captureStatus === 'recording');
      }
    });

    // Get initial status
    api.getStatus().then((result: any) => {
      setConnected(result.connected);
      if (result.info) setInfo(result.info);
      if (result.state) {
        setCameraState(result.state);
        setIsRecording(result.state?.state?._captureStatus === 'recording');
      }
    });

    return () => api.removeListeners?.();
  }, []);

  const handleStartRecording = async () => {
    if (!api || loading) return;
    setLoading(true);
    try {
      const result = await api.startRecording();
      if (result.ok) {
        setIsRecording(true);
        // toast suppressed
      } else {
        toast.error('Failed to start recording', { description: result.error });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStopRecording = async () => {
    if (!api || loading) return;
    setLoading(true);
    try {
      const result = await api.stopRecording();
      if (result.ok) {
        setIsRecording(false);
        // toast suppressed
      } else {
        toast.error('Failed to stop recording', { description: result.error });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTakePhoto = async () => {
    if (!api || loading) return;
    setIsCapturing(true);
    try {
      const result = await api.takePhoto();
      if (result.ok) {
        // toast suppressed
      } else {
        toast.error('Failed to capture photo', { description: result.error });
      }
    } finally {
      setTimeout(() => setIsCapturing(false), 1000);
    }
  };

  const handleLensCheck = async () => {
    if (!api) return;
    if (showLensPreview) {
      setShowLensPreview(false);
      setLensPreviewUrl(null);
      return;
    }
    const { url } = await api.getLivePreviewUrl();
    setLensPreviewUrl(url);
    setShowLensPreview(true);
  };

  const handleRefresh = async () => {
    if (!api) return;
    const result = await api.getStatus();
    setConnected(result.connected);
    if (result.info) setInfo(result.info);
    if (result.state) setCameraState(result.state);
  };

  // Not in Electron
  if (!isElectron) return null;

  // Custom IP state
  const [customIp, setCustomIp] = React.useState(() => 
    localStorage.getItem('insta360_custom_ip') || '192.168.42.1'
  );
  const [showIpEdit, setShowIpEdit] = React.useState(false);

  const applyCustomIp = async () => {
    localStorage.setItem('insta360_custom_ip', customIp);
    await (api as any)?.setCustomIp?.(customIp);
    setTimeout(() => handleRefresh(), 500);
    setShowIpEdit(false);
  };

  // Disconnected state
  if (!connected) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Aperture className="w-4 h-4 text-gray-500" />
            <span className="text-gray-400 text-sm font-medium">Insta360 X5</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-red-400 text-xs">Not detected</span>
            <button onClick={handleRefresh} className="text-gray-500 hover:text-gray-300 text-xs px-2 py-0.5 bg-gray-700 rounded">
              ↺ Retry
            </button>
          </div>
        </div>

        {/* Connection instructions */}
        <div className="space-y-2 mb-3">
          <p className="text-gray-400 text-xs font-medium">Connection options:</p>
          <div className="text-gray-500 text-xs space-y-1">
            <div className="flex items-start gap-1.5">
              <span className="text-blue-400 mt-0.5">①</span>
              <span>USB-C directly → camera at <span className="font-mono text-green-400">192.168.42.1</span></span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="text-blue-400 mt-0.5">②</span>
              <span>USB-A adapter → may use different IP. Run <span className="font-mono text-yellow-300">ping 192.168.42.1</span> in CMD to check</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="text-blue-400 mt-0.5">③</span>
              <span>Camera must be in <strong className="text-white">USB Connect</strong> mode (not Charging Only)</span>
            </div>
          </div>
        </div>

        {/* Custom IP */}
        <div>
          <button onClick={() => setShowIpEdit(v => !v)} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
            ⚙ Custom camera IP (current: {customIp})
          </button>
          {showIpEdit && (
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={customIp}
                onChange={e => setCustomIp(e.target.value)}
                placeholder="192.168.42.1"
                className="flex-1 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs font-mono text-white focus:outline-none focus:border-blue-500"
              />
              <button onClick={applyCustomIp} className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 rounded">
                Apply
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Connected state
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Aperture className="w-4 h-4 text-blue-400" />
          <span className="text-white text-sm font-medium">
            {info?.model || 'Insta360 X5'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Battery */}
          {batteryPct !== null && (
            <div className="flex items-center gap-1">
              <Battery className={`w-3.5 h-3.5 ${
                batteryPct > 50 ? 'text-green-400' :
                batteryPct > 20 ? 'text-yellow-400' : 'text-red-400'
              }`} />
              <span className={`text-xs ${
                batteryPct > 50 ? 'text-green-400' :
                batteryPct > 20 ? 'text-yellow-400' : 'text-red-400'
              }`}>{batteryPct}%</span>
            </div>
          )}
          {/* Storage */}
          {storageGB !== null && (
            <div className="flex items-center gap-1">
              <HardDrive className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-gray-400 text-xs">{storageGB}GB</span>
            </div>
          )}
          {/* Connected dot */}
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
            <span className="text-xs text-gray-400">
              {isRecording ? 'REC' : 'Ready'}
            </span>
          </div>
          <button onClick={handleRefresh} className="text-gray-500 hover:text-gray-300 p-0.5">
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="p-4 space-y-3">
        {/* Record / Stop */}
        <div className="flex gap-2">
          {!isRecording ? (
            <button
              onClick={handleStartRecording}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              <CircleDot className="w-4 h-4" />
              Start Recording
            </button>
          ) : (
            <button
              onClick={handleStopRecording}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-500 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              <div className="w-3.5 h-3.5 bg-white rounded-sm" />
              Stop Recording
            </button>
          )}

          {/* Take Photo */}
          <button
            onClick={handleTakePhoto}
            disabled={loading || isRecording || isCapturing}
            className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-3 py-2.5 rounded-lg text-sm transition-colors"
            title="Take photo"
          >
            <Camera className={`w-4 h-4 ${isCapturing ? 'animate-ping' : ''}`} />
          </button>
        </div>

        {/* Lens Check */}
        <button
          onClick={handleLensCheck}
          className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm transition-colors border ${
            showLensPreview
              ? 'border-blue-500 bg-blue-600/20 text-blue-300'
              : 'border-gray-600 bg-gray-700/50 text-gray-300 hover:bg-gray-700'
          }`}
        >
          <Eye className="w-4 h-4" />
          {showLensPreview ? 'Close Lens Check' : 'Check Lenses'}
        </button>

        {/* Lens Preview */}
        {showLensPreview && lensPreviewUrl && (
          <div className="rounded-lg overflow-hidden border border-gray-600">
            <div className="bg-gray-900 px-3 py-1.5 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-yellow-300 text-xs">Check lenses are clean and unobstructed</span>
            </div>
            <img
              src={lensPreviewUrl}
              alt="Lens preview"
              className="w-full"
              onError={() => {
                toast.error('Preview unavailable', { description: 'Make sure camera is ready and not recording' });
                setShowLensPreview(false);
              }}
            />
          </div>
        )}

        {/* Status info */}
        {info?.firmwareVersion && (
          <p className="text-gray-600 text-xs text-center">
            FW {info.firmwareVersion}
          </p>
        )}
      </div>
    </div>
  );
}
