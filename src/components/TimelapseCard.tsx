import { Film } from 'lucide-react';
import { useCameraStore } from '../lib/camera';
import { TimelapseControls } from './timelapse/TimelapseControls';
import { TimelapseViewer } from './timelapse/TimelapseViewer';

interface TimelapseCardProps {
  videoRef: React.RefObject<HTMLVideoElement>;
}

export const TimelapseCard: React.FC<TimelapseCardProps> = ({ videoRef }) => {
  const { isTimelapseActive, timelapseFrames } = useCameraStore();

  return (
    <div className="space-y-4">
      {/* Status badges only (no icon/title - CardWrapper already shows these) */}
      {(isTimelapseActive || timelapseFrames.length > 0) && (
        <div className="flex items-center justify-end gap-2">
          {isTimelapseActive && (
            <span className="px-2 py-0.5 bg-purple-600 text-xs rounded-full" data-testid="status-timelapse-recording">
              RECORDING
            </span>
          )}
          {!isTimelapseActive && timelapseFrames.length > 0 && (
            <span className="px-2 py-0.5 bg-gray-700 text-xs rounded-full" data-testid="text-timelapse-frames">
              {timelapseFrames.length} frames
            </span>
          )}
        </div>
      )}
      
      {/* Controls */}
      <TimelapseControls videoRef={videoRef} />
      
      {/* Viewer - only show when not recording and has frames */}
      {timelapseFrames.length > 0 && !isTimelapseActive && (
        <TimelapseViewer />
      )}
      
      {/* Help text when empty */}
      {timelapseFrames.length === 0 && !isTimelapseActive && (
        <div className="text-center py-8 text-gray-400 text-sm">
          <Film className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No timelapse frames captured yet.</p>
          <p className="mt-1 text-xs">Set an interval and start recording to capture frames automatically.</p>
        </div>
      )}
    </div>
  );
};
