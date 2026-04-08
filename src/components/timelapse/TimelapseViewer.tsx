import { useState, useEffect, useRef } from 'react';
import { useCameraStore, TimelapseFrame } from '../../lib/camera';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Download, 
  Trash2, 
  AlertCircle,
  Eye,
  Filter,
  Film
} from 'lucide-react';
import { toast } from 'sonner';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export const TimelapseViewer = () => {
  const { timelapseFrames, clearTimelapseFrames } = useCameraStore();
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(5); // FPS
  const [showPOIOnly, setShowPOIOnly] = useState(false);
  const [selectedPOI, setSelectedPOI] = useState<TimelapseFrame['associatedPOIs']>(undefined);
  const playbackIntervalRef = useRef<number | null>(null);

  // Filter frames based on POI filter
  const displayFrames = showPOIOnly 
    ? timelapseFrames.filter(f => f.hasPOI)
    : timelapseFrames;

  const currentFrame = displayFrames[Math.min(currentFrameIndex, displayFrames.length - 1)];

  // Stop playback when reaching end
  useEffect(() => {
    if (currentFrameIndex >= displayFrames.length - 1 && isPlaying) {
      setIsPlaying(false);
    }
  }, [currentFrameIndex, displayFrames.length, isPlaying]);

  // Playback control
  useEffect(() => {
    if (isPlaying && displayFrames.length > 0) {
      playbackIntervalRef.current = window.setInterval(() => {
        setCurrentFrameIndex(prev => {
          if (prev >= displayFrames.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1000 / playbackSpeed);
    } else if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }

    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, displayFrames.length]);

  // Reset frame index when filter changes
  useEffect(() => {
    setCurrentFrameIndex(0);
    setIsPlaying(false);
  }, [showPOIOnly]);

  // Jump to frame functionality - listen for global events
  useEffect(() => {
    const handleJumpToFrame = (event: CustomEvent<{ frameNumber: number }>) => {
      const { frameNumber } = event.detail;
      const frameIndex = displayFrames.findIndex(f => f.frameNumber === frameNumber);
      
      if (frameIndex !== -1) {
        setCurrentFrameIndex(frameIndex);
        setIsPlaying(false);
        // toast suppressed
      } else {
        toast.error(`Frame ${frameNumber} not found`, {
          description: 'This POI may not have a timelapse frame'
        });
      }
    };
    
    window.addEventListener('jumpToTimelapseFrame' as any, handleJumpToFrame);
    return () => window.removeEventListener('jumpToTimelapseFrame' as any, handleJumpToFrame);
  }, [displayFrames]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handlePrevious = () => {
    setCurrentFrameIndex(prev => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCurrentFrameIndex(prev => Math.min(displayFrames.length - 1, prev + 1));
  };

  const handleDownloadAll = async () => {
    try {
      const zip = new JSZip();
      const folder = zip.folder('timelapse_frames');

      if (!folder) {
        throw new Error('Failed to create ZIP folder');
      }

      // toast suppressed

      for (const frame of displayFrames) {
        const response = await fetch(frame.imageUrl);
        const blob = await response.blob();
        const fileName = `frame_${String(frame.frameNumber).padStart(4, '0')}${frame.hasPOI ? '_POI' : ''}.jpg`;
        folder.file(fileName, blob);
      }

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `timelapse_${new Date().toISOString().split('T')[0]}.zip`);
      
      // Clear frames from IndexedDB after successful download
      try {
        const { clearFramesAfterSave } = await import('@/lib/timelapse/crashRecovery');
        await clearFramesAfterSave();
      } catch (cleanupError) {
        console.error('Failed to clear frames from IndexedDB:', cleanupError);
      }
      
      // toast suppressed
    } catch (error) {
      toast.error('Failed to download frames');
    }
  };

  const handleClear = async () => {
    if (confirm(`Delete all ${timelapseFrames.length} timelapse frames?`)) {
      clearTimelapseFrames();
      setCurrentFrameIndex(0);
      setIsPlaying(false);
      
      // Clear frames from IndexedDB as well
      try {
        const { clearFramesAfterSave } = await import('@/lib/timelapse/crashRecovery');
        await clearFramesAfterSave();
      } catch (cleanupError) {
        console.error('Failed to clear frames from IndexedDB:', cleanupError);
      }
      
      // toast suppressed
    }
  };

  const handleViewPOI = (pois: TimelapseFrame['associatedPOIs']) => {
    setSelectedPOI(pois);
  };

  if (timelapseFrames.length === 0) {
    return (
      <div className="p-8 bg-gray-800 border border-gray-700 rounded-lg text-center">
        <Film className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400">No timelapse frames captured yet</p>
        <p className="text-sm text-gray-500 mt-2">Start a timelapse session to begin capturing</p>
      </div>
    );
  }

  if (displayFrames.length === 0 && showPOIOnly) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Timelapse Viewer</h3>
          <button
            onClick={() => setShowPOIOnly(false)}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
          >
            Show All Frames
          </button>
        </div>
        <div className="p-8 bg-gray-800 border border-gray-700 rounded-lg text-center">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <p className="text-gray-400">No frames with POIs found</p>
          <p className="text-sm text-gray-500 mt-2">{timelapseFrames.length} total frames available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="timelapse-viewer">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Timelapse Viewer</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPOIOnly(!showPOIOnly)}
            data-testid="button-filter-poi"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              showPOIOnly 
                ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
          >
            <Filter className="w-4 h-4" />
            {showPOIOnly ? 'POI Only' : 'All Frames'}
          </button>
          <button
            onClick={handleDownloadAll}
            data-testid="button-download-timelapse"
            className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            title="Download All Frames (ZIP)"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={handleClear}
            data-testid="button-clear-timelapse"
            className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
            title="Clear All Frames"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Frame Display */}
      <div className="relative bg-black rounded-lg overflow-hidden">
        {currentFrame && (
          <>
            <img
              src={currentFrame.imageUrl}
              alt={`Frame ${currentFrame.frameNumber}`}
              className="w-full h-auto"
              data-testid={`timelapse-frame-${currentFrame.frameNumber}`}
            />
            
            {/* POI Indicator Overlay */}
            {currentFrame.hasPOI && currentFrame.associatedPOIs && currentFrame.associatedPOIs.length > 0 && (
              <div className="absolute top-4 right-4 bg-yellow-500/90 px-3 py-2 rounded-lg shadow-lg">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-black" />
                  <span className="font-semibold text-black">
                    {currentFrame.associatedPOIs.length} POI{currentFrame.associatedPOIs.length > 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={() => handleViewPOI(currentFrame.associatedPOIs)}
                    className="ml-2 p-1 bg-black/20 hover:bg-black/30 rounded transition-colors"
                    title="View POI Details"
                  >
                    <Eye className="w-4 h-4 text-black" />
                  </button>
                </div>
              </div>
            )}

            {/* Frame Info Overlay */}
            <div className="absolute bottom-4 left-4 bg-black/70 px-3 py-2 rounded-lg text-white">
              <div className="text-sm">
                Frame {currentFrame.frameNumber + 1} of {displayFrames.length}
              </div>
              <div className="text-xs text-gray-300">
                {new Date(currentFrame.timestamp).toLocaleString()}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Playback Controls */}
      <div className="space-y-3">
        {/* Timeline Scrubber */}
        <div className="space-y-2">
          <input
            type="range"
            min="0"
            max={displayFrames.length - 1}
            value={currentFrameIndex}
            onChange={(e) => setCurrentFrameIndex(parseInt(e.target.value))}
            data-testid="input-timelapse-scrubber"
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
            style={{
              background: displayFrames.length > 0
                ? `linear-gradient(to right, 
                    ${displayFrames.map((frame, idx) => 
                      frame.hasPOI 
                        ? `yellow ${(idx / displayFrames.length) * 100}%, yellow ${((idx + 1) / displayFrames.length) * 100}%`
                        : `#374151 ${(idx / displayFrames.length) * 100}%, #374151 ${((idx + 1) / displayFrames.length) * 100}%`
                    ).join(', ')})`
                : undefined
            }}
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>Start</span>
            <span className="text-yellow-400">{timelapseFrames.filter(f => f.hasPOI).length} frames with POIs</span>
            <span>End</span>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevious}
              disabled={currentFrameIndex === 0}
              data-testid="button-previous-frame"
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <SkipBack className="w-5 h-5" />
            </button>
            
            <button
              onClick={handlePlayPause}
              data-testid="button-play-pause"
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5" />
              )}
            </button>
            
            <button
              onClick={handleNext}
              disabled={currentFrameIndex >= displayFrames.length - 1}
              data-testid="button-next-frame"
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>

          {/* Playback Speed */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Speed:</span>
            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(parseInt(e.target.value))}
              data-testid="select-playback-speed"
              className="px-3 py-1 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white"
            >
              <option value="1">1 FPS</option>
              <option value="2">2 FPS</option>
              <option value="5">5 FPS</option>
              <option value="10">10 FPS</option>
              <option value="15">15 FPS</option>
              <option value="30">30 FPS</option>
            </select>
          </div>
        </div>
      </div>

      {/* POI Details Modal */}
      {selectedPOI && selectedPOI.length > 0 && (
        <div 
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedPOI(undefined)}
        >
          <div 
            className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-500" />
                POI Details ({selectedPOI.length})
              </h3>
              <button
                onClick={() => setSelectedPOI(undefined)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <span className="text-2xl text-gray-400">&times;</span>
              </button>
            </div>

            <div className="space-y-3">
              {selectedPOI.map((poi) => (
                <div 
                  key={poi.id}
                  className="p-4 bg-gray-900 border border-yellow-500/30 rounded-lg"
                >
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-400">Road Number:</span>
                      <span className="ml-2 font-semibold text-white">R{String(poi.roadNumber).padStart(3, '0')}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">POI Number:</span>
                      <span className="ml-2 font-semibold text-white">{String(poi.poiNumber).padStart(5, '0')}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-400">Type:</span>
                      <span className="ml-2 font-semibold text-yellow-400">{poi.poiType}</span>
                    </div>
                    {poi.note && (
                      <div className="col-span-2">
                        <span className="text-gray-400">Note:</span>
                        <p className="mt-1 text-white">{poi.note}</p>
                      </div>
                    )}
                    <div className="col-span-2 text-xs text-gray-500">
                      {new Date(poi.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
