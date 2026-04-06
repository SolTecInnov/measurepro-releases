import { useState, useEffect } from 'react';
import { Camera, Trash2, CheckCircle, XCircle, AlertTriangle, AlertCircle } from 'lucide-react';
import { useCalibrationStore } from '@/stores/calibrationStore';
import { useDetectionStore } from '@/lib/stores/detectionStore';
import { useSerialStore } from '@/lib/stores/serialStore';
import { useGPSStore } from '@/lib/stores/gpsStore';
import { useSettingsStore } from '@/lib/settings';
import { saveMeasurement, getAllMeasurements, clearAllMeasurements } from '@/lib/storage/measurement-storage';
import { measureBridgeMinimumClearance, validateCameraMeasurement, getLaserMeasurement } from '@/lib/opencv/specialized-measurements';
import { MeasurementRecord } from '@/types/measurements';

interface MeasurementControlsProps {
  videoElement?: HTMLVideoElement | null;
  cameraHeight?: number;
}

export default function MeasurementControls({
  videoElement,
  cameraHeight = 1.5
}: MeasurementControlsProps) {
  const [measurementHistory, setMeasurementHistory] = useState<MeasurementRecord[]>([]);
  const [latestMeasurement, setLatestMeasurement] = useState<MeasurementRecord | null>(null);
  const [validationStatus, setValidationStatus] = useState<'VALIDATED' | 'NEEDS_REVIEW' | null>(null);
  const [saving, setSaving] = useState(false);

  const { calibrationData } = useCalibrationStore();
  const { activeDetections } = useDetectionStore();
  const { lastMeasurement } = useSerialStore();
  const { data: gpsData } = useGPSStore();
  const { aiSettings } = useSettingsStore();

  const isCalibrated = !!(
    calibrationData?.focalLength &&
    calibrationData?.principalPoint &&
    calibrationData?.cameraMatrix &&
    aiSettings?.enabled
  );

  useEffect(() => {
    loadMeasurementHistory();
  }, []);

  const loadMeasurementHistory = async () => {
    try {
      const measurements = await getAllMeasurements();
      setMeasurementHistory(measurements.slice(-10).reverse());
    } catch (error) {
    }
  };

  const captureMeasurement = async () => {
    if (!isCalibrated) {
      alert('Camera must be calibrated before capturing measurements.');
      return;
    }

    if (!videoElement) {
      alert('Video element not available.');
      return;
    }

    if (activeDetections.length === 0) {
      alert('No detections available. Wait for AI to detect structures.');
      return;
    }

    try {
      setSaving(true);

      const result = await measureBridgeMinimumClearance(
        activeDetections,
        calibrationData!,
        videoElement,
        cameraHeight
      );

      if ('error' in result) {
        alert(result.error);
        return;
      }

      const laserMeasurement = await getLaserMeasurement(lastMeasurement);
      let validatedResult = null;
      let validationCheck = null;

      if (laserMeasurement) {
        const cameraMeasurement = result.minimumClearance.camera!.value;
        validationCheck = validateCameraMeasurement(cameraMeasurement, laserMeasurement.value);
        
        setValidationStatus(validationCheck.status);

        validatedResult = {
          value: validationCheck.recommendedValue,
          status: validationCheck.status,
          confidence: validationCheck.confidence
        };
      }

      const canvas = document.createElement('canvas');
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(videoElement, 0, 0);
      const imageDataUrl = canvas.toDataURL('image/png');

      const measurementRecord: MeasurementRecord = {
        id: `measurement_${Date.now()}`,
        timestamp: Date.now(),
        location: {
          lat: gpsData.latitude,
          lon: gpsData.longitude
        },
        structureType: 'bridge',
        verticalClearance: {
          camera: result.minimumClearance.camera || null,
          laser: laserMeasurement,
          validated: validatedResult
        },
        horizontalMeasurements: {
          widths: [],
          spacings: []
        },
        tensorflowDetections: activeDetections,
        calibrationUsed: {
          focalLength: calibrationData?.focalLength || null,
          reprojectionError: calibrationData?.reprojectionError || null,
          calibrationDate: calibrationData?.calibrationDate || null
        },
        originalImage: imageDataUrl,
        annotatedImage: imageDataUrl,
        notes: '',
        complianceLevel: result.complianceLevel
      };

      const saved = await saveMeasurement(measurementRecord);

      if (saved) {
        setLatestMeasurement(measurementRecord);
        await loadMeasurementHistory();
      }
    } catch (error) {
      alert('Failed to capture measurement. Check console for details.');
    } finally {
      setSaving(false);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm('Are you sure you want to clear all measurement history? This cannot be undone.')) {
      return;
    }

    try {
      await clearAllMeasurements();
      setMeasurementHistory([]);
      setLatestMeasurement(null);
    } catch (error) {
      alert('Failed to clear measurement history.');
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700" data-testid="measurement-controls">
      <h2 className="text-xl font-bold text-white mb-4">Measurement Controls</h2>

      {/* AI Detection Status */}
      {!aiSettings?.enabled && (
        <div className="mb-4 p-3 rounded-lg border border-yellow-600 bg-yellow-900/20" data-testid="status-ai-disabled">
          <div className="flex items-center gap-2 text-yellow-400">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">AI Detection Disabled - Enable in Settings → AI+</span>
          </div>
        </div>
      )}

      {/* Active Measurement Display */}
      <div className="mb-6 p-4 bg-gray-750 rounded-lg border border-gray-600" data-testid="display-active-measurement">
        <h3 className="text-sm font-medium text-gray-400 mb-2">Latest Measurement</h3>
        {latestMeasurement ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Clearance:</span>
              <span className="text-2xl font-bold text-white">
                {latestMeasurement.verticalClearance.validated?.value.toFixed(2) || 
                 latestMeasurement.verticalClearance.camera?.value.toFixed(2) || '--'}m
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Compliance:</span>
              <span className={`font-bold ${
                latestMeasurement.complianceLevel === 'COMPLIANT' ? 'text-green-400' : 'text-red-400'
              }`}>
                {latestMeasurement.complianceLevel}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No measurements captured yet</p>
        )}
      </div>

      {/* Compliance Status */}
      <div className="mb-6 p-4 rounded-lg border" data-testid="display-compliance-status">
        <h3 className="text-sm font-medium text-gray-400 mb-2">Compliance Status</h3>
        {latestMeasurement?.complianceLevel === 'COMPLIANT' ? (
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">Structure meets clearance requirements</span>
          </div>
        ) : latestMeasurement?.complianceLevel === 'RESTRICTED' ? (
          <div className="flex items-center gap-2 text-red-400">
            <XCircle className="w-5 h-5" />
            <span className="font-medium">Structure below minimum clearance</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-gray-400">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">No compliance data available</span>
          </div>
        )}
      </div>

      {/* Laser Validation Status */}
      <div className="mb-6 p-4 bg-gray-750 rounded-lg border border-gray-600" data-testid="display-laser-validation">
        <h3 className="text-sm font-medium text-gray-400 mb-2">Laser Cross-Validation</h3>
        {validationStatus ? (
          <div className={`flex items-center gap-2 ${
            validationStatus === 'VALIDATED' ? 'text-green-400' : 'text-yellow-400'
          }`}>
            {validationStatus === 'VALIDATED' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
            <span className="font-medium">{validationStatus}</span>
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No validation data available</p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={captureMeasurement}
          disabled={saving || !isCalibrated}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
          data-testid="button-capture-measurement"
        >
          <Camera className="w-4 h-4" />
          {saving ? 'Saving...' : 'Capture'}
        </button>

        <button
          onClick={handleClearHistory}
          disabled={measurementHistory.length === 0}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
          data-testid="button-clear-history"
        >
          <Trash2 className="w-4 h-4" />
          Clear
        </button>
      </div>

      {/* Measurement History */}
      <div data-testid="list-measurement-history">
        <h3 className="text-sm font-medium text-gray-400 mb-2">Recent Measurements</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {measurementHistory.length > 0 ? (
            measurementHistory.map((measurement, index) => (
              <div
                key={measurement.id}
                className="p-3 bg-gray-750 rounded-lg border border-gray-600"
                data-testid={`measurement-item-${index}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-400">
                    {formatTimestamp(measurement.timestamp)}
                  </span>
                  <span className={`text-sm font-bold ${
                    measurement.complianceLevel === 'COMPLIANT' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {measurement.complianceLevel}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Clearance:</span>
                  <span className="font-bold text-white">
                    {measurement.verticalClearance.validated?.value.toFixed(2) ||
                     measurement.verticalClearance.camera?.value.toFixed(2) || '--'}m
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-sm text-center py-4">
              No measurement history available
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
