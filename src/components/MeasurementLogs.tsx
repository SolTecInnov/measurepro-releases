import React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Download, MapPin, FileText, Plus, Trash2, Upload, Film } from 'lucide-react';
import { soundManager } from '../lib/sounds';
import { useSurveyStore } from '../lib/survey';
import { useSettingsStore } from '../lib/settings';
import { useCameraStore } from '../lib/camera';
import SurveyDialog from './SurveyDialog';
import { useGPSStore } from '../lib/stores/gpsStore';
import { toast } from 'sonner';
import VirtualizedListErrorBoundary from './VirtualizedListErrorBoundary';

type LogMode = 'Manual' | 'All Data' | 'Object Detection';

interface Measurement {
  rel: number;
  altGPS: number;
  latitude: number;
  longitude: number;
  mileMarker: number;
  poiType: string;
  imageFilename?: string;
  utcDate: string;
  utcTime: string;
  speed: number;
  heading: number;
  roadNumber?: number;
  poiNumber?: number;
  note?: string;
  timelapseFrameNumber?: number | null;
}

interface MeasurementLogsProps {
  measurements: Measurement[];
  logMode: LogMode;
  onLogModeChange: (mode: LogMode) => void;
  onCaptureImage: () => void;
  onNewMeasurement?: () => void;
}

