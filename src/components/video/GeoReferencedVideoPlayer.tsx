import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Download, MapPin, ChevronRight, ChevronLeft } from 'lucide-react';
import { geoVideoRecorder } from '../../lib/video/geoVideoRecorder';
import { Measurement } from '../../lib/survey/types';
import { toast } from 'sonner';

interface GeoReferencedVideoPlayerProps {
  videoRecordingId: string;
  measurements: Measurement[];
  onClose?: () => void;
}

const GeoReferencedVideoPlayer: React.FC<GeoReferencedVideoPlayerProps> = ({
  videoRecordingId,
  measurements,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showPoiList, setShowPoiList] = useState(true);
  const [selectedPoi, setSelectedPoi] = useState<Measurement | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filter measurements that are linked to this video
  const videoPois = measurements.filter(
    (m) => m.videoBlobId === videoRecordingId && m.videoTimestamp !== null && m.videoTimestamp !== undefined
  );

  // Load video blob
  useEffect(() => {
    const loadVideo = async () => {
      try {
        setIsLoading(true);
        const recording = await geoVideoRecorder.getRecording(videoRecordingId);
        
        if (recording && recording.blob) {
          setVideoBlob(recording.blob);
          const url = URL.createObjectURL(recording.blob);
          setVideoUrl(url);
        } else {
          toast.error('Video not found');
        }
      } catch (error) {
        toast.error('Failed to load video');
      } finally {
        setIsLoading(false);
      }
    };

    loadVideo();

    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoRecordingId]);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleEnded);
    };
  }, [videoUrl]);

  const togglePlayPause = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const time = parseFloat(e.target.value);
    videoRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const jumpToPoi = (poi: Measurement) => {
    if (!videoRef.current || poi.videoTimestamp === null || poi.videoTimestamp === undefined) return;
    
    videoRef.current.currentTime = poi.videoTimestamp;
    setCurrentTime(poi.videoTimestamp);
    setSelectedPoi(poi);
    
    // Auto-play when jumping to POI
    if (!isPlaying) {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleFullscreen = () => {
    if (!videoRef.current) return;
    
    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen();
    }
  };

  const handleDownload = () => {
    if (!videoBlob) return;
    
    const url = URL.createObjectURL(videoBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `video-${videoRecordingId}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Video download started');
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get POI at current time (if any)
  const getCurrentPoi = (): Measurement | null => {
    return videoPois.find(
      (poi) => 
        poi.videoTimestamp !== null &&
        poi.videoTimestamp !== undefined &&
        Math.abs(poi.videoTimestamp - currentTime) < 2 // Within 2 seconds
    ) || null;
  };

  const currentPoi = getCurrentPoi();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="text-white">Loading video...</div>
      </div>
    );
  }

  if (!videoUrl) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="text-white">Video not available</div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-gray-900" data-testid="container-geo-video-player">
      {/* Main Video Area */}
      <div className="flex-1 flex flex-col">
        {/* Video Container */}
        <div className="relative flex-1 bg-black">
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-contain"
            data-testid="video-player"
          />

          {/* Overlay Information */}
          {currentPoi && (
            <div className="absolute top-4 left-4 bg-black/70 text-white p-3 rounded-lg max-w-sm" data-testid="overlay-poi-info">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4 text-blue-400" />
                <span className="font-semibold">
                  {currentPoi.poi_type || 'POI'} ({currentPoi.id.substring(0, 8)})
                </span>
              </div>
              <div className="text-sm space-y-1">
                <div>Height: {currentPoi.rel.toFixed(3)} m</div>
                <div>GPS: {currentPoi.latitude.toFixed(6)}, {currentPoi.longitude.toFixed(6)}</div>
                <div>Alt: {currentPoi.altGPS.toFixed(1)} m</div>
                <div>Speed: {currentPoi.speed.toFixed(1)} km/h</div>
                {currentPoi.note && <div className="text-gray-300 italic">{currentPoi.note}</div>}
              </div>
            </div>
          )}

          {/* Video timestamp */}
          <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-1 rounded font-mono text-sm" data-testid="overlay-timestamp">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>

        {/* Controls */}
        <div className="bg-gray-800 p-4">
          {/* Timeline with POI markers */}
          <div className="relative mb-4">
            <input
              type="range"
              min="0"
              max={duration || 0}
              step="0.1"
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(currentTime / duration) * 100}%, #4b5563 ${(currentTime / duration) * 100}%, #4b5563 100%)`
              }}
              data-testid="input-video-timeline"
            />
            
            {/* POI markers on timeline */}
            <div className="absolute top-0 left-0 right-0 h-2 pointer-events-none">
              {videoPois.map((poi, index) => {
                if (poi.videoTimestamp === null || poi.videoTimestamp === undefined) return null;
                const position = (poi.videoTimestamp / duration) * 100;
                return (
                  <div
                    key={poi.id}
                    className="absolute w-2 h-2 bg-red-500 rounded-full transform -translate-x-1/2 cursor-pointer pointer-events-auto"
                    style={{ left: `${position}%`, top: '0' }}
                    onClick={() => jumpToPoi(poi)}
                    title={`POI ${index + 1}: ${poi.poi_type || 'Unknown'}`}
                    data-testid={`marker-poi-${index}`}
                  />
                );
              })}
            </div>
          </div>

          {/* Control buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlayPause}
                className="p-2 hover:bg-gray-700 rounded-full transition-colors"
                data-testid="button-play-pause"
              >
                {isPlaying ? <Pause className="w-6 h-6 text-white" /> : <Play className="w-6 h-6 text-white" />}
              </button>

              <button
                onClick={toggleMute}
                className="p-2 hover:bg-gray-700 rounded-full transition-colors"
                data-testid="button-mute"
              >
                {isMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
              </button>

              <span className="text-white text-sm font-mono" data-testid="text-time-display">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDownload}
                className="p-2 hover:bg-gray-700 rounded-full transition-colors"
                data-testid="button-download-video"
              >
                <Download className="w-5 h-5 text-white" />
              </button>

              <button
                onClick={handleFullscreen}
                className="p-2 hover:bg-gray-700 rounded-full transition-colors"
                data-testid="button-fullscreen"
              >
                <Maximize className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* POI List Sidebar */}
      <div className={`bg-gray-800 border-l border-gray-700 transition-all duration-300 ${showPoiList ? 'w-80' : 'w-0'}`}>
        {showPoiList && (
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-white font-semibold">POIs ({videoPois.length})</h3>
            </div>

            <div className="flex-1 overflow-y-auto">
              {videoPois.length === 0 ? (
                <div className="p-4 text-gray-400 text-sm">No POIs in this video</div>
              ) : (
                <div className="divide-y divide-gray-700">
                  {videoPois.map((poi, index) => (
                    <button
                      key={poi.id}
                      onClick={() => jumpToPoi(poi)}
                      className={`w-full p-3 text-left hover:bg-gray-700 transition-colors ${
                        selectedPoi?.id === poi.id ? 'bg-blue-600/20' : ''
                      }`}
                      data-testid={`button-poi-${index}`}
                    >
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-blue-400 mt-1 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-medium text-sm truncate">
                            {poi.poi_type || 'POI'} ({poi.id.substring(0, 8)})
                          </div>
                          <div className="text-gray-400 text-xs mt-1">
                            {poi.videoTimestamp !== null && poi.videoTimestamp !== undefined && formatTime(poi.videoTimestamp)}
                          </div>
                          <div className="text-gray-400 text-xs">
                            Height: {poi.rel.toFixed(3)} m
                          </div>
                          {poi.note && (
                            <div className="text-gray-400 text-xs mt-1 italic truncate">
                              {poi.note}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Toggle POI List Button */}
      <button
        onClick={() => setShowPoiList(!showPoiList)}
        className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-gray-800 hover:bg-gray-700 p-2 rounded-l-lg transition-colors"
        data-testid="button-toggle-poi-list"
      >
        {showPoiList ? <ChevronRight className="w-5 h-5 text-white" /> : <ChevronLeft className="w-5 h-5 text-white" />}
      </button>
    </div>
  );
};

export default GeoReferencedVideoPlayer;
