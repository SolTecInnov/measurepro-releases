import { AlertTriangle, CheckCircle, X } from 'lucide-react';
import { useSettingsStore } from '../lib/settings';

interface GroundReferenceConfirmModalProps {
  isOpen: boolean;
  groundReference: number;
  onConfirm: () => void;
  onCancel: () => void;
}

const GroundReferenceConfirmModal: React.FC<GroundReferenceConfirmModalProps> = ({
  isOpen,
  groundReference,
  onConfirm,
  onCancel
}) => {
  const { displaySettings } = useSettingsStore();
  const displayUnits = displaySettings.units;

  if (!isOpen) return null;

  const isZero = Math.abs(groundReference) < 0.001;
  
  // Format measurement based on units
  const formattedHeight = displayUnits === 'imperial' 
    ? `${(groundReference * 3.28084).toFixed(3)}ft`
    : `${groundReference.toFixed(3)}m`;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999]">
      <div className="bg-gray-800 rounded-xl w-full max-w-md p-6 mx-4 border-2 border-yellow-500/50">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isZero ? 'bg-red-500/20' : 'bg-yellow-500/20'}`}>
              {isZero ? (
                <AlertTriangle className="w-6 h-6 text-red-400" />
              ) : (
                <CheckCircle className="w-6 h-6 text-yellow-400" />
              )}
            </div>
            <h2 className="text-xl font-semibold text-white">
              {isZero ? 'Ground Reference Not Set!' : 'Confirm Ground Reference'}
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-300"
            data-testid="button-close-ground-ref-modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning Message */}
        <div className={`rounded-lg p-4 mb-4 ${isZero ? 'bg-red-500/20 border border-red-500/50' : 'bg-yellow-500/20 border border-yellow-500/50'}`}>
          {isZero ? (
            <>
              <p className="text-red-300 font-medium mb-2">
                ⚠️ Ground reference is set to ZERO (0.000m)
              </p>
              <p className="text-red-200 text-sm">
                This is physically impossible as it means the laser device is installed at ground level. 
                All your measurements will be incorrect!
              </p>
            </>
          ) : (
            <>
              <p className="text-yellow-300 font-medium mb-2">
                Ground reference is currently set to:
              </p>
              <p className="text-2xl font-mono font-bold text-yellow-100 text-center my-3">
                {formattedHeight}
              </p>
              <p className="text-yellow-200 text-sm">
                Please confirm this is the correct height of your laser device above the ground before starting logging.
              </p>
            </>
          )}
        </div>

        {/* Current Value Display */}
        <div className="bg-gray-700 rounded-lg p-4 mb-4">
          <div className="text-sm text-gray-400 mb-1">Current Ground Reference</div>
          <div className={`text-3xl font-mono font-bold ${isZero ? 'text-red-400' : 'text-green-400'}`}>
            {formattedHeight}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {displayUnits === 'metric' && `(${(groundReference * 3.28084).toFixed(3)}ft)`}
            {displayUnits === 'imperial' && `(${(groundReference / 3.28084).toFixed(3)}m)`}
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 mb-4">
          <p className="text-sm text-blue-300">
            <strong>Note:</strong> A ground reference log entry will be created when you confirm.
            {isZero && ' Please set the correct ground reference height in POI & Height Settings before logging.'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg font-medium transition-colors"
            data-testid="button-cancel-ground-ref"
          >
            {isZero ? 'Set Correct Value' : 'Cancel'}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              isZero 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
            data-testid="button-confirm-ground-ref"
          >
            {isZero ? 'Continue Anyway (Not Recommended)' : 'Confirm & Start Logging'}
          </button>
        </div>

        {isZero && (
          <div className="mt-3 text-center">
            <p className="text-xs text-gray-400">
              Continuing with zero ground reference will produce invalid measurements
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GroundReferenceConfirmModal;
