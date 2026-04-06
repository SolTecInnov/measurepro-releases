import React from 'react';
import { ArrowUp, RefreshCw } from 'lucide-react';
import { useSettingsStore } from '../../lib/settings';
import { formatMeasurementDual, formatMeasurement } from '../../lib/utils/unitConversion';

interface MaximumDistanceCardProps {
  maxDistance: string;
  groundReferenceHeight: number;
  maxDistanceHistory: string[];
  maxDistanceColumns: number;
  onResetMax: () => void;
  cardRef: React.RefObject<HTMLDivElement>;
}

const MaximumDistanceCard: React.FC<MaximumDistanceCardProps> = ({
  maxDistance,
  groundReferenceHeight,
  maxDistanceHistory,
  maxDistanceColumns,
  onResetMax,
  cardRef
}) => {
  const { displaySettings } = useSettingsStore();
  const units = displaySettings.units;
  const [localMaxDistance, setLocalMaxDistance] = React.useState(maxDistance);
  
  // Update local state when prop changes
  React.useEffect(() => {
    setLocalMaxDistance(maxDistance);
  }, [maxDistance]);
  
  // Handle reset with local state update
  const handleReset = () => {
    setLocalMaxDistance('--');
    onResetMax();
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
    if (localMaxDistance !== '--' && !isInvalidMeasurement(localMaxDistance) && !isNaN(parseFloat(localMaxDistance))) {
      return parseFloat(localMaxDistance) + groundReferenceHeight;
    }
    return '--';
  };
  
  const adjustedValue = getAdjustedMeasurement();
  const displayValue = formatMeasurementDual(adjustedValue, units);

  return (
    <div ref={cardRef} className="bg-gray-800 p-4 rounded-xl h-full" data-testid="card-maximum-distance">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-400 flex items-center gap-2">
          <ArrowUp className="w-4 h-4 text-blue-400" />
          Maximum Distance
        </h3>
        <button
          onClick={handleReset}
          className="p-1 hover:bg-gray-700 rounded-lg transition-colors"
          title="Reset maximum distance"
          data-testid="button-reset-max"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
      <div className="font-mono">
        <div className="text-3xl font-bold" data-testid="text-max-distance-primary">
          {displayValue.primary}
        </div>
        <div className="text-lg text-gray-400" data-testid="text-max-distance-secondary">
          {displayValue.secondary}
        </div>
      </div>
      
      {/* Previous maximum distances history */}
      {maxDistanceHistory.length > 0 && (
        <div className="mt-3 pt-2 border-t border-gray-700">
          <div className="text-xs text-gray-500 mb-2">Previous {maxDistanceHistory.length} maximums:</div>
          <div 
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${maxDistanceColumns}, minmax(0, 1fr))` }}
          >
            {maxDistanceHistory.map((measurement, index) => {
              const formatted = formatMeasurement(measurement, units, { shortFormat: true });
              return (
                <span 
                  key={index} 
                  className="text-base bg-gray-700/70 text-gray-200 px-3 py-2 rounded font-mono text-center border border-gray-600 min-w-0 truncate"
                  title={formatted}
                  data-testid={`text-max-history-${index}`}
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

export default MaximumDistanceCard;
