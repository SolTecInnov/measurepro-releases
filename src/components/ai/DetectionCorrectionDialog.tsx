import React, { useState, useEffect } from 'react';
import { X, Edit2, CheckCircle } from 'lucide-react';
import { POI_TYPES, type POIType } from '../../lib/poi';
import type { Detection } from '../../lib/mockDetection';
import { toast } from 'sonner';

interface DetectionCorrectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  detection: Detection | null;
  onSubmit: (detectionId: string, correctedClass: string) => void;
}

const DetectionCorrectionDialog: React.FC<DetectionCorrectionDialogProps> = ({
  isOpen,
  onClose,
  detection,
  onSubmit
}) => {
  const [selectedClass, setSelectedClass] = useState<string>('');

  // Initialize selected class when detection changes
  useEffect(() => {
    if (detection) {
      // Try to match the detected class to a POI type
      const matchingPOI = POI_TYPES.find(poi => 
        poi.label.toLowerCase().includes(detection.objectClass.toLowerCase()) ||
        detection.objectClass.toLowerCase().includes(poi.label.toLowerCase())
      );
      setSelectedClass(matchingPOI?.type || '');
    }
  }, [detection]);

  if (!isOpen || !detection) return null;

  const handleSubmit = () => {
    if (!selectedClass) {
      toast.error('Please select a class');
      return;
    }

    onSubmit(detection.id, selectedClass);
    toast.success('Detection corrected successfully');
    onClose();
  };

  // Get POI config for current detection
  const currentPOI = POI_TYPES.find(poi => 
    poi.label.toLowerCase().includes(detection.objectClass.toLowerCase())
  );
  const selectedPOI = POI_TYPES.find(poi => poi.type === selectedClass);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl w-full max-w-2xl p-6 mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600 rounded-lg">
              <Edit2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Correct Detection</h2>
              <p className="text-sm text-gray-400">Fix misclassified object detection</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-300"
            data-testid="button-close-correction-dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Detection Info */}
          <div className="bg-gray-700 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Current Detection</h3>
            
            <div className="flex items-center gap-4">
              {/* Bounding Box Thumbnail */}
              {detection.boundingBox && (
                <div className="w-24 h-24 bg-gray-900 rounded-lg border-2 border-purple-500 flex items-center justify-center">
                  <div 
                    className="text-xs text-gray-400 text-center px-2"
                    title={`Position: (${Math.round(detection.boundingBox.x * 100)}, ${Math.round(detection.boundingBox.y * 100)})`}
                  >
                    <div className="font-mono text-[10px]">
                      {Math.round(detection.boundingBox.width * 100)}×{Math.round(detection.boundingBox.height * 100)}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Detection Details */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {currentPOI?.icon && (
                    <currentPOI.icon className={`w-5 h-5 ${currentPOI.color}`} />
                  )}
                  <span className="font-semibold text-lg">{detection.objectClass}</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Confidence:</span>
                    <span className="font-mono font-semibold text-purple-400">
                      {(detection.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Detection ID:</span>
                    <span className="font-mono text-xs">{detection.id.substring(0, 8)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Correct Class Selector */}
          <div className="bg-gray-700 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-400 mb-3">
              Correct Class *
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-4 py-3 bg-gray-600 border border-gray-500 text-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              data-testid="select-correct-class"
            >
              <option value="">-- Select Correct Class --</option>
              {POI_TYPES.filter(poi => poi.type !== '').map((poiType) => (
                <option key={poiType.type} value={poiType.type}>
                  {poiType.label}
                </option>
              ))}
            </select>
            
            {/* Selected Class Preview */}
            {selectedPOI && (
              <div className={`mt-3 p-3 rounded-lg ${selectedPOI.bgColor}`}>
                <div className="flex items-center gap-2">
                  <selectedPOI.icon className={`w-5 h-5 ${selectedPOI.color}`} />
                  <span className={`font-medium ${selectedPOI.color}`}>
                    {selectedPOI.label}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
              data-testid="button-cancel-correction"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
              data-testid="button-submit-correction"
            >
              <CheckCircle className="w-5 h-5" />
              Submit Correction
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetectionCorrectionDialog;
