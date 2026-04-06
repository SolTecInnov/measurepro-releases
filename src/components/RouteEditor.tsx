import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, MapPin, Navigation, Flag, Save, Upload, Download, Route as RouteIcon, Trash2, Car } from 'lucide-react';
import { toast } from 'sonner';
import { useSurveyStore } from '../lib/survey';
import { Route, RoutePoint, saveRoute, updateRoute, deleteRoute, importRouteFromGeoJSON, exportRouteToGeoJSON, optimizeRoute, getDirections, getDirectionsUrl } from '../lib/utils/routeUtils';
import { useGPSStore } from '../lib/stores/gpsStore';
import { createPortal } from 'react-dom';

interface RouteEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onRouteCreated?: (route: Route) => void;
  onRouteUpdated?: (route: Route) => void;
  initialRoute?: Route;
  onAddPoint?: (type: 'origin' | 'waypoint' | 'destination') => void;
  position?: 'side' | 'modal';
}

const RouteEditor: React.FC<RouteEditorProps> = ({
  isOpen,
  onClose,
  onRouteCreated,
  onRouteUpdated,
  initialRoute,
  onAddPoint,
  position = 'modal'
}) => {
  const { activeSurvey } = useSurveyStore();
  const { data: gpsData } = useGPSStore();
  const [routeName, setRouteName] = useState('');
  const [routeDescription, setRouteDescription] = useState('');
  const [routeColor, setRouteColor] = useState('#3b82f6');
  const [points, setPoints] = useState<RoutePoint[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [routeId, setRouteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State for route calculation status
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [drivingDirectionsUrl, setDrivingDirectionsUrl] = useState<string | null>(null);

  // Initialize form with initial route if provided
  useEffect(() => {
    if (initialRoute) {
      // Check if we're returning from point selection
      const savedState = localStorage.getItem('route_editor_state');
      if (savedState) {
        const state = JSON.parse(savedState);
        setRouteName(state.name);
        setRouteDescription(state.description);
        setRouteColor(state.color);
        setPoints(initialRoute.points); // Use the updated points from initialRoute
        setIsEditing(state.isEditing);
        setRouteId(state.routeId);
        
        // Clear saved state
        localStorage.removeItem('route_editor_state');
      } else {
        // Normal initialization
        setRouteName(initialRoute.name);
        setRouteDescription(initialRoute.description || '');
        setRouteColor(initialRoute.color);
        setPoints(initialRoute.points);
        setIsEditing(initialRoute.id ? true : false);
        setRouteId(initialRoute.id || null);
      }
      
      // Save to localStorage for persistence
      localStorage.setItem('temp_route_name', initialRoute.name);
      localStorage.setItem('temp_route_description', initialRoute.description || '');
      localStorage.setItem('temp_route_color', initialRoute.color);
      localStorage.setItem('temp_route_points', JSON.stringify(initialRoute.points));
    } else {
      resetForm();
    }
  }, [initialRoute, isOpen]);

  const resetForm = () => {
    setRouteName('');
    setRouteDescription('');
    setRouteColor('#3b82f6');
    setPoints([]);
    setIsEditing(false);
    setRouteId(null);
    
    // Clear localStorage
    localStorage.removeItem('temp_route_name');
    localStorage.removeItem('temp_route_description');
    localStorage.removeItem('temp_route_color');
    localStorage.removeItem('temp_route_points');
  };

  const handleAddPointRequest = (type: 'origin' | 'waypoint' | 'destination') => {
    // Call the parent component's onAddPoint function to handle map point selection
    if (onAddPoint) {
      // Save current form state to localStorage before closing
      localStorage.setItem('temp_route_name', routeName);
      localStorage.setItem('temp_route_description', routeDescription);
      localStorage.setItem('temp_route_color', routeColor);
      localStorage.setItem('temp_route_points', JSON.stringify(points));
      
      // Save current form state before closing
      localStorage.setItem('route_editor_state', JSON.stringify({
        name: routeName,
        description: routeDescription,
        color: routeColor,
        isEditing,
        routeId
      }));
      
      onAddPoint(type);
      onClose(); // Hide the modal while user selects a point on the map
    } else {
      // Fallback to using current GPS position if available
      if (gpsData.latitude !== 0 && gpsData.longitude !== 0) {
        addPointAtPosition([gpsData.latitude, gpsData.longitude], type);
        toast.success(`Added ${type} at current position`);
      } else {
        toast.error('No GPS position available');
      }
    }
  };
  
  // Function to add a point at a specific position
  const addPointAtPosition = (position: [number, number], type: 'origin' | 'waypoint' | 'destination') => {
    const newPoint: RoutePoint = {
      id: crypto.randomUUID(),
      position,
      type,
      order: points.length
    };
    
    setPoints(prev => [...prev, newPoint]);
  };

  const handleRemovePoint = (id: string) => {
    setPoints(prev => {
      const filtered = prev.filter(p => p.id !== id);
      // Update order of remaining points
      return filtered.map((p, idx) => ({ ...p, order: idx }));
    });
  };

  const handleMovePoint = (id: string, direction: 'up' | 'down') => {
    setPoints(prev => {
      const index = prev.findIndex(p => p.id === id);
      if (index === -1) return prev;
      
      // Can't move origin up or destination down
      if ((prev[index].type === 'origin' && direction === 'up') ||
          (prev[index].type === 'destination' && direction === 'down')) {
        return prev;
      }
      
      const newPoints = [...prev];
      
      if (direction === 'up' && index > 0) {
        // Swap with previous point
        const temp = { ...newPoints[index - 1], order: index };
        newPoints[index - 1] = { ...newPoints[index], order: index - 1 };
        newPoints[index] = temp;
      } else if (direction === 'down' && index < newPoints.length - 1) {
        // Swap with next point
        const temp = { ...newPoints[index + 1], order: index };
        newPoints[index + 1] = { ...newPoints[index], order: index + 1 };
        newPoints[index] = temp;
      }
      
      return newPoints.sort((a, b) => a.order - b.order);
    });
  };

  const handleSaveRoute = async () => {
    if (!activeSurvey) {
      toast.error('No active survey');
      return;
    }
    
    if (!routeName) {
      toast.error('Route name is required');
      return;
    }
    
    // Check if route has both origin and destination
    const hasOrigin = points.some(p => p.type === 'origin');
    const hasDestination = points.some(p => p.type === 'destination');
    
    if (!hasOrigin || !hasDestination) {
      toast.error('Route must have both an origin and destination point');
      return;
    }
    
    try {
      setIsCalculatingRoute(true);
      
      // Generate driving directions URL
      const directionsUrl = getDirectionsUrl(points);
      setDrivingDirectionsUrl(directionsUrl);
      
      try {
        if (isEditing && routeId) {
          // Update existing route
          const updatedRoute: Route = {
            id: routeId,
            name: routeName,
            description: routeDescription,
            points,
            color: routeColor,
            createdAt: initialRoute!.createdAt,
            updatedAt: new Date().toISOString(),
            surveyId: activeSurvey.id
          };
          
          const result = await updateRoute(updatedRoute);
          
          if (onRouteUpdated) {
            onRouteUpdated(result);
          }
          
          toast.success('Route updated successfully', {
            id: 'route-calculation'
          });
        } else {
          // Create new route
          const newRoute = {
            name: routeName,
            description: routeDescription,
            points,
            color: routeColor,
            surveyId: activeSurvey.id
          };
          
          const result = await saveRoute(newRoute);
          
          if (onRouteCreated) {
            onRouteCreated(result);
          }
          
          toast.success('Route created successfully');
        }
      } catch (error) {
        toast.error('Failed to save route');
        return; // Don't close the dialog if save failed
      }
      
      onClose();
      resetForm();
      
      // Clear localStorage
      localStorage.removeItem('temp_route_name');
      localStorage.removeItem('temp_route_description');
      localStorage.removeItem('temp_route_color');
      localStorage.removeItem('temp_route_points');
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  const handleImportRoute = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      
      if (!activeSurvey) {
        toast.error('No active survey');
        return;
      }
      
      let route: Route | null = null;
      
      if (file.name.toLowerCase().endsWith('.gpx')) {
        const { importRouteFromGPX } = await import('../lib/utils/routeUtils');
        route = await importRouteFromGPX(text, activeSurvey.id);
      } else {
        route = await importRouteFromGeoJSON(text, activeSurvey.id);
      }
      
      if (route) {
        setRouteName(route.name);
        setRouteDescription(route.description || '');
        setRouteColor(route.color);
        setPoints(route.points);
        setIsEditing(true);
        setRouteId(route.id);
        
        toast.success('Route imported successfully');
      }
    } catch (error) {
      toast.error('Failed to import route');
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleExportRoute = () => {
    if (!routeId && points.length < 2) {
      toast.error('No valid route to export');
      return;
    }
    
    try {
      const route: Route = {
        id: routeId || crypto.randomUUID(),
        name: routeName,
        description: routeDescription,
        points,
        color: routeColor,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        surveyId: activeSurvey?.id || ''
      };
      
      const geoJson = exportRouteToGeoJSON(route);
      
      // Create and download file
      const blob = new Blob([geoJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${routeName.replace(/\s+/g, '_')}.geojson`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('Route exported successfully');
    } catch (error) {
      toast.error('Failed to export route');
    }
  };

  const handleOptimizeRoute = () => {
    if (points.length < 3) {
      toast.error('Route must have at least one waypoint to optimize');
      return;
    }
    
    try {
      const route: Route = {
        id: routeId || crypto.randomUUID(),
        name: routeName,
        description: routeDescription,
        points,
        color: routeColor,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        surveyId: activeSurvey?.id || ''
      };
      
      const optimized = optimizeRoute(route);
      
      setPoints(optimized.points);
      
      toast.success('Route optimized successfully');
    } catch (error) {
      toast.error('Failed to optimize route');
    }
  };

  if (!isOpen) return null;

  // Create the content of the editor
  const editorContent = (
    <>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <RouteIcon className="w-5 h-5 text-blue-400" />
            {isEditing ? 'Edit Route' : 'Create New Route'}
          </h2>
          <button
            onClick={() => {
              onClose();
              resetForm();
            }}
            className="text-gray-400 hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Route Name
            </label>
            <input
              type="text"
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
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
              value={routeDescription}
              onChange={(e) => setRouteDescription(e.target.value)}
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
                value={routeColor}
                onChange={(e) => setRouteColor(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded h-10 w-10"
              />
              <input
                type="text"
                value={routeColor}
                onChange={(e) => setRouteColor(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="#3b82f6"
              />
            </div>
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-300">
                Route Points
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleAddPointRequest('origin')}
                  className="flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs"
                  disabled={points.some(p => p.type === 'origin')}
                >
                  <MapPin className="w-3 h-3" />
                  Add Origin
                </button>
                <button
                  onClick={() => handleAddPointRequest('waypoint')}
                  className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                >
                  <Navigation className="w-3 h-3" />
                  Add Waypoint
                </button>
                <button
                  onClick={() => handleAddPointRequest('destination')}
                  className="flex items-center gap-1 px-2 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs"
                  disabled={points.some(p => p.type === 'destination')}
                >
                  <Flag className="w-3 h-3" />
                  Add Destination
                </button>
              </div>
            </div>
            
            <div className="bg-gray-700 rounded-lg p-2 max-h-60 overflow-y-auto">
              {points.length === 0 ? (
                <div className="text-center py-4 text-gray-400">
                  No points added yet. Add an origin point to start.
                </div>
              ) : (
                <div className="space-y-2">
                  {points.sort((a, b) => a.order - b.order).map((point) => (
                    <div key={point.id} className="flex items-center justify-between bg-gray-800 p-2 rounded">
                      <div className="flex items-center gap-2 cursor-grab" draggable={point.type === 'waypoint'} onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', point.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}>
                        {point.type === 'origin' && <MapPin className="w-4 h-4 text-green-400" />}
                        {point.type === 'waypoint' && <Navigation className="w-4 h-4 text-blue-400" />}
                        {point.type === 'destination' && <Flag className="w-4 h-4 text-purple-400" />}
                        <span className="capitalize">{point.type}</span>
                        <span className="text-xs text-gray-400">
                          ({point.position[0].toFixed(6)}, {point.position[1].toFixed(6)})
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleMovePoint(point.id, 'up')}
                          className="p-1 hover:bg-gray-700 rounded"
                          disabled={point.order === 0 || point.type === 'origin'}
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => handleMovePoint(point.id, 'down')}
                          className="p-1 hover:bg-gray-700 rounded"
                          disabled={point.order === points.length - 1 || point.type === 'destination'}
                        >
                          ↓
                        </button>
                        <button
                          onClick={() => handleRemovePoint(point.id)}
                          className="p-1 hover:bg-gray-700 rounded text-red-400"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Drag and Drop Instructions */}
            {points.some(p => p.type === 'waypoint') && (
              <div className="mt-2 bg-gray-700 p-2 rounded-lg text-xs text-gray-300">
                <p>💡 Tip: You can drag and drop waypoints to reorder them.</p>
              </div>
            )}
          </div>
          
          <div className="flex justify-between pt-4 border-t border-gray-700">
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileImport}
                accept=".json,.geojson"
                className="hidden"
              />
              <button
                onClick={handleImportRoute}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
              >
                <Upload className="w-4 h-4" />
                Import
              </button>
              <button
                onClick={handleExportRoute}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
                disabled={points.length < 2}
              >
                <Download className="w-4 h-4" />
                Export
              </button>
              <button
                onClick={handleOptimizeRoute}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
                disabled={points.length < 3}
              >
                <RouteIcon className="w-4 h-4" />
                Optimize
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  onClose();
                  resetForm();
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRoute}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm"
                disabled={!routeName || points.length < 2 || isCalculatingRoute}
              >
                <Save className="w-4 h-4 mr-1 inline-block" />
                {isCalculatingRoute ? 'Calculating...' : isEditing ? 'Update Route' : 'Save Route'}
              </button>
            </div>
          </div>
        </div>
    </>
  );

  // Render as a side panel or modal based on position prop
  if (position === 'side') {
    return (
      <div className="absolute top-0 right-0 h-full w-96 bg-gray-800 shadow-lg z-40 p-6 overflow-y-auto">
        {editorContent}
      </div>
    );
  }

  // Use createPortal to render the modal outside of the map container
  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] overflow-y-auto py-8">
      <div 
        className="bg-gray-800 rounded-xl w-full max-w-3xl p-6 mx-4 my-auto"
        onClick={(e) => e.stopPropagation()} // Prevent clicks from propagating to map
      >
        {editorContent}
      </div>
    </div>,
    // Render at the document body level to ensure it's outside the map container
    document.body
  );
};

export default RouteEditor;