import { useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Gauge } from 'lucide-react';
import { useSweptPathStore } from '../../stores/sweptPathStore';

const AnimationControls = () => {
  const { playback, setPlaybackState, settings, setSettings } = useSweptPathStore();

  const handlePlayPause = () => {
    setPlaybackState({ isPlaying: !playback.isPlaying });
  };

  const handleFrameChange = (frame: number) => {
    setPlaybackState({ currentFrame: frame, isPlaying: false });
  };

  const handleSpeedChange = (speed: number) => {
    setSettings({ animationSpeed: speed });
  };

  const handleSkipToStart = () => {
    setPlaybackState({ currentFrame: 0, isPlaying: false });
  };

  const handleSkipToEnd = () => {
    setPlaybackState({ currentFrame: playback.totalFrames - 1, isPlaying: false });
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handlePlayPause();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handleFrameChange(Math.max(0, playback.currentFrame - 1));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleFrameChange(Math.min(playback.totalFrames - 1, playback.currentFrame + 1));
      } else if (e.code === 'Home') {
        e.preventDefault();
        handleSkipToStart();
      } else if (e.code === 'End') {
        e.preventDefault();
        handleSkipToEnd();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playback]);

  if (playback.totalFrames === 0) return null;

  return (
    <div className="bg-background border border-border rounded-lg p-4 space-y-4">
      <div className="flex items-center gap-2">
        {/* Skip to start */}
        <button
          onClick={handleSkipToStart}
          className="btn btn-sm"
          title="Skip to start (Home)"
          data-testid="button-skip-start"
        >
          <SkipBack className="w-4 h-4" />
        </button>

        {/* Play/Pause */}
        <button
          onClick={handlePlayPause}
          className="btn btn-sm btn-primary"
          title="Play/Pause (Space)"
          data-testid="button-play-pause"
        >
          {playback.isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>

        {/* Skip to end */}
        <button
          onClick={handleSkipToEnd}
          className="btn btn-sm"
          title="Skip to end (End)"
          data-testid="button-skip-end"
        >
          <SkipForward className="w-4 h-4" />
        </button>

        {/* Frame counter */}
        <span className="text-sm ml-4" data-testid="text-frame-counter">
          Frame {playback.currentFrame + 1} / {playback.totalFrames}
        </span>
      </div>

      {/* Frame slider */}
      <div>
        <input
          type="range"
          min="0"
          max={playback.totalFrames - 1}
          value={playback.currentFrame}
          onChange={(e) => handleFrameChange(parseInt(e.target.value))}
          className="w-full"
          data-testid="slider-frame"
        />
      </div>

      {/* Speed control */}
      <div className="flex items-center gap-2">
        <Gauge className="w-4 h-4" />
        <span className="text-sm">Speed: {settings.animationSpeed}x</span>
        <input
          type="range"
          min="0.5"
          max="2.0"
          step="0.1"
          value={settings.animationSpeed}
          onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
          className="flex-1"
          data-testid="slider-speed"
        />
      </div>

      {/* Keyboard shortcut hints */}
      <div className="text-xs text-muted-foreground">
        <p>Keyboard: Space (play/pause), ← → (frame), Home/End (skip)</p>
      </div>
    </div>
  );
};

export default AnimationControls;
