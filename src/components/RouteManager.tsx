import React, { useEffect, useState, lazy, Suspense } from 'react';
import { Route as RouteIcon, Plus, Edit, Trash2, Eye, EyeOff, Download, Map as MapIcon, Navigation, Car, Upload, ChevronDown, ChevronUp, MapPin, Compass } from 'lucide-react';
import { toast } from 'sonner';
import { useRef } from 'react';
import { useSurveyStore } from '../lib/survey';
import { Route, getRoutesBySurvey, deleteRoute, getDirectionsUrl } from '../lib/utils/routeUtils';
import { exportRouteToGeoJSON } from '../lib/utils/exportUtils';
import RouteEditor from './RouteEditor';

const RouteNavigator = lazy(() => import('./RouteNavigator'));
const SurveyRouteNavigator = lazy(() => import('./SurveyRouteNavigator'));

interface RouteManagerProps {
  onSelectRoute?: (route: Route) => void;
  onShowRoute?: (route: Route) => void;
  onHideRoute?: (routeId: string) => void;
  onNavigateToStart?: (route: Route) => void;
  onClose?: () => void;
}

const RouteManager: React.FC<RouteManagerProps> = ({
  onSelectRoute,
  onClose,
  onShowRoute,
  onHideRoute,
  onNavigateToStart
}) => {
  const { activeSurvey } = useSurveyStore();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [showRouteEditor, setShowRouteEditor] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<Route | undefined>(undefined);
  const [visibleRoutes, setVisibleRoutes] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [navigatingRoute, setNavigatingRoute] = useState<Route | null>(null);
  const [surveyNavRoute, setSurveyNavRoute] = useState<Route | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load routes when active survey changes
  useEffect(() => {
    if (activeSurvey) {
      loadRoutes();
    } else {
      setRoutes([]);
    }
  }, [activeSurvey]);

  const loadRoutes = async () => {
    if (!activeSurvey) return;
    
    setIsLoading(true);
    try {
      const surveyRoutes = await getRoutesBySurvey(activeSurvey.id);
      setRoutes(surveyRoutes);
      
      // Set all routes as visible by default
      const newVisibleRoutes = new Set<string>();
      surveyRoutes.forEach(route => newVisibleRoutes.add(route.id));
      setVisibleRoutes(newVisibleRoutes);
    } catch (error) {
      toast.error('Failed to load routes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateRoute = () => {
    setSelectedRoute(undefined);
    setShowRouteEditor(true);
  };

  const handleEditRoute = (route: Route) => {
    setSelectedRoute(route);
    setShowRouteEditor(true);
  };

  const handleDeleteRoute = async (routeId: string) => {
    if (confirm('Are you sure you want to delete this route?')) {
      try {
        await deleteRoute(routeId);
        setRoutes(prev => prev.filter(r => r.id !== routeId));
        
        // Remove from visible routes if it was visible
        if (visibleRoutes.has(routeId)) {
          const newVisibleRoutes = new Set(visibleRoutes);
          newVisibleRoutes.delete(routeId);
          setVisibleRoutes(newVisibleRoutes);
          
          if (onHideRoute) {
            onHideRoute(routeId);
          }
        }
      } catch (error) {
        toast.error('Failed to delete route');
      }
    }
  };

  const handleToggleRouteVisibility = (route: Route) => {
    const newVisibleRoutes = new Set(visibleRoutes);
    
    if (visibleRoutes.has(route.id)) {
      newVisibleRoutes.delete(route.id);
      setVisibleRoutes(newVisibleRoutes);
      
      if (onHideRoute) {
        onHideRoute(route.id);
      }
    } else {
      newVisibleRoutes.add(route.id);
      setVisibleRoutes(newVisibleRoutes);
      
      if (onShowRoute) {
        onShowRoute(route);
      }
    }
  };

  const handleExportRoute = (route: Route) => {
    try {
      const geoJson = exportRouteToGeoJSON(route);
      
      // Create and download file
      const blob = new Blob([geoJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${route.name.replace(/\s+/g, '_')}.geojson`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      // toast suppressed
    } catch (error) {
      toast.error('Failed to export route');
    }
  };

  const handleRouteCreated = (route: Route) => {
    setRoutes(prev => [...prev, route]);
    
    // Make new route visible
    const newVisibleRoutes = new Set(visibleRoutes);
    newVisibleRoutes.add(route.id);
    setVisibleRoutes(newVisibleRoutes);
    
    if (onShowRoute) {
      onShowRoute(route);
    }
    
    // Refresh routes from database immediately
    loadRoutes();
  };

  const handleRouteUpdated = (route: Route) => {
    setRoutes(prev => prev.map(r => r.id === route.id ? route : r));
    
    // If route is visible, update it on the map
    if (visibleRoutes.has(route.id) && onShowRoute) {
      onShowRoute(route);
    }
    
    // Refresh routes from database immediately
    loadRoutes();
  };

  const handleStartNavigation = (route: Route) => {
    setNavigatingRoute(route);
  };

  const handleStopNavigation = () => {
    setNavigatingRoute(null);
  };

  const handleImportRoute = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!activeSurvey) {
      toast.error('No active survey');
      return;
    }
    
    try {
      let text: string;
      const fileName = file.name.toLowerCase();
      
      // Handle KMZ (compressed KML)
      if (fileName.endsWith('.kmz')) {
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(file);
        
        // Find the KML file inside the KMZ
        const kmlFile = Object.keys(zipContent.files).find(name => name.toLowerCase().endsWith('.kml'));
        if (!kmlFile) {
          toast.error('No KML file found in KMZ archive');
          return;
        }
        
        text = await zipContent.files[kmlFile].async('text');
      } else {
        text = await file.text();
      }
      
      let route: Route | null = null;
      
      if (fileName.endsWith('.gpx')) {
        const { importRouteFromGPX } = await import('../lib/utils/routeUtils');
        route = await importRouteFromGPX(text, activeSurvey.id);
      } else if (fileName.endsWith('.kml') || fileName.endsWith('.kmz')) {
        const { importRouteFromKML } = await import('../lib/utils/routeUtils');
        route = await importRouteFromKML(text, activeSurvey.id);
      } else {
        const { importRouteFromGeoJSON } = await import('../lib/utils/routeUtils');
        route = await importRouteFromGeoJSON(text, activeSurvey.id);
      }
      
      if (route) {
        setRoutes(prev => [...prev, route]);
        
        // Make imported route visible
        const newVisibleRoutes = new Set(visibleRoutes);
        newVisibleRoutes.add(route.id);
        setVisibleRoutes(newVisibleRoutes);
        
        if (onShowRoute) {
          onShowRoute(route);
        }
        
        // toast suppressed
      }
    } catch (error) {
      toast.error('Failed to import route');
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Listen for navigation events from other components
  useEffect(() => {
    const handleNavigateRoute = (event: CustomEvent) => {
      const { routeId } = event.detail;
      const route = routes.find(r => r.id === routeId);
      if (route) {
        handleStartNavigation(route);
      }
    };

    window.addEventListener('navigate-route', handleNavigateRoute as EventListener);
    return () => {
      window.removeEventListener('navigate-route', handleNavigateRoute as EventListener);
    };
  }, [routes]);

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 hover:text-blue-400 transition-colors"
          data-testid="button-toggle-route-manager"
        >
          <RouteIcon className="w-5 h-5 text-blue-400" />
          <h2 className="text-xl font-semibold">Route Manager</h2>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileImport}
            accept=".gpx,.kml,.kmz,.json,.geojson"
            className="hidden"
          />
          <button
            onClick={handleImportRoute}
            className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-sm"
            disabled={!activeSurvey}
            data-testid="button-import-route"
            title="Import route from GPX, KML, KMZ, or GeoJSON file"
          >
            <Upload className="w-4 h-4" />
            Import Route
          </button>
          <button
            onClick={handleCreateRoute}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
            disabled={!activeSurvey}
            data-testid="button-create-route"
          >
            <Plus className="w-4 h-4" />
            Create Route
          </button>
          {onClose && (
            <button
              onClick={onClose}
              data-testid="button-close-route-manager"
              className="ml-1 p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Close"
            >
              ✕
            </button>
          )}
        </div>
      </div>
      
      {isExpanded && (
        <div>
      
      {!activeSurvey ? (
        <div className="bg-yellow-500/20 border-l-4 border-yellow-500 p-4 rounded">
          <p className="text-yellow-500">Please create or select a survey to manage routes</p>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin h-8 w-8 border-t-2 border-b-2 border-blue-500 rounded-full"></div>
        </div>
      ) : routes.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <MapIcon className="w-12 h-12 mx-auto mb-4 text-gray-500" />
          <p>No routes created yet</p>
          <button
            onClick={handleCreateRoute}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
          >
            Create Your First Route
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {routes.map(route => (
            <div key={route.id} className="bg-gray-700 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: route.color }}
                  />
                  <h3 className="font-medium">{route.name}</h3>
                  <span className="text-xs text-gray-400">
                    {route.points.length} points {route.routeGeometry ? `• ${route.routeGeometry.length} road segments` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleRouteVisibility(route)}
                    className={`p-1.5 rounded ${
                      visibleRoutes.has(route.id) 
                        ? 'bg-blue-600 hover:bg-blue-700' 
                        : 'bg-gray-600 hover:bg-gray-500'
                    }`}
                    title={visibleRoutes.has(route.id) ? 'Hide Route' : 'Show Route'}
                  >
                    {visibleRoutes.has(route.id) ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => onNavigateToStart?.(route)}
                    className="p-1.5 bg-green-600 hover:bg-green-700 rounded"
                    title="Navigate to Start Point"
                    data-testid={`button-navigate-start-${route.id}`}
                  >
                    <MapPin className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      const url = getDirectionsUrl(route.points);
                      window.open(url, '_blank');
                    }}
                    className="p-1.5 bg-gray-600 hover:bg-gray-500 rounded"
                    title="Get Driving Directions"
                  >
                    <Car className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      handleStartNavigation(route);
                    }}
                    className="p-1.5 bg-green-600 hover:bg-green-700 rounded"
                    title="Navigate This Route"
                    data-testid={`button-navigate-route-${route.id}`}
                  >
                    <Navigation className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setSurveyNavRoute(route)}
                    className="p-1.5 bg-teal-600 hover:bg-teal-700 rounded"
                    title="Survey Navigation (locked route)"
                    data-testid={`button-survey-nav-${route.id}`}
                  >
                    <Compass className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleEditRoute(route)}
                    className="p-1.5 bg-gray-600 hover:bg-gray-500 rounded"
                    title="Edit Route"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleExportRoute(route)}
                    className="p-1.5 bg-gray-600 hover:bg-gray-500 rounded"
                    title="Export Route"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteRoute(route.id)}
                    className="p-1.5 bg-red-600 hover:bg-red-700 rounded"
                    title="Delete Route"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {route.description && (
                <p className="mt-2 text-sm text-gray-400">{route.description}</p>
              )}
              
              <div className="mt-3 text-xs text-gray-500">
                Created: {new Date(route.createdAt).toLocaleString()}
                {route.updatedAt !== route.createdAt && (
                  <span> • Updated: {new Date(route.updatedAt).toLocaleString()}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
        </div>
      )}
      
      <RouteEditor
        isOpen={showRouteEditor}
        onClose={() => setShowRouteEditor(false)}
        initialRoute={selectedRoute}
        onRouteCreated={handleRouteCreated}
        onRouteUpdated={handleRouteUpdated}
      />
      
      {navigatingRoute && (
        <Suspense fallback={<div className="flex justify-center py-8"><div className="animate-spin h-8 w-8 border-t-2 border-b-2 border-blue-500 rounded-full"></div></div>}>
          <RouteNavigator
            route={navigatingRoute}
            onClose={handleStopNavigation}
          />
        </Suspense>
      )}

      {surveyNavRoute && (
        <Suspense fallback={<div className="flex justify-center py-8"><div className="animate-spin h-8 w-8 border-t-2 border-b-2 border-teal-500 rounded-full"></div></div>}>
          <SurveyRouteNavigator
            route={surveyNavRoute}
            onClose={() => setSurveyNavRoute(null)}
          />
        </Suspense>
      )}
    </div>
  );
};

export default RouteManager;