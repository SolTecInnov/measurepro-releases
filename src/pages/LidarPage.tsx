/**
 * LiDAR Page
 * Main page for MeasurePRO 3D LiDAR integration - Pandar40P scanning system
 */

import { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '@/lib/config/environment';
import { getCurrentUser } from '@/lib/firebase';
import { useSettingsStore } from '@/lib/settings';
import { auditLog } from '@/lib/auditLog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Wifi, 
  WifiOff, 
  Play, 
  Square, 
  Download, 
  Settings, 
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  Activity,
  Database,
  MapPin,
  Clock,
  Ruler,
  FileArchive,
  ExternalLink,
  Info,
  BookOpen
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useLocation } from 'wouter';
import { useLidarService } from '@/hooks/useLidarService';
import type { CaptureInfo } from '@/lib/lidar/types';
import { setLidarServiceConfig, listCaptures, getCapture } from '@/lib/lidar/api';
import { ClearanceHUD } from '@/components/lidar/ClearanceHUD';
import { Eye } from 'lucide-react';

import DryRunSettings from '@/components/dryRun/DryRunSettings';
import { useDryRunDetection } from '@/hooks/useDryRunDetection';

type TabValue = 'dashboard' | 'captures' | 'settings' | 'liveview';

export default function LidarPage() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<TabValue>('dashboard');

  useEffect(() => {
    try { const u = getCurrentUser(); if (u) auditLog.featureAccess(u.uid, u.email || '', 'LiDAR System'); } catch (_e) {}
  }, []);
  const [showGuide, setShowGuide] = useState(false);
  const [servicePort, setServicePort] = useState('17777');
  const [staticDuration, setStaticDuration] = useState(15);
  const [segmentDuration, setSegmentDuration] = useState(60);
  const [captures, setCaptures] = useState<CaptureInfo[]>([]);
  const [linkedPoiId, _setLinkedPoiId] = useState<string | null>(null);
  const [mockModeEnabled, setMockModeEnabled] = useState(() => {
    return useSettingsStore.getState().uiSettings.lidarMockMode;
  });
  
  const {
    isConnected,
    isServiceAvailable,
    status,
    metrics,
    alerts,
    activeCapture,
    visualization,
    error,
    connect,
    disconnect,
    startStaticScan,
    startSegment,
    stopCapture,
    exportCapture,
  } = useLidarService();

  const { isEnabled: isDryRunEnabled, recentEvents: dryRunEvents } = useDryRunDetection({
    visualization,
    isConnected,
  });
  
  
  const prevActiveCaptureRef = useRef<string | null>(null);
  
  useEffect(() => {
    const prevId = prevActiveCaptureRef.current;
    if (prevId && !activeCapture) {
      /* toast removed */
      getCapture(prevId)
        .then((completed) => {
          setCaptures((prev) => {
            if (prev.some(c => c.id === completed.id)) return prev;
            return [completed, ...prev];
          });
        })
        .catch(() => {
          listCaptures().then(setCaptures).catch(() => {});
        });
    }
    prevActiveCaptureRef.current = activeCapture?.id ?? null;
  }, [activeCapture]);
  
  useEffect(() => {
    const savedPort = useSettingsStore.getState().uiSettings.lidarServicePort;
    if (savedPort) {
      setServicePort(savedPort);
      setLidarServiceConfig({
        baseUrl: `http://127.0.0.1:${savedPort}`,
        wsUrl: `ws://127.0.0.1:${savedPort}/ws`,
      });
    }
  }, []);
  
  useEffect(() => {
    if (isConnected) {
      listCaptures().then(setCaptures).catch(() => {});
    }
  }, [isConnected]);
  
  const handleConnect = () => {
    useSettingsStore.getState().setUISettings({ lidarServicePort: servicePort });
    setLidarServiceConfig({
      baseUrl: `http://127.0.0.1:${servicePort}`,
      wsUrl: `ws://127.0.0.1:${servicePort}/ws`,
    });
    connect();
  };
  
  const handleStartStaticScan = async () => {
    try {
      await startStaticScan(staticDuration, linkedPoiId ?? undefined);
      /* toast removed */
    } catch (e) {
      toast.error(`Failed to start scan: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };
  
  const handleStartSegment = async () => {
    try {
      await startSegment(segmentDuration, linkedPoiId ?? undefined);
      /* toast removed */
    } catch (e) {
      toast.error(`Failed to start segment: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };
  
  const handleStopCapture = async () => {
    const result = await stopCapture();
    if (result) {
      setCaptures((prev) => [result, ...prev]);
      /* toast removed */
    }
  };
  
  const handleExport = async (captureId: string) => {
    const path = await exportCapture(captureId, 'laz');
    if (path) {
      /* toast removed */
      setCaptures((prev) =>
        prev.map((c) => (c.id === captureId ? { ...c, exportPath: path } : c))
      );
    } else {
      toast.error('Export failed');
    }
  };
  
  const showClearanceHUD = activeTab === 'liveview' && isConnected;

  return (
    <>
    {showClearanceHUD && (
      <div className="fixed inset-0 z-50 overflow-auto" data-testid="clearance-hud-overlay">
        <ClearanceHUD
          metrics={metrics}
          alerts={alerts}
          status={status}
          isConnected={isConnected}
          startStaticScan={startStaticScan}
        />
        <button
          data-testid="btn-exit-hud"
          onClick={() => setActiveTab('dashboard')}
          className="fixed top-4 right-4 z-10 px-3 py-1.5 text-xs rounded-lg bg-gray-800/80 text-gray-300 hover:bg-gray-700 border border-gray-600 backdrop-blur"
        >
          ✕ Exit HUD
        </button>
      </div>
    )}
    <div className="min-h-screen bg-gray-900 text-white p-4" data-testid="lidar-page">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation('/')}
              data-testid="btn-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">3D LiDAR Scanner</h1>
            <Badge variant={isConnected ? 'default' : 'secondary'} data-testid="badge-connection">
              {isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-purple-400 border-purple-700 hover:bg-purple-900/30"
              onClick={() => setShowGuide(true)}
              data-testid="btn-pandar-guide"
            >
              <BookOpen className="h-4 w-4 mr-1" />
              Connection Guide
            </Button>
            <Button
              variant={activeTab === 'dashboard' ? 'default' : 'outline'}
              onClick={() => setActiveTab('dashboard')}
              data-testid="tab-dashboard"
            >
              Dashboard
            </Button>
            <Button
              variant={activeTab === 'liveview' ? 'default' : 'outline'}
              onClick={() => setActiveTab('liveview')}
              data-testid="tab-liveview"
              className={activeTab === 'liveview' ? 'bg-orange-600 hover:bg-orange-700' : ''}
            >
              <Eye className="h-4 w-4 mr-1" />
              Live View
            </Button>
            <Button
              variant={activeTab === 'captures' ? 'default' : 'outline'}
              onClick={() => setActiveTab('captures')}
              data-testid="tab-captures"
            >
              Captures
            </Button>
            <Button
              variant={activeTab === 'settings' ? 'default' : 'outline'}
              onClick={() => setActiveTab('settings')}
              data-testid="tab-settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="bg-gray-800 border-gray-700" data-testid="card-connection">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  {isConnected ? <Wifi className="h-5 w-5 text-green-500" /> : <WifiOff className="h-5 w-5 text-red-500" />}
                  Connection Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isConnected ? (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        value={servicePort}
                        onChange={(e) => setServicePort(e.target.value)}
                        placeholder="Port"
                        className="w-24 bg-gray-700 border-gray-600"
                        data-testid="input-port"
                      />
                      <Button onClick={handleConnect} data-testid="btn-connect">
                        Connect
                      </Button>
                    </div>
                    {error && <p className="text-red-400 text-sm">{error}</p>}
                    <p className="text-gray-400 text-sm">
                      Start the LiDAR service on Windows first
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Packets/sec</span>
                      <span className="font-mono text-green-400" data-testid="text-packets">
                        {status?.packetsPerSec ?? 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Time Sync</span>
                      {status?.timeSyncOk ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-yellow-500" />
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Dropped</span>
                      <span className="font-mono" data-testid="text-dropped">
                        {status?.droppedPackets ?? 0}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={disconnect}
                      className="w-full"
                      data-testid="btn-disconnect"
                    >
                      Disconnect
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card className="bg-gray-800 border-gray-700" data-testid="card-metrics">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Ruler className="h-5 w-5" />
                  Road Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                {metrics ? (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Road Width</span>
                      <span className="font-mono text-xl text-green-400" data-testid="text-road-width">
                        {metrics.roadWidthNow.toFixed(1)}m
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Min (100m)</span>
                      <span className="font-mono">
                        {metrics.minRoadWidthLast100m.toFixed(1)}m
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Confidence</span>
                      <Progress
                        value={metrics.confidence * 100}
                        className="w-20 h-2"
                      />
                    </div>
                    <div className="pt-2 border-t border-gray-700">
                      <p className="text-gray-400 text-sm mb-2">Clearance at Heights</p>
                      {metrics.usableWidthAtHeights.map((h) => (
                        <div key={h.heightM} className="flex justify-between text-sm">
                          <span>{h.heightM.toFixed(1)}m</span>
                          <span className={h.widthM < 6 ? 'text-yellow-400' : 'text-green-400'}>
                            {h.widthM === Infinity || h.widthM > 100 ? '∞' : `${h.widthM.toFixed(1)}m`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">
                    Connect to view metrics
                  </p>
                )}
              </CardContent>
            </Card>
            
            <Card className="bg-gray-800 border-gray-700" data-testid="card-capture">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Database className="h-5 w-5" />
                  Capture Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {activeCapture ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-red-500 animate-pulse" />
                      <span className="text-red-400">Recording...</span>
                    </div>
                    <div className="text-sm text-gray-400">
                      Type: {activeCapture.type}
                    </div>
                    <div className="text-sm text-gray-400">
                      Points: {activeCapture.pointCount.toLocaleString()}
                    </div>
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={handleStopCapture}
                      data-testid="btn-stop-capture"
                    >
                      <Square className="h-4 w-4 mr-2" />
                      Stop Capture
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-gray-400 block mb-1">
                        Static Scan Duration (s)
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          value={staticDuration}
                          onChange={(e) => setStaticDuration(Number(e.target.value))}
                          className="bg-gray-700 border-gray-600"
                          min={5}
                          max={60}
                          data-testid="input-static-duration"
                        />
                        <Button
                          onClick={handleStartStaticScan}
                          disabled={!isConnected}
                          data-testid="btn-static-scan"
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Scan
                        </Button>
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-sm text-gray-400 block mb-1">
                        Segment Capture Duration (s)
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          value={segmentDuration}
                          onChange={(e) => setSegmentDuration(Number(e.target.value))}
                          className="bg-gray-700 border-gray-600"
                          min={10}
                          max={300}
                          data-testid="input-segment-duration"
                        />
                        <Button
                          onClick={handleStartSegment}
                          disabled={!isConnected}
                          variant="secondary"
                          data-testid="btn-segment-capture"
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Segment
                        </Button>
                      </div>
                    </div>
                    
                    {linkedPoiId && (
                      <div className="flex items-center gap-2 p-2 bg-gray-700 rounded text-sm">
                        <MapPin className="h-4 w-4 text-blue-400" />
                        <span>Will link to POI: {linkedPoiId.substring(0, 8)}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
            
            {alerts.length > 0 && (
              <Card className="bg-gray-800 border-gray-700 lg:col-span-3" data-testid="card-alerts">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    Active Alerts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {alerts.map((alert, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded flex items-center gap-3 ${
                          alert.severity === 'critical'
                            ? 'bg-red-900/50 border border-red-700'
                            : 'bg-yellow-900/50 border border-yellow-700'
                        }`}
                      >
                        <AlertTriangle
                          className={`h-5 w-5 ${
                            alert.severity === 'critical' ? 'text-red-500' : 'text-yellow-500'
                          }`}
                        />
                        <span>{alert.message}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {isDryRunEnabled && (
              <Card className="bg-gray-800 border-gray-700 lg:col-span-3" data-testid="card-dry-run-status">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    Dry Run Detection
                    <span className="ml-auto text-sm font-normal text-green-400">Active</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dryRunEvents.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">
                      No detections yet. Monitoring for obstacles...
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {dryRunEvents.slice(0, 10).map((event) => (
                        <div
                          key={event.id}
                          className={`p-2 rounded flex items-center justify-between text-sm ${
                            event.side === 'rear' 
                              ? 'bg-red-900/50 border border-red-700' 
                              : event.side === 'right'
                              ? 'bg-orange-900/50 border border-orange-700'
                              : 'bg-yellow-900/50 border border-yellow-700'
                          }`}
                        >
                          <span className="capitalize font-medium">{event.side}</span>
                          <span>{event.pointCount} points @ {event.averageHeight.toFixed(1)}m</span>
                          <span className="text-gray-400">{event.closestPointDistance.toFixed(1)}m away</span>
                          {event.poiCreated && (
                            <span className="text-green-400 text-xs">POI logged</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
        
        {activeTab === 'captures' && (
          <Card className="bg-gray-800 border-gray-700" data-testid="card-captures-list">
            <CardHeader>
              <CardTitle className="text-white">Saved Captures</CardTitle>
            </CardHeader>
            <CardContent>
              {captures.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No captures yet. Start a scan from the dashboard.
                </p>
              ) : (
                <div className="space-y-3">
                  {captures.map((capture) => (
                    <div
                      key={capture.id}
                      className="p-4 bg-gray-700 rounded flex items-center justify-between"
                      data-testid={`capture-${capture.id}`}
                    >
                      <div>
                        <div className="font-medium">{capture.id}</div>
                        <div className="text-sm text-gray-400 flex gap-4">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(capture.startedAt).toLocaleString()}
                          </span>
                          <span>{capture.pointCount.toLocaleString()} points</span>
                          {capture.poiId && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              POI: {capture.poiId.substring(0, 8)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {capture.exportPath ? (
                          <Badge variant="outline" className="text-green-400 border-green-700">
                            Exported
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleExport(capture.id)}
                            data-testid={`btn-export-${capture.id}`}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Export LAZ
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
        
        {activeTab === 'settings' && (
          <div className="space-y-4">
            <Card className="bg-gray-800 border-gray-700" data-testid="card-settings">
              <CardHeader>
                <CardTitle className="text-white">LiDAR Service Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400 block mb-1">
                    Service Port
                  </label>
                  <Input
                    type="text"
                    value={servicePort}
                    onChange={(e) => setServicePort(e.target.value)}
                    className="bg-gray-700 border-gray-600 w-32"
                    data-testid="settings-input-port"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Default: 17777. The companion service must be running on Windows.
                  </p>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Switch
                    id="mock-mode"
                    checked={mockModeEnabled}
                    onCheckedChange={(checked: boolean) => {
                      setMockModeEnabled(checked);
                      useSettingsStore.getState().setUISettings({ lidarMockMode: checked });
                      /* toast removed */
                    }}
                    data-testid="switch-mock-mode"
                  />
                  <label htmlFor="mock-mode" className="text-sm text-gray-300 cursor-pointer">
                    Enable Mock Mode (testing without hardware)
                  </label>
                </div>
                {mockModeEnabled && (
                  <div className="p-3 bg-amber-900/30 border border-amber-700 rounded text-sm">
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <div className="text-amber-200">
                        <p className="font-medium">Mock Mode Instructions:</p>
                        <p className="text-amber-300 mt-1">
                          Edit <code className="bg-gray-700 px-1 rounded">appsettings.json</code> in the companion service folder and set:
                        </p>
                        <pre className="mt-1 bg-gray-900 p-2 rounded text-xs overflow-x-auto">
{`"LidarService": {
  "MockMode": true
}`}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="p-4 bg-gray-700 rounded">
                  <h3 className="font-medium mb-2">Service Status</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Available</span>
                      <span>{isServiceAvailable ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Connected</span>
                      <span>{isConnected ? 'Yes' : 'No'}</span>
                    </div>
                    {status && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Actual Port</span>
                          <span>{status.actualPort}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">CPU Usage</span>
                          <span>{status.cpuPercent.toFixed(1)}%</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <DryRunSettings />
            
            <Card className="bg-gray-800 border-gray-700" data-testid="card-download">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <FileArchive className="h-5 w-5 text-orange-400" />
                  Download Companion Service
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-gray-300 text-sm">
                  The LiDAR companion service is a Windows application that receives data from the Hesai Pandar40P scanner and streams it to MeasurePRO.
                </p>
                
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    className="bg-orange-600 hover:bg-orange-700 border-orange-700 text-white"
                    onClick={() => {
                      window.location.href = `${API_BASE_URL}/api/downloads/lidar-service.zip`;
                      /* toast removed */
                    }}
                    data-testid="btn-download-installer"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Service Package
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      window.open('/lidar/source', '_blank');
                    }}
                    data-testid="btn-view-source"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Source Code
                  </Button>
                </div>
                
                <div className="p-4 bg-blue-900/30 border border-blue-700 rounded">
                  <h3 className="font-medium mb-3 text-blue-300">Setup Instructions</h3>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
                    <li>
                      <strong>Install .NET 8.0 Runtime</strong>
                      <p className="ml-6 text-gray-400">Download from <a href="https://dotnet.microsoft.com/download/dotnet/8.0" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">microsoft.com/download/dotnet/8.0</a></p>
                    </li>
                    <li>
                      <strong>Copy the lidar-service folder</strong>
                      <p className="ml-6 text-gray-400">Copy the entire <code className="bg-gray-700 px-1 rounded">lidar-service</code> folder to your Windows PC</p>
                    </li>
                    <li>
                      <strong>Configure settings (optional)</strong>
                      <p className="ml-6 text-gray-400">Edit <code className="bg-gray-700 px-1 rounded">appsettings.json</code> to change port, storage path, or enable mock mode</p>
                    </li>
                    <li>
                      <strong>Start the service</strong>
                      <p className="ml-6 text-gray-400">Open a terminal in the folder and run: <code className="bg-gray-700 px-1 rounded">dotnet run</code></p>
                    </li>
                    <li>
                      <strong>Connect the Pandar40P</strong>
                      <p className="ml-6 text-gray-400">Connect the LiDAR scanner to your PC via Ethernet (default IP: 192.168.1.201)</p>
                    </li>
                    <li>
                      <strong>Connect from MeasurePRO</strong>
                      <p className="ml-6 text-gray-400">Enter the port number above and click Connect on the Dashboard tab</p>
                    </li>
                  </ol>
                </div>
                
                <div className="p-4 bg-gray-700/50 rounded">
                  <h3 className="font-medium mb-2 text-gray-200">System Requirements</h3>
                  <ul className="text-sm text-gray-400 space-y-1">
                    <li>Windows 10/11 (64-bit)</li>
                    <li>.NET 8.0 Runtime or SDK</li>
                    <li>Gigabit Ethernet adapter</li>
                    <li>4GB RAM minimum (8GB recommended)</li>
                    <li>SSD with 10GB+ free space for captures</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        
        {activeTab === 'liveview' && !isConnected && (
          <div className="space-y-4" data-testid="liveview-section">
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="py-12 text-center">
                <WifiOff className="h-12 w-12 mx-auto mb-4 text-gray-500" />
                <p className="text-gray-400 text-lg mb-4">Connect to LiDAR service to view live data</p>
                <Button
                  onClick={() => setActiveTab('dashboard')}
                  variant="outline"
                >
                  Go to Dashboard
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>

    <Dialog open={showGuide} onOpenChange={setShowGuide}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-gray-900 border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-purple-400" />
            Pandar40P Connection Guide
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 text-sm">

          <div className="bg-gray-800 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-purple-300 text-base">1. Network Setup</h3>
            <p className="text-gray-300">The Pandar40P communicates over UDP. Configure your Windows PC network adapter:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-400 ml-2">
              <li>Set PC static IP to <span className="font-mono text-green-400">192.168.1.100</span> (or any 192.168.1.x address)</li>
              <li>Subnet mask: <span className="font-mono text-green-400">255.255.255.0</span></li>
              <li>Scanner default IP: <span className="font-mono text-green-400">192.168.1.201</span></li>
              <li>Scanner sends data to port <span className="font-mono text-green-400">2368</span> (UDP)</li>
            </ul>
          </div>

          <div className="bg-gray-800 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-purple-300 text-base">2. Start the Companion Service</h3>
            <p className="text-gray-300">Run the MeasurePRO LiDAR Service on your Windows PC:</p>
            <div className="bg-gray-950 rounded p-3 font-mono text-green-400 text-xs">
              cd C:\Users\...\Desktop\Pendar40P<br/>
              dotnet run
            </div>
            <p className="text-gray-400">The service will print:</p>
            <div className="bg-gray-950 rounded p-3 font-mono text-gray-300 text-xs">
              LiDAR Service starting on port 17777<br/>
              UDP Receiver initialized in REAL mode<br/>
              Listening for Pandar40P packets on port 2368<br/>
              Now listening on: http://127.0.0.1:17777
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-purple-300 text-base">3. Connect from MeasurePRO</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-400 ml-2">
              <li>Enter port <span className="font-mono text-green-400">17777</span> in the port field</li>
              <li>Click <strong className="text-white">Connect</strong></li>
              <li>Status badge turns <span className="text-green-400">Connected</span></li>
              <li>Packets/sec will jump to ~600+ once the scanner is streaming</li>
            </ul>
            <p className="text-gray-400 mt-2">
              If MeasurePRO is on a different device (tablet/laptop), replace <span className="font-mono text-yellow-400">127.0.0.1</span> with the Windows PC's local IP address in Settings → LiDAR Service URL.
            </p>
          </div>

          <div className="bg-gray-800 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-purple-300 text-base">4. Power on the Scanner</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-400 ml-2">
              <li>Connect 12V power to the Pandar40P (7–16V DC, 30W typical)</li>
              <li>The scanner begins spinning within ~5 seconds</li>
              <li>Green LED on scanner = operational</li>
              <li>Time Sync ⚠ warning is normal without a GPS PPS signal — does not affect road metrics</li>
            </ul>
          </div>

          <div className="bg-gray-800 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-purple-300 text-base">5. Mock Mode (Testing Without Hardware)</h3>
            <p className="text-gray-300">To test the interface without a real scanner, enable mock mode:</p>
            <p className="text-gray-400">Edit <span className="font-mono text-yellow-400">appsettings.json</span> in the service folder:</p>
            <div className="bg-gray-950 rounded p-3 font-mono text-xs text-gray-300">
              {`"MockMode": true`}
            </div>
            <p className="text-gray-400">Mock mode generates simulated road data at realistic packet rates.</p>
          </div>

          <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4 space-y-1">
            <h3 className="font-semibold text-yellow-300">Troubleshooting</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-400 ml-2">
              <li><strong className="text-white">0 packets/sec after connect:</strong> Check PC IP is in 192.168.1.x subnet, firewall allows UDP port 2368</li>
              <li><strong className="text-white">Cannot connect to service:</strong> Ensure service is running, port 17777 not blocked by Windows Firewall</li>
              <li><strong className="text-white">Service won't start:</strong> .NET 8 Runtime must be installed — download from microsoft.com/dotnet</li>
              <li><strong className="text-white">Using a tablet/phone:</strong> Connect both devices to the same WiFi network, use PC's local IP (e.g. 192.168.0.50:17777)</li>
            </ul>
          </div>

        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

