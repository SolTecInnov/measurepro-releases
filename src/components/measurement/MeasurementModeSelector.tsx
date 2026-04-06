import { useState } from 'react';
import { Play, Square, Download, AlertCircle, CheckCircle, Ruler } from 'lucide-react';
import { useCalibrationStore } from '@/stores/calibrationStore';
import { useDetectionStore } from '@/lib/stores/detectionStore';
import { useSerialStore } from '@/lib/stores/serialStore';
import { useSettingsStore } from '@/lib/settings';
import { getAllMeasurements } from '@/lib/storage/measurement-storage';
import { exportToCSV } from '@/lib/export/measurement-export';

const measurementModes = {
  BRIDGE_SURVEY: {
    displayName: 'Bridge Clearance Survey',
    icon: '🌉',
    description: 'Measure minimum bridge clearance for compliance'
  },
  LANE_WIDTH: {
    displayName: 'Lane Width Measurement',
    icon: '↔️',
    description: 'Measure lane widths and road dimensions'
  },
  TRAFFIC_SIGNALS: {
    displayName: 'Traffic Signal Survey',
    icon: '🚦',
    description: 'Measure signal clearances and spacing'
  },
  RAILROAD_STRUCTURE: {
    displayName: 'Railroad Overhead',
    icon: '🚂',
    description: 'Measure railroad overhead clearances'
  }
};

type MeasurementModeKey = keyof typeof measurementModes;

interface MeasurementModeSelectorProps {
  onModeChange?: (mode: MeasurementModeKey) => void;
  onMeasurementToggle?: (active: boolean) => void;
  onCameraHeightChange?: (height: number) => void;
  onReferenceHeightChange?: (height: number | null) => void;
}

export default function MeasurementModeSelector({
  onModeChange,
  onMeasurementToggle,
  onCameraHeightChange,
  onReferenceHeightChange
}: MeasurementModeSelectorProps) {
  const [selectedMode, setSelectedMode] = useState<MeasurementModeKey>('BRIDGE_SURVEY');
  const [cameraHeight, setCameraHeight] = useState<number>(1.5);
  const [referenceHeight, setReferenceHeight] = useState<string>('');
  const [isMeasuring, setIsMeasuring] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  
  const { calibrationData } = useCalibrationStore();
  const { activeDetections } = useDetectionStore();
  const { lastMeasurement } = useSerialStore();
  const { aiSettings } = useSettingsStore();
  
  const isCalibrated = !!(
    calibrationData?.focalLength &&
    calibrationData?.principalPoint &&
    calibrationData?.cameraMatrix &&
    aiSettings?.enabled
  );

  const handleModeChange = (mode: string) => {
    setSelectedMode(mode as MeasurementModeKey);
    onModeChange?.(mode as MeasurementModeKey);
  };

  const handleCameraHeightChange = (value: string) => {
    const height = parseFloat(value);
    if (!isNaN(height) && height > 0) {
      setCameraHeight(height);
      onCameraHeightChange?.(height);
    }
  };

  const handleReferenceHeightChange = (value: string) => {
    setReferenceHeight(value);
    const height = parseFloat(value);
    onReferenceHeightChange?.(isNaN(height) ? null : height);
  };

  const toggleMeasurement = () => {
    if (!isCalibrated) {
      alert('Camera must be calibrated before starting measurements. Please calibrate in Settings > Camera.');
      return;
    }
    
    const newState = !isMeasuring;
    setIsMeasuring(newState);
    onMeasurementToggle?.(newState);
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const measurements = await getAllMeasurements();
      
      if (measurements.length === 0) {
        alert('No measurements to export. Capture some measurements first.');
        return;
      }
      
      exportToCSV(measurements);
    } catch (error) {
      alert('Failed to export measurements. Check console for details.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700" data-testid="measurement-mode-selector">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Ruler className="w-5 h-5 text-blue-400" />
        <h2 className="text-xl font-bold text-white">Measurement Configuration</h2>
      </div>

      {/* Calibration Status */}
      <div className="mb-4 p-3 rounded-lg border" data-testid="status-calibration">
        {isCalibrated ? (
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">Camera Calibrated - Ready to Measure</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-yellow-400">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">Camera Not Calibrated - Configure in Settings</span>
          </div>
        )}
      </div>

      {/* AI Detection Status - Add after Calibration Status */}
      {!aiSettings?.enabled && (
        <div className="mb-4 p-3 rounded-lg border border-yellow-600 bg-yellow-900/20" data-testid="status-ai-disabled">
          <div className="flex items-center gap-2 text-yellow-400">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">AI Detection Disabled - Enable in Settings → AI+</span>
          </div>
        </div>
      )}

      {/* Measurement Mode Selector */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Measurement Mode
        </label>
        <select
          value={selectedMode}
          onChange={(e) => handleModeChange(e.target.value)}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
          data-testid="select-measurement-mode"
        >
          {Object.entries(measurementModes || {}).map(([key, mode]) => (
            <option key={key} value={key}>
              {mode.icon} {mode.displayName}
            </option>
          ))}
        </select>
        <p className="mt-1 text-sm text-gray-400">
          {measurementModes[selectedMode].description}
        </p>
      </div>

      {/* Camera Height Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Camera Height Above Ground (meters)
        </label>
        <input
          type="number"
          step="0.1"
          min="0.1"
          max="10"
          value={cameraHeight}
          onChange={(e) => handleCameraHeightChange(e.target.value)}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
          data-testid="input-camera-height"
        />
        <p className="mt-1 text-sm text-gray-400">
          Default: 1.5m (typical dashboard camera height)
        </p>
      </div>

      {/* Reference Height Input (Optional) */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Known Reference Height (Optional)
        </label>
        <input
          type="number"
          step="0.1"
          min="0"
          value={referenceHeight}
          onChange={(e) => handleReferenceHeightChange(e.target.value)}
          placeholder="Enter known height for validation"
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
          data-testid="input-reference-height"
        />
        <p className="mt-1 text-sm text-gray-400">
          Use for calibration validation and accuracy verification
        </p>
      </div>

      {/* Measurement Status */}
      <div className="mb-4 p-3 bg-gray-750 rounded-lg border border-gray-600" data-testid="measurement-status">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-400">Active Detections:</span>
            <span className="ml-2 font-bold text-white">{activeDetections.length}</span>
          </div>
          <div>
            <span className="text-gray-400">Laser Reading:</span>
            <span className="ml-2 font-bold text-white">{lastMeasurement || '--'}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={toggleMeasurement}
          disabled={!isCalibrated}
          className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
            isMeasuring
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-600 disabled:cursor-not-allowed'
          }`}
          data-testid="button-toggle-measurement"
        >
          {isMeasuring ? (
            <>
              <Square className="w-4 h-4" />
              Stop
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Start
            </>
          )}
        </button>

        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
          data-testid="button-export-data"
        >
          <Download className="w-4 h-4" />
          {exporting ? 'Exporting...' : 'Export Data'}
        </button>
      </div>
    </div>
  );
}
