import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, Circle } from 'react-leaflet';
import L from 'leaflet';
import { 
  ArrowLeft, 
  Users, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Phone,
  Clock,
  MapPin,
  Radio
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouteEnforcementStore } from '@/lib/stores/routeEnforcementStore';
import { soundManager } from '@/lib/sounds';
import type { RouteIncident, RouteEnforcementMember } from '@shared/schema';

export default function DispatchLiveView() {
  const { convoyId } = useParams<{ convoyId: string }>();
  const navigate = useNavigate();
  const { activeConvoys, incidents, updateIncident, ws, connected, connectToConvoy } = useRouteEnforcementStore();
  
  const [members, setMembers] = useState<Map<string, RouteEnforcementMember>>(new Map());
  const [selectedIncident, setSelectedIncident] = useState<RouteIncident | null>(null);

  const convoy = convoyId ? activeConvoys.get(convoyId) : null;
  const convoyIncidents = Array.from(incidents.values()).filter(inc => inc.convoyId === convoyId);
  const pendingIncidents = convoyIncidents.filter(inc => inc.status === 'pending');

  // Connect to convoy WebSocket
  useEffect(() => {
    if (!convoy || !convoyId) return;
    
    if (!connected) {
      // Dispatch connects as a special "dispatch" member
      connectToConvoy(convoyId, convoy.qrToken, {
        id: 'dispatch',
        name: 'Dispatch Console',
        role: 'dispatcher',
      });
    }

    return () => {
      // Disconnect handled by store
    };
  }, [convoy, convoyId, connected, connectToConvoy]);

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'position_update' && message.data.member) {
          setMembers(prev => {
            const updated = new Map(prev);
            updated.set(message.data.member.id, message.data.member);
            return updated;
          });
        }
        
        if (message.type === 'off_route_alert' && message.data.incident) {
          // Play alert sound
          soundManager.playSound('warning');
          toast.warning(`Off-route alert: ${message.data.member.name}`);
        }
      } catch (error) {
      }
    };

    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, [ws]);

  const handleAcknowledgeIncident = (incident: RouteIncident) => {
    updateIncident(incident.id, {
      status: 'acknowledged',
      acknowledgedAt: new Date().toISOString(),
      dispatcherId: 'dispatch',
    });
    
    // Send acknowledgment via WebSocket
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'incident_acknowledged',
        convoyId: convoy?.id,
        data: { incidentId: incident.id },
        timestamp: Date.now(),
      }));
    }
    
    toast.success('Incident acknowledged');
  };

  const handleClearIncident = (incident: RouteIncident) => {
    updateIncident(incident.id, {
      status: 'cleared',
      clearedAt: new Date().toISOString(),
      dispatcherId: 'dispatch',
    });
    
    // Send clear command via WebSocket
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'incident_cleared',
        convoyId: convoy?.id,
        data: { incidentId: incident.id },
        timestamp: Date.now(),
      }));
    }
    
    toast.success('Incident cleared - driver can continue');
    soundManager.playSound('confirmation');
  };

  if (!convoy) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Convoy Not Found</h2>
          <button
            onClick={() => navigate('/route-enforcement/dispatch')}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-medium"
            data-testid="button-back"
          >
            Back to Dispatch Console
          </button>
        </div>
      </div>
    );
  }

  const mapCenter: [number, number] = convoy.routeGeometry[0] || [45.5, -73.5];
  const memberList = Array.from(members.values());

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/route-enforcement/dispatch')}
              className="p-2 hover:bg-gray-700 rounded-lg"
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold">{convoy.convoyName}</h1>
              <p className="text-sm text-gray-400">Live Monitoring</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              <span data-testid="text-member-count">{memberList.length} members</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              <span data-testid="text-incident-count">{pendingIncidents.length} alerts</span>
            </div>
            <div className={`flex items-center gap-2 ${connected ? 'text-green-400' : 'text-red-400'}`}>
              <Radio className="w-5 h-5" />
              <span data-testid="text-connection-status">{connected ? 'Connected' : 'Disconnected'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Map View */}
        <div className="flex-1 relative">
          <MapContainer
            center={mapCenter}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
            className="z-0"
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            
            {/* Route Polyline */}
            <Polyline
              positions={convoy.routeGeometry}
              color="#22c55e"
              weight={4}
              opacity={0.8}
            />
            
            {/* Buffer Zone (simplified - showing circles at key points) */}
            {convoy.routeGeometry.filter((_, i) => i % 10 === 0).map((point, idx) => (
              <Circle
                key={`buffer-${idx}`}
                center={point}
                radius={convoy.allowedDeviationMeters}
                pathOptions={{
                  color: '#22c55e',
                  fillColor: '#22c55e',
                  fillOpacity: 0.05,
                  weight: 1,
                  opacity: 0.3,
                }}
              />
            ))}
            
            {/* Member Markers */}
            {memberList.map((member) => {
              if (!member.lastGPS) return null;
              
              const position: [number, number] = [member.lastGPS.latitude, member.lastGPS.longitude];
              const distanceFromRoute = member.distanceFromRoute || 0;
              
              let color = '#22c55e'; // green - on route
              if (member.currentStatus === 'warning') {
                color = '#eab308'; // yellow
              } else if (member.currentStatus === 'off_route_alert') {
                color = '#ef4444'; // red
              }
              
              return (
                <CircleMarker
                  key={member.id}
                  center={position}
                  radius={8}
                  pathOptions={{
                    fillColor: color,
                    color: '#ffffff',
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.8,
                  }}
                >
                  <Tooltip permanent direction="top" offset={[0, -10]}>
                    <div className="text-xs">
                      <div className="font-bold">{member.name}</div>
                      <div>{distanceFromRoute.toFixed(1)}m from route</div>
                    </div>
                  </Tooltip>
                </CircleMarker>
              );
            })}
            
            {/* Incident Markers */}
            {convoyIncidents.map((incident) => (
              <CircleMarker
                key={incident.id}
                center={[incident.latitude, incident.longitude]}
                radius={12}
                pathOptions={{
                  fillColor: incident.status === 'cleared' ? '#22c55e' : '#ef4444',
                  color: '#ffffff',
                  weight: 2,
                  opacity: 1,
                  fillOpacity: 0.6,
                }}
                eventHandlers={{
                  click: () => setSelectedIncident(incident),
                }}
              >
                <Tooltip>
                  <div className="text-xs">
                    <div className="font-bold">Incident</div>
                    <div>{incident.distanceFromRoute.toFixed(1)}m off-route</div>
                    <div className="text-gray-500">{incident.status}</div>
                  </div>
                </Tooltip>
              </CircleMarker>
            ))}
          </MapContainer>
          
          {/* Map Legend */}
          <div className="absolute top-4 right-4 bg-gray-800/95 rounded-lg p-4 border border-gray-700 z-[1000]">
            <h3 className="font-bold mb-2 text-sm">Status Legend</h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span>On Route</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <span>Warning Zone</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span>Off Route - Alert</span>
              </div>
            </div>
          </div>
        </div>

        {/* Incident Panel */}
        <div className="w-96 bg-gray-800 border-l border-gray-700 flex flex-col">
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-lg font-bold">Active Incidents ({pendingIncidents.length})</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {pendingIncidents.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <CheckCircle className="w-12 h-12 mx-auto mb-2" />
                <p>No active incidents</p>
                <p className="text-xs mt-1">All vehicles on route</p>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                {pendingIncidents.map((incident) => {
                  const member = members.get(incident.memberId);
                  
                  return (
                    <div
                      key={incident.id}
                      className={`bg-gray-700 rounded-lg p-4 border-2 ${
                        incident.status === 'pending' ? 'border-red-500' :
                        incident.status === 'acknowledged' ? 'border-yellow-500' :
                        'border-green-500'
                      }`}
                      data-testid={`card-incident-${incident.id}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-bold flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-400" />
                            {member?.name || 'Unknown Vehicle'}
                          </h3>
                          <p className="text-sm text-gray-400">{member?.vehicleId}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          incident.status === 'pending' ? 'bg-red-900 text-red-300' :
                          incident.status === 'acknowledged' ? 'bg-yellow-900 text-yellow-300' :
                          'bg-green-900 text-green-300'
                        }`}>
                          {incident.status.toUpperCase()}
                        </span>
                      </div>

                      <div className="space-y-2 text-sm mb-4">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span className="text-red-400 font-medium">
                            {incident.distanceFromRoute.toFixed(1)}m off-route
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-300">
                            {incident.persistenceDuration}s duration
                          </span>
                        </div>
                        <div className="text-xs text-gray-400">
                          {new Date(incident.detectedAt).toLocaleString()}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {incident.status === 'pending' && (
                          <button
                            onClick={() => handleAcknowledgeIncident(incident)}
                            className="flex-1 px-3 py-2 bg-yellow-600 hover:bg-yellow-700 rounded text-sm font-medium flex items-center justify-center gap-2"
                            data-testid={`button-ack-${incident.id}`}
                          >
                            <CheckCircle className="w-4 h-4" />
                            Acknowledge
                          </button>
                        )}
                        {(incident.status === 'pending' || incident.status === 'acknowledged') && (
                          <button
                            onClick={() => handleClearIncident(incident)}
                            className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-sm font-medium flex items-center justify-center gap-2"
                            data-testid={`button-clear-${incident.id}`}
                          >
                            <XCircle className="w-4 h-4" />
                            Clear
                          </button>
                        )}
                        {member?.phoneNumber && (
                          <a
                            href={`tel:${member.phoneNumber}`}
                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm flex items-center gap-2"
                            data-testid={`button-call-${incident.id}`}
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}