import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Settings, Route as RouteIcon, Power, Wifi, Database, RefreshCw, Play, Pause, Mic, MicOff, Volume2, Globe, Loader2, Radio } from 'lucide-react';
import { useLaserStore } from '../lib/laser';
import { laserConnection } from '../lib/serial';
import { useVoiceAssistant } from '../hooks/useVoiceAssistant';
import type { SupportedLanguage } from '../lib/voice/types';
import { isBetaUser } from '../lib/auth/masterAdmin';
import { useEnabledFeatures } from '../hooks/useLicenseEnforcement';
import { getAuth } from 'firebase/auth';
import { useGnssRecordingStore } from '../stores/gnssRecordingStore';

interface HeaderProps {
  gpsConnected: boolean;
  wifiStatus: 'good' | 'poor' | 'none';
  dbStatus: 'good' | 'issues' | 'error';
  offlineItemCount: number;
  isTracing: boolean;
  setIsTracing: (tracing: boolean) => void;
  laserRunning: boolean;
  setLaserRunning: (running: boolean) => void;
  isLoggingPaused: boolean;
  setIsLoggingPaused: (paused: boolean) => void;
  updateIntervalRef: React.MutableRefObject<number | null>;
  laserSettings: any;
  showOverlays: boolean;
  setShowOverlays: (show: boolean) => void;
}

const Header: React.FC<HeaderProps> = ({
  gpsConnected,
  wifiStatus,
  dbStatus,
  offlineItemCount,
  isTracing,
  setIsTracing,
  laserRunning,
  setLaserRunning,
  isLoggingPaused,
  setIsLoggingPaused,
  updateIntervalRef,
  laserSettings,
  showOverlays,
  setShowOverlays
}) => {
  const { connected: laserConnected } = useLaserStore();
  const [voiceState, voiceActions] = useVoiceAssistant();
  const [showVoiceMenu, setShowVoiceMenu] = useState(false);
  const [volume, setVolume] = useState(0.8);
  
  // GNSS recording state
  const { isRecording: gnssRecording, isPaused: gnssPaused, pointCount, totalDistance_m } = useGnssRecordingStore();
  
  // Check if beta user (hide voice controls for beta/not-logged-in users)
  const auth = getAuth();
  const { features } = useEnabledFeatures();
  const isBeta = isBetaUser(auth.currentUser, features);

  // Load initial volume (voice command callbacks are now in VoiceCommandBridge)
  useEffect(() => {
    setVolume(voiceActions.getVolume());
  }, [voiceActions]);

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    voiceActions.setVolume(newVolume);
  };

  const getLanguageLabel = (lang: SupportedLanguage): string => {
    const labels: Record<SupportedLanguage, string> = {
      'en-US': '🇺🇸 EN',
      'fr-FR': '🇫🇷 FR',
      'es-ES': '🇪🇸 ES'
    };
    return labels[lang];
  };

  const getMicButtonClass = (): string => {
    if (!voiceState.isSupported) return 'bg-gray-600 cursor-not-allowed';
    if (voiceState.error) return 'bg-red-600 hover:bg-red-700';
    if (voiceState.isProcessing) return 'bg-blue-600';
    if (voiceState.isListening) return 'bg-green-600 animate-pulse';
    if (voiceState.isActive) return 'bg-green-600 hover:bg-green-700';
    return 'bg-gray-600 hover:bg-gray-700';
  };

  const toggleLaser = async () => {
    if (laserRunning) {
      await laserConnection.write('s0c');
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
      setLaserRunning(false);
    } else {
      await laserConnection.write(laserSettings.measurementSettings.command);
      updateIntervalRef.current = setInterval(async () => {
        if (laserSettings.measurementSettings.command === 's0g') {
          await laserConnection.write('s0g');
        }
      }, laserSettings.measurementSettings.updateInterval) as any;
      setLaserRunning(true);
    }
  };

  const handleResetLaser = async () => {
    await laserConnection.write('s0c');
    await new Promise(resolve => setTimeout(resolve, 150));
    await laserConnection.write('s0f+00000000');
    await new Promise(resolve => setTimeout(resolve, 100));
    await laserConnection.write('s0q');
    
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
    }
    updateIntervalRef.current = setInterval(async () => {
      if (laserSettings.measurementSettings.command === 's0g') {
        await laserConnection.write('s0g');
      }
    }, laserSettings.measurementSettings.updateInterval) as any;
    setLaserRunning(true);
  };

  return (
    <header className="bg-gray-800 border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-full ${laserConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm">Laser</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-full ${gpsConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm">GPS</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-full ${
                wifiStatus === 'good' ? 'bg-green-500' : 
                wifiStatus === 'poor' ? 'bg-yellow-500' : 
                'bg-red-500'
              }`} />
              <Wifi className="w-4 h-4" />
              <span className="text-sm">WiFi</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-full ${
                dbStatus === 'good' ? 'bg-green-500' : 
                dbStatus === 'issues' ? 'bg-yellow-500' : 
                'bg-red-500'
              }`} />
              <Database className="w-4 h-4" />
              <span className="text-sm">{offlineItemCount} items</span>
            </div>
            
            {/* GNSS Profile Recording Indicator */}
            {(gnssRecording || gnssPaused) && (
              <Link 
                to="/road-profile" 
                className="flex items-center gap-2 px-2 py-1 bg-cyan-500/20 rounded-lg hover:bg-cyan-500/30 transition-colors"
                data-testid="gnss-recording-indicator"
              >
                <div className={`h-2.5 w-2.5 rounded-full ${
                  gnssRecording ? 'bg-cyan-400 animate-pulse' : 'bg-yellow-400'
                }`} />
                <Radio className="w-4 h-4 text-cyan-400" />
                <span className="text-sm text-cyan-400">
                  {gnssPaused ? 'GNSS Paused' : 'GNSS REC'}
                </span>
                <span className="text-xs text-cyan-300">
                  {pointCount} pts | {(totalDistance_m / 1000).toFixed(2)} km
                </span>
              </Link>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Voice Assistant Controls (Hidden for beta users) */}
            {!isBeta && (
              <div className="relative">
                <button
                  onClick={() => {
                    if (!voiceState.isSupported) return;
                    if (voiceState.isActive) {
                      voiceActions.stopListening();
                    } else {
                      voiceActions.startListening();
                    }
                  }}
                  className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${getMicButtonClass()}`}
                  disabled={!voiceState.isSupported}
                  data-testid="button-voice-assistant"
                  title={voiceState.isSupported ? 'Voice Commands' : 'Voice commands not supported'}
                >
                  {voiceState.isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : voiceState.isActive ? (
                    <Mic className="w-4 h-4" />
                  ) : (
                    <MicOff className="w-4 h-4" />
                  )}
                  {voiceState.isListening && 'Listening'}
                  {voiceState.isProcessing && 'Processing'}
                </button>

                {/* Transcript Overlay */}
                {voiceState.transcript && voiceState.isListening && (
                  <div className="absolute top-full mt-2 left-0 p-2 bg-gray-900 border border-gray-700 rounded-lg shadow-lg min-w-[200px] z-50" data-testid="text-voice-transcript">
                    <div className="text-xs text-gray-400 mb-1">Transcript:</div>
                    <div className="text-sm text-white">{voiceState.transcript}</div>
                  </div>
                )}

                {/* Last Response Display */}
                {voiceState.lastResponse && !voiceState.isListening && !voiceState.isProcessing && (
                  <div className="absolute top-full mt-2 left-0 p-2 bg-blue-900 border border-blue-700 rounded-lg shadow-lg min-w-[200px] z-50" data-testid="text-voice-response">
                    <div className="text-xs text-blue-300 mb-1">Response:</div>
                    <div className="text-sm text-white">{voiceState.lastResponse}</div>
                  </div>
                )}
              </div>
            )}

            {/* Voice Settings Menu (Hidden for beta users) */}
            {!isBeta && (
              <div className="relative">
                <button
                  onClick={() => setShowVoiceMenu(!showVoiceMenu)}
                  className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-gray-700 hover:bg-gray-600"
                  data-testid="button-voice-settings"
                  disabled={!voiceState.isSupported}
                  title="Voice Settings"
                >
                  <Globe className="w-4 h-4" />
                  {getLanguageLabel(voiceState.currentLanguage)}
                </button>

                {showVoiceMenu && voiceState.isSupported && (
                  <div className="absolute top-full mt-2 right-0 p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-lg min-w-[220px] z-50" data-testid="menu-voice-settings">
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-400 mb-2 block">Language</label>
                        <div className="space-y-1">
                          {(['en-US', 'fr-FR', 'es-ES'] as SupportedLanguage[]).map((lang) => (
                            <button
                              key={lang}
                              onClick={() => voiceActions.setLanguage(lang)}
                              className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                                voiceState.currentLanguage === lang
                                  ? 'bg-blue-600 text-white'
                                  : 'hover:bg-gray-800 text-gray-300'
                              }`}
                              data-testid={`button-language-${lang}`}
                            >
                              {getLanguageLabel(lang)}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-gray-400 mb-2 block">
                          Volume: {Math.round(volume * 100)}%
                        </label>
                        <div className="flex items-center gap-2">
                          <Volume2 className="w-4 h-4 text-gray-400" />
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={volume * 100}
                            onChange={(e) => handleVolumeChange(parseInt(e.target.value) / 100)}
                            className="flex-1"
                            data-testid="slider-voice-volume"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <Link
              to="/settings"
              className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-gray-800 text-gray-400 hover:bg-gray-700"
              data-testid="link-settings"
            >
              <Settings className="w-4 h-4" />
              Settings
            </Link>

            <button
              onClick={() => setIsTracing(!isTracing)}
              className={`flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isTracing ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'
              }`}
            >
              <RouteIcon className="w-4 h-4" />
              {isTracing ? 'Stop Tracking' : 'Start Tracking'}
            </button>

            <button
              onClick={toggleLaser}
              className={`flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                laserRunning ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
              }`}
              disabled={!laserConnected}
            >
              <Power className="w-4 h-4" />
              {laserRunning ? 'Stop Laser' : 'Start Laser'}
            </button>
            
            <button
              onClick={handleResetLaser}
              className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-blue-500 hover:bg-blue-600"
              disabled={!laserConnected}
            >
              <RefreshCw className="w-4 h-4" />
              Reset Laser
            </button>
            
            <button
              onClick={() => setIsLoggingPaused(!isLoggingPaused)}
              className={`flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isLoggingPaused ? 'bg-green-500 hover:bg-green-600' : 'bg-yellow-500 hover:bg-yellow-600'
              }`}
            >
              {isLoggingPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              {isLoggingPaused ? 'Resume Logging' : 'Pause Logging'}
            </button>
            <button
              onClick={() => setShowOverlays(!showOverlays)}
              className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-blue-500 hover:bg-blue-600"
            >
              {showOverlays ? 'Hide Overlays' : 'Show Overlays'}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;