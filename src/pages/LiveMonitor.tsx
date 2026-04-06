import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  Activity, 
  Users, 
  Image, 
  Download, 
  FileJson, 
  Package, 
  Filter, 
  Search, 
  ArrowLeft,
  Eye,
  Video,
  MapPin,
  Clock,
  User,
  CheckCircle,
  XCircle,
  Mail,
  QrCode,
  Radio,
  Wifi,
  WifiOff,
  RefreshCw,
  Laptop,
  Globe
} from 'lucide-react';
import { toast } from 'sonner';
import { getCurrentUser, isOnline } from '../lib/firebase';
import {
  lookupUserByEmail,
  subscribeToRemoteUser,
  fetchRemoteUserSnapshot
} from '../lib/firebase/liveMonitorService';
import { 
  exportMeasurementsToCSV, 
  exportMeasurementsToGeoJSON, 
  exportMeasurementsWithMedia 
} from '../lib/utils/exportUtils';
import { sendDataExportEmail, sendLiveMonitorQREmail } from '../lib/utils/emailUtils';
const VehicleMap = React.lazy(() => import('../components/VehicleMap'));
import { useMeasurementFeed } from '../hooks/useMeasurementFeed';
import type { Measurement } from '../lib/survey/types';

interface RemoteFeedData {
  userId: string;
  email: string;
  displayName: string;
  activeSurveyId: string | null;
  activeSurveyTitle: string | null;
  lastSeen: { seconds: number; nanoseconds: number };
  isOnline: boolean;
  measurementCount: number;
  lastLocation: { latitude: number; longitude: number } | null;
  measurements: Array<{
    id: string;
    rel: number | null;
    latitude: number;
    longitude: number;
    utcDate: string;
    utcTime: string;
    speed: number | null;
    heading: number | null;
    poi_type?: string;
    note: string | null;
    createdAt: string;
  }>;
}

const LiveMonitor = () => {
  // PERFORMANCE FIX: Use in-memory cache instead of IndexedDB queries
  const { getMeasurementsWithLimit } = useMeasurementFeed();
  const localMeasurements = getMeasurementsWithLimit(200);
  
  // Source mode: local or remote
  const [sourceMode, setSourceMode] = useState<'local' | 'remote'>('local');
  const [remoteMode, setRemoteMode] = useState<'live' | 'snapshot'>('live');
  const [remoteEmail, setRemoteEmail] = useState('');
  const [remoteUserId, setRemoteUserId] = useState<string | null>(null);
  const [remoteUserName, setRemoteUserName] = useState<string | null>(null);
  const [remoteFeedData, setRemoteFeedData] = useState<RemoteFeedData | null>(null);
  const [remoteConnectionStatus, setRemoteConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [lookingUpUser, setLookingUpUser] = useState(false);
  const [snapshotRefreshing, setSnapshotRefreshing] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const snapshotIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Convert remote measurements to local format
  const remoteMeasurements: Measurement[] = remoteFeedData?.measurements?.map(m => ({
    id: m.id,
    survey_id: remoteFeedData.activeSurveyId || '',
    user_id: remoteFeedData.userId,
    rel: m.rel ?? 0,
    latitude: m.latitude,
    longitude: m.longitude,
    altGPS: 0,
    utcDate: m.utcDate,
    utcTime: m.utcTime,
    speed: m.speed ?? 0,
    heading: m.heading ?? 0,
    source: 'remote',
    createdAt: m.createdAt,
    poi_type: m.poi_type,
    note: m.note
  })) || [];
  
  // Use local or remote measurements based on mode
  const measurements = sourceMode === 'local' ? localMeasurements : remoteMeasurements;
  
  const [filteredMeasurements, setFilteredMeasurements] = useState<Measurement[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connected');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(new Date());
  
  // Store current user for potential future use
  const _ = getCurrentUser();
  
  // Filters
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedPOIType, setSelectedPOIType] = useState<string>('all');
  const [searchText, setSearchText] = useState<string>('');
  const [maxResults, setMaxResults] = useState<number>(200);
  
  // Email and QR code dialogs
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState('admin@soltec.ca');
  const [exportFormat, setExportFormat] = useState<'csv' | 'json' | 'geojson'>('csv');
  const [sendingEmail, setSendingEmail] = useState(false);
  
  // Statistics computed from cache
  const stats = {
    totalMeasurements: measurements.length,
    uniqueUsers: new Set(measurements.map(m => m.user_id).filter(Boolean)).size,
    measurementsWithImages: measurements.filter(m => m.imageUrl).length,
    lastMeasurementTime: measurements.length > 0 ? new Date(measurements[0].createdAt) : null
  };

  // Get unique users from measurements (filter out undefined/null values)
  const uniqueUsers = Array.from(new Set(measurements.map(m => m.user_id).filter(Boolean)));
  
  // Get unique POI types from measurements
  const uniquePOITypes = Array.from(new Set(measurements.map(m => m.poi_type).filter(Boolean)));

  // Update last update time when measurements change
  useEffect(() => {
    if (measurements.length > 0) {
      setLastUpdate(new Date());
    }
  }, [measurements.length]);

  // Apply filters
  useEffect(() => {
    let filtered = [...measurements];

    // Filter by user
    if (selectedUser !== 'all') {
      filtered = filtered.filter(m => m.user_id === selectedUser);
    }

    // Filter by POI type
    if (selectedPOIType !== 'all') {
      filtered = filtered.filter(m => m.poi_type === selectedPOIType);
    }

    // Filter by search text
    if (searchText.trim()) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(m => 
        (m.note && m.note.toLowerCase().includes(search)) ||
        (m.poi_type && m.poi_type.toLowerCase().includes(search)) ||
        (m.roadNumber && m.roadNumber.toString().includes(search)) ||
        (m.poiNumber && m.poiNumber.toString().includes(search))
      );
    }

    // Limit results
    filtered = filtered.slice(0, maxResults);

    setFilteredMeasurements(filtered);
  }, [measurements, selectedUser, selectedPOIType, searchText, maxResults]);

  // Export functions
  const handleExportCSV = () => {
    if (filteredMeasurements.length === 0) {
      toast.error('No measurements to export');
      return;
    }
    
    const filename = `live-monitor-export-${new Date().toISOString().split('T')[0]}`;
    exportMeasurementsToCSV(filteredMeasurements, filename);
  };

  const handleExportGeoJSON = () => {
    if (filteredMeasurements.length === 0) {
      toast.error('No measurements to export');
      return;
    }
    
    const filename = `live-monitor-geojson-${new Date().toISOString().split('T')[0]}`;
    exportMeasurementsToGeoJSON(filteredMeasurements, filename);
  };

  const handleExportWithMedia = () => {
    if (filteredMeasurements.length === 0) {
      toast.error('No measurements to export');
      return;
    }
    
    const filename = `live-monitor-complete-${new Date().toISOString().split('T')[0]}`;
    exportMeasurementsWithMedia(filteredMeasurements, filename);
  };

  const handleEmailExport = async () => {
    if (filteredMeasurements.length === 0) {
      toast.error('No measurements to export');
      return;
    }

    setSendingEmail(true);
    try {
      // Generate export data based on selected format
      let fileContent = '';
      let fileName = `live-monitor-export-${new Date().toISOString().split('T')[0]}`;
      
      if (exportFormat === 'csv') {
        const headers = ['Date', 'Time', 'Height (m)', 'GPS Alt (m)', 'Latitude', 'Longitude', 'Speed (km/h)', 'Heading (°)', 'Road Number', 'POI Number', 'POI Type', 'Note', 'Source'].join(',');
        const rows = filteredMeasurements.map(m => [
          m.utcDate,
          m.utcTime,
          m.rel.toFixed(3),
          m.altGPS.toFixed(1),
          m.latitude.toFixed(6),
          m.longitude.toFixed(6),
          m.speed.toFixed(1),
          m.heading.toFixed(1),
          m.roadNumber || '',
          m.poiNumber || '',
          m.poi_type || '',
          (m.note || '').replace(/,/g, ';'),
          m.source || 'manual'
        ].join(','));
        fileContent = [headers, ...rows].join('\n');
        fileName += '.csv';
      } else if (exportFormat === 'json') {
        fileContent = JSON.stringify(filteredMeasurements, null, 2);
        fileName += '.json';
      } else if (exportFormat === 'geojson') {
        const features = filteredMeasurements.map(m => ({
          type: 'Feature',
          properties: {
            id: m.id,
            height: m.rel,
            altitude: m.altGPS,
            date: m.utcDate,
            time: m.utcTime,
            speed: m.speed,
            heading: m.heading,
            roadNumber: m.roadNumber,
            poiNumber: m.poiNumber,
            poiType: m.poi_type,
            note: m.note
          },
          geometry: {
            type: 'Point',
            coordinates: [m.longitude, m.latitude]
          }
        }));
        fileContent = JSON.stringify({ type: 'FeatureCollection', features }, null, 2);
        fileName += '.geojson';
      }

      const firstDate = filteredMeasurements[filteredMeasurements.length - 1]?.utcDate || new Date().toISOString().split('T')[0];
      const lastDate = filteredMeasurements[0]?.utcDate || new Date().toISOString().split('T')[0];

      await sendDataExportEmail(emailRecipient, {
        exportType: exportFormat,
        measurementCount: filteredMeasurements.length,
        dateRange: {
          from: firstDate,
          to: lastDate
        },
        filters: selectedUser !== 'all' ? { userId: selectedUser } : undefined,
        fileContent,
        fileName
      });

      setShowEmailDialog(false);
    } catch (error) {
    } finally {
      setSendingEmail(false);
    }
  };

  const handleQRCodeShare = async () => {
    setSendingEmail(true);
    try {
      const monitorUrl = window.location.href;
      await sendLiveMonitorQREmail(emailRecipient, {
        monitorUrl,
        senderName: 'MeasurePRO Admin',
        accessInstructions: 'Scan the QR code or click the link to access the live monitoring dashboard.'
      });
      setShowQRDialog(false);
    } catch (error) {
    } finally {
      setSendingEmail(false);
    }
  };

  // Remote connection handlers
  const handleConnectToRemote = async () => {
    if (!remoteEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    if (!isOnline()) {
      toast.error('Remote monitoring requires an internet connection');
      return;
    }

    setLookingUpUser(true);
    setRemoteConnectionStatus('connecting');

    try {
      const userInfo = await lookupUserByEmail(remoteEmail.trim());
      
      if (!userInfo) {
        toast.error('User not found or not sharing data');
        setRemoteConnectionStatus('error');
        setLookingUpUser(false);
        return;
      }

      setRemoteUserId(userInfo.userId);
      setRemoteUserName(userInfo.displayName);

      if (remoteMode === 'live') {
        const unsubscribe = subscribeToRemoteUser(
          userInfo.userId,
          (data) => {
            setRemoteFeedData(data as RemoteFeedData);
            setRemoteConnectionStatus('connected');
            setLastUpdate(new Date());
          },
          (error) => {
            toast.error(`Connection error: ${error.message}`);
            setRemoteConnectionStatus('error');
          }
        );
        unsubscribeRef.current = unsubscribe;
      } else {
        await refreshSnapshot(userInfo.userId);
        snapshotIntervalRef.current = setInterval(() => {
          refreshSnapshot(userInfo.userId);
        }, 15 * 60 * 1000);
      }

      toast.success(`Connected to ${userInfo.displayName}`);
    } catch (error) {
      toast.error('Failed to connect to remote user');
      setRemoteConnectionStatus('error');
    } finally {
      setLookingUpUser(false);
    }
  };

  const refreshSnapshot = async (userId: string) => {
    setSnapshotRefreshing(true);
    try {
      const data = await fetchRemoteUserSnapshot(userId);
      if (data) {
        setRemoteFeedData(data as RemoteFeedData);
        setRemoteConnectionStatus('connected');
        setLastUpdate(new Date());
      } else {
        toast.error('User not currently sharing data');
        setRemoteConnectionStatus('error');
      }
    } catch (error) {
      toast.error('Failed to fetch snapshot');
    } finally {
      setSnapshotRefreshing(false);
    }
  };

  const handleDisconnectRemote = () => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    if (snapshotIntervalRef.current) {
      clearInterval(snapshotIntervalRef.current);
      snapshotIntervalRef.current = null;
    }
    setRemoteFeedData(null);
    setRemoteUserId(null);
    setRemoteUserName(null);
    setRemoteConnectionStatus('disconnected');
    toast.success('Disconnected from remote user');
  };

  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      if (snapshotIntervalRef.current) {
        clearInterval(snapshotIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (sourceMode === 'local') {
      handleDisconnectRemote();
    }
  }, [sourceMode]);

  // Format POI ID
  const formatPOIId = (measurement: Measurement) => {
    if (measurement.roadNumber && measurement.poiNumber) {
      return `R${String(measurement.roadNumber).padStart(3, '0')}-${String(measurement.poiNumber).padStart(5, '0')}`;
    }
    if (measurement.id) {
      return measurement.id.substring(0, 8);
    }
    return 'N/A';
  };

  // Format user ID (show first 8 characters)
  const formatUserId = (userId: string | undefined | null) => {
    if (!userId) return 'Unknown';
    return userId.substring(0, 8);
  };


  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              to="/" 
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Main App
            </Link>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <Activity className="w-8 h-8 text-red-400" />
              Live Monitor
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Connection Status */}
            <div className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-500 animate-pulse' :
                connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                connectionStatus === 'error' ? 'bg-red-500' :
                'bg-gray-500'
              }`} />
              <span className="text-sm">
                {connectionStatus === 'connected' ? 'Live' :
                 connectionStatus === 'connecting' ? 'Connecting...' :
                 connectionStatus === 'error' ? 'Error' :
                 'Disconnected'}
              </span>
            </div>
            
            {lastUpdate && (
              <div className="text-sm text-gray-400">
                Last update: {lastUpdate.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Source Selector */}
        <div className="bg-gray-800 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
            <Radio className="w-5 h-5 text-purple-400" />
            Data Source
          </h2>
          
          <div className="flex gap-4 mb-4">
            <button
              onClick={() => setSourceMode('local')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                sourceMode === 'local' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              data-testid="button-source-local"
            >
              <Laptop className="w-5 h-5" />
              Local Device
            </button>
            <button
              onClick={() => setSourceMode('remote')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                sourceMode === 'remote' 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              data-testid="button-source-remote"
            >
              <Globe className="w-5 h-5" />
              Remote User
            </button>
          </div>

          {sourceMode === 'remote' && (
            <div className="bg-gray-900 rounded-lg p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">User Email</label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={remoteEmail}
                      onChange={(e) => setRemoteEmail(e.target.value)}
                      placeholder="colleague@company.com"
                      className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                      disabled={remoteConnectionStatus === 'connected'}
                      data-testid="input-remote-email"
                    />
                    {remoteConnectionStatus !== 'connected' ? (
                      <button
                        onClick={handleConnectToRemote}
                        disabled={lookingUpUser || !remoteEmail.trim()}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg flex items-center gap-2"
                        data-testid="button-connect-remote"
                      >
                        {lookingUpUser ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Wifi className="w-4 h-4" />
                        )}
                        Connect
                      </button>
                    ) : (
                      <button
                        onClick={handleDisconnectRemote}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg flex items-center gap-2"
                        data-testid="button-disconnect-remote"
                      >
                        <WifiOff className="w-4 h-4" />
                        Disconnect
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Update Mode</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setRemoteMode('live')}
                      disabled={remoteConnectionStatus === 'connected'}
                      className={`flex-1 px-3 py-2 rounded-lg transition-colors ${
                        remoteMode === 'live'
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      } disabled:opacity-50`}
                      data-testid="button-mode-live"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                        Live (Real-time)
                      </div>
                    </button>
                    <button
                      onClick={() => setRemoteMode('snapshot')}
                      disabled={remoteConnectionStatus === 'connected'}
                      className={`flex-1 px-3 py-2 rounded-lg transition-colors ${
                        remoteMode === 'snapshot'
                          ? 'bg-orange-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      } disabled:opacity-50`}
                      data-testid="button-mode-snapshot"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <Clock className="w-4 h-4" />
                        Snapshot (15 min)
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              {remoteConnectionStatus !== 'disconnected' && (
                <div className="flex items-center justify-between bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      remoteConnectionStatus === 'connected' ? 'bg-green-500 animate-pulse' :
                      remoteConnectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                      'bg-red-500'
                    }`} />
                    <div>
                      <div className="font-medium">
                        {remoteUserName || 'Unknown User'}
                      </div>
                      <div className="text-xs text-gray-400">
                        {remoteFeedData?.activeSurveyTitle || 'No active survey'} • 
                        {remoteFeedData?.isOnline ? ' Online' : ' Offline'}
                      </div>
                    </div>
                  </div>
                  {remoteMode === 'snapshot' && remoteConnectionStatus === 'connected' && (
                    <button
                      onClick={() => remoteUserId && refreshSnapshot(remoteUserId)}
                      disabled={snapshotRefreshing}
                      className="px-3 py-1 bg-orange-600 hover:bg-orange-700 rounded flex items-center gap-2 text-sm"
                      data-testid="button-refresh-snapshot"
                    >
                      <RefreshCw className={`w-4 h-4 ${snapshotRefreshing ? 'animate-spin' : ''}`} />
                      Refresh Now
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Data Limit Notice */}
        <div className="bg-blue-600/20 border border-blue-500/50 rounded-xl p-4 mb-6" data-testid="notice-data-limit">
          <div className="flex items-center gap-2 text-blue-400 text-sm">
            <Activity className="w-4 h-4" />
            <span>{sourceMode === 'local' 
              ? 'Showing most recent 200 measurements (optimized for performance)'
              : `Showing ${measurements.length} measurements from remote user`}
            </span>
          </div>
        </div>
        
        {/* Statistics Cards */}
        <div className="grid grid-cols-4 gap-6 mb-6">
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-400">Recent Measurements</h3>
              <Activity className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-2xl font-bold">{stats.totalMeasurements}</div>
            <div className="text-xs text-gray-500 mt-1">Last 200 entries</div>
          </div>
          
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-400">Active Users</h3>
              <Users className="w-5 h-5 text-green-400" />
            </div>
            <div className="text-2xl font-bold">{stats.uniqueUsers}</div>
          </div>
          
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-400">With Images</h3>
              <Image className="w-5 h-5 text-purple-400" />
            </div>
            <div className="text-2xl font-bold">
              {stats.totalMeasurements > 0 
                ? `${Math.round((stats.measurementsWithImages / stats.totalMeasurements) * 100)}%`
                : '0%'}
            </div>
          </div>
          
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-400">Last Activity</h3>
              <Clock className="w-5 h-5 text-orange-400" />
            </div>
            <div className="text-sm font-bold">
              {stats.lastMeasurementTime 
                ? stats.lastMeasurementTime.toLocaleTimeString()
                : 'No activity'}
            </div>
          </div>
        </div>

        {/* Vehicle Map */}
        <div className="bg-gray-800 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-blue-400" />
            Real-Time Vehicle Location
          </h2>
          <div className="w-full h-96">
            <React.Suspense fallback={<div className="h-full bg-gray-900" />}><VehicleMap /></React.Suspense>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="bg-gray-800 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Filter className="w-5 h-5 text-blue-400" />
              Filters & Export
            </h2>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                disabled={filteredMeasurements.length === 0}
                className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-sm"
                data-testid="button-export-csv"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              
              <button
                onClick={handleExportGeoJSON}
                disabled={filteredMeasurements.length === 0}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-sm"
                data-testid="button-export-geojson"
              >
                <FileJson className="w-4 h-4" />
                Export GeoJSON
              </button>
              
              <button
                onClick={handleExportWithMedia}
                disabled={filteredMeasurements.length === 0}
                className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-sm"
                data-testid="button-export-media"
              >
                <Package className="w-4 h-4" />
                Export with Media
              </button>

              <div className="h-6 w-px bg-gray-600 mx-1" />
              
              <button
                onClick={() => setShowEmailDialog(true)}
                disabled={filteredMeasurements.length === 0}
                className="flex items-center gap-2 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-sm"
                data-testid="button-email-export"
              >
                <Mail className="w-4 h-4" />
                Email Export
              </button>

              <button
                onClick={() => setShowQRDialog(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm"
                data-testid="button-share-qr"
              >
                <QrCode className="w-4 h-4" />
                Share QR Code
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-5 gap-4">
            {/* User Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">User</label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Users</option>
                {uniqueUsers.map(userId => (
                  <option key={userId} value={userId}>
                    User {formatUserId(userId)}
                  </option>
                ))}
              </select>
            </div>
            
            {/* POI Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">POI Type</label>
              <select
                value={selectedPOIType}
                onChange={(e) => setSelectedPOIType(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                {uniquePOITypes.map(type => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search notes, POI types..."
                  className="w-full pl-10 pr-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            {/* Max Results */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Max Results</label>
              <select
                value={maxResults}
                onChange={(e) => setMaxResults(Number(e.target.value))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
                <option value={1000}>1000</option>
              </select>
            </div>
            
            {/* Clear Filters */}
            <div className="flex items-end">
              <button
                onClick={() => {
                  setSelectedUser('all');
                  setSelectedPOIType('all');
                  setSearchText('');
                  setMaxResults(100);
                }}
                className="w-full px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
              >
                Clear Filters
              </button>
            </div>
          </div>
          
          <div className="mt-4 text-sm text-gray-400">
            Showing {filteredMeasurements.length} of {measurements.length} measurements
          </div>
        </div>


        {/* Measurements Table */}
        <div className="bg-gray-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-xl font-semibold">Live Measurements</h2>
          </div>
          
          <div className="overflow-x-auto">
            {filteredMeasurements.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                {measurements.length === 0 ? (
                  <div>
                    <Activity className="w-12 h-12 mx-auto mb-4 text-gray-500" />
                    <p className="text-lg font-medium mb-2">No measurements found</p>
                    <p>Create some measurements in the main app to see them here</p>
                  </div>
                ) : (
                  <div>
                    <Filter className="w-12 h-12 mx-auto mb-4 text-gray-500" />
                    <p className="text-lg font-medium mb-2">No measurements match your filters</p>
                    <p>Try adjusting your search criteria</p>
                  </div>
                )}
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">POI ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Height</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Speed</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Media</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {filteredMeasurements.map((measurement) => (
                    <tr key={measurement.id} className="hover:bg-gray-700/50">
                      <td className="px-4 py-3 text-sm">
                        <div className="font-mono">
                          <div>{measurement.utcDate}</div>
                          <div className="text-gray-400">{measurement.utcTime}</div>
                        </div>
                      </td>
                      
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="font-mono">{formatUserId(measurement.user_id)}</span>
                        </div>
                      </td>
                      
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-blue-400" />
                          <span className="font-mono">{formatPOIId(measurement)}</span>
                        </div>
                      </td>
                      
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          measurement.poi_type === 'danger' ? 'bg-red-500/20 text-red-400' :
                          measurement.poi_type === 'bridge' ? 'bg-blue-500/20 text-blue-400' :
                          measurement.poi_type === 'tree' ? 'bg-green-500/20 text-green-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {measurement.poi_type || 'none'}
                        </span>
                      </td>
                      
                      <td className="px-4 py-3 text-sm">
                        <div className="font-mono">
                          <div className="font-bold">{measurement.rel.toFixed(2)}m</div>
                          <div className="text-gray-400">{(measurement.rel * 3.28084).toFixed(2)}ft</div>
                        </div>
                      </td>
                      
                      <td className="px-4 py-3 text-sm">
                        <div className="font-mono text-xs">
                          <div>{measurement.latitude.toFixed(6)}°</div>
                          <div>{measurement.longitude.toFixed(6)}°</div>
                        </div>
                      </td>
                      
                      <td className="px-4 py-3 text-sm">
                        <div className="font-mono">
                          <div>{measurement.speed.toFixed(1)} km/h</div>
                          <div className="text-gray-400">{measurement.heading.toFixed(0)}°</div>
                        </div>
                      </td>
                      
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          {measurement.imageUrl && (
                            <button
                              onClick={() => window.open(measurement.imageUrl!, '_blank')}
                              className="p-1 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/40"
                              title="View image"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                          {measurement.videoUrl && (
                            <button
                              onClick={() => window.open(measurement.videoUrl!, '_blank')}
                              className="p-1 bg-purple-500/20 text-purple-400 rounded hover:bg-purple-500/40"
                              title="View video"
                            >
                              <Video className="w-4 h-4" />
                            </button>
                          )}
                          {!measurement.imageUrl && !measurement.videoUrl && (
                            <span className="text-gray-500 text-xs">No media</span>
                          )}
                        </div>
                      </td>
                      
                      <td className="px-4 py-3 text-sm">
                        <div className="max-w-xs truncate" title={measurement.note || ''}>
                          {measurement.note || '-'}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-gray-400 text-sm mt-8">
          <p>Live Monitor - Real-time measurement tracking</p>
          <p className="mt-1">
            {connectionStatus === 'connected' ? (
              <span className="flex items-center justify-center gap-1">
                <CheckCircle className="w-4 h-4 text-green-400" />
                Connected to local database
              </span>
            ) : (
              <span className="flex items-center justify-center gap-1">
                <XCircle className="w-4 h-4 text-red-400" />
                Error loading data
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Email Export Dialog */}
      {showEmailDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]" onClick={() => setShowEmailDialog(false)}>
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full m-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4">Email Data Export</h3>
            <p className="text-gray-300 mb-4">Send exported data via email</p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Recipient Email</label>
              <input
                type="email"
                value={emailRecipient}
                onChange={(e) => setEmailRecipient(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="admin@soltec.ca"
                data-testid="input-export-email"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Export Format</label>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as 'csv' | 'json' | 'geojson')}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                data-testid="select-export-format"
              >
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
                <option value="geojson">GeoJSON</option>
              </select>
            </div>

            <div className="bg-gray-700/50 rounded-lg p-3 mb-4">
              <p className="text-sm text-gray-300">
                <strong>{filteredMeasurements.length}</strong> measurements will be included
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={handleEmailExport}
                disabled={sendingEmail}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-lg font-medium transition-colors"
                data-testid="button-send-export-email"
              >
                {sendingEmail ? 'Sending...' : 'Send Email'}
              </button>
              <button
                onClick={() => setShowEmailDialog(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
                data-testid="button-cancel-export-email"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Share Dialog */}
      {showQRDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]" onClick={() => setShowQRDialog(false)}>
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full m-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4">Share Live Monitor Access</h3>
            <p className="text-gray-300 mb-4">Send QR code for quick access to this live monitor</p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Recipient Email</label>
              <input
                type="email"
                value={emailRecipient}
                onChange={(e) => setEmailRecipient(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="admin@soltec.ca"
                data-testid="input-qr-email"
              />
            </div>

            <div className="bg-gray-700/50 rounded-lg p-3 mb-4">
              <p className="text-sm text-gray-300">
                A QR code and direct link will be sent to access this live monitor dashboard
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={handleQRCodeShare}
                disabled={sendingEmail}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-4 py-2 rounded-lg font-medium transition-colors"
                data-testid="button-send-qr-email"
              >
                {sendingEmail ? 'Sending...' : 'Send QR Code'}
              </button>
              <button
                onClick={() => setShowQRDialog(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
                data-testid="button-cancel-qr-email"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveMonitor;