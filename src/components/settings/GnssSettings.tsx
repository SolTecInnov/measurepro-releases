import React, { useState, useEffect } from 'react';
import { Satellite, Settings, Wifi, WifiOff, RefreshCw, AlertCircle, Activity, Compass, TestTube, Cloud, Laptop, Server, Globe, Shield, RotateCcw, Download, ChevronDown, ChevronUp, Monitor, Plug, CheckCircle2, Info, GraduationCap, Square } from 'lucide-react';
import { toast } from 'sonner';
import DuroLiveDataViewer from '@/components/gnss/DuroLiveDataViewer';
import { DuroCalibrationSettings } from '@/components/gnss/DuroCalibrationSettings';
import { GnssDiagnosticsPanel } from '@/components/gnss/diagnostics';
import { useSettingsStore } from '@/lib/settings';
import type { CrossSlopeMode } from '@/lib/roadProfile/types';
import { gnssSimulator } from '@/lib/demo/gnssSimulator';

// Backend URL storage key
const BACKEND_URL_KEY = 'measurepro_gnss_backend_url';

// Get stored backend URL or empty string for default (relative URLs)
const getStoredBackendUrl = (): string => {
  try {
    return localStorage.getItem(BACKEND_URL_KEY) || '';
  } catch {
    return '';
  }
};

// Build API URL - if backendUrl is set, use it, otherwise use relative URL
const buildApiUrl = (path: string, backendUrl: string): string => {
  if (backendUrl) {
    // Remove trailing slash from backendUrl and ensure path starts with /
    const base = backendUrl.replace(/\/$/, '');
    const apiPath = path.startsWith('/') ? path : `/${path}`;
    return `${base}${apiPath}`;
  }
  return path; // Relative URL
};

interface GnssConfig {
  enabled: boolean;
  host: string;
  dataPort: number;
  controlPort: number;
  mode: 'direct' | 'nmea';
  nmeaPort: number;
  serverMode: 'local' | 'cloud';
  imu: {
    enabled: boolean;
    rateHz: 10 | 25 | 50 | 100 | 200;
    fields: {
      attitude: boolean;
      angularRates: boolean;
      accel: boolean;
      parsePASHR: boolean;
    };
  };
  ntrip: {
    enabled: boolean;
    host?: string;
    port?: number;
    mountpoint?: string;
    username?: string;
  };
}

interface GnssStatus {
  connected: boolean;
  enabled: boolean;
  host: string;
  port: number;
  mode: string;
  serverMode: string;
  uptimeSec: number;
  samples: number;
  reconnectAttempts: number;
  warning?: string;
}

interface TestConnectionResult {
  success: boolean;
  host: string;
  port: number;
  status: string;
  latencyMs?: number;
  error?: string;
  suggestion?: string;
}

const DEFAULT_CONFIG: GnssConfig = {
  enabled: false,
  host: '192.168.0.222',
  dataPort: 55556,
  controlPort: 55555,
  mode: 'nmea',
  nmeaPort: 2101,
  serverMode: 'local',
  imu: {
    enabled: false,
    rateHz: 50,
    fields: {
      attitude: true,
      angularRates: false,
      accel: false,
      parsePASHR: true,
    },
  },
  ntrip: {
    enabled: false,
  },
};

const normalizeGnssConfig = (data: Partial<GnssConfig>): GnssConfig => ({
  ...DEFAULT_CONFIG,
  ...data,
  imu: {
    ...DEFAULT_CONFIG.imu,
    ...(data.imu ?? {}),
    fields: {
      ...DEFAULT_CONFIG.imu.fields,
      ...(data.imu?.fields ?? {}),
    },
  },
  ntrip: {
    ...DEFAULT_CONFIG.ntrip,
    ...(data.ntrip ?? {}),
  },
});

const GnssSettings: React.FC = () => {
  const [config, setConfig] = useState<GnssConfig>(DEFAULT_CONFIG);
  const [status, setStatus] = useState<GnssStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
  const [backendUrl, setBackendUrl] = useState<string>(getStoredBackendUrl());
  const [backendUrlInput, setBackendUrlInput] = useState<string>(getStoredBackendUrl());
  const [showGuide, setShowGuide] = useState(true);
  const [simActive, setSimActive] = useState(gnssSimulator.isActive);

  // Heavy haul safety settings (banking/cross-slope and curve radius)
  const { profileSettings, setProfileSettings } = useSettingsStore();

  // Update profile setting helper
  const updateProfileSetting = <K extends keyof typeof profileSettings>(
    key: K,
    value: typeof profileSettings[K]
  ) => {
    setProfileSettings({ ...profileSettings, [key]: value });
  };

  // Update banking threshold helper
  const updateBankingThreshold = (key: keyof typeof profileSettings.bankingThresholds, value: number) => {
    setProfileSettings({
      ...profileSettings,
      bankingThresholds: {
        ...profileSettings.bankingThresholds,
        [key]: value
      }
    });
  };

  // Keep simActive in sync with the singleton
  useEffect(() => {
    return gnssSimulator.subscribe(() => setSimActive(gnssSimulator.isActive));
  }, []);

  const toggleSimulation = () => {
    if (gnssSimulator.isActive) {
      gnssSimulator.stop();
      toast.info('GNSS training simulation stopped');
    } else {
      gnssSimulator.start();
      toast.success('GNSS training simulation started — simulating RTK data');
    }
    setSimActive(gnssSimulator.isActive);
  };

  // Save backend URL to localStorage
  const saveBackendUrl = (url: string) => {
    try {
      if (url) {
        localStorage.setItem(BACKEND_URL_KEY, url);
      } else {
        localStorage.removeItem(BACKEND_URL_KEY);
      }
      setBackendUrl(url);
      toast.success(url ? `Backend URL set to: ${url}` : 'Using default backend (current origin)');
    } catch (error) {
      toast.error('Failed to save backend URL');
    }
  };

  const fetchConfig = async () => {
    // Don't fetch if no backend URL is configured
    if (!backendUrl) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const url = buildApiUrl('/api/gnss/config', backendUrl);
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setConfig(normalizeGnssConfig(data));
      } else {
        const error = await response.json();
        console.error('Failed to fetch GNSS config:', error);
        toast.error(`Failed to load config: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      // Silently fail when backend is not available - this is expected
      // console.error('Failed to fetch GNSS config:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatus = async () => {
    // Don't poll if no backend URL is configured
    if (!backendUrl) {
      return;
    }
    try {
      const url = buildApiUrl('/api/gnss/status', backendUrl);
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      // Silently fail when backend is not available - this is expected
      // console.error('Failed to fetch GNSS status:', error);
    }
  };

  useEffect(() => {
    // Only fetch and poll when a backend URL is configured
    if (!backendUrl) {
      setStatus(null);
      return;
    }
    
    fetchConfig();
    fetchStatus();
    
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [backendUrl]); // Refetch when backend URL changes

  const handleSave = async () => {
    try {
      setSaving(true);
      const url = buildApiUrl('/api/gnss/config', backendUrl);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        const saved = await response.json();
        setConfig(normalizeGnssConfig(saved));
        toast.success('GNSS configuration saved');
        fetchStatus();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to save configuration');
      }
    } catch (error) {
      toast.error('Failed to save configuration');
      console.error('Save error:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReconnect = async () => {
    try {
      const url = buildApiUrl('/api/gnss/reconnect', backendUrl);
      const response = await fetch(url, { method: 'POST' });
      const data = await response.json();
      
      if (response.ok) {
        toast.success('Reconnecting to Duro...');
        setTimeout(fetchStatus, 2000);
      } else {
        toast.error(data.error || 'Failed to reconnect');
        if (data.details?.suggestion) {
          toast.info(data.details.suggestion);
        }
      }
    } catch (error) {
      toast.error('Failed to reconnect');
    }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      
      const activePort = config.mode === 'direct' ? config.dataPort : config.nmeaPort;
      const url = buildApiUrl('/api/gnss/test-connection', backendUrl);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: config.host, port: activePort }),
      });

      const result = await response.json();
      setTestResult(result);

      if (result.success) {
        toast.success(`Connection successful! (${result.latencyMs}ms)`);
      } else {
        toast.error(`Connection failed: ${result.error || result.status}`);
        if (result.suggestion) {
          toast.info(result.suggestion);
        }
      }
    } catch (error) {
      toast.error('Failed to test connection');
    } finally {
      setTesting(false);
    }
  };

  const formatUptime = (seconds?: number): string => {
    if (!seconds) return '--';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const getActivePort = () => {
    return config.mode === 'direct' ? config.dataPort : config.nmeaPort;
  };

  return (
    <div className="bg-gray-800 rounded-xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Satellite className="w-6 h-6 text-green-400" />
          GNSS / Duro Configuration
        </h2>
        <button
          onClick={fetchStatus}
          className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          title="Refresh Status"
          data-testid="button-refresh-status"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* ── Training / Simulation Mode ── */}
      <div className={`rounded-xl border p-5 transition-colors ${
        simActive
          ? 'bg-purple-900/30 border-purple-500/60'
          : 'bg-gray-900 border-gray-700'
      }`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${simActive ? 'bg-purple-500/20' : 'bg-gray-700'}`}>
              <GraduationCap className={`w-5 h-5 ${simActive ? 'text-purple-300' : 'text-gray-400'}`} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                Training Simulation Mode
                {simActive && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded-full text-xs font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                    Active
                  </span>
                )}
              </h3>
              <p className="text-sm text-gray-400 mt-0.5">
                Simulate a full RTK GNSS survey run — no hardware or antenna required.
                Ideal for classroom training and product demonstrations.
              </p>
            </div>
          </div>
          <button
            onClick={toggleSimulation}
            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              simActive
                ? 'bg-red-600/80 hover:bg-red-600 text-white'
                : 'bg-purple-600 hover:bg-purple-500 text-white'
            }`}
            data-testid="button-toggle-gnss-simulation"
          >
            {simActive ? (
              <><Square className="w-4 h-4" /> Stop</>
            ) : (
              <><GraduationCap className="w-4 h-4" /> Start Training</>
            )}
          </button>
        </div>

        {simActive && (
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            {[
              { label: 'Fix quality warm-up',  desc: 'GPS → DGPS → RTK Float → RTK Fixed over ~20 s' },
              { label: 'Right-hand curve',      desc: 'Progressive banking up to 4.3°' },
              { label: 'Hill climb (+7% grade)',desc: 'Altitude 12 m → 65 m' },
              { label: 'K-factor events',       desc: 'Concave (summit) + convex (descent start)' },
              { label: 'Left-hand curve',       desc: 'Negative banking down to −4°' },
              { label: 'IMU attitude data',     desc: 'Roll, pitch & heading with realistic noise' },
            ].map(item => (
              <div key={item.label} className="flex items-start gap-2 p-2 bg-purple-900/20 rounded-lg">
                <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium text-purple-200">{item.label}</span>
                  <span className="text-gray-400 block">{item.desc}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {!simActive && (
          <p className="mt-3 text-xs text-gray-500">
            When active: injects live Duro RTK data into the GNSS status card and road profiling pipeline.
            The real Duro connection is not affected — stop the simulation to return to hardware mode.
          </p>
        )}
      </div>

      {status?.warning && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-200">
            <p className="font-semibold">Cloud Mode Warning</p>
            <p className="text-yellow-300/80">{status.warning}</p>
          </div>
        </div>
      )}

      {/* ── Getting Started: Duro Bridge Guide ── */}
      <div className="bg-gray-900 border border-green-500/30 rounded-xl overflow-hidden">
        {/* Header — always visible, click to toggle */}
        <button
          onClick={() => setShowGuide(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-800/60 transition-colors text-left"
          data-testid="button-toggle-duro-guide"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Satellite className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-green-300">Getting Started — Duro Road Profiling</h3>
              <p className="text-xs text-gray-400 mt-0.5">How to install the bridge and connect your Duro receiver</p>
            </div>
          </div>
          {showGuide
            ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
            : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
        </button>

        {showGuide && (
          <div className="px-5 pb-5 space-y-5 border-t border-gray-700/60">

            {/* Important notice */}
            <div className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mt-4">
              <Info className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-200">
                <span className="font-semibold">You must start the MeasurePRO Bridge every time</span> you want to use road profiling with your Duro receiver — it does not run automatically in the background.
              </p>
            </div>

            {/* Download */}
            <div>
              <h4 className="text-sm font-semibold text-gray-200 mb-2 flex items-center gap-2">
                <Download className="w-4 h-4 text-blue-400" />
                Step 1 — Download the MeasurePRO Bridge
              </h4>
              <p className="text-xs text-gray-400 mb-3">
                The MeasurePRO Bridge is a small Windows application that connects your Duro GNSS receiver to this web app over your local network.
              </p>
              <a
                href="/downloads/MeasurePROBridge.exe"
                download="MeasurePROBridge.exe"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                data-testid="link-download-bridge"
              >
                <Download className="w-4 h-4" />
                Download MeasurePROBridge.exe
              </a>
              <p className="text-xs text-gray-500 mt-2">Windows 10 / 11 — no installation required, just run the .exe</p>
            </div>

            {/* Installation steps */}
            <div>
              <h4 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
                <Monitor className="w-4 h-4 text-purple-400" />
                Step 2 — First-time setup (Windows)
              </h4>
              <ol className="space-y-2">
                {[
                  'Save MeasurePROBridge.exe anywhere on your computer (Desktop recommended for easy access).',
                  'Double-click it to run. No installation needed — it runs directly.',
                  'If Windows Defender shows a SmartScreen warning, click "More info" then "Run anyway" — this is expected for unsigned apps.',
                  'When Windows Firewall asks for permission, click "Allow access" for both private and public networks.',
                  'A console window will open showing "✅ Bridge running on port 3001" — the bridge is ready.',
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-500/30 text-purple-300 text-xs flex items-center justify-center font-bold mt-0.5">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            {/* Connect every time */}
            <div>
              <h4 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
                <Plug className="w-4 h-4 text-orange-400" />
                Step 3 — Connect your Duro (every session)
              </h4>
              <ol className="space-y-2">
                {[
                  'Make sure your Duro receiver is powered on and connected to your computer or router via Ethernet cable.',
                  'Double-click the "MeasurePRO Bridge" shortcut on your Desktop to start the bridge application.',
                  'A small window will appear — wait for the status to show "Running on port 3001".',
                  'Open MeasurePRO in your browser and go to Settings → GNSS/Duro.',
                  'In the "Backend Server URL" box below, type: http://localhost:3001 — then click Apply.',
                  'Toggle on "Enable Duro TCP Connection" — the status will change to Connected (green) when everything is working.',
                  'You are now ready to start a survey and record road profile data.',
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-orange-500/30 text-orange-300 text-xs flex items-center justify-center font-bold mt-0.5">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            {/* Quick checklist */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                Quick checklist before each survey
              </h4>
              <ul className="space-y-1.5">
                {[
                  'Duro receiver is powered on and Ethernet cable is plugged in',
                  'MeasurePRO Bridge application is running (shows "Running on port 3001")',
                  'Backend Server URL is set to http://localhost:3001',
                  '"Enable Duro TCP Connection" is toggled on',
                  'Connection status shows Connected (green) below',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500/60 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Troubleshooting */}
            <div className="text-xs text-gray-500 space-y-1 border-t border-gray-700/60 pt-3">
              <p className="font-medium text-gray-400">Troubleshooting</p>
              <p>• Status stays Disconnected? Make sure the bridge window is open and try the Test Connection button below.</p>
              <p>• Firewall blocking? Open Windows Defender Firewall and allow "MeasurePROBridge" on port 3001.</p>
              <p>• Using a tablet on the same Wi-Fi? Enter your computer's local IP address instead of localhost, e.g. http://192.168.1.50:3001</p>
            </div>
          </div>
        )}
      </div>

      {/* Backend URL Configuration - for local hardware testing */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Server className="w-5 h-5 text-blue-400" />
          <h3 className="font-semibold text-blue-200">Backend Server URL</h3>
          <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">Local Testing</span>
        </div>
        <p className="text-sm text-blue-200/70 mb-3">
          To connect to hardware on your local network, run the backend locally and enter its URL below.
          Leave empty to use the default (current website origin).
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={backendUrlInput}
            onChange={(e) => setBackendUrlInput(e.target.value)}
            placeholder="e.g., http://localhost:3001 or http://192.168.0.100:3001"
            className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-gray-500"
            data-testid="input-backend-url"
          />
          <button
            onClick={() => saveBackendUrl(backendUrlInput)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
            data-testid="button-save-backend-url"
          >
            Apply
          </button>
          {backendUrl && (
            <button
              onClick={() => {
                setBackendUrlInput('');
                saveBackendUrl('');
              }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
              data-testid="button-reset-backend-url"
            >
              Reset
            </button>
          )}
        </div>
        {backendUrl && (
          <div className="mt-2 flex items-center gap-2 text-sm">
            <Globe className="w-4 h-4 text-green-400" />
            <span className="text-green-400">Active: </span>
            <span className="font-mono text-green-300">{backendUrl}</span>
          </div>
        )}
      </div>

      <div className="bg-gray-900 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            {status?.connected ? (
              <Wifi className="w-5 h-5 text-green-400" />
            ) : (
              <WifiOff className="w-5 h-5 text-red-400" />
            )}
            Duro Connection Status
          </h3>
          <div className={`px-3 py-1 rounded-full text-sm ${
            status?.connected 
              ? 'bg-green-500/20 text-green-400' 
              : 'bg-red-500/20 text-red-400'
          }`}>
            {status?.connected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
        
        {status && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Host:</span>
              <span className="ml-2 text-white font-mono">{status.host}</span>
            </div>
            <div>
              <span className="text-gray-400">Port:</span>
              <span className="ml-2 text-white font-mono">{status.port}</span>
            </div>
            <div>
              <span className="text-gray-400">Mode:</span>
              <span className="ml-2 text-white capitalize">{status.mode}</span>
            </div>
            <div>
              <span className="text-gray-400">Server:</span>
              <span className="ml-2 text-white capitalize">{status.serverMode}</span>
            </div>
            <div>
              <span className="text-gray-400">Uptime:</span>
              <span className="ml-2 text-white">{formatUptime(status.uptimeSec)}</span>
            </div>
            <div>
              <span className="text-gray-400">Samples:</span>
              <span className="ml-2 text-white">{status.samples || 0}</span>
            </div>
            {status.reconnectAttempts > 0 && (
              <div className="col-span-2">
                <span className="text-gray-400">Reconnect Attempts:</span>
                <span className="ml-2 text-yellow-400">{status.reconnectAttempts}</span>
              </div>
            )}
          </div>
        )}

        {status && !status.connected && config.enabled && (
          <button
            onClick={handleReconnect}
            className="mt-4 w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            data-testid="button-reconnect-duro"
          >
            Reconnect Now
          </button>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-400" />
          Duro Receiver Settings
        </h3>

        <div className="flex items-center justify-between p-4 bg-gray-900 rounded-lg">
          <div>
            <label className="text-white font-medium">Enable Duro TCP Connection</label>
            <p className="text-sm text-gray-400">Connect to Swift Navigation Duro receiver via Ethernet</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
              className="sr-only peer"
              data-testid="toggle-duro-enabled"
            />
            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-gray-900 rounded-lg">
            <label className="flex items-center gap-2 text-white font-medium mb-2">
              {config.serverMode === 'local' ? <Laptop className="w-4 h-4" /> : <Cloud className="w-4 h-4" />}
              Server Mode
            </label>
            <select
              value={config.serverMode}
              onChange={(e) => setConfig({ ...config, serverMode: e.target.value as 'local' | 'cloud' })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              data-testid="select-server-mode"
            >
              <option value="local">Local (LAN Access)</option>
              <option value="cloud">Cloud (Internet Only)</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">
              {config.serverMode === 'local' 
                ? 'Server can connect to local network devices' 
                : 'Server cannot reach private networks (192.168.x.x)'}
            </p>
          </div>

          <div className="p-4 bg-gray-900 rounded-lg">
            <label className="text-white font-medium mb-2 block">Connection Mode</label>
            <select
              value={config.mode}
              onChange={(e) => setConfig({ ...config, mode: e.target.value as 'direct' | 'nmea' })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              data-testid="select-connection-mode"
            >
              <option value="nmea">NMEA ASCII (Port 2101) - Recommended</option>
              <option value="direct">SBP Binary (Port 55556) - Not Supported</option>
            </select>
            <p className="text-xs mt-1">
              {config.mode === 'nmea' 
                ? <span className="text-green-400">GPS + IMU data via NMEA sentences (GGA, RMC, PASHR)</span>
                : <span className="text-red-400">Binary protocol - cannot be parsed, use NMEA instead</span>}
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            TCP Host / IP Address
          </label>
          <input
            type="text"
            value={config.host}
            onChange={(e) => setConfig({ ...config, host: e.target.value })}
            placeholder="192.168.0.222"
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
            data-testid="input-duro-host"
          />
          <p className="text-xs text-gray-400 mt-1">
            Default: 192.168.0.222 (Verify with network scan)
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Data Port (Direct Mode)
            </label>
            <input
              type="number"
              value={config.dataPort}
              onChange={(e) => setConfig({ ...config, dataPort: parseInt(e.target.value) || 55556 })}
              placeholder="55556"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
              data-testid="input-data-port"
            />
            <p className="text-xs text-gray-400 mt-1">Default: 55556</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              NMEA Port
            </label>
            <input
              type="number"
              value={config.nmeaPort}
              onChange={(e) => setConfig({ ...config, nmeaPort: parseInt(e.target.value) || 2101 })}
              placeholder="2101"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
              data-testid="input-nmea-port"
            />
            <p className="text-xs text-gray-400 mt-1">Default: 2101 (if enabled)</p>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center justify-center gap-2"
            data-testid="button-test-connection"
          >
            <TestTube className="w-4 h-4" />
            {testing ? 'Testing...' : `Test Connection (${config.host}:${getActivePort()})`}
          </button>
        </div>

        {testResult && (
          <div className={`p-4 rounded-lg ${testResult.success ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
            <div className="flex items-center gap-2 mb-2">
              {testResult.success ? (
                <Wifi className="w-5 h-5 text-green-400" />
              ) : (
                <WifiOff className="w-5 h-5 text-red-400" />
              )}
              <span className={`font-medium ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                {testResult.success ? 'Port Open' : 'Connection Failed'}
              </span>
            </div>
            <div className="text-sm text-gray-300">
              <p>Host: {testResult.host}:{testResult.port}</p>
              {testResult.latencyMs && <p>Latency: {testResult.latencyMs}ms</p>}
              {testResult.error && <p>Error: {testResult.error}</p>}
              {testResult.suggestion && <p className="text-yellow-400 mt-1">{testResult.suggestion}</p>}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Compass className="w-5 h-5 text-cyan-400" />
          IMU / INS Settings (Duro Inertial)
        </h3>
        <p className="text-sm text-gray-400">
          Configure inertial measurement unit data capture for attitude and motion sensing.
          Requires Swift Duro Inertial (GNSS/INS receiver).
        </p>

        <div className="flex items-center justify-between p-4 bg-gray-900 rounded-lg">
          <div>
            <label className="text-white font-medium">Enable IMU Data Capture</label>
            <p className="text-sm text-gray-400">Capture attitude, angular rates, and accelerations</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.imu.enabled}
              onChange={(e) => setConfig({ 
                ...config, 
                imu: { ...config.imu, enabled: e.target.checked }
              })}
              className="sr-only peer"
              data-testid="toggle-imu-enabled"
            />
            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
          </label>
        </div>

        {config.imu.enabled && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                IMU Output Rate (Hz)
              </label>
              <select
                value={config.imu.rateHz}
                onChange={(e) => setConfig({ 
                  ...config, 
                  imu: { ...config.imu, rateHz: parseInt(e.target.value) as any }
                })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500"
                data-testid="select-imu-rate"
              >
                <option value={10}>10 Hz (Low - power saving)</option>
                <option value={25}>25 Hz (Medium)</option>
                <option value={50}>50 Hz (Default - recommended)</option>
                <option value={100}>100 Hz (High - more data)</option>
                <option value={200}>200 Hz (Maximum - INS mode)</option>
              </select>
            </div>

            <div className="bg-gray-900 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                Data Capture Options
              </h4>
              
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-white text-sm">Attitude (Roll, Pitch, Yaw)</label>
                  <p className="text-xs text-gray-400">Vehicle orientation angles in degrees</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.imu.fields.attitude}
                    onChange={(e) => setConfig({ 
                      ...config, 
                      imu: { 
                        ...config.imu, 
                        fields: { ...config.imu.fields, attitude: e.target.checked }
                      }
                    })}
                    className="sr-only peer"
                    data-testid="toggle-capture-attitude"
                  />
                  <div className="w-9 h-5 bg-gray-700 peer-checked:bg-cyan-600 rounded-full peer after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-white text-sm">Angular Rates</label>
                  <p className="text-xs text-gray-400">Rotation rates in degrees/second</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.imu.fields.angularRates}
                    onChange={(e) => setConfig({ 
                      ...config, 
                      imu: { 
                        ...config.imu, 
                        fields: { ...config.imu.fields, angularRates: e.target.checked }
                      }
                    })}
                    className="sr-only peer"
                    data-testid="toggle-capture-angular-rates"
                  />
                  <div className="w-9 h-5 bg-gray-700 peer-checked:bg-cyan-600 rounded-full peer after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-white text-sm">Linear Acceleration</label>
                  <p className="text-xs text-gray-400">Accelerations in m/s² (includes gravity)</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.imu.fields.accel}
                    onChange={(e) => setConfig({ 
                      ...config, 
                      imu: { 
                        ...config.imu, 
                        fields: { ...config.imu.fields, accel: e.target.checked }
                      }
                    })}
                    className="sr-only peer"
                    data-testid="toggle-capture-acceleration"
                  />
                  <div className="w-9 h-5 bg-gray-700 peer-checked:bg-cyan-600 rounded-full peer after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-900 rounded-lg">
              <div>
                <label className="text-white font-medium">Parse PASHR Sentences</label>
                <p className="text-sm text-gray-400">Extract attitude data from proprietary NMEA sentences</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.imu.fields.parsePASHR}
                  onChange={(e) => setConfig({ 
                    ...config, 
                    imu: { 
                      ...config.imu, 
                      fields: { ...config.imu.fields, parsePASHR: e.target.checked }
                    }
                  })}
                  className="sr-only peer"
                  data-testid="toggle-pashr-enabled"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-cyan-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
              </label>
            </div>
          </>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Satellite className="w-5 h-5 text-purple-400" />
          NTRIP Correction Settings
        </h3>

        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-200">
            <p className="font-semibold">Coming Soon</p>
            <p className="text-yellow-300/80">
              NTRIP client for RTK/PPP corrections will be available in a future update. 
              Currently storing raw observations for post-processing.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-900 rounded-lg opacity-50 cursor-not-allowed">
          <div>
            <label className="text-white font-medium">Enable NTRIP Client</label>
            <p className="text-sm text-gray-400">Connect to NTRIP caster for RTK corrections</p>
          </div>
          <label className="relative inline-flex items-center cursor-not-allowed">
            <input
              type="checkbox"
              checked={config.ntrip.enabled}
              disabled
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-700 rounded-full peer peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>

      {/* Heavy Haul Safety Settings */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Shield className="w-5 h-5 text-orange-400" />
          Heavy Haul Safety Settings
        </h3>
        <p className="text-sm text-gray-400">
          Configure banking/cross-slope detection and curve radius alerts for trailer tip-over prevention.
        </p>

        {/* Cross-slope Detection Mode */}
        <div className="bg-gray-900 rounded-lg p-4 space-y-3">
          <label className="text-white font-medium">Cross-Slope Detection Mode</label>
          <p className="text-sm text-gray-400">
            Choose how to capture road cross-slope from IMU roll data
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'raw', label: 'Raw Roll', desc: 'Use raw IMU roll data' },
              { value: 'filtered', label: 'Filtered', desc: 'Apply low-pass filter to separate road banking from body roll' },
              { value: 'stopped', label: 'Stopped Only', desc: 'Only record when vehicle is stopped (most accurate)' }
            ].map((mode) => (
              <button
                key={mode.value}
                onClick={() => updateProfileSetting('crossSlopeMode', mode.value as CrossSlopeMode)}
                className={`p-3 rounded-lg border-2 transition-all ${
                  profileSettings.crossSlopeMode === mode.value
                    ? 'border-orange-500 bg-orange-500/20'
                    : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                }`}
                data-testid={`button-cross-slope-mode-${mode.value}`}
              >
                <div className="text-sm font-medium text-white">{mode.label}</div>
                <div className="text-xs text-gray-400 mt-1">{mode.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Banking Thresholds */}
        <div className="bg-gray-900 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-white font-medium">Banking Alert Thresholds</label>
              <p className="text-sm text-gray-400">Set cross-slope thresholds for tip-over risk classification (degrees)</p>
            </div>
            <button
              onClick={() => setProfileSettings({
                ...profileSettings,
                bankingThresholds: { normalMax: 3, cautionMax: 5, warningMax: 7, criticalMax: 10 }
              })}
              className="flex items-center gap-1 px-3 py-1 text-sm text-gray-400 hover:text-white bg-gray-800 rounded-lg transition-colors"
              data-testid="button-reset-banking-thresholds"
            >
              <RotateCcw className="w-4 h-4" />
              Reset to Defaults
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-400">Normal Max (green)</label>
              <input
                type="number"
                min="0"
                max="10"
                step="0.5"
                value={profileSettings.bankingThresholds?.normalMax ?? 3}
                onChange={(e) => updateBankingThreshold('normalMax', parseFloat(e.target.value))}
                className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-orange-500"
                data-testid="input-banking-normal-max"
              />
              <p className="text-xs text-green-400 mt-1">0-{profileSettings.bankingThresholds?.normalMax ?? 3}° = Safe</p>
            </div>
            <div>
              <label className="text-sm text-gray-400">Caution Max (blue)</label>
              <input
                type="number"
                min="0"
                max="15"
                step="0.5"
                value={profileSettings.bankingThresholds?.cautionMax ?? 5}
                onChange={(e) => updateBankingThreshold('cautionMax', parseFloat(e.target.value))}
                className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-orange-500"
                data-testid="input-banking-caution-max"
              />
              <p className="text-xs text-blue-400 mt-1">{profileSettings.bankingThresholds?.normalMax ?? 3}-{profileSettings.bankingThresholds?.cautionMax ?? 5}° = Monitor</p>
            </div>
            <div>
              <label className="text-sm text-gray-400">Warning Max (yellow)</label>
              <input
                type="number"
                min="0"
                max="20"
                step="0.5"
                value={profileSettings.bankingThresholds?.warningMax ?? 7}
                onChange={(e) => updateBankingThreshold('warningMax', parseFloat(e.target.value))}
                className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-orange-500"
                data-testid="input-banking-warning-max"
              />
              <p className="text-xs text-yellow-400 mt-1">{profileSettings.bankingThresholds?.cautionMax ?? 5}-{profileSettings.bankingThresholds?.warningMax ?? 7}° = Yellow Zone</p>
            </div>
            <div>
              <label className="text-sm text-gray-400">Critical Max (red)</label>
              <input
                type="number"
                min="0"
                max="25"
                step="0.5"
                value={profileSettings.bankingThresholds?.criticalMax ?? 10}
                onChange={(e) => updateBankingThreshold('criticalMax', parseFloat(e.target.value))}
                className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-orange-500"
                data-testid="input-banking-critical-max"
              />
              <p className="text-xs text-red-400 mt-1">{profileSettings.bankingThresholds?.warningMax ?? 7}-{profileSettings.bankingThresholds?.criticalMax ?? 10}° = Red Zone, &gt;{profileSettings.bankingThresholds?.criticalMax ?? 10}° = Unacceptable</p>
            </div>
          </div>
        </div>

        {/* Curve Radius Settings */}
        <div className="bg-gray-900 rounded-lg p-4 space-y-4">
          <label className="text-white font-medium">Curve Radius Alerts</label>
          <p className="text-sm text-gray-400">
            Set minimum safe curve radius for your vehicle configuration
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-400">Minimum Safe Radius (m)</label>
              <input
                type="number"
                min="5"
                max="100"
                step="1"
                value={profileSettings.minimumCurveRadius_m ?? 15}
                onChange={(e) => updateProfileSetting('minimumCurveRadius_m', parseFloat(e.target.value))}
                className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-orange-500"
                data-testid="input-minimum-curve-radius"
              />
              <p className="text-xs text-gray-400 mt-1">Alert when curve radius is below this value</p>
            </div>
            <div>
              <label className="text-sm text-gray-400">Curve Detection Threshold (m)</label>
              <input
                type="number"
                min="50"
                max="2000"
                step="50"
                value={profileSettings.curveDetectionThreshold_m ?? 500}
                onChange={(e) => updateProfileSetting('curveDetectionThreshold_m', parseFloat(e.target.value))}
                className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-orange-500"
                data-testid="input-curve-detection-threshold"
              />
              <p className="text-xs text-gray-400 mt-1">Radius below which is classified as a "curve"</p>
            </div>
          </div>
        </div>

        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-orange-200">
            <p className="font-semibold">Heavy Haul Safety Note</p>
            <p className="text-orange-300/80">
              Banking and curve radius data is captured during GNSS profile recording and exported with survey data.
              Alerts are generated in post-analysis exports - not real-time warnings.
            </p>
          </div>
        </div>
      </div>

      {/* GNSS Diagnostics & Calibration Suite */}
      <GnssDiagnosticsPanel />

      {/* Live Data Viewer */}
      <DuroLiveDataViewer />

      {/* Duro Calibration & Mounting Settings */}
      <DuroCalibrationSettings />

      <div className="flex gap-4">
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
          data-testid="button-save-gnss-config"
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
        <button
          onClick={fetchConfig}
          disabled={loading}
          className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          data-testid="button-reset-gnss-config"
        >
          Reset
        </button>
      </div>
    </div>
  );
};

export default GnssSettings;
