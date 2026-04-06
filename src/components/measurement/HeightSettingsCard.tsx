import React from 'react';
import { Settings2, Ruler } from 'lucide-react';
import { useLaserStore } from '../../lib/laser';
import { useSettingsStore } from '../../lib/settings';
import { formatMeasurement, parseInputToMeters } from '../../lib/utils/unitConversion';

interface HeightSettingsCardProps {
  groundReferenceHeight: number;
  thresholds: {
    minHeight: number;
    maxHeight: number;
    warningThreshold: number;
    criticalThreshold: number;
  };
}

const HeightSettingsCard: React.FC<HeightSettingsCardProps> = ({
  groundReferenceHeight,
  thresholds
}) => {
  const { setGroundReferenceHeight } = useLaserStore();
  const { displaySettings } = useSettingsStore();
  const units = displaySettings.units;
  
  // Format display value for ground reference input
  const displayValue = formatMeasurement(groundReferenceHeight, units, { showUnit: false });
  const [inputValue, setInputValue] = React.useState(displayValue);
  
  // Update input when units or value change
  React.useEffect(() => {
    setInputValue(formatMeasurement(groundReferenceHeight, units, { showUnit: false }));
  }, [groundReferenceHeight, units]);

  return (
    <div className="h-full">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-medium text-gray-400 flex items-center gap-2">
          <Ruler className="w-4 h-4 text-blue-400" />
          Height Settings
        </h3>
      </div>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between items-center bg-blue-900/20 p-3 rounded-lg border border-blue-800/30">
          <span className="text-blue-400">Ground Reference:</span>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
              }}
              onBlur={(e) => {
                const meters = parseInputToMeters(e.target.value, units);
                setGroundReferenceHeight(meters);
                setInputValue(formatMeasurement(meters, units, { showUnit: false }));
              }}
              className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 text-gray-200 rounded text-xs"
            />
            <span className="text-xs text-gray-300">{units === 'imperial' ? 'ft' : 'm'}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex justify-between">
            <span className="text-gray-400">Ignore Below:</span>
            <span>{formatMeasurement(thresholds.minHeight, units)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Ignore Above:</span>
            <span>{formatMeasurement(thresholds.maxHeight, units)}</span>
          </div>
          <div className="flex justify-between text-orange-400">
            <span>Warning Above:</span>
            <span>{formatMeasurement(thresholds.warningThreshold, units)}</span>
          </div>
          <div className="flex justify-between text-red-400">
            <span>Critical Above:</span>
            <span>{formatMeasurement(thresholds.criticalThreshold, units)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeightSettingsCard;