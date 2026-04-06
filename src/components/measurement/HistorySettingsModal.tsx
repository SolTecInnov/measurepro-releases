import React from 'react';

interface HistorySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lastMeasureHistoryCount: number;
  setLastMeasureHistoryCount: (count: number) => void;
  minDistanceHistoryCount: number;
  setMinDistanceHistoryCount: (count: number) => void;
}

const HistorySettingsModal: React.FC<HistorySettingsModalProps> = ({
  isOpen,
  onClose,
  lastMeasureHistoryCount,
  setLastMeasureHistoryCount,
  minDistanceHistoryCount,
  setMinDistanceHistoryCount
}) => {
  const commonInputClasses = "w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500";

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Measurement History Settings</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-300"
          >
            ×
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Last Measure History Count
            </label>
            <input
              type="number"
              min="1"
              max="16"
              value={lastMeasureHistoryCount}
              onChange={(e) => setLastMeasureHistoryCount(parseInt(e.target.value) || 5)}
              className={commonInputClasses}
            />
            <p className="text-xs text-gray-400 mt-1">
              Number of previous measurements to display (1-16)
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Minimum Distance History Count
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={minDistanceHistoryCount}
              onChange={(e) => setMinDistanceHistoryCount(parseInt(e.target.value) || 5)}
              className={commonInputClasses}
            />
            <p className="text-xs text-gray-400 mt-1">
              Number of previous minimum distances to display (1-10)
            </p>
          </div>
        </div>
        
        <div className="flex justify-end gap-4 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default HistorySettingsModal;