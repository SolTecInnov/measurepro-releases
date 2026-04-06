import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Download } from 'lucide-react';
import type { VoiceNote } from '../../lib/voice/types';

interface VoiceNotePlayerProps {
  voiceNote: VoiceNote;
}

export function VoiceNotePlayer({ voiceNote }: VoiceNotePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(voiceNote.duration);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationIdRef = useRef<number | null>(null);

  useEffect(() => {
    // Create audio element
    const audio = new Audio();
    const url = URL.createObjectURL(voiceNote.blob);
    audio.src = url;
    audioRef.current = audio;

    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration);
    });

    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime);
    });

    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      setCurrentTime(0);
    });

    return () => {
      audio.pause();
      URL.revokeObjectURL(url);
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [voiceNote]);

  const togglePlayback = async () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    } else {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
        drawWaveform();
      } catch (error) {
      }
    }
  };

  const drawWaveform = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Simple waveform visualization
    const draw = () => {
      if (!isPlaying) return;

      ctx.fillStyle = 'rgba(17, 24, 39, 1)';
      ctx.fillRect(0, 0, width, height);

      // Draw progress bar
      const progress = currentTime / duration;
      ctx.fillStyle = 'rgba(59, 130, 246, 0.5)';
      ctx.fillRect(0, 0, width * progress, height);

      // Draw waveform bars
      ctx.fillStyle = 'rgba(59, 130, 246, 1)';
      const barWidth = width / 50;
      const barGap = 2;

      for (let i = 0; i < 50; i++) {
        const barHeight = Math.random() * height * 0.8;
        const x = i * (barWidth + barGap);
        const y = (height - barHeight) / 2;
        ctx.fillRect(x, y, barWidth, barHeight);
      }

      animationIdRef.current = requestAnimationFrame(draw);
    };

    draw();
  };

  const handleDownload = () => {
    const url = URL.createObjectURL(voiceNote.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voice-note-${voiceNote.id}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getLanguageLabel = (lang: string): string => {
    const labels: Record<string, string> = {
      'en-US': 'EN',
      'fr-FR': 'FR',
      'es-ES': 'ES'
    };
    return labels[lang] || lang;
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg" data-testid="voice-note-player">
      <button
        onClick={togglePlayback}
        className="flex items-center justify-center w-10 h-10 bg-blue-600 hover:bg-blue-700 rounded-full transition-colors"
        data-testid="button-voice-note-play"
      >
        {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
      </button>

      <div className="flex-1">
        <canvas
          ref={canvasRef}
          width={300}
          height={40}
          className="w-full h-10 rounded bg-gray-900"
        />
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-400 font-mono" data-testid="text-voice-note-time">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        <span className="px-2 py-1 text-xs bg-blue-600 rounded" data-testid="text-voice-note-language">
          {getLanguageLabel(voiceNote.language)}
        </span>

        <button
          onClick={handleDownload}
          className="flex items-center justify-center w-8 h-8 hover:bg-gray-700 rounded transition-colors"
          data-testid="button-voice-note-download"
          title="Download voice note"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
