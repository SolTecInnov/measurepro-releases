import React, { useState, useEffect } from 'react';
import { Video, Play, Square, Clock, Download, Trash2 } from 'lucide-react';
import { videoRecorder } from '../lib/video/VideoRecorder';
import { useCameraStore, VideoRecording } from '../lib/camera';
import { toast } from 'sonner';
import { saveAs } from 'file-saver';

interface VideoRecordingControlsProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  onVideoSaved?: (videoUrl: string, thumbnailUrl: string) => void;
}

const VideoRecordingControls: React.FC<VideoRecordingControlsProps> = ({ 
  videoRef,
  onVideoSaved
}) => {
  const { videoMode, isRecording } = useCameraStore();
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingInterval, setRecordingInterval] = useState<number | null>(null);
  const [savedVideos, setSavedVideos] = useState<VideoRecording[]>([]);
  const [showSavedVideos, setShowSavedVideos] = useState(false);

  // Initialize video recorder when component mounts
  useEffect(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRecorder.initialize(videoRef.current.srcObject as MediaStream, videoRef.current);
    }
    
    // Load saved videos from store
    setSavedVideos(useCameraStore.getState().videoBuffer);
    
    return () => {
      // Clean up recorder when component unmounts
      videoRecorder.dispose();
    };
  }, [videoRef]);

  // Update when video mode changes
  useEffect(() => {
    if (!videoMode) {
      // Stop recording if video mode is disabled
      if (isRecording) {
        handleStopRecording();
      }
    }
  }, [videoMode]);

  // Update recording time
  useEffect(() => {
    if (isRecording) {
      const interval = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      setRecordingInterval(interval);
      
      return () => {
        clearInterval(interval);
      };
    } else {
      if (recordingInterval) {
        clearInterval(recordingInterval);
        setRecordingInterval(null);
      }
      setRecordingTime(0);
    }
  }, [isRecording]);

  // Update saved videos when store changes
  useEffect(() => {
    const unsubscribe = useCameraStore.subscribe(
      (state) => {
        setSavedVideos(state.videoBuffer);
      }
    );
    
    return unsubscribe;
  }, []);

  const handleStartRecording = () => {
    if (!videoRef.current || !videoRef.current.srcObject) {
      toast.error('Camera not available');
      return;
    }
    
    try {
      videoRecorder.initialize(videoRef.current.srcObject as MediaStream, videoRef.current);
      videoRecorder.startRecording();
      useCameraStore.getState().setIsRecording(true);
      setRecordingTime(0);
    } catch (error) {
      toast.error('Failed to start recording');
    }
  };

  const handleStopRecording = async () => {
    try {
      const recording = await videoRecorder.stopRecording();
      useCameraStore.getState().setIsRecording(false);
      
      if (recording) {
        // toast suppressed
        
        // Call callback if provided
        if (onVideoSaved && recording.videoBlob instanceof Blob) {
          const videoUrl = URL.createObjectURL(recording.videoBlob);
          onVideoSaved(videoUrl, recording.thumbnailUrl);
        }
      }
    } catch (error) {
      toast.error('Failed to save recording');
    }
  };

  const handleSaveBuffer = async () => {
    try {
      const recording = await videoRecorder.saveBuffer();
      
      if (recording) {
        // toast suppressed
        
        // Call callback if provided
        if (onVideoSaved && recording.videoBlob instanceof Blob) {
          const videoUrl = URL.createObjectURL(recording.videoBlob);
          onVideoSaved(videoUrl, recording.thumbnailUrl);
        }
      } else {
        toast.error('No buffer available to save');
      }
    } catch (error) {
      toast.error('Failed to save buffer');
    }
  };

  const handleDownloadVideo = (video: VideoRecording) => {
    const downloadVideo = async () => {
      try {
        let videoBlob: Blob | null = video.videoBlob;
        
        // If we don't have a valid blob but have a blob ID, try to retrieve from DB
        if ((!videoBlob || videoBlob.size === 0) && video.videoBlobId) {
          const { getVideoBlob } = await import('../lib/db');
          videoBlob = await getVideoBlob(video.videoBlobId);
        }
        
      // Check if we have a valid video blob
        if (!video || !videoBlob || !(videoBlob instanceof Blob) || videoBlob.size === 0) {
        throw new Error('Video data is not available');
      }
      
      // Use FileSaver to download the video (videoBlob is guaranteed to be Blob here)
        saveAs(videoBlob as Blob, `video-${new Date(video.timestamp).toISOString().replace(/[:.]/g, '-')}.webm`);
      
      // toast suppressed
      } catch (error) {
      toast.error('Failed to download video');
      }
    };
    
    downloadVideo();
  };

  const handleDeleteVideo = (videoId: string) => {
    const newVideos = savedVideos.filter(v => v.id !== videoId);
    useCameraStore.getState().clearVideoBuffer();
    newVideos.forEach(v => useCameraStore.getState().addVideoToBuffer(v));
    setSavedVideos(newVideos);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!videoMode) return null;

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Video className="w-4 h-4 text-blue-400" />
          Video Recording
        </h3>
        
        {savedVideos.length > 0 && (
          <button
            onClick={() => setShowSavedVideos(!showSavedVideos)}
            className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded"
          >
            {showSavedVideos ? 'Hide Videos' : `Show Videos (${savedVideos.length})`}
          </button>
        )}
      </div>
      
      <div className="flex items-center gap-2 mb-4">
        {isRecording ? (
          <button
            onClick={handleStopRecording}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm"
          >
            <Square className="w-4 h-4" />
            Stop Recording
          </button>
        ) : (
          <button
            onClick={handleStartRecording}
            className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-sm"
          >
            <Play className="w-4 h-4" />
            Start Recording
          </button>
        )}
        
        <button
          onClick={handleSaveBuffer}
          disabled={!isRecording}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
            isRecording ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          <Clock className="w-4 h-4" />
          Save Buffer
        </button>
        
        {isRecording && (
          <div className="ml-2 flex items-center gap-1 text-red-400">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
            <span className="text-sm font-mono">{formatTime(recordingTime)}</span>
          </div>
        )}
      </div>
      
      {showSavedVideos && savedVideos.length > 0 && (
        <div className="mt-4 space-y-4">
          <h4 className="text-sm font-medium">Saved Videos</h4>
          <div className="grid grid-cols-2 gap-4 max-h-60 overflow-y-auto p-2">
            {savedVideos.map((video) => video && (
              <div key={video.id} className="bg-gray-700 rounded-lg overflow-hidden">
                <div className="relative">
                  {video.thumbnailUrl ? (
                    <img 
                      src={video.thumbnailUrl} 
                      alt="Video thumbnail" 
                      className="w-full h-24 object-cover"
                      onError={(e) => {
                        // Replace broken thumbnail with a placeholder
                        e.currentTarget.style.display = 'none';
                        const parent = e.currentTarget.parentElement;
                        if (parent) {
                          const placeholder = document.createElement('div');
                          placeholder.className = 'w-full h-24 flex items-center justify-center bg-gray-800';
                          placeholder.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-500"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"></path></svg>';
                          parent.appendChild(placeholder);
                        }
                      }}
                    />
                  ) : (
                    <div className="w-full h-24 flex items-center justify-center bg-gray-800">
                      <Video className="w-8 h-8 text-gray-500" />
                    </div>
                  )}
                  <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1 rounded">
                    {formatTime(Math.round(video.duration))}
                  </div>
                </div>
                <div className="p-2">
                  <div className="text-xs text-gray-300 mb-1">
                    {new Date(video.timestamp).toLocaleTimeString()}
                  </div>
                  <div className="flex justify-between">
                    <button
                      onClick={() => handleDownloadVideo(video)}
                      className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      Save
                    </button>
                    <button
                      onClick={() => handleDeleteVideo(video.id)}
                      className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 rounded flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoRecordingControls;