import React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useSurveyStore, deleteMeasurement, deleteAllMeasurements } from '../lib/survey';
import { useMeasurementLogger } from '../hooks/useMeasurementLogger';
import { Edit2, Edit3, Settings2, Trash2, AlertTriangle, Video, Smartphone, X, Mic, Film } from 'lucide-react';
import VirtualizedListErrorBoundary from './VirtualizedListErrorBoundary';
import { toast } from 'sonner';
import { openSurveyDB } from '../lib/survey/db';
import { useSettingsStore } from '../lib/settings';
import { formatMeasurement } from '../lib/utils/unitConversion';
import { sendMeasurementLogEmail } from '../lib/utils/emailUtils';
import { generateCSV, generateJSON } from '../lib/survey/export';
import { VoiceNotePlayer } from './measurement/VoiceNotePlayer';
import { VoiceNoteManager } from '../lib/voice/VoiceNoteManager';
import type { VoiceNote } from '../lib/voice/types';
import type { Measurement } from '../lib/survey/types';
import { useEnabledFeatures } from '../hooks/useLicenseEnforcement';
import { useMeasurementFeed } from '../hooks/useMeasurementFeed';

interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  width: string;
  minWidth: string;
}

interface MeasurementLogProps {
  onEditMeasurement?: (measurement: Measurement) => void;
}

