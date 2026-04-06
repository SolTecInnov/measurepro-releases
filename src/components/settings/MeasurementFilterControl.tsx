import React from 'react';
import { Filter, Info } from 'lucide-react';
import { useMeasurementFilterStore } from '../../lib/stores/measurementFilterStore';
import { FilterSensitivity } from '../../lib/filters/measurementFilter';

const SENSITIVITY_LABELS: Record<FilterSensitivity, { label: string; description: string }> = {
  off: { 
    label: 'Off', 
    description: 'No filtering - all readings pass through' 
  },
  low: { 
    label: 'Low', 
    description: '2 consistent readings required, 5m tolerance - fast surveys' 
  },
  medium: { 
    label: 'Medium', 
    description: '3 consistent readings required, 3m tolerance - balanced' 
  },
  high: { 
    label: 'High', 
    description: '4 consistent readings required, 1.5m tolerance - precise' 
  },
};

const MeasurementFilterControl: React.FC = () => {
  const { sensitivity, setSensitivity, lastResult, getStats } = useMeasurementFilterStore();
  const stats = getStats();
  
  const [showInfo, setShowInfo] = React.useState(false);

  return (
    <div className="bg-gray-900 p-4 rounded-lg" data-testid="measurement-filter-control">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
          <Filter className="w-4 h-4 text-blue-400" />
          Noise Filter
        </h4>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="text-gray-400 hover:text-gray-200 transition-colors"
          data-testid="filter-info-toggle"
        >
          <Info className="w-4 h-4" />
        </button>
      </div>

      {showInfo && (
        <div className="mb-4 p-3 bg-gray-800 rounded text-xs text-gray-400">
          <p className="mb-2">
            <strong>Consistency-based filtering:</strong> New readings must form a cluster of 
            consistent values before being accepted. Random noise (snow, rain, dust) is rejected.
          </p>
          <p className="mb-2">
            When a cluster is confirmed, the <strong>minimum value</strong> is used to ensure 
            the lowest clearance (critical obstacles) is preserved.
          </p>
          <p>
            Use Low for fast surveys (quick confirmation), High for slow/precise work 
            (stricter consistency requirements).
          </p>
        </div>
      )}

      <div className="grid grid-cols-4 gap-2 mb-4">
        {(Object.keys(SENSITIVITY_LABELS) as FilterSensitivity[]).map((level) => (
          <button
            key={level}
            onClick={() => setSensitivity(level)}
            className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
              sensitivity === level
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            data-testid={`filter-sensitivity-${level}`}
          >
            {SENSITIVITY_LABELS[level].label}
          </button>
        ))}
      </div>

      <div className="text-xs text-gray-500 mb-3">
        {SENSITIVITY_LABELS[sensitivity].description}
      </div>

      {sensitivity !== 'off' && (
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-gray-800 p-2 rounded">
            <div className="text-green-400 font-mono text-lg">{stats.accepted}</div>
            <div className="text-xs text-gray-500">Accepted</div>
          </div>
          <div className="bg-gray-800 p-2 rounded">
            <div className="text-red-400 font-mono text-lg">{stats.filtered}</div>
            <div className="text-xs text-gray-500">Filtered</div>
          </div>
          <div className="bg-gray-800 p-2 rounded">
            <div className={`font-mono text-lg ${
              lastResult?.confidence && lastResult.confidence >= 70 ? 'text-green-400' :
              lastResult?.confidence && lastResult.confidence >= 40 ? 'text-yellow-400' :
              'text-red-400'
            }`}>
              {lastResult?.confidence ?? '--'}%
            </div>
            <div className="text-xs text-gray-500">Confidence</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeasurementFilterControl;
