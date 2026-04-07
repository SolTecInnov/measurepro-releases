import React, { useState, useEffect } from 'react';
import { Video, Square, Circle } from 'lucide-react';
import { useVideoRecordingStore } from '../../stores/videoRecordingStore';
import { geoVideoRecorder } from '../../lib/video/geoVideoRecorder';
import { toast } from 'sonner';

interface GeoVideoRecordingControlsProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  surveyId: string | null;
  className?: string;
}

const GeoVideoRecordingControls: React.FC<GeoVideoRecordingControlsProps> = ({
  videoRef,
  surveyId,
  className = '',
}) => {
  const { isRecording, startRecording, stopRecording, getCurrentTimestamp } = useVideoRecordingStore();
  const [recordingDuration, setRecordingDuration] = useState<number>(0);

  // Update recording duration every second
  useEffect(() => {
    if (!isRecording) {
      setRecordingDuration(0);
      return;
    }

    const interval = setInterval(() => {
      const timestamp = getCurrentTimestamp();
      if (timestamp !== null) {
        setRecordingDuration(timestamp);
      }
    }, 100); // Update 10 times per second for smooth display

    return () => clearInterval(interval);
  }, [isRecording, getCurrentTimestamp]);

  const handleStartRecording = async () => {
    if (!videoRef.current) {
      toast.error('Camera not available');
      return;
    }

    if (!surveyId) {
      toast.error('Please start a survey first');
      return;
    }

    try {
      const recordingId = await geoVideoRecorder.startRecording(videoRef.current, surveyId);
      startRecording(recordingId, surveyId);
      // toast suppressed
    } catch (error) {
      toast.error(`Failed to start recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleStopRecording = async () => {
    try {
      const result = await geoVideoRecorder.stopRecording();
      stopRecording();
      
      if (result) {
        const sizeMB = (result.blob.size / 1024 / 1024).toFixed(2);
        /* toast removed */
      } else {
        // toast suppressed
      }
    } catch (error) {
      toast.error('Failed to stop recording');
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {/* Recording Status Badge */}
      {isRecording && (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-red-600/20 border border-red-600 rounded-md">
          <div className="relative flex items-center">
            <Circle className="w-2.5 h-2.5 fill-red-500 text-red-500 animate-pulse" data-testid="icon-recording-indicator" />
            <span className="ml-1.5 text-red-500 font-bold text-xs" data-testid="text-rec-badge">REC</span>
          </div>
          <span className="text-white font-mono text-xs" data-testid="text-recording-duration">
            {formatDuration(recordingDuration)}
          </span>
        </div>
      )}

      {/* Start/Stop Button */}
      {!isRecording ? (
        <button
          onClick={handleStartRecording}
          disabled={!surveyId}
          className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-md text-white text-xs transition-colors"
          data-testid="button-start-video-recording"
        >
          <Video className="w-3 h-3" />
          <span className="hidden sm:inline">Start Video Recording</span>
          <span className="sm:hidden">Start Video</span>
        </button>
      ) : (
        <button
          onClick={handleStopRecording}
          className="flex items-center gap-1 px-2 py-1 bg-red-600 hover:bg-red-700 rounded-md text-white text-xs transition-colors"
          data-testid="button-stop-video-recording"
        >
          <Square className="w-3 h-3" />
          Stop Recording
        </button>
      )}
    </div>
  );
};

export default GeoVideoRecordingControls;
