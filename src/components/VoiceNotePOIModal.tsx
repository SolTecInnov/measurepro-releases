import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, X } from 'lucide-react';
import { VoiceNoteManager } from '../lib/voice/VoiceNoteManager';
import { toast } from 'sonner';

interface VoiceNotePOIModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (audioBlob: Blob | null) => void;
}

const VoiceNotePOIModal: React.FC<VoiceNotePOIModalProps> = ({ isOpen, onClose, onSave }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(50).fill(0));
  const [silenceDuration, setSilenceDuration] = useState(0);
  
  const voiceNoteManagerRef = useRef<VoiceNoteManager | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<number | null>(null);
  const silenceStartTimeRef = useRef<number | null>(null);
  
  const SILENCE_THRESHOLD = 0.02; // Threshold for silence detection (0-1 range)
  const SILENCE_DURATION_MS = 3000; // 3 seconds of silence triggers auto-save

  // Initialize voice note manager
  useEffect(() => {
    if (!voiceNoteManagerRef.current) {
      voiceNoteManagerRef.current = new VoiceNoteManager();
    }
  }, []);

  // Start recording when modal opens
  useEffect(() => {
    if (isOpen && voiceNoteManagerRef.current) {
      startRecording();
    }
    
    return () => {
      cleanup();
    };
  }, [isOpen]);

  const startRecording = async () => {
    if (!voiceNoteManagerRef.current) return;
    
    try {
      await voiceNoteManagerRef.current.startRecording('en-US');
      setIsRecording(true);
      
      // Start duration timer
      durationIntervalRef.current = window.setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      
      // Initialize audio analysis for waveform and silence detection
      await initializeAudioAnalysis();
      
      toast.success('🎙️ Recording started');
    } catch (error) {
      toast.error('Failed to start recording. Please check microphone permissions.');
      onClose();
    }
  };

  const initializeAudioAnalysis = async () => {
    try {
      // Get the media stream from the navigator
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Create audio context and analyser
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      
      // Connect stream to analyser
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
      // Start monitoring audio levels
      monitorAudioLevels();
    } catch (error) {
    }
  };

  const monitorAudioLevels = () => {
    if (!analyserRef.current) return;
    
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const updateLevels = () => {
      if (!analyserRef.current || !isRecording) return;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Calculate average volume (0-255 range, normalize to 0-1)
      const average = dataArray.reduce((a, b) => a + b, 0) / bufferLength / 255;
      
      // Update waveform visualization (keep last 50 samples)
      setAudioLevels(prev => [...prev.slice(1), average]);
      
      // Check for silence
      if (average < SILENCE_THRESHOLD) {
        if (silenceStartTimeRef.current === null) {
          silenceStartTimeRef.current = Date.now();
        } else {
          const silenceDurationMs = Date.now() - silenceStartTimeRef.current;
          setSilenceDuration(silenceDurationMs);
          
          // Auto-save after 3 seconds of silence
          if (silenceDurationMs >= SILENCE_DURATION_MS) {
            handleSave();
            return; // Stop monitoring
          }
        }
      } else {
        // Reset silence timer if sound detected
        silenceStartTimeRef.current = null;
        setSilenceDuration(0);
      }
      
      // Continue monitoring
      animationFrameRef.current = requestAnimationFrame(updateLevels);
    };
    
    updateLevels();
  };

  const handleSave = async () => {
    if (!voiceNoteManagerRef.current || !isRecording) {
      onSave(null);
      onClose();
      return;
    }
    
    try {
      const audioBlob = await voiceNoteManagerRef.current.stopRecording();
      setIsRecording(false);
      cleanup();
      
      toast.success('Voice note saved');
      onSave(audioBlob);
      onClose();
    } catch (error) {
      toast.error('Failed to save recording');
      onSave(null);
      onClose();
    }
  };

  const handleCancel = () => {
    cleanup();
    onSave(null);
    onClose();
    toast.info('Voice note cancelled');
  };

  const cleanup = () => {
    // Stop recording if active
    if (voiceNoteManagerRef.current && isRecording) {
      try {
        voiceNoteManagerRef.current.stopRecording();
      } catch (error) {
      }
    }
    
    // Clear intervals and animation frames
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    // Reset state
    setIsRecording(false);
    setRecordingDuration(0);
    setAudioLevels(new Array(50).fill(0));
    setSilenceDuration(0);
    silenceStartTimeRef.current = null;
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Mic className="w-6 h-6 text-purple-400" />
            Voice Note POI
          </h2>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-white transition-colors"
            data-testid="button-close-voice-modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Recording Status */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              {isRecording && (
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              )}
              <span className="text-2xl font-mono text-white">
                {formatDuration(recordingDuration)}
              </span>
            </div>
            <p className="text-sm text-gray-400">
              {isRecording ? 'Recording...' : 'Preparing...'}
            </p>
          </div>

          {/* Waveform Visualization */}
          <div className="bg-gray-900 rounded-lg p-4 h-32 flex items-end justify-center gap-1">
            {audioLevels.map((level, index) => (
              <div
                key={index}
                className="bg-purple-500 rounded-t transition-all duration-100"
                style={{
                  width: '2px',
                  height: `${Math.max(2, level * 100)}%`,
                  opacity: 0.3 + level * 0.7,
                }}
              />
            ))}
          </div>

          {/* Silence Detection Indicator */}
          {silenceDuration > 0 && (
            <div className="text-center">
              <p className="text-sm text-yellow-400">
                Silence detected: {Math.floor(silenceDuration / 1000)}s / 3s
              </p>
              <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                <div
                  className="bg-yellow-400 h-2 rounded-full transition-all"
                  style={{ width: `${(silenceDuration / SILENCE_DURATION_MS) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium"
              data-testid="button-cancel-voice-note"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!isRecording}
              className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              data-testid="button-save-voice-note"
            >
              <Square className="w-4 h-4" />
              Save
            </button>
          </div>

          <p className="text-xs text-gray-500 text-center">
            Auto-saves after 3 seconds of silence
          </p>
        </div>
      </div>
    </div>
  );
};

export default VoiceNotePOIModal;