const MeasurementLogs: React.FC<MeasurementLogsProps> = ({
  measurements,
  logMode,
  onLogModeChange,
  onCaptureImage,
  onNewMeasurement
}) => {
  const prevMeasurementsLength = React.useRef(measurements.length);
  const [showSurveyDialog, setShowSurveyDialog] = React.useState(false);
  const [showClearConfirm, setShowClearConfirm] = React.useState(false);
  const [editingNote, setEditingNote] = React.useState<string | null>(null);
  const [noteText, setNoteText] = React.useState('');
  const { capturedImage, autoCapture } = useCameraStore();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { activeSurvey, clearSurvey } = useSurveyStore();
  const { alertSettings } = useSettingsStore();
  const { data: gpsData } = useGPSStore();

  const handleStartSurvey = async () => {
    const initialMeasurement = {
      rel: 0,
      altGPS: gpsData.altitude,
      latitude: gpsData.latitude,
      longitude: gpsData.longitude,
      mileMarker: 0,
      poiType: 'START',
      note: 'Survey Start',
      utcDate: new Date().toISOString().split('T')[0],
      utcTime: new Date().toTimeString().split(' ')[0],
      speed: gpsData.speed,
      heading: gpsData.course,
      roadNumber: 1,
      poiNumber: 1
    };

    // Add measurement to the list
    measurements.push(initialMeasurement);
    onNewMeasurement?.();
  };

  React.useEffect(() => {
    if (measurements.length > prevMeasurementsLength.current) {
      soundManager.playLogEntry();
      onNewMeasurement?.();
    }
    prevMeasurementsLength.current = measurements.length;
  }, [measurements.length, onNewMeasurement]);

  const handleAddPOI = () => {
    if (!capturedImage && autoCapture) {
      onCaptureImage();
    }
    // POI logic will be handled by parent component
  };

  const handleClearSurvey = async () => {
    if (window.confirm('Are you sure you want to clear the active survey? This cannot be undone.')) {
      const shouldExport = window.confirm('Would you like to export the data before clearing?');
      
      if (shouldExport) {
        exportToCSV();
      }

      await clearSurvey();
      setShowClearConfirm(false);
    }
  };

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeSurvey) {
      toast.error('Please create a survey first');
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
          const measurement: Measurement = {
            rel: parseFloat(columns[2]) || 0,
            altGPS: parseFloat(columns[3]) || 0,
            latitude: parseFloat(columns[4]) || 0,
            longitude: parseFloat(columns[5]) || 0,
            mileMarker: parseFloat(columns[10]) || 0,
            poiType: columns[10] || 'none',
            utcDate: columns[0] || new Date().toISOString().split('T')[0],
            utcTime: columns[1] || new Date().toTimeString().split(' ')[0],
            speed: parseFloat(columns[6]) || 0,
            heading: parseFloat(columns[7]) || 0,
            roadNumber: columns[8] ? parseInt(columns[8]) : undefined,
            poiNumber: columns[9] ? parseInt(columns[9]) : undefined,
            note: columns[11] || undefined,
            imageFilename: undefined
          };
          
          // Add to measurements
          measurements.push(measurement);
          importedCount++;
          
          // Trigger onNewMeasurement callback
          onNewMeasurement?.();
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
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Rel (m)', 'Alt (GPS)', 'Latitude', 'Longitude', 'UTC Date', 'UTC Time', 'Speed', 'Heading',
      'Min Height (m)', 'Max Height (m)', 'Warning Threshold (m)', 'Critical Threshold (m)'
    ];
    
    const csvContent = [
      headers.join(','),
      ...measurements.map(m => [
        m.rel.toFixed(2),
        m.altGPS.toFixed(2),
        m.latitude.toFixed(6),
        m.longitude.toFixed(6),
        m.utcDate,
        m.utcTime,
        m.speed.toFixed(1),
        m.heading.toFixed(1),
        alertSettings?.thresholds?.minHeight ?? 4,
        alertSettings?.thresholds?.maxHeight ?? 25,
        alertSettings?.thresholds?.warningThreshold ?? 0,
        alertSettings?.thresholds?.criticalThreshold ?? 0
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const filename = activeSurvey?.name
      ? `${activeSurvey.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${new Date().toISOString()}.csv`
      : `measurements_${new Date().toISOString()}.csv`;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Null safety: normalize measurements to empty array
  const safeMeasurements = Array.isArray(measurements) ? measurements : [];
  
  // Performance monitoring for large datasets (dev only)
  React.useEffect(() => {
    if (import.meta.env.DEV && safeMeasurements.length > 10000) {
      console.warn(
        `[MeasurementLogs] Large dataset detected: ${safeMeasurements.length} measurements. ` +
        `Virtualization is active to maintain performance.`
      );
    }
  }, [safeMeasurements.length]);
  
  // Virtualizer setup with production hardening
  const parentRef = React.useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: safeMeasurements.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => editingNote ? 80 : 60,
    overscan: 5,
    // Stable key based on measurement properties (not array index alone)
    getItemKey: (index: number) => {
      const item = safeMeasurements[index];
      if (!item) {
        if (import.meta.env.DEV) {
          console.error(`[MeasurementLogs] Item at index ${index} is null/undefined!`);
        }
        // Deterministic fallback: this should never happen, but use stable placeholder
        return `error-missing-null-item-${index}`;
      }
      // Use POI ID as the key (globally unique, stable across re-renders)
      return item.id || `fallback-${index}`;
    },
  });

  // Reset scroll position when survey changes or data is cleared
  React.useEffect(() => {
    if (virtualizer && parentRef.current) {
      parentRef.current.scrollTop = 0;
    }
  }, [activeSurvey?.id, safeMeasurements.length === 0]);

  // Row component for virtual scrolling
  const renderRow = (index: number) => {
    if (index >= safeMeasurements.length) return null;
    
    const m = safeMeasurements[index];
    return (
      <div
        className="grid grid-cols-[120px_100px_120px_120px_100px_100px_100px_200px_100px_100px] gap-2 px-4 py-2 border-t border-gray-700 hover:bg-gray-700"
        data-testid={`measurement-row-${index}`}
      >
        <div className="text-gray-300 font-mono text-sm flex items-center">
          {m.id ? m.id.substring(0, 8) : '-'}
        </div>
        <div className="text-gray-300 text-sm flex items-center">{m.rel.toFixed(3)}m</div>
        <div className="text-gray-300 text-sm flex items-center truncate" title={String(m.latitude)}>{m.latitude}</div>
        <div className="text-gray-300 text-sm flex items-center truncate" title={String(m.longitude)}>{m.longitude}</div>
        <div className="text-gray-300 text-sm flex items-center">{m.altGPS.toFixed(1)}m</div>
        <div className="text-gray-300 text-sm flex items-center">{m.mileMarker}</div>
        <div className="text-gray-300 text-sm flex items-center">{m.poiType}</div>
        <div className="text-gray-300 text-sm flex items-center">
          {editingNote === m.id ? (
            <div className="flex gap-1 w-full">
              <input
                type="text"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs"
                placeholder="Add note..."
              />
              <button
                onClick={() => {
                  setEditingNote(null);
                  setNoteText('');
                }}
                className="px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditingNote(null);
                  setNoteText('');
                }}
                className="px-2 py-1 bg-gray-600 hover:bg-gray-700 rounded text-xs"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className="truncate" title={m.note || '—'}>{m.note || '—'}</span>
              <button
                onClick={() => {
                  setEditingNote(m.id);
                  setNoteText(m.note || '');
                }}
                className="px-1 py-0.5 bg-gray-700 hover:bg-gray-600 rounded text-xs whitespace-nowrap"
              >
                {m.note ? 'Edit' : 'Add'}
              </button>
            </div>
          )}
        </div>
        <div className="text-gray-300 text-sm flex items-center justify-center">
          {m.timelapseFrameNumber !== null && m.timelapseFrameNumber !== undefined ? (
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('jumpToTimelapseFrame', { 
                  detail: { frameNumber: m.timelapseFrameNumber } 
                }));
                window.dispatchEvent(new CustomEvent('switchToTimelapseTab'));
              }}
              className="flex items-center gap-1 px-2 py-1 bg-purple-500/20 rounded hover:bg-purple-500/40 transition-colors"
              title={`Jump to frame ${m.timelapseFrameNumber}`}
              data-testid={`button-jump-to-frame-${index}`}
            >
              <Film className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-purple-400">{m.timelapseFrameNumber}</span>
            </button>
          ) : '-'}
        </div>
        <div className="text-gray-300 text-sm flex items-center">
          {m.imageFilename ? (
            <span className="text-blue-400 hover:underline cursor-pointer truncate" title={m.imageFilename}>
              {m.imageFilename}
            </span>
          ) : '-'}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <div className="flex items-center gap-4 mb-4">
        {activeSurvey ? (
          <div className="bg-green-500/20 border border-green-500/30 text-green-400 rounded-lg px-4 py-2 flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span>Active Survey: {activeSurvey.name}</span>
          </div>
        ) : (
          <div className="bg-yellow-500/20 border-l-4 border-yellow-500 p-4 rounded flex-1">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-yellow-500" />
              <div>
                <h3 className="font-bold text-yellow-500">No Active Survey</h3>
                <p className="text-gray-300">Please create a new survey to start logging measurements</p>
              </div>
            </div>
          </div>
        )}

        {!activeSurvey && (
          <div className="bg-yellow-500/20 border-l-4 border-yellow-500 p-4 rounded flex-1">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-yellow-500" />
              <div>
                <h3 className="font-bold text-yellow-500">No Active Survey</h3>
                <p className="text-gray-300">Please create a new survey to start logging measurements</p>
              </div>
            </div>
          </div>
        )}

        <select
          value={logMode}
          onChange={(e) => onLogModeChange(e.target.value as LogMode)}
          className="px-3 py-2 bg-gray-700 border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
          disabled={!activeSurvey}
        >
          <option>Manual</option>
          <option>All Data</option>
          <option>Object Detection</option>
        </select>

        <button 
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!activeSurvey}
          onClick={handleAddPOI}
          title={!activeSurvey ? "Create a survey first" : ""}
        >
          <MapPin className="w-5 h-5" />
          Add POI
          {capturedImage && <span className="w-2 h-2 bg-green-400 rounded-full ml-2" />}
        </button>

        <button 
          onClick={exportToCSV}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!activeSurvey || measurements.length === 0}
        >
          <Download className="w-5 h-5" />
          Export CSV
        </button>

        <button
          onClick={handleClearSurvey}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!activeSurvey || measurements.length === 0}
          title={!activeSurvey ? "Create a survey first" : measurements.length === 0 ? "No measurements to clear" : ""}
        >
          <Trash2 className="w-5 h-5" />
          Clear Survey
        </button>
        
        {activeSurvey && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-500/20 border border-green-500/30 text-green-400 rounded-full text-sm font-medium">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            Active Survey: {activeSurvey.name}
          </div>
        )}

        <button
          onClick={() => setShowSurveyDialog(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors ml-auto"
        >
          <Plus className="w-5 h-5" />
          {activeSurvey ? 'Edit Survey' : 'New Survey'}
        </button>
      </div>
      
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold mb-4">Clear Survey</h3>
            <p className="text-gray-300 mb-6">Are you sure you want to clear the active survey? This action cannot be undone.</p>
            <div className="flex justify-end gap-4">
              <button onClick={() => setShowClearConfirm(false)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg">Cancel</button>
              <button onClick={handleClearSurvey} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg">Clear Survey</button>
            </div>
          </div>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileImport}
            accept=".csv"
            className="hidden"
          />
          <button
            onClick={handleImportClick}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
            disabled={!activeSurvey}
          >
            <Upload className="w-5 h-5" />
            Import CSV
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <div className="min-w-[1200px]">
          {/* Table Header */}
          <div className="grid grid-cols-[120px_100px_120px_120px_100px_100px_100px_200px_100px_100px] gap-2 px-4 py-2 border-b border-gray-700 bg-gray-800">
            <div className="text-left text-gray-400 font-medium">POI ID</div>
            <div className="text-left text-gray-400 font-medium">Measurement</div>
            <div className="text-left text-gray-400 font-medium">Latitude</div>
            <div className="text-left text-gray-400 font-medium">Longitude</div>
            <div className="text-left text-gray-400 font-medium">Altitude</div>
            <div className="text-left text-gray-400 font-medium">Marker</div>
            <div className="text-left text-gray-400 font-medium">POI Type</div>
            <div className="text-left text-gray-400 font-medium">Notes</div>
            <div className="text-left text-gray-400 font-medium">Timelapse</div>
            <div className="text-left text-gray-400 font-medium">Image</div>
          </div>
          
          {/* Empty State */}
          {safeMeasurements.length === 0 && !activeSurvey && (
            <div className="px-4 py-8 text-center">
              <button
                onClick={handleStartSurvey}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm"
              >
                Start Survey
              </button>
            </div>
          )}
          
          {/* Virtualized List */}
          {safeMeasurements.length > 0 && (
            <VirtualizedListErrorBoundary>
              <div 
                ref={parentRef} 
                style={{ height: '500px', overflow: 'auto' }}
                data-testid="measurement-list-virtualized"
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
        </div>
      </div>

      <SurveyDialog
        isOpen={showSurveyDialog}
        onClose={() => setShowSurveyDialog(false)}
      />
    </div>
  );
};

export default MeasurementLogs;