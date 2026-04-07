import React, { useState, useEffect } from 'react';
import { X, MapPin, Navigation, Flag, Save, Plus, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';

interface RoutePoint {
  id: string;
  position: [number, number];
  type: 'origin' | 'waypoint' | 'destination';
  name?: string;
  order: number;
}

interface RouteCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  tempRoute: {
    name: string;
    description: string;
    color: string;
    points: RoutePoint[];
    routeGeometry?: [number, number][];
  };
  setTempRoute: (route: any) => void;
  routeCreationMode: 'origin' | 'waypoint' | 'destination' | null;
  setRouteCreationMode: (mode: 'origin' | 'waypoint' | 'destination' | null) => void;
  onSaveRoute: () => void;
}

const RouteCreator: React.FC<RouteCreatorProps> = ({
  isOpen,
  onClose,
  tempRoute,
  setTempRoute,
  routeCreationMode,
  setRouteCreationMode,
  onSaveRoute
}) => {
  const [addressSearch, setAddressSearch] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Geocode address using Google Maps Geocoding API
  const geocodeAddress = async (address: string, pointType: 'origin' | 'waypoint' | 'destination') => {
    if (!address.trim()) {
      toast.error('Please enter an address');
      return;
    }

    setIsGeocoding(true);
    
    try {
      // Use Google Maps Geocoding API
      const apiKey = localStorage.getItem('map_api_key_google') || import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      
      if (!apiKey || apiKey === 'your_google_maps_api_key') {
        toast.error('Google Maps API key required for address search');
        setIsGeocoding(false);
        return;
      }

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
      );
      
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        const location = data.results[0].geometry.location;
        const newPoint: RoutePoint = {
          id: Date.now().toString(),
          position: [location.lat, location.lng],
          type: pointType,
          name: data.results[0].formatted_address,
          order: tempRoute.points.length
        };
        
        setTempRoute(prev => ({
          ...prev,
          points: [...prev.points, newPoint]
        }));
        
        setAddressSearch('');
        // toast suppressed
      } else {
        toast.error('Address not found. Please try a different address.');
      }
    } catch (error) {
      toast.error('Failed to find address. Please try again.');
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleRemovePoint = (pointId: string) => {
    setTempRoute(prev => ({
      ...prev,
      points: prev.points.filter(p => p.id !== pointId)
    }));
  };

  useEffect(() => {
    const calculateRouteGeometry = async () => {
      if (tempRoute.points.length < 2) return;
      
      try {
        // Import getDirections from routeUtils to calculate road-based route
        const { getDirections } = await import('../lib/utils/routeUtils');
          
        // Sort points by order and type
        const sortedPoints = [...tempRoute.points].sort((a, b) => {
          const typeOrder = { origin: 0, waypoint: 1, destination: 2 };
          return typeOrder[a.type] - typeOrder[b.type] || a.order - b.order;
        });
        
        const positions = sortedPoints.map(point => point.position);
        
        // Calculate road-following route using Google Maps or OSRM
        const routeGeometry = await getDirections(positions);
        
        if (routeGeometry && routeGeometry.length > 1) {
          setTempRoute(prev => ({
            ...prev,
            routeGeometry
          }));
        } else {
          // Fallback to straight lines if routing fails
          setTempRoute(prev => ({
            ...prev,
            routeGeometry: positions
          }));
        }
      } catch (error) {
        // Keep using straight lines if route calculation fails
        const sortedPoints = [...tempRoute.points].sort((a, b) => {
          const typeOrder = { origin: 0, waypoint: 1, destination: 2 };
          return typeOrder[a.type] - typeOrder[b.type] || a.order - b.order;
        });
        setTempRoute(prev => ({
          ...prev,
          routeGeometry: sortedPoints.map(point => point.position)
        }));
      }
    };
    
    // Only calculate if we have at least origin and destination
    const hasOrigin = tempRoute.points.some(p => p.type === 'origin');
    const hasDestination = tempRoute.points.some(p => p.type === 'destination');
    
    if (hasOrigin && hasDestination) {
      calculateRouteGeometry();
    }
  }, [tempRoute.points, setTempRoute]);

  const handleSaveRoute = () => {
    if (!tempRoute.name.trim()) {
      toast.error('Please enter a route name');
      return;
    }

    const hasOrigin = tempRoute.points.some(p => p.type === 'origin');
    const hasDestination = tempRoute.points.some(p => p.type === 'destination');

    if (!hasOrigin || !hasDestination) {
      toast.error('Route must have both origin and destination');
      return;
    }

    onSaveRoute();
  };

  const getNextPointType = () => {
    const hasOrigin = tempRoute.points.some(p => p.type === 'origin');
    const hasDestination = tempRoute.points.some(p => p.type === 'destination');
    
    if (!hasOrigin) return 'origin';
    if (!hasDestination) return 'destination';
    return 'waypoint';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] overflow-y-auto py-8">
      <div className="bg-gray-800 rounded-xl w-full max-w-4xl p-6 mx-4 my-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Create New Route</h2>
          <button
            onClick={() => {
              setRouteCreationMode(null);
              onClose();
            }}
            className="text-gray-400 hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Left Column - Route Details */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Route Name *
              </label>
              <input
                type="text"
                value={tempRoute.name}
                onChange={(e) => setTempRoute(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Enter route name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={tempRoute.description}
                onChange={(e) => setTempRoute(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 h-24"
                placeholder="Enter route description"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Route Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={tempRoute.color}
                  onChange={(e) => setTempRoute(prev => ({ ...prev, color: e.target.value }))}
                  className="bg-gray-700 border border-gray-600 rounded h-10 w-10"
                />
                <input
                  type="text"
                  value={tempRoute.color}
                  onChange={(e) => setTempRoute(prev => ({ ...prev, color: e.target.value }))}
                  className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="#3b82f6"
                />
              </div>
            </div>

            {/* Address Search */}
            <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-400 mb-3">Add Point by Address</h3>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={addressSearch}
                    onChange={(e) => setAddressSearch(e.target.value)}
                    className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter address (e.g., 123 Main St, Montreal, QC)"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        const nextType = getNextPointType();
                        geocodeAddress(addressSearch, nextType);
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      const nextType = getNextPointType();
                      geocodeAddress(addressSearch, nextType);
                    }}
                    disabled={isGeocoding || !addressSearch.trim()}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-sm"
                  >
                    <Search className="w-4 h-4" />
                    {isGeocoding ? 'Searching...' : 'Add'}
                  </button>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setRouteCreationMode('origin');
                      // toast suppressed
                    }}
                    disabled={tempRoute.points.some(p => p.type === 'origin')}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-xs"
                  >
                    <MapPin className="w-3 h-3" />
                    Set Origin
                  </button>
                  <button
                    onClick={() => {
                      setRouteCreationMode('destination');
                      // toast suppressed
                    }}
                    disabled={tempRoute.points.some(p => p.type === 'destination')}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-xs"
                  >
                    <Flag className="w-3 h-3" />
                    Set Destination
                  </button>
                  <button
                    onClick={() => {
                      setRouteCreationMode('waypoint');
                      // toast suppressed
                    }}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                  >
                    <Navigation className="w-3 h-3" />
                    Add Waypoint
                  </button>
                </div>
                
                <div className="text-xs text-gray-400">
                  Current mode: {routeCreationMode ? (
                    <span className="text-blue-400 font-medium">
                      Click map to add {routeCreationMode}
                    </span>
                  ) : (
                    'Select a point type above'
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Route Points */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium mb-4">Route Points ({tempRoute.points.length})</h3>
              
              {tempRoute.points.length === 0 ? (
                <div className="text-center py-8 text-gray-400 bg-gray-700/50 rounded-lg">
                  <MapPin className="w-12 h-12 mx-auto mb-4 text-gray-500" />
                  <p className="text-lg font-medium mb-2">No points added yet</p>
                  <p>Click on the map or enter an address to add points</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {tempRoute.points
                    .sort((a, b) => {
                      // Sort by type priority: origin, waypoints, destination
                      const typeOrder = { origin: 0, waypoint: 1, destination: 2 };
                      return typeOrder[a.type] - typeOrder[b.type] || a.order - b.order;
                    })
                    .map((point, index) => (
                    <div key={point.id} className="bg-gray-700 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {point.type === 'origin' && <MapPin className="w-4 h-4 text-green-400" />}
                          {point.type === 'waypoint' && <Navigation className="w-4 h-4 text-blue-400" />}
                          {point.type === 'destination' && <Flag className="w-4 h-4 text-purple-400" />}
                          <div>
                            <div className="font-medium capitalize">{point.type}</div>
                            {point.name && (
                              <div className="text-sm text-gray-400 truncate max-w-[200px]">
                                {point.name}
                              </div>
                            )}
                            <div className="text-xs text-gray-500 font-mono">
                              {point.position[0].toFixed(6)}, {point.position[1].toFixed(6)}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemovePoint(point.id)}
                          className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Instructions */}
            <div className="bg-gray-700/50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-300 mb-2">How to Create Routes</h4>
              <ol className="space-y-2 text-sm text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="bg-green-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">1</span>
                  <span>Set origin point by clicking "Set Origin" then clicking on map, or enter an address</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-purple-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">2</span>
                  <span>Set destination point by clicking "Set Destination" then clicking on map, or enter an address</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">3</span>
                  <span>Add waypoints (optional) by clicking "Add Waypoint" then clicking on map</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-gray-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">4</span>
                  <span>Enter route name and save</span>
                </li>
              </ol>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-700">
          <div className="text-sm text-gray-400">
            {routeCreationMode && (
              <span>
                Click on the map to add <span className="text-blue-400 font-medium">{routeCreationMode}</span> point
              </span>
            )}
          </div>
          
          <div className="flex gap-4">
            <button
              onClick={() => {
                setRouteCreationMode(null);
                onClose();
              }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveRoute}
              disabled={!tempRoute.name.trim() || tempRoute.points.length < 2}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-sm"
            >
              <Save className="w-4 h-4" />
              Save Route
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RouteCreator;