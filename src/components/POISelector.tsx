import React from 'react';
import { POI_TYPES } from '../lib/poi';
import type { POIType } from '../lib/poi';
import { usePOIActionsStore } from '../lib/poiActions';
import { toast } from 'sonner';

interface POISelectorProps {
  selectedType: POIType | '';
  setSelectedType: (type: POIType | '') => void;
  onAutoCaptureNoMeasurement?: () => void;
  onModalOpenRequested?: (poiType: POIType) => void;
  onVoiceNoteRequested?: () => void;
  activeSurvey?: { id: string } | null;
  loggingMode?: string;
  isLogging?: boolean;
}

const POISelector: React.FC<POISelectorProps> = ({ 
  selectedType, 
  setSelectedType,
  onAutoCaptureNoMeasurement,
  onModalOpenRequested,
  onVoiceNoteRequested,
  activeSurvey,
  loggingMode,
  isLogging
}) => {
  const { getActionForPOI } = usePOIActionsStore();

  const triggerActionForType = (poiType: POIType) => {
    const action = getActionForPOI(poiType);
    switch (action) {
      case 'auto-capture-and-log':
        break;
      case 'auto-capture-no-measurement':
        if (!activeSurvey) {
          toast.error('No active survey', { description: 'Please create a survey before logging POI.' });
          return;
        }
        if (!loggingMode || loggingMode === 'none' || loggingMode === 'off') {
          toast.error('No measurement capture mode selected', { description: 'Please select a measurement capture mode before logging POI.' });
          return;
        }
        if (!isLogging) {
          toast.error('Logging not active', { description: 'Please start logging before capturing POI.' });
          return;
        }
        onAutoCaptureNoMeasurement?.();
        break;
      case 'open-manual-modal':
        if (!activeSurvey) {
          toast.error('No active survey', { description: 'Please create a survey before logging POI.' });
          return;
        }
        if (!loggingMode || loggingMode === 'none' || loggingMode === 'off') {
          toast.error('No measurement capture mode selected', { description: 'Please select a measurement capture mode before logging POI.' });
          return;
        }
        onModalOpenRequested?.(poiType);
        break;
      case 'voice-note':
        if (!activeSurvey) {
          toast.error('No active survey', { description: 'Please create a survey before logging POI.' });
          return;
        }
        if (!loggingMode || loggingMode === 'none' || loggingMode === 'off') {
          toast.error('No measurement capture mode selected', { description: 'Please select a measurement capture mode before logging POI.' });
          return;
        }
        onVoiceNoteRequested?.();
        break;
    }
  };

  return (
    <div className="h-full">
      <h3 className="text-sm font-medium text-gray-400 mb-1">Active POI Type</h3>
      <select
        value={selectedType}
        onChange={(e) => {
          const newType = e.target.value as POIType;
          console.log(`[POISelector] User selected POI type: "${newType}"`);
          setSelectedType(newType);
          if (newType) triggerActionForType(newType);
        }}
        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
      >
        {POI_TYPES.map((poiType) => (
          <option key={poiType.type} value={poiType.type}>
            {poiType.label}
          </option>
        ))}
      </select>
      
      <div className={`mt-3 px-3 py-3 rounded-lg ${
        POI_TYPES.find(p => p.type === selectedType)?.bgColor
      }`}>
        <div className="flex flex-col items-center justify-center gap-2">
          {(() => {
            const poiType = POI_TYPES.find(p => p.type === selectedType);
            if (poiType) {
              const Icon = poiType.icon;
              return (
                <>
                  <Icon className={`w-6 h-6 ${poiType.color}`} />
                  <span className={`text-sm font-medium ${poiType.color}`}>
                    {poiType.label}
                  </span>
                </>
              );
            }
            return null;
          })()}
        </div>
      </div>
    </div>
  );
};

export default POISelector;
