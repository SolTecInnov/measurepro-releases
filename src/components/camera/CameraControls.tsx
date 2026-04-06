import React from 'react';

interface CameraControlsProps {
  onStartCamera: () => Promise<void>;
  onCaptureImage: () => void;
  isLoading?: boolean;
  hasError?: boolean;
  isCameraRunning?: boolean;
}

const CameraControls: React.FC<CameraControlsProps> = ({
  onStartCamera,
  isLoading,
  isCameraRunning
}) => {
  return (
    <div className="flex gap-1.5">
      {!isCameraRunning && (
        <button
          onClick={() => onStartCamera()}
          className="px-2 py-1 bg-green-600 hover:bg-green-700 rounded-md text-xs flex items-center gap-1"
          disabled={isLoading}
          data-testid="button-start-camera"
        >
          {isLoading && <div className="w-3 h-3 border-t-2 border-b-2 border-white rounded-full animate-spin"></div>}
          {isLoading ? 'Starting...' : 'Start Camera'}
        </button>
      )}
    </div>
  );
};

export default CameraControls;