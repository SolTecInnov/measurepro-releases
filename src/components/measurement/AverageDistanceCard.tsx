import React from 'react';
import { TrendingUp, RefreshCw } from 'lucide-react';
import { useSettingsStore } from '../../lib/settings';
import { formatMeasurementDual } from '../../lib/utils/unitConversion';

interface AverageDistanceCardProps {
  measurementHistory: string[];
  groundReferenceHeight: number;
  onResetAverage: () => void;
  cardRef: React.RefObject<HTMLDivElement>;
}

const AverageDistanceCard: React.FC<AverageDistanceCardProps> = ({
  measurementHistory,
  groundReferenceHeight,
  onResetAverage,
  cardRef
}) => {
  const { displaySettings } = useSettingsStore();
  const units = displaySettings.units;
  
  // Calculate average from measurement history
  const calculateAverage = (): string => {
    if (measurementHistory.length === 0) return '--';
    
    const validMeasurements = measurementHistory.filter(m => {
      const num = parseFloat(m);
      return !isNaN(num) && m !== '--' && m !== 'infinity';
    });
    
    if (validMeasurements.length === 0) return '--';
    
    const sum = validMeasurements.reduce((acc, m) => acc + parseFloat(m), 0);
    const average = sum / validMeasurements.length;
    
    return (average + groundReferenceHeight).toFixed(2);
  };
  
  const averageValue = calculateAverage();
  const displayValue = formatMeasurementDual(averageValue, units);

  return (
    <div ref={cardRef} className="bg-gray-800 p-4 rounded-xl h-full" data-testid="card-average-distance">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-400 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-400" />
          Average Distance
        </h3>
        <button
          onClick={onResetAverage}
          className="p-1 hover:bg-gray-700 rounded-lg transition-colors"
          title="Reset average calculation"
          data-testid="button-reset-average"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
      <div className="font-mono">
        <div className="text-3xl font-bold" data-testid="text-average-distance-primary">
          {displayValue.primary}
        </div>
        <div className="text-lg text-gray-400" data-testid="text-average-distance-secondary">
          {displayValue.secondary}
        </div>
      </div>
      
      <div className="mt-3 pt-2 border-t border-gray-700">
        <div className="text-xs text-gray-500">
          Based on {measurementHistory.length} measurement{measurementHistory.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
};

export default AverageDistanceCard;
