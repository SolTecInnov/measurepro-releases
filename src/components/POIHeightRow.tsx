import POISelector from './POISelector';
import HeightSettingsCard from './measurement/HeightSettingsCard';
import { useLaserStore } from '../lib/laser';
import { useSettingsStore } from '../lib/settings';
import type { POIType } from '../lib/poi';

interface POIHeightRowProps {
  selectedType: POIType | '';
  setSelectedType: (type: POIType | '') => void;
  onAutoCaptureNoMeasurement?: () => void;
  onModalOpenRequested?: (poiType: POIType) => void;
  onVoiceNoteRequested?: () => void;
  activeSurvey?: { id: string } | null;
  loggingMode?: string;
  isLogging?: boolean;
}

const POIHeightRow: React.FC<POIHeightRowProps> = ({ 
  selectedType, 
  setSelectedType,
  onAutoCaptureNoMeasurement,
  onModalOpenRequested,
  onVoiceNoteRequested,
  activeSurvey,
  loggingMode,
  isLogging
}) => {
  const { groundReferenceHeight } = useLaserStore();
  const { alertSettings } = useSettingsStore();
  
  const thresholds = alertSettings?.thresholds || {
    minHeight: 0,
    maxHeight: 25,
    warningThreshold: 4.2,
    criticalThreshold: 4.0
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="bg-gray-800 p-3 rounded-xl">
        <POISelector
          selectedType={selectedType}
          setSelectedType={setSelectedType}
          onAutoCaptureNoMeasurement={onAutoCaptureNoMeasurement}
          onModalOpenRequested={onModalOpenRequested}
          onVoiceNoteRequested={onVoiceNoteRequested}
          activeSurvey={activeSurvey}
          loggingMode={loggingMode}
          isLogging={isLogging}
        />
      </div>
      <div className="bg-gray-800 p-3 rounded-xl">
        <HeightSettingsCard
          groundReferenceHeight={groundReferenceHeight}
          thresholds={thresholds}
        />
      </div>
    </div>
  );
};

export default POIHeightRow;
