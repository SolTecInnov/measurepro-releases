import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Upload, 
  QrCode as QrCodeIcon, 
  Play, 
  Pause, 
  XCircle, 
  Eye, 
  MapPin, 
  Calendar,
  AlertCircle,
  TrendingUp,
  Route as RouteIcon,
  Users,
  Copy,
  Check
} from 'lucide-react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { useRouteEnforcementStore } from '@/lib/stores/routeEnforcementStore';
import { importRouteFromGPX } from '@/lib/utils/routeUtils';
import type { RouteEnforcementConvoy } from '@shared/schema';

export default function DispatchConsole() {
  const navigate = useNavigate();
  const { settings, activeConvoys, addConvoy, updateConvoy, removeConvoy } = useRouteEnforcementStore();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [routePreview, setRoutePreview] = useState<{
    geometry: [number, number][];
    distance: number;
    pointCount: number;
  } | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  
  // Form data
  const [convoyName, setConvoyName] = useState('');
  const [environmentType, setEnvironmentType] = useState<'rural' | 'urban'>('rural');
  const [windowStart, setWindowStart] = useState('');
  const [windowEnd, setWindowEnd] = useState('');
  const [dispatchPhone, setDispatchPhone] = useState('');
  const [dispatchEmail, setDispatchEmail] = useState('');
  const [customDeviation, setCustomDeviation] = useState<number | null>(null);
  
  // QR codes for active convoys
  const [qrCodes, setQrCodes] = useState<Map<string, string>>(new Map());

  const currentSettings = settings || {
    enabled: false,
    maxActiveConvoys: 3,
    additionalConvoySlots: 0,
    defaultRuralDeviation: 30,
    defaultUrbanDeviation: 15,
    defaultPersistence: 7,
    defaultMaxAccuracy: 15,
  };

  const totalConvoySlots = currentSettings.maxActiveConvoys + currentSettings.additionalConvoySlots;
  const activeConvoyCount = activeConvoys.size;
  const canCreateMore = activeConvoyCount < totalConvoySlots;

  // Generate QR codes for all active convoys
  useEffect(() => {
    const generateQRCodes = async () => {
      const newQrCodes = new Map<string, string>();
      
      for (const [id, convoy] of activeConvoys) {
        try {
          const joinUrl = `${window.location.origin}/route-enforcement/driver?token=${convoy.qrToken}`;
          const qrDataUrl = await QRCode.toDataURL(joinUrl, {
            width: 256,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#ffffff',
            },
          });
          newQrCodes.set(id, qrDataUrl);
        } catch (error) {
        }
      }
      
      setQrCodes(newQrCodes);
    };
    
    generateQRCodes();
  }, [activeConvoys]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.name.endsWith('.gpx')) {
      toast.error('Please select a GPX file');
      return;
    }
    
    setSelectedFile(file);
    
    try {
      const text = await file.text();
      const routeData = await importRouteFromGPX(text);
      
      if (routeData && routeData.routeGeometry && routeData.routeGeometry.length > 0) {
        // Calculate total distance
        let totalDistance = 0;
        for (let i = 1; i < routeData.routeGeometry.length; i++) {
          const [lat1, lon1] = routeData.routeGeometry[i - 1];
          const [lat2, lon2] = routeData.routeGeometry[i];
          const dist = calculateDistance(lat1, lon1, lat2, lon2);
          totalDistance += dist;
        }
        
        setRoutePreview({
          geometry: routeData.routeGeometry,
          distance: totalDistance,
          pointCount: routeData.routeGeometry.length,
        });
        
        /* toast removed */
      } else {
        toast.error('No route data found in GPX file');
      }
    } catch (error) {
      toast.error('Failed to parse GPX file');
    }
  };

  const handleCreateConvoy = () => {
    if (!convoyName.trim()) {
      toast.error('Convoy name is required');
      return;
    }
    
    if (!routePreview) {
      toast.error('Please upload a GPX route file');
      return;
    }
    
    if (!windowStart || !windowEnd) {
      toast.error('Please select time window');
      return;
    }
    
    if (new Date(windowStart) >= new Date(windowEnd)) {
      toast.error('End time must be after start time');
      return;
    }
    
    if (!canCreateMore) {
      toast.error(`Maximum ${totalConvoySlots} active convoys reached. Upgrade to add more.`);
      return;
    }

    const allowedDeviation = customDeviation || 
      (environmentType === 'rural' ? currentSettings.defaultRuralDeviation : currentSettings.defaultUrbanDeviation);

    const convoy: RouteEnforcementConvoy = {
      id: `convoy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      dispatcherId: 'current_user', // TODO: Get from auth
      convoyName: convoyName.trim(),
      status: 'active',
      routeGeometry: routePreview.geometry,
      routeName: selectedFile?.name || 'Uploaded Route',
      routeDescription: `${environmentType} route`,
      totalRouteDistance: routePreview.distance,
      allowedDeviationMeters: allowedDeviation,
      persistenceSeconds: currentSettings.defaultPersistence,
      maxAccuracyMeters: currentSettings.defaultMaxAccuracy,
      environmentType,
      windowStart: new Date(windowStart).toISOString(),
      windowEnd: new Date(windowEnd).toISOString(),
      dispatchPhone: dispatchPhone || undefined,
      dispatchEmail: dispatchEmail || undefined,
      qrToken: generateToken(),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(windowEnd).toISOString(),
    };

    addConvoy(convoy);
    // toast suppressed
    
    // Reset form
    setShowCreateForm(false);
    setConvoyName('');
    setSelectedFile(null);
    setRoutePreview(null);
    setWindowStart('');
    setWindowEnd('');
    setDispatchPhone('');
    setDispatchEmail('');
    setCustomDeviation(null);
  };

  const handleToggleConvoyStatus = (convoyId: string, currentStatus: 'active' | 'paused' | 'ended') => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    updateConvoy(convoyId, { status: newStatus });
    // toast suppressed
  };

  const handleEndConvoy = (convoyId: string) => {
    updateConvoy(convoyId, { status: 'ended' });
    // After 5 seconds, remove it from active list
    setTimeout(() => {
      removeConvoy(convoyId);
      // toast suppressed
    }, 5000);
    // toast suppressed
  };

  const handleCopyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedToken(token);
    // toast suppressed
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleViewLive = (convoyId: string) => {
    navigate(`/route-enforcement/live/${convoyId}`);
  };

  if (!settings?.enabled) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Route Enforcement Disabled</h2>
          <p className="text-gray-400 mb-6">
            Please enable Permitted Route Enforcement in Settings to access the dispatch console.
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-medium"
            data-testid="button-go-settings"
          >
            Go to Settings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <RouteIcon className="w-8 h-8 text-green-500" />
              Dispatch Console
            </h1>
            <p className="text-gray-400 mt-1">Manage permitted route enforcement convoys</p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
            data-testid="button-back"
          >
            Back to Settings
          </button>
        </div>

        {/* Convoy Capacity Banner */}
        <div className="bg-gradient-to-r from-green-900/30 to-blue-900/30 border border-green-800/50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-green-400" />
              <div>
                <h3 className="font-medium">Active Convoy Capacity</h3>
                <p className="text-sm text-gray-400">
                  {activeConvoyCount} of {totalConvoySlots} slots used
                </p>
              </div>
            </div>
            {!canCreateMore && (
              <div className="text-right">
                <p className="text-yellow-400 text-sm font-medium">Limit Reached</p>
                <p className="text-xs text-gray-400">Contact sales for more slots ($55/convoy)</p>
              </div>
            )}
          </div>
        </div>

        {/* Create New Convoy Button */}
        {!showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            disabled={!canCreateMore}
            className="w-full mb-6 p-6 bg-gray-800 border-2 border-dashed border-gray-700 hover:border-green-600 rounded-lg flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-700"
            data-testid="button-create-convoy"
          >
            <Plus className="w-6 h-6" />
            <span className="font-medium">
              {canCreateMore ? 'Create New Convoy' : `Maximum ${totalConvoySlots} convoys reached`}
            </span>
          </button>
        )}

        {/* Create Form */}
        {showCreateForm && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700" data-testid="form-create-convoy">
            <h2 className="text-xl font-bold mb-4">Create New Convoy</h2>
            
            <div className="space-y-4">
              {/* Convoy Name */}
              <div>
                <label className="block text-sm font-medium mb-2">Convoy Name *</label>
                <input
                  type="text"
                  value={convoyName}
                  onChange={(e) => setConvoyName(e.target.value)}
                  placeholder="e.g., Downtown Delivery Route A"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  data-testid="input-convoy-name"
                />
              </div>

              {/* Environment Type */}
              <div>
                <label className="block text-sm font-medium mb-2">Environment Type *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setEnvironmentType('rural')}
                    className={`p-4 rounded-lg border-2 ${
                      environmentType === 'rural'
                        ? 'border-green-500 bg-green-900/20'
                        : 'border-gray-700 bg-gray-700'
                    }`}
                    data-testid="button-env-rural"
                  >
                    <div className="font-medium">Rural</div>
                    <div className="text-sm text-gray-400">30m deviation default</div>
                  </button>
                  <button
                    onClick={() => setEnvironmentType('urban')}
                    className={`p-4 rounded-lg border-2 ${
                      environmentType === 'urban'
                        ? 'border-green-500 bg-green-900/20'
                        : 'border-gray-700 bg-gray-700'
                    }`}
                    data-testid="button-env-urban"
                  >
                    <div className="font-medium">Urban</div>
                    <div className="text-sm text-gray-400">15m deviation default</div>
                  </button>
                </div>
              </div>

              {/* GPX Upload */}
              <div>
                <label className="block text-sm font-medium mb-2">Route File (GPX) *</label>
                <input
                  type="file"
                  accept=".gpx"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="gpx-upload"
                  data-testid="input-gpx-file"
                />
                <label
                  htmlFor="gpx-upload"
                  className="flex items-center justify-center gap-3 p-6 bg-gray-700 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer hover:border-green-500"
                >
                  <Upload className="w-6 h-6" />
                  <span>{selectedFile ? selectedFile.name : 'Upload GPX File'}</span>
                </label>
                {routePreview && (
                  <div className="mt-3 p-3 bg-green-900/20 border border-green-800 rounded-lg" data-testid="text-route-summary">
                    <div className="flex items-center gap-2 text-green-400 mb-2">
                      <Check className="w-4 h-4" />
                      <span className="font-medium">Route Loaded</span>
                    </div>
                    <div className="text-sm text-gray-300 space-y-1">
                      <p>Points: {routePreview.pointCount}</p>
                      <p>Distance: {(routePreview.distance / 1000).toFixed(2)} km</p>
                      <p>Buffer: {customDeviation || (environmentType === 'rural' ? currentSettings.defaultRuralDeviation : currentSettings.defaultUrbanDeviation)}m</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Time Window */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Start Time *</label>
                  <input
                    type="datetime-local"
                    value={windowStart}
                    onChange={(e) => setWindowStart(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    data-testid="input-window-start"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">End Time *</label>
                  <input
                    type="datetime-local"
                    value={windowEnd}
                    onChange={(e) => setWindowEnd(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    data-testid="input-window-end"
                  />
                </div>
              </div>

              {/* Contact Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Dispatch Phone</label>
                  <input
                    type="tel"
                    value={dispatchPhone}
                    onChange={(e) => setDispatchPhone(e.target.value)}
                    placeholder="+1.438.533.5344"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    data-testid="input-dispatch-phone"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Dispatch Email</label>
                  <input
                    type="email"
                    value={dispatchEmail}
                    onChange={(e) => setDispatchEmail(e.target.value)}
                    placeholder="dispatch@example.com"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    data-testid="input-dispatch-email"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleCreateConvoy}
                  className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-medium"
                  data-testid="button-submit-convoy"
                >
                  Create Convoy
                </button>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setSelectedFile(null);
                    setRoutePreview(null);
                  }}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg"
                  data-testid="button-cancel-create"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Active Convoys List */}
        <div>
          <h2 className="text-xl font-bold mb-4">Active Convoys ({activeConvoyCount})</h2>
          
          {activeConvoyCount === 0 ? (
            <div className="bg-gray-800 rounded-lg p-12 text-center">
              <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No active convoys</p>
              <p className="text-sm text-gray-500 mt-2">Create a convoy to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Array.from(activeConvoys.values()).map((convoy) => (
                <div
                  key={convoy.id}
                  className="bg-gray-800 rounded-lg p-6 border border-gray-700"
                  data-testid={`card-convoy-${convoy.id}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        {convoy.convoyName}
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          convoy.status === 'active' ? 'bg-green-900 text-green-300' :
                          convoy.status === 'paused' ? 'bg-yellow-900 text-yellow-300' :
                          'bg-gray-700 text-gray-300'
                        }`} data-testid={`badge-status-${convoy.id}`}>
                          {convoy.status.toUpperCase()}
                        </span>
                      </h3>
                      <p className="text-sm text-gray-400">{convoy.routeName}</p>
                      <div className="flex gap-4 mt-2 text-sm text-gray-400">
                        <span>{convoy.environmentType.toUpperCase()}</span>
                        <span>{(convoy.totalRouteDistance! / 1000).toFixed(2)} km</span>
                        <span>±{convoy.allowedDeviationMeters}m buffer</span>
                      </div>
                    </div>
                    
                    {/* QR Code */}
                    {qrCodes.has(convoy.id) && (
                      <div className="ml-4">
                        <img
                          src={qrCodes.get(convoy.id)}
                          alt="QR Code"
                          className="w-24 h-24 border-2 border-gray-700 rounded"
                          data-testid={`img-qr-${convoy.id}`}
                        />
                        <button
                          onClick={() => handleCopyToken(convoy.qrToken)}
                          className="mt-2 w-full px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded flex items-center justify-center gap-1"
                          data-testid={`button-copy-token-${convoy.id}`}
                        >
                          {copiedToken === convoy.qrToken ? (
                            <>
                              <Check className="w-3 h-3" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              Copy Token
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Time Window */}
                  <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(convoy.windowStart).toLocaleString()} - {new Date(convoy.windowEnd).toLocaleString()}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleViewLive(convoy.id)}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center justify-center gap-2"
                      data-testid={`button-view-live-${convoy.id}`}
                    >
                      <Eye className="w-4 h-4" />
                      View Live
                    </button>
                    <button
                      onClick={() => handleToggleConvoyStatus(convoy.id, convoy.status)}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center gap-2"
                      data-testid={`button-toggle-status-${convoy.id}`}
                    >
                      {convoy.status === 'active' ? (
                        <>
                          <Pause className="w-4 h-4" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          Resume
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleEndConvoy(convoy.id)}
                      className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg flex items-center gap-2"
                      data-testid={`button-end-${convoy.id}`}
                    >
                      <XCircle className="w-4 h-4" />
                      End
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper functions
function generateToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}