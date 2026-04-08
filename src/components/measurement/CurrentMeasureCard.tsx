import React from 'react';
import { Ruler } from 'lucide-react';
import { useSettingsStore } from '../../lib/settings';
import { formatMeasurementDual } from '../../lib/utils/unitConversion';

interface CurrentMeasureCardProps {
  lastMeasurement: string;
  groundReferenceHeight: number;
  thresholds: {
    minHeight: number;
    maxHeight: number;
    warningThreshold: number;
    criticalThreshold: number;
  };
}

const CurrentMeasureCard: React.FC<CurrentMeasureCardProps> = ({
  lastMeasurement,
  groundReferenceHeight,
  thresholds
}) => {
  const { displaySettings } = useSettingsStore();
  const units = displaySettings.units;

  // Force re-render when measurement changes
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);

  // Laser activity indicator — blinks when data is received (including DE02/sky)
  const [laserActive, setLaserActive] = React.useState(false);
  const [blinkOn, setBlinkOn] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout>>();
  const blinkRef = React.useRef<ReturnType<typeof setTimeout>>();

  React.useEffect(() => {
    const handleLaserUpdate = () => {
      forceUpdate();

      // Signal that laser data is arriving
      setLaserActive(true);
      setBlinkOn(prev => !prev);

      // Clear previous blink timeout
      if (blinkRef.current) clearTimeout(blinkRef.current);
      blinkRef.current = setTimeout(() => setBlinkOn(prev => !prev), 150);

      // Reset inactive timeout — if no data for 2s, laser is considered inactive
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setLaserActive(false), 2000);
    };

    window.addEventListener('laser-measurement-update', handleLaserUpdate as EventListener);

    return () => {
      window.removeEventListener('laser-measurement-update', handleLaserUpdate as EventListener);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (blinkRef.current) clearTimeout(blinkRef.current);
    };
  }, []);
  
  // Calculate current values
  const getCurrentMeasurement = () => {
    if (!lastMeasurement || lastMeasurement === '--' || lastMeasurement === 'infinity') {
      // Keep displaying "--" for sky readings (no target)
      return formatMeasurementDual('--', units);
    }
    
    const numValue = parseFloat(lastMeasurement);
    if (isNaN(numValue)) {
      // Keep displaying "--" for invalid readings
      return formatMeasurementDual('--', units);
    }
    
    const validGroundRef = isNaN(groundReferenceHeight) ? 0.0 : groundReferenceHeight;
    const adjustedValue = numValue + validGroundRef;
    
    // CRITICAL: Only display measurements that are within valid range for logging consistency
    if (adjustedValue < thresholds.minHeight || adjustedValue > thresholds.maxHeight) {
      return formatMeasurementDual('--', units);
    }
    
    return formatMeasurementDual(adjustedValue, units);
  };
  
  const currentMeasurement = getCurrentMeasurement();
  
  return (
    <div className="bg-gray-800 p-4 rounded-xl h-full space-y-3">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-400 flex items-center gap-2">
            <Ruler className="w-4 h-4 text-blue-400" />
            Current Measure
            <span
              className={`inline-block w-2 h-2 rounded-full transition-opacity duration-100 ${
                laserActive
                  ? blinkOn ? 'bg-green-400 opacity-100' : 'bg-green-400 opacity-30'
                  : 'bg-gray-600 opacity-50'
              }`}
              title={laserActive ? 'Laser data active' : 'No laser data'}
            />
          </h3>
        </div>
        <div className="font-mono">        
          <div className="text-3xl font-bold">
            {currentMeasurement.primary}
          </div>
          <div className="text-lg text-gray-400">
            {currentMeasurement.secondary}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CurrentMeasureCard;