import React from 'react';
import { ArrowDown, RefreshCw } from 'lucide-react';
import { useSettingsStore } from '../../lib/settings';
import { formatMeasurementDual, formatMeasurement } from '../../lib/utils/unitConversion';

interface MinimumDistanceCardProps {
  minDistance: string;
  groundReferenceHeight: number;
  minDistanceHistory: string[];
  minDistanceColumns: number;
  hasTriggeredAlert: boolean;
  onResetMin: () => void;
  cardRef: React.RefObject<HTMLDivElement>;
}

const MinimumDistanceCard: React.FC<MinimumDistanceCardProps> = ({
  minDistance,
  groundReferenceHeight,
  minDistanceHistory,
  minDistanceColumns,
  hasTriggeredAlert,
  onResetMin,
  cardRef
}) => {
  const { displaySettings } = useSettingsStore();
  const units = displaySettings.units;
  const [localMinDistance, setLocalMinDistance] = React.useState(minDistance);
  
  // Update local state when prop changes
  React.useEffect(() => {
    setLocalMinDistance(minDistance);
  }, [minDistance]);
  
  // Handle reset with local state update
  const handleReset = () => {
    setLocalMinDistance('--');
    onResetMin();
  };

  const isInvalidMeasurement = (value: string | null): boolean => {
    if (!value) return true;
    return value === 'infinity' || 
           value === 'DE02' || 
           value.includes('DE02') || 
           value === '--' || 
           value === 'NaN' || 
           value === 'undefined' || 
           value === 'null' || 
           value === '';
  };
  
  // Calculate adjusted measurement
  const getAdjustedMeasurement = () => {
    if (localMinDistance !== '--' && !isInvalidMeasurement(localMinDistance) && !isNaN(parseFloat(localMinDistance))) {
      return parseFloat(localMinDistance) + groundReferenceHeight;
    }
    return '--';
  };
  
  const adjustedValue = getAdjustedMeasurement();
  const displayValue = formatMeasurementDual(adjustedValue, units);

  return (
    <div ref={cardRef} className="bg-gray-800 p-4 rounded-xl h-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-400 flex items-center gap-2">
          <ArrowDown className="w-4 h-4 text-blue-400" />
          Minimum Distance
        </h3>
        <div className="flex items-center gap-2">
          {hasTriggeredAlert && (
            <div className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
              Alert Triggered
            </div>
          )}
          <button
            onClick={handleReset}
            className="p-1 hover:bg-gray-700 rounded-lg transition-colors"
            title="Reset minimum distance"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="font-mono">
        <div className="text-3xl font-bold">
          {displayValue.primary}
        </div>
        <div className="text-lg text-gray-400">
          {displayValue.secondary}
        </div>
      </div>
      
      {/* Previous minimum distances history */}
      {minDistanceHistory.length > 0 && (
        <div className="mt-3 pt-2 border-t border-gray-700">
          <div className="text-xs text-gray-500 mb-2">Previous {minDistanceHistory.length} minimums:</div>
          <div 
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${minDistanceColumns}, minmax(0, 1fr))` }}
          >
            {minDistanceHistory.map((measurement, index) => {
              const formatted = formatMeasurement(measurement, units, { shortFormat: true });
              return (
                <span 
                  key={index} 
                  className="text-base bg-gray-700/70 text-gray-200 px-3 py-2 rounded font-mono text-center border border-gray-600 min-w-0 truncate"
                  title={formatted}
                >
                  {formatted}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default MinimumDistanceCard;