import React from 'react';
import { History, Settings2 } from 'lucide-react';
import { useSettingsStore } from '../../lib/settings';
import { formatMeasurementDual, formatMeasurement } from '../../lib/utils/unitConversion';

interface LastMeasureCardProps {
  filteredMeasurement: string;
  groundReferenceHeight: number;
  measurementHistory: string[];
  lastMeasureColumns: number;
  onShowHistorySettings: () => void;
  cardRef: React.RefObject<HTMLDivElement>;
}

const LastMeasureCard: React.FC<LastMeasureCardProps> = ({
  filteredMeasurement,
  groundReferenceHeight,
  measurementHistory,
  lastMeasureColumns,
  onShowHistorySettings,
  cardRef
}) => {
  const { displaySettings } = useSettingsStore();
  const units = displaySettings.units;
  
  // Calculate adjusted measurement
  const getAdjustedMeasurement = () => {
    if (filteredMeasurement !== '--' && !isNaN(parseFloat(filteredMeasurement))) {
      return parseFloat(filteredMeasurement) + groundReferenceHeight;
    }
    return '--';
  };
  
  const adjustedValue = getAdjustedMeasurement();
  const displayValue = formatMeasurementDual(adjustedValue, units);
  
  return (
    <div ref={cardRef} className="bg-gray-800 p-4 rounded-xl h-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-400 flex items-center gap-2">
          <History className="w-4 h-4 text-blue-400" />
          Last Measure
        </h3>
        <button
          onClick={onShowHistorySettings}
          className="p-1 hover:bg-gray-700 rounded transition-colors"
          title="History Settings"
        >
          <Settings2 className="w-3 h-3 text-gray-400" />
        </button>
      </div>
      <div className="font-mono">
        <div className="text-3xl font-bold">
          {displayValue.primary}
        </div>
        <div className="text-lg text-gray-400">
          {displayValue.secondary}
        </div>
        
        {/* Last measurements history */}
        {measurementHistory.length > 0 && (
          <div className="mt-3 pt-2 border-gray-700">
            <div className="text-xs text-gray-500 mb-2">Previous {measurementHistory.length - 1} measurements:</div>
            <div 
              className="grid gap-2"
              style={{ gridTemplateColumns: `repeat(${lastMeasureColumns}, minmax(0, 1fr))` }}
            >
              {measurementHistory.slice(1).map((measurement, index) => {
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
    </div>
  );
};

export default LastMeasureCard;