import React from 'react';
import { AlertTriangle, Camera } from 'lucide-react';
import { Link } from 'react-router-dom';

interface CameraErrorDisplayProps {
  errorMessage: string | null;
  permissionState: 'granted' | 'denied' | 'prompt' | 'unknown';
  cameraStartAttempts: number;
  onRequestAccess: () => Promise<void>;
}

const CameraErrorDisplay: React.FC<CameraErrorDisplayProps> = ({
  errorMessage,
  permissionState,
  cameraStartAttempts,
  onRequestAccess
}) => {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-red-500 text-center p-4">
      <AlertTriangle className="w-8 h-8 mb-2" />
      <div className="text-sm max-w-md space-y-2">
        <p>{errorMessage || 'Camera initialization failed'} 
          {permissionState === 'granted' ? ' (Permission appears granted but camera access failed)' : ''}
        </p>
        
        {errorMessage?.includes('resolution') && (
          <Link to="/camera" className="mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded inline-block text-white">
            Adjust Camera Settings
          </Link>
        )}
        
        {(errorMessage?.includes('denied') || permissionState === 'denied') && (
          <div className="mt-2 text-xs text-gray-300">
            <p className="mb-1">To enable camera access:</p>
            <ol className="list-decimal list-inside mt-1 space-y-1">
              <li>Click the camera icon in your browser's address bar</li>
              <li>Select "Allow" for camera access</li>
              <li>Refresh the page after allowing access</li>
              <li>Make sure no other applications are using your camera</li>
              <li>Try restarting your browser if the issue persists</li>
            </ol>
            <button 
              onClick={onRequestAccess}
              className="mt-3 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-white flex items-center gap-1.5 mx-auto"
            >
              <Camera className="w-3 h-3" />
              Request Camera Access Again
            </button>
          </div>
        )}
      </div>
      
      {cameraStartAttempts > 1 && (
        <div className="mt-4 text-xs text-gray-300 bg-gray-700/50 p-3 rounded-lg max-w-md">
          <p className="font-medium mb-1">Advanced troubleshooting tips:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Try using a different browser (Chrome or Edge recommended)</li>
            <li>Restart your computer to release any locked camera resources</li>
            <li>Check if your camera is working in other applications</li>
            <li>Try disabling any browser extensions that might interfere with camera access</li>
            <li>Make sure your camera drivers are up to date</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default CameraErrorDisplay;