const MeasurementLog: React.FC<MeasurementLogProps> = ({ onEditMeasurement }) => {
  const { hasFeature } = useEnabledFeatures();
  
  // PERFORMANCE FIX: Use worker-based measurement logging
  const { logMeasurement: logMeasurementViaWorker } = useMeasurementLogger();
  
  // PERFORMANCE FIX: Use in-memory cache instead of IndexedDB queries
  const { getMeasurementsWithLimit, cacheSize } = useMeasurementFeed();
  const { activeSurvey } = useSurveyStore();
  
  // Helper function to format seconds to MM:SS
  const formatVideoTimestamp = (seconds: number | null | undefined): string => {
    if (seconds === null || seconds === undefined) return '--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const [independentMeasurements, setIndependentMeasurements] = React.useState<any[]>([]);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState({
    note: '',
    poiType: ''
  });
  const [showColumnSelector, setShowColumnSelector] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = React.useState(false);
  const [showExportMenu, setShowExportMenu] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [showDetectionLogs, setShowDetectionLogs] = React.useState(false);
  const [detectionLogs, setDetectionLogs] = React.useState<any[]>([]);
  const [showDrawingModal, setShowDrawingModal] = React.useState(false);
  const [selectedDrawing, setSelectedDrawing] = React.useState<string | null>(null);
  const [voiceNotesMap, setVoiceNotesMap] = React.useState<Map<string, VoiceNote>>(new Map());
  const [selectedVoiceNote, setSelectedVoiceNote] = React.useState<VoiceNote | null>(null);
  const [showVoiceNoteModal, setShowVoiceNoteModal] = React.useState(false);
  const [loadingVoiceNotes, setLoadingVoiceNotes] = React.useState(false);
  const voiceNoteManager = React.useRef(new VoiceNoteManager());
  const [showImageModal, setShowImageModal] = React.useState(false);
  const [selectedImage, setSelectedImage] = React.useState<string | null>(null);
  const [columns, setColumns] = React.useState<ColumnConfig[]>([
    { id: 'date', label: 'Date', visible: true, width: '90px', minWidth: '90px' },
    { id: 'time', label: 'Time', visible: true, width: '80px', minWidth: '80px' },
    { id: 'road', label: 'POI ID', visible: true, width: '100px', minWidth: '100px' },
    { id: 'poi_type', label: 'POI Type', visible: true, width: '100px', minWidth: '100px' },
    { id: 'height', label: 'Height', visible: true, width: '80px', minWidth: '80px' },
    { id: 'gps', label: 'GPS', visible: true, width: '180px', minWidth: '180px' },
    { id: 'altitude', label: 'Altitude', visible: true, width: '80px', minWidth: '80px' },
    { id: 'course', label: 'Course', visible: true, width: '80px', minWidth: '80px' },
    { id: 'speed', label: 'Speed', visible: true, width: '80px', minWidth: '80px' },
    { id: 'satellites', label: 'Satellites', visible: false, width: '100px', minWidth: '100px' },
    { id: 'hdop', label: 'HDOP', visible: false, width: '80px', minWidth: '80px' },
    { id: 'images', label: 'Images', visible: true, width: '80px', minWidth: '80px' },
    { id: 'alerts', label: 'Alerts', visible: true, width: '80px', minWidth: '80px' },
    { id: 'video', label: 'Video', visible: true, width: '80px', minWidth: '80px' },
    { id: 'videoTime', label: 'Video Time', visible: true, width: '90px', minWidth: '90px' },
    { id: 'timelapseFrame', label: 'Timelapse', visible: true, width: '90px', minWidth: '90px' },
    { id: 'voiceNote', label: 'Voice Note', visible: true, width: '90px', minWidth: '90px' },
    { id: 'width', label: 'Width', visible: false, width: '80px', minWidth: '80px' },
    { id: 'length', label: 'Length', visible: false, width: '80px', minWidth: '80px' },
    { id: 'drawing', label: 'Drawing', visible: false, width: '80px', minWidth: '80px' },
    { id: 'mileMarker', label: 'Mile Marker', visible: true, width: '100px', minWidth: '100px' },
    { id: 'source', label: 'Source', visible: true, width: '100px', minWidth: '100px' },
    { id: 'note', label: 'Note', visible: true, width: '400px', minWidth: '400px' }
  ]);
  const [resizingColumn, setResizingColumn] = React.useState<string | null>(null);
  const [startX, setStartX] = React.useState(0);
  const [startWidth, setStartWidth] = React.useState(0);
  
  // Get display units from settings
  const { displaySettings } = useSettingsStore();
  const displayUnits = displaySettings.units;

  const handleResizeStart = (e: React.MouseEvent, columnId: string, currentWidth: string) => {
    setResizingColumn(columnId);
    setStartX(e.clientX);
    setStartWidth(parseInt(currentWidth));
    
    const handleMouseMove = (e: MouseEvent) => {
      if (resizingColumn) {
        const diff = e.clientX - startX;
        const newWidth = Math.max(50, startWidth + diff);
        setColumns(prev => prev.map(col => 
          col.id === resizingColumn ? { ...col, width: `${newWidth}px` } : col
        ));
      }
    };
    
    const handleMouseUp = () => {
      setResizingColumn(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Load detection logs from localStorage
  React.useEffect(() => {
    try {
      const logs = JSON.parse(localStorage.getItem('objectDetectionLogs') || '[]');
      setDetectionLogs(logs);
    } catch (err) {
    }
  }, []);

  // Load independent measurements from localStorage (works without survey)
  React.useEffect(() => {
    const loadIndependentMeasurements = () => {
      try {
        const stored = localStorage.getItem('independent_measurements');
        if (stored) {
          const parsed = JSON.parse(stored);
          setIndependentMeasurements(parsed);
        }
      } catch (error) {
      }
    };
    
    loadIndependentMeasurements();
    
    // Listen for independent measurement updates
    const handleIndependentUpdate = () => {
      loadIndependentMeasurements();
    };
    
    window.addEventListener('independent-measurement-added', handleIndependentUpdate);
    
    return () => {
      window.removeEventListener('independent-measurement-added', handleIndependentUpdate);
    };
  }, []);

  // PERFORMANCE FIX: Use in-memory cache instead of IndexedDB queries
  // No more dbchange event listeners - the cache auto-updates via worker subscription
  const sortedMeasurements = React.useMemo(() => {
    let measurements: any[] = [];
    
    if (!activeSurvey && independentMeasurements.length > 0) {
      measurements = independentMeasurements;
    } else if (activeSurvey) {
      // Read from in-memory cache (no IndexedDB query)
      measurements = getMeasurementsWithLimit(1000);
    }
    
    return measurements;
  }, [activeSurvey, independentMeasurements, getMeasurementsWithLimit, cacheSize]);

  // Create stable dependency for voice notes loading - only when measurement IDs change
  const measurementIdsWithVoice = React.useMemo(() => {
    return sortedMeasurements
      .filter((m: any) => m.voiceNoteId)
      .map((m: any) => `${m.id}:${m.voiceNoteId}`)
      .join(',');
  }, [sortedMeasurements]);

  // Load voice notes for measurements
  React.useEffect(() => {
    const loadVoiceNotes = async () => {
      // Load voice notes for visible measurements only (virtualizer handles pagination)
      if (!measurementIdsWithVoice) return;
      
      setLoadingVoiceNotes(true);
      const notesMap = new Map<string, VoiceNote>();
      
      try {
        // Load voice notes for each measurement that has a voiceNoteId
        for (const measurement of sortedMeasurements) {
          if (measurement.voiceNoteId) {
            try {
              const voiceNote = await voiceNoteManager.current.getVoiceNote(measurement.voiceNoteId);
              if (voiceNote) {
                notesMap.set(measurement.id, voiceNote);
              }
            } catch (error) {
            }
          }
        }
        
        setVoiceNotesMap(notesMap);
      } catch (error) {
      } finally {
        setLoadingVoiceNotes(false);
      }
    };
    
    loadVoiceNotes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measurementIdsWithVoice]);

  const handleEdit = async (measurement: any) => {
    setEditingId(measurement.id);
    setEditForm({
      note: measurement.note || '',
      poiType: measurement.poi_type || ''
    });
  };

  const handleSaveEdit = async (measurement: any) => {
    try {
      const { updateMeasurement } = await import('../lib/survey/measurements');
      await updateMeasurement(measurement.id, {
        note: editForm.note,
        poi_type: editForm.poiType
      });
      setEditingId(null);
      // toast suppressed
    } catch (error) {
      toast.error('Failed to update measurement');
    }
  };

  const handleDeletePOI = async (id: string) => {
    try {
      await deleteMeasurement(id);
      setDeletingId(null);
    } catch (error) {
    }
  };

  const handleClearAllLogs = async () => {
    if (!activeSurvey) return;
    try {
      await deleteAllMeasurements(activeSurvey.id);
      setShowClearConfirm(false);
    } catch (error) {
    }
  };

  const handleClearDetectionLogs = () => {
    if (confirm('Are you sure you want to clear all detection logs?')) {
      localStorage.removeItem('objectDetectionLogs');
      setDetectionLogs([]);
      // toast suppressed
    }
  };


  const handleExportCSV = () => {
    if (!activeSurvey) return;
    
    // Use the survey export function
    useSurveyStore.getState().exportSurvey('csv');
  };
  

  const handleSendEmail = async () => {
    if (!activeSurvey) {
      toast.error('No active survey to send');
      return;
    }

    try {
      const emailConfig = JSON.parse(localStorage.getItem('emailConfig') || '{"surveyRecipients":[]}');
      const recipients = emailConfig.surveyRecipients || [];

      if (recipients.length === 0) {
        toast.error('No email recipients configured', {
          description: 'Please add recipients in Email Settings'
        });
        return;
      }

      const db = await openSurveyDB();
      const allMeasurements = await db.getAllFromIndex('measurements', 'by-date');
      const surveyMeasurements = allMeasurements.filter((m: any) => m.user_id === activeSurvey.id);

      if (surveyMeasurements.length === 0) {
        toast.error('No measurements to send');
        return;
      }

      const csvData = await generateCSV(surveyMeasurements);
      const jsonData = await generateJSON(surveyMeasurements);
      const geojsonData = await db.getAllFromIndex('measurements', 'by-date')
        .then((measurements: any) => measurements.filter((m: any) => m.user_id === activeSurvey.id))
        .then((measurements: any) => JSON.stringify({
          type: 'FeatureCollection',
          features: measurements.map((m: any) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [m.longitude, m.latitude] },
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
            }
          }))
        }, null, 2));

      const images = surveyMeasurements
        .filter((m: any) => m.imageUrl)
        .map((m: any) => ({
          url: m.imageUrl,
          filename: `image_${m.roadNumber || 'R000'}_POI${String(m.poiNumber || 0).padStart(5, '0')}_${m.poi_type || 'none'}_${m.id.substring(0, 8)}.jpg`
        }));

      await sendMeasurementLogEmail(
        {
          to: recipients,
          bcc: [],
          surveyTitle: activeSurvey.surveyTitle || 'Untitled Survey',
          surveyorName: activeSurvey.surveyorName || 'Unknown',
          clientName: activeSurvey.clientName || 'Unknown',
          projectNumber: activeSurvey.projectNumber,
          measurementCount: surveyMeasurements.length,
          notes: ''
        },
        {
          csv: csvData,
          json: jsonData,
          geojson: geojsonData
        },
        images
      );

    } catch (error) {
      toast.error('Failed to send email', {
        description: error instanceof Error ? error.message : 'Please try again'
      });
    }
  };

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeSurvey) {
      toast.error('No active survey');
      return;
    }
    
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const lines = text.split('\n');
      
      // Skip header row
      const dataRows = lines.slice(1);
      
      let importedCount = 0;
      let errorCount = 0;
      
      for (const row of dataRows) {
        if (!row.trim()) continue;
        
        const columns = row.split(',');
        
        try {
          // Create measurement object from CSV data
          const measurement = {
            id: crypto.randomUUID(),
            utcDate: columns[0] || new Date().toISOString().split('T')[0],
            utcTime: columns[1] || new Date().toTimeString().split(' ')[0],
            rel: parseFloat(columns[2]) || 0,
            altGPS: parseFloat(columns[3]) || 0,
            latitude: parseFloat(columns[4]) || 0,
            longitude: parseFloat(columns[5]) || 0,
            speed: parseFloat(columns[6]) || 0,
            heading: parseFloat(columns[7]) || 0,
            roadNumber: columns[8] ? parseInt(columns[8]) : null,
            poiNumber: columns[9] ? parseInt(columns[9]) : null,
            poi_type: columns[10] || 'none',
            note: columns[11] || null,
            createdAt: new Date().toISOString(),
            user_id: activeSurvey.id
          };
          
          // PERFORMANCE FIX: Use worker-based logging for off-thread, batched writes
          await logMeasurementViaWorker(measurement);
          importedCount++;
        } catch (error) {
          errorCount++;
        }
      }
      
      // toast suppressed
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
    } catch (error) {
      toast.error('Failed to import measurements', {
        description: error instanceof Error ? error.message : String(error)
      });
    }
  };

  const toggleColumn = (columnId: string) => {
    setColumns(prev =>
      prev.map(col =>
        col.id === columnId ? { ...col, visible: !col.visible } : col
      )
    );
  };

  const calculateMileMarker = (measurement: any, startCoords: any) => {
    if (!startCoords) return '--';
    
    // Haversine formula to calculate distance
    const R = 6371; // Earth's radius in km
    const dLat = (measurement.latitude - startCoords.latitude) * Math.PI / 180;
    const dLon = (measurement.longitude - startCoords.longitude) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(startCoords.latitude * Math.PI / 180) * Math.cos(measurement.latitude * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    return distance.toFixed(2);
  };

  // Use sorted measurements for rendering with virtualizer (handles large datasets efficiently)
  const safeMeasurements = Array.isArray(sortedMeasurements) ? sortedMeasurements : [];
  // CORRECTNESS + PERF (v16.1.27): the measurements array is newest-first since
  // the v16.1.23 flip, so the OLDEST (route start) is at the END. Before this
  // fix, using [0] made startCoords = the newest POI, which broke
  // calculateMileMarker — the last POI always showed 0 and every other row's
  // MM shifted on every add. Memoizing against the route-start id keeps
  // startCoords stable across adds so row-level React memoization can cache.
  const routeStartId: string | null = safeMeasurements.length > 0
    ? (safeMeasurements[safeMeasurements.length - 1]?.id ?? null)
    : null;
  const startCoords = React.useMemo(() => {
    if (safeMeasurements.length === 0) return null;
    return safeMeasurements[safeMeasurements.length - 1];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeStartId]);
  
  // Performance monitoring for large datasets (dev only)
  React.useEffect(() => {
    if (import.meta.env.DEV && safeMeasurements.length > 10000) {
      console.warn(
        `[MeasurementLog] Large dataset detected: ${safeMeasurements.length} measurements. ` +
        `Virtualization is active to maintain performance.`
      );
    }
  }, [safeMeasurements.length]);
  
  // Virtualizer setup with production hardening
  const parentRef = React.useRef<HTMLDivElement>(null);
  const headerRef = React.useRef<HTMLDivElement>(null);
  
  // NEWEST FIRST: MeasurementFeed already sorts DESC, display in natural order (newest on top)
  const virtualizer = useVirtualizer({
    count: safeMeasurements.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => editingId ? 120 : 60,
    overscan: 5,
    // Stable key based on measurement ID (not array index)
    getItemKey: (index: number) => {
      const item = safeMeasurements[index];
      if (!item?.id) {
        // This should NEVER happen in production - all measurements must have IDs
        if (import.meta.env.DEV) {
          console.error(`[MeasurementLog] Item at index ${index} missing ID - this is a critical bug!`, item);
        }
        // Deterministic fallback: use item's createdAt timestamp (stable across renders)
        return `error-${item?.createdAt || 'unknown'}-${item?.utcDate || 'nodate'}-${item?.utcTime || 'notime'}`;
      }
      return item.id;
    },
  });
  
  // Sync horizontal scroll between header and body
  const handleBodyScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (headerRef.current) {
      headerRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  // Reset scroll position when survey changes or data is cleared
  React.useEffect(() => {
    if (virtualizer && parentRef.current) {
      parentRef.current.scrollTop = 0;
    }
  }, [activeSurvey?.id, safeMeasurements.length === 0]);

  // Row component for virtual scrolling
  const renderRow = (index: number) => {
    if (index >= safeMeasurements.length) return null;
    
    // NEWEST FIRST: Display in natural order (MeasurementFeed already sorted DESC)
    const m = safeMeasurements[index];
    return (
      <div
        className="flex min-w-max border-t border-gray-700 hover:bg-gray-700"
        data-testid={`measurement-log-row-${m.id}`}
      >
        {columns.map(col => col.visible && (
          <div
            key={col.id}
            className="px-2 py-1.5 font-mono truncate text-xs flex items-center border-r border-gray-700"
            style={{ width: col.width, minWidth: col.minWidth }}
          >
            {col.id === 'date' && (m.utcDate || '-')}
            {col.id === 'time' && (m.utcTime || '-')}
            {col.id === 'road' && (
              m.id ? m.id.substring(0, 8) : '-'
            )}
            {col.id === 'poi_type' && (
              <span className="capitalize">{m.poi_type || 'none'}</span>
            )}
            {col.id === 'height' && (m.rel !== undefined && m.rel !== null ? formatMeasurement(m.rel, displayUnits) : '-')}
            {col.id === 'width' && (m.widthMeasure ? formatMeasurement(m.widthMeasure, displayUnits) : '-')}
            {col.id === 'length' && (m.lengthMeasure ? formatMeasurement(m.lengthMeasure, displayUnits) : '-')}
            {col.id === 'gps' && (() => {
              const lat = typeof m.latitude === 'number' ? m.latitude : (typeof m.latitude === 'string' ? parseFloat(m.latitude) : null);
              const lon = typeof m.longitude === 'number' ? m.longitude : (typeof m.longitude === 'string' ? parseFloat(m.longitude) : null);
              return (lat !== null && lon !== null && !isNaN(lat) && !isNaN(lon)) 
                ? `${lat.toFixed(6)}°, ${lon.toFixed(6)}°` 
                : '-';
            })()}
            {col.id === 'altitude' && (() => {
              const alt = typeof m.altGPS === 'number' ? m.altGPS : (typeof m.altGPS === 'string' ? parseFloat(m.altGPS) : null);
              return (alt !== null && !isNaN(alt)) ? `${alt.toFixed(1)}m` : '-';
            })()}
            {col.id === 'course' && (() => {
              const course = typeof m.heading === 'number' ? m.heading : (typeof m.heading === 'string' ? parseFloat(m.heading) : null);
              return (course !== null && !isNaN(course)) ? `${course.toFixed(1)}°` : '-';
            })()}
            {col.id === 'speed' && (() => {
              const speed = typeof m.speed === 'number' ? m.speed : (typeof m.speed === 'string' ? parseFloat(m.speed) : null);
              return (speed !== null && !isNaN(speed)) ? `${speed.toFixed(1)} km/h` : '-';
            })()}
            {col.id === 'satellites' && (m.satellites ?? '-')}
            {col.id === 'hdop' && (m.hdop !== undefined ? m.hdop.toFixed(1) : '-')}
            {col.id === 'images' && (
              m.imageUrl ? (
                <button
                  onClick={() => {
                    setSelectedImage(m.imageUrl);
                    setShowImageModal(true);
                  }}
                  className="flex items-center justify-center w-8 h-8 bg-blue-500/20 rounded hover:bg-blue-500/40 transition-colors"
                  title="View image"
                  data-testid={`button-view-image-${m.id}`}
                >
                  <Smartphone className="w-4 h-4 text-blue-400" />
                </button>
              ) : typeof m.images === 'number' && m.images > 0 ? (
                <div className="flex gap-1 items-center text-blue-400 dark:text-blue-300">
                  <Smartphone className="h-3 w-3" />
                  {m.images}
                </div>
              ) : '-'
            )}
            {col.id === 'video' && (
              m.videoUrl ? (
                <a 
                  href={m.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-8 h-8 bg-blue-500/20 rounded hover:bg-blue-500/40 transition-colors"
                  title="View video"
                >
                  <Video className="w-4 h-4 text-blue-400" />
                </a>
              ) : '-'
            )}
            {col.id === 'videoTime' && (
              <span className="text-sm font-mono">
                {formatVideoTimestamp(m.videoTimestamp)}
              </span>
            )}
            {col.id === 'timelapseFrame' && (
              m.timelapseFrameNumber !== null && m.timelapseFrameNumber !== undefined ? (
                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('jumpToTimelapseFrame', { 
                      detail: { frameNumber: m.timelapseFrameNumber } 
                    }));
                    window.dispatchEvent(new CustomEvent('switchToTimelapseTab'));
                  }}
                  className="flex items-center gap-1 justify-center w-full px-2 py-1 bg-purple-500/20 rounded hover:bg-purple-500/40 transition-colors"
                  title={`Jump to frame ${m.timelapseFrameNumber}`}
                  data-testid={`button-jump-to-frame-${m.id}`}
                >
                  <Film className="w-4 h-4 text-purple-400" />
                  <span className="text-xs text-purple-400">{m.timelapseFrameNumber}</span>
                </button>
              ) : '-'
            )}
            {col.id === 'voiceNote' && (
              m.voiceNoteId ? (
                loadingVoiceNotes ? (
                  <div className="flex items-center justify-center w-8 h-8">
                    <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                  </div>
                ) : voiceNotesMap.has(m.id) ? (
                  <button
                    onClick={() => {
                      const voiceNote = voiceNotesMap.get(m.id);
                      if (voiceNote) {
                        setSelectedVoiceNote(voiceNote);
                        setShowVoiceNoteModal(true);
                      }
                    }}
                    className="flex items-center justify-center w-8 h-8 bg-blue-500/20 rounded hover:bg-blue-500/40 transition-colors"
                    title="Play voice note"
                    data-testid={`button-play-voice-note-${m.id}`}
                  >
                    <Mic className="w-4 h-4 text-blue-400" />
                  </button>
                ) : (
                  <span className="text-gray-500 text-xs" title="Voice note not found">-</span>
                )
              ) : '-'
            )}
            {col.id === 'drawing' && (
              m.drawingUrl ? (
                <button
                  onClick={() => {
                    setSelectedDrawing(m.drawingUrl);
                    setShowDrawingModal(true);
                  }}
                  className="flex items-center justify-center w-8 h-8 bg-purple-500/20 rounded hover:bg-purple-500/40 transition-colors"
                  title="View drawing"
                  data-testid={`button-view-drawing-${m.id}`}
                >
                  <Edit3 className="w-4 h-4 text-purple-400" />
                </button>
              ) : '-'
            )}
            {col.id === 'alerts' && (
              m.alertType === 'DANGER' ? '🔴' : 
              m.alertType === 'WARNING' ? '🟡' : 
              '-'
            )}
            {col.id === 'mileMarker' && calculateMileMarker(m, startCoords)}
            {col.id === 'source' && (
              m.source === 'slaveApp' ? (
                <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-full text-xs flex items-center gap-1">
                  <Smartphone className="w-3 h-3" />
                  Slave App
                </span>
              ) : m.source === 'detection' ? (
                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full text-xs">Detection</span>
              ) : m.source === 'all' ? (
                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full text-xs">Auto</span>
              ) : (
                <span className="px-2 py-0.5 bg-gray-500/20 text-gray-400 rounded-full text-xs">Manual</span>
              )
            )}
            {col.id === 'note' && (
              editingId === m.id ? (
                <div className="flex gap-2">
                  <textarea
                    value={editForm.note}
                    onChange={(e) => setEditForm(prev => ({ ...prev, note: e.target.value }))}
                    className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm w-full h-24 resize-none"
                    placeholder="Add note..."
                  />
                  <button
                    onClick={() => handleSaveEdit(m)}
                    className="px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-2 py-1 bg-gray-600 hover:bg-gray-700 rounded text-xs"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                m.note ? (
                  <div title={m.note}>
                    {m.note.length > 300 ? `${m.note.substring(0, 300)}...` : m.note}
                  </div>
                ) : '-'
              )
            )}
          </div>
        ))}
        <div className="px-4 py-2 flex items-center gap-2" style={{ width: '100px' }}>
          {onEditMeasurement && (
            <button
              onClick={() => onEditMeasurement(m)}
              className="p-1 hover:bg-gray-600 rounded text-blue-400 hover:text-blue-300"
              title="Edit measurement details"
              data-testid={`button-edit-measurement-${m.id}`}
            >
              <Edit3 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => handleEdit(m)}
            className="p-1 hover:bg-gray-600 rounded"
            title="Edit note"
            data-testid={`button-edit-note-${m.id}`}
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDeletingId(m.id)}
            className="p-1 hover:bg-gray-600 rounded text-red-400 hover:text-red-300"
            title="Delete measurement"
            data-testid={`button-delete-measurement-${m.id}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gray-800 rounded-xl p-6 max-h-[600px] overflow-hidden flex flex-col">
      {/* Buttons Row */}
      <div className="mb-3 flex items-center gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileImport}
          accept=".csv"
          className="hidden"
        />
        
        {/* Show Detection Logs — removed (detection display not functional) */}
        
        {/* Clear All Button - Premium Feature */}
        {hasFeature('admin') && (
          <button
            onClick={() => setShowClearConfirm(true)}
            className="flex items-center gap-1 px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
            data-testid="button-clear-all"
          >
            <Trash2 className="w-4 h-4" />
            Clear All
          </button>
        )}
        
        <button
          onClick={() => setShowColumnSelector(!showColumnSelector)}
          className="flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
          data-testid="button-columns"
        >
          <Settings2 className="w-4 h-4" />
          Columns
        </button>
        
        <div className="text-xs text-gray-400 ml-auto">
          {safeMeasurements.length} entries
        </div>
      </div>

      {/* Object Detection Logs */}
      {showDetectionLogs && (
        <div className="mb-4 p-4 bg-gray-700 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">Object Detection Logs ({detectionLogs.length})</h3>
            <button
              onClick={handleClearDetectionLogs}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm"
              disabled={detectionLogs.length === 0}
            >
              Clear Detection Logs
            </button>
          </div>
          
          {detectionLogs.length === 0 ? (
            <p className="text-gray-400 text-center py-4">No detection logs available</p>
          ) : (
            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              {detectionLogs.map((log, index) => (
                <div key={index} className="bg-gray-800 p-3 rounded-lg">
                  <div className="grid grid-cols-3 gap-4 mb-2">
                    <div>
                      <span className="text-gray-400 text-xs">Min Height:</span>
                      <div className="font-mono font-bold">{formatMeasurement(log.minHeight, displayUnits)}</div>
                    </div>
                    <div>
                      <span className="text-gray-400 text-xs">Avg Height:</span>
                      <div className="font-mono">{formatMeasurement(log.avgHeight, displayUnits)}</div>
                    </div>
                    <div>
                      <span className="text-gray-400 text-xs">Max Height:</span>
                      <div className="font-mono">{formatMeasurement(log.maxHeight, displayUnits)}</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 mb-2">
                    <div>
                      <span className="text-gray-400 text-xs">Samples:</span>
                      <div className="font-mono">{log.measurementCount}/{log.totalSamples}</div>
                    </div>
                    <div>
                      <span className="text-gray-400 text-xs">Duration:</span>
                      <div className="font-mono">{log.duration.toFixed(2)}s</div>
                    </div>
                    <div>
                      <span className="text-gray-400 text-xs">Time:</span>
                      <div className="font-mono text-xs">{new Date(log.endTime).toLocaleTimeString()}</div>
                    </div>
                  </div>
                  
                  <div className="mt-2 text-xs text-gray-400">
                    Location: {log.location.latitude.toFixed(6)}°, {log.location.longitude.toFixed(6)}°
                    {log.location.speed > 0 && ` • Speed: ${log.location.speed.toFixed(1)} km/h`}
                    {log.location.heading > 0 && ` • Heading: ${log.location.heading.toFixed(1)}°`}
                    
                    <div>
                      <div className="text-sm text-gray-400">Source</div>
                      <div className="text-xl font-mono font-bold text-white">
                        {log.source === 'slaveApp' ? (
                          <span className="text-purple-400">Slave App</span>
                        ) : log.source === 'detection' ? (
                          <span className="text-amber-400">Detection</span>
                        ) : log.source === 'all' ? (
                          <span className="text-blue-400">Auto</span>
                        ) : (
                          <span>Manual</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showColumnSelector && (
        <div className="mb-4 p-4 bg-gray-700 rounded-lg">
          <h3 className="text-sm font-medium mb-2">Select Columns to Display</h3>
          <div className="grid grid-cols-4 gap-2">
            {columns.map(column => (
              <label key={column.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={column.visible}
                  onChange={() => toggleColumn(column.id)}
                  className="rounded border-gray-600"
                />
                <span className="text-sm">{column.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Empty state */}
        {safeMeasurements.length === 0 && (
          <div className="px-4 py-8 text-center text-gray-500">
            {activeSurvey ? 'No measurements logged yet' : 'No independent measurements logged yet'}
          </div>
        )}
        
        {/* Table with header outside scroll container for newest-first contract */}
        {safeMeasurements.length > 0 && (
          <VirtualizedListErrorBoundary>
            {/* Table Header - scrolls horizontally, stays at top */}
            <div 
              ref={headerRef}
              className="overflow-x-auto overflow-y-hidden bg-gray-800 border-b border-gray-700"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <div className="flex min-w-max">
                {columns.map(col => col.visible && (
                  <div
                    key={col.id}
                    className="relative px-2 py-1.5 text-left text-gray-400 group border-r border-gray-700"
                    style={{ width: col.width, minWidth: col.minWidth }}
                  >
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-medium">{col.label}</span>
                    </div>
                    <div
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize group-hover:bg-blue-500"
                      onMouseDown={(e) => handleResizeStart(e, col.id, col.width)}
                    />
                  </div>
                ))}
                <div className="px-4 py-2 text-left text-gray-400 text-xs font-medium" style={{ width: '100px' }}>Actions</div>
              </div>
            </div>

            {/* Table Body - Virtualized, syncs horizontal scroll with header */}
            <div 
              ref={parentRef} 
              className="flex-1 overflow-auto"
              onScroll={handleBodyScroll}
              data-testid="measurement-log-virtualized"
            >
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {virtualizer.getVirtualItems().map((virtualItem) => (
                  <div
                    key={virtualItem.key}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualItem.size}px`,
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    {renderRow(virtualItem.index)}
                  </div>
                ))}
              </div>
            </div>
          </VirtualizedListErrorBoundary>
        )}
        
        {/* Delete Confirmation Dialog */}
        {deletingId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-red-400" />
                <h3 className="text-xl font-semibold">Delete POI</h3>
              </div>
              <p className="text-gray-300 mb-6">
                Are you sure you want to delete this POI? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-4">
                <button
                  onClick={() => setDeletingId(null)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeletePOI(deletingId)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm"
                >
                  Delete POI
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Clear All Confirmation Dialog */}
        {showClearConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-red-400" />
                <h3 className="text-xl font-semibold">Clear All Logs</h3>
              </div>
              <p className="text-gray-300 mb-6">
                Are you sure you want to clear all measurement logs? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-4">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearAllLogs}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm"
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* PERFORMANCE: Display only last 20 entries for speed */}
      {activeSurvey && safeMeasurements.length > 0 && (
        <div className="flex items-center justify-between p-4 border-t border-gray-700 bg-gray-800">
          <div className="text-sm text-gray-400">
            Showing {safeMeasurements.length} entries
          </div>
        </div>
      )}
      
      {/* Drawing Viewer Modal */}
      {showDrawingModal && selectedDrawing && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold">Drawing</h3>
              <button
                onClick={() => {
                  setShowDrawingModal(false);
                  setSelectedDrawing(null);
                }}
                className="text-gray-400 hover:text-gray-300"
                data-testid="button-close-drawing-modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <img 
                src={selectedDrawing} 
                alt="Drawing" 
                className="w-full h-auto rounded border border-gray-600"
              />
            </div>
          </div>
        </div>
      )}

      {/* Voice Note Player Modal */}
      {showVoiceNoteModal && selectedVoiceNote && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-2xl w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold">Voice Note</h3>
              <button
                onClick={() => {
                  setShowVoiceNoteModal(false);
                  setSelectedVoiceNote(null);
                }}
                className="text-gray-400 hover:text-gray-300"
                data-testid="button-close-voice-note-modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <VoiceNotePlayer voiceNote={selectedVoiceNote} />
              <div className="mt-4 text-sm text-gray-400">
                <div>Recorded: {new Date(selectedVoiceNote.createdAt).toLocaleString()}</div>
                <div>Duration: {selectedVoiceNote.duration.toFixed(2)}s</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {showImageModal && selectedImage && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={() => {
          setShowImageModal(false);
          setSelectedImage(null);
        }}>
          <div className="relative max-w-6xl w-full max-h-[95vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => {
                setShowImageModal(false);
                setSelectedImage(null);
              }}
              className="absolute top-4 right-4 text-white hover:text-gray-300 bg-black/50 rounded-full p-2 z-10"
              data-testid="button-close-image-modal"
            >
              <X className="w-6 h-6" />
            </button>
            <img 
              src={selectedImage} 
              alt="POI Image" 
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default MeasurementLog;