import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, CircleMarker, Circle } from 'react-leaflet';
import L from 'leaflet';
import {
  QrCode as QrCodeIcon,
  MapPin,
  Navigation,
  AlertTriangle,
  CheckCircle,
  ArrowLeft,
  Phone,
  Radio,
  Map as MapIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouteEnforcementStore } from '@/lib/stores/routeEnforcementStore';
import { useGPSStore } from '@/lib/stores/gpsStore';
import { detectOffRoute, formatDistance, getViolationSeverity } from '@/lib/utils/offRouteDetection';
import StopModal from './StopModal';
import TurnByTurnNavigation from '../TurnByTurnNavigation';
import type { RouteJoinRequest } from '@shared/schema';

export default function DriverInterface() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token');
  
  const {
    driverSession,
    setDriverSession,
    updateDriverStatus,
    stopModal,
    hideStopModal,
    ws,
    connected,
    connectToConvoy,
    disconnect,
    gpsState,
    setGPS,
  } = useRouteEnforcementStore();
  
  const { data: browserGPS } = useGPSStore();
  
  const [showJoinForm, setShowJoinForm] = useState(!driverSession);
  const [tokenInput, setTokenInput] = useState(tokenFromUrl || '');
  const [formData, setFormData] = useState<RouteJoinRequest>({
    qrToken: tokenFromUrl || '',
    name: '',
    role: 'driver',
    vehicleId: '',
    company: '',
    phoneNumber: '',
    notes: '',
  });
  
  const [distanceFromRoute, setDistanceFromRoute] = useState<number | null>(null);
  const [nearestPoint, setNearestPoint] = useState<[number, number] | null>(null);
  const [violationStartTime, setViolationStartTime] = useState<number | null>(null);
  const [hasActiveIncident, setHasActiveIncident] = useState(false);
  const gpsUpdateInterval = useRef<number | null>(null);

  // Update GPS from browser GPS
  useEffect(() => {
    if (browserGPS && browserGPS.latitude && browserGPS.longitude) {
      setGPS({
        latitude: browserGPS.latitude,
        longitude: browserGPS.longitude,
        accuracy: browserGPS.hdop * 5 || 10,
        timestamp: Date.now(),
      });
    }
  }, [browserGPS, setGPS]);

  // Off-route detection with proper logic
  useEffect(() => {
    if (!driverSession || !gpsState || !driverSession.convoy.routeGeometry) return;
    
    const detectionConfig = {
      allowedDeviationMeters: driverSession.convoy.allowedDeviationMeters,
      persistenceSeconds: driverSession.convoy.persistenceSeconds,
      maxAccuracyMeters: driverSession.convoy.maxAccuracyMeters,
    };

    const result = detectOffRoute(
      gpsState,
      driverSession.convoy.routeGeometry,
      detectionConfig,
      violationStartTime
    );

    setDistanceFromRoute(result.distanceFromRoute);
    setNearestPoint(result.nearestPoint);
    setViolationStartTime(result.violationStartTime);

    // Update status based on detection result
    if (result.persistent && !hasActiveIncident) {
      // Trigger persistent off-route violation
      updateDriverStatus('off_route_alert');
      setHasActiveIncident(true);

      // Send off-route alert via WebSocket
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'off_route_alert',
          convoyId: driverSession.convoyId,
          data: {
            memberId: driverSession.memberId,
            distance: result.distanceFromRoute,
            gps: gpsState,
            severity: getViolationSeverity(result.distanceFromRoute, driverSession.convoy.environmentType),
          },
          timestamp: Date.now(),
        }));
      }

      toast.error(`Off-route violation detected! ${formatDistance(result.distanceFromRoute)} from route`, {
        duration: 10000,
      });
    } else if (result.isOffRoute && !result.persistent) {
      // Warning: off-route but not yet persistent
      updateDriverStatus('warning');
    } else if (!result.isOffRoute) {
      // Back on route
      updateDriverStatus('on_route');
      if (hasActiveIncident) {
        setHasActiveIncident(false);
        toast.success('Back on route');
      }
    }
  }, [gpsState, driverSession, violationStartTime, hasActiveIncident, updateDriverStatus, ws]);

  // Send GPS updates to server
  useEffect(() => {
    if (!driverSession || !connected || !ws || !gpsState) return;
    
    if (gpsUpdateInterval.current) {
      clearInterval(gpsUpdateInterval.current);
    }
    
    gpsUpdateInterval.current = window.setInterval(() => {
      if (ws.readyState === WebSocket.OPEN && gpsState) {
        ws.send(JSON.stringify({
          type: 'position_update',
          convoyId: driverSession.convoyId,
          data: {
            memberId: driverSession.memberId,
            gps: gpsState,
            status: driverSession.currentStatus,
            distanceFromRoute: distanceFromRoute,
          },
          timestamp: Date.now(),
        }));
      }
    }, 2000); // Send every 2 seconds
    
    return () => {
      if (gpsUpdateInterval.current) {
        clearInterval(gpsUpdateInterval.current);
      }
    };
  }, [driverSession, connected, ws, gpsState, distanceFromRoute]);

  const handleJoinConvoy = async () => {
    if (!formData.qrToken.trim()) {
      toast.error('QR token is required');
      return;
    }
    
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }
    
    if (!formData.vehicleId.trim()) {
      toast.error('Vehicle ID is required');
      return;
    }
    
    if (!formData.phoneNumber.trim()) {
      toast.error('Phone number is required');
      return;
    }

    try {
      const response = await fetch('/api/route-enforcement/validate-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: formData.qrToken.trim().toUpperCase() }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        const errorMsg = result.error || 'Invalid token. Please try again.';
        toast.error(errorMsg);
        return;
      }

      const convoy = result.convoy;

      setDriverSession({
        convoyId: convoy.id,
        memberId: `driver-${Date.now()}`,
        convoy,
        isConnected: false,
        currentStatus: 'on_route',
        distanceFromRoute: null,
      });
      
      // Connect WebSocket
      connectToConvoy(convoy.id, convoy.qrToken, formData);
      
      setShowJoinForm(false);
      toast.success('Joined convoy successfully');
    } catch (error) {
      toast.error('Failed to join convoy. Please check your connection and try again.');
    }
  };

  const handleLeaveConvoy = () => {
    disconnect();
    setDriverSession(null);
    setShowJoinForm(true);
    toast.info('Left convoy');
  };

  if (showJoinForm) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8 flex items-center justify-center">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <QrCodeIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-2">Join Convoy</h1>
            <p className="text-gray-400">Scan QR code or enter convoy token</p>
          </div>

          <div className="bg-gray-800 rounded-xl p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Convoy Token *</label>
              <input
                type="text"
                value={tokenInput}
                onChange={(e) => {
                  setTokenInput(e.target.value);
                  setFormData({ ...formData, qrToken: e.target.value });
                }}
                placeholder="Enter 8-character token"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 uppercase"
                maxLength={8}
                data-testid="input-token"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Your Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Doe"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                data-testid="input-name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Vehicle ID / Plate *</label>
              <input
                type="text"
                value={formData.vehicleId}
                onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })}
                placeholder="ABC-123 or Fleet #45"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                data-testid="input-vehicle-id"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Phone Number *</label>
              <input
                type="tel"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                placeholder="+1.438.533.5344"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                data-testid="input-phone"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Company (Optional)</label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                placeholder="ABC Trucking"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                data-testid="input-company"
              />
            </div>

            <button
              onClick={handleJoinConvoy}
              className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-medium flex items-center justify-center gap-2"
              data-testid="button-join"
            >
              <Navigation className="w-5 h-5" />
              Join Convoy
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!driverSession) return null;

  const mapCenter: [number, number] = driverSession.convoy.routeGeometry[0] || [45.5, -73.5];
  const currentPosition: [number, number] | null = gpsState 
    ? [gpsState.latitude, gpsState.longitude]
    : null;

  const statusConfig = {
    on_route: { color: 'bg-green-600', text: 'ON ROUTE', icon: CheckCircle },
    warning: { color: 'bg-yellow-600', text: 'WARNING', icon: AlertTriangle },
    off_route_alert: { color: 'bg-red-600', text: 'OFF ROUTE', icon: AlertTriangle },
  };

  const config = statusConfig[driverSession.currentStatus];

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col">
      {/* Status Bar */}
      <div className={`${config.color} p-4`}>
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <config.icon className="w-6 h-6" />
            <div>
              <h2 className="text-lg font-bold" data-testid="text-status">{config.text}</h2>
              <p className="text-sm opacity-90">{driverSession.convoy.convoyName}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {distanceFromRoute !== null && (
              <div className="text-right">
                <div className="text-2xl font-bold" data-testid="text-distance">
                  {distanceFromRoute.toFixed(1)}m
                </div>
                <div className="text-xs opacity-90">from route</div>
              </div>
            )}
            <button
              onClick={handleLeaveConvoy}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm"
              data-testid="button-leave"
            >
              Leave Convoy
            </button>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {currentPosition && (
          <MapContainer
            center={currentPosition}
            zoom={15}
            style={{ height: '100%', width: '100%' }}
            className="z-0"
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            
            {/* Route Polyline */}
            <Polyline
              positions={driverSession.convoy.routeGeometry}
              color="#22c55e"
              weight={6}
              opacity={0.8}
            />
            
            {/* Buffer Zone */}
            {nearestPoint && (
              <Circle
                center={nearestPoint}
                radius={driverSession.convoy.allowedDeviationMeters}
                pathOptions={{
                  color: '#22c55e',
                  fillColor: '#22c55e',
                  fillOpacity: 0.1,
                  weight: 2,
                  opacity: 0.5,
                }}
              />
            )}
            
            {/* Current Position */}
            <CircleMarker
              center={currentPosition}
              radius={10}
              pathOptions={{
                fillColor: config.color.replace('bg-', ''),
                color: '#ffffff',
                weight: 3,
                opacity: 1,
                fillOpacity: 0.8,
              }}
            />
          </MapContainer>
        )}
        
        {!currentPosition && (
          <div className="h-full flex items-center justify-center bg-gray-800">
            <div className="text-center">
              <MapIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Waiting for GPS signal...</p>
            </div>
          </div>
        )}
      </div>

      {/* STOP Modal */}
      <StopModal
        isVisible={stopModal.isVisible}
        incidentId={stopModal.incidentId}
        reason={stopModal.reason}
        distanceOffRoute={distanceFromRoute}
        dispatchPhone={driverSession.convoy.dispatchPhone}
        canDismiss={stopModal.canDismiss}
        onDismiss={hideStopModal}
      />
    </div>
  );
}

// Helper function
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