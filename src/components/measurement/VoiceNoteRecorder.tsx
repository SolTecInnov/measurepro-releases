import { useState, useEffect, useRef } from 'react';
import { Mic, Square, Check, X } from 'lucide-react';
import { VoiceNoteManager } from '../../lib/voice/VoiceNoteManager';
import type { SupportedLanguage } from '../../lib/voice/types';
import { toast } from 'sonner';

interface VoiceNoteRecorderProps {
  measurementId: string;
  language: SupportedLanguage;
  onSave: () => void;
  onCancel: () => void;
}

export function VoiceNoteRecorder({ measurementId, language, onSave, onCancel }: VoiceNoteRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const managerRef = useRef<VoiceNoteManager>(new VoiceNoteManager());
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const manager = managerRef.current;

    manager.onRecordingStateChange((recording) => {
      setIsRecording(recording);
    });

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      await managerRef.current.startRecording(language);
      setDuration(0);
      
      // Start duration timer
      timerRef.current = window.setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

      // Start waveform visualization
      drawRecordingWaveform();

      // toast suppressed
    } catch (error) {
      toast.error('Failed to start recording', {
        description: 'Please ensure microphone permissions are granted'
      });
    }
  };

  const stopRecording = async () => {
    try {
      const blob = await managerRef.current.stopRecording();
      setAudioBlob(blob);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }

      // toast suppressed
    } catch (error) {
      toast.error('Failed to stop recording');
    }
  };

  const handleSave = async () => {
    if (!audioBlob) return;

    try {
      await managerRef.current.saveVoiceNote(measurementId, audioBlob, language);
      // toast suppressed
      onSave();
    } catch (error) {
      toast.error('Failed to save voice note');
    }
  };

  const handleCancel = () => {
    if (isRecording) {
      stopRecording();
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
    }

    onCancel();
  };

  const drawRecordingWaveform = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    const draw = () => {
      if (!isRecording && !managerRef.current.getIsRecording()) {
        return;
      }

      ctx.fillStyle = 'rgba(17, 24, 39, 1)';
      ctx.fillRect(0, 0, width, height);

      // Draw animated waveform
      ctx.fillStyle = 'rgba(239, 68, 68, 1)';
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

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
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
    <div className="p-4 bg-gray-800 rounded-lg space-y-4" data-testid="voice-note-recorder">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Record Voice Note</h3>
        <span className="px-2 py-1 text-xs bg-blue-600 rounded" data-testid="text-recorder-language">
          {getLanguageLabel(language)}
        </span>
      </div>

      <div>
        <canvas
          ref={canvasRef}
          width={400}
          height={60}
          className="w-full h-15 rounded bg-gray-900"
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {!isRecording && !audioBlob && (
            <button
              onClick={startRecording}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              data-testid="button-start-recording"
            >
              <Mic className="w-5 h-5" />
              Start Recording
            </button>
          )}

          {isRecording && (
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors"
              data-testid="button-stop-recording"
            >
              <Square className="w-5 h-5" />
              Stop Recording
            </button>
          )}

          <span className="text-lg font-mono text-gray-300" data-testid="text-recording-duration">
            {formatTime(duration)}
          </span>

          {isRecording && (
            <span className="flex items-center gap-2 text-red-500">
              <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              Recording...
            </span>
          )}
        </div>

        {audioBlob && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
              data-testid="button-save-recording"
            >
              <Check className="w-5 h-5" />
              Save
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors"
              data-testid="button-cancel-recording"
            >
              <X className="w-5 h-5" />
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
