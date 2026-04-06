import React from 'react';
import { Check, X, Edit, AlertTriangle } from 'lucide-react';
import type { Detection } from '../../lib/mockDetection';
import { useSettingsStore } from '../../lib/settings';

interface DetectionOverlayProps {
  detections: Detection[];
  onAccept?: (detection: Detection) => void;
  onReject?: (detection: Detection) => void;
  onCorrect?: (detection: Detection) => void;
  videoWidth: number;
  videoHeight: number;
}

const DetectionOverlay: React.FC<DetectionOverlayProps> = ({
  detections,
  onAccept,
  onReject,
  onCorrect,
  videoWidth,
  videoHeight,
}) => {
  const { aiSettings } = useSettingsStore();
  
  if (!aiSettings?.detectionOverlay || detections.length === 0) {
    return null;
  }

  // Get class color from settings
  const getClassColor = (objectClass: string): string => {
    const classInfo = aiSettings.classes?.find((c) => c.name === objectClass);
    return classInfo?.color || '#00FF00';
  };

  // Format class name for display
  const formatClassName = (className: string): string => {
    return className.replace(/_/g, ' ').split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  return (
    <div 
      className="absolute inset-0 pointer-events-none"
      style={{ width: videoWidth, height: videoHeight }}
    >
      {/* Detection Count Badge - top right */}
      {detections.length > 0 && (
        <div className="absolute top-2 right-2 pointer-events-auto">
          <div className="bg-blue-600 text-white px-3 py-1.5 rounded-full text-sm font-semibold shadow-lg flex items-center gap-2">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            {detections.length} {detections.length === 1 ? 'Detection' : 'Detections'}
          </div>
        </div>
      )}

      {/* Dismiss All Button - next to count badge */}
      {detections.length > 1 && onReject && (
        <div className="absolute top-2 right-40 pointer-events-auto">
          <button
            onClick={() => {
              // Reject all detections
              detections.forEach(detection => onReject(detection));
            }}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-800 text-white rounded-full flex items-center gap-2 text-sm font-semibold shadow-lg transition-colors"
            data-testid="button-dismiss-all-detections"
          >
            <X className="w-4 h-4" />
            Dismiss All ({detections.length})
          </button>
        </div>
      )}

      {detections.map((detection) => {
        const color = getClassColor(detection.objectClass);
        const x = detection.boundingBox.x * videoWidth;
        const y = detection.boundingBox.y * videoHeight;
        const width = detection.boundingBox.width * videoWidth;
        const height = detection.boundingBox.height * videoHeight;
        
        const isCriticalClearance = detection.metadata?.clearance && detection.metadata.clearance < 4.0;
        const isWarningClearance = detection.metadata?.clearance && detection.metadata.clearance >= 4.0 && detection.metadata.clearance < 4.2;
        
        return (
          <div
            key={detection.id}
            className="absolute"
            style={{
              left: `${x}px`,
              top: `${y}px`,
              width: `${width}px`,
              height: `${height}px`,
            }}
          >
            {/* Bounding Box */}
            <div
              className="absolute inset-0 border-2 rounded"
              style={{
                borderColor: color,
                boxShadow: `0 0 10px ${color}80`,
              }}
            />
            
            {/* Label Box */}
            <div
              className="absolute -top-8 left-0 px-2 py-1 rounded text-xs font-semibold flex items-center gap-2 shadow-lg"
              style={{
                backgroundColor: color,
                color: '#000',
              }}
            >
              <span>{formatClassName(detection.objectClass)}</span>
              <span className="opacity-75">{(detection.confidence * 100).toFixed(0)}%</span>
              
              {/* Clearance indicator */}
              {detection.metadata?.clearance && (
                <span className="ml-1 flex items-center gap-1">
                  {(isCriticalClearance || isWarningClearance) && (
                    <AlertTriangle className="w-3 h-3" />
                  )}
                  <span className="font-mono">{detection.metadata.clearance.toFixed(1)}m</span>
                </span>
              )}
            </div>
            
            {/* Action Buttons */}
            {(onAccept || onReject || onCorrect) && (
              <div className="absolute -bottom-8 left-0 flex gap-1.5 pointer-events-auto">
                {onAccept && (
                  <button
                    onClick={() => onAccept(detection)}
                    className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded flex items-center gap-1 text-xs shadow-lg transition-colors"
                    data-testid={`button-accept-detection-${detection.id}`}
                  >
                    <Check className="w-3 h-3" />
                    Accept
                  </button>
                )}
                
                {onCorrect && (
                  <button
                    onClick={() => onCorrect(detection)}
                    className="px-2 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded flex items-center gap-1 text-xs shadow-lg transition-colors"
                    data-testid={`button-correct-detection-${detection.id}`}
                  >
                    <Edit className="w-3 h-3" />
                    Correct
                  </button>
                )}
                
                {onReject && (
                  <button
                    onClick={() => onReject(detection)}
                    className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded flex items-center gap-1 text-xs shadow-lg transition-colors"
                    data-testid={`button-reject-detection-${detection.id}`}
                  >
                    <X className="w-3 h-3" />
                    Reject
                  </button>
                )}
              </div>
            )}
            
            {/* Critical Clearance Alert */}
            {isCriticalClearance && (
              <div className="absolute top-full mt-1 left-0 bg-red-600 text-white px-2 py-1 rounded text-xs font-semibold animate-pulse shadow-lg">
                ⚠️ CRITICAL CLEARANCE
              </div>
            )}
            
            {/* Warning Clearance */}
            {isWarningClearance && (
              <div className="absolute top-full mt-1 left-0 bg-yellow-600 text-white px-2 py-1 rounded text-xs font-semibold shadow-lg">
                ⚠️ LOW CLEARANCE
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default DetectionOverlay;
