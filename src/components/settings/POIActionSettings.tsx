import { POI_TYPES } from '../../lib/poi';
import type { POIType } from '../../lib/poi';
import { usePOIActionsStore, POI_ACTIONS, type POIAction } from '../../lib/poiActions';
import { RotateCcw, Settings } from 'lucide-react';
import { toast } from 'sonner';

const POIActionSettings = () => {
  const { getActionForPOI, setActionForPOI, resetToDefaults, resetPOIToDefault } = usePOIActionsStore();

  const handleActionChange = (poiType: POIType | string, action: POIAction) => {
    setActionForPOI(poiType, action);
    const label = POI_TYPES.find(p => p.type === poiType)?.label ?? 'None';
  };

  const handleResetAll = () => {
    resetToDefaults();
  };

  const handleResetSingle = (poiType: POIType | string) => {
    resetPOIToDefault(poiType);
    const label = POI_TYPES.find(p => p.type === poiType)?.label ?? 'None';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            POI Action Configuration
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            Configure what action happens when you select each POI type via keyboard shortcut or manual selection
          </p>
        </div>
        <button
          onClick={handleResetAll}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg flex items-center gap-2 transition-colors"
          data-testid="button-reset-all-poi-actions"
        >
          <RotateCcw className="w-4 h-4" />
          Reset All to Defaults
        </button>
      </div>

      <div className="bg-gray-800 rounded-lg p-4">
        <div className="space-y-3">
          {POI_TYPES.map((poiType) => {
            const Icon = poiType.icon;
            const currentAction = getActionForPOI(poiType.type as POIType);
            const actionConfig = POI_ACTIONS.find(a => a.action === currentAction);

            return (
              <div
                key={poiType.type}
                className="flex items-center justify-between gap-4 p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`p-2 rounded-lg ${poiType.bgColor}`}>
                    <Icon className={`w-5 h-5 ${poiType.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-100 text-base">{poiType.label}</span>
                      <span className="text-xs text-gray-500 font-mono">({poiType.type})</span>
                    </div>
                    <div className="text-xs text-gray-400 truncate mt-0.5">
                      Current: {actionConfig?.description}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={currentAction}
                    onChange={(e) => handleActionChange(poiType.type as POIType, e.target.value as POIAction)}
                    className="px-3 py-2 bg-gray-800 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm min-w-[220px]"
                    data-testid={`select-poi-action-${poiType.type}`}
                  >
                    {POI_ACTIONS.map((action) => (
                      <option key={action.action} value={action.action}>
                        {action.label}
                      </option>
                    ))}
                  </select>
                  
                  <button
                    onClick={() => handleResetSingle(poiType.type as POIType)}
                    className="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-600 rounded-lg transition-colors"
                    title="Reset to default"
                    data-testid={`button-reset-poi-${poiType.type}`}
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-400 mb-2">Action Types Explained:</h4>
        <ul className="space-y-2 text-sm text-gray-300">
          <li>
            <strong className="text-blue-400">Auto-Capture & Log:</strong> When you press the keyboard shortcut, it automatically captures an image and logs the entry when a measurement is taken
          </li>
          <li>
            <strong className="text-green-400">Auto-Capture (No Measurement):</strong> Automatically captures and logs immediately, without requiring a measurement
          </li>
          <li>
            <strong className="text-purple-400">Open Manual Entry Modal:</strong> Opens a dialog where you can add detailed notes and information
          </li>
          <li>
            <strong className="text-pink-400">Voice Note:</strong> Opens the voice note recording modal for hands-free notes
          </li>
          <li>
            <strong className="text-gray-400">Select Only:</strong> Just selects the POI type - you manually decide when to capture and log
          </li>
        </ul>
      </div>
    </div>
  );
};

export default POIActionSettings;